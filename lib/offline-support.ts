/**
 * 🔌 Offline Support Service
 * 
 * Gestisce la modalità offline e il caching per funzionalità senza internet.
 */

export interface OfflineStatus {
  isOnline: boolean;
  lastOnline: string | null;
  cachedData: {
    translations: number;
    games: number;
    packs: number;
  };
}

export interface CachedTranslation {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  gameId?: string;
  cachedAt: string;
}

const CACHE_KEYS = {
  TRANSLATIONS: 'gs_offline_translations',
  GAMES: 'gs_offline_games',
  PACKS: 'gs_offline_packs',
  GLOSSARY: 'gs_offline_glossary',
  LAST_ONLINE: 'gs_last_online'
};

class OfflineSupportService {
  private isOnline: boolean = true;
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => this.handleOnlineChange(true));
      window.addEventListener('offline', () => this.handleOnlineChange(false));
    }
  }

  private handleOnlineChange(online: boolean): void {
    this.isOnline = online;
    if (online) {
      localStorage.setItem(CACHE_KEYS.LAST_ONLINE, new Date().toISOString());
    }
    this.listeners.forEach(listener => listener(online));
  }

  /**
   * Verifica se siamo online
   */
  checkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Registra listener per cambio stato
   */
  onStatusChange(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Ottieni stato offline completo
   */
  getStatus(): OfflineStatus {
    return {
      isOnline: this.isOnline,
      lastOnline: localStorage.getItem(CACHE_KEYS.LAST_ONLINE),
      cachedData: {
        translations: this.getCachedTranslationsCount(),
        games: this.getCachedGamesCount(),
        packs: this.getCachedPacksCount()
      }
    };
  }

  /**
   * Cache traduzioni per uso offline
   */
  cacheTranslation(translation: CachedTranslation): void {
    const cached = this.getCachedTranslations();
    const existing = cached.findIndex(t => 
      t.sourceText === translation.sourceText && 
      t.targetLanguage === translation.targetLanguage
    );
    
    if (existing >= 0) {
      cached[existing] = translation;
    } else {
      cached.push(translation);
    }

    // Limita a 10000 traduzioni cached
    if (cached.length > 10000) {
      cached.splice(0, cached.length - 10000);
    }

    localStorage.setItem(CACHE_KEYS.TRANSLATIONS, JSON.stringify(cached));
  }

  /**
   * Cerca traduzione in cache
   */
  findCachedTranslation(
    sourceText: string, 
    targetLanguage: string
  ): CachedTranslation | null {
    const cached = this.getCachedTranslations();
    return cached.find(t => 
      t.sourceText === sourceText && 
      t.targetLanguage === targetLanguage
    ) || null;
  }

  /**
   * Ottieni tutte le traduzioni cached
   */
  getCachedTranslations(): CachedTranslation[] {
    try {
      const data = localStorage.getItem(CACHE_KEYS.TRANSLATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  getCachedTranslationsCount(): number {
    return this.getCachedTranslations().length;
  }

  /**
   * Cache dati giochi
   */
  cacheGames(games: any[]): void {
    localStorage.setItem(CACHE_KEYS.GAMES, JSON.stringify({
      games,
      cachedAt: new Date().toISOString()
    }));
  }

  getCachedGames(): any[] {
    try {
      const data = localStorage.getItem(CACHE_KEYS.GAMES);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.games || [];
      }
    } catch {}
    return [];
  }

  getCachedGamesCount(): number {
    return this.getCachedGames().length;
  }

  /**
   * Cache pack traduzioni
   */
  cachePacks(packs: any[]): void {
    localStorage.setItem(CACHE_KEYS.PACKS, JSON.stringify({
      packs,
      cachedAt: new Date().toISOString()
    }));
  }

  getCachedPacks(): any[] {
    try {
      const data = localStorage.getItem(CACHE_KEYS.PACKS);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.packs || [];
      }
    } catch {}
    return [];
  }

  getCachedPacksCount(): number {
    return this.getCachedPacks().length;
  }

  /**
   * Cache glossario
   */
  cacheGlossary(glossary: Record<string, string>): void {
    localStorage.setItem(CACHE_KEYS.GLOSSARY, JSON.stringify(glossary));
  }

  getCachedGlossary(): Record<string, string> {
    try {
      const data = localStorage.getItem(CACHE_KEYS.GLOSSARY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  /**
   * Pulisci cache
   */
  clearCache(type?: 'translations' | 'games' | 'packs' | 'glossary' | 'all'): void {
    if (!type || type === 'all') {
      Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
    } else {
      const keyMap = {
        translations: CACHE_KEYS.TRANSLATIONS,
        games: CACHE_KEYS.GAMES,
        packs: CACHE_KEYS.PACKS,
        glossary: CACHE_KEYS.GLOSSARY
      };
      localStorage.removeItem(keyMap[type]);
    }
  }

  /**
   * Ottieni dimensione cache in bytes
   */
  getCacheSize(): number {
    let size = 0;
    Object.values(CACHE_KEYS).forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        size += data.length * 2; // UTF-16
      }
    });
    return size;
  }

  /**
   * Formatta dimensione cache
   */
  formatCacheSize(): string {
    const bytes = this.getCacheSize();
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Feature disponibili offline
   */
  getOfflineFeatures(): { name: string; available: boolean; reason?: string }[] {
    return [
      { name: 'Libreria Giochi', available: true, reason: 'Dati cached localmente' },
      { name: 'Translation Memory', available: true, reason: 'Database locale' },
      { name: 'Visual Editor', available: true, reason: 'Funziona completamente offline' },
      { name: 'Glossario', available: true, reason: 'Salvato localmente' },
      { name: 'AI Translator (Ollama)', available: true, reason: 'LLM locale' },
      { name: 'AI Translator (Cloud)', available: false, reason: 'Richiede internet' },
      { name: 'Community Hub', available: false, reason: 'Richiede internet' },
      { name: 'Nexus Mods', available: false, reason: 'Richiede internet' },
      { name: 'OCR Translator', available: true, reason: 'Cattura locale, traduzione richiede AI' },
    ];
  }
}

export const offlineSupportService = new OfflineSupportService();
export default offlineSupportService;
