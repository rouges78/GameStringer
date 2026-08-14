// Flusso condiviso per la traduzione di giochi RPG Maker MV/MZ (file-based).
// Usato dal pulsante hero "STRING IT!" (game-detail-client) per il branch RPG Maker MV/MZ.
//
// Pipeline: detect_rpgmaker_game (solo MV/MZ) -> extract_all_rpgmaker_strings ->
// traduzione LLM offline (Ollama) a chunk con glossario -> per ogni file dati con
// stringhe: backup (save_file_with_backup) + apply_rpgmaker_translations IN PLACE.
// Include checkpoint/resume su JSON così un job lungo sopravvive a interruzioni.
//
// ⚠️ A differenza di Ren'Py (non invasivo, cartella tl/), qui i JSON di data/ vengono
// SOVRASCRITTI: per ogni file si crea un backup ripristinabile (restore_backup) prima
// di scrivere. RPG Maker classico (RPG_RT 2000/2003) NON passa di qui: è gestito a
// monte in game-detail-client con messaggio onesto + OCR live.
//
// Niente voci personaggio: in MV/MZ i parlanti non sono strutturati come in Ren'Py
// (stringhe in eventi/JSON senza speaker affidabile). La leva di coerenza è il glossario.

import { invoke } from '@/lib/tauri-api';
import { cleanGamePath } from '@/lib/game-path';
import { loadGlossary, type GlossaryPair } from '@/lib/renpy-translate';
import { ollamaArgs } from '@/lib/ai/ollama-endpoint';
import { translateWithFallbackBatched } from '@/lib/ai/ai-translate-direct';
import { getTranslationBackend, type TranslationBackend } from '@/lib/translation-backend';
import { clientLogger } from '@/lib/client-logger';

export interface RpgmakerProgress {
  phase: 'detect' | 'extract' | 'glossary' | 'translate' | 'apply' | 'done';
  done: number;
  total: number;
}

interface RpgString { id: string; original: string; translated: string; context: string; file: string; }
interface RpgExtraction { success: boolean; message: string; strings: RpgString[]; total_count: number; }
interface RpgDataFile { path: string; filename: string; size: number; string_count: number | null; }
interface RpgGame { path: string; version: string; title: string; data_files: RpgDataFile[]; }

// Codici di controllo RPG Maker da preservare per la VALIDAZIONE: \C[n] \V[n] \N[n]
// \I[n] \P[n]… e %1..%9. Se la traduzione li altera, la scartiamo (no codici rotti nei file).
const CODE = /(\\[A-Za-z]\[[^\]]*\]|%\d)/g;
function codeKey(s: string): string {
  return (s.match(CODE) ?? []).slice().sort().join('');
}

function lsGet(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}

export async function runRpgmakerTranslation(opts: {
  gamePath: string;
  targetLang?: string;
  sourceLang?: string;
  gameId?: string;
  glossary?: GlossaryPair[];
  model?: string;
  chunkSize?: number;
  backend?: TranslationBackend;
  onProgress?: (p: RpgmakerProgress) => void;
}): Promise<{ translated: number; total: number; files: number; glossaryTerms: number; version: string }> {
  const tgt = (opts.targetLang || 'it').toLowerCase();
  const src = (opts.sourceLang || 'en').toLowerCase();
  const model = opts.model || lsGet('gs_rpgmaker_model') || lsGet('gs_renpy_model') || 'gemma4:e4b';
  // LOCALE o ONLINE: la scelta è dell'utente (Impostazioni → picker globale o
  // per-motore), non nostra. Fino al 14/08/2026 questo flusso era offline SECCO:
  // le API key configurate non venivano nemmeno guardate — era una delle due
  // ultime voci di [backend-locale-online].
  const backend = opts.backend || getTranslationBackend('rpgmaker');
  const CHUNK = opts.chunkSize || Number(lsGet('gs_rpgmaker_chunk')) || 30;
  const SAVE_EVERY = 300;
  const report = opts.onProgress || (() => {});

  // -- Detect (solo MV/MZ) --
  report({ phase: 'detect', done: 0, total: 0 });
  const game = await invoke<RpgGame>('detect_rpgmaker_game', { gamePath: opts.gamePath });
  const ver = String(game?.version || '').toLowerCase();
  if (ver !== 'mv' && ver !== 'mz') {
    throw new Error(`Motore RPG Maker "${game?.version}" non supportato dal flusso file-based (solo MV/MZ).`);
  }
  const jsonFiles = (game.data_files || []).filter(f => f.path.toLowerCase().endsWith('.json'));
  const pathByName: Record<string, string> = {};
  for (const f of jsonFiles) pathByName[f.filename] = f.path;
  if (jsonFiles.length === 0) throw new Error('Nessun file dati .json (MV/MZ) trovato.');

  // -- Estrazione --
  report({ phase: 'extract', done: 0, total: 0 });
  const ex = await invoke<RpgExtraction>('extract_all_rpgmaker_strings', { gamePath: opts.gamePath });
  if (!ex.success) throw new Error(ex.message || 'Estrazione RPG Maker fallita');
  const rows = (ex.strings || []).filter(s => s.original && s.original.trim() && pathByName[s.file]);
  const originals = Array.from(new Set(rows.map(s => s.original)));
  const total = originals.length;
  if (total === 0) throw new Error('Nessuna stringa traducibile trovata nei file MV/MZ.');

  // -- Glossario (coerenza nomi/oggetti) --
  report({ phase: 'glossary', done: 0, total });
  const glossary = opts.glossary ?? await loadGlossary(src, tgt, opts.gameId);

  // -- Resume: checkpoint JSON { original: translated } --
  const progressPath = `${cleanGamePath(opts.gamePath)}/gs_rpgmaker_progress_${tgt}.json`;
  const byOriginal: Record<string, string> = {};
  try {
    const raw = await invoke<string>('read_file_content', { filePath: progressPath });
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) if (typeof v === 'string' && v) byOriginal[k] = v;
  } catch { /* nessun checkpoint */ }

  const saveProgress = () =>
    invoke('write_text_file', { path: progressPath, content: JSON.stringify(byOriginal) }).catch(() => {});

  let done = originals.filter(o => byOriginal[o]).length;
  report({ phase: 'translate', done, total });

  const pending = originals.filter(o => !byOriginal[o]);

  // -- Traduzione a chunk: LOCALE (Ollama) o ONLINE (catena provider) --
  // ⛔ Freno anti-batch-a-vuoto (stessa lezione di danganronpa-translate:
  // sul cloud un batch vuoto costa credito, in locale segnala Ollama giù).
  const MAX_VUOTI = 3;
  let batchVuoti = 0;
  // Sul cloud il glossario passa come hint testuale (stesso schema di renpy-translate:440).
  const glossaryHint = backend === 'cloud' && glossary.length
    ? glossary.map((g) => `${g.source}=${g.target}`).join('; ').slice(0, 1500)
    : undefined;
  let sinceSave = 0;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const slice = pending.slice(i, i + CHUNK);
    let outs: string[];
    if (backend === 'cloud') {
      const res = await translateWithFallbackBatched({
        texts: slice,
        targetLanguage: tgt,
        sourceLanguage: src,
        gameId: opts.gameId,
        glossaryHint,
        context: [
          'RPG Maker MV/MZ game text: event dialogue, items, skills, system strings.',
          'Preserve ALL control codes EXACTLY as they appear, in the same position:',
          'backslash codes like \\C[n] \\V[n] \\N[n] \\I[n] \\P[n], and %1..%9 placeholders.',
          'Do not translate, remove, reorder or alter them.',
        ].join('\n'),
      }, CHUNK);
      outs = res.translations;
    } else {
      const res = await invoke<{ translated: string }[]>('offline_translate_batch_context', {
        texts: slice, contexts: slice.map(() => null), glossary, sourceLang: src, targetLang: tgt, model, ...ollamaArgs(),
      });
      outs = res.map(r => r.translated);
    }
    let accettateNelBatch = 0;
    outs.forEach((raw, k) => {
      const out = (raw || '').trim();
      const bad = !out || out.startsWith('[ERRORE]');
      // Accetta solo se i codici \C[n]/%d combaciano; altrimenti lascia non tradotto (retry al resume).
      if (!bad && out !== slice[k] && codeKey(out) === codeKey(slice[k])) {
        byOriginal[slice[k]] = out;
        accettateNelBatch++;
      }
    });
    if (accettateNelBatch === 0) {
      batchVuoti++;
      clientLogger.warn(`[RPGMaker] batch senza traduzioni accettate (${batchVuoti}/${MAX_VUOTI}) — backend: ${backend}`);
      if (batchVuoti >= MAX_VUOTI) {
        clientLogger.error(`[RPGMaker] FERMO: ${MAX_VUOTI} batch di fila a vuoto — backend: ${backend}. Cause tipiche: ${backend === 'cloud' ? 'credito/API key esaurita o non configurata' : 'Ollama spento o modello non installato'}. Salvo il checkpoint e applico quanto c'è.`);
        break;
      }
    } else {
      batchVuoti = 0;
    }
    done = originals.filter(o => byOriginal[o]).length;
    sinceSave += slice.length;
    report({ phase: 'translate', done, total });
    if (sinceSave >= SAVE_EVERY) { await saveProgress(); sinceSave = 0; }
  }
  await saveProgress();

  // -- Applica: per ogni file con stringhe → backup + apply IN PLACE --
  // Raggruppa gli original per file (solo i file che hanno almeno una traduzione pronta).
  const byFile: Record<string, Set<string>> = {};
  for (const s of rows) (byFile[s.file] ||= new Set<string>()).add(s.original);
  const fileNames = Object.keys(byFile);
  let filesApplied = 0;
  for (let fi = 0; fi < fileNames.length; fi++) {
    const name = fileNames[fi];
    const filePath = pathByName[name];
    const map: Record<string, string> = {};
    for (const o of byFile[name]) if (byOriginal[o]) map[o] = byOriginal[o];
    report({ phase: 'apply', done: fi, total: fileNames.length });
    if (Object.keys(map).length === 0) continue; // nessuna traduzione per questo file → non toccarlo
    try {
      // Backup ripristinabile dell'originale prima di sovrascrivere.
      const orig = await invoke<string>('read_file_content', { filePath });
      await invoke('save_file_with_backup', { filePath, content: orig, createBackup: true });
      await invoke<number>('apply_rpgmaker_translations', { filePath, translations: map, outputPath: filePath });
      filesApplied++;
    } catch (e) {
      // non bloccare l'intero job per un singolo file
      console.warn('[rpgmaker-translate] apply fallito su', filePath, String(e));
    }
  }

  const translated = originals.filter(o => byOriginal[o]).length;
  report({ phase: 'done', done: translated, total });
  return { translated, total, files: filesApplied, glossaryTerms: glossary.length, version: ver };
}
