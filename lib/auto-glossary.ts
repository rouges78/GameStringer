/**
 * 📚 Auto-Glossary System
 * 
 * Estrae automaticamente termini da testi di gioco usando LLM,
 * li salva in un glossario per-gioco e li inietta nei prompt di traduzione.
 * 
 * Integra con:
 * - ai-translate-direct.ts (buildTranslationPrompt via glossaryHint)
 * - translation-session.ts (GlossaryEntry, GameGlossary)
 * - src-tauri smart_glossary.rs (storage persistente Tauri)
 */

import { translateSmart, getApiKeys, type TranslateOptions } from './ai-translate-direct';
import { invoke } from '@/lib/tauri-api';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type GlossaryTier = 'locked' | 'synced' | 'flexible';

export type GlossaryCategory =
  | 'character' | 'location' | 'item' | 'skill'
  | 'quest' | 'ui' | 'system' | 'lore'
  | 'creature' | 'faction' | 'other';

export interface AutoGlossaryEntry {
  id: string;
  sourceTerm: string;
  targetTerm: string;
  tier: GlossaryTier;
  category: GlossaryCategory;
  context?: string;
  doNotTranslate: boolean;
  caseSensitive: boolean;
  confidence: number;        // 0-100, quanto siamo sicuri
  autoExtracted: boolean;    // true = estratto da LLM, false = aggiunto manualmente
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AutoGlossary {
  id: string;
  gameId: string;
  gameName: string;
  sourceLang: string;
  targetLang: string;
  entries: AutoGlossaryEntry[];
  stats: GlossaryStats;
  createdAt: number;
  updatedAt: number;
}

export interface GlossaryStats {
  totalTerms: number;
  lockedTerms: number;
  syncedTerms: number;
  flexibleTerms: number;
  autoExtracted: number;
  manuallyAdded: number;
  byCategory: Record<string, number>;
}

export interface ExtractionResult {
  newTerms: AutoGlossaryEntry[];
  duplicates: number;
  total: number;
  provider: string;
  timeMs: number;
}

export interface AutoGlossaryConfig {
  enabled: boolean;
  autoExtractOnFirstBatch: boolean;  // Estrai termini dal primo batch tradotto
  maxTermsPerExtraction: number;     // Max termini da estrarre per volta
  minConfidence: number;             // Soglia minima confidence (0-100)
  injectInPrompt: boolean;           // Inietta glossario nei prompt di traduzione
  maxTermsInPrompt: number;          // Max termini da iniettare (per non superare context window)
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULTS & STATE
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: AutoGlossaryConfig = {
  enabled: true,
  autoExtractOnFirstBatch: true,
  maxTermsPerExtraction: 50,
  minConfidence: 60,
  injectInPrompt: true,
  maxTermsInPrompt: 30,
};

const STORAGE_KEY = 'gs_auto_glossaries';
const CONFIG_KEY = 'gs_auto_glossary_config';

let glossaryConfig: AutoGlossaryConfig = { ...DEFAULT_CONFIG };
let glossaryCache: Record<string, AutoGlossary> = {};
let configLoaded = false;

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

export function loadGlossaryConfig(): AutoGlossaryConfig {
  if (configLoaded) return glossaryConfig;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      glossaryConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {}
  configLoaded = true;
  // Async: carica da Tauri in background e aggiorna se disponibile
  invoke<{ [key: string]: unknown } | null>('load_auto_glossary_config').then(data => {
    if (data) {
      glossaryConfig = { ...DEFAULT_CONFIG, ...data } as AutoGlossaryConfig;
    }
  }).catch(() => {});
  return glossaryConfig;
}

export function saveGlossaryConfig(updates: Partial<AutoGlossaryConfig>): void {
  glossaryConfig = { ...glossaryConfig, ...updates };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(glossaryConfig));
  } catch {}
  // Persisti su Tauri (fire & forget)
  invoke('save_auto_glossary_config', { config: glossaryConfig }).catch(() => {});
}

export function getGlossaryConfig(): AutoGlossaryConfig {
  return { ...glossaryConfig };
}

// ═══════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════

function loadAllGlossaries(): Record<string, AutoGlossary> {
  if (Object.keys(glossaryCache).length > 0) return glossaryCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    glossaryCache = raw ? JSON.parse(raw) : {};
  } catch {
    glossaryCache = {};
  }
  return glossaryCache;
}

/**
 * Inizializza glossari da Tauri (persistente) con fallback localStorage.
 * Chiama questa funzione all'avvio per caricare dati persistiti.
 */
export async function initializeGlossaries(): Promise<void> {
  try {
    const data = await invoke<Record<string, AutoGlossary> | null>('load_all_auto_glossaries');
    if (data && Object.keys(data).length > 0) {
      glossaryCache = data as Record<string, AutoGlossary>;
      // Sincronizza anche localStorage come cache veloce
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(glossaryCache)); } catch {}
      console.log(`[AutoGlossary] Caricati ${Object.keys(glossaryCache).length} glossari da Tauri`);
      return;
    }
  } catch {
    // Tauri non disponibile, usa localStorage
  }
  loadAllGlossaries();
}

function saveAllGlossaries(): void {
  // localStorage come cache veloce
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(glossaryCache));
  } catch {}
  // Persisti ogni glossario su Tauri (fire & forget)
  for (const [gameId, glossary] of Object.entries(glossaryCache)) {
    invoke('save_auto_glossary', { gameId, data: glossary }).catch(() => {});
  }
}

export function loadGlossary(gameId: string): AutoGlossary | null {
  const all = loadAllGlossaries();
  return all[gameId] || null;
}

/**
 * Carica glossario da Tauri (persistente) con fallback cache locale.
 */
export async function loadGlossaryAsync(gameId: string): Promise<AutoGlossary | null> {
  // Prima controlla cache locale
  if (glossaryCache[gameId]) return glossaryCache[gameId];

  try {
    const data = await invoke<AutoGlossary | null>('load_auto_glossary', { gameId });
    if (data) {
      glossaryCache[gameId] = data as AutoGlossary;
      return data as AutoGlossary;
    }
  } catch {
    // Tauri non disponibile
  }

  return loadGlossary(gameId);
}

export function saveGlossary(glossary: AutoGlossary): void {
  glossary.updatedAt = Date.now();
  glossary.stats = calculateStats(glossary.entries);
  glossaryCache[glossary.gameId] = glossary;
  // localStorage come cache veloce
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(glossaryCache));
  } catch {}
  // Persisti su Tauri (fire & forget)
  invoke('save_auto_glossary', { gameId: glossary.gameId, data: glossary }).catch(() => {});
}

export function createGlossary(
  gameId: string,
  gameName: string,
  sourceLang: string,
  targetLang: string
): AutoGlossary {
  const existing = loadGlossary(gameId);
  if (existing) return existing;

  const glossary: AutoGlossary = {
    id: `gl_${gameId}_${sourceLang}_${targetLang}`,
    gameId,
    gameName,
    sourceLang,
    targetLang,
    entries: [],
    stats: calculateStats([]),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveGlossary(glossary);
  return glossary;
}

export function deleteGlossary(gameId: string): void {
  delete glossaryCache[gameId];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(glossaryCache)); } catch {}
  invoke('delete_auto_glossary', { gameId }).catch(() => {});
}

export function listGlossaries(): AutoGlossary[] {
  const all = loadAllGlossaries();
  return Object.values(all);
}

function calculateStats(entries: AutoGlossaryEntry[]): GlossaryStats {
  const stats: GlossaryStats = {
    totalTerms: entries.length,
    lockedTerms: 0,
    syncedTerms: 0,
    flexibleTerms: 0,
    autoExtracted: 0,
    manuallyAdded: 0,
    byCategory: {},
  };

  for (const e of entries) {
    if (e.tier === 'locked') stats.lockedTerms++;
    else if (e.tier === 'synced') stats.syncedTerms++;
    else stats.flexibleTerms++;

    if (e.autoExtracted) stats.autoExtracted++;
    else stats.manuallyAdded++;

    stats.byCategory[e.category] = (stats.byCategory[e.category] || 0) + 1;
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════
// TERM MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

function generateId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function addTerm(
  gameId: string,
  term: Omit<AutoGlossaryEntry, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>
): AutoGlossaryEntry | null {
  const glossary = loadGlossary(gameId);
  if (!glossary) return null;

  // Controlla duplicati
  const exists = glossary.entries.find(
    e => e.sourceTerm.toLowerCase() === term.sourceTerm.toLowerCase()
  );
  if (exists) return null;

  const entry: AutoGlossaryEntry = {
    ...term,
    id: generateId(),
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  glossary.entries.push(entry);
  saveGlossary(glossary);
  return entry;
}

export function updateTerm(
  gameId: string,
  termId: string,
  updates: Partial<Pick<AutoGlossaryEntry, 'targetTerm' | 'tier' | 'category' | 'context' | 'doNotTranslate' | 'confidence'>>
): AutoGlossaryEntry | null {
  const glossary = loadGlossary(gameId);
  if (!glossary) return null;

  const entry = glossary.entries.find(e => e.id === termId);
  if (!entry) return null;

  if (updates.targetTerm !== undefined) entry.targetTerm = updates.targetTerm;
  if (updates.tier !== undefined) entry.tier = updates.tier;
  if (updates.category !== undefined) entry.category = updates.category;
  if (updates.context !== undefined) entry.context = updates.context;
  if (updates.doNotTranslate !== undefined) entry.doNotTranslate = updates.doNotTranslate;
  if (updates.confidence !== undefined) entry.confidence = updates.confidence;
  entry.updatedAt = Date.now();

  saveGlossary(glossary);
  return entry;
}

export function deleteTerm(gameId: string, termId: string): boolean {
  const glossary = loadGlossary(gameId);
  if (!glossary) return false;

  const idx = glossary.entries.findIndex(e => e.id === termId);
  if (idx === -1) return false;

  glossary.entries.splice(idx, 1);
  saveGlossary(glossary);
  return true;
}

export function searchTerms(
  gameId: string,
  query: string,
  tierFilter?: GlossaryTier,
  categoryFilter?: GlossaryCategory
): AutoGlossaryEntry[] {
  const glossary = loadGlossary(gameId);
  if (!glossary) return [];

  const q = query.toLowerCase();
  return glossary.entries.filter(e => {
    const matchesQuery = !query ||
      e.sourceTerm.toLowerCase().includes(q) ||
      e.targetTerm.toLowerCase().includes(q);
    const matchesTier = !tierFilter || e.tier === tierFilter;
    const matchesCat = !categoryFilter || e.category === categoryFilter;
    return matchesQuery && matchesTier && matchesCat;
  });
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-EXTRACTION via LLM
// ═══════════════════════════════════════════════════════════════════

/**
 * Estrae automaticamente termini di gioco da un set di testi.
 * Usa un LLM per analizzare i testi e identificare:
 * - Nomi di personaggi
 * - Luoghi
 * - Oggetti/item
 * - Skill/abilità
 * - Termini UI/sistema
 * - Lore/ambientazione
 */
export async function extractTerms(
  gameId: string,
  gameName: string,
  texts: string[],
  sourceLang: string,
  targetLang: string,
  genre?: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  // Assicura che il glossario esista
  let glossary = loadGlossary(gameId);
  if (!glossary) {
    glossary = createGlossary(gameId, gameName, sourceLang, targetLang);
  }

  // Prendi un campione rappresentativo (max 40 testi, vari)
  const sample = selectRepresentativeSample(texts, 40);

  const extractionPrompt = buildExtractionPrompt(sample, sourceLang, targetLang, gameName, genre);

  let provider = 'unknown';
  let rawTerms: Array<{
    source: string;
    target: string;
    category: string;
    tier: string;
    doNotTranslate?: boolean;
    context?: string;
  }> = [];

  try {
    const result = await translateSmart({
      texts: [extractionPrompt],
      targetLanguage: 'en',
      sourceLanguage: 'en',
      context: 'Term extraction for game glossary - return JSON only',
    });

    provider = result.provider;
    const responseText = result.translations[0] || '';

    // Prova a parsare il JSON dalla risposta
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      rawTerms = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('[AutoGlossary] Estrazione termini fallita:', err);
    return { newTerms: [], duplicates: 0, total: 0, provider, timeMs: Date.now() - startTime };
  }

  // Filtra e aggiungi termini al glossario
  const config = loadGlossaryConfig();
  let newTerms: AutoGlossaryEntry[] = [];
  let duplicates = 0;

  for (const raw of rawTerms) {
    if (!raw.source || !raw.target) continue;
    if (raw.source.length < 2) continue;

    // Controlla duplicati
    const exists = glossary.entries.find(
      e => e.sourceTerm.toLowerCase() === raw.source.toLowerCase()
    );
    if (exists) {
      duplicates++;
      continue;
    }

    const category = normalizeCategory(raw.category);
    const tier = normalizeTier(raw.tier, category);
    const confidence = estimateConfidence(raw, sample);

    if (confidence < config.minConfidence) continue;

    const entry: AutoGlossaryEntry = {
      id: generateId(),
      sourceTerm: raw.source.trim(),
      targetTerm: raw.doNotTranslate ? raw.source.trim() : raw.target.trim(),
      tier,
      category,
      context: raw.context,
      doNotTranslate: raw.doNotTranslate || false,
      caseSensitive: category === 'character' || category === 'location',
      confidence,
      autoExtracted: true,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    glossary.entries.push(entry);
    newTerms.push(entry);

    if (newTerms.length >= config.maxTermsPerExtraction) break;
  }

  saveGlossary(glossary);

  console.log(
    `[AutoGlossary] Estratti ${newTerms.length} nuovi termini (${duplicates} duplicati) ` +
    `per ${gameName} via ${provider} in ${Date.now() - startTime}ms`
  );

  return {
    newTerms,
    duplicates,
    total: rawTerms.length,
    provider,
    timeMs: Date.now() - startTime,
  };
}

function buildExtractionPrompt(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  gameName: string,
  genre?: string
): string {
  const textList = texts.map((t, i) => `${i + 1}. "${t}"`).join('\n');

  return `You are a game localization expert. Analyze these game texts from "${gameName}"${genre ? ` (genre: ${genre})` : ''} and extract important terms that should be translated consistently.

SOURCE LANGUAGE: ${sourceLang}
TARGET LANGUAGE: ${targetLang}

GAME TEXTS:
${textList}

Extract terms in these categories:
- **character**: Character names, titles, honorifics
- **location**: Place names, regions, areas
- **item**: Items, weapons, armor, consumables
- **skill**: Skills, spells, abilities, stats
- **quest**: Quest names, objectives
- **ui**: UI labels, menu items
- **lore**: World-building terms, factions, lore-specific terms
- **creature**: Monster/enemy names
- **faction**: Guilds, organizations, groups

For each term, decide:
- **tier**: "locked" (names that must NEVER change), "synced" (system terms that should be consistent), "flexible" (can adapt to context)
- **doNotTranslate**: true for names that should stay in the original language (e.g. "Liyue", "Sans")

Return ONLY a JSON array:
[{"source": "term", "target": "translation", "category": "character", "tier": "locked", "doNotTranslate": false, "context": "brief note"}]

Rules:
- Only extract terms that appear in the texts or can be inferred
- Proper nouns → locked tier
- UI/system terms → synced tier
- Descriptive terms → flexible tier
- Max 50 terms
- Be precise with translations for ${targetLang}`;
}

function selectRepresentativeSample(texts: string[], maxCount: number): string[] {
  if (texts.length <= maxCount) return texts;

  // Prendi testi da diverse posizioni per diversità
  const step = Math.max(1, Math.floor(texts.length / maxCount));
  const sample: string[] = [];

  for (let i = 0; i < texts.length && sample.length < maxCount; i += step) {
    const text = texts[i];
    if (text && text.length > 3 && text.length < 500) {
      sample.push(text);
    }
  }

  return sample;
}

function normalizeCategory(raw: string): GlossaryCategory {
  const valid: GlossaryCategory[] = [
    'character', 'location', 'item', 'skill', 'quest',
    'ui', 'system', 'lore', 'creature', 'faction', 'other',
  ];
  const lower = (raw || '').toLowerCase().trim();
  return (valid.includes(lower as GlossaryCategory) ? lower : 'other') as GlossaryCategory;
}

function normalizeTier(raw: string, category: GlossaryCategory): GlossaryTier {
  const lower = (raw || '').toLowerCase().trim();
  if (lower === 'locked' || lower === 'synced' || lower === 'flexible') {
    return lower as GlossaryTier;
  }
  // Default basato sulla categoria
  if (category === 'character' || category === 'location') return 'locked';
  if (category === 'ui' || category === 'system') return 'synced';
  return 'flexible';
}

function estimateConfidence(
  term: { source: string; target: string; category?: string },
  texts: string[]
): number {
  let confidence = 70; // Base

  // Bonus se il termine appare più volte nei testi
  const occurrences = texts.filter(t =>
    t.toLowerCase().includes(term.source.toLowerCase())
  ).length;
  if (occurrences >= 3) confidence += 15;
  else if (occurrences >= 2) confidence += 10;
  else if (occurrences === 1) confidence += 5;

  // Bonus se ha categoria valida
  if (term.category && term.category !== 'other') confidence += 5;

  // Penalità se termine troppo corto o generico
  if (term.source.length < 3) confidence -= 20;
  if (term.source.length < 5) confidence -= 5;

  // Penalità se traduzione identica al source (potrebbe essere errore)
  if (term.source.toLowerCase() === term.target.toLowerCase()) confidence -= 10;

  return Math.max(0, Math.min(100, confidence));
}

// ═══════════════════════════════════════════════════════════════════
// GLOSSARY HINT BUILDER (per iniezione nei prompt)
// ═══════════════════════════════════════════════════════════════════

/**
 * Costruisce la stringa glossaryHint da iniettare nel prompt di traduzione.
 * Ordina per tier (locked > synced > flexible) e limita il numero di termini.
 */
export function buildGlossaryHint(gameId: string): string {
  const config = loadGlossaryConfig();
  if (!config.enabled || !config.injectInPrompt) return '';

  const glossary = loadGlossary(gameId);
  if (!glossary || glossary.entries.length === 0) return '';

  // Ordina: locked prima, poi synced, poi flexible; per confidence decrescente
  const tierOrder: Record<GlossaryTier, number> = { locked: 0, synced: 1, flexible: 2 };
  const sorted = [...glossary.entries]
    .sort((a, b) => {
      const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.confidence - a.confidence;
    })
    .slice(0, config.maxTermsInPrompt);

  if (sorted.length === 0) return '';

  const lines: string[] = [];
  lines.push('GLOSSARY (ALWAYS use these exact translations for consistency):');

  for (const e of sorted) {
    if (e.doNotTranslate) {
      lines.push(`- "${e.sourceTerm}" → keep as "${e.sourceTerm}" (do NOT translate)`);
    } else {
      const tierLabel = e.tier === 'locked' ? '[MUST]' : e.tier === 'synced' ? '[PREF]' : '';
      lines.push(`- "${e.sourceTerm}" → "${e.targetTerm}" ${tierLabel}`.trim());
    }
  }

  return lines.join('\n');
}

/**
 * Costruisce glossaryHint per un set specifico di testi.
 * Filtra solo i termini che appaiono effettivamente nei testi da tradurre.
 */
export function buildRelevantGlossaryHint(gameId: string, texts: string[]): string {
  const config = loadGlossaryConfig();
  if (!config.enabled || !config.injectInPrompt) return '';

  const glossary = loadGlossary(gameId);
  if (!glossary || glossary.entries.length === 0) return '';

  const textJoined = texts.join(' ').toLowerCase();

  // Filtra solo termini presenti nei testi
  const relevant = glossary.entries.filter(e =>
    textJoined.includes(e.sourceTerm.toLowerCase())
  );

  if (relevant.length === 0) return '';

  // Ordina e limita
  const tierOrder: Record<GlossaryTier, number> = { locked: 0, synced: 1, flexible: 2 };
  const sorted = relevant
    .sort((a, b) => {
      const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.sourceTerm.length - a.sourceTerm.length; // più lunghi prima
    })
    .slice(0, config.maxTermsInPrompt);

  const lines: string[] = [];
  lines.push('GLOSSARY (ALWAYS use these exact translations):');

  for (const e of sorted) {
    if (e.doNotTranslate) {
      lines.push(`- "${e.sourceTerm}" → keep as "${e.sourceTerm}"`);
    } else {
      const label = e.tier === 'locked' ? ' [MUST]' : '';
      lines.push(`- "${e.sourceTerm}" → "${e.targetTerm}"${label}`);
    }
  }

  // Aggiorna usage count
  for (const e of sorted) {
    e.usageCount++;
  }
  saveGlossary(glossary);

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// CONSISTENCY CHECK
// ═══════════════════════════════════════════════════════════════════

export interface ConsistencyIssue {
  termId: string;
  sourceTerm: string;
  expectedTarget: string;
  foundInTranslation: string;
  tier: GlossaryTier;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Verifica consistenza tra traduzioni e glossario
 */
export function checkConsistency(
  gameId: string,
  translations: Array<{ source: string; translated: string }>
): ConsistencyIssue[] {
  const glossary = loadGlossary(gameId);
  if (!glossary) return [];

  const issues: ConsistencyIssue[] = [];

  for (const { source, translated } of translations) {
    const srcLower = source.toLowerCase();
    const transLower = translated.toLowerCase();

    for (const entry of glossary.entries) {
      // Controlla se il termine source è nel testo originale
      if (!srcLower.includes(entry.sourceTerm.toLowerCase())) continue;

      // Controlla se la traduzione corretta è nella traduzione
      const expected = entry.doNotTranslate
        ? entry.sourceTerm.toLowerCase()
        : entry.targetTerm.toLowerCase();

      if (!transLower.includes(expected)) {
        const severity = entry.tier === 'locked' ? 'error'
          : entry.tier === 'synced' ? 'warning'
          : 'info';

        issues.push({
          termId: entry.id,
          sourceTerm: entry.sourceTerm,
          expectedTarget: entry.doNotTranslate ? entry.sourceTerm : entry.targetTerm,
          foundInTranslation: translated,
          tier: entry.tier,
          severity,
        });
      }
    }
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════════

/**
 * Esporta glossario in formato CSV
 */
export function exportToCsv(gameId: string): string {
  const glossary = loadGlossary(gameId);
  if (!glossary) return '';

  const header = 'source,target,tier,category,doNotTranslate,context';
  const rows = glossary.entries.map(e =>
    `"${e.sourceTerm}","${e.targetTerm}","${e.tier}","${e.category}",${e.doNotTranslate},"${e.context || ''}"`
  );

  return [header, ...rows].join('\n');
}

/**
 * Importa termini da CSV
 */
export function importFromCsv(gameId: string, csvContent: string): number {
  const glossary = loadGlossary(gameId);
  if (!glossary) return 0;

  const lines = csvContent.split('\n').slice(1); // Skip header
  let imported = 0;

  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2 || !parts[0] || !parts[1]) continue;

    const exists = glossary.entries.find(
      e => e.sourceTerm.toLowerCase() === parts[0].toLowerCase()
    );
    if (exists) continue;

    glossary.entries.push({
      id: generateId(),
      sourceTerm: parts[0],
      targetTerm: parts[1],
      tier: normalizeTier(parts[2] || '', normalizeCategory(parts[3] || '')),
      category: normalizeCategory(parts[3] || ''),
      doNotTranslate: parts[4] === 'true',
      context: parts[5] || undefined,
      caseSensitive: true,
      confidence: 80,
      autoExtracted: false,
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    imported++;
  }

  saveGlossary(glossary);
  return imported;
}

/**
 * Esporta glossario in formato JSON
 */
export function exportToJson(gameId: string): string {
  const glossary = loadGlossary(gameId);
  if (!glossary) return '{}';
  return JSON.stringify(glossary, null, 2);
}

/**
 * Importa glossario da JSON
 */
export function importFromJson(gameId: string, jsonContent: string): number {
  try {
    const data = JSON.parse(jsonContent) as AutoGlossary;
    if (!data.entries || !Array.isArray(data.entries)) return 0;

    let glossary = loadGlossary(gameId);
    if (!glossary) return 0;

    let imported = 0;
    for (const entry of data.entries) {
      const exists = glossary.entries.find(
        e => e.sourceTerm.toLowerCase() === entry.sourceTerm.toLowerCase()
      );
      if (exists) continue;

      glossary.entries.push({
        ...entry,
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      imported++;
    }

    saveGlossary(glossary);
    return imported;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT TERMS
// ═══════════════════════════════════════════════════════════════════

/**
 * Aggiunge termini di default comuni per i videogiochi
 */
export function addDefaultTerms(
  gameId: string,
  targetLang: string,
  genre?: string
): number {
  const glossary = loadGlossary(gameId);
  if (!glossary) return 0;

  const defaults = getDefaultTerms(targetLang, genre);
  let added = 0;

  for (const term of defaults) {
    const exists = glossary.entries.find(
      e => e.sourceTerm.toLowerCase() === term.sourceTerm.toLowerCase()
    );
    if (exists) continue;

    glossary.entries.push({
      ...term,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    added++;
  }

  saveGlossary(glossary);
  return added;
}

function getDefaultTerms(
  targetLang: string,
  genre?: string
): Omit<AutoGlossaryEntry, 'id' | 'createdAt' | 'updatedAt'>[] {
  const isItalian = targetLang === 'it' || targetLang === 'ita';

  const common: Omit<AutoGlossaryEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { sourceTerm: 'Save', targetTerm: isItalian ? 'Salva' : 'Save', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
    { sourceTerm: 'Load', targetTerm: isItalian ? 'Carica' : 'Load', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
    { sourceTerm: 'Settings', targetTerm: isItalian ? 'Impostazioni' : 'Settings', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
    { sourceTerm: 'Quit', targetTerm: isItalian ? 'Esci' : 'Quit', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
    { sourceTerm: 'New Game', targetTerm: isItalian ? 'Nuova Partita' : 'New Game', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
    { sourceTerm: 'Continue', targetTerm: isItalian ? 'Continua' : 'Continue', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
    { sourceTerm: 'Options', targetTerm: isItalian ? 'Opzioni' : 'Options', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
    { sourceTerm: 'Exit', targetTerm: isItalian ? 'Esci' : 'Exit', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 90, autoExtracted: false, usageCount: 0 },
  ];

  if (genre === 'RPG' || genre === 'rpg') {
    common.push(
      { sourceTerm: 'HP', targetTerm: isItalian ? 'PV' : 'HP', tier: 'synced', category: 'system', context: isItalian ? 'Punti Vita' : 'Hit Points', doNotTranslate: false, caseSensitive: true, confidence: 95, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'MP', targetTerm: isItalian ? 'PM' : 'MP', tier: 'synced', category: 'system', context: isItalian ? 'Punti Mana' : 'Magic Points', doNotTranslate: false, caseSensitive: true, confidence: 95, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'XP', targetTerm: isItalian ? 'PE' : 'XP', tier: 'synced', category: 'system', context: isItalian ? 'Punti Esperienza' : 'Experience Points', doNotTranslate: false, caseSensitive: true, confidence: 90, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'Inventory', targetTerm: isItalian ? 'Inventario' : 'Inventory', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'Quest', targetTerm: isItalian ? 'Missione' : 'Quest', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 90, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'Party', targetTerm: isItalian ? 'Gruppo' : 'Party', tier: 'flexible', category: 'system', doNotTranslate: false, caseSensitive: false, confidence: 85, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'Dungeon', targetTerm: 'Dungeon', tier: 'locked', category: 'location', doNotTranslate: true, caseSensitive: false, confidence: 90, autoExtracted: false, usageCount: 0 },
    );
  }

  if (genre === 'VN' || genre === 'vn' || genre === 'Visual Novel') {
    common.push(
      { sourceTerm: 'Chapter', targetTerm: isItalian ? 'Capitolo' : 'Chapter', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'Skip', targetTerm: isItalian ? 'Salta' : 'Skip', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 95, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'Auto', targetTerm: 'Auto', tier: 'synced', category: 'ui', doNotTranslate: true, caseSensitive: false, confidence: 90, autoExtracted: false, usageCount: 0 },
      { sourceTerm: 'Backlog', targetTerm: isItalian ? 'Cronologia' : 'Backlog', tier: 'synced', category: 'ui', doNotTranslate: false, caseSensitive: false, confidence: 90, autoExtracted: false, usageCount: 0 },
    );
  }

  return common;
}
