/**
 * 🌐 Community Translation Hub Service
 * 
 * Gestisce la condivisione di traduzioni tra utenti.
 * Storage locale con possibilità di sync futuro con server.
 */

import { invoke } from '@/lib/tauri-api';

export interface TranslationPack {
  id: string;
  name: string;
  gameId: string;
  gameName: string;
  gameAppId?: number;
  coverImage?: string;
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
  type: 'json' | 'po' | 'csv' | 'resx' | 'xliff' | 'langdb';
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
  sourceLanguage?: string;
  targetLanguage?: string;
  minRating?: number;
  minCompletion?: number;
  status?: string[];
  tags?: string[];
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
      compatibility: []
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
    return 'json';
  }

  private getMockPacks(): TranslationPack[] {
    // Dati mock rimossi - ora il Community Hub usa solo dati reali
    return [];
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
