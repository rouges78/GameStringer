/**
 * Offline Translation Cache
 * Salva traduzioni in localStorage per uso offline
 */

const CACHE_KEY = 'gs_translation_cache';
const CACHE_VERSION = 1;
const MAX_ENTRIES = 10000;
const MAX_AGE_DAYS = 30;

interface CachedTranslation {
  source: string;
  target: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  provider?: string;
}

interface CacheData {
  version: number;
  entries: Map<string, CachedTranslation>;
}

// Generate cache key from translation params
function getCacheKey(text: string, sourceLang: string, targetLang: string): string {
  return `${sourceLang}:${targetLang}:${text.substring(0, 100)}`;
}

// Load cache from localStorage
function loadCache(): CacheData {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return { version: CACHE_VERSION, entries: new Map() };
    }
    
    const parsed = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION) {
      // Version mismatch, clear cache
      return { version: CACHE_VERSION, entries: new Map() };
    }
    
    return {
      version: CACHE_VERSION,
      entries: new Map(Object.entries(parsed.entries || {})),
    };
  } catch {
    return { version: CACHE_VERSION, entries: new Map() };
  }
}

// Save cache to localStorage
function saveCache(cache: CacheData): void {
  try {
    const data = {
      version: cache.version,
      entries: Object.fromEntries(cache.entries),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage might be full, try to clean up
    cleanupCache();
  }
}

// Clean up old entries
function cleanupCache(): void {
  const cache = loadCache();
  const now = Date.now();
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  
  // Remove old entries
  for (const [key, entry] of cache.entries) {
    if (now - entry.timestamp > maxAge) {
      cache.entries.delete(key);
    }
  }
  
  // If still too many, remove oldest
  if (cache.entries.size > MAX_ENTRIES) {
    const sorted = [...cache.entries.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = sorted.slice(0, sorted.length - MAX_ENTRIES);
    for (const [key] of toRemove) {
      cache.entries.delete(key);
    }
  }
  
  saveCache(cache);
}

/**
 * Offline Translation Cache API
 */
export const offlineCache = {
  /**
   * Get cached translation
   */
  get(text: string, sourceLang: string, targetLang: string): string | null {
    const cache = loadCache();
    const key = getCacheKey(text, sourceLang, targetLang);
    const entry = cache.entries.get(key);
    
    if (entry && entry.source === text) {
      return entry.target;
    }
    return null;
  },

  /**
   * Cache a translation
   */
  set(
    text: string,
    translation: string,
    sourceLang: string,
    targetLang: string,
    provider?: string
  ): void {
    const cache = loadCache();
    const key = getCacheKey(text, sourceLang, targetLang);
    
    cache.entries.set(key, {
      source: text,
      target: translation,
      sourceLang,
      targetLang,
      timestamp: Date.now(),
      provider,
    });
    
    saveCache(cache);
  },

  /**
   * Cache multiple translations
   */
  setMany(
    translations: Array<{
      source: string;
      target: string;
      sourceLang: string;
      targetLang: string;
    }>
  ): void {
    const cache = loadCache();
    
    for (const t of translations) {
      const key = getCacheKey(t.source, t.sourceLang, t.targetLang);
      cache.entries.set(key, {
        ...t,
        timestamp: Date.now(),
      });
    }
    
    saveCache(cache);
  },

  /**
   * Check if online
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },

  /**
   * Get cache stats
   */
  getStats(): { entries: number; size: string } {
    const cache = loadCache();
    const raw = localStorage.getItem(CACHE_KEY) || '';
    const sizeKB = (raw.length * 2) / 1024; // UTF-16 = 2 bytes per char
    
    return {
      entries: cache.entries.size,
      size: sizeKB < 1024 
        ? `${sizeKB.toFixed(1)} KB` 
        : `${(sizeKB / 1024).toFixed(1)} MB`,
    };
  },

  /**
   * Clear all cached translations
   */
  clear(): void {
    localStorage.removeItem(CACHE_KEY);
  },

  /**
   * Export cache for backup
   */
  export(): string {
    return localStorage.getItem(CACHE_KEY) || '{}';
  },

  /**
   * Import cache from backup
   */
  import(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.version && parsed.entries) {
        localStorage.setItem(CACHE_KEY, data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
};

/**
 * Hook for offline-aware translation
 */
export function useOfflineTranslation() {
  const translate = async (
    text: string,
    targetLang: string,
    sourceLang: string = 'en',
    options?: { forceOnline?: boolean }
  ): Promise<{ translation: string; fromCache: boolean }> => {
    // Try cache first (unless forced online)
    if (!options?.forceOnline) {
      const cached = offlineCache.get(text, sourceLang, targetLang);
      if (cached) {
        return { translation: cached, fromCache: true };
      }
    }

    // If offline and no cache, throw
    if (!offlineCache.isOnline()) {
      throw new Error('Offline e traduzione non in cache');
    }

    // Fetch from API
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLanguage: targetLang,
        sourceLanguage: sourceLang,
        provider: 'libre',
      }),
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const result = await response.json();
    const translation = result.translatedText;

    // Cache the result
    offlineCache.set(text, translation, sourceLang, targetLang, 'libre');

    return { translation, fromCache: false };
  };

  return { translate, cache: offlineCache };
}

export default offlineCache;
