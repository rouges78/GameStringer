/**
 * 🎮 Nexus Mods Integration Service
 * 
 * Integrazione con Nexus Mods per cercare e scaricare patch di traduzione.
 * Richiede API key da nexusmods.com/users/myaccount?tab=api+access
 */

const NEXUS_API_BASE = 'https://api.nexusmods.com/v1';
const NEXUS_SEARCH_BASE = 'https://search.nexusmods.com/mods';

export interface NexusMod {
  mod_id: number;
  name: string;
  summary: string;
  description?: string;
  picture_url: string;
  author: string;
  uploaded_by: string;
  uploaded_users_profile_url: string;
  version: string;
  created_timestamp: number;
  updated_timestamp: number;
  endorsement_count: number;
  downloads: number;
  unique_downloads: number;
  category_id: number;
  game_id: number;
  domain_name: string;
  status: string;
  available: boolean;
}

export interface NexusModFile {
  id: number[];
  uid: number;
  file_id: number;
  name: string;
  version: string;
  category_id: number;
  category_name: string;
  is_primary: boolean;
  size: number;
  size_kb: number;
  file_name: string;
  uploaded_timestamp: number;
  uploaded_time: string;
  mod_version: string;
  external_virus_scan_url: string;
  description: string;
  changelog_html: string;
  content_preview_link: string;
}

export interface NexusDownloadLink {
  name: string;
  short_name: string;
  URI: string;
}

export interface NexusGame {
  id: number;
  name: string;
  forum_url: string;
  nexusmods_url: string;
  genre: string;
  file_count: number;
  downloads: number;
  domain_name: string;
  approved_date: number;
  file_views: number;
  authors: number;
  file_endorsements: number;
  mods: number;
  categories: NexusCategory[];
}

export interface NexusCategory {
  category_id: number;
  name: string;
  parent_category: number | false;
}

export interface NexusSearchResult {
  name: string;
  downloads: number;
  endorsements: number;
  url: string;
  image: string;
  username: string;
  user_id: number;
  game_name: string;
  game_id: number;
  mod_id: number;
}

export interface NexusUserValidation {
  user_id: number;
  key: string;
  name: string;
  is_premium: boolean;
  is_supporter: boolean;
  email: string;
  profile_url: string;
}

export interface TranslationModResult {
  mod: NexusMod;
  files: NexusModFile[];
  language: string;
  gameId: string;
  gameName: string;
  isItalian: boolean;
}

const STORAGE_KEY = 'gamestringer_nexus_api_key';
const CACHE_KEY = 'gamestringer_nexus_cache';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minuti

class NexusModsService {
  private apiKey: string | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private userInfo: NexusUserValidation | null = null;

  constructor() {
    this.loadApiKey();
    this.loadCache();
  }

  private loadApiKey(): void {
    if (typeof window === 'undefined') return;
    this.apiKey = localStorage.getItem(STORAGE_KEY);
  }

  private loadCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        this.cache = new Map(Object.entries(data));
      }
    } catch {
      this.cache = new Map();
    }
  }

  private saveCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // Ignore cache save errors
    }
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    this.saveCache();
  }

  /**
   * Imposta API key
   */
  setApiKey(key: string): void {
    this.apiKey = key;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, key);
    }
    this.userInfo = null;
  }

  /**
   * Rimuovi API key
   */
  clearApiKey(): void {
    this.apiKey = null;
    this.userInfo = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Verifica se API key è configurata
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Ottieni API key (mascherata)
   */
  getMaskedApiKey(): string {
    if (!this.apiKey) return '';
    return this.apiKey.substring(0, 8) + '...' + this.apiKey.substring(this.apiKey.length - 4);
  }

  /**
   * Fetch con autenticazione Nexus
   */
  private async nexusFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('API key Nexus Mods non configurata');
    }

    const response = await fetch(`${NEXUS_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API key non valida');
      }
      if (response.status === 429) {
        throw new Error('Rate limit raggiunto. Riprova tra qualche minuto.');
      }
      throw new Error(`Errore Nexus API: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Valida API key e ottieni info utente
   */
  async validateApiKey(): Promise<NexusUserValidation> {
    const data = await this.nexusFetch<NexusUserValidation>('/users/validate.json');
    this.userInfo = data;
    return data;
  }

  /**
   * Ottieni info utente (cached)
   */
  getUserInfo(): NexusUserValidation | null {
    return this.userInfo;
  }

  /**
   * Cerca giochi su Nexus
   */
  async searchGames(query: string): Promise<NexusGame[]> {
    const cacheKey = `games_${query}`;
    const cached = this.getCached<NexusGame[]>(cacheKey);
    if (cached) return cached;

    const games = await this.nexusFetch<NexusGame[]>('/games.json');
    const filtered = games.filter(g => 
      g.name.toLowerCase().includes(query.toLowerCase()) ||
      g.domain_name.toLowerCase().includes(query.toLowerCase())
    );

    this.setCache(cacheKey, filtered);
    return filtered;
  }

  /**
   * Ottieni info gioco
   */
  async getGame(domainName: string): Promise<NexusGame> {
    const cacheKey = `game_${domainName}`;
    const cached = this.getCached<NexusGame>(cacheKey);
    if (cached) return cached;

    const game = await this.nexusFetch<NexusGame>(`/games/${domainName}.json`);
    this.setCache(cacheKey, game);
    return game;
  }

  /**
   * Cerca mod per gioco
   */
  async searchMods(gameDomain: string, query: string): Promise<NexusMod[]> {
    const cacheKey = `mods_${gameDomain}_${query}`;
    const cached = this.getCached<NexusMod[]>(cacheKey);
    if (cached) return cached;

    // Nexus non ha un endpoint di ricerca diretto, usiamo latest mods
    // In produzione si userebbe l'API di ricerca Elasticsearch
    const mods = await this.nexusFetch<NexusMod[]>(`/games/${gameDomain}/mods/latest_added.json`);
    
    const filtered = mods.filter(m => 
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.summary.toLowerCase().includes(query.toLowerCase())
    );

    this.setCache(cacheKey, filtered);
    return filtered;
  }

  /**
   * Cerca mod di traduzione italiana
   */
  async searchItalianTranslations(gameDomain: string): Promise<TranslationModResult[]> {
    const cacheKey = `italian_${gameDomain}`;
    const cached = this.getCached<TranslationModResult[]>(cacheKey);
    if (cached) return cached;

    try {
      // Cerca mod con keyword italiane
      const keywords = ['italian', 'italiano', 'ita', 'traduzione', 'translation'];
      const allMods: NexusMod[] = [];

      // Ottieni mod recenti e aggiornati
      const [latestMods, updatedMods] = await Promise.all([
        this.nexusFetch<NexusMod[]>(`/games/${gameDomain}/mods/latest_added.json`).catch(() => []),
        this.nexusFetch<NexusMod[]>(`/games/${gameDomain}/mods/latest_updated.json`).catch(() => [])
      ]);

      allMods.push(...latestMods, ...updatedMods);

      // Filtra per traduzioni italiane
      const italianMods = allMods.filter(mod => {
        const searchText = `${mod.name} ${mod.summary}`.toLowerCase();
        return keywords.some(kw => searchText.includes(kw));
      });

      // Rimuovi duplicati
      const uniqueMods = Array.from(
        new Map(italianMods.map(m => [m.mod_id, m])).values()
      );

      const results: TranslationModResult[] = uniqueMods.map(mod => ({
        mod,
        files: [],
        language: 'it',
        gameId: gameDomain,
        gameName: gameDomain,
        isItalian: true
      }));

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Error searching Italian translations:', error);
      return [];
    }
  }

  /**
   * Ottieni dettagli mod
   */
  async getModDetails(gameDomain: string, modId: number): Promise<NexusMod> {
    const cacheKey = `mod_${gameDomain}_${modId}`;
    const cached = this.getCached<NexusMod>(cacheKey);
    if (cached) return cached;

    const mod = await this.nexusFetch<NexusMod>(`/games/${gameDomain}/mods/${modId}.json`);
    this.setCache(cacheKey, mod);
    return mod;
  }

  /**
   * Ottieni file del mod
   */
  async getModFiles(gameDomain: string, modId: number): Promise<{ files: NexusModFile[] }> {
    const cacheKey = `files_${gameDomain}_${modId}`;
    const cached = this.getCached<{ files: NexusModFile[] }>(cacheKey);
    if (cached) return cached;

    const files = await this.nexusFetch<{ files: NexusModFile[] }>(
      `/games/${gameDomain}/mods/${modId}/files.json`
    );
    this.setCache(cacheKey, files);
    return files;
  }

  /**
   * Ottieni link download (richiede premium per download diretto)
   */
  async getDownloadLinks(
    gameDomain: string, 
    modId: number, 
    fileId: number
  ): Promise<NexusDownloadLink[]> {
    return this.nexusFetch<NexusDownloadLink[]>(
      `/games/${gameDomain}/mods/${modId}/files/${fileId}/download_link.json`
    );
  }

  /**
   * Ottieni URL pagina mod
   */
  getModPageUrl(gameDomain: string, modId: number): string {
    return `https://www.nexusmods.com/${gameDomain}/mods/${modId}`;
  }

  /**
   * Ottieni URL download manuale
   */
  getManualDownloadUrl(gameDomain: string, modId: number, fileId: number): string {
    return `https://www.nexusmods.com/${gameDomain}/mods/${modId}?tab=files&file_id=${fileId}`;
  }

  /**
   * Mappa nome gioco Steam a domain Nexus
   */
  mapGameToNexusDomain(gameName: string): string | null {
    const mappings: Record<string, string> = {
      'the witcher 3': 'witcher3',
      'witcher 3': 'witcher3',
      'cyberpunk 2077': 'cyberpunk2077',
      'skyrim': 'skyrimspecialedition',
      'skyrim special edition': 'skyrimspecialedition',
      'fallout 4': 'fallout4',
      'fallout new vegas': 'newvegas',
      'fallout 3': 'fallout3',
      'baldurs gate 3': 'baldursgate3',
      "baldur's gate 3": 'baldursgate3',
      'starfield': 'starfield',
      'elden ring': 'eldenring',
      'dark souls 3': 'darksouls3',
      'dark souls': 'darksouls',
      'sekiro': 'sekiro',
      'monster hunter world': 'monsterhunterworld',
      'monster hunter rise': 'monsterhunterrise',
      'resident evil 4': 'residentevil42023',
      'resident evil 2': 'residentevil22019',
      'resident evil 3': 'residentevil32020',
      'stardew valley': 'stardewvalley',
      'hollow knight': 'hollowknight',
      'hades': 'hades',
      'disco elysium': 'discoelysium',
      'divinity original sin 2': 'divinityoriginalsin2',
      'pillars of eternity': 'pillarsofeternity',
      'pathfinder wrath': 'pathfinderwrathoftherighteous',
      'dragon age origins': 'dragonage',
      'dragon age inquisition': 'dragonageinquisition',
      'mass effect legendary': 'masseffectlegendaryedition',
      'mount and blade': 'mountandblade2bannerlord',
      'bannerlord': 'mountandblade2bannerlord',
      'kingdom come': 'kingdomcomedeliverance',
      'valheim': 'valheim',
      'terraria': 'terraria',
      'rimworld': 'rimworld',
    };

    const normalized = gameName.toLowerCase().trim();
    
    // Cerca match esatto
    if (mappings[normalized]) {
      return mappings[normalized];
    }

    // Cerca match parziale
    for (const [key, domain] of Object.entries(mappings)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return domain;
      }
    }

    // Prova a generare domain da nome
    return normalized.replace(/[^a-z0-9]/g, '');
  }

  /**
   * Cerca traduzioni per gioco dalla libreria
   */
  async findTranslationsForGame(gameName: string): Promise<TranslationModResult[]> {
    const domain = this.mapGameToNexusDomain(gameName);
    if (!domain) {
      return [];
    }

    try {
      return await this.searchItalianTranslations(domain);
    } catch {
      return [];
    }
  }
}

export const nexusModsService = new NexusModsService();
export default nexusModsService;
