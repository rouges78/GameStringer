// Sistema di profili per giochi
import { GameTranslation, genericTranslations, getTranslationsForProcess } from './game-translations';

export interface GameProfile {
  id: string;
  processName: string;
  gameName: string;
  customTranslations: Record<string, string>;
  useGenericTranslations: boolean;
  useGameSpecificTranslations: boolean;
  memoryAddresses?: MemoryAddress[];
  lastUpdated: Date;
  totalInjections: number;
  enabled: boolean;
}

export interface MemoryAddress {
  address: number;
  original: string;
  translated: string;
  timestamp: Date;
}

export class GameProfileManager {
  private profiles: Map<string, GameProfile> = new Map();
  private storageKey = 'gamestringer_profiles';

  constructor() {
    this.loadProfiles();
  }

  // Carica profili dal localStorage
  private loadProfiles() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          Object.entries(data).forEach(([key, value]) => {
            this.profiles.set(key, value as GameProfile);
          });
        } catch (e) {
          console.error('Errore caricamento profili:', e);
        }
      }
    }
  }

  // Salva profili nel localStorage
  private saveProfiles() {
    if (typeof window !== 'undefined') {
      const data: Record<string, GameProfile> = {};
      this.profiles.forEach((value, key) => {
        data[key] = value;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    }
  }

  // Ottieni o crea profilo per un processo
  public getOrCreateProfile(processName: string, gameName?: string): GameProfile {
    const key = processName.toLowerCase();
    
    if (this.profiles.has(key)) {
      return this.profiles.get(key)!;
    }

    // Crea nuovo profilo
    const profile: GameProfile = {
      id: `profile_${Date.now()}`,
      processName,
      gameName: gameName || processName.replace('.exe', ''),
      customTranslations: {},
      useGenericTranslations: true,
      useGameSpecificTranslations: true,
      memoryAddresses: [],
      lastUpdated: new Date(),
      totalInjections: 0,
      enabled: true
    };

    this.profiles.set(key, profile);
    this.saveProfiles();
    return profile;
  }

  // Aggiorna profilo
  public updateProfile(processName: string, updates: Partial<GameProfile>) {
    const key = processName.toLowerCase();
    const profile = this.getOrCreateProfile(processName);
    
    Object.assign(profile, updates, {
      lastUpdated: new Date()
    });
    
    this.profiles.set(key, profile);
    this.saveProfiles();
  }

  // Aggiungi traduzione custom
  public addCustomTranslation(processName: string, original: string, translated: string) {
    const profile = this.getOrCreateProfile(processName);
    profile.customTranslations[original] = translated;
    this.updateProfile(processName, { customTranslations: profile.customTranslations });
  }

  // Rimuovi traduzione custom
  public removeCustomTranslation(processName: string, original: string) {
    const profile = this.getOrCreateProfile(processName);
    delete profile.customTranslations[original];
    this.updateProfile(processName, { customTranslations: profile.customTranslations });
  }

  // Aggiungi indirizzo di memoria
  public addMemoryAddress(processName: string, address: number, original: string, translated: string) {
    const profile = this.getOrCreateProfile(processName);
    
    // Evita duplicati
    const exists = profile.memoryAddresses?.some(ma => 
      ma.address === address && ma.original === original
    );
    
    if (!exists) {
      const newAddress: MemoryAddress = {
        address,
        original,
        translated,
        timestamp: new Date()
      };
      
      profile.memoryAddresses = [...(profile.memoryAddresses || []), newAddress];
      
      // Mantieni solo gli ultimi 1000 indirizzi
      if (profile.memoryAddresses.length > 1000) {
        profile.memoryAddresses = profile.memoryAddresses.slice(-1000);
      }
      
      this.updateProfile(processName, { memoryAddresses: profile.memoryAddresses });
    }
  }

  // Ottieni tutte le traduzioni per un processo
  public getAllTranslations(processName: string): Record<string, string> {
    const profile = this.getOrCreateProfile(processName);
    let translations: Record<string, string> = {};

    // 1. Traduzioni generiche (priorità più bassa)
    if (profile.useGenericTranslations) {
      translations = { ...genericTranslations };
    }

    // 2. Traduzioni specifiche del gioco (priorità media)
    if (profile.useGameSpecificTranslations) {
      const gameTranslations = getTranslationsForProcess(processName);
      translations = { ...translations, ...gameTranslations };
    }

    // 3. Traduzioni custom (priorità più alta)
    translations = { ...translations, ...profile.customTranslations };

    return translations;
  }

  // Incrementa contatore injection
  public incrementInjectionCount(processName: string, count: number = 1) {
    const profile = this.getOrCreateProfile(processName);
    profile.totalInjections += count;
    this.updateProfile(processName, { totalInjections: profile.totalInjections });
  }

  // Ottieni statistiche
  public getStatistics(processName: string) {
    const profile = this.getOrCreateProfile(processName);
    const translations = this.getAllTranslations(processName);
    
    return {
      totalTranslations: Object.keys(translations).length,
      customTranslations: Object.keys(profile.customTranslations).length,
      totalInjections: profile.totalInjections,
      memoryAddresses: profile.memoryAddresses?.length || 0,
      lastUpdated: profile.lastUpdated,
      enabled: profile.enabled
    };
  }

  // Esporta profilo
  public exportProfile(processName: string): string {
    const profile = this.getOrCreateProfile(processName);
    return JSON.stringify(profile, null, 2);
  }

  // Importa profilo
  public importProfile(data: string): boolean {
    try {
      const profile = JSON.parse(data) as GameProfile;
      if (profile.processName) {
        this.profiles.set(profile.processName.toLowerCase(), profile);
        this.saveProfiles();
        return true;
      }
    } catch (e) {
      console.error('Errore importazione profilo:', e);
    }
    return false;
  }

  // Lista tutti i profili
  public listProfiles(): GameProfile[] {
    return Array.from(this.profiles.values());
  }

  // Elimina profilo
  public deleteProfile(processName: string) {
    const key = processName.toLowerCase();
    this.profiles.delete(key);
    this.saveProfiles();
  }
}

// Singleton instance
export const gameProfileManager = new GameProfileManager();
