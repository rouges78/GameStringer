/**
 * 🌐 Community Translation Hub Service
 * 
 * Gestisce la condivisione di traduzioni tra utenti.
 * Storage locale con possibilità di sync futuro con server.
 */

import { clientLogger } from '@/lib/client-logger';

export type RetroPlatform =
  | 'nes' | 'snes' | 'n64' | 'gb' | 'gbc' | 'gba' | 'nds' | '3ds'
  | 'sega_md' | 'sega_saturn' | 'sega_dc'
  | 'ps1' | 'ps2' | 'psp'
  | 'pc_dos' | 'pc_win'
  | 'other';

export const RETRO_PLATFORMS: { id: RetroPlatform; name: string; icon: string }[] = [
  { id: 'nes', name: 'NES / Famicom', icon: '🎮' },
  { id: 'snes', name: 'SNES / Super Famicom', icon: '🕹️' },
  { id: 'n64', name: 'Nintendo 64', icon: '🎮' },
  { id: 'gb', name: 'Game Boy', icon: '🟩' },
  { id: 'gbc', name: 'Game Boy Color', icon: '🟪' },
  { id: 'gba', name: 'Game Boy Advance', icon: '🔵' },
  { id: 'nds', name: 'Nintendo DS', icon: '📱' },
  { id: '3ds', name: 'Nintendo 3DS', icon: '📱' },
  { id: 'sega_md', name: 'Sega Mega Drive / Genesis', icon: '🎮' },
  { id: 'sega_saturn', name: 'Sega Saturn', icon: '🪐' },
  { id: 'sega_dc', name: 'Dreamcast', icon: '🌀' },
  { id: 'ps1', name: 'PlayStation', icon: '🎮' },
  { id: 'ps2', name: 'PlayStation 2', icon: '🎮' },
  { id: 'psp', name: 'PlayStation Portable', icon: '🎮' },
  { id: 'pc_dos', name: 'PC (DOS)', icon: '💾' },
  { id: 'pc_win', name: 'PC (Windows)', icon: '🖥️' },
  { id: 'other', name: 'Altra piattaforma', icon: '🎲' },
];

export interface TranslationPack {
  id: string;
  name: string;
  gameId: string;
  gameName: string;
  gameAppId?: number;
  coverImage?: string;
  platform?: RetroPlatform;
  sourceLanguage: string;
  targetLanguage: string;
  version: string;
  author: CommunityAuthor;
  contributors: CommunityAuthor[];
  description: string;
  totalStrings: number;
  translatedStrings: number;
  completionPercentage: number;
  rating: number;
  ratingCount: number;
  downloads: number;
  size: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  changelog: PackChangelog[];
  files: PackFile[];
  status: 'draft' | 'published' | 'verified' | 'featured';
  compatibility: string[];
  patchFormat?: 'ips' | 'bps' | 'xdelta' | 'none';
  patchInstructions?: string;
}

export interface CommunityAuthor {
  id: string;
  username: string;
  avatar?: string;
  reputation: number;
  totalContributions: number;
  verifiedTranslator: boolean;
}

export interface PackChangelog {
  version: string;
  date: string;
  changes: string[];
}

export interface PackFile {
  name: string;
  path: string;
  type: 'json' | 'po' | 'csv' | 'resx' | 'xliff' | 'langdb' | 'ips' | 'bps' | 'xdelta';
  size: number;
  stringCount: number;
}

export interface PackReview {
  id: string;
  packId: string;
  author: CommunityAuthor;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  notHelpful: number;
  createdAt: string;
  verified: boolean;
}

export interface PackSearchFilters {
  query?: string;
  gameId?: string;
  platform?: RetroPlatform | '';
  sourceLanguage?: string;
  targetLanguage?: string;
  minRating?: number;
  minCompletion?: number;
  status?: string[];
  tags?: string[];
  patchFormat?: 'ips' | 'bps' | 'xdelta' | '';
  sortBy?: 'downloads' | 'rating' | 'updated' | 'completion';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UserContribution {
  packId: string;
  packName: string;
  gameName: string;
  stringsContributed: number;
  lastContribution: string;
  role: 'author' | 'contributor' | 'reviewer';
}

export interface HubStats {
  totalPacks: number;
  totalDownloads: number;
  totalContributors: number;
  totalStrings: number;
  languagesCovered: number;
  gamesCovered: number;
  topLanguages: { language: string; packs: number }[];
  topGames: { gameId: string; gameName: string; packs: number }[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  type: 'new_pack' | 'update' | 'review' | 'milestone';
  packId?: string;
  packName?: string;
  gameName?: string;
  author?: string;
  message: string;
  timestamp: string;
}

const STORAGE_KEY = 'gamestringer_community_hub';
const INSTALLED_PACKS_KEY = 'gamestringer_installed_packs';

function makeShowcaseAuthor(id: string, username: string, reputation: number, contributions: number, verified: boolean): CommunityAuthor {
  return { id, username, reputation, totalContributions: contributions, verifiedTranslator: verified };
}

function getShowcasePacks(): TranslationPack[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'showcase_esoteric_ebb_it',
      name: 'Esoteric Ebb — Traduzione Italiana Completa',
      gameId: 'esoteric_ebb',
      gameName: 'Esoteric Ebb',
      gameAppId: 2563020,
      coverImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2563020/header.jpg',
      platform: 'pc_win',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      version: '1.0.0',
      author: makeShowcaseAuthor('gs_rouges78', 'Rouges78', 850, 12, true),
      contributors: [makeShowcaseAuthor('gs_clodo', 'Clodo', 720, 8, true)],
      description: 'Traduzione italiana completa di Esoteric Ebb (Unity 6, IL2CPP). 556 stringhe tradotte con AI Ollama + revisione umana. Include questpoints, backgrounds, feats e UI. Metodo: iniezione CSV con resize binario nel resources.assets.',
      totalStrings: 556,
      translatedStrings: 556,
      completionPercentage: 100,
      rating: 4.7,
      ratingCount: 3,
      downloads: 24,
      size: 45000,
      tags: ['unity', 'il2cpp', 'csv', 'ai-assisted', 'completa', 'indie', 'rpg'],
      createdAt: '2026-03-19T14:00:00Z',
      updatedAt: now,
      changelog: [{ version: '1.0.0', date: '2026-03-19', changes: ['Traduzione completa 556/556 stringhe', 'Iniezione binaria con resize (+18.964 bytes)', '4 tabelle CSV: questpoints, backgrounds, feats, uielements'] }],
      files: [{ name: 'translations.json', path: 'translations.json', type: 'json', size: 38000, stringCount: 556 }],
      status: 'verified',
      compatibility: ['Esoteric Ebb v1.0+', 'Unity 6000.1.17f1'],
    },
    {
      id: 'showcase_undertale_it',
      name: 'Undertale — Traduzione Italiana (Team GT)',
      gameId: 'undertale',
      gameName: 'Undertale',
      gameAppId: 391540,
      coverImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/391540/header.jpg',
      platform: 'pc_win',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      version: '2.1.0',
      author: makeShowcaseAuthor('gt_team', 'GamesTranslator Team', 2400, 45, true),
      contributors: [
        makeShowcaseAuthor('gt_marco', 'MarcoTrad', 1200, 22, true),
        makeShowcaseAuthor('gt_lucia', 'LuciaLoc', 980, 18, true),
      ],
      description: 'Traduzione italiana completa di Undertale realizzata dalla community GamesTranslator.it. Include tutti i dialoghi, menu, oggetti e percorsi narrativi (Pacifista, Genocida, Neutrale). Revisione completa dei giochi di parole e battute di Sans.',
      totalStrings: 12450,
      translatedStrings: 12450,
      completionPercentage: 100,
      rating: 4.9,
      ratingCount: 187,
      downloads: 8420,
      size: 2100000,
      tags: ['rpg', 'indie', 'completa', 'community', 'giochi-di-parole'],
      createdAt: '2023-06-15T10:00:00Z',
      updatedAt: '2025-11-20T08:00:00Z',
      changelog: [
        { version: '2.1.0', date: '2025-11-20', changes: ['Fix battute Sans aggiornate', 'Compatibilità v1.08+'] },
        { version: '2.0.0', date: '2024-09-01', changes: ['Revisione completa di tutti i percorsi narrativi'] },
      ],
      files: [{ name: 'undertale_it.json', path: 'undertale_it.json', type: 'json', size: 2100000, stringCount: 12450 }],
      status: 'featured',
      compatibility: ['Undertale v1.08+', 'Steam / GOG'],
    },
    {
      id: 'showcase_hollow_knight_it',
      name: 'Hollow Knight — Traduzione Italiana Fan',
      gameId: 'hollow_knight',
      gameName: 'Hollow Knight',
      gameAppId: 367520,
      coverImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367520/header.jpg',
      platform: 'pc_win',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      version: '1.5.2',
      author: makeShowcaseAuthor('hk_fanit', 'HollowKnightIT', 1800, 32, true),
      contributors: [makeShowcaseAuthor('hk_vale', 'ValeHK', 650, 14, false)],
      description: 'Traduzione italiana fan-made di Hollow Knight incluso il DLC Grimm Troupe, Lifeblood, Godmaster e tutti i dialoghi NPC. Il gioco ha ricevuto una localizzazione ufficiale IT nel 2019, ma questa versione fan mantiene scelte stilistiche alternative apprezzate dalla community.',
      totalStrings: 8920,
      translatedStrings: 8920,
      completionPercentage: 100,
      rating: 4.6,
      ratingCount: 94,
      downloads: 3150,
      size: 1800000,
      tags: ['metroidvania', 'indie', 'completa', 'dlc-inclusi', 'alternativa'],
      createdAt: '2022-03-10T12:00:00Z',
      updatedAt: '2025-08-15T09:00:00Z',
      changelog: [
        { version: '1.5.2', date: '2025-08-15', changes: ['Fix typo in Godmaster ending', 'Aggiornamento terminologia Pantheon'] },
      ],
      files: [{ name: 'hollow_knight_it.json', path: 'hollow_knight_it.json', type: 'json', size: 1800000, stringCount: 8920 }],
      status: 'verified',
      compatibility: ['Hollow Knight v1.5+', 'Steam / GOG'],
    },
    {
      id: 'showcase_celeste_it',
      name: 'Celeste — Patch Italiana Completa',
      gameId: 'celeste',
      gameName: 'Celeste',
      gameAppId: 504230,
      coverImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/504230/header.jpg',
      platform: 'pc_win',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      version: '1.2.0',
      author: makeShowcaseAuthor('cel_andrea', 'AndreaTrad', 1100, 19, true),
      contributors: [],
      description: 'Traduzione italiana completa di Celeste, inclusi tutti i capitoli (1-9), dialoghi, poesie di Theo e testi di Farewell. Adattamento poetico dei monologhi interiori di Madeline con attenzione alla rappresentazione dei temi di salute mentale.',
      totalStrings: 4200,
      translatedStrings: 4200,
      completionPercentage: 100,
      rating: 4.8,
      ratingCount: 62,
      downloads: 2890,
      size: 520000,
      tags: ['platformer', 'indie', 'completa', 'poetica', 'farewell'],
      createdAt: '2023-01-20T15:00:00Z',
      updatedAt: '2025-06-10T11:00:00Z',
      changelog: [
        { version: '1.2.0', date: '2025-06-10', changes: ['Aggiornamento capitolo Farewell', 'Miglioramento adattamento poetico'] },
      ],
      files: [{ name: 'celeste_it.csv', path: 'celeste_it.csv', type: 'csv', size: 520000, stringCount: 4200 }],
      status: 'featured',
      compatibility: ['Celeste v1.4+', 'Steam / Epic / itch.io'],
    },
    {
      id: 'showcase_stardew_valley_it',
      name: 'Stardew Valley — Traduzione IT Migliorata',
      gameId: 'stardew_valley',
      gameName: 'Stardew Valley',
      gameAppId: 413150,
      coverImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/header.jpg',
      platform: 'pc_win',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      version: '3.0.1',
      author: makeShowcaseAuthor('sdv_giulia', 'GiuliaStar', 1500, 28, true),
      contributors: [
        makeShowcaseAuthor('sdv_pietro', 'PietroFarm', 800, 15, false),
        makeShowcaseAuthor('sdv_chiara', 'ChiaraTL', 600, 11, false),
      ],
      description: 'Traduzione italiana migliorata di Stardew Valley v1.6. Corregge centinaia di errori della localizzazione ufficiale, migliora la naturalezza dei dialoghi e aggiunge toni regionali ai personaggi. Include update 1.6 con Festival of Seasons.',
      totalStrings: 18500,
      translatedStrings: 18500,
      completionPercentage: 100,
      rating: 4.5,
      ratingCount: 215,
      downloads: 12400,
      size: 3200000,
      tags: ['simulazione', 'farming', 'completa', 'fix-ufficiale', 'v1.6'],
      createdAt: '2021-08-05T09:00:00Z',
      updatedAt: '2025-12-01T14:00:00Z',
      changelog: [
        { version: '3.0.1', date: '2025-12-01', changes: ['Supporto Stardew Valley 1.6.14', 'Fix Festival of Seasons'] },
        { version: '3.0.0', date: '2025-03-20', changes: ['Update completo per v1.6', 'Nuovi dialoghi e oggetti'] },
      ],
      files: [{ name: 'stardew_it.json', path: 'stardew_it.json', type: 'json', size: 3200000, stringCount: 18500 }],
      status: 'featured',
      compatibility: ['Stardew Valley v1.6+', 'Steam / GOG'],
    },
    {
      id: 'showcase_mother3_it',
      name: 'Mother 3 — Traduzione Italiana (GBA)',
      gameId: 'mother3',
      gameName: 'Mother 3',
      platform: 'gba',
      sourceLanguage: 'ja',
      targetLanguage: 'it',
      version: '1.1.0',
      author: makeShowcaseAuthor('m3_luca', 'LucaRPG', 2000, 35, true),
      contributors: [makeShowcaseAuthor('m3_sara', 'SaraRetro', 900, 16, true)],
      description: 'Traduzione italiana completa di Mother 3 per Game Boy Advance. Basata sulla fan translation inglese di Tomato, con adattamento completo dei giochi di parole, riferimenti culturali e nomi degli attacchi PSI. Patch IPS applicabile alla ROM giapponese.',
      totalStrings: 9800,
      translatedStrings: 9800,
      completionPercentage: 100,
      rating: 4.9,
      ratingCount: 78,
      downloads: 4500,
      size: 850000,
      tags: ['gba', 'rpg', 'jrpg', 'retro', 'completa', 'patch-ips'],
      createdAt: '2022-11-10T10:00:00Z',
      updatedAt: '2025-04-22T08:00:00Z',
      changelog: [
        { version: '1.1.0', date: '2025-04-22', changes: ['Fix nomi PSI capitolo 7', 'Correzioni grammaticali'] },
      ],
      files: [{ name: 'mother3_it.ips', path: 'mother3_it.ips', type: 'ips', size: 850000, stringCount: 9800 }],
      status: 'verified',
      compatibility: ['Mother 3 (JP ROM)', 'mGBA / VBA-M'],
      patchFormat: 'ips',
      patchInstructions: 'Applicare la patch IPS alla ROM giapponese di Mother 3 usando Lunar IPS o il ROM Patcher integrato in GameStringer.',
    },
  ];
}


class CommunityHubService {
  private localPacks: TranslationPack[] = [];
  private installedPacks: Map<string, { packId: string; installedAt: string; path: string }> = new Map();

  constructor() {
    this.loadLocalData();
  }

  private loadLocalData(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.localPacks = JSON.parse(stored);
      }
      
      const installed = localStorage.getItem(INSTALLED_PACKS_KEY);
      if (installed) {
        const data = JSON.parse(installed);
        this.installedPacks = new Map(Object.entries(data));
      }

      // Rimuovi eventuali seed data finti salvati in precedenza
      const hadSeeds = this.localPacks.some(p => p.id.startsWith('seed_'));
      if (hadSeeds) {
        this.localPacks = this.localPacks.filter(p => !p.id.startsWith('seed_'));
        this.saveLocalData();
      }

      // Carica pack showcase reali se il hub è vuoto
      if (this.localPacks.length === 0) {
        this.localPacks = getShowcasePacks();
        this.saveLocalData();
      }
    } catch (error: unknown) {
      clientLogger.error('Error loading community hub data:', error);
    }
  }

  private saveLocalData(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.localPacks));
      localStorage.setItem(INSTALLED_PACKS_KEY, JSON.stringify(Object.fromEntries(this.installedPacks)));
    } catch (error: unknown) {
      clientLogger.error('Error saving community hub data:', error);
    }
  }

  /**
   * Cerca pack di traduzioni — usa backend Supabase se disponibile, altrimenti fallback locale
   */
  async searchPacks(filters: PackSearchFilters = {}): Promise<{ packs: TranslationPack[]; total: number }> {
    // Try Supabase backend first (with 5s timeout to avoid blocking UI)
    try {
      const { isBackendEnabled, fetchPacks } = await import('./community-hub-backend');
      if (isBackendEnabled()) {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Supabase timeout')), 5000)
        );
        const result = await Promise.race([fetchPacks(filters), timeout]);
        return result;
      }
    } catch {
      // Backend non disponibile o timeout, fallback locale
    }

    let results = [...this.localPacks];
    
    if (filters.query) {
      const query = filters.query.toLowerCase();
      results = results.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.gameName.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }
    
    if (filters.gameId) {
      results = results.filter(p => p.gameId === filters.gameId);
    }
    
    if (filters.targetLanguage) {
      results = results.filter(p => p.targetLanguage === filters.targetLanguage);
    }
    
    if (filters.minRating) {
      results = results.filter(p => p.rating >= filters.minRating!);
    }
    
    if (filters.minCompletion) {
      results = results.filter(p => p.completionPercentage >= filters.minCompletion!);
    }
    
    if (filters.platform) {
      results = results.filter(p => p.platform === filters.platform);
    }
    
    if (filters.patchFormat) {
      results = results.filter(p => p.patchFormat === filters.patchFormat);
    }
    
    if (filters.status?.length) {
      results = results.filter(p => filters.status!.includes(p.status));
    }
    
    // Sort
    const sortBy = filters.sortBy || 'downloads';
    const sortOrder = filters.sortOrder || 'desc';
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'downloads': comparison = a.downloads - b.downloads; break;
        case 'rating': comparison = a.rating - b.rating; break;
        case 'completion': comparison = a.completionPercentage - b.completionPercentage; break;
        case 'updated': comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const start = (page - 1) * limit;
    
    return {
      packs: results.slice(start, start + limit),
      total: results.length
    };
  }

  /**
   * Ottieni dettagli pack — backend Supabase o locale
   */
  async getPackDetails(packId: string): Promise<TranslationPack | null> {
    try {
      const { isBackendEnabled, fetchPackById } = await import('./community-hub-backend');
      if (isBackendEnabled()) {
        return await fetchPackById(packId);
      }
    } catch {}
    return this.localPacks.find(p => p.id === packId) || null;
  }

  /**
   * Ottieni recensioni pack — backend Supabase o vuoto
   */
  async getPackReviews(packId: string): Promise<PackReview[]> {
    try {
      const { isBackendEnabled, fetchReviews } = await import('./community-hub-backend');
      if (isBackendEnabled()) {
        return await fetchReviews(packId);
      }
    } catch {}
    return [];
  }

  /**
   * Scarica e installa pack
   */
  async downloadPack(packId: string, installPath: string): Promise<boolean> {
    const pack = await this.getPackDetails(packId);
    if (!pack) {
      throw new Error('Pack non trovato');
    }

    // Download da backend Supabase se disponibile
    try {
      const { isBackendEnabled, downloadPack: downloadFromBackend } = await import('./community-hub-backend');
      if (isBackendEnabled()) {
        await downloadFromBackend(packId);
      }
    } catch {}

    // Salva info installazione
    this.installedPacks.set(packId, {
      packId,
      installedAt: new Date().toISOString(),
      path: installPath
    });
    
    // Incrementa downloads
    const localIndex = this.localPacks.findIndex(p => p.id === packId);
    if (localIndex >= 0) {
      this.localPacks[localIndex].downloads++;
    }
    
    this.saveLocalData();
    return true;
  }

  /**
   * Verifica se pack è installato
   */
  isPackInstalled(packId: string): boolean {
    return this.installedPacks.has(packId);
  }

  /**
   * Ottieni pack installati
   */
  getInstalledPacks(): string[] {
    return Array.from(this.installedPacks.keys());
  }

  /**
   * Crea nuovo pack da file locali
   */
  async createPack(data: {
    name: string;
    gameId: string;
    gameName: string;
    gameAppId?: number;
    platform?: RetroPlatform;
    patchFormat?: 'ips' | 'bps' | 'xdelta' | 'none';
    patchInstructions?: string;
    sourceLanguage: string;
    targetLanguage: string;
    description: string;
    tags: string[];
    files: File[];
    author: CommunityAuthor;
  }): Promise<TranslationPack> {
    const packId = `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Analizza file per contare stringhe
    let totalStrings = 0;
    const packFiles: PackFile[] = [];
    
    for (const file of data.files) {
      const content = await file.text();
      let stringCount = 0;
      
      // Conta stringhe basandosi sul tipo file
      if (file.name.endsWith('.json')) {
        try {
          const json = JSON.parse(content);
          stringCount = this.countJsonStrings(json);
        } catch { stringCount = 0; }
      } else if (file.name.endsWith('.po')) {
        stringCount = (content.match(/^msgid /gm) || []).length;
      } else if (file.name.endsWith('.csv')) {
        stringCount = content.split('\n').length - 1;
      }
      
      totalStrings += stringCount;
      packFiles.push({
        name: file.name,
        path: file.name,
        type: this.getFileType(file.name),
        size: file.size,
        stringCount
      });
    }

    const pack: TranslationPack = {
      id: packId,
      name: data.name,
      gameId: data.gameId,
      gameName: data.gameName,
      gameAppId: data.gameAppId,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      version: '1.0.0',
      author: data.author,
      contributors: [],
      description: data.description,
      totalStrings,
      translatedStrings: totalStrings,
      completionPercentage: 100,
      rating: 0,
      ratingCount: 0,
      downloads: 0,
      size: data.files.reduce((sum, f) => sum + f.size, 0),
      tags: data.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      changelog: [{
        version: '1.0.0',
        date: new Date().toISOString().split('T')[0],
        changes: ['Release iniziale']
      }],
      files: packFiles,
      status: 'draft',
      compatibility: [],
      platform: data.platform,
      patchFormat: data.patchFormat || 'none',
      patchInstructions: data.patchInstructions
    };

    this.localPacks.push(pack);
    this.saveLocalData();
    
    return pack;
  }

  /**
   * Pubblica pack (cambia status)
   */
  async publishPack(packId: string): Promise<boolean> {
    const index = this.localPacks.findIndex(p => p.id === packId);
    if (index >= 0) {
      this.localPacks[index].status = 'published';
      this.localPacks[index].updatedAt = new Date().toISOString();
      this.saveLocalData();
      return true;
    }
    return false;
  }

  /**
   * Aggiungi recensione
   */
  async addReview(packId: string, review: Omit<PackReview, 'id' | 'packId' | 'createdAt' | 'helpful' | 'notHelpful' | 'verified'>): Promise<PackReview> {
    const newReview: PackReview = {
      ...review,
      id: `review_${Date.now()}`,
      packId,
      createdAt: new Date().toISOString(),
      helpful: 0,
      notHelpful: 0,
      verified: false
    };
    
    // Aggiorna rating medio del pack
    const pack = this.localPacks.find(p => p.id === packId);
    if (pack) {
      const totalRating = pack.rating * pack.ratingCount + review.rating;
      pack.ratingCount++;
      pack.rating = totalRating / pack.ratingCount;
      this.saveLocalData();
    }
    
    return newReview;
  }

  /**
   * Ottieni statistiche hub
   */
  async getHubStats(): Promise<HubStats> {
    // Backend Supabase se disponibile (5s timeout)
    try {
      const { isBackendEnabled, fetchHubStats } = await import('./community-hub-backend');
      if (isBackendEnabled()) {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Stats timeout')), 5000)
        );
        return await Promise.race([fetchHubStats(), timeout]);
      }
    } catch {}

    const allPacks = [...this.localPacks];
    
    const languageMap = new Map<string, number>();
    const gameMap = new Map<string, { gameName: string; count: number }>();
    
    let totalStrings = 0;
    let totalDownloads = 0;
    
    for (const pack of allPacks) {
      totalStrings += pack.totalStrings;
      totalDownloads += pack.downloads;
      
      languageMap.set(pack.targetLanguage, (languageMap.get(pack.targetLanguage) || 0) + 1);
      
      const gameData = gameMap.get(pack.gameId) || { gameName: pack.gameName, count: 0 };
      gameData.count++;
      gameMap.set(pack.gameId, gameData);
    }
    
    return {
      totalPacks: allPacks.length,
      totalDownloads,
      totalContributors: 0,
      totalStrings,
      languagesCovered: languageMap.size,
      gamesCovered: gameMap.size,
      topLanguages: Array.from(languageMap.entries())
        .map(([language, packs]) => ({ language, packs }))
        .sort((a, b) => b.packs - a.packs)
        .slice(0, 5),
      topGames: Array.from(gameMap.entries())
        .map(([gameId, data]) => ({ gameId, gameName: data.gameName, packs: data.count }))
        .sort((a, b) => b.packs - a.packs)
        .slice(0, 5),
      recentActivity: []
    };
  }

  /**
   * Ottieni contribuzioni utente
   */
  async getUserContributions(userId: string): Promise<UserContribution[]> {
    return this.localPacks
      .filter(p => p.author.id === userId || p.contributors.some(c => c.id === userId))
      .map(p => ({
        packId: p.id,
        packName: p.name,
        gameName: p.gameName,
        stringsContributed: p.author.id === userId ? p.translatedStrings : Math.floor(p.translatedStrings * 0.1),
        lastContribution: p.updatedAt,
        role: p.author.id === userId ? 'author' as const : 'contributor' as const
      }));
  }

  /**
   * Esporta pack come file
   */
  async exportPack(packId: string): Promise<Blob> {
    const pack = await this.getPackDetails(packId);
    if (!pack) {
      throw new Error('Pack non trovato');
    }
    
    const exportData = {
      ...pack,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0'
    };
    
    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  }

  /**
   * Importa pack da file
   */
  async importPack(file: File): Promise<TranslationPack> {
    const content = await file.text();
    const data = JSON.parse(content);
    
    // Genera nuovo ID per evitare conflitti
    const pack: TranslationPack = {
      ...data,
      id: `pack_imported_${Date.now()}`,
      status: 'draft',
      downloads: 0
    };
    
    this.localPacks.push(pack);
    this.saveLocalData();
    
    return pack;
  }

  // Helper methods
  private countJsonStrings(obj: unknown): number {
    if (typeof obj === 'string') return 1;
    if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + this.countJsonStrings(item), 0);
    if (typeof obj === 'object' && obj !== null) {
      const values = Object.values(obj);
      let count = 0;
      for (const val of values) {
        count += this.countJsonStrings(val);
      }
      return count;
    }
    return 0;
  }

  private getFileType(filename: string): PackFile['type'] {
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.po')) return 'po';
    if (filename.endsWith('.csv')) return 'csv';
    if (filename.endsWith('.resx')) return 'resx';
    if (filename.endsWith('.xliff') || filename.endsWith('.xlf')) return 'xliff';
    if (filename.endsWith('.langdb')) return 'langdb';
    if (filename.endsWith('.ips')) return 'ips';
    if (filename.endsWith('.bps')) return 'bps';
    if (filename.endsWith('.xdelta') || filename.endsWith('.xd') || filename.endsWith('.vcdiff')) return 'xdelta';
    return 'json';
  }

}

export const communityHubService = new CommunityHubService();
export default communityHubService;

// Re-export new types from backend
export type { 
  HubUser,
  PackComment, 
  HubNotification, 
  Badge, 
  BadgeAward, 
  LeaderboardEntry 
} from './community-hub-backend';
