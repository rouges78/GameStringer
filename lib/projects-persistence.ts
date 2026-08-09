'use client';

/**
 * Projects persistence bridge — l'ultimo terzo di [storage-per-origine].
 *
 * Il registro dei progetti (`gs_translation_projects`) e il progetto attivo
 * vivono in IndexedDB, che è legata all'ORIGINE del webview: in dev un cambio
 * porta = origine nuova = progetti "spariti" (è così che il 03/08/2026 un
 * checkpoint da 16.164 stringhe è sembrato perso). Le impostazioni hanno già
 * la loro cura in lib/settings-persistence.ts; questo modulo replica lo STESSO
 * pattern per i progetti, con le STESSE difese:
 *
 * - disco = fonte di verità, in $DATA/GameStringer/projects.json — la stessa
 *   cartella di settings.json, così backup e diagnosi guardano un posto solo;
 * - hydrateProjectsFromDisk() all'avvio, PRIMA che la pagina Progetti legga;
 * - merge per id con updatedAt più recente che vince: un'origine nuova con
 *   IndexedDB vuota RITROVA i progetti dal disco, e un progetto avanzato in
 *   un'altra origine non viene regredito;
 * - hydrationSettled: il flush automatico è un no-op finché l'hydration non ha
 *   concluso — è la corsa che il 04/08 poteva svuotare settings.json, chiusa
 *   qui prima ancora di aprirla (vedi settings-persistence.ts).
 *
 * Niente comandi Rust nuovi: usa @tauri-apps/plugin-fs (già in uso in 5 file)
 * con i permessi fs già dichiarati in capabilities/default.json. In ambiente
 * non-Tauri (dev browser) gli import lanciano: errori silenziati, si prosegue
 * con la sola IndexedDB, come fa settings-persistence.
 */

import { get, set } from 'idb-keyval';
import { clientLogger } from '@/lib/client-logger';

const PROJECTS_KEY = 'gs_translation_projects';
const ACTIVE_PROJECT_KEY = 'gs_active_project';

/** Forma minima che serve al merge: il resto del progetto viaggia opaco. */
interface ProjectLike {
  id: string;
  updatedAt?: string;
  [k: string]: unknown;
}

interface DiskBlob {
  savedAt: string;
  activeProjectId?: string;
  projects: ProjectLike[];
  /** Tombstone `gameId:lang` dei progetti ELIMINATI dall'utente: i backfill
   *  (session/visionaire) li saltano, sennò la card eliminata risorge dal
   *  translation_session.json al giro dopo (il backfill gira ogni 60s).
   *  Una NUOVA traduzione vera ripassa dall'apply, che registra il progetto
   *  direttamente: la card ricompare senza toccare il tombstone. */
  deletedKeys?: string[];
}

let hydrated = false;
let hydrationSettled = false;
// Cache in memoria dei tombstone (idratata dal disco, aggiornata sui delete).
let tombstones = new Set<string>();

/** Chiave tombstone canonica. */
export function projectTombstoneKey(gameId: string, targetLanguage: string): string {
  return `${gameId}:${targetLanguage}`;
}

/** true se questo gioco+lingua è stato eliminato dall'utente. */
export function isProjectTombstoned(gameId: string, targetLanguage: string): boolean {
  return tombstones.has(projectTombstoneKey(gameId, targetLanguage));
}

/** Registra l'eliminazione e la persiste su disco (fire-and-forget). */
export async function addProjectTombstone(gameId: string, targetLanguage: string): Promise<void> {
  tombstones.add(projectTombstoneKey(gameId, targetLanguage));
  // Il flush normale porta i tombstone su disco insieme al registro; qui lo
  // forziamo subito perché un delete è un'azione esplicita dell'utente.
  await persistProjectsToDisk({ allowEmpty: true }).catch(() => { /* già loggato */ });
}

/** Percorso di $DATA/GameStringer/projects.json; null fuori da Tauri. */
async function diskFilePath(): Promise<string | null> {
  try {
    const { dataDir, join } = await import('@tauri-apps/api/path');
    const dir = await join(await dataDir(), 'GameStringer');
    return await join(dir, 'projects.json');
  } catch {
    return null;
  }
}

async function readDisk(): Promise<DiskBlob | null> {
  try {
    const path = await diskFilePath();
    if (!path) return null;
    const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
    if (!(await exists(path))) return null;
    const blob = JSON.parse(await readTextFile(path)) as DiskBlob;
    return Array.isArray(blob?.projects) ? blob : null;
  } catch (e: unknown) {
    // warn: qui si arriva solo DENTRO Tauri (fuori, diskFilePath è già null),
    // quindi un errore è un projects.json corrotto o illeggibile — trattarlo
    // come «nessun progetto» in silenzio nasconderebbe una perdita dati.
    clientLogger.warn('projects readDisk fallita (file corrotto?):', String(e));
    return null;
  }
}

// Un solo avviso per sessione: il flush è fire-and-forget e può ritentare
// spesso — un toast a ogni retry sarebbe rumore, zero toast era il silenzio
// che ha già fatto sparire un checkpoint (03/08).
let writeFailureNotified = false;

async function writeDisk(blob: DiskBlob): Promise<void> {
  const path = await diskFilePath();
  if (!path) return;
  const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
  const dir = path.slice(0, path.length - 'projects.json'.length - 1);
  // Il mkdir NON è best-effort: se la cartella non è creabile, la write sotto
  // fallisce comunque — meglio un errore con la causa vera che due bugie.
  await mkdir(dir, { recursive: true }).catch((e: unknown) => {
    clientLogger.warn('projects mkdir fallita (la write sotto dirà il resto):', String(e));
  });
  try {
    await writeTextFile(path, JSON.stringify(blob, null, 2));
  } catch (e: unknown) {
    clientLogger.error('projects.json NON scritto su disco:', String(e));
    if (!writeFailureNotified) {
      writeFailureNotified = true;
      try {
        const { toast } = await import('sonner');
        toast.warning('Registro progetti non salvato su disco', {
          description: String(e).slice(0, 140),
        });
      } catch { /* sonner non disponibile (test/SSR): resta il log */ }
    }
    throw e;
  }
}

/** Merge per id: vince l'updatedAt più recente; gli sconosciuti si sommano. */
function mergeProjects(disk: ProjectLike[], local: ProjectLike[]): ProjectLike[] {
  const byId = new Map<string, ProjectLike>();
  for (const p of disk) if (p?.id) byId.set(p.id, p);
  for (const p of local) {
    if (!p?.id) continue;
    const d = byId.get(p.id);
    if (!d) { byId.set(p.id, p); continue; }
    const dT = Date.parse(d.updatedAt || '') || 0;
    const lT = Date.parse(p.updatedAt || '') || 0;
    if (lT >= dT) byId.set(p.id, p);
  }
  return [...byId.values()];
}

/**
 * Idrata IndexedDB dal file su disco. Da chiamare all'avvio (SettingsBootGate),
 * prima che la pagina Progetti legga. Una volta sola; sicura fuori da Tauri.
 */
export async function hydrateProjectsFromDisk(): Promise<void> {
  if (typeof window === 'undefined' || hydrated) return;
  hydrated = true;
  try {
    const disk = await readDisk();
    const local = (await get<ProjectLike[]>(PROJECTS_KEY)) || [];

    // I tombstone si idratano SEMPRE, anche con zero progetti su disco.
    if (disk?.deletedKeys?.length) {
      tombstones = new Set([...tombstones, ...disk.deletedKeys]);
    }

    if (disk && disk.projects.length > 0) {
      const merged = mergeProjects(disk.projects, local);
      await set(PROJECTS_KEY, merged);
      if (disk.activeProjectId && !(await get<string>(ACTIVE_PROJECT_KEY))) {
        await set(ACTIVE_PROJECT_KEY, disk.activeProjectId);
      }
      // Riallinea il disco al merge, così la prossima hydration è coerente.
      // Non fatale (il merge è già in IndexedDB) ma MAI muto.
      await writeDisk({ savedAt: new Date().toISOString(), activeProjectId: disk.activeProjectId, projects: merged, deletedKeys: [...tombstones] })
        .catch((e: unknown) => clientLogger.warn('riallineamento disco post-hydration fallito:', String(e)));
      clientLogger.debug(`projects hydration: ${disk.projects.length} da disco + ${local.length} locali → ${merged.length}`);
    } else if (local.length > 0) {
      // Migrazione una-tantum: IndexedDB esistente → disco.
      const active = await get<string>(ACTIVE_PROJECT_KEY);
      await writeDisk({ savedAt: new Date().toISOString(), activeProjectId: active, projects: local, deletedKeys: [...tombstones] });
      clientLogger.debug(`projects hydration: migrati ${local.length} progetti su disco`);
    }
  } catch (e: unknown) {
    clientLogger.debug('hydrateProjectsFromDisk skipped:', String(e));
  } finally {
    // Anche in caso di errore: da qui in poi IndexedDB è la migliore versione
    // che abbiamo, quindi scriverla su disco non distrugge nulla.
    hydrationSettled = true;
  }
}

/** true quando l'hydration ha finito e il flush su disco è sicuro. */
export function isProjectsHydrationSettled(): boolean {
  return hydrationSettled;
}

/**
 * Persiste il registro corrente su disco. Fire-and-forget dai call-site di
 * scrittura (translation-projects.ts) e dai flush di SettingsBootGate.
 * No-op finché l'hydration non è conclusa: mai copiare su disco una IndexedDB
 * che potrebbe essere ancora vuota (stessa corsa chiusa il 04/08 sui settings).
 */
export async function persistProjectsToDisk(opts: { allowEmpty?: boolean } = {}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!hydrationSettled) {
    clientLogger.debug('persistProjectsToDisk saltato: hydration non conclusa');
    return;
  }
  try {
    const projects = (await get<ProjectLike[]>(PROJECTS_KEY)) || [];
    // Mai svuotare il disco con un registro vuoto — TRANNE quando lo svuotamento
    // è intenzionale (deleteProject dell'ultimo progetto): senza questa
    // eccezione il progetto cancellato risorgerebbe alla prossima hydration.
    if (projects.length === 0 && !opts.allowEmpty) return;
    const active = await get<string>(ACTIVE_PROJECT_KEY);
    await writeDisk({ savedAt: new Date().toISOString(), activeProjectId: active, projects, deletedKeys: [...tombstones] });
  } catch (e: unknown) {
    // warn, non debug: se il registro non si salva è un rischio di perdita
    // dati, non un dettaglio di sviluppo (writeDisk ha già avvisato l'utente
    // una volta per sessione).
    clientLogger.warn('persistProjectsToDisk fallito:', String(e));
  }
}
