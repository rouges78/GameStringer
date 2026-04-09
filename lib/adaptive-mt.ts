/**
 * 🧠 Adaptive MT — Machine Translation che impara dalle correzioni umane
 * 
 * Quando l'utente corregge una traduzione, la coppia (originale → correzione)
 * viene salvata come "human correction". Nelle traduzioni successive, le correzioni
 * più rilevanti vengono iniettate nel prompt come few-shot examples, migliorando
 * progressivamente la qualità.
 * 
 * Architettura:
 * 1. Store correzioni umane per (gameId, languagePair)
 * 2. Calcolo similarità fuzzy tra testo corrente e correzioni salvate
 * 3. Selezione top-K correzioni più rilevanti
 * 4. Generazione blocco few-shot per il prompt di traduzione
 * 5. Feedback loop: più correzioni = traduzioni migliori
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HumanCorrection {
  id: string;
  /** Testo sorgente (lingua originale) */
  sourceText: string;
  /** Traduzione AI originale (quella sbagliata/migliorabile) */
  aiTranslation: string;
  /** Correzione umana (quella corretta) */
  humanCorrection: string;
  /** Lingua sorgente */
  sourceLanguage: string;
  /** Lingua target */
  targetLanguage: string;
  /** ID del gioco */
  gameId?: string;
  /** Tipo di contenuto (dal content-classifier) */
  contentType?: string;
  /** Motivo della correzione (opzionale, dall'utente) */
  reason?: string;
  /** Tag per categorizzare (tono, stile, terminologia, errore) */
  tags: string[];
  /** Timestamp */
  createdAt: string;
  /** Numero di volte che questa correzione è stata usata come example */
  usageCount: number;
  /** Se la correzione è stata approvata/verificata */
  approved: boolean;
}

export interface CorrectionStats {
  totalCorrections: number;
  byLanguagePair: Record<string, number>;
  byGameId: Record<string, number>;
  byContentType: Record<string, number>;
  byTag: Record<string, number>;
  mostUsed: HumanCorrection[];
  recentCorrections: HumanCorrection[];
  avgUsageCount: number;
}

export interface FewShotBlock {
  /** Prompt block da iniettare */
  prompt: string;
  /** Numero di examples inclusi */
  exampleCount: number;
  /** IDs delle correzioni usate */
  correctionIds: string[];
}

export interface AdaptiveMTConfig {
  /** Numero massimo di few-shot examples per prompt */
  maxExamples: number;
  /** Soglia minima di similarità (0-1) per includere un example */
  similarityThreshold: number;
  /** Se true, preferisce correzioni dello stesso gioco */
  preferSameGame: boolean;
  /** Se true, preferisce correzioni dello stesso tipo di contenuto */
  preferSameContentType: boolean;
  /** Se true, include solo correzioni approvate */
  approvedOnly: boolean;
  /** Peso aggiuntivo per correzioni recenti */
  recencyBoost: number;
}

export const DEFAULT_CONFIG: AdaptiveMTConfig = {
  maxExamples: 5,
  similarityThreshold: 0.2,
  preferSameGame: true,
  preferSameContentType: true,
  approvedOnly: false,
  recencyBoost: 0.1,
};

// ============================================================================
// STORAGE
// ============================================================================

const STORAGE_KEY = 'gamestringer_adaptive_mt';

function loadCorrections(): HumanCorrection[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCorrections(corrections: HumanCorrection[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections));
  } catch (e: unknown) {
    clientLogger.warn('[AdaptiveMT] Save failed:', e);
  }
}

// ============================================================================
// SIMILARITY CALCULATION
// ============================================================================

/**
 * Calcola similarità tra due stringhe usando trigram overlap (Dice coefficient).
 * Veloce e efficace per testi brevi/medi senza bisogno di API.
 */
function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1;

  // Genera trigrammi
  const trigramsA = new Set<string>();
  const trigramsB = new Set<string>();

  for (let i = 0; i <= aLower.length - 3; i++) {
    trigramsA.add(aLower.substring(i, i + 3));
  }
  for (let i = 0; i <= bLower.length - 3; i++) {
    trigramsB.add(bLower.substring(i, i + 3));
  }

  if (trigramsA.size === 0 || trigramsB.size === 0) {
    // Fallback per stringhe molto corte: confronto caratteri
    const setA = new Set(aLower.split(''));
    const setB = new Set(bLower.split(''));
    let intersection = 0;
    for (const c of setA) {
      if (setB.has(c)) intersection++;
    }
    return (2 * intersection) / (setA.size + setB.size);
  }

  // Dice coefficient
  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }

  return (2 * intersection) / (trigramsA.size + trigramsB.size);
}

/**
 * Calcola similarità basata su parole condivise (Jaccard index)
 */
function wordSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  return intersection / (wordsA.size + wordsB.size - intersection);
}

/**
 * Similarità combinata (trigram + word)
 */
function combinedSimilarity(a: string, b: string): number {
  const trig = trigramSimilarity(a, b);
  const word = wordSimilarity(a, b);
  // Peso maggiore ai trigrammi (catturano struttura), ma le parole aiutano per significato
  return trig * 0.6 + word * 0.4;
}

// ============================================================================
// CORE API
// ============================================================================

/**
 * Salva una correzione umana
 */
export function addCorrection(input: {
  sourceText: string;
  aiTranslation: string;
  humanCorrection: string;
  sourceLanguage: string;
  targetLanguage: string;
  gameId?: string;
  contentType?: string;
  reason?: string;
  tags?: string[];
}): HumanCorrection {
  const corrections = loadCorrections();

  // Cerca duplicato (stessa source + stessa lingua)
  const existing = corrections.findIndex(c =>
    c.sourceText === input.sourceText &&
    c.sourceLanguage === input.sourceLanguage &&
    c.targetLanguage === input.targetLanguage &&
    c.gameId === input.gameId
  );

  const correction: HumanCorrection = {
    id: existing >= 0 ? corrections[existing].id : `corr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    sourceText: input.sourceText,
    aiTranslation: input.aiTranslation,
    humanCorrection: input.humanCorrection,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    gameId: input.gameId,
    contentType: input.contentType,
    reason: input.reason,
    tags: input.tags || autoDetectTags(input.aiTranslation, input.humanCorrection),
    createdAt: new Date().toISOString(),
    usageCount: existing >= 0 ? corrections[existing].usageCount : 0,
    approved: true, // Le correzioni umane sono approvate di default
  };

  if (existing >= 0) {
    corrections[existing] = correction;
  } else {
    corrections.push(correction);
  }

  saveCorrections(corrections);
  clientLogger.debug(`[AdaptiveMT] Correction saved: "${input.sourceText.substring(0, 40)}..." (total: ${corrections.length})`);

  return correction;
}

/**
 * Auto-rileva i tag basati sulle differenze tra AI e correzione umana
 */
function autoDetectTags(aiTranslation: string, humanCorrection: string): string[] {
  const tags: string[] = [];

  const aiLower = aiTranslation.toLowerCase();
  const humanLower = humanCorrection.toLowerCase();

  // Tono cambiato (formale vs informale)
  const hasTuAI = /\b(tu|tuo|tua|ti)\b/.test(aiLower);
  const hasLeiAI = /\b(lei|suo|sua)\b/.test(aiLower);
  const hasTuHuman = /\b(tu|tuo|tua|ti)\b/.test(humanLower);
  const hasLeiHuman = /\b(lei|suo|sua)\b/.test(humanLower);
  if ((hasTuAI && hasLeiHuman) || (hasLeiAI && hasTuHuman)) {
    tags.push('tone_change');
  }

  // Terminologia cambiata
  const aiWords = new Set(aiLower.split(/\s+/));
  const humanWords = new Set(humanLower.split(/\s+/));
  let changed = 0;
  for (const w of humanWords) {
    if (!aiWords.has(w) && w.length > 3) changed++;
  }
  if (changed > 0 && changed <= 3) tags.push('terminology');
  if (changed > 3) tags.push('major_rewrite');

  // Lunghezza molto diversa
  const ratio = humanCorrection.length / Math.max(aiTranslation.length, 1);
  if (ratio < 0.7 || ratio > 1.3) tags.push('length_change');

  // Punteggiatura cambiata
  const aiPunct = aiTranslation.match(/[.!?…;:]+$/)?.[0] || '';
  const humanPunct = humanCorrection.match(/[.!?…;:]+$/)?.[0] || '';
  if (aiPunct !== humanPunct) tags.push('punctuation');

  // Stile (se l'utente ha aggiunto/rimosso slang)
  const slangPattern = /\b(figo|fico|ganzo|boh|mah|cioè|tipo|roba)\b/i;
  if (slangPattern.test(humanCorrection) !== slangPattern.test(aiTranslation)) {
    tags.push('style');
  }

  if (tags.length === 0) tags.push('minor_edit');

  return tags;
}

/**
 * Trova le correzioni più rilevanti per un testo da tradurre
 */
export function findRelevantCorrections(
  sourceText: string,
  sourceLanguage: string,
  targetLanguage: string,
  options?: {
    gameId?: string;
    contentType?: string;
    config?: Partial<AdaptiveMTConfig>;
  }
): Array<HumanCorrection & { relevanceScore: number }> {
  const config = { ...DEFAULT_CONFIG, ...options?.config };
  let corrections = loadCorrections();

  // Filtra per language pair
  corrections = corrections.filter(c =>
    c.sourceLanguage === sourceLanguage &&
    c.targetLanguage === targetLanguage
  );

  if (config.approvedOnly) {
    corrections = corrections.filter(c => c.approved);
  }

  if (corrections.length === 0) return [];

  // Calcola relevance score per ogni correzione
  const scored = corrections.map(correction => {
    let score = combinedSimilarity(sourceText, correction.sourceText);

    // Boost per stesso gioco
    if (config.preferSameGame && options?.gameId && correction.gameId === options.gameId) {
      score *= 1.3;
    }

    // Boost per stesso content type
    if (config.preferSameContentType && options?.contentType && correction.contentType === options.contentType) {
      score *= 1.2;
    }

    // Boost recenza (correzioni recenti pesano di più)
    if (config.recencyBoost > 0) {
      const ageMs = Date.now() - new Date(correction.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.max(0, 1 - (ageDays / 90)); // Decade in 90 giorni
      score += recencyFactor * config.recencyBoost;
    }

    // Bonus per correzioni molto usate (proven useful)
    if (correction.usageCount > 0) {
      score += Math.min(correction.usageCount * 0.02, 0.1);
    }

    return { ...correction, relevanceScore: Math.round(score * 1000) / 1000 };
  });

  // Filtra per threshold e ordina
  return scored
    .filter(c => c.relevanceScore >= config.similarityThreshold)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, config.maxExamples);
}

/**
 * Genera il blocco few-shot da iniettare nel prompt di traduzione
 */
export function buildFewShotBlock(
  sourceTexts: string[],
  sourceLanguage: string,
  targetLanguage: string,
  options?: {
    gameId?: string;
    contentType?: string;
    config?: Partial<AdaptiveMTConfig>;
  }
): FewShotBlock {
  // Cerca correzioni rilevanti per tutti i testi del batch
  const allRelevant = new Map<string, HumanCorrection & { relevanceScore: number }>();

  for (const text of sourceTexts) {
    const relevant = findRelevantCorrections(text, sourceLanguage, targetLanguage, options);
    for (const r of relevant) {
      const existing = allRelevant.get(r.id);
      if (!existing || r.relevanceScore > existing.relevanceScore) {
        allRelevant.set(r.id, r);
      }
    }
  }

  if (allRelevant.size === 0) {
    return { prompt: '', exampleCount: 0, correctionIds: [] };
  }

  // Top-K globali
  const config = { ...DEFAULT_CONFIG, ...options?.config };
  const topExamples = [...allRelevant.values()]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, config.maxExamples);

  // Incrementa usage count
  incrementUsageCounts(topExamples.map(e => e.id));

  // Costruisci prompt block
  const lines: string[] = [
    `[ADAPTIVE MT — Human Corrections]`,
    `The following are human-verified corrections for similar translations.`,
    `Use them as style/terminology reference:`,
    '',
  ];

  for (let i = 0; i < topExamples.length; i++) {
    const ex = topExamples[i];
    lines.push(`Example ${i + 1}:`);
    lines.push(`  Source: "${ex.sourceText}"`);
    lines.push(`  ❌ AI: "${ex.aiTranslation}"`);
    lines.push(`  ✅ Human: "${ex.humanCorrection}"`);
    if (ex.tags.length > 0 && !ex.tags.includes('minor_edit')) {
      lines.push(`  Issue: ${ex.tags.join(', ')}`);
    }
    lines.push('');
  }

  return {
    prompt: lines.join('\n'),
    exampleCount: topExamples.length,
    correctionIds: topExamples.map(e => e.id),
  };
}

/**
 * Incrementa il contatore di utilizzo delle correzioni
 */
function incrementUsageCounts(ids: string[]): void {
  const corrections = loadCorrections();
  let changed = false;
  for (const correction of corrections) {
    if (ids.includes(correction.id)) {
      correction.usageCount++;
      changed = true;
    }
  }
  if (changed) saveCorrections(corrections);
}

// ============================================================================
// MANAGEMENT API
// ============================================================================

/**
 * Ottieni tutte le correzioni (opzionalmente filtrate)
 */
export function getCorrections(filters?: {
  gameId?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  contentType?: string;
  tag?: string;
  approved?: boolean;
}): HumanCorrection[] {
  let corrections = loadCorrections();

  if (filters?.gameId) {
    corrections = corrections.filter(c => c.gameId === filters.gameId);
  }
  if (filters?.sourceLanguage) {
    corrections = corrections.filter(c => c.sourceLanguage === filters.sourceLanguage);
  }
  if (filters?.targetLanguage) {
    corrections = corrections.filter(c => c.targetLanguage === filters.targetLanguage);
  }
  if (filters?.contentType) {
    corrections = corrections.filter(c => c.contentType === filters.contentType);
  }
  if (filters?.tag) {
    corrections = corrections.filter(c => c.tags.includes(filters.tag!));
  }
  if (filters?.approved !== undefined) {
    corrections = corrections.filter(c => c.approved === filters.approved);
  }

  return corrections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Elimina una correzione
 */
export function deleteCorrection(id: string): void {
  const corrections = loadCorrections().filter(c => c.id !== id);
  saveCorrections(corrections);
}

/**
 * Approva/disapprova una correzione
 */
export function toggleApproval(id: string): void {
  const corrections = loadCorrections();
  const correction = corrections.find(c => c.id === id);
  if (correction) {
    correction.approved = !correction.approved;
    saveCorrections(corrections);
  }
}

/**
 * Elimina tutte le correzioni per un gioco
 */
export function clearCorrections(gameId?: string): void {
  if (gameId) {
    const corrections = loadCorrections().filter(c => c.gameId !== gameId);
    saveCorrections(corrections);
  } else {
    saveCorrections([]);
  }
}

/**
 * Statistiche sulle correzioni
 */
export function getCorrectionStats(): CorrectionStats {
  const corrections = loadCorrections();

  const byLanguagePair: Record<string, number> = {};
  const byGameId: Record<string, number> = {};
  const byContentType: Record<string, number> = {};
  const byTag: Record<string, number> = {};

  for (const c of corrections) {
    const pair = `${c.sourceLanguage}→${c.targetLanguage}`;
    byLanguagePair[pair] = (byLanguagePair[pair] || 0) + 1;

    if (c.gameId) {
      byGameId[c.gameId] = (byGameId[c.gameId] || 0) + 1;
    }
    if (c.contentType) {
      byContentType[c.contentType] = (byContentType[c.contentType] || 0) + 1;
    }
    for (const tag of c.tags) {
      byTag[tag] = (byTag[tag] || 0) + 1;
    }
  }

  const totalUsage = corrections.reduce((sum, c) => sum + c.usageCount, 0);

  return {
    totalCorrections: corrections.length,
    byLanguagePair,
    byGameId,
    byContentType,
    byTag,
    mostUsed: [...corrections].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10),
    recentCorrections: [...corrections].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10),
    avgUsageCount: corrections.length > 0 ? Math.round(totalUsage / corrections.length * 10) / 10 : 0,
  };
}

/**
 * Esporta correzioni come JSON
 */
export function exportCorrections(gameId?: string): string {
  const corrections = gameId ? loadCorrections().filter(c => c.gameId === gameId) : loadCorrections();
  return JSON.stringify(corrections, null, 2);
}

/**
 * Importa correzioni da JSON
 */
export function importCorrections(jsonData: string, overwrite = false): number {
  try {
    const imported = JSON.parse(jsonData) as HumanCorrection[];
    if (!Array.isArray(imported)) throw new Error('Invalid format');

    if (overwrite) {
      saveCorrections(imported);
      return imported.length;
    }

    const existing = loadCorrections();
    const existingIds = new Set(existing.map(c => c.id));
    let added = 0;

    for (const correction of imported) {
      if (!existingIds.has(correction.id)) {
        existing.push(correction);
        added++;
      }
    }

    saveCorrections(existing);
    return added;
  } catch (e: unknown) {
    clientLogger.error('[AdaptiveMT] Import failed:', e);
    return 0;
  }
}
