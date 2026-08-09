// Flusso Danganronpa DR1 dietro «String it!» (regola: UN pulsante, la app
// instrada al motore giusto — 09/08/2026).
//
// estrai (contratto del REBUILD, stesso modulo Rust: original identici per
// costruzione) → traduci offline a batch con CHECKPOINT su
// GameStringer_Translation/translations.json → rebuild WAD in Rust
// (rebuild_danganronpa_wad: lunghezza variabile, verifica interna).
//
// STOP cooperativo come Ren'Py: requestDanganronpaStop(gamePath) dal widget
// globale; al batch successivo il flusso salva, RICOSTRUISCE con quello che
// c'è e si ferma dichiarando l'esito parziale.

import { invoke } from '@/lib/tauri-api';
import { acceptOfflineTranslation } from '@/lib/hendrix-translate';
import { clientLogger } from '@/lib/client-logger';

export interface DanganronpaProgress {
  phase: 'extract' | 'translate' | 'rebuild' | 'done';
  done: number;
  total: number;
}

export interface DanganronpaRebuildResult {
  success: boolean;
  wads_rebuilt: string[];
  lin_files_rebuilt: number;
  strings_written: number;
  strings_matched_by_text: number;
  strings_skipped_mismatch: number;
  strings_missing_translation: number;
  verified_sample: number;
  verified_sample_total: number;
}

interface TranslationRow {
  file: string;
  index: number;
  original: string;
  translated: string;
}

const STOPS = new Set<string>();
/** Richiesta di stop dal widget globale: fermati al prossimo batch, salvando. */
export function requestDanganronpaStop(gamePath: string): void {
  STOPS.add(gamePath);
}

function lsGet(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}

export async function runDanganronpaTranslation(opts: {
  gamePath: string;
  targetLang?: string;
  model?: string;
  chunkSize?: number;
  onProgress?: (p: DanganronpaProgress) => void;
}): Promise<{ translatedNow: number; totalTranslated: number; total: number; stopped: boolean; rebuild: DanganronpaRebuildResult | null }> {
  const tgt = (opts.targetLang || 'it').toLowerCase();
  const model = opts.model || lsGet('gs_hendrix_model') || 'gemma4:e4b';
  const CHUNK = opts.chunkSize || 15;
  const SAVE_EVERY = 300;
  const report = opts.onProgress || (() => {});
  STOPS.delete(opts.gamePath);

  // 1. Estrazione col contratto del rebuild (stesse funzioni Rust).
  report({ phase: 'extract', done: 0, total: 0 });
  const extraction = await invoke<{ strings: { file: string; index: number; original: string }[] }>(
    'extract_danganronpa_wad_text', { gamePath: opts.gamePath }
  );
  const rows: TranslationRow[] = extraction.strings.map(s => ({ ...s, translated: '' }));
  const total = rows.length;
  // GUARDIA DI SANITÀ (la lezione del 09/08: un parser sbagliato produsse 235
  // stringhe invece di ~48.000 e il rebuild cancellò il resto). DR1 ha decine
  // di migliaia di battute: se ne troviamo un pugno, il parser è rotto e NON
  // si tocca il WAD.
  if (total < 1000) {
    throw new Error(
      `Estrazione sospetta: solo ${total} stringhe dal WAD (attese decine di migliaia). ` +
      `Il parser .lin non riconosce il formato: rebuild annullato per non danneggiare il gioco.`
    );
  }
  const key = (r: { file: string; index: number }) => `${r.file}#${r.index}`;
  const byKey = new Map(rows.map(r => [key(r), r]));

  // 2. Checkpoint: translations.json esistente (anche scritto a mano o da un
  //    run precedente). Un entry vale solo se l'original coincide ANCORA.
  const trPath = `${opts.gamePath.replace(/[\\/]+$/, '')}/GameStringer_Translation/translations.json`;
  try {
    const fsp = await import('@tauri-apps/plugin-fs');
    if (await fsp.exists(trPath)) {
      const saved = JSON.parse(await fsp.readTextFile(trPath)) as Array<Partial<TranslationRow> & { line_index?: number }>;
      let resumed = 0, stale = 0;
      for (const s of saved) {
        if (!s.file || !s.translated) continue;
        const ix = (s.index ?? s.line_index);
        if (ix === undefined || ix === null) continue;
        // match per basename: il checkpoint può avere il path pieno o corto
        const target = byKey.get(`${s.file}#${ix}`)
          ?? rows.find(r => r.index === ix && r.file.endsWith(s.file!.split('/').pop() || ''));
        if (!target) { stale++; continue; }
        if (s.original && s.original.trim() !== target.original.trim()) { stale++; continue; }
        target.translated = s.translated;
        resumed++;
      }
      clientLogger.info(`[DR1] checkpoint: ${resumed} traduzioni riprese, ${stale} scartate (original cambiato)`);
    }
  } catch (e: unknown) {
    clientLogger.warn('[DR1] checkpoint illeggibile, si riparte da zero:', String(e));
  }

  let translatedTotal = rows.filter(r => r.translated).length;
  let translatedNow = 0;
  report({ phase: 'translate', done: translatedTotal, total });

  const saveCheckpoint = async () => {
    try {
      const fsp = await import('@tauri-apps/plugin-fs');
      const dir = trPath.slice(0, trPath.lastIndexOf('/'));
      await fsp.mkdir(dir, { recursive: true }).catch(() => { /* esiste già */ });
      await fsp.writeTextFile(trPath, JSON.stringify(rows, null, 1));
    } catch (e: unknown) {
      // Il checkpoint è la rete di sicurezza: se non si salva, DIRLO.
      clientLogger.error('[DR1] checkpoint NON salvato:', String(e));
      throw e;
    }
  };

  // 3. Traduzione offline a batch, con stop cooperativo.
  const todo = rows.filter(r => !r.translated);
  let stopped = false;
  let sinceSave = 0;
  for (let i = 0; i < todo.length; i += CHUNK) {
    if (STOPS.has(opts.gamePath)) { stopped = true; break; }
    const slice = todo.slice(i, i + CHUNK);
    const res = await invoke<{ translated: string }[]>('offline_translate_batch', {
      texts: slice.map(r => r.original), sourceLang: 'en', targetLang: tgt, model,
    });
    res.forEach((tr, k) => {
      const accepted = acceptOfflineTranslation(slice[k].original, (tr.translated || '').trim());
      if (accepted !== null && accepted !== slice[k].original) {
        slice[k].translated = accepted;
        translatedNow++;
        translatedTotal++;
      }
    });
    sinceSave += slice.length;
    report({ phase: 'translate', done: translatedTotal, total });
    if (sinceSave >= SAVE_EVERY) { await saveCheckpoint(); sinceSave = 0; }
  }
  await saveCheckpoint();

  // 4. Rebuild WAD con quello che c'è (anche parziale: onestà del contatore
  //    la fa il comando Rust, con verifica interna).
  let rebuild: DanganronpaRebuildResult | null = null;
  if (translatedTotal > 0) {
    report({ phase: 'rebuild', done: translatedTotal, total });
    rebuild = await invoke<DanganronpaRebuildResult>('rebuild_danganronpa_wad', {
      gamePath: opts.gamePath,
    });
  }

  report({ phase: 'done', done: translatedTotal, total });
  STOPS.delete(opts.gamePath);
  return { translatedNow, totalTranslated: translatedTotal, total, stopped, rebuild };
}
