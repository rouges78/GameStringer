/**
 * 🌐 Community Translation Hub Service
 * 
 * Gestisce la condivisione di traduzioni tra utenti.
 * Storage locale con possibilità di sync futuro con server.
 */

import { invoke } from '@/lib/tauri-api';

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
    } catch (error) {
      console.error('Error loading community hub data:', error);
    }
  }

  private saveLocalData(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.localPacks));
      localStorage.setItem(INSTALLED_PACKS_KEY, JSON.stringify(Object.fromEntries(this.installedPacks)));
    } catch (error) {
      console.error('Error saving community hub data:', error);
    }
  }

  /**
   * Cerca pack di traduzioni
   */
  async searchPacks(filters: PackSearchFilters = {}): Promise<{ packs: TranslationPack[]; total: number }> {
    let results = [...this.localPacks, ...this.getMockPacks()];
    
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
   * Ottieni dettagli pack
   */
  async getPackDetails(packId: string): Promise<TranslationPack | null> {
    const allPacks = [...this.localPacks, ...this.getMockPacks()];
    return allPacks.find(p => p.id === packId) || null;
  }

  /**
   * Ottieni recensioni pack
   */
  async getPackReviews(packId: string): Promise<PackReview[]> {
    return this.getMockReviews(packId);
  }

  /**
   * Scarica e installa pack
   */
  async downloadPack(packId: string, installPath: string): Promise<boolean> {
    const pack = await this.getPackDetails(packId);
    if (!pack) {
      throw new Error('Pack non trovato');
    }

    // Simula download (in futuro: fetch da server)
    await new Promise(resolve => setTimeout(resolve, 1500));

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
    const allPacks = [...this.localPacks, ...this.getMockPacks()];
    
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
      recentActivity: this.getMockActivity()
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
  private countJsonStrings(obj: any): number {
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

  private getMockPacks(): TranslationPack[] {
    const mockAuthor: CommunityAuthor = {
      id: 'retro_team', username: 'RetroTranslations', avatar: undefined,
      reputation: 950, totalContributions: 42, verifiedTranslator: true
    };
    const mockAuthor2: CommunityAuthor = {
      id: 'fan_ita', username: 'ItaRomHacker', avatar: undefined,
      reputation: 720, totalContributions: 18, verifiedTranslator: true
    };
    return [
      {
        id: 'mock_ff6_snes', name: 'Final Fantasy VI - Traduzione Italiana Completa',
        gameId: 'ff6', gameName: 'Final Fantasy VI', platform: 'snes',
        sourceLanguage: 'ja', targetLanguage: 'it', version: '2.1',
        author: mockAuthor, contributors: [mockAuthor2],
        description: 'Traduzione completa di Final Fantasy VI (SNES) dal giapponese all\'italiano. Include tutti i dialoghi, menu, oggetti e magie.',
        totalStrings: 14200, translatedStrings: 14200, completionPercentage: 100,
        rating: 4.8, ratingCount: 127, downloads: 8450, size: 285000,
        tags: ['rpg', 'jrpg', 'completa', 'square'],
        createdAt: '2025-06-15', updatedAt: '2025-12-01',
        changelog: [{ version: '2.1', date: '2025-12-01', changes: ['Fix nomi magie', 'Correzioni typo'] }],
        files: [{ name: 'ff6_ita.ips', path: 'ff6_ita.ips', type: 'ips', size: 285000, stringCount: 0 }],
        status: 'featured', compatibility: ['SNES', 'bsnes', 'snes9x'],
        patchFormat: 'ips', patchInstructions: 'Applicare alla ROM giapponese v1.0 (no header)'
      },
      {
        id: 'mock_ct_snes', name: 'Chrono Trigger - Italiano v3.0',
        gameId: 'chrono_trigger', gameName: 'Chrono Trigger', platform: 'snes',
        sourceLanguage: 'en', targetLanguage: 'it', version: '3.0',
        author: mockAuthor2, contributors: [],
        description: 'Traduzione italiana di Chrono Trigger per SNES. Basata sulla versione USA.',
        totalStrings: 11800, translatedStrings: 11800, completionPercentage: 100,
        rating: 4.9, ratingCount: 203, downloads: 12300, size: 312000,
        tags: ['rpg', 'jrpg', 'completa', 'square'],
        createdAt: '2024-11-20', updatedAt: '2025-09-15',
        changelog: [{ version: '3.0', date: '2025-09-15', changes: ['Revisione completa dialoghi', 'Fix encoding'] }],
        files: [{ name: 'ct_ita_v3.bps', path: 'ct_ita_v3.bps', type: 'bps', size: 312000, stringCount: 0 }],
        status: 'verified', compatibility: ['SNES', 'bsnes', 'snes9x', 'RetroArch'],
        patchFormat: 'bps', patchInstructions: 'Applicare alla ROM USA (CRC32: 2D5B6954)'
      },
      {
        id: 'mock_mother3_gba', name: 'Mother 3 - Fan Translation IT',
        gameId: 'mother3', gameName: 'Mother 3', platform: 'gba',
        sourceLanguage: 'ja', targetLanguage: 'it', version: '1.5',
        author: mockAuthor, contributors: [mockAuthor2],
        description: 'Traduzione italiana completa di Mother 3 per GBA, basata sulla fan translation inglese di Tomato.',
        totalStrings: 18500, translatedStrings: 17200, completionPercentage: 93,
        rating: 4.5, ratingCount: 89, downloads: 5600, size: 1240000,
        tags: ['rpg', 'nintendo', 'earthbound'],
        createdAt: '2025-03-10', updatedAt: '2025-11-22',
        changelog: [{ version: '1.5', date: '2025-11-22', changes: ['Tradotti NPC secondari', 'Fix font'] }],
        files: [{ name: 'mother3_ita.bps', path: 'mother3_ita.bps', type: 'bps', size: 1240000, stringCount: 0 }],
        status: 'verified', compatibility: ['GBA', 'mGBA', 'VBA-M', 'RetroArch'],
        patchFormat: 'bps'
      },
      {
        id: 'mock_dq5_snes', name: 'Dragon Quest V - Italiano',
        gameId: 'dq5', gameName: 'Dragon Quest V', platform: 'snes',
        sourceLanguage: 'ja', targetLanguage: 'it', version: '1.0',
        author: mockAuthor2, contributors: [],
        description: 'Prima traduzione italiana di Dragon Quest V per Super Famicom.',
        totalStrings: 9800, translatedStrings: 7200, completionPercentage: 73,
        rating: 4.0, ratingCount: 34, downloads: 1890, size: 198000,
        tags: ['rpg', 'jrpg', 'enix', 'wip'],
        createdAt: '2025-08-01', updatedAt: '2026-01-10',
        changelog: [{ version: '1.0', date: '2026-01-10', changes: ['Release iniziale - storia principale tradotta'] }],
        files: [{ name: 'dq5_ita.ips', path: 'dq5_ita.ips', type: 'ips', size: 198000, stringCount: 0 }],
        status: 'published', compatibility: ['SNES', 'bsnes', 'snes9x'],
        patchFormat: 'ips'
      },
      {
        id: 'mock_fe7_gba', name: 'Fire Emblem: Blazing Blade - ITA',
        gameId: 'fe7', gameName: 'Fire Emblem: The Blazing Blade', platform: 'gba',
        sourceLanguage: 'en', targetLanguage: 'it', version: '2.0',
        author: mockAuthor, contributors: [],
        description: 'Traduzione italiana di Fire Emblem 7 (Blazing Blade) per GBA. Tutti i dialoghi e menu tradotti.',
        totalStrings: 22000, translatedStrings: 22000, completionPercentage: 100,
        rating: 4.7, ratingCount: 156, downloads: 9200, size: 520000,
        tags: ['srpg', 'nintendo', 'completa'],
        createdAt: '2025-01-05', updatedAt: '2025-10-18',
        changelog: [{ version: '2.0', date: '2025-10-18', changes: ['Revisione dialoghi supporto', 'Fix nomi armi'] }],
        files: [{ name: 'fe7_ita_v2.bps', path: 'fe7_ita_v2.bps', type: 'bps', size: 520000, stringCount: 0 }],
        status: 'featured', compatibility: ['GBA', 'mGBA', 'VBA-M'],
        patchFormat: 'bps'
      },
      {
        id: 'mock_megaman_nes', name: 'Mega Man 2 - Italiano',
        gameId: 'megaman2', gameName: 'Mega Man 2', platform: 'nes',
        sourceLanguage: 'en', targetLanguage: 'it', version: '1.0',
        author: mockAuthor2, contributors: [],
        description: 'Traduzione dei testi di Mega Man 2 per NES. Include schermate, menu e testi boss.',
        totalStrings: 320, translatedStrings: 320, completionPercentage: 100,
        rating: 4.2, ratingCount: 45, downloads: 3100, size: 8500,
        tags: ['action', 'capcom', 'completa'],
        createdAt: '2025-05-20', updatedAt: '2025-05-20',
        changelog: [{ version: '1.0', date: '2025-05-20', changes: ['Release iniziale'] }],
        files: [{ name: 'mm2_ita.ips', path: 'mm2_ita.ips', type: 'ips', size: 8500, stringCount: 0 }],
        status: 'verified', compatibility: ['NES', 'Mesen', 'FCEUX', 'RetroArch'],
        patchFormat: 'ips'
      },
      {
        id: 'mock_pokegold_gbc', name: 'Pokemon Oro - Retraduzione Italiana',
        gameId: 'pokemon_gold', gameName: 'Pokemon Gold', platform: 'gbc',
        sourceLanguage: 'en', targetLanguage: 'it', version: '1.2',
        author: mockAuthor, contributors: [mockAuthor2],
        description: 'Retraduzione completa di Pokemon Oro per Game Boy Color, con nomi Pokemon aggiornati e dialoghi migliorati.',
        totalStrings: 8900, translatedStrings: 8900, completionPercentage: 100,
        rating: 4.6, ratingCount: 178, downloads: 11500, size: 145000,
        tags: ['rpg', 'nintendo', 'pokemon', 'completa'],
        createdAt: '2025-02-14', updatedAt: '2025-08-30',
        changelog: [{ version: '1.2', date: '2025-08-30', changes: ['Fix nomi Pokemon Gen2', 'Correzioni testi palestra'] }],
        files: [{ name: 'pokegold_ita.bps', path: 'pokegold_ita.bps', type: 'bps', size: 145000, stringCount: 0 }],
        status: 'featured', compatibility: ['GBC', 'Gambatte', 'BGB', 'RetroArch'],
        patchFormat: 'bps'
      },
      {
        id: 'mock_ff7_ps1', name: 'Final Fantasy VII - Retraduzione ITA',
        gameId: 'ff7', gameName: 'Final Fantasy VII', platform: 'ps1',
        sourceLanguage: 'en', targetLanguage: 'it', version: '1.8',
        author: mockAuthor, contributors: [],
        description: 'Retraduzione completa di Final Fantasy VII PS1 con nomi corretti, dialoghi migliorati e fix encoding.',
        totalStrings: 32000, translatedStrings: 31500, completionPercentage: 98,
        rating: 4.9, ratingCount: 312, downloads: 18700, size: 2800000,
        tags: ['rpg', 'jrpg', 'square', 'completa'],
        createdAt: '2024-09-01', updatedAt: '2026-02-15',
        changelog: [{ version: '1.8', date: '2026-02-15', changes: ['Fix dialoghi Disco 3', 'Nomi magie revisionati'] }],
        files: [{ name: 'ff7_retrad_ita.bps', path: 'ff7_retrad_ita.bps', type: 'bps', size: 2800000, stringCount: 0 }],
        status: 'featured', compatibility: ['PS1', 'DuckStation', 'ePSXe', 'RetroArch'],
        patchFormat: 'bps', patchInstructions: 'Applicare al BIN del Disco 1 USA (SCUS-94163)'
      },
    ];
  }

  private getMockReviews(packId: string): PackReview[] {
    // Dati mock rimossi
    return [];
  }

  private getMockActivity(): ActivityItem[] {
    // Dati mock rimossi
    return [];
  }
}

export const communityHubService = new CommunityHubService();
export default communityHubService;
