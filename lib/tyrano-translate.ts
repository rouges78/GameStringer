// Flusso condiviso per la traduzione di giochi TyranoScript / Electron-VN
// (stringhe nei file .ks dentro resources/app.asar). Estrae le stringhe con
// extract_tyrano_strings, traduce via cloud (Gemini→fallback) o Ollama e
// applica UNA volta a fine job con apply_tyrano_patch (backup app.asar.bak
// automatico, ripristinabile con restore_tyrano_backup).
//
// Nota backend: apply_tyrano_patch supporta SOLO giochi con app.asar (i giochi
// a cartella resources/app non vengono patchati) e sostituisce `original` →
// `translated` riga per riga. Per questo l'apply è singolo e finale: un apply
// parziale ripetuto non ritroverebbe più le `original` già sostituite.
// Checkpoint/resume su idb-keyval: la fase di traduzione riprende da dove era.
//
// Coerente con il pattern "hero" degli altri motori (Ren'Py/Hendrix/Visionaire):
// orchestratore lib/<engine>-translate.ts + ramo in startAutoTranslate.

import { invoke } from '@/lib/tauri-api';
import { get, set, del } from 'idb-keyval';
import { gamePathKey } from '@/lib/game-path';
import { translateWithFallbackBatched } from '@/lib/ai/ai-translate-direct';
import { ollamaArgs } from '@/lib/ai/ollama-endpoint';

export type TyranoBackend = 'ollama' | 'cloud';

export interface TyranoProgress {
  phase: 'detect' | 'extract' | 'translate' | 'apply' | 'done';
  done: number;
  total: number;
}

interface TyranoString {
  id: string;
  original: string;
  translated: string;
  file: string;
  line_number: number;
  string_type: string;
  character?: string | null;
}

// Errori "parlanti" per il chiamante (mappati su chiavi i18n nel game-detail).
export const TYRANO_ERR_NO_ASAR = 'TYRANO_NO_ASAR';
export const TYRANO_ERR_NO_STRINGS = 'TYRANO_NO_STRINGS';

// Codici/markup da preservare nei testi .ks: tag Tyrano [l]/[r]/[ruby …],
// tag HTML-like, placeholder {var}/%s e \n. Niente masking: si VALIDA soltanto;
// se la traduzione perde/altera i codici la scartiamo (ritentata al resume).
const CODE = /(\[[^\]]*\]|\{[^}]*\}|<[^>]+>|%[sd0-9]|\\n)/g;
function codeKey(s: string): string {
  return (s.match(CODE) ?? []).slice().sort().join('');
}

// Heuristica lingua sorgente: la maggior parte dei giochi TyranoScript è
// giapponese. Se una quota significativa delle stringhe contiene CJK → 'ja'.
function guessSourceLang(texts: string[]): string {
  const sample = texts.slice(0, 500);
  if (!sample.length) return 'en';
  const cjk = sample.filter(t => /[぀-ヿ㐀-鿿]/.test(t)).length;
  return cjk / sample.length > 0.3 ? 'ja' : 'en';
}

function lsGet(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}

async function translateChunk(
  texts: string[], src: string, tgt: string, backend: TyranoBackend, model: string
): Promise<string[]> {
  if (backend === 'cloud') {
    const res = await translateWithFallbackBatched(
      { texts, targetLanguage: tgt, sourceLanguage: src }, 20
    );
    return res.translations;
  }
  const res = await invoke<{ translated: string }[]>('offline_translate_batch', {
    texts, sourceLang: src, targetLang: tgt, model, ...ollamaArgs(),
  });
  return res.map(r => r.translated);
}

export async function runTyranoTranslation(opts: {
  gamePath: string;
  targetLang?: string;
  backend?: TyranoBackend;
  model?: string;
  chunkSize?: number;
  onProgress?: (p: TyranoProgress) => void;
}): Promise<{ applied: number; total: number; translated: number; backend: TyranoBackend; sourceLang: string }> {
  const tgt = (opts.targetLang || 'it').toLowerCase();
  const backend: TyranoBackend = opts.backend || 'ollama';
  const model = opts.model || lsGet('gs_hendrix_model') || 'gemma4:e4b';
  const CHUNK = opts.chunkSize || (backend === 'cloud' ? 200 : 40);
  const SAVE_EVERY = 400; // checkpoint su idb-keyval ogni ~400 stringhe
  const report = opts.onProgress || (() => {});

  // 1) Detect: il patch backend supporta solo app.asar → fallire subito e onesti.
  report({ phase: 'detect', done: 0, total: 0 });
  const game = await invoke<{ has_asar: boolean; total_strings: number }>(
    'detect_tyrano_game', { gamePath: opts.gamePath }
  );
  if (!game.has_asar) throw new Error(TYRANO_ERR_NO_ASAR);

  // 2) Estrazione stringhe dai .ks (dentro l'asar)
  report({ phase: 'extract', done: 0, total: 0 });
  const extraction = await invoke<{ success: boolean; strings: TyranoString[]; total_count: number }>(
    'extract_tyrano_strings', { gamePath: opts.gamePath }
  );
  const all = (extraction?.strings || []).filter(s => s.original && s.original.trim());
  const total = all.length;
  if (!total) throw new Error(TYRANO_ERR_NO_STRINGS);

  const src = guessSourceLang(all.map(s => s.original));

  // Checkpoint per questo gioco+lingua: id stringa -> testo tradotto.
  // gamePathKey: chiave stabile anche se il path arriva con separatori/casing diversi.
  const ckptKey = `gs_tyrano_ckpt_${gamePathKey(opts.gamePath)}_${tgt}`;
  let translations: Record<string, string> =
    (await get<Record<string, string>>(ckptKey).catch(() => undefined)) || {};
  if (Object.keys(translations).length === 0) {
    // Migrazione: checkpoint salvati prima della normalizzazione (chiave col path grezzo)
    const legacyKey = `gs_tyrano_ckpt_${opts.gamePath}_${tgt}`;
    if (legacyKey !== ckptKey) {
      const legacy = await get<Record<string, string>>(legacyKey).catch(() => undefined);
      if (legacy && Object.keys(legacy).length > 0) {
        translations = legacy;
        await set(ckptKey, legacy).catch(() => {});
        await del(legacyKey).catch(() => {});
      }
    }
  }

  const todo = all.filter(s => translations[s.id] === undefined);
  let done = total - todo.length;
  report({ phase: 'translate', done, total });

  // 3) Traduzione a blocchi (checkpoint periodico, resume automatico)
  let sinceSave = 0;
  for (let i = 0; i < todo.length; i += CHUNK) {
    const slice = todo.slice(i, i + CHUNK);
    const outs = await translateChunk(slice.map(s => s.original), src, tgt, backend, model);
    outs.forEach((raw, k) => {
      const s = slice[k];
      const out = (raw || '').trim();
      const bad = !out || out.startsWith('[ERRORE]');
      // Accetta solo se i codici combaciano e la stringa è effettivamente cambiata.
      if (!bad && out !== s.original && codeKey(out) === codeKey(s.original)) {
        translations[s.id] = out;
      }
    });
    done += slice.length;
    sinceSave += slice.length;
    report({ phase: 'translate', done, total });
    if (sinceSave >= SAVE_EVERY) {
      await set(ckptKey, translations).catch(() => {});
      sinceSave = 0;
    }
  }
  await set(ckptKey, translations).catch(() => {});

  // 4) Applicazione UNICA e finale (estrae asar, patcha i .ks, repack + backup)
  report({ phase: 'apply', done, total });
  const payload = all
    .filter(s => translations[s.id] !== undefined)
    .map(s => ({ ...s, translated: translations[s.id] }));
  const result = await invoke<{ success: boolean; strings_replaced: number; files_patched: number }>(
    'apply_tyrano_patch', { gamePath: opts.gamePath, strings: payload }
  );

  const translated = payload.length;
  report({ phase: 'done', done: total, total });
  return { applied: result?.strings_replaced ?? translated, total, translated, backend, sourceLang: src };
}
