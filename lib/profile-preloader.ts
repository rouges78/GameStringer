/**
 * Sistema di preloading per ottimizzare il caricamento dei profili
 */

import { invoke } from '@/lib/tauri-api';
import { profileCache, ProfileMetadata } from './profile-cache';

export interface PreloadedProfile {
  id: string;
  name: string;
  avatar?: string;
  lastAccess: number;
  isReady: boolean;
  error?: string;
}

class ProfilePreloader {
  private preloadedProfiles = new Map<string, PreloadedProfile>();
  private preloadPromises = new Map<string, Promise<void>>();
  private isPreloading = false;

  /**
   * Avvia il preloading dei profili più utilizzati
   */
  async startPreloading(): Promise<void> {
    if (this.isPreloading) return;
    
    this.isPreloading = true;
    
    try {
      // Ottieni profili dalla cache
      const cachedProfiles = profileCache.getCachedProfiles();
      
      if (cachedProfiles && cachedProfiles.length > 0) {
        // Preload profili dalla cache
        await this.preloadFromCache(cachedProfiles);
      } else {
        // Carica profili dal backend se cache non disponibile
        await this.preloadFromBackend();
      }
    } catch (error) {
      console.error('Error during profile preloading:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preload profili dalla cache
   */
  private async preloadFromCache(cachedProfiles: ProfileMetadata[]): Promise<void> {
    const frequentProfiles = cachedProfiles.slice(0, 3); // Top 3 profili più usati
    
    const preloadPromises = frequentProfiles.map(profile => 
      this.preloadProfile(profile.id, profile)
    );

    await Promise.allSettled(preloadPromises);
  }

  /**
   * Preload profili dal backend
   */
  private async preloadFromBackend(): Promise<void> {
    try {
      const response = await invoke<any>('list_profiles');
      if (!response.success) return;

      const profiles = response.data || [];
      const sortedProfiles = profiles
        .sort((a: any, b: any) => {
            const timeA = a.last_accessed ? new Date(a.last_accessed).getTime() : 0;
            const timeB = b.last_accessed ? new Date(b.last_accessed).getTime() : 0;
            return timeB - timeA;
        })
        .slice(0, 3);

      const preloadPromises = sortedProfiles.map((profile: any) => 
        this.preloadProfile(profile.id, {
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar_path,
          lastAccess: profile.last_accessed ? new Date(profile.last_accessed).getTime() : 0,
          isLocked: profile.is_locked || false,
          hasCredentials: profile.has_credentials || false,
          settingsVersion: profile.settings_version || 1
        })
      );

      await Promise.allSettled(preloadPromises);

      // Aggiorna cache con i nuovi dati
      const metadata: ProfileMetadata[] = sortedProfiles.map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar_path,
        lastAccess: profile.last_accessed ? new Date(profile.last_accessed).getTime() : 0,
        isLocked: profile.is_locked || false,
        hasCredentials: profile.has_credentials || false,
        settingsVersion: profile.settings_version || 1
      }));

      profileCache.updateCache(metadata);
    } catch (error) {
      console.error('Error preloading from backend:', error);
    }
  }

  /**
   * Preload di un singolo profilo
   */
  private async preloadProfile(profileId: string, metadata: ProfileMetadata): Promise<void> {
    if (this.preloadPromises.has(profileId)) {
      return this.preloadPromises.get(profileId);
    }

    const promise = this.doPreloadProfile(profileId, metadata);
    this.preloadPromises.set(profileId, promise);
    
    try {
      await promise;
    } finally {
      this.preloadPromises.delete(profileId);
    }
  }

  /**
   * Esegue il preload effettivo di un profilo
   */
  private async doPreloadProfile(profileId: string, metadata: ProfileMetadata): Promise<void> {
    try {
      // Inizializza profilo preloaded
      const preloaded: PreloadedProfile = {
        id: profileId,
        name: metadata.name,
        avatar: metadata.avatar,
        lastAccess: metadata.lastAccess,
        isReady: false
      };

      this.preloadedProfiles.set(profileId, preloaded);

      // Preload metadati aggiuntivi se necessario
      if (metadata.hasCredentials) {
        await this.preloadCredentialMetadata(profileId);
      }

      // Marca come pronto
      preloaded.isReady = true;
      this.preloadedProfiles.set(profileId, preloaded);

    } catch (error) {
      console.error(`Error preloading profile ${profileId}:`, error);
      
      const preloaded = this.preloadedProfiles.get(profileId);
      if (preloaded) {
        preloaded.error = error instanceof Error ? error.message : 'Unknown error';
        this.preloadedProfiles.set(profileId, preloaded);
      }
    }
  }

  /**
   * Preload metadati credenziali per un profilo
   */
  private async preloadCredentialMetadata(profileId: string): Promise<void> {
    // Non è necessario fare una chiamata separata al backend
    return Promise.resolve();
  }

  /**
   * Ottiene un profilo preloaded
   */
  getPreloadedProfile(profileId: string): PreloadedProfile | null {
    return this.preloadedProfiles.get(profileId) || null;
  }

  /**
   * Ottiene tutti i profili preloaded
   */
  getAllPreloadedProfiles(): PreloadedProfile[] {
    return Array.from(this.preloadedProfiles.values())
      .sort((a, b) => b.lastAccess - a.lastAccess);
  }

  /**
   * Verifica se un profilo è pronto
   */
  isProfileReady(profileId: string): boolean {
    const preloaded = this.preloadedProfiles.get(profileId);
    return preloaded?.isReady === true;
  }

  /**
   * Pulisce i profili preloaded
   */
  clearPreloaded(): void {
    this.preloadedProfiles.clear();
    this.preloadPromises.clear();
  }

  /**
   * Ottiene statistiche del preloader
   */
  getStats(): {
    totalPreloaded: number;
    readyProfiles: number;
    errorProfiles: number;
    isPreloading: boolean;
  } {
    const profiles = Array.from(this.preloadedProfiles.values());
    
    return {
      totalPreloaded: profiles.length,
      readyProfiles: profiles.filter(p => p.isReady).length,
      errorProfiles: profiles.filter(p => p.error).length,
      isPreloading: this.isPreloading
    };
  }

  /**
   * Preload prioritario di un profilo specifico
   */
  async priorityPreload(profileId: string): Promise<PreloadedProfile | null> {
    try {
      // Se già preloaded, restituisci
      const existing = this.preloadedProfiles.get(profileId);
      if (existing?.isReady) return existing;

      // Carica metadati dal backend
      const response = await invoke<any>('get_profile_info', { profileId });
      if (!response.success) return null;

      const profile = response.data;
      const metadata: ProfileMetadata = {
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar_path,
        lastAccess: profile.last_accessed ? new Date(profile.last_accessed).getTime() : 0,
        isLocked: profile.is_locked || false,
        hasCredentials: profile.has_credentials || false,
        settingsVersion: profile.settings_version || 1
      };

      await this.preloadProfile(profileId, metadata);
      return this.preloadedProfiles.get(profileId) || null;

    } catch (error) {
      console.error(`Error in priority preload for ${profileId}:`, error);
      return null;
    }
  }
}

// Singleton instance
export const profilePreloader = new ProfilePreloader();