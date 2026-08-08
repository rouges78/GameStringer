// Flusso condiviso per la traduzione di giochi Ren'Py (visual novel).
// Usato dal pulsante hero "STRING IT!" (game-detail-client) per il branch Ren'Py.
//
// Pipeline: extract_all_renpy_strings -> traduzione LLM offline (Ollama) a chunk
// con masking dei placeholder Ren'Py, iniettando glossario (coerenza termini/nomi)
// e voce del personaggio (coerenza di tono per parlante) -> generate_renpy_translation.
// Include checkpoint/resume su JSON cosi' un job lungo sopravvive a interruzioni.
//
// Nota correttezza: l'estrazione conserva gli escape sorgente (\" \n ...) nel campo
// `original`. Per la traduzione serve il testo RAW, quindi de-escapiamo prima di
// mandarlo all'LLM e lasciamo `original` invariato (lato Rust generate_renpy_translation
// de-escapa la chiave e ri-escapa il valore in modo coerente).

import { invoke } from '@/lib/tauri-api';
import { cleanGamePath } from '@/lib/game-path';
import { clientLogger } from '@/lib/client-logger';
import { translateWithFallbackBatched } from '@/lib/ai/ai-translate-direct';
import { getTranslationBackend, type TranslationBackend } from '@/lib/translation-backend';
import {
  loadVoiceProfiles,
  getVoiceProfile,
  extractVoiceProfilesFromStrings,
  type VoiceProfile,
} from '@/lib/voice/voice-profiles';

// Descrittore voce compatto (una riga) per il contesto per-stringa: tono,
// registro, personalità e pattern del parlante. Va a finire nel prompt LLM
// (offline_translation.rs build_context_prompt) come voce del personaggio.
function buildVoiceDescriptor(p: VoiceProfile): string {
  const parts: string[] = [p.characterName];
  if (p.tone) parts.push(`${p.tone} tone`);
  if (p.formality) parts.push(`${p.formality.replace(/_/g, ' ')} register`);
  if (p.personality) parts.push(p.personality);
  if (p.speechPatterns?.length) parts.push(`speech: ${p.speechPatterns.slice(0, 3).join('; ')}`);
  if (p.catchphrases?.length) parts.push(`catchphrases: ${p.catchphrases.slice(0, 2).join('; ')}`);
  if (p.avoidPatterns?.length) parts.push(`avoid: ${p.avoidPatterns.slice(0, 2).join('; ')}`);
  return parts.join(' — ').replace(/\s+/g, ' ').trim();
}

export interface RenpyProgress {
  phase: 'extract' | 'glossary' | 'translate' | 'generate' | 'done';
  done: number;
  total: number;
}

type RenpyStringType = 'Dialogue' | 'Menu' | 'Narration' | 'String' | 'Label';

interface RenpyString {
  id: string;
  original: string;
  translated: string;
  file: string;
  line_number: number;
  string_type: RenpyStringType;
  character: string | null;
}

interface RenpyExtractionResult {
  success: boolean;
  message: string;
  strings: RenpyString[];
  total_count: number;
}

// Coppia glossario inviata al comando Rust (camelCase: doNotTranslate).
export interface GlossaryPair { source: string; target: string; doNotTranslate: boolean; }

// Forma (parziale) di SmartGlossary restituito da load_smart_glossary (camelCase).
interface SmartGlossaryTerm { sourceTerm: string; targetTerm: string; doNotTranslate?: boolean; tier?: string; }
interface SmartGlossary { terms?: SmartGlossaryTerm[]; }

// Placeholder Ren'Py da preservare: tag testo {..} e interpolazione [var].
// Niente masking: il modello mantiene meglio i codici se istruito nel prompt
// (vedi offline_translation.rs) che sostituendoli con token che poi altera. Qui i codici
// servono solo a VALIDARE: se la traduzione li altera, la scartiamo (no codici rotti nei tl/).
const CODE = /(\{[^}]*\}|\[[^\]]*\])/g;
function codeKey(s: string): string {
  return (s.match(CODE) ?? []).slice().sort().join('');
}

/**
 * ANTI-ECO: distinguere l'identità LEGITTIMA dall'eco del modello.
 *
 * Il problema (misurato l'08/08/2026 su Scarlet Hollow). La guardia scartava
 * OGNI traduzione uguale alla sorgente. Sui dialoghi è prudenza: una frase
 * intera che torna identica è quasi sempre il modello che rimbalza l'input, o
 * la safety net del cloud che riempie i buchi con la sorgente. Sull'interfaccia
 * è un falso positivo STRUTTURALE: «OK», «Auto», «Slot», «Menu» in italiano si
 * scrivono così e basta. Conseguenze, tutte silenziose:
 *  - quelle righe non venivano mai segnate come fatte → a ogni resume si
 *    ritentavano all'infinito, spendendo token per riottenere la stessa parola;
 *  - un blocco di sole etichette UI accettava zero righe e faceva scattare il
 *    FRENO dei 3 blocchi a vuoto su un motore perfettamente sano;
 *  - il contatore diceva «130 accettate su ~400 tentate» e sembrava un crollo
 *    di qualità, mentre erano parole che non dovevano cambiare.
 *
 * La regola. L'identità è legittima quando la stringa non è "abbastanza lingua"
 * perché una traduzione debba per forza differire: solo codici/numeri, oppure
 * una o due parole (etichette, nomi propri), oppure un'etichetta UI corta.
 * Tutto il resto — una frase vera che torna identica — resta eco e si scarta.
 */
const HAS_LETTER = /\p{L}/u;
// Una FRASE finisce con punteggiatura di chiusura; un'etichetta no. È il
// discrimine più affidabile che abbiamo, e la prima versione di questa
// funzione non ce l'aveva: «Thank you.» e «Are you sure?» passavano per
// etichette (2-3 parole, sotto i 32 caratteri) e l'eco del modello finiva
// scritta come traduzione definitiva.
const SENTENCE_END = /[.!?…:;,]$/u;
// Nomi propri e titoli: «Dr. Elizabeth Warren», «The Dead Rabbit Bar». Restano
// uguali in italiano ed è giusto accettarli; senza questa regola venivano
// ritentati a ogni resume per sempre.
function isTitleCase(bare: string): boolean {
  const words = bare.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return words.every(w => {
    const first = w.replace(/^[^\p{L}]+/u, '')[0];
    return !first || first === first.toUpperCase();
  });
}
export function isLegitimateIdentity(raw: string, type?: RenpyStringType): boolean {
  const bare = raw.replace(CODE, ' ').trim(); // via i tag {..} e le variabili [..]
  if (!bare || !HAS_LETTER.test(bare)) return true;  // "42", "---", solo codici
  if (SENTENCE_END.test(bare)) return false;         // "Thank you.", "Are you sure?"
  const words = bare.split(/\s+/).filter(Boolean).length;
  if (words <= 2) return true;                       // "OK", "Auto", "New Game"
  if (isTitleCase(bare)) return true;                // "The Dead Rabbit Bar"
  if (type === 'String' && words <= 3 && bare.length <= 24) return true; // etichetta UI
  return false;                                      // frase vera identica = eco
}

// De-escape mirror di unescape_renpy_string (Rust): \\->\, \"->", \n->newline, \t->tab.
function unescapeRenpy(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === '\\') { out += '\\'; i++; }
      else if (n === '"') { out += '"'; i++; }
      else if (n === 'n') { out += '\n'; i++; }
      else if (n === 't') { out += '\t'; i++; }
      else { out += '\\'; }
    } else {
      out += s[i];
    }
  }
  return out;
}

function lsGet(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}

// Carica il glossario del gioco e lo converte in GlossaryPair[] (cap a 80 termini,
// priorita' a locked/synced per la coerenza di nomi/UI).
export async function loadGlossary(sourceLang: string, targetLang: string, gameId?: string): Promise<GlossaryPair[]> {
  try {
    const gl = await invoke<SmartGlossary>('load_smart_glossary', {
      sourceLang, targetLang, gameId: gameId ?? null,
    });
    const terms = gl?.terms || [];
    const ranked = [...terms].sort((a, b) => {
      const w = (t?: string) => (t === 'locked' ? 0 : t === 'synced' ? 1 : 2);
      return w(a.tier) - w(b.tier);
    });
    const pairs: GlossaryPair[] = [];
    for (const t of ranked) {
      if (!t.sourceTerm) continue;
      if (t.doNotTranslate || t.targetTerm) {
        pairs.push({ source: t.sourceTerm, target: t.targetTerm || '', doNotTranslate: !!t.doNotTranslate });
      }
      if (pairs.length >= 80) break;
    }
    return pairs;
  } catch {
    return [];
  }
}

/**
 * Estrae i SOLI .rpy dagli archivi game/*.rpa in <gioco>/GameStringer/rpa_src/game/.
 * Ritorna la radice da passare a extract_all_renpy_strings (contiene game/, così
 * detect_renpy_game la riconosce), o null se non ci sono .rpa o sorgenti.
 */
async function extractRpaSources(gamePath: string): Promise<string | null> {
  // Niente catch muti: ogni ramo che rinuncia DICE perché (lezione della
  // notte del 07/08: la prima versione inghiottiva l'errore vero).
  try {
    const { readDir, exists } = await import('@tauri-apps/plugin-fs');
    const sep = gamePath.includes('\\') ? '\\' : '/';
    const gameDir = `${gamePath}${sep}game`;
    if (!(await exists(gameDir))) {
      clientLogger.warn(`Ren'Py rpa: cartella game/ non trovata: ${gameDir}`);
      return null;
    }
    const entries = await readDir(gameDir);
    const rpas = entries
      .filter((e) => !e.isDirectory && /\.rpa$/i.test(e.name))
      .map((e) => `${gameDir}${sep}${e.name}`);
    if (rpas.length === 0) {
      clientLogger.warn(`Ren'Py rpa: nessun .rpa in ${gameDir} (${entries.length} voci)`);
      return null;
    }

    const srcRoot = `${gamePath}${sep}GameStringer${sep}rpa_src`;
    const outGame = `${srcRoot}${sep}game`;
    let total = 0;
    for (const rpa of rpas) {
      try {
        const res = await invoke<{ files_count: number }>('extract_renpy_rpa', {
          rpaPath: rpa,
          outputPath: outGame,
          extensions: ['rpy'],
        });
        total += res?.files_count ?? 0;
      } catch (e: unknown) {
        clientLogger.warn(`Ren'Py rpa: estrazione fallita per ${rpa}: ${String(e)}`);
      }
    }
    clientLogger.info(`Ren'Py rpa: estratti ${total} .rpy da ${rpas.length} archivi`);
    return total > 0 ? srcRoot : null;
  } catch (e: unknown) {
    clientLogger.warn(`Ren'Py rpa: fase estrazione sorgenti saltata: ${String(e)}`);
    return null;
  }
}

export async function runRenpyTranslation(opts: {
  gamePath: string;
  targetLang?: string;
  sourceLang?: string;
  gameId?: string;
  glossary?: GlossaryPair[];
  model?: string;
  chunkSize?: number;
  /**
   * 'cloud' = sistema provider dell'app (translateWithFallbackBatched: chiavi
   * API dalle Impostazioni, reflection + guard placeholder inclusi);
   * 'ollama' = locale come prima. Se non passato lo decide
   * getTranslationBackend('renpy') — che di default risponde 'ollama', così
   * chi aggiorna non trova spese API a sorpresa. Dall'08/08/2026 il chiamante
   * lo passa SEMPRE esplicito: il selettore in pagina è la fonte di verità, e
   * l'impostazione salvata serve solo a ricordare la scelta tra un avvio e
   * l'altro.
   */
  backend?: TranslationBackend;
  /**
   * Tetto alle stringhe NUOVE tradotte in questa passata. Serve alla prova
   * d'effetto: su Scarlet Hollow (83.489 stringhe, ~4M token) l'unico modo di
   * sapere se il gioco parla italiano era spendere tutto e guardare alla fine.
   * Con un tetto, un lotto piccolo arriva comunque FINO a
   * generate_renpy_translation e produce un tl/ VERO — il generatore salta le
   * righe non tradotte (renpy_patcher.rs: `if s.translated.is_empty()
   * { continue }`, inchiodato da un test), quindi il risultato è italiano dove
   * abbiamo tradotto e inglese altrove: verificabile a schermo per pochi
   * centesimi. Il checkpoint è lo stesso, quindi la run completa riprende da
   * dove ha lasciato il lotto di prova, senza ritradurre nulla.
   */
  limit?: number;
  /**
   * STOP. Fino all'08/08/2026 una run partita non si poteva fermare: l'unico
   * modo era chiudere l'app, e chiudere l'app a metà chunk significava perdere
   * fino a 300 stringhe di lavoro non ancora salvate. Su ~83k stringhe (~4M
   * token) «non interrompibile» vuol dire anche «non ripensabile»: se il
   * risultato non piace dopo mille righe, si paga comunque tutto il resto.
   *
   * Lo Stop qui è cooperativo e ONESTO: si controlla tra un chunk e l'altro
   * (non si abortisce una chiamata a metà, che lascerebbe il conteggio
   * ambiguo), si SALVA il checkpoint, e poi si va COMUNQUE a generare i file
   * tl/ con quello che c'è — così fermarsi produce un gioco giocabile in
   * italiano parziale, non un cestino. La ripresa riparte esattamente da lì.
   */
  signal?: AbortSignal;
  onProgress?: (p: RenpyProgress) => void;
}): Promise<{
  translated: number;
  total: number;
  files: string;
  glossaryTerms: number;
  voiceProfiles: number;
  /** true se la run è stata fermata dall'utente prima di finire i chunk. */
  stopped: boolean;
  /**
   * Righe accettate identiche alla sorgente perché legittimamente uguali
   * («OK», «Auto», nomi propri). Non sono errori e non sono traduzioni: se
   * finiscono in una delle due caselle il banner mente in entrambi i sensi.
   */
  identical: number;
  /**
   * Stringhe uniche TENTATE in questa passata e quante ne sono state accettate.
   * Servono a non mentire quando c'è un tetto o un checkpoint precedente:
   * riportare 149/83.489 come «0% riuscito, 83.340 errori» — come faceva il
   * banner l'08/08/2026 sul primo lotto di prova — è falso in entrambe le
   * cifre. Le 83.340 non erano errori: non sono mai state tentate.
   */
  attempted: number;
  accepted: number;
}> {
  const tgt = (opts.targetLang || 'it').toLowerCase();
  const src = (opts.sourceLang || 'en').toLowerCase();
  const backend: TranslationBackend = opts.backend || getTranslationBackend('renpy');
  const model = opts.model || lsGet('gs_renpy_model') || lsGet('gs_hendrix_model') || 'gemma4:e4b';
  const CHUNK = opts.chunkSize || Number(lsGet('gs_renpy_chunk')) || 30;
  const SAVE_EVERY = 300;
  const report = opts.onProgress || (() => {});

  // -- Estrazione --
  report({ phase: 'extract', done: 0, total: 0 });
  // I giochi commerciali tengono i copioni DENTRO game/*.rpa: l'estrattore
  // Rust (extract_renpy_rpa) esisteva da tempo ma nessun flusso lo chiamava —
  // Scarlet Hollow (07/08/2026) moriva con «Nessun file .rpy trovato» davanti
  // a un archivio con 199 sorgenti. Prima si prova coi .rpy sciolti; se non ce
  // ne sono, si estraggono SOLO i .rpy dagli .rpa (letture mirate, mai 5,6 GB
  // in RAM) in GameStringer/rpa_src/game/ — MAI dentro game/: Ren'Py
  // caricherebbe i duplicati sciolti e andrebbe in conflitto di label.
  let extraction = await invoke<RenpyExtractionResult>('extract_all_renpy_strings', {
    gamePath: opts.gamePath,
  }).catch(() => null);
  if (!extraction || !extraction.success || extraction.strings.length === 0) {
    const srcRoot = await extractRpaSources(opts.gamePath);
    if (srcRoot) {
      extraction = await invoke<RenpyExtractionResult>('extract_all_renpy_strings', {
        gamePath: srcRoot,
      });
    }
  }
  if (!extraction || !extraction.success) throw new Error(extraction?.message || "Estrazione Ren'Py fallita (né .rpy sciolti né sorgenti negli .rpa)");
  const rows = extraction.strings;
  const total = rows.length;
  if (total === 0) throw new Error('Nessuna stringa traducibile trovata (.rpy)');

  // -- Glossario (coerenza termini/nomi) --
  report({ phase: 'glossary', done: 0, total });
  const glossary = opts.glossary ?? await loadGlossary(src, tgt, opts.gameId);

  // Contesto voce: mappa original -> primo personaggio incontrato.
  const speakerOf: Record<string, string> = {};
  for (const r of rows) {
    if (r.character && !speakerOf[r.original]) speakerOf[r.original] = r.character;
  }

  // Profili voce personaggio (coerenza di tono/personalità per parlante).
  // Se il gioco non ha profili, li auto-estraiamo dai dialoghi (Speaker: testo).
  // Per ogni parlante con profilo costruiamo un descrittore ricco da iniettare nel
  // prompt al posto del solo nome. Fallback: nome del parlante (comportamento base).
  const voiceDescOf: Record<string, string> = {};
  let voiceProfilesUsed = 0;
  if (opts.gameId) {
    try {
      const existing = loadVoiceProfiles(opts.gameId);
      if (existing.profiles.length === 0) {
        const synth: string[] = [];
        for (const r of rows) {
          if (r.character && (r.string_type === 'Dialogue' || r.string_type === 'Menu')) {
            synth.push(`${r.character}: ${unescapeRenpy(r.original)}`);
          }
        }
        if (synth.length) extractVoiceProfilesFromStrings(opts.gameId, synth);
      }
      const speakers = new Set(Object.values(speakerOf));
      for (const sp of speakers) {
        const prof = getVoiceProfile(opts.gameId, sp);
        if (prof) { voiceDescOf[sp] = buildVoiceDescriptor(prof); voiceProfilesUsed++; }
      }
    } catch { /* voce non disponibile → fallback al nome */ }
  }

  const progressPath = `${cleanGamePath(opts.gamePath)}/gs_renpy_progress_${tgt}.json`;

  // -- Resume: carica checkpoint precedente --
  const byOriginal: Record<string, string> = {};
  try {
    const saved = await invoke<RenpyString[]>('load_renpy_translations', { inputPath: progressPath });
    for (const r of saved) if (r.translated) byOriginal[r.original] = r.translated;
  } catch { /* nessun checkpoint */ }

  for (const r of rows) if (byOriginal[r.original]) r.translated = byOriginal[r.original];

  let done = rows.filter(r => r.translated).length;
  report({ phase: 'translate', done, total });

  const allPending = Array.from(new Set(
    rows.filter(r => !r.translated).map(r => r.original)
  ));
  // Il tetto vale sulle stringhe NUOVE, non sul totale: un lotto di prova da
  // 200 dopo un checkpoint da 5.000 traduce 200 righe, non zero.
  //
  // MA L'ORDINE CONTA PIÙ DEL NUMERO (lezione dell'08/08/2026, imparata
  // sbagliando): la prima versione prendeva le prime N in ordine di file, e su
  // Scarlet Hollow le prime 200 cadevano in 01virtual_keyboard.rpy e
  // clinic_solo_incident.rpy — una scena a metà partita. Il lotto ERA tradotto
  // e la prova d'effetto restava comunque impossibile, perché nessuno vede
  // quelle righe senza giocare per ore. Un campione che non si può guardare non
  // è un campione.
  // Ora il tetto pesca PRIMA le stringhe di interfaccia (string_type 'String':
  // menu, opzioni, pulsanti — finiscono nei blocchi `strings` di screens_*.rpy
  // e gui_*.rpy), che sono le prime che il giocatore vede all'avvio. Il resto
  // segue nell'ordine naturale. Senza tetto l'ordine resta quello originale:
  // in una run completa non cambia nulla.
  const typeOf = new Map<string, RenpyStringType>();
  for (const r of rows) if (!typeOf.has(r.original)) typeOf.set(r.original, r.string_type);
  const uiFirst = (list: string[]): string[] => {
    const ui = list.filter(o => typeOf.get(o) === 'String');
    const rest = list.filter(o => typeOf.get(o) !== 'String');
    return [...ui, ...rest];
  };
  const pendingOriginals = opts.limit && opts.limit > 0
    ? uiFirst(allPending).slice(0, opts.limit)
    : allPending;
  if (pendingOriginals.length < allPending.length) {
    const uiCount = pendingOriginals.filter(o =>
      rows.find(r => r.original === o)?.string_type === 'String').length;
    clientLogger.info(
      `Ren'Py: LOTTO DI PROVA — ${pendingOriginals.length} stringhe su ${allPending.length} da tradurre ` +
      `(backend "${backend}"), di cui ${uiCount} di interfaccia: quelle si vedono nel menu appena avvii il gioco. ` +
      `I file tl/ verranno generati lo stesso: italiano dove tradotto, inglese altrove.`
    );
  }

  const applyAndSave = async () => {
    for (const r of rows) if (byOriginal[r.original]) r.translated = byOriginal[r.original];
    await invoke('save_renpy_translations', { outputPath: progressPath, strings: rows }).catch(() => {});
  };

  // -- Traduzione a chunk (cloud: provider dell'app / ollama: locale), con
  //    masking + glossario + voce. Il guard sui tag e il checkpoint sono gli
  //    stessi per entrambi i backend.
  const glossaryHint = backend === 'cloud' && glossary.length
    ? glossary.map((g) => `${g.source}=${g.target}`).join('; ').slice(0, 1500)
    : undefined;
  let sinceSave = 0;
  // Righe accettate perché legittimamente identiche («OK» → «OK»). Contarle a
  // parte è ciò che rende il banner onesto: non sono né errori né traduzioni.
  let identityKept = 0;
  // FRENO (08/08/2026). translateWithFallbackBatched, quando un batch fallisce,
  // riempie i buchi con la SORGENTE ("safety net") e ritorna success se anche
  // UN SOLO batch del lotto è andato: leggendo solo res.translations, un cloud
  // che smette di rispondere è indistinguibile da un cloud che traduce male.
  // Su 83.489 stringhe (Scarlet Hollow) un credito esaurito — già successo alla
  // ship v1.16.0 — significherebbe ~2.800 chiamate, zero traduzioni scritte e
  // una barra che arriva serenamente al 100%. Famiglia [fallimenti-muti]: qui
  // il contatore onesto non basta, serve qualcosa che SI FERMI e lo dica.
  const MAX_EMPTY_CHUNKS = 3;
  let emptyChunks = 0;
  let stopped = false;
  // Le stringhe DAVVERO passate al motore. Con lo Stop, `pendingOriginals` è
  // il piano, non il consuntivo: usarlo come denominatore trasformerebbe una
  // run fermata a mano in «migliaia di errori» — lo stesso sbaglio del banner
  // che divideva per 83.489 (vedi `attempted`/`accepted` qui sotto).
  const attemptedOriginals: string[] = [];
  for (let i = 0; i < pendingOriginals.length; i += CHUNK) {
    // STOP cooperativo, controllato PRIMA di spendere il chunk successivo: chi
    // preme Stop non deve pagare altre 30 stringhe per essere ascoltato.
    if (opts.signal?.aborted) {
      stopped = true;
      await applyAndSave();
      clientLogger.info(
        `Ren'Py: STOP richiesto — ${done}/${total} completate e salvate. ` +
        `I file tl/ vengono generati con quanto tradotto finora; riavviando si riprende da qui.`
      );
      break;
    }
    const slice = pendingOriginals.slice(i, i + CHUNK);
    attemptedOriginals.push(...slice);
    const raws = slice.map(orig => unescapeRenpy(orig));
    // Contesto per riga: descrittore voce ricco se il parlante ha un profilo,
    // altrimenti il solo nome del parlante (o null per narrazione/UI senza parlante).
    const contexts = slice.map(orig => {
      const sp = speakerOf[orig];
      if (!sp) return null;
      return voiceDescOf[sp] ?? sp;
    });
    let outs: string[];
    if (backend === 'cloud') {
      // Il batch cloud ha UN contesto per chiamata: si passa il riassunto dei
      // parlanti del blocco (la granularità per-riga resta al ramo Ollama).
      const speakers = Array.from(new Set(contexts.filter(Boolean) as string[])).slice(0, 4);
      const res = await translateWithFallbackBatched({
        texts: raws,
        targetLanguage: tgt,
        sourceLanguage: src,
        gameId: opts.gameId,
        context: [
          "Ren'Py visual novel dialogue. Preserve ALL {tags}, [variables] and escape sequences exactly.",
          speakers.length ? `Speakers in this batch — keep each voice consistent: ${speakers.join(' | ')}` : '',
        ].filter(Boolean).join('\n'),
        glossaryHint,
      }, 20);
      outs = res.translations;
    } else {
      const res = await invoke<{ translated: string }[]>('offline_translate_batch_context', {
        texts: raws, contexts, glossary, sourceLang: src, targetLang: tgt, model,
      });
      outs = res.map(r => r.translated);
    }
    // LA DECISIONE SULL'IDENTITÀ SI PRENDE PER BLOCCO, NON PER RIGA.
    //
    // Guardando una riga sola, «OK» → «OK» è indistinguibile da un motore
    // morto che rimbalza la sorgente. Guardando il BLOCCO invece si distingue
    // benissimo: se almeno una riga è stata davvero cambiata, il motore è vivo
    // e le identità dello stesso blocco sono credibili; se NESSUNA riga è
    // cambiata, non c'è nessun motivo di credere a nessuna di quelle identità.
    //
    // Quindi le identità restano "in sospeso" (`identityPending`) e vengono
    // scritte nel checkpoint solo a fine blocco, se il blocco ha dato prova di
    // vita. Senza questa sospensione un cloud a credito zero avrebbe scritto
    // l'inglese come DEFINITIVO nel checkpoint (il resume salta le righe già
    // "tradotte"), e nessuna run futura le avrebbe più ritentate.
    //
    // Nota su chi comanda il freno: `realAcceptedHere`, cioè le righe davvero
    // cambiate. La prima versione di questa modifica lo condizionava al numero
    // di righe "sostanziali" del blocco, e con `uiFirst` — che mette in testa
    // proprio le etichette corte — il lotto di prova finiva per essere l'unica
    // run SENZA freno. Esattamente il contrario di ciò che serviva.
    let realAcceptedHere = 0;
    const identityPending: Array<[string, string]> = [];
    outs.forEach((translatedText, k) => {
      const out = (translatedText || '').trim();
      const legitIdentity = isLegitimateIdentity(raws[k], typeOf.get(slice[k]));
      const echoed = out === raws[k] && !legitIdentity;
      const bad = !out || out.startsWith('[ERRORE]') || echoed;
      // Accetta solo se i tag {..}/[..] combaciano; altrimenti lascia non tradotto (retry al resume).
      if (!bad && codeKey(out) === codeKey(raws[k])) {
        if (out !== raws[k]) { byOriginal[slice[k]] = out; realAcceptedHere++; }
        else identityPending.push([slice[k], out]);
      }
    });
    if (realAcceptedHere > 0) {
      for (const [orig, out] of identityPending) { byOriginal[orig] = out; identityKept++; }
    }

    // Un chunk può legittimamente accettare zero righe (tutti tag rotti, o un
    // blocco di sole stringhe identiche in entrambe le lingue), ma TRE di fila
    // a zero non è più sfortuna: è il motore che non risponde. Ci si ferma
    // salvando il lavoro fatto, così il resume riparte da qui invece di
    // ricominciare — e si dice quale backend ha smesso, perché la cura è
    // diversa (credito/chiave per il cloud, `ollama serve` per il locale).
    done = rows.filter(r => byOriginal[r.original] || r.translated).length;
    emptyChunks = realAcceptedHere === 0 ? emptyChunks + 1 : 0;
    if (emptyChunks >= MAX_EMPTY_CHUNKS) {
      await applyAndSave();
      const why = backend === 'cloud'
        ? 'controlla credito e chiave API nelle Impostazioni'
        : "controlla che Ollama sia avviato e che il modello sia installato";
      // Un arresto in più su un motore sano costa un riavvio (il checkpoint
      // riprende da qui); un arresto in meno su un motore morto costa ~2.800
      // chiamate a vuoto, il credito, e un gioco in inglese dichiarato
      // tradotto. L'asimmetria decide: in caso di dubbio ci si ferma.
      throw new Error(
        `Traduzione interrotta: ${MAX_EMPTY_CHUNKS} blocchi consecutivi in cui il motore non ha cambiato ` +
        `nemmeno una stringa (backend "${backend}", ${done}/${total} completate e salvate). Nessuna stringa ` +
        `persa: riavvia la traduzione per riprendere da qui. Causa probabile: ${why}. ` +
        `Se invece erano davvero tutte etichette identiche in ${tgt.toUpperCase()}, riavvia e proseguirà.`
      );
    }

    sinceSave += slice.length;
    report({ phase: 'translate', done, total });

    if (sinceSave >= SAVE_EVERY) { await applyAndSave(); sinceSave = 0; }
  }

  // -- Genera i file tl/ --
  for (const r of rows) if (byOriginal[r.original]) r.translated = byOriginal[r.original];
  await invoke('save_renpy_translations', { outputPath: progressPath, strings: rows }).catch(() => {});

  report({ phase: 'generate', done, total });
  const files = await invoke<string>('generate_renpy_translation', {
    gamePath: opts.gamePath, language: tgt, strings: rows,
  });

  const translated = rows.filter(r => r.translated).length;
  report({ phase: 'done', done: translated, total });
  return {
    translated, total, files,
    glossaryTerms: glossary.length,
    voiceProfiles: voiceProfilesUsed,
    stopped,
    identical: identityKept,
    attempted: attemptedOriginals.length,
    accepted: attemptedOriginals.filter(o => byOriginal[o]).length,
  };
}
