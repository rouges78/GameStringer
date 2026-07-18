// Flusso condiviso per la traduzione di giochi con Hendrix_Localization (game_messages.csv).
// Usato sia dal pulsante "STRING IT!" (game-detail-client) sia da "Traduci Tutto"
// (translation-recommendation). Include checkpoint/resume e apply incrementale, così un
// job lungo (decine di migliaia di stringhe in locale) sopravvive a interruzioni.

import { invoke } from '@/lib/tauri-api';
import { autoFixPlaceholders } from '@/lib/ai/placeholder-guard';

export interface HendrixProgress {
  phase: 'detect' | 'extract' | 'translate' | 'apply' | 'enable' | 'done';
  done: number;
  total: number;
}

interface HendrixRow {
  id: string;
  original: string;
  translated: string;
  context: string;
}

// Codici di controllo RPG Maker / placeholder da preservare: \C[n] \N[n] \V[n] \I[n],
// \. \! \| \^ ecc., token {ITEM}/{...}, e segnaposto %1..%9.
// Niente masking: i test su gemma4:e4b mostrano che il modello preserva meglio i codici se
// istruito nel prompt (vedi offline_translation.rs) che sostituendoli con token che poi altera.
// Qui i codici servono solo a VALIDARE: se la traduzione li perde/altera, la scartiamo e
// lasciamo la stringa non tradotta (così non finiscono codici rotti in gioco; retry al resume).
const CODE = /(\\[A-Za-z]+\[[^\]]*\]|\\[.!|^><$]|\{[^}]*\}|%\d)/g;
function codeKey(s: string): string {
  return (s.match(CODE) ?? []).slice().sort().join('');
}

/**
 * Valida (ed eventualmente ripara) una traduzione del batch offline.
 * Ritorna la stringa da accettare, o null se va scartata (retry al resume).
 * Se il modello ha perso/alterato i codici, tenta PRIMA l'auto-fix
 * deterministico del guard: sblocca stringhe che altrimenti resterebbero
 * non tradotte per sempre. Esportata per i test.
 */
export function acceptOfflineTranslation(orig: string, out: string): string | null {
  if (!out || out.startsWith('[ERRORE]')) return null;
  if (codeKey(out) === codeKey(orig)) return out;
  const fixed = autoFixPlaceholders(orig, out);
  return codeKey(fixed) === codeKey(orig) ? fixed : null;
}

function lsGet(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}

export async function runHendrixTranslation(opts: {
  gamePath: string;
  targetLang?: string;
  targetName?: string;
  model?: string;
  chunkSize?: number;
  onProgress?: (p: HendrixProgress) => void;
}): Promise<{ applied: number; total: number }> {
  const tgt = (opts.targetLang || 'it').toLowerCase();
  const name = opts.targetName || 'Italiano';
  const model = opts.model || lsGet('gs_hendrix_model') || 'gemma4:e4b';
  const CHUNK = opts.chunkSize || Number(lsGet('gs_hendrix_chunk')) || 40;
  const SAVE_EVERY = 400; // salva checkpoint + applica al CSV ogni ~400 stringhe
  const report = opts.onProgress || (() => {});

  report({ phase: 'detect', done: 0, total: 0 });
  const det = await invoke<{ csv_path: string }>('detect_hendrix_game', { gamePath: opts.gamePath });
  const progressPath = `${det.csv_path}.gsprogress_${tgt}.json`;

  report({ phase: 'extract', done: 0, total: 0 });
  const extraction = await invoke<{ strings: { original: string; context?: string }[] }>(
    'extract_hendrix_strings', { gamePath: opts.gamePath }
  );
  // Original unici (extract già deduplica lato Rust).
  const rows: HendrixRow[] = extraction.strings.map((s, i) => ({
    id: String(i + 1), original: s.original, translated: '', context: s.context || '',
  }));
  const total = rows.length;

  // Resume: carica eventuale checkpoint precedente.
  const translations: Record<string, string> = {};
  try {
    const saved = await invoke<HendrixRow[]>('load_hendrix_translations', { inputPath: progressPath });
    for (const r of saved) if (r.translated) translations[r.original] = r.translated;
  } catch { /* nessun checkpoint: si parte da zero */ }

  let done = Object.keys(translations).length;
  report({ phase: 'translate', done, total });

  // Da tradurre: original non ancora presenti nel checkpoint.
  const todo = rows.filter(r => !translations[r.original]);

  const syncRowsAndSave = async () => {
    for (const r of rows) if (translations[r.original]) r.translated = translations[r.original];
    await invoke('save_hendrix_translations', { outputPath: progressPath, strings: rows }).catch(() => {});
    await invoke('apply_hendrix_translations', {
      csvPath: det.csv_path, translations, targetLanguage: tgt, outputPath: det.csv_path,
    }).catch(() => {});
  };

  let sinceSave = 0;
  for (let i = 0; i < todo.length; i += CHUNK) {
    const slice = todo.slice(i, i + CHUNK);
    const res = await invoke<{ translated: string }[]>('offline_translate_batch', {
      texts: slice.map(r => r.original), sourceLang: 'en', targetLang: tgt, model,
    });
    res.forEach((tr, k) => {
      const orig = slice[k].original;
      const accepted = acceptOfflineTranslation(orig, (tr.translated || '').trim());
      if (accepted !== null) translations[orig] = accepted;
    });
    done += slice.length;
    sinceSave += slice.length;
    report({ phase: 'translate', done, total });

    if (sinceSave >= SAVE_EVERY) {
      await syncRowsAndSave(); // checkpoint + applica risultati parziali in-game
      sinceSave = 0;
    }
  }

  // Finalizzazione: salva, applica colonna, abilita plugin + lingua.
  await syncRowsAndSave();
  report({ phase: 'apply', done, total });
  const applied = await invoke<{ applied: number }>('apply_hendrix_translations', {
    csvPath: det.csv_path, translations, targetLanguage: tgt, outputPath: det.csv_path,
  });
  report({ phase: 'enable', done, total });
  await invoke<string>('enable_hendrix_localization', {
    gamePath: opts.gamePath, symbol: tgt, name, setDefault: true,
  });
  report({ phase: 'done', done, total });
  return { applied: applied.applied, total };
}
