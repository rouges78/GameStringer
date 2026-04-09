/**
 * Danganronpa Smart Dialogue Filter
 * 
 * Filtra le ~18K stringhe estratte da Danganronpa per tenere solo
 * i dialoghi rilevanti (~3K), riducendo costi API e tempo di traduzione.
 * 
 * Fasi:
 * 1. Filtro locale (regex/euristica) — elimina stringhe inutili
 * 2. Classificazione AI (opzionale) — classifica i dialoghi per priorità
 */

import { translateSmart } from './ai-translate-direct';
import { clientLogger } from '@/lib/client-logger';

// ============================================================================
// TYPES
// ============================================================================

export interface DanganronpaDialogue {
  id: string;
  speaker: string;
  original: string;
  translated: string;
  file: string;
  line_index: number;
}

export interface FilterResult {
  filtered: DanganronpaDialogue[];
  removed: DanganronpaDialogue[];
  stats: FilterStats;
}

export interface FilterStats {
  totalInput: number;
  afterLocalFilter: number;
  afterAIFilter: number;
  removedEmpty: number;
  removedDuplicate: number;
  removedSystemText: number;
  removedShort: number;
  removedNonDialogue: number;
  estimatedCostSaved: string;
}

export interface FilterOptions {
  /** Minimo caratteri per stringa (default: 3) */
  minLength?: number;
  /** Massimo caratteri per stringa (default: 500) */
  maxLength?: number;
  /** Rimuovi duplicati esatti (default: true) */
  removeDuplicates?: boolean;
  /** Usa classificazione AI per filtrare (default: false) */
  useAIClassification?: boolean;
  /** Priorità minima per includere (1-5, default: 2) */
  minPriority?: number;
  /** Includi solo stringhe con speaker (default: false) */
  requireSpeaker?: boolean;
}

// ============================================================================
// REGEX PATTERNS - Stringhe da escludere
// ============================================================================

/** Pattern per stringhe di sistema/UI da escludere */
const SYSTEM_PATTERNS: RegExp[] = [
  // Variabili e placeholder di codice
  /^[A-Z_]{2,}$/,                           // CONSTANT, AB
  /^[A-Z_][A-Z0-9_]*$/,                     // CONST_123
  /^\{[^}]+\}$/,                            // {variable}
  /^%[ds]$/,                                // %d, %s
  /^\$\{.+\}$/,                             // ${expression}
  /^<[^>]+>$/,                              // <tag>
  /^#[0-9A-Fa-f]{3,8}$/,                    // #FFF, #FF0000, #FF000088
  
  // Percorsi file e asset
  /\.(png|jpg|jpeg|bmp|gif|wav|ogg|mp3|mp4|avi|ttf|otf|dat|pak|bin|stx|lin|wrd|spc|tga|dds|ini|cfg|xml|csv|lua|py|json)$/i,
  /^(data|assets|sound|bgm|se|voice|movie|model|font|texture|sprite|bustup|cg|ev|bg|chapter)[\/\\]/i,
  /^[a-z0-9_]+\.[a-z0-9_]+$/,              // file.ext
  /^[a-z0-9_]{1,}[\/\\]/,                  // path/...
  
  // Comandi di scripting Danganronpa (estesi)
  /^(CLR|WAK|FLH|BGM|SE|VOI|CHR|BG|CUT|TXT|SET|END|WIT|FMC|LBL|JMP|CHK|FLG|MAP|SBC|CAM|SPR|OBJ|SHK|PAN|MOV|ANI|SCR|MNI|EVI|ITC|ARC|NPC|UNK)/,
  /^\[.*\]$/,                               // [COMMAND]
  /^\/\/.*/,                                // //comment
  /^\\[nrtk]/,                              // \n, \r, \t, \k
  /^<CLT\s*\d+>/,                           // <CLT 1> Danganronpa color tag
  /^<PLAYGAME>/i,                           // <PLAYGAME>
  
  // Numeri e codici
  /^\d+$/,                                  // Solo numeri
  /^[0-9.,;:\s]+$/,                          // Solo numeri/punteggiatura
  /^[A-Z]\d{1,}$/,                          // Codici tipo A01, B3
  /^\d+[xX]\d+$/,                           // Risoluzioni 1920x1080
  /^0x[0-9A-Fa-f]+$/,                       // Hex 0xFF
  
  // Stringhe UI di sistema (molto estese)
  /^(OK|YES|NO|CANCEL|BACK|NEXT|PREV|SAVE|LOAD|AUTO|SKIP|LOG|CONFIG|OPTION|START|EXIT|QUIT|RETRY|CONTINUE|NEW GAME|CONFIRM|SELECT|TITLE|RETURN|MENU|CLOSE|OPEN|ON|OFF|TRUE|FALSE|NULL|NONE|DEFAULT|RESET|CLEAR|DELETE|REMOVE|ADD|EDIT|COPY|PASTE|CUT|UNDO|REDO|HELP|INFO|WARNING|ERROR|DEBUG|TEST)$/i,
  /^Chapter \d+$/i,
  /^(Daily Life|Deadly Life|Class Trial|Free Time|School Mode|Island Mode|Prologue|Epilogue)$/i,
  /^(Investigation|Debate|Hangman.s Gambit|Bullet Time Battle|Panic Talk Action|Closing Argument|Mass Panic Debate|Argument Armament)$/i,
  
  // Nomi personaggi da soli (non sono dialoghi)
  /^(Makoto|Kyoko|Byakuya|Toko|Aoi|Yasuhiro|Sakura|Celeste|Mondo|Kiyotaka|Chihiro|Hifumi|Leon|Sayaka|Junko|Mukuro|Monokuma|Monomi|Usami|Nagito|Hajime|Chiaki|Fuyuhiko|Kazuichi|Sonia|Gundham|Mikan|Ibuki|Akane|Nekomaru|Teruteru|Mahiru|Peko|Hiyoko|Impostor|Kaede|Shuichi|Kokichi|Maki|Rantaro|Kiibo|Tsumugi|Gonta|Kirumi|Angie|Himiko|Ryoma|Korekiyo|Miu|Tenko|Monosuke|Monokid|Monodam|Monophanie|Monotaro)$/i,
  
  // Nomi file/identificatori
  /^e\d{2}/,                                // e01, e02_001...
  /^dr[12v3]_/i,                            // dr1_..., dr2_..., drv3_...
  /^(bustup|sprite|cg|bg|ev|ui|icon|cursor|font|effect|particle)_/i,
  /^[a-z]{1,3}\d{2,}/,                      // abc01, xy123
  
  // Stringhe troppo ripetitive
  /^\.{2,}$/,                               // ..., ....
  /^[!?…]+$/,                               // !!!, ???, …
  /^[-=_~*#]{2,}$/,                         // --, ===, __, ~~, **, ##
  /^[\s\p{P}]+$/u,                          // Solo punteggiatura/spazi
  
  // Pattern tecnici extra
  /^(true|false|null|undefined|NaN|Infinity)$/i,
  /^rgba?\s*\(/i,                           // rgba(...)
  /^(\d+,\s*)+\d+$/,                        // 1, 2, 3 (coordinate/array)
  /^[a-f0-9]{8,}$/i,                        // hash lunghi
  /^[A-Z][a-z]+[A-Z]/,                      // CamelCase identifiers
];

/** Tier 1: Pronomi personali 1a/2a persona — DIALOGO CERTO */
const TIER1_PERSONAL_PRONOUNS: RegExp[] = [
  /\b(I|I'm|I'll|I've|I'd|me|my|mine|myself)\b/,
  /\b(you|you're|you'll|you've|you'd|your|yours|yourself)\b/i,
  /\b(we|we're|we'll|we've|we'd|our|ours|ourselves|us)\b/i,
];

/** Tier 2: Contrazioni/interiezioni — DIALOGO PROBABILE (richiede 5+ parole) */
const TIER2_SPEECH_PATTERNS: RegExp[] = [
  /\b(don't|can't|won't|isn't|aren't|wasn't|weren't|didn't|couldn't|wouldn't|shouldn't|hasn't|haven't|hadn't|let's|that's|there's|here's|what's|who's|it's|he's|she's)\b/i,
  /\b(said|asked|told|replied|answered|shouted|whispered|screamed|yelled|cried|muttered|exclaimed)\b/i,
  /\b(hey|huh|hmm|um|uh|oh|ah|wow|well|okay|yeah|nah|damn|hell|god|dude|man|look|listen|wait|stop|shut up|no way|of course)\b/i,
  /"[^"]+"/,
];

/** Minimo parole per considerare una stringa come dialogo senza speaker */
const MIN_WORDS_NO_SPEAKER = 4;
/** Minimo parole per considerare una stringa come dialogo con speaker */
const MIN_WORDS_WITH_SPEAKER = 2;

/**
 * Controlla se una stringa è testo leggibile (non garbage binario).
 * Verifica: rapporto vocali, lettere minuscole, struttura parole.
 */
function isReadableText(text: string): boolean {
  if (text.length < 3) return false;
  
  const letters = text.split('').filter(c => /[a-zA-Z]/.test(c)).length;
  const totalChars = text.length;
  // Almeno 40% lettere (rilassato da 60%)
  if (letters / totalChars < 0.4) return false;
  
  // Deve contenere vocali
  const vowels = text.split('').filter(c => /[aeiouAEIOU]/.test(c)).length;
  if (vowels === 0) return false;
  
  // Deve avere lettere minuscole
  const lowercase = text.split('').filter(c => /[a-z]/.test(c)).length;
  if (lowercase / Math.max(letters, 1) < 0.2) return false;
  
  // Meno del 25% caratteri speciali (rilassato da 15%)
  const specials = text.split('').filter(c => !/[a-zA-Z0-9\s.,!?'"-]/.test(c)).length;
  if (specials / totalChars > 0.25) return false;
  
  return true;
}

// ============================================================================
// LOCAL FILTER (fase 1)
// ============================================================================

/**
 * Filtro locale veloce basato su regex e euristiche.
 * Elimina stringhe chiaramente non-dialogo senza chiamare API.
 */
export function localFilter(
  dialogues: DanganronpaDialogue[],
  options: FilterOptions = {}
): FilterResult {
  const {
    minLength = 5,
    maxLength = 500,
    removeDuplicates = true,
    requireSpeaker = false,
  } = options;

  const stats: FilterStats = {
    totalInput: dialogues.length,
    afterLocalFilter: 0,
    afterAIFilter: 0,
    removedEmpty: 0,
    removedDuplicate: 0,
    removedSystemText: 0,
    removedShort: 0,
    removedNonDialogue: 0,
    estimatedCostSaved: '',
  };

  const seen = new Set<string>();
  const filtered: DanganronpaDialogue[] = [];
  const removed: DanganronpaDialogue[] = [];

  for (const d of dialogues) {
    const text = d.original?.trim();

    // 1. Vuoto
    if (!text || text.length === 0) {
      stats.removedEmpty++;
      removed.push(d);
      continue;
    }

    // 2. Troppo corto
    if (text.length < minLength) {
      stats.removedShort++;
      removed.push(d);
      continue;
    }

    // 3. Troppo lungo (probabilmente dump di dati)
    if (text.length > maxLength) {
      stats.removedSystemText++;
      removed.push(d);
      continue;
    }

    // 4. Duplicato
    if (removeDuplicates) {
      const normalized = text.toLowerCase().trim();
      if (seen.has(normalized)) {
        stats.removedDuplicate++;
        removed.push(d);
        continue;
      }
      seen.add(normalized);
    }

    // 5. Richiede speaker
    if (requireSpeaker && (!d.speaker || d.speaker.trim() === '')) {
      stats.removedNonDialogue++;
      removed.push(d);
      continue;
    }

    // 5b. Check testo leggibile (filtra garbage binario)
    if (!isReadableText(text)) {
      stats.removedNonDialogue++;
      removed.push(d);
      continue;
    }

    // 6. Pattern di sistema
    let isSystem = false;
    for (const pattern of SYSTEM_PATTERNS) {
      if (pattern.test(text)) {
        isSystem = true;
        break;
      }
    }
    if (isSystem) {
      stats.removedSystemText++;
      removed.push(d);
      continue;
    }

    // 7. Conta parole
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const hasSpeaker = d.speaker && d.speaker.trim() !== '';

    // 7a. Stringhe senza speaker devono avere almeno N parole
    if (!hasSpeaker && wordCount < MIN_WORDS_NO_SPEAKER) {
      stats.removedNonDialogue++;
      removed.push(d);
      continue;
    }

    // 7b. Stringhe con speaker devono avere almeno N parole
    if (hasSpeaker && wordCount < MIN_WORDS_WITH_SPEAKER) {
      stats.removedNonDialogue++;
      removed.push(d);
      continue;
    }

    // 8. Filtro dialogo: richiedi pronomi personali + minimo 6 parole
    // Le descrizioni e frammenti corti vengono filtrati
    if (!hasSpeaker) {
      if (wordCount < 10) {
        stats.removedNonDialogue++;
        removed.push(d);
        continue;
      }
      let hasPronoun = false;
      for (const pat of TIER1_PERSONAL_PRONOUNS) {
        if (pat.test(text)) { hasPronoun = true; break; }
      }
      
      if (!hasPronoun) {
        stats.removedNonDialogue++;
        removed.push(d);
        continue;
      }
    }

    filtered.push(d);
  }

  stats.afterLocalFilter = filtered.length;

  // Stima costo risparmiato (basato su Gemini pricing)
  const removedChars = removed.reduce((sum, d) => sum + (d.original?.length || 0), 0);
  const savedTokens = Math.ceil(removedChars / 4);
  const savedCost = (savedTokens / 1_000_000) * (0.075 + 0.30); // Gemini input + output
  stats.estimatedCostSaved = savedCost < 0.01 ? '< $0.01' : `~$${savedCost.toFixed(2)}`;

  return { filtered, removed, stats };
}

// ============================================================================
// AI CLASSIFICATION (fase 2 - opzionale)
// ============================================================================

/**
 * Classificazione AI per filtrare ulteriormente i dialoghi.
 * Usa un prompt per classificare batch di stringhe per priorità.
 */
export async function aiClassifyDialogues(
  dialogues: DanganronpaDialogue[],
  minPriority: number = 2,
  onProgress?: (current: number, total: number) => void
): Promise<FilterResult> {
  const batchSize = 30;
  const classified: DanganronpaDialogue[] = [];
  const removed: DanganronpaDialogue[] = [];

  const stats: FilterStats = {
    totalInput: dialogues.length,
    afterLocalFilter: dialogues.length,
    afterAIFilter: 0,
    removedEmpty: 0,
    removedDuplicate: 0,
    removedSystemText: 0,
    removedShort: 0,
    removedNonDialogue: 0,
    estimatedCostSaved: '',
  };

  for (let i = 0; i < dialogues.length; i += batchSize) {
    const batch = dialogues.slice(i, i + batchSize);
    const texts = batch.map((d, idx) => `${idx + 1}. [${d.speaker || '???'}] ${d.original}`).join('\n');

    try {
      const result = await translateSmart({
        texts: [
          `Classify these Danganronpa game dialogue lines by translation priority (1=skip/system, 2=low, 3=medium, 4=important, 5=critical story). Return ONLY a JSON array of numbers, one per line.\n\n${texts}`
        ],
        targetLanguage: 'en',
        sourceLanguage: 'en',
        context: 'Danganronpa dialogue classification - return priority numbers only'
      });

      if (result.success && result.translations[0]) {
        const responseText = result.translations[0];
        let priorities: number[] = [];
        
        try {
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            priorities = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // Fallback: prova a estrarre numeri
          priorities = responseText.match(/\d/g)?.map(Number) || [];
        }

        for (let j = 0; j < batch.length; j++) {
          const priority = priorities[j] || 3; // Default: medium
          if (priority >= minPriority) {
            classified.push(batch[j]);
          } else {
            stats.removedNonDialogue++;
            removed.push(batch[j]);
          }
        }
      } else {
        // Se AI fallisce, includi tutto il batch
        classified.push(...batch);
      }
    } catch {
      // Errore AI — includi tutto il batch per sicurezza
      classified.push(...batch);
    }

    onProgress?.(Math.min(i + batchSize, dialogues.length), dialogues.length);
    
    // Delay per rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  stats.afterAIFilter = classified.length;

  const removedChars = removed.reduce((sum, d) => sum + (d.original?.length || 0), 0);
  const savedTokens = Math.ceil(removedChars / 4);
  const savedCost = (savedTokens / 1_000_000) * (0.075 + 0.30);
  stats.estimatedCostSaved = savedCost < 0.01 ? '< $0.01' : `~$${savedCost.toFixed(2)}`;

  return { filtered: classified, removed, stats };
}

// ============================================================================
// COMBINED FILTER
// ============================================================================

/**
 * Filtro combinato: locale + AI (opzionale).
 * Usare con options.useAIClassification = true per il filtro AI.
 */
export async function filterDanganronpaDialogues(
  dialogues: DanganronpaDialogue[],
  options: FilterOptions = {},
  onProgress?: (phase: string, current: number, total: number) => void
): Promise<FilterResult> {
  // Fase 1: Filtro locale
  onProgress?.('local', 0, dialogues.length);
  const localResult = localFilter(dialogues, options);
  onProgress?.('local', localResult.filtered.length, dialogues.length);

  clientLogger.debug(`[DanganronpaFilter] Locale: ${dialogues.length} → ${localResult.filtered.length} (rimossi ${localResult.removed.length})`);

  // Fase 2: Classificazione AI (opzionale)
  if (options.useAIClassification && localResult.filtered.length > 500) {
    onProgress?.('ai', 0, localResult.filtered.length);
    
    const aiResult = await aiClassifyDialogues(
      localResult.filtered,
      options.minPriority || 2,
      (current, total) => onProgress?.('ai', current, total)
    );

    clientLogger.debug(`[DanganronpaFilter] AI: ${localResult.filtered.length} → ${aiResult.filtered.length} (rimossi ${aiResult.removed.length})`);

    // Combina stats
    return {
      filtered: aiResult.filtered,
      removed: [...localResult.removed, ...aiResult.removed],
      stats: {
        ...localResult.stats,
        afterAIFilter: aiResult.filtered.length,
        removedNonDialogue: localResult.stats.removedNonDialogue + aiResult.stats.removedNonDialogue,
        estimatedCostSaved: aiResult.stats.estimatedCostSaved,
      }
    };
  }

  localResult.stats.afterAIFilter = localResult.stats.afterLocalFilter;
  return localResult;
}
