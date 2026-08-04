// Flusso condiviso per la traduzione di giochi Visionaire Studio (stringhe nel
// binario game.veb / .vis). Estrae le stringhe, traduce via Ollama
// (offline_translate_batch) e applica con patch_vis_strings (che crea backup
// .gs_bak automatico). Checkpoint/resume su idb-keyval: un job lungo (decine di
// migliaia di stringhe in locale) sopravvive a interruzioni e applica risultati
// parziali in-game.
//
// Coerente con il pattern "hero" degli altri motori (Ren'Py/Hendrix):
// orchestratore lib/<engine>-translate.ts + ramo in startAutoTranslate.

import { invoke } from '@/lib/tauri-api';
import { get, set, del } from 'idb-keyval';
import { gamePathKey } from '@/lib/game-path';
import { translateWithFallbackBatched } from '@/lib/ai/ai-translate-direct';
import { projectService } from '@/lib/services/translation-projects';

export type VisionaireBackend = 'ollama' | 'cloud';

export interface VisionaireProgress {
  phase: 'scan' | 'extract' | 'translate' | 'apply' | 'done';
  done: number;
  total: number;
}

interface VisString {
  index: number;
  text: string;
  offset_in_veb: number;
  language_id: number;
}

// Codici/placeholder da preservare: {var}, <tag>, %s/%d/%1, \n.
// Niente masking: si VALIDA soltanto. Se la traduzione perde/altera i codici la
// scartiamo e lasciamo la stringa non tradotta (ritentata al resume), così non
// finiscono codici rotti nel game.veb.
const CODE = /(\{[^}]*\}|<[^>]+>|%[sd0-9]|\\n)/g;
function codeKey(s: string): string {
  return (s.match(CODE) ?? []).slice().sort().join('');
}

function lsGet(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}

// ── Stop richiesto dall'utente ──────────────────────────────────────────────
// Fino al 03/08/2026 un job da ore si fermava SOLO chiudendo la app (Ctrl+C
// in dev): il pulsante Annulla del widget ora imposta questo flag e il loop
// lo controlla tra un blocco e l'altro. Fermarsi TRA i blocchi significa:
// checkpoint scritto (disco+idb), patch parziale applicata, niente stato a
// metà. Il resume riparte esattamente da lì.
const stopRequests = new Set<string>();
export function requestVisionaireStop(gamePath: string): void {
  stopRequests.add(gamePathKey(gamePath));
}

// Traduce un blocco di testi col backend scelto, restituendo le traduzioni
// allineate per indice. Cloud = Gemini→fallback (veloce); Ollama = locale.
async function translateChunk(
  // model opzionale: se assente, il comando Rust sceglie il migliore tra i
  // modelli installati (resolve_model) — vedi nota in runVisionaireTranslation.
  texts: string[], tgt: string, backend: VisionaireBackend, model?: string
): Promise<string[]> {
  if (backend === 'cloud') {
    const res = await translateWithFallbackBatched(
      { texts, targetLanguage: tgt, sourceLanguage: 'en' }, 20
    );
    return res.translations;
  }
  const res = await invoke<{ translated: string }[]>('offline_translate_batch', {
    texts, sourceLang: 'en', targetLang: tgt, model,
  });
  return res.map(r => r.translated);
}

export async function runVisionaireTranslation(opts: {
  gamePath: string;
  targetLang?: string;
  backend?: VisionaireBackend;
  model?: string;
  chunkSize?: number;
  // Meta gioco: se presenti, il job crea/aggiorna una voce nella pagina "Progetti".
  gameId?: string;
  gameName?: string;
  gameImage?: string;
  onProgress?: (p: VisionaireProgress) => void;
}): Promise<{ applied: number; total: number; translated: number; backend: VisionaireBackend; stopped?: boolean }> {
  const tgt = (opts.targetLang || 'it').toLowerCase();
  const backend: VisionaireBackend = opts.backend || 'ollama';
  // Niente default cablato: 'gemma4:e4b' era un modello FANTASMA (03/08/2026:
  // 25.936 errori 404 su Foolish Mortals). Con undefined il comando Rust
  // sceglie il migliore tra i modelli DAVVERO installati (resolve_model),
  // che ora fa anche da rete di sicurezza se localStorage contiene un
  // modello disinstallato nel frattempo.
  const model = opts.model || lsGet('gs_hendrix_model') || undefined;
  // Cloud parallelizza internamente → blocchi più grandi; Ollama è seriale.
  const CHUNK = opts.chunkSize || Number(lsGet('gs_vis_chunk')) || (backend === 'cloud' ? 200 : 40);
  const SAVE_EVERY = 400; // checkpoint + apply parziale ogni ~400 stringhe
  const EXTRACT_PAGE = 2000; // estrai a pagine per non caricare tutto in memoria
  const report = opts.onProgress || (() => {});

  // 1) Scan: numero totale di stringhe
  report({ phase: 'scan', done: 0, total: 0 });
  const info = await invoke<{ version?: string; file_count?: number; total_strings: number }>(
    'scan_vis_strings', { gamePath: opts.gamePath }
  );
  const total = info.total_strings;

  // Checkpoint per questo gioco+lingua: index -> testo tradotto.
  // gamePathKey: chiave stabile anche se il path arriva con separatori/casing diversi.
  const ckptKey = `gs_vis_ckpt_${gamePathKey(opts.gamePath)}_${tgt}`;
  // ⚠️ L'IndexedDB è legata all'ORIGINE del webview, e in dev la porta cambia
  // a ogni avvio (port-manager): il 03/08/2026 un checkpoint da 16.164
  // stringhe è "sparito" così — porta nuova, origine nuova, tutto da zero.
  // Per questo il checkpoint vive ANCHE su disco (via Rust, accanto al
  // gioco): sopravvive a porte, riavvii e reinstallazioni. idb resta come
  // cache veloce; il file è la verità.
  const diskCkptPath = `${opts.gamePath}/gamestringer_ckpt_${tgt}.json`;
  let translations: Record<number, string> =
    (await get<Record<number, string>>(ckptKey).catch(() => undefined)) || {};
  if (Object.keys(translations).length === 0) {
    // Migrazione: checkpoint salvati prima della normalizzazione (chiave col path grezzo)
    const legacyKey = `gs_vis_ckpt_${opts.gamePath}_${tgt}`;
    if (legacyKey !== ckptKey) {
      const legacy = await get<Record<number, string>>(legacyKey).catch(() => undefined);
      if (legacy && Object.keys(legacy).length > 0) {
        translations = legacy;
        await set(ckptKey, legacy).catch(() => {});
        await del(legacyKey).catch(() => {});
      }
    }
  }
  if (Object.keys(translations).length === 0) {
    // idb vuota (porta diversa o prima volta): prova il file su disco.
    try {
      const rows = await invoke<{ id: string; translated: string }[]>(
        'load_hendrix_translations', { inputPath: diskCkptPath }
      );
      for (const r of rows) if (r.translated) translations[Number(r.id)] = r.translated;
      if (rows.length > 0) await set(ckptKey, translations).catch(() => {});
    } catch { /* nessun checkpoint su disco: si parte da zero davvero */ }
  }

  // Registra il gioco nella pagina "Progetti" (IndexedDB), così appare appena
  // si inizia a lavorarci e mostra il progresso reale.
  let projectId: string | null = null;
  if (opts.gameId) {
    try {
      const proj = await projectService.createOrGetProject({
        gameId: opts.gameId,
        gameName: opts.gameName || opts.gameId,
        gameImage: opts.gameImage,
        engine: 'Visionaire Studio',
        sourceLanguage: 'en',
        targetLanguage: tgt,
        // Identità per percorso: senza, il backfill (gameId `vis-<path>`) e
        // questo job (gameId di libreria) creavano DUE progetti per lo stesso
        // gioco e la pagina Progetti ne sommava i contatori.
        gamePathKey: gamePathKey(opts.gamePath),
        files: [{ path: opts.gamePath, name: 'data.vis', type: 'visionaire', strings: total }],
      });
      projectId = proj.id;
      // Allinea il totale (un progetto esistente potrebbe averlo a 0).
      if (proj.totalStrings !== total) {
        proj.totalStrings = total;
        await projectService.saveProject(proj);
      }
    } catch { /* progetto non disponibile: si prosegue comunque */ }
  }
  const syncProject = async () => {
    if (projectId) {
      await projectService.updateProgress(projectId, Object.keys(translations).length).catch(() => {});
    }
  };

  // 2) Estrazione a pagine
  report({ phase: 'extract', done: 0, total });
  const all: VisString[] = [];
  for (let off = 0; off < total; off += EXTRACT_PAGE) {
    const page = await invoke<VisString[]>('extract_vis_strings', {
      gamePath: opts.gamePath, offset: off, limit: EXTRACT_PAGE,
    });
    if (!page.length) break;
    all.push(...page);
  }

  // Da tradurre: testo non vuoto e indice non già nel checkpoint
  const todo = all.filter(s => s.text && s.text.trim() && translations[s.index] === undefined);
  let done = total - todo.length;
  report({ phase: 'translate', done, total });

  const toMap = (): Record<number, string> => {
    const m: Record<number, string> = {};
    for (const k of Object.keys(translations)) m[Number(k)] = translations[Number(k)];
    return m;
  };

  const flush = async () => {
    await set(ckptKey, translations).catch(() => {});
    // Copia su disco: è QUESTA la persistenza vera (vedi nota su diskCkptPath).
    // original resta vuoto di proposito: il checkpoint mappa indice→testo,
    // l'originale è ricostruibile dall'archivio.
    await invoke('save_hendrix_translations', {
      outputPath: diskCkptPath,
      strings: Object.keys(translations).map(k => ({
        id: String(k), original: '', translated: translations[Number(k)], context: '',
      })),
    }).catch(() => {});
    // patch_vis_strings è idempotente (backup .gs_bak creato una volta sola):
    // applica i risultati parziali così sono già provabili in-game.
    await invoke('patch_vis_strings', { gamePath: opts.gamePath, translations: toMap() }).catch(() => {});
    await syncProject(); // aggiorna il progresso nella pagina "Progetti"
  };

  // 3) Traduzione a blocchi via Ollama
  let sinceSave = 0;
  for (let i = 0; i < todo.length; i += CHUNK) {
    if (stopRequests.delete(gamePathKey(opts.gamePath))) {
      // Stop pulito: salva e applica quanto fatto, poi esci senza errore.
      await flush();
      const translated = Object.keys(translations).length;
      report({ phase: 'done', done, total });
      return { applied: translated, total, translated, backend, stopped: true };
    }
    const slice = todo.slice(i, i + CHUNK);
    const outs = await translateChunk(slice.map(s => s.text), tgt, backend, model);
    outs.forEach((raw, k) => {
      const src = slice[k];
      const out = (raw || '').trim();
      const bad = !out || out.startsWith('[ERRORE]');
      // Accetta solo se i codici combaciano e la stringa è effettivamente cambiata
      // (evita di marcare come "fatte" stringhe rimaste in lingua originale).
      if (!bad && out !== src.text && codeKey(out) === codeKey(src.text)) {
        translations[src.index] = out;
      }
    });
    done += slice.length;
    sinceSave += slice.length;
    report({ phase: 'translate', done, total });
    if (sinceSave >= SAVE_EVERY) { await flush(); sinceSave = 0; }
  }

  // 4) Applicazione finale
  report({ phase: 'apply', done, total });
  await flush();
  const result = await invoke<{ patched?: number }>('patch_vis_strings', {
    gamePath: opts.gamePath, translations: toMap(),
  });

  const translated = Object.keys(translations).length;
  await syncProject(); // progresso finale nella pagina "Progetti"
  report({ phase: 'done', done: total, total });
  return { applied: result?.patched ?? translated, total, translated, backend };
}
