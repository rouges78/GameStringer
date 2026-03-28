/**
 * Translation Fallback System
 * Gestisce fallback locale quando le API sono in rate limit
 */

interface CachedTranslation {
  original: string;
  translated: string;
  provider: string;
  timestamp: number;
  confidence: number;
}

interface FallbackConfig {
  maxCacheSize: number;
  cacheExpiryMs: number;
  enableOfflineMode: boolean;
}

const DEFAULT_CONFIG: FallbackConfig = {
  maxCacheSize: 10000,
  cacheExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 giorni
  enableOfflineMode: true
};

const STORAGE_KEY = 'gameStringerTranslationCache';

class TranslationFallbackManager {
  private cache: Map<string, CachedTranslation> = new Map();
  private config: FallbackConfig;
  private rateLimitedProviders: Map<string, number> = new Map();

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  /**
   * Genera chiave cache da testo + lingua target
   */
  private getCacheKey(text: string, targetLang: string): string {
    return `${targetLang}:${text.toLowerCase().trim()}`;
  }

  /**
   * Cerca traduzione in cache
   */
  getCachedTranslation(text: string, targetLang: string): CachedTranslation | null {
    const key = this.getCacheKey(text, targetLang);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Verifica scadenza
    if (Date.now() - cached.timestamp > this.config.cacheExpiryMs) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Salva traduzione in cache
   */
  cacheTranslation(
    original: string,
    translated: string,
    targetLang: string,
    provider: string,
    confidence: number = 0.9
  ): void {
    const key = this.getCacheKey(original, targetLang);

    this.cache.set(key, {
      original,
      translated,
      provider,
      timestamp: Date.now(),
      confidence
    });

    // Limita dimensione cache
    if (this.cache.size > this.config.maxCacheSize) {
      this.pruneOldestEntries();
    }

    this.saveToStorage();
  }

  /**
   * Rimuove le entry più vecchie
   */
  private pruneOldestEntries(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, Math.floor(this.config.maxCacheSize * 0.2));
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  /**
   * Segna provider come rate limited
   */
  markRateLimited(provider: string, retryAfterMs: number = 60000): void {
    this.rateLimitedProviders.set(provider, Date.now() + retryAfterMs);
    console.log(`⏳ Provider ${provider} rate limited per ${retryAfterMs / 1000}s`);
  }

  /**
   * Controlla se provider è in rate limit
   */
  isRateLimited(provider: string): boolean {
    const until = this.rateLimitedProviders.get(provider);
    if (!until) return false;

    if (Date.now() > until) {
      this.rateLimitedProviders.delete(provider);
      return false;
    }

    return true;
  }

  /**
   * Tempo rimanente rate limit
   */
  getRateLimitRemaining(provider: string): number {
    const until = this.rateLimitedProviders.get(provider);
    if (!until) return 0;
    return Math.max(0, until - Date.now());
  }

  /**
   * Suggerisce provider alternativo non in rate limit
   */
  suggestAlternativeProvider(currentProvider: string): string | null {
    const providers = ['gemini', 'openai', 'claude', 'deepseek', 'ollama'];
    
    for (const provider of providers) {
      if (provider !== currentProvider && !this.isRateLimited(provider)) {
        return provider;
      }
    }

    // Se tutti in rate limit, suggerisci Ollama (locale, no rate limit)
    return 'ollama';
  }

  /**
   * Traduzione batch con fallback cache
   */
  async translateWithFallback(
    texts: string[],
    targetLang: string,
    translateFn: (texts: string[]) => Promise<Array<{ original: string; translated: string; confidence: number }>>,
    provider: string
  ): Promise<Array<{ original: string; translated: string; confidence: number; fromCache: boolean }>> {
    const results: Array<{ original: string; translated: string; confidence: number; fromCache: boolean }> = [];
    const textsToTranslate: string[] = [];
    const cacheHits: Map<number, CachedTranslation> = new Map();

    // Prima cerca in cache
    texts.forEach((text, index) => {
      const cached = this.getCachedTranslation(text, targetLang);
      if (cached) {
        cacheHits.set(index, cached);
      } else {
        textsToTranslate.push(text);
      }
    });

    console.log(`📦 Cache hits: ${cacheHits.size}/${texts.length}`);

    // Traduci solo testi non in cache
    let newTranslations: Array<{ original: string; translated: string; confidence: number }> = [];

    if (textsToTranslate.length > 0) {
      try {
        newTranslations = await translateFn(textsToTranslate);

        // Salva nuove traduzioni in cache
        newTranslations.forEach(t => {
          this.cacheTranslation(t.original, t.translated, targetLang, provider, t.confidence);
        });
      } catch (error: unknown) {
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('rate limit')) {
          // Rate limit - usa solo cache
          this.markRateLimited(provider, 60000);
          console.warn(`⚠️ Rate limit su ${provider}, usando solo cache`);

          // Ritorna cache hits + placeholder per non tradotti
          textsToTranslate.forEach(text => {
            newTranslations.push({
              original: text,
              translated: `[RATE_LIMIT] ${text}`,
              confidence: 0
            });
          });
        } else {
          throw error;
        }
      }
    }

    // Ricostruisci array risultati nell'ordine originale
    let newIndex = 0;
    texts.forEach((text, index) => {
      const cached = cacheHits.get(index);
      if (cached) {
        results.push({
          original: cached.original,
          translated: cached.translated,
          confidence: cached.confidence,
          fromCache: true
        });
      } else {
        results.push({
          ...newTranslations[newIndex],
          fromCache: false
        });
        newIndex++;
      }
    });

    return results;
  }

  /**
   * Carica cache da localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.cache = new Map(Object.entries(parsed));
        console.log(`📦 Caricata cache traduzioni: ${this.cache.size} entry`);
      }
    } catch (e) {
      console.warn('Errore caricamento cache traduzioni:', e);
    }
  }

  /**
   * Salva cache in localStorage
   */
  private saveToStorage(): void {
    try {
      const obj = Object.fromEntries(this.cache);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Errore salvataggio cache traduzioni:', e);
    }
  }

  /**
   * Pulisce cache
   */
  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Cache traduzioni pulita');
  }

  /**
   * Statistiche cache
   */
  getStats(): { size: number; providers: Record<string, number> } {
    const providers: Record<string, number> = {};
    
    this.cache.forEach(entry => {
      providers[entry.provider] = (providers[entry.provider] || 0) + 1;
    });

    return {
      size: this.cache.size,
      providers
    };
  }
}

// Singleton instance
export const translationFallback = new TranslationFallbackManager();

// Export per uso diretto
export { TranslationFallbackManager, type CachedTranslation, type FallbackConfig };
