// 🚀 Cache Manager per GameStringer - Performance Optimization
// Gestisce cache intelligente per API calls e dati computazionalmente costosi

import React from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheStats {
  hits: number;
  misses: number;
  totalEntries: number;
  hitRate: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = { hits: 0, misses: 0 };

  // 🔧 Configura TTL default per diversi tipi di dati
  private readonly defaultTTLs = {
    'steam-games': 15 * 60 * 1000,      // 15 minuti
    'store-connection': 5 * 60 * 1000,   // 5 minuti  
    'game-details': 30 * 60 * 1000,     // 30 minuti
    'translations': 60 * 60 * 1000,     // 1 ora
    'dashboard-stats': 2 * 60 * 1000,   // 2 minuti
  };

  // 🔒 Ottiene dati dalla cache se validi
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Controlla se è scaduto
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  // 💾 Salva dati in cache con TTL automatico o personalizzato
  set<T>(key: string, data: T, customTTL?: number): void {
    const ttl = customTTL || this.getDefaultTTL(key);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // 🧹 Rimuove entry specifica
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // 🧹 Pulisce cache scadute
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  // 🧹 Pulisce tutta la cache
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  // 📊 Statistiche cache
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      totalEntries: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  // 🔧 Ottiene TTL default basato sul prefisso della chiave
  private getDefaultTTL(key: string): number {
    for (const [prefix, ttl] of Object.entries(this.defaultTTLs)) {
      if (key.startsWith(prefix)) {
        return ttl;
      }
    }
    return 5 * 60 * 1000; // Default 5 minuti
  }

  // 🚀 Wrapper per funzioni async con cache automatica
  async cached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Prova prima dalla cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch data e salva in cache
    try {
      const data = await fetcher();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      // Non cachare errori
      throw error;
    }
  }

  // 🔄 Invalida cache per pattern
  invalidatePattern(pattern: string): number {
    let removedCount = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }
}

// 🌟 Singleton globale
export const cacheManager = new CacheManager();

// 🧹 Auto-cleanup ogni 5 minuti
if (typeof window !== 'undefined') {
  setInterval(() => {
    const removed = cacheManager.cleanup();
    if (removed > 0) {
      console.log(`🧹 Cache cleanup: rimossi ${removed} entry scaduti`);
    }
  }, 5 * 60 * 1000);
}

// 🔧 Utility hooks per React
export const useCacheStats = () => {
  const [stats, setStats] = React.useState<CacheStats>(cacheManager.getStats());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(cacheManager.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return stats;
};

// 📊 Debug cache in sviluppo
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).gameStringerCache = cacheManager;
  console.log('🔧 GameStringer Cache Manager disponibile in window.gameStringerCache');
}