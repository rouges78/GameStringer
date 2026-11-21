'use client';

/**
 * Backfill dei progetti Visionaire dai checkpoint già salvati in IndexedDB.
 *
 * I job di traduzione Visionaire salvano un checkpoint sotto la chiave
 * `gs_vis_ckpt_<gamePath>_<lang>` (index → testo tradotto). Per i giochi su cui
 * si è già lavorato PRIMA che la pagina Progetti registrasse i progetti, qui
 * ricostruiamo le voci così ricompaiono in "Progetti" senza rifare nulla.
 *
 * Idempotente: usa projectService.createOrGetProject (dedup per gameId+lingua).
 */

import { keys, get, del } from 'idb-keyval';
import { invoke } from '@/lib/tauri-api';
import { cleanGamePath, gamePathKey } from '@/lib/game-path';
import type { VisCheckpointRow } from '@/lib/visionaire-translate';
import { projectService } from '@/lib/services/translation-projects';
import { isProjectTombstoned } from '@/lib/projects-persistence';

const PREFIX = 'gs_vis_ckpt_';

/**
 * Gioco reinstallato in un'altra libreria Steam: la cartella del checkpoint
 * non ha più il .vis, ma Steam sa dove sta il gioco oggi. Se il checkpoint su
 * disco porta il testo sorgente, lo si accoda a quello della cartella nuova:
 * al prossimo avvio il job lo riaggancia per testo (reconcileVisCheckpoint).
 * I checkpoint vecchi, solo indice → traduzione, NON si portano: sull'archivio
 * nuovo l'indice indica un'altra frase. Il file nella cartella vecchia resta.
 */
async function carryCheckpointToMovedGame(oldPathKey: string, lang: string): Promise<boolean> {
  const dir = oldPathKey.match(/\/steamapps\/common\/([^/]+)$/)?.[1];
  if (!dir) return false;
  try {
    const newPath = await invoke<string>('find_game_install_path', { installDir: dir });
    if (gamePathKey(newPath) === oldPathKey) return false;
    await invoke('detect_visionaire', { gamePath: newPath });
    const file = `gamestringer_ckpt_${lang}.json`;
    const oldRows = (await invoke<VisCheckpointRow[]>(
      'load_hendrix_translations', { inputPath: `${oldPathKey}/${file}` }
    )).filter(r => r.original && r.translated);
    if (oldRows.length === 0) return false;
    const newFile = `${cleanGamePath(newPath)}/${file}`;
    const newRows = await invoke<VisCheckpointRow[]>(
      'load_hendrix_translations', { inputPath: newFile }
    ).catch(() => []);
    await invoke('save_hendrix_translations', { outputPath: newFile, strings: [...newRows, ...oldRows] });
    return true;
  } catch {
    return false;
  }
}

export async function backfillVisionaireProjects(): Promise<number> {
  let allKeys: IDBValidKey[] = [];
  try {
    allKeys = await keys();
  } catch {
    return 0;
  }

  let created = 0;
  for (const k of allKeys) {
    if (typeof k !== 'string' || !k.startsWith(PREFIX)) continue;

    // chiave = gs_vis_ckpt_<gamePath>_<lang> ; gamePath può contenere '_' e ':'\
    const rest = k.slice(PREFIX.length);
    const li = rest.lastIndexOf('_');
    if (li <= 0) continue;
    const gamePath = rest.slice(0, li);
    const lang = rest.slice(li + 1);

    let ckpt: Record<number, string> | undefined;
    try {
      ckpt = await get<Record<number, string>>(k);
    } catch {
      continue;
    }
    const translated = ckpt ? Object.keys(ckpt).length : 0;
    if (translated <= 0) continue;

    const name = gamePath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || gamePath;
    const gameId = `vis-${gamePath}`;

    // Card eliminata dall'utente: non risorgerla dal checkpoint (stessa
    // regola del backfill session — «Elimina» deve restare eliminato).
    // Prima dello scan: per una card eliminata non serve leggere il gioco.
    if (isProjectTombstoned(gameId, lang)) continue;

    // Totale reale via scan (best-effort: il gioco potrebbe non essere più installato)
    let total = translated;
    try {
      const info = await invoke<{ total_strings?: number }>('scan_vis_strings', { gamePath });
      if (info?.total_strings && info.total_strings > 0) total = info.total_strings;
    } catch {
      // Gioco spostato e checkpoint trasportabile: le traduzioni passano alla
      // cartella nuova e questa chiave non serve più (senza toglierla, il
      // file verrebbe accodato di nuovo a ogni apertura di "Progetti").
      if (await carryCheckpointToMovedGame(gamePath, lang)) {
        await del(k).catch(() => {});
        continue;
      }
      // Altrimenti gioco non disponibile: usa translated come totale.
    }

    try {
      const proj = await projectService.createOrGetProject({
        gameId,
        gameName: name,
        engine: 'Visionaire Studio',
        sourceLanguage: 'en',
        targetLanguage: lang,
        // gamePath qui viene dalla chiave del checkpoint, che è GIÀ la chiave
        // normalizzata (gs_vis_ckpt_<gamePathKey>_<lang>): passandola, il
        // backfill ritrova il progetto vero del job invece di crearne un
        // gemello `vis-...` col nome della cartella.
        gamePathKey: gamePath,
        files: [{ path: gamePath, name: 'data.vis', type: 'visionaire', strings: total }],
      });
      // Solo ALZARE, mai abbassare: con l'identità per percorso (04/08) qui
      // può arrivare il progetto VERO del job, che conosce il totale pieno
      // dallo scan (es. 25.936); il checkpoint ne vede meno (es. 16.978) e
      // sovrascrivere lo ridurrebbe — il backfill integra, non corregge.
      proj.totalStrings = Math.max(proj.totalStrings || 0, total);
      proj.translatedStrings = Math.max(proj.translatedStrings || 0, translated);
      proj.progress = proj.totalStrings > 0
        ? Math.min(100, Math.round((proj.translatedStrings / proj.totalStrings) * 100))
        : 0;
      if (proj.progress >= 100) proj.status = 'completed';
      await projectService.saveProject(proj);
      created++;
    } catch { /* progetto non disponibile */ }
  }
  return created;
}
