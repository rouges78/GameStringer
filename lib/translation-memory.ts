/**
 * 🧠 Translation Memory System
 * 
 * Sistema professionale di memoria traduttiva per GameStringer.
 * Salva e riutilizza traduzioni per:
 * - Risparmiare costi API
 * - Garantire coerenza terminologica
 * - Velocizzare traduzioni ripetitive
 */

import { invoke } from '@/lib/tauri-api';

// ============================================================================
// TYPES
// ============================================================================

export interface TranslationUnit {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;           // Contesto (UI, Dialogo, etc.)
  gameId?: string;            // ID gioco associato
  provider: string;           // Provider usato (openai, deepl, etc.)
  confidence: number;         // Score di confidenza 0-1
  verified: boolean;          // Se verificato da umano
  usageCount: number;         // Quante volte è stata riutilizzata
  createdAt: string;
  updatedAt: string;
  metadata?: {
    characterLimit?: number;
    tags?: string[];
    notes?: string;
  };
}

export interface TranslationMemory {
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  units: TranslationUnit[];
  stats: TMStats;
  createdAt: string;
  updatedAt: string;
}

export interface TMStats {
  totalUnits: number;
  verifiedUnits: number;
  totalUsageCount: number;
  averageConfidence: number;
  byProvider: Record<string, number>;
  byContext: Record<string, number>;
}

export interface TMSearchResult {
  unit: TranslationUnit;
  matchType: 'exact' | 'fuzzy' | 'partial';
  similarity: number;  // 0-100
}

export interface TMSearchOptions {
  minSimilarity?: number;      // Default 70%
  maxResults?: number;         // Default 5
  preferVerified?: boolean;    // Preferisci traduzioni verificate
  contextFilter?: string;      // Filtra per contesto
  gameIdFilter?: string;       // Filtra per gioco
}

// ============================================================================
// SIMILARITY ALGORITHMS
// ============================================================================

/**
 * Calcola la distanza di Levenshtein tra due stringhe
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
}

/**
 * Calcola la similarità percentuale tra due stringhe (0-100)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Normalizza il testo per il confronto
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Normalizza spazi
    .replace(/[""'']/g, '"')        // Normalizza virgolette
    .replace(/[—–]/g, '-');         // Normalizza trattini
}

/**
 * Genera hash per lookup veloce
 */
function generateHash(text: string, sourceLang: string, targetLang: string): string {
  const normalized = normalizeText(text);
  // Simple hash for quick lookup
  let hash = 0;
  const str = `${normalized}|${sourceLang}|${targetLang}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// TRANSLATION MEMORY CLASS
// ============================================================================

export class TranslationMemoryManager {
  private memory: TranslationMemory | null = null;
  private hashIndex: Map<string, TranslationUnit> = new Map();
  private initialized = false;

  /**
   * Inizializza la Translation Memory
   */
  async initialize(sourceLang: string = 'en', targetLang: string = 'it'): Promise<void> {
    if (this.initialized && this.memory?.sourceLanguage === sourceLang && this.memory?.targetLanguage === targetLang) {
      return;
    }

    try {
      // Prova a caricare da Tauri
      const saved = await invoke<TranslationMemory | null>('load_translation_memory', {
        sourceLang,
        targetLang
      });

      if (saved) {
        this.memory = saved;
        this.rebuildIndex();
        console.log(`[TM] Caricata memoria con ${this.memory.units.length} unità`);
      } else {
        // Crea nuova memoria
        this.memory = {
          id: `tm_${sourceLang}_${targetLang}_${Date.now()}`,
          name: `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          units: [],
          stats: this.calculateStats([]),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        console.log('[TM] Creata nuova memoria traduttiva');
      }

      this.initialized = true;
    } catch (error) {
      console.error('[TM] Errore inizializzazione:', error);
      // Fallback a memoria locale
      this.memory = {
        id: `tm_${sourceLang}_${targetLang}_${Date.now()}`,
        name: `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        units: [],
        stats: this.calculateStats([]),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.initialized = true;
    }
  }

  /**
   * Ricostruisce l'indice hash per lookup veloce
   */
  private rebuildIndex(): void {
    this.hashIndex.clear();
    if (!this.memory) return;

    for (const unit of this.memory.units) {
      const hash = generateHash(
        unit.sourceText,
        unit.sourceLanguage,
        unit.targetLanguage
      );
      this.hashIndex.set(hash, unit);
    }
  }

  /**
   * Cerca nella Translation Memory
   */
  search(sourceText: string, options: TMSearchOptions = {}): TMSearchResult[] {
    if (!this.memory || !sourceText.trim()) return [];

    const {
      minSimilarity = 70,
      maxResults = 5,
      preferVerified = true,
      contextFilter,
      gameIdFilter
    } = options;

    const normalizedSource = normalizeText(sourceText);
    const results: TMSearchResult[] = [];

    // Prima cerca match esatto via hash
    const hash = generateHash(sourceText, this.memory.sourceLanguage, this.memory.targetLanguage);
    const exactMatch = this.hashIndex.get(hash);
    
    if (exactMatch) {
      results.push({
        unit: exactMatch,
        matchType: 'exact',
        similarity: 100
      });
    }

    // Poi cerca fuzzy matches
    for (const unit of this.memory.units) {
      // Salta se già trovato come esatto
      if (exactMatch && unit.id === exactMatch.id) continue;

      // Applica filtri
      if (contextFilter && unit.context !== contextFilter) continue;
      if (gameIdFilter && unit.gameId !== gameIdFilter) continue;

      const similarity = calculateSimilarity(sourceText, unit.sourceText);
      
      if (similarity >= minSimilarity) {
        results.push({
          unit,
          matchType: similarity === 100 ? 'exact' : similarity >= 90 ? 'fuzzy' : 'partial',
          similarity
        });
      }
    }

    // Ordina per similarità e preferenza verificato
    results.sort((a, b) => {
      if (preferVerified && a.unit.verified !== b.unit.verified) {
        return a.unit.verified ? -1 : 1;
      }
      return b.similarity - a.similarity;
    });

    return results.slice(0, maxResults);
  }

  /**
   * Cerca match esatto (veloce)
   */
  findExact(sourceText: string): TranslationUnit | null {
    if (!this.memory) return null;
    
    const hash = generateHash(sourceText, this.memory.sourceLanguage, this.memory.targetLanguage);
    return this.hashIndex.get(hash) || null;
  }

  /**
   * Aggiunge una nuova traduzione alla memoria
   */
  async add(
    sourceText: string,
    targetText: string,
    options: {
      context?: string;
      gameId?: string;
      provider?: string;
      confidence?: number;
      verified?: boolean;
      metadata?: TranslationUnit['metadata'];
    } = {}
  ): Promise<TranslationUnit> {
    if (!this.memory) {
      await this.initialize();
    }

    const now = new Date().toISOString();
    const unit: TranslationUnit = {
      id: `tu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceText: sourceText.trim(),
      targetText: targetText.trim(),
      sourceLanguage: this.memory!.sourceLanguage,
      targetLanguage: this.memory!.targetLanguage,
      context: options.context,
      gameId: options.gameId,
      provider: options.provider || 'manual',
      confidence: options.confidence ?? 0.9,
      verified: options.verified ?? false,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      metadata: options.metadata
    };

    // Controlla se esiste già
    const existing = this.findExact(sourceText);
    if (existing) {
      // Aggiorna esistente
      existing.targetText = targetText;
      existing.updatedAt = now;
      existing.confidence = Math.max(existing.confidence, unit.confidence);
      if (options.verified) existing.verified = true;
      await this.save();
      return existing;
    }

    // Aggiungi nuovo
    this.memory!.units.push(unit);
    
    // Aggiorna indice
    const hash = generateHash(sourceText, this.memory!.sourceLanguage, this.memory!.targetLanguage);
    this.hashIndex.set(hash, unit);

    // Aggiorna stats
    this.memory!.stats = this.calculateStats(this.memory!.units);
    this.memory!.updatedAt = now;

    await this.save();
    return unit;
  }

  /**
   * Aggiunge multiple traduzioni in batch
   */
  async addBatch(
    translations: Array<{
      source: string;
      target: string;
      context?: string;
      gameId?: string;
    }>,
    provider: string = 'batch',
    confidence: number = 0.85
  ): Promise<number> {
    if (!this.memory) {
      await this.initialize();
    }

    let added = 0;
    const now = new Date().toISOString();

    for (const t of translations) {
      const existing = this.findExact(t.source);
      if (existing) continue; // Salta duplicati

      const unit: TranslationUnit = {
        id: `tu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sourceText: t.source.trim(),
        targetText: t.target.trim(),
        sourceLanguage: this.memory!.sourceLanguage,
        targetLanguage: this.memory!.targetLanguage,
        context: t.context,
        gameId: t.gameId,
        provider,
        confidence,
        verified: false,
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      };

      this.memory!.units.push(unit);
      
      const hash = generateHash(t.source, this.memory!.sourceLanguage, this.memory!.targetLanguage);
      this.hashIndex.set(hash, unit);
      added++;
    }

    if (added > 0) {
      this.memory!.stats = this.calculateStats(this.memory!.units);
      this.memory!.updatedAt = now;
      await this.save();
    }

    console.log(`[TM] Aggiunte ${added} nuove traduzioni in batch`);
    return added;
  }

  /**
   * Incrementa il contatore di utilizzo
   */
  async incrementUsage(unitId: string): Promise<void> {
    if (!this.memory) return;

    const unit = this.memory.units.find(u => u.id === unitId);
    if (unit) {
      unit.usageCount++;
      unit.updatedAt = new Date().toISOString();
      this.memory.stats.totalUsageCount++;
      // Non salviamo subito per performance, si salverà al prossimo add o manualmente
    }
  }

  /**
   * Verifica una traduzione (human review)
   */
  async verify(unitId: string, correctedText?: string): Promise<void> {
    if (!this.memory) return;

    const unit = this.memory.units.find(u => u.id === unitId);
    if (unit) {
      unit.verified = true;
      if (correctedText) {
        unit.targetText = correctedText;
      }
      unit.confidence = 1.0;
      unit.updatedAt = new Date().toISOString();
      
      this.memory.stats = this.calculateStats(this.memory.units);
      await this.save();
    }
  }

  /**
   * Elimina una traduzione
   */
  async delete(unitId: string): Promise<void> {
    if (!this.memory) return;

    const index = this.memory.units.findIndex(u => u.id === unitId);
    if (index !== -1) {
      const unit = this.memory.units[index];
      const hash = generateHash(unit.sourceText, unit.sourceLanguage, unit.targetLanguage);
      this.hashIndex.delete(hash);
      this.memory.units.splice(index, 1);
      this.memory.stats = this.calculateStats(this.memory.units);
      await this.save();
    }
  }

  /**
   * Calcola statistiche
   */
  private calculateStats(units: TranslationUnit[]): TMStats {
    const byProvider: Record<string, number> = {};
    const byContext: Record<string, number> = {};
    let totalConfidence = 0;
    let verifiedCount = 0;
    let totalUsage = 0;

    for (const unit of units) {
      byProvider[unit.provider] = (byProvider[unit.provider] || 0) + 1;
      if (unit.context) {
        byContext[unit.context] = (byContext[unit.context] || 0) + 1;
      }
      totalConfidence += unit.confidence;
      if (unit.verified) verifiedCount++;
      totalUsage += unit.usageCount;
    }

    return {
      totalUnits: units.length,
      verifiedUnits: verifiedCount,
      totalUsageCount: totalUsage,
      averageConfidence: units.length > 0 ? totalConfidence / units.length : 0,
      byProvider,
      byContext
    };
  }

  /**
   * Salva la memoria su disco
   */
  async save(): Promise<void> {
    if (!this.memory) {
      console.warn('[TM] Tentativo di salvataggio senza memoria inizializzata');
      return;
    }

    try {
      console.log('[TM] Inizio processo di salvataggio...');

      // Calcola statistiche fresche per sicurezza
      const calculatedStats = this.calculateStats(this.memory.units);

      // Costruisci payload esplicito
      const memoryPayload = {
        id: String(this.memory.id),
        name: String(this.memory.name),
        sourceLanguage: String(this.memory.sourceLanguage),
        targetLanguage: String(this.memory.targetLanguage),
        units: this.memory.units,
        stats: {
          totalUnits: Number(calculatedStats.totalUnits),
          verifiedUnits: Number(calculatedStats.verifiedUnits),
          totalUsageCount: Number(calculatedStats.totalUsageCount),
          averageConfidence: Number(calculatedStats.averageConfidence),
          byProvider: calculatedStats.byProvider || {},
          byContext: calculatedStats.byContext || {}
        },
        createdAt: this.memory.createdAt,
        updatedAt: new Date().toISOString()
      };

      console.log('[TM] Payload pronto. Stats:', JSON.stringify(memoryPayload.stats));

      await invoke('save_translation_memory', {
        memory: memoryPayload
      });
      
      console.log(`[TM] ✅ Salvataggio completato con successo (${this.memory.units.length} unità)`);
      
      // Aggiorna stato locale
      this.memory.updatedAt = memoryPayload.updatedAt;
      this.memory.stats = calculatedStats;
      
    } catch (error) {
      console.error('[TM] ❌ CRITICAL ERROR saving memory:', error);
      
      // Fallback: salva in localStorage
      try {
        const key = `tm_${this.memory.sourceLanguage}_${this.memory.targetLanguage}`;
        localStorage.setItem(key, JSON.stringify(this.memory));
        console.log(`[TM] ✅ Salvato in localStorage come fallback (key: ${key})`);
      } catch (e) {
        console.error('[TM] Fallback localStorage fallito:', e);
      }
    }
  }

  /**
   * Esporta la memoria in formato standard
   */
  export(): TranslationMemory | null {
    return this.memory;
  }

  /**
   * Importa una memoria esistente
   */
  async import(data: TranslationMemory): Promise<void> {
    this.memory = data;
    this.rebuildIndex();
    await this.save();
    console.log(`[TM] Importata memoria con ${data.units.length} unità`);
  }

  /**
   * Ottieni statistiche
   */
  getStats(): TMStats | null {
    return this.memory?.stats || null;
  }

  /**
   * Ottieni tutte le unità (per UI)
   */
  getAllUnits(): TranslationUnit[] {
    return this.memory?.units || [];
  }

  /**
   * Cerca unità per testo
   */
  searchUnits(query: string): TranslationUnit[] {
    if (!this.memory || !query.trim()) return [];
    
    const q = query.toLowerCase();
    return this.memory.units.filter(u => 
      u.sourceText.toLowerCase().includes(q) ||
      u.targetText.toLowerCase().includes(q)
    );
  }
}

// Singleton instance
export const translationMemory = new TranslationMemoryManager();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Traduce con supporto Translation Memory
 * Cerca prima nella TM, poi chiama l'API se necessario
 */
export async function translateWithMemory(
  text: string,
  options: {
    sourceLang?: string;
    targetLang?: string;
    context?: string;
    gameId?: string;
    provider?: string;
    apiKey?: string;
    forceApi?: boolean;  // Forza chiamata API anche se c'è match TM
  } = {}
): Promise<{
  translation: string;
  source: 'memory' | 'api';
  confidence: number;
  similarity?: number;
  unit?: TranslationUnit;
}> {
  const {
    sourceLang = 'en',
    targetLang = 'it',
    context,
    gameId,
    provider = 'openai',
    forceApi = false
  } = options;

  // Inizializza TM se necessario
  await translationMemory.initialize(sourceLang, targetLang);

  // Cerca nella TM (se non forzato API)
  if (!forceApi) {
    const results = translationMemory.search(text, {
      minSimilarity: 95,  // Solo match molto simili
      maxResults: 1,
      preferVerified: true,
      contextFilter: context,
      gameIdFilter: gameId
    });

    if (results.length > 0 && results[0].similarity >= 95) {
      const match = results[0];
      // Incrementa uso
      await translationMemory.incrementUsage(match.unit.id);
      
      console.log(`[TM] Match trovato (${match.similarity}%): "${text}" → "${match.unit.targetText}"`);
      
      return {
        translation: match.unit.targetText,
        source: 'memory',
        confidence: match.unit.confidence,
        similarity: match.similarity,
        unit: match.unit
      };
    }
  }

  // Chiama API per traduzione
  console.log(`[TM] Nessun match, chiamo API ${provider}`);
  
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang,
      provider,
      context,
      apiKey: options.apiKey // Passa l'API key dall'interfaccia
    })
  });

  if (!response.ok) {
    throw new Error(`Errore traduzione: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Salva in TM per uso futuro
  const unit = await translationMemory.add(text, data.translatedText, {
    context,
    gameId,
    provider,
    confidence: data.confidence || 0.85
  });

  return {
    translation: data.translatedText,
    source: 'api',
    confidence: data.confidence || 0.85,
    unit
  };
}

/**
 * Traduce un batch di testi con supporto TM
 */
export async function translateBatchWithMemory(
  texts: string[],
  options: {
    sourceLang?: string;
    targetLang?: string;
    context?: string;
    gameId?: string;
    provider?: string;
    onProgress?: (current: number, total: number, fromMemory: number) => void;
  } = {}
): Promise<{
  translations: Array<{ source: string; target: string; fromMemory: boolean }>;
  stats: { total: number; fromMemory: number; fromApi: number; saved: string };
}> {
  const {
    sourceLang = 'en',
    targetLang = 'it',
    context,
    gameId,
    provider = 'openai',
    onProgress
  } = options;

  await translationMemory.initialize(sourceLang, targetLang);

  const translations: Array<{ source: string; target: string; fromMemory: boolean }> = [];
  let fromMemory = 0;
  let fromApi = 0;

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    
    try {
      const result = await translateWithMemory(text, {
        sourceLang,
        targetLang,
        context,
        gameId,
        provider
      });

      translations.push({
        source: text,
        target: result.translation,
        fromMemory: result.source === 'memory'
      });

      if (result.source === 'memory') {
        fromMemory++;
      } else {
        fromApi++;
      }
    } catch (error) {
      console.error(`[TM] Errore traduzione "${text}":`, error);
      translations.push({
        source: text,
        target: text, // Fallback: testo originale
        fromMemory: false
      });
    }

    onProgress?.(i + 1, texts.length, fromMemory);
  }

  // Calcola risparmio stimato
  const estimatedCostPerWord = 0.00002; // ~$20 per 1M tokens
  const wordsFromMemory = translations
    .filter(t => t.fromMemory)
    .reduce((sum, t) => sum + t.source.split(/\s+/).length, 0);
  const savedAmount = (wordsFromMemory * estimatedCostPerWord).toFixed(4);

  return {
    translations,
    stats: {
      total: texts.length,
      fromMemory,
      fromApi,
      saved: `$${savedAmount}`
    }
  };
}
