/**
 * Sistema di cache per metadati profili per ottimizzare le performance di startup
 */

export interface ProfileMetadata {
  id: string;
  name: string;
  avatar?: string;
  lastAccess: number;
  isLocked: boolean;
  hasCredentials: boolean;
  settingsVersion: number;
}

export interface ProfileCache {
  profiles: ProfileMetadata[];
  lastUpdate: number;
  version: string;
}

class ProfileCacheManager {
  private cache: ProfileCache | null = null;
  private readonly CACHE_KEY = 'profile_metadata_cache';
  private readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minuti
  private readonly CACHE_VERSION = '1.0.0';

  /**
   * Carica la cache dal localStorage
   */
  private loadFromStorage(): ProfileCache | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const parsed: ProfileCache = JSON.parse(cached);
      
      // Verifica versione cache
      if (parsed.version !== this.CACHE_VERSION) {
        this.clearCache();
        return null;
      }

      // Verifica scadenza
      if (Date.now() - parsed.lastUpdate > this.CACHE_EXPIRY) {
        this.clearCache();
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Error loading profile cache:', error);
      this.clearCache();
      return null;
    }
  }

  /**
   * Salva la cache nel localStorage
   */
  private saveToStorage(cache: ProfileCache): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving profile cache:', error);
    }
  }

  /**
   * Ottiene i metadati dei profili dalla cache
   */
  getCachedProfiles(): ProfileMetadata[] | null {
    if (this.cache) {
      return this.cache.profiles;
    }

    this.cache = this.loadFromStorage();
    return this.cache?.profiles || null;
  }

  /**
   * Aggiorna la cache con nuovi metadati
   */
  updateCache(profiles: ProfileMetadata[]): void {
    const newCache: ProfileCache = {
      profiles: profiles.sort((a, b) => b.lastAccess - a.lastAccess), // Ordina per ultimo accesso
      lastUpdate: Date.now(),
      version: this.CACHE_VERSION
    };

    this.cache = newCache;
    this.saveToStorage(newCache);
  }

  /**
   * Aggiorna un singolo profilo nella cache
   */
  updateProfileInCache(profileId: string, updates: Partial<ProfileMetadata>): void {
    if (!this.cache) return;

    const profileIndex = this.cache.profiles.findIndex(p => p.id === profileId);
    if (profileIndex === -1) return;

    this.cache.profiles[profileIndex] = {
      ...this.cache.profiles[profileIndex],
      ...updates,
      lastAccess: Date.now()
    };

    // Riordina per ultimo accesso
    this.cache.profiles.sort((a, b) => b.lastAccess - a.lastAccess);
    this.cache.lastUpdate = Date.now();
    
    this.saveToStorage(this.cache);
  }

  /**
   * Rimuove un profilo dalla cache
   */
  removeProfileFromCache(profileId: string): void {
    if (!this.cache) return;

    this.cache.profiles = this.cache.profiles.filter(p => p.id !== profileId);
    this.cache.lastUpdate = Date.now();
    
    this.saveToStorage(this.cache);
  }

  /**
   * Pulisce completamente la cache
   */
  clearCache(): void {
    this.cache = null;
    localStorage.removeItem(this.CACHE_KEY);
  }

  /**
   * Verifica se la cache è valida
   */
  isCacheValid(): boolean {
    const cached = this.loadFromStorage();
    return cached !== null;
  }

  /**
   * Ottiene statistiche della cache
   */
  getCacheStats(): {
    isValid: boolean;
    profileCount: number;
    lastUpdate: number | null;
    age: number | null;
  } {
    const cached = this.loadFromStorage();
    
    return {
      isValid: cached !== null,
      profileCount: cached?.profiles.length || 0,
      lastUpdate: cached?.lastUpdate || null,
      age: cached ? Date.now() - cached.lastUpdate : null
    };
  }

  /**
   * Pre-carica i profili più utilizzati
   */
  getFrequentlyUsedProfiles(limit: number = 3): ProfileMetadata[] {
    const cached = this.getCachedProfiles();
    if (!cached) return [];

    return cached
      .filter(p => !p.isLocked)
      .slice(0, limit);
  }
}

// Singleton instance
export const profileCache = new ProfileCacheManager();