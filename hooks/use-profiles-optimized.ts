/**
 * Hook ottimizzato per la gestione profili con cache e preloading
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@/lib/tauri-api';
import { profileCache, ProfileMetadata } from '@/lib/profile-cache';
import { profilePreloader, PreloadedProfile } from '@/lib/profile-preloader';

export interface Profile {
  id: string;
  name: string;
  avatar?: string;
  lastAccess: number;
  isLocked: boolean;
  hasCredentials: boolean;
}

export interface UseProfilesOptimizedReturn {
  profiles: Profile[];
  currentProfile: Profile | null;
  isLoading: boolean;
  isPreloading: boolean;
  error: string | null;
  
  // Actions
  loadProfiles: () => Promise<void>;
  createProfile: (name: string, password: string) => Promise<void>;
  deleteProfile: (profileId: string, password: string) => Promise<void>;
  login: (profileId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Optimized methods
  getPreloadedProfiles: () => PreloadedProfile[];
  isProfileReady: (profileId: string) => boolean;
  priorityLoadProfile: (profileId: string) => Promise<Profile | null>;
  
  // Cache management
  refreshCache: () => Promise<void>;
  getCacheStats: () => any;
}

export function useProfilesOptimized(): UseProfilesOptimizedReturn {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadingRef = useRef(false);
  const preloadingRef = useRef(false);

  /**
   * Carica profili con ottimizzazioni cache
   */
  const loadProfiles = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Prima prova a caricare dalla cache
      const cachedProfiles = profileCache.getCachedProfiles();
      
      if (cachedProfiles && cachedProfiles.length > 0) {
        // Usa cache per rendering immediato
        const profilesFromCache: Profile[] = cachedProfiles.map(cached => ({
          id: cached.id,
          name: cached.name,
          avatar: cached.avatar,
          lastAccess: cached.lastAccess,
          isLocked: cached.isLocked,
          hasCredentials: cached.hasCredentials
        }));
        
        setProfiles(profilesFromCache);
        
        // Avvia preloading in background
        startBackgroundPreloading();
      }

      // Carica sempre dal backend per dati aggiornati
      const response = await invoke<any>('list_profiles');
      
      if (response.success) {
        const backendProfiles = response.data || [];
        const formattedProfiles: Profile[] = backendProfiles.map((profile: any) => ({
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar_path,
          lastAccess: profile.last_accessed || 0,
          isLocked: profile.is_locked || false,
          hasCredentials: profile.has_credentials || false
        }));

        setProfiles(formattedProfiles);

        // Aggiorna cache
        const metadata: ProfileMetadata[] = formattedProfiles.map(profile => ({
          id: profile.id,
          name: profile.name,
          avatar: profile.avatar,
          lastAccess: profile.lastAccess,
          isLocked: profile.isLocked,
          hasCredentials: profile.hasCredentials,
          settingsVersion: 1
        }));

        profileCache.updateCache(metadata);
      } else {
        setError(response.error || 'Errore caricamento profili');
      }

    } catch (err) {
      console.error('Error loading profiles:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  /**
   * Avvia preloading in background
   */
  const startBackgroundPreloading = useCallback(async () => {
    if (preloadingRef.current) return;
    preloadingRef.current = true;
    setIsPreloading(true);

    try {
      await profilePreloader.startPreloading();
    } catch (error) {
      console.error('Error during background preloading:', error);
    } finally {
      setIsPreloading(false);
      preloadingRef.current = false;
    }
  }, []);

  /**
   * Crea nuovo profilo
   */
  const createProfile = useCallback(async (name: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await invoke<any>('create_profile', { 
        request: { name, password, avatar_path: null }
      });
      
      if (response.success) {
        await loadProfiles(); // Ricarica lista profili
        
        // Aggiorna cache
        profileCache.clearCache(); // Forza refresh cache
      } else {
        setError(response.error || 'Errore creazione profilo');
      }
    } catch (err) {
      console.error('Error creating profile:', err);
      setError(err instanceof Error ? err.message : 'Errore creazione profilo');
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles]);

  /**
   * Elimina profilo
   */
  const deleteProfile = useCallback(async (profileId: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await invoke<any>('delete_profile', { profileId, password });
      
      if (response.success) {
        // Rimuovi dalla cache
        profileCache.removeProfileFromCache(profileId);
        
        // Ricarica profili
        await loadProfiles();
      } else {
        setError(response.error || 'Errore eliminazione profilo');
      }
    } catch (err) {
      console.error('Error deleting profile:', err);
      setError(err instanceof Error ? err.message : 'Errore eliminazione profilo');
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles]);

  /**
   * Login ottimizzato
   */
  const login = useCallback(async (profileId: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const profile = profiles.find(p => p.id === profileId);
      if (!profile) {
        throw new Error('Profilo non trovato');
      }

      const response = await invoke<any>('authenticate_profile', { name: profile.name, password });
      
      if (response.success) {
        if (profile) {
          setCurrentProfile(profile);
          
          // Aggiorna ultimo accesso in cache
          profileCache.updateProfileInCache(profileId, {
            lastAccess: Date.now()
          });
        }
      } else {
        setError(response.error || 'Errore autenticazione');
      }
    } catch (err) {
      console.error('Error during login:', err);
      setError(err instanceof Error ? err.message : 'Errore login');
    } finally {
      setIsLoading(false);
    }
  }, [profiles]);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      await invoke('logout');
      setCurrentProfile(null);
    } catch (err) {
      console.error('Error during logout:', err);
    }
  }, []);

  /**
   * Ottieni profili preloaded
   */
  const getPreloadedProfiles = useCallback(() => {
    return profilePreloader.getAllPreloadedProfiles();
  }, []);

  /**
   * Verifica se profilo è pronto
   */
  const isProfileReady = useCallback((profileId: string) => {
    return profilePreloader.isProfileReady(profileId);
  }, []);

  /**
   * Caricamento prioritario di un profilo
   */
  const priorityLoadProfile = useCallback(async (profileId: string): Promise<Profile | null> => {
    try {
      const preloaded = await profilePreloader.priorityPreload(profileId);
      if (!preloaded) return null;

      return {
        id: preloaded.id,
        name: preloaded.name,
        avatar: preloaded.avatar,
        lastAccess: preloaded.lastAccess,
        isLocked: false,
        hasCredentials: true
      };
    } catch (error) {
      console.error('Error in priority load:', error);
      return null;
    }
  }, []);

  /**
   * Refresh cache
   */
  const refreshCache = useCallback(async () => {
    profileCache.clearCache();
    await loadProfiles();
  }, [loadProfiles]);

  /**
   * Ottieni statistiche cache
   */
  const getCacheStats = useCallback(() => {
    return {
      cache: profileCache.getCacheStats(),
      preloader: profilePreloader.getStats()
    };
  }, []);

  // Carica profili all'avvio
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Cleanup
  useEffect(() => {
    return () => {
      profilePreloader.clearPreloaded();
    };
  }, []);

  return {
    profiles,
    currentProfile,
    isLoading,
    isPreloading,
    error,
    
    loadProfiles,
    createProfile,
    deleteProfile,
    login,
    logout,
    
    getPreloadedProfiles,
    isProfileReady,
    priorityLoadProfile,
    
    refreshCache,
    getCacheStats
  };
}