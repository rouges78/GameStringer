'use client';

import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { 
  UserProfile, 
  ProfileInfo, 
  CreateProfileRequest, 
  UseProfilesReturn,
  ProfileResponse 
} from '@/types/profiles';
import { ensureArray } from '@/lib/array-utils';
import { profileCache } from '@/lib/profile-cache';
import { profilePreloader } from '@/lib/profile-preloader';
import { clientLogger } from '@/lib/client-logger';

export const ProfilesContext = createContext<UseProfilesReturn | null>(null);

export { ProfilesProvider } from '@/hooks/profiles-provider';

// Broadcast helper for cross-instance synchronization
const dispatchAuthChanged = () => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('profile-auth-changed'));
    }
  } catch (e: unknown) {
    clientLogger.warn(`dispatchAuthChanged failed: ${String(e)}`);
  }
};

/**
 * Hook pubblico — legge dal Context se disponibile (zero fetch aggiuntivi),
 * altrimenti crea una istanza standalone (backward-compat per test/storybook).
 */
export function useProfiles(): UseProfilesReturn {
  const ctx = useContext(ProfilesContext);
  if (ctx) return ctx;
  // Fallback standalone se usato fuori dal Provider (non dovrebbe succedere in prod)
  return useProfilesCore();
}

// ============================================================
// Core — logica interna (usata dal Provider)
// ============================================================

export function useProfilesCore(): UseProfilesReturn {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carica lista profili
  const loadProfiles = useCallback(async () => {
    try {
      setError(null);
      
      // Timeout per attendere il backend Tauri
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Backend timeout')), 10000)
      );
      
      const invokePromise = invoke<ProfileResponse<ProfileInfo[]>>('list_profiles');
      
      const response = await Promise.race([invokePromise, timeoutPromise]) as ProfileResponse<ProfileInfo[]>;
      
      if (response.success && response.data) {
        // Proteggi array da valori non validi
        const safeProfiles = ensureArray<ProfileInfo>(response.data);
        setProfiles(safeProfiles);
      } else {
        setError(response.error || 'Errore caricamento profili');
        setProfiles([]);
      }
    } catch (err: unknown) {
      clientLogger.error(`Errore caricamento profili: ${String(err)}`);
      setError('Backend Tauri non disponibile - attendere avvio completo');
      setProfiles([]);
    }
  }, []);

  // Carica profilo corrente
  const loadCurrentProfile = useCallback(async () => {
    try {
      // Timeout per attendere il backend Tauri
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Backend timeout')), 10000)
      );
      
      const invokePromise = invoke<ProfileResponse<UserProfile | null>>('get_current_profile');
      
      const response = await Promise.race([invokePromise, timeoutPromise]) as ProfileResponse<UserProfile | null>;
      
      if (response.success) {
        setCurrentProfile(response.data || null);
      } else {
        clientLogger.warn(`⚠️ useProfiles: get_current_profile failed: ${response.error}`);
        setCurrentProfile(null);
      }
    } catch (err: unknown) {
      clientLogger.error(`❌ useProfiles: Errore caricamento profilo corrente: ${String(err)}`);
      setCurrentProfile(null);
    }
  }, []);

  // Inizializzazione - SENZA DIPENDENZE per evitare loop infinito
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadProfiles(),
          loadCurrentProfile()
        ]);
      } catch (error: unknown) {
        clientLogger.error(`❌ useProfiles: Errore durante inizializzazione sistema profili: ${String(error)}`);
        setError('Errore inizializzazione sistema profili');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []); // NESSUNA DIPENDENZA per evitare loop infinito

  // Listen for auth changes from other instances and refresh current profile
  useEffect(() => {
    const handler = () => {
      loadCurrentProfile().catch(err => clientLogger.warn(`useProfiles loadCurrentProfile error: ${String(err)}`));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('profile-auth-changed', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('profile-auth-changed', handler);
      }
    };
  }, [loadCurrentProfile]);

  // Crea nuovo profilo
  const createProfile = useCallback(async (request: CreateProfileRequest): Promise<boolean> => {
    try {
      setError(null);
      clientLogger.debug(`Creazione profilo con request: ${JSON.stringify(request)}`);
      const response = await invoke<ProfileResponse<UserProfile>>('create_profile', { request });
      clientLogger.debug(`Risposta creazione profilo: ${JSON.stringify(response)}`);
      
      if (response.success && response.data) {
        // Ricarica lista profili
        await loadProfiles();
        // Imposta come profilo corrente
        setCurrentProfile(response.data);
        // Notify other instances
        dispatchAuthChanged();
        return true;
      } else {
        clientLogger.error(`Errore creazione profilo: ${response.error}`);
        setError(response.error || 'Errore creazione profilo');
        return false;
      }
    } catch (err: unknown) {
      clientLogger.error(`Errore creazione profilo: ${String(err)}`);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [loadProfiles]);

  // Autentica profilo con transizione fluida
  const authenticateProfile = useCallback(async (name: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      clientLogger.debug('🔐 useProfiles: Tentativo autenticazione per:', name);
      
      const response = await invoke<ProfileResponse<UserProfile>>('authenticate_profile', { 
        name, 
        password 
      });
      
      if (response.success && response.data) {
        clientLogger.debug('✅ useProfiles: Autenticazione riuscita per:', response.data.name);
        
        // Transizione fluida - aggiorna stato senza ricaricare tutto
        setCurrentProfile(response.data);
        // Notify other instances immediately
        dispatchAuthChanged();
        
        // Aggiorna session persistence in background
        setTimeout(async () => {
          try {
            const { sessionPersistence } = await import('@/lib/session-persistence');
            await sessionPersistence.syncWithBackend();
            clientLogger.debug('🔄 Session persistence sincronizzata');
          } catch (error: unknown) {
            clientLogger.warn(`⚠️ Errore sync session persistence: ${String(error)}`);
          }
        }, 100);
        
        // Ricarica profili in background senza bloccare UI
        setTimeout(() => {
          loadProfiles().catch(error => {
            clientLogger.warn(`⚠️ Errore ricarica profili in background: ${String(error)}`);
          });
        }, 500);
        
        clientLogger.debug('🔄 useProfiles: Transizione completata, currentProfile impostato');
        return true;
      } else {
        clientLogger.error(`❌ useProfiles: Autenticazione fallita: ${response.error}`);
        setError(response.error || 'Errore autenticazione');
        return false;
      }
    } catch (err: unknown) {
      clientLogger.error(`❌ useProfiles: Errore autenticazione profilo: ${String(err)}`);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [loadProfiles]);

  // Cambia profilo con transizione fluida
  const switchProfile = useCallback(async (name: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      clientLogger.debug('🔄 useProfiles: Cambio profilo a:', name);
      
      const response = await invoke<ProfileResponse<UserProfile>>('switch_profile', { 
        name, 
        password 
      });
      
      if (response.success && response.data) {
        clientLogger.debug('✅ useProfiles: Cambio profilo riuscito per:', response.data.name);
        
        // Transizione fluida - aggiorna stato immediatamente
        setCurrentProfile(response.data);
        // Notify other instances
        dispatchAuthChanged();
        
        // Aggiorna session persistence in background
        setTimeout(async () => {
          try {
            const { sessionPersistence } = await import('@/lib/session-persistence');
            await sessionPersistence.syncWithBackend();
            clientLogger.debug('🔄 Session persistence sincronizzata dopo switch');
          } catch (error: unknown) {
            clientLogger.warn(`⚠️ Errore sync session persistence dopo switch: ${String(error)}`);
          }
        }, 100);
        
        // Ricarica lista in background per aggiornare last_accessed
        setTimeout(() => {
          loadProfiles().catch(error => {
            clientLogger.warn(`⚠️ Errore ricarica profili dopo switch: ${String(error)}`);
          });
        }, 500);
        
        clientLogger.debug('🔄 useProfiles: Switch completato senza riavvio');
        return true;
      } else {
        clientLogger.error(`❌ useProfiles: Errore cambio profilo: ${response.error}`);
        setError(response.error || 'Errore cambio profilo');
        return false;
      }
    } catch (err: unknown) {
      clientLogger.error(`❌ useProfiles: Errore cambio profilo: ${String(err)}`);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [loadProfiles]);

  // Logout
  const logout = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const response = await invoke<ProfileResponse<boolean>>('logout');
      
      if (response.success) {
        setCurrentProfile(null);
        // Clear persisted profile for chat bridge
        try { localStorage.removeItem('gamestringer_current_profile'); } catch {}
        // Pulisci cache per evitare avatar stale
        profileCache.clearCache();
        profilePreloader.clearPreloaded();
        // Notify other instances
        dispatchAuthChanged();
        return true;
      } else {
        setError(response.error || 'Errore logout');
        return false;
      }
    } catch (err: unknown) {
      clientLogger.error(`Errore logout: ${String(err)}`);
      setError('Errore di connessione al backend');
      return false;
    }
  }, []);

  // Ricarica profili
  const refreshProfiles = useCallback(async () => {
    await Promise.all([
      loadProfiles(),
      loadCurrentProfile()
    ]);
  }, [loadProfiles, loadCurrentProfile]);

  // Elimina profilo
  const deleteProfile = useCallback(async (profileId: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      const response = await invoke<ProfileResponse<boolean>>('delete_profile', { 
        profileId, 
        password 
      });
      
      if (response.success) {
        // Ricarica lista profili
        await loadProfiles();
        // If the deleted profile was current, other instances should refresh
        dispatchAuthChanged();
        return true;
      } else {
        setError(response.error || 'Errore eliminazione profilo');
        return false;
      }
    } catch (err: unknown) {
      clientLogger.error(`Errore eliminazione profilo: ${String(err)}`);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [loadProfiles]);

  // Ottieni avatar profilo
  const getProfileAvatar = useCallback(async (profileId: string): Promise<string | null> => {
    try {
      const response = await invoke<ProfileResponse<string | null>>('get_profile_avatar', { 
        profileId 
      });
      
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err: unknown) {
      clientLogger.error(`Errore recupero avatar: ${String(err)}`);
      return null;
    }
  }, []);

  // Aggiorna avatar profilo
  const updateProfileAvatar = useCallback(async (profileId: string, avatarPath: string | null): Promise<boolean> => {
    try {
      const response = await invoke<ProfileResponse<boolean>>('update_profile_avatar', { 
        profileId,
        avatarPath
      });
      
      if (response.success) {
        // Ricarica i profili per aggiornare l'UI
        await loadProfiles();
        
        // Se il profilo aggiornato è quello corrente, ricaricalo
        if (currentProfile && currentProfile.id === profileId) {
          // Aggiornamento ottimistico locale per feedback immediato
          setCurrentProfile(prev => prev ? { ...prev, avatar_path: avatarPath ?? undefined } : null);
          
          // Ricarica completa in background per sicurezza
          loadCurrentProfile().catch(console.warn);
          
          // Notifica altre istanze
          dispatchAuthChanged();
        }
        
        return true;
      }
      return false;
    } catch (err: unknown) {
      clientLogger.error(`Errore aggiornamento avatar: ${String(err)}`);
      return false;
    }
  }, [loadProfiles, currentProfile, loadCurrentProfile]);

  return {
    profiles,
    currentProfile,
    isLoading,
    error,
    createProfile,
    authenticateProfile,
    switchProfile,
    logout,
    refreshProfiles,
    deleteProfile,
    getProfileAvatar,
    updateProfileAvatar,
  };
}