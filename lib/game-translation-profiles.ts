// Sistema di profili di traduzione per giochi
export interface TranslationProfile {
  id: string;
  gameName: string;
  processName: string;
  gameVersion?: string;
  language: string;
  translations: TranslationEntry[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    author?: string;
    description?: string;
    tags?: string[];
    isOfficial?: boolean;
    downloadCount?: number;
    rating?: number;
  };
  settings?: {
    autoDetectContext?: boolean;
    caseSensitive?: boolean;
    wholeWordOnly?: boolean;
    regexPatterns?: RegexPattern[];
  };
}

export interface TranslationEntry {
  id: string;
  original: string;
  translated: string;
  context?: string;
  category?: string;
  notes?: string;
  isVerified?: boolean;
  confidence?: number;
  alternatives?: string[];
}

export interface RegexPattern {
  pattern: string;
  replacement: string;
  flags?: string;
  description?: string;
}

// Database locale dei profili (in produzione userebbe un database reale)
class GameTranslationProfileManager {
  private profiles: Map<string, TranslationProfile> = new Map();
  private readonly STORAGE_KEY = 'game-translation-profiles';

  constructor() {
    this.loadFromStorage();
    this.initializeDefaultProfiles();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          Object.entries(data).forEach(([id, profile]) => {
            this.profiles.set(id, profile as TranslationProfile);
          });
        } catch (error) {
          console.error('Errore caricamento profili:', error);
        }
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      const data: Record<string, TranslationProfile> = {};
      this.profiles.forEach((profile, id) => {
        data[id] = profile;
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }
  }

  private initializeDefaultProfiles() {
    // Profili predefiniti per giochi popolari
    const defaultProfiles: TranslationProfile[] = [
      {
        id: 'decarnation-it',
        gameName: 'Decarnation',
        processName: 'Decarnation.exe',
        language: 'it',
        translations: [
          { id: '1', original: 'New Game', translated: 'Nuovo Gioco', category: 'menu', isVerified: true },
          { id: '2', original: 'Continue', translated: 'Continua', category: 'menu', isVerified: true },
          { id: '3', original: 'Options', translated: 'Opzioni', category: 'menu', isVerified: true },
          { id: '4', original: 'Exit', translated: 'Esci', category: 'menu', isVerified: true },
          { id: '5', original: 'Save Game', translated: 'Salva Partita', category: 'menu', isVerified: true },
          { id: '6', original: 'Load Game', translated: 'Carica Partita', category: 'menu', isVerified: true },
          { id: '7', original: 'Settings', translated: 'Impostazioni', category: 'menu', isVerified: true },
          { id: '8', original: 'Credits', translated: 'Crediti', category: 'menu', isVerified: true },
          { id: '9', original: 'Yes', translated: 'Sì', category: 'dialog', isVerified: true },
          { id: '10', original: 'No', translated: 'No', category: 'dialog', isVerified: true },
          { id: '11', original: 'OK', translated: 'OK', category: 'dialog', isVerified: true },
          { id: '12', original: 'Cancel', translated: 'Annulla', category: 'dialog', isVerified: true },
          { id: '13', original: 'Apply', translated: 'Applica', category: 'dialog', isVerified: true },
          { id: '14', original: 'Back', translated: 'Indietro', category: 'navigation', isVerified: true },
          { id: '15', original: 'Next', translated: 'Avanti', category: 'navigation', isVerified: true },
          { id: '16', original: 'Previous', translated: 'Precedente', category: 'navigation', isVerified: true },
          { id: '17', original: 'Skip', translated: 'Salta', category: 'navigation', isVerified: true },
          { id: '18', original: 'Inventory', translated: 'Inventario', category: 'gameplay', isVerified: true },
          { id: '19', original: 'Quest Log', translated: 'Diario Missioni', category: 'gameplay', isVerified: true },
          { id: '20', original: 'Map', translated: 'Mappa', category: 'gameplay', isVerified: true }
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          author: 'GameStringer Team',
          description: 'Traduzione italiana completa per Decarnation',
          tags: ['horror', 'indie', 'adventure'],
          isOfficial: true,
          rating: 5
        },
        settings: {
          autoDetectContext: true,
          caseSensitive: false,
          wholeWordOnly: true
        }
      },
      {
        id: 'hades-it',
        gameName: 'Hades',
        processName: 'Hades.exe',
        language: 'it',
        translations: [
          { id: '1', original: 'Boons', translated: 'Benedizioni', category: 'gameplay', isVerified: true },
          { id: '2', original: 'Keepsakes', translated: 'Ricordi', category: 'gameplay', isVerified: true },
          { id: '3', original: 'Pact of Punishment', translated: 'Patto di Punizione', category: 'gameplay', isVerified: true },
          { id: '4', original: 'Mirror of Night', translated: 'Specchio della Notte', category: 'gameplay', isVerified: true },
          { id: '5', original: 'Contractor', translated: 'Appaltatore', category: 'gameplay', isVerified: true },
          { id: '6', original: 'Codex', translated: 'Codice', category: 'menu', isVerified: true },
          { id: '7', original: 'Give Nectar', translated: 'Dona Nettare', category: 'dialog', isVerified: true },
          { id: '8', original: 'Give Ambrosia', translated: 'Dona Ambrosia', category: 'dialog', isVerified: true },
          { id: '9', original: 'Escape Attempt', translated: 'Tentativo di Fuga', category: 'gameplay', isVerified: true },
          { id: '10', original: 'Heat', translated: 'Calore', category: 'gameplay', isVerified: true }
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          author: 'Community',
          description: 'Traduzioni essenziali per Hades',
          tags: ['roguelike', 'action', 'mythology'],
          isOfficial: false,
          rating: 4.5
        }
      },
      {
        id: 'hollow-knight-it',
        gameName: 'Hollow Knight',
        processName: 'hollow_knight.exe',
        language: 'it',
        translations: [
          { id: '1', original: 'Geo', translated: 'Geo', category: 'gameplay', notes: 'Valuta del gioco, non tradotto', isVerified: true },
          { id: '2', original: 'Soul', translated: 'Anima', category: 'gameplay', isVerified: true },
          { id: '3', original: 'Mask', translated: 'Maschera', category: 'gameplay', isVerified: true },
          { id: '4', original: 'Charm', translated: 'Amuleto', category: 'gameplay', isVerified: true },
          { id: '5', original: 'Bench', translated: 'Panchina', category: 'gameplay', isVerified: true },
          { id: '6', original: 'Stag Station', translated: 'Stazione Cervo', category: 'gameplay', isVerified: true },
          { id: '7', original: 'Dream Nail', translated: 'Aculeo dei Sogni', category: 'gameplay', isVerified: true },
          { id: '8', original: 'Shade', translated: 'Ombra', category: 'gameplay', isVerified: true },
          { id: '9', original: 'Vessel', translated: 'Ricettacolo', category: 'gameplay', isVerified: true },
          { id: '10', original: 'Nail', translated: 'Aculeo', category: 'gameplay', isVerified: true }
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          author: 'Community',
          description: 'Termini chiave di Hollow Knight in italiano',
          tags: ['metroidvania', 'indie', 'platformer'],
          isOfficial: false,
          rating: 4.8
        }
      }
    ];

    // Aggiungi profili predefiniti se non esistono
    defaultProfiles.forEach(profile => {
      if (!this.profiles.has(profile.id)) {
        this.profiles.set(profile.id, profile);
      }
    });

    this.saveToStorage();
  }

  // Crea nuovo profilo
  createProfile(profile: Omit<TranslationProfile, 'id' | 'metadata'>): string {
    const id = `${profile.processName}-${profile.language}-${Date.now()}`;
    const newProfile: TranslationProfile = {
      ...profile,
      id,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'User',
        isOfficial: false
      }
    };

    this.profiles.set(id, newProfile);
    this.saveToStorage();
    return id;
  }

  // Aggiorna profilo esistente
  updateProfile(id: string, updates: Partial<TranslationProfile>): boolean {
    const profile = this.profiles.get(id);
    if (!profile) return false;

    const updatedProfile = {
      ...profile,
      ...updates,
      metadata: {
        ...profile.metadata,
        ...updates.metadata,
        updatedAt: new Date()
      }
    };

    this.profiles.set(id, updatedProfile);
    this.saveToStorage();
    return true;
  }

  // Elimina profilo
  deleteProfile(id: string): boolean {
    const deleted = this.profiles.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  // Ottieni profilo per ID
  getProfile(id: string): TranslationProfile | undefined {
    return this.profiles.get(id);
  }

  // Ottieni profili per processo
  getProfilesByProcess(processName: string): TranslationProfile[] {
    return Array.from(this.profiles.values()).filter(
      profile => profile.processName.toLowerCase() === processName.toLowerCase()
    );
  }

  // Ottieni profili per gioco
  getProfilesByGame(gameName: string): TranslationProfile[] {
    return Array.from(this.profiles.values()).filter(
      profile => profile.gameName.toLowerCase().includes(gameName.toLowerCase())
    );
  }

  // Ottieni tutti i profili
  getAllProfiles(): TranslationProfile[] {
    return Array.from(this.profiles.values());
  }

  // Cerca profili
  searchProfiles(query: string): TranslationProfile[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.profiles.values()).filter(profile => 
      profile.gameName.toLowerCase().includes(lowerQuery) ||
      profile.processName.toLowerCase().includes(lowerQuery) ||
      profile.metadata.description?.toLowerCase().includes(lowerQuery) ||
      profile.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // Importa profilo da JSON
  importProfile(jsonData: string): string | null {
    try {
      const profile = JSON.parse(jsonData) as TranslationProfile;
      const id = this.createProfile(profile);
      return id;
    } catch (error) {
      console.error('Errore importazione profilo:', error);
      return null;
    }
  }

  // Esporta profilo in JSON
  exportProfile(id: string): string | null {
    const profile = this.profiles.get(id);
    if (!profile) return null;

    return JSON.stringify(profile, null, 2);
  }

  // Clona profilo
  cloneProfile(id: string, newName?: string): string | null {
    const profile = this.profiles.get(id);
    if (!profile) return null;

    const clonedProfile = {
      ...profile,
      gameName: newName || `${profile.gameName} (Copia)`,
      metadata: {
        ...profile.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: 'User',
        isOfficial: false
      }
    };

    return this.createProfile(clonedProfile);
  }

  // Unisci profili
  mergeProfiles(sourceIds: string[], targetName: string): string | null {
    const profiles = sourceIds.map(id => this.profiles.get(id)).filter(Boolean) as TranslationProfile[];
    if (profiles.length === 0) return null;

    // Unisci tutte le traduzioni
    const mergedTranslations = new Map<string, TranslationEntry>();
    const allTags = new Set<string>();

    profiles.forEach(profile => {
      profile.translations.forEach(translation => {
        // Usa l'originale come chiave per evitare duplicati
        mergedTranslations.set(translation.original, translation);
      });
      profile.metadata.tags?.forEach(tag => allTags.add(tag));
    });

    const mergedProfile: Omit<TranslationProfile, 'id' | 'metadata'> = {
      gameName: targetName,
      processName: profiles[0].processName,
      language: profiles[0].language,
      translations: Array.from(mergedTranslations.values()),
      settings: profiles[0].settings
    };

    const id = this.createProfile(mergedProfile);
    if (id) {
      // Aggiorna metadata
      this.updateProfile(id, {
        metadata: {
          description: `Profilo unito da ${profiles.map(p => p.gameName).join(', ')}`,
          tags: Array.from(allTags)
        }
      });
    }

    return id;
  }

  // Ottieni statistiche profili
  getStatistics() {
    const profiles = Array.from(this.profiles.values());
    const totalTranslations = profiles.reduce((sum, p) => sum + p.translations.length, 0);
    const languages = new Set(profiles.map(p => p.language));
    const games = new Set(profiles.map(p => p.gameName));

    return {
      totalProfiles: profiles.length,
      totalTranslations,
      totalLanguages: languages.size,
      totalGames: games.size,
      officialProfiles: profiles.filter(p => p.metadata.isOfficial).length,
      communityProfiles: profiles.filter(p => !p.metadata.isOfficial).length,
      averageTranslationsPerProfile: totalTranslations / profiles.length || 0,
      topGames: Array.from(games).slice(0, 5),
      topLanguages: Array.from(languages).slice(0, 5)
    };
  }
}

// Singleton instance
export const translationProfileManager = new GameTranslationProfileManager();
