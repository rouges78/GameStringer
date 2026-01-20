/**
 * # Translation History
 * 
 * Sistema di storico traduzioni per tracciare tutte le traduzioni effettuate.
 * Permette di vedere statistiche, esportare e reimportare traduzioni.
 */

export interface TranslationRecord {
  id: string;
  source: string;
  target: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: 'claude' | 'openai' | 'gemini' | 'deepl' | 'local';
  tool: 'neural' | 'ocr' | 'ue' | 'unity';
  gameId?: string;
  gameName?: string;
  tokensUsed?: number;
  cost?: number;
  duration?: number;        // ms
  timestamp: number;
  cached?: boolean;         // Era in cache?
}

export interface TranslationStats {
  totalTranslations: number;
  totalWords: number;
  totalCharacters: number;
  totalTokens: number;
  totalCost: number;
  totalDuration: number;
  byProvider: Record<string, number>;
  byTool: Record<string, number>;
  byLanguage: Record<string, number>;
  byGame: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
}

const STORAGE_KEY = 'gamestringer_translation_history';
const MAX_HISTORY_SIZE = 10000; // Max records da tenere

class TranslationHistoryManager {
  private records: TranslationRecord[] = [];
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.records = JSON.parse(stored);
      }
      this.initialized = true;
    } catch (e) {
      console.error('[HISTORY] Errore init:', e);
      this.records = [];
    }
  }

  private save(): void {
    try {
      // Mantieni solo gli ultimi MAX_HISTORY_SIZE records
      if (this.records.length > MAX_HISTORY_SIZE) {
        this.records = this.records.slice(-MAX_HISTORY_SIZE);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch (e) {
      console.error('[HISTORY] Errore save:', e);
    }
  }

  private generateId(): string {
    return `th_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // === RECORD MANAGEMENT ===

  addRecord(data: Omit<TranslationRecord, 'id' | 'timestamp'>): TranslationRecord {
    const record: TranslationRecord = {
      ...data,
      id: this.generateId(),
      timestamp: Date.now(),
    };
    
    this.records.push(record);
    this.save();
    return record;
  }

  getRecords(options?: {
    limit?: number;
    offset?: number;
    tool?: string;
    provider?: string;
    gameId?: string;
    startDate?: number;
    endDate?: number;
  }): TranslationRecord[] {
    let filtered = [...this.records];
    
    if (options?.tool) {
      filtered = filtered.filter(r => r.tool === options.tool);
    }
    if (options?.provider) {
      filtered = filtered.filter(r => r.provider === options.provider);
    }
    if (options?.gameId) {
      filtered = filtered.filter(r => r.gameId === options.gameId);
    }
    if (options?.startDate) {
      filtered = filtered.filter(r => r.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      filtered = filtered.filter(r => r.timestamp <= options.endDate!);
    }
    
    // Ordina per timestamp decrescente (più recenti prima)
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    
    return filtered.slice(offset, offset + limit);
  }

  getRecord(id: string): TranslationRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  deleteRecord(id: string): boolean {
    const index = this.records.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    this.records.splice(index, 1);
    this.save();
    return true;
  }

  clearHistory(): void {
    this.records = [];
    this.save();
  }

  // === STATISTICS ===

  getStats(options?: { 
    startDate?: number; 
    endDate?: number;
    gameId?: string;
  }): TranslationStats {
    let filtered = [...this.records];
    
    if (options?.startDate) {
      filtered = filtered.filter(r => r.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      filtered = filtered.filter(r => r.timestamp <= options.endDate!);
    }
    if (options?.gameId) {
      filtered = filtered.filter(r => r.gameId === options.gameId);
    }
    
    const stats: TranslationStats = {
      totalTranslations: filtered.length,
      totalWords: 0,
      totalCharacters: 0,
      totalTokens: 0,
      totalCost: 0,
      totalDuration: 0,
      byProvider: {},
      byTool: {},
      byLanguage: {},
      byGame: {},
      cacheHits: 0,
      cacheMisses: 0,
    };
    
    for (const record of filtered) {
      // Conta parole e caratteri
      stats.totalWords += record.source.split(/\s+/).length;
      stats.totalCharacters += record.source.length;
      stats.totalTokens += record.tokensUsed || 0;
      stats.totalCost += record.cost || 0;
      stats.totalDuration += record.duration || 0;
      
      // By provider
      stats.byProvider[record.provider] = (stats.byProvider[record.provider] || 0) + 1;
      
      // By tool
      stats.byTool[record.tool] = (stats.byTool[record.tool] || 0) + 1;
      
      // By language
      const langPair = `${record.sourceLanguage}→${record.targetLanguage}`;
      stats.byLanguage[langPair] = (stats.byLanguage[langPair] || 0) + 1;
      
      // By game
      if (record.gameName) {
        stats.byGame[record.gameName] = (stats.byGame[record.gameName] || 0) + 1;
      }
      
      // Cache
      if (record.cached) {
        stats.cacheHits++;
      } else {
        stats.cacheMisses++;
      }
    }
    
    return stats;
  }

  getTodayStats(): TranslationStats {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.getStats({ startDate: today.getTime() });
  }

  getWeekStats(): TranslationStats {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.getStats({ startDate: weekAgo });
  }

  getMonthStats(): TranslationStats {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.getStats({ startDate: monthAgo });
  }

  // === EXPORT/IMPORT ===

  exportHistory(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'source', 'target', 'sourceLanguage', 'targetLanguage', 'provider', 'tool', 'gameName'];
      const rows = this.records.map(r => [
        new Date(r.timestamp).toISOString(),
        `"${r.source.replace(/"/g, '""')}"`,
        `"${r.target.replace(/"/g, '""')}"`,
        r.sourceLanguage,
        r.targetLanguage,
        r.provider,
        r.tool,
        r.gameName || '',
      ].join(','));
      
      return [headers.join(','), ...rows].join('\n');
    }
    
    return JSON.stringify(this.records, null, 2);
  }

  importHistory(data: string, format: 'json' | 'csv' = 'json'): number {
    try {
      let imported: TranslationRecord[] = [];
      
      if (format === 'json') {
        imported = JSON.parse(data);
      } else {
        // Parse CSV (basic)
        const lines = data.split('\n').slice(1); // Skip header
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 7) {
            imported.push({
              id: this.generateId(),
              timestamp: new Date(parts[0]).getTime(),
              source: parts[1].replace(/^"|"$/g, '').replace(/""/g, '"'),
              target: parts[2].replace(/^"|"$/g, '').replace(/""/g, '"'),
              sourceLanguage: parts[3],
              targetLanguage: parts[4],
              provider: parts[5] as any,
              tool: parts[6] as any,
              gameName: parts[7] || undefined,
            });
          }
        }
      }
      
      // Aggiungi nuovi records (evita duplicati per timestamp+source)
      const existingKeys = new Set(this.records.map(r => `${r.timestamp}_${r.source}`));
      let added = 0;
      
      for (const record of imported) {
        const key = `${record.timestamp}_${record.source}`;
        if (!existingKeys.has(key)) {
          record.id = this.generateId(); // Nuovo ID
          this.records.push(record);
          existingKeys.add(key);
          added++;
        }
      }
      
      this.save();
      return added;
    } catch (e) {
      console.error('[HISTORY] Errore import:', e);
      return 0;
    }
  }

  // === SEARCH ===

  search(query: string, limit = 50): TranslationRecord[] {
    const lowerQuery = query.toLowerCase();
    return this.records
      .filter(r => 
        r.source.toLowerCase().includes(lowerQuery) ||
        r.target.toLowerCase().includes(lowerQuery) ||
        r.gameName?.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

// Singleton
export const translationHistory = new TranslationHistoryManager();

// Helper per formattare costi
export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

// Helper per formattare durata
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}
