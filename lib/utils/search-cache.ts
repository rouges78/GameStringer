/**
 * Search Cache System for improved game search performance
 * Uses LRU cache with trigram indexing for fast fuzzy matching
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

interface TrigramIndex {
  trigram: string;
  ids: Set<string>;
}

export class SearchCache<T extends { id: string; name: string }> {
  private cache: Map<string, CacheEntry<T[]>> = new Map();
  private trigramIndex: Map<string, Set<string>> = new Map();
  private items: Map<string, T> = new Map();
  private maxCacheSize: number;
  private cacheTTL: number;

  constructor(options: { maxCacheSize?: number; cacheTTL?: number } = {}) {
    this.maxCacheSize = options.maxCacheSize ?? 100;
    this.cacheTTL = options.cacheTTL ?? 5 * 60 * 1000; // 5 minuti default
  }

  /**
   * Build trigram index for fast prefix/substring matching
   */
  buildIndex(items: T[]): void {
    this.items.clear();
    this.trigramIndex.clear();

    for (const item of items) {
      this.items.set(item.id, item);
      const trigrams = this.generateTrigrams(item.name.toLowerCase());
      
      for (const trigram of trigrams) {
        if (!this.trigramIndex.has(trigram)) {
          this.trigramIndex.set(trigram, new Set());
        }
        this.trigramIndex.get(trigram)!.add(item.id);
      }
    }
  }

  /**
   * Generate trigrams from a string
   */
  private generateTrigrams(str: string): string[] {
    const trigrams: string[] = [];
    const padded = `  ${str}  `;
    
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.push(padded.substring(i, i + 3));
    }
    
    return trigrams;
  }

  /**
   * Fast search using trigram index
   */
  search(query: string, limit: number = 20): T[] {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Check cache first
    const cached = this.getFromCache(normalizedQuery);
    if (cached) return cached.slice(0, limit);

    // Find candidates using trigram index
    const queryTrigrams = this.generateTrigrams(normalizedQuery);
    const candidateScores = new Map<string, number>();

    for (const trigram of queryTrigrams) {
      const matchingIds = this.trigramIndex.get(trigram);
      if (matchingIds) {
        for (const id of matchingIds) {
          candidateScores.set(id, (candidateScores.get(id) ?? 0) + 1);
        }
      }
    }

    // Score and rank candidates
    const results: Array<{ item: T; score: number }> = [];
    
    for (const [id, trigramHits] of candidateScores) {
      const item = this.items.get(id);
      if (!item) continue;

      const name = item.name.toLowerCase();
      let score = trigramHits / queryTrigrams.length;

      // Boost exact prefix match
      if (name.startsWith(normalizedQuery)) {
        score += 2;
      }
      // Boost contains match
      else if (name.includes(normalizedQuery)) {
        score += 1;
      }
      // Boost word boundary match
      else if (name.split(/\s+/).some(word => word.startsWith(normalizedQuery))) {
        score += 0.5;
      }

      results.push({ item, score });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    const finalResults = results.map(r => r.item);
    
    // Cache results
    this.addToCache(normalizedQuery, finalResults);
    
    return finalResults.slice(0, limit);
  }

  /**
   * Get from cache if valid
   */
  private getFromCache(key: string): T[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.value;
  }

  /**
   * Add to cache with LRU eviction
   */
  private addToCache(key: string, value: T[]): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxCacheSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): { cacheSize: number; indexSize: number; itemCount: number } {
    return {
      cacheSize: this.cache.size,
      indexSize: this.trigramIndex.size,
      itemCount: this.items.size
    };
  }
}

// Singleton instance for game search
let gameSearchCache: SearchCache<{ id: string; name: string }> | null = null;

export function getGameSearchCache(): SearchCache<{ id: string; name: string }> {
  if (!gameSearchCache) {
    gameSearchCache = new SearchCache({ maxCacheSize: 200, cacheTTL: 10 * 60 * 1000 });
  }
  return gameSearchCache;
}

/**
 * Debounce utility for search input
 */
export function debounce<T extends (...args: unknown[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Memoize search results
 */
export function memoizeSearch<T>(
  fn: (query: string) => T,
  maxSize: number = 50
): (query: string) => T {
  const cache = new Map<string, T>();
  
  return (query: string) => {
    if (cache.has(query)) {
      return cache.get(query)!;
    }
    
    const result = fn(query);
    
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    
    cache.set(query, result);
    return result;
  };
}

export default SearchCache;
