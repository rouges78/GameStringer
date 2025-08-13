'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import { 
  UserProfile, 
  ProfileInfo, 
  CreateProfileRequest, 
  UseProfilesReturn,
  ProfileResponse 
} from '@/types/profiles';

export function useProfiles(): UseProfilesReturn {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carica lista profili
  const loadProfiles = useCallback(async () => {
    try {
      setError(null);
      const response = await invoke<ProfileResponse<ProfileInfo[]>>('list_profiles');
      
      if (response.success && response.data) {
        setProfiles(response.data);
      } else {
        setError(response.error || 'Errore caricamento profili');
        setProfiles([]);
      }
    } catch (err) {
      console.error('Errore caricamento profili:', err);
      setError('Errore di connessione al backend');
      setProfiles([]);
    }
  }, []);

  // Carica profilo corrente
  const loadCurrentProfile = useCallback(async () => {
    try {
      const response = await invoke<ProfileResponse<UserProfile | null>>('get_current_profile');
      
      console.log('🔍 useProfiles: get_current_profile response:', {
        success: response.success,
        hasData: !!response.data,
        profileName: response.data?.name || 'null',
        profileId: response.data?.id || 'null',
        error: response.error || 'none'
      });
      
      if (response.success) {
        setCurrentProfile(response.data || null);
      } else {
        console.warn('⚠️ useProfiles: get_current_profile failed:', response.error);
        setCurrentProfile(null);
      }
    } catch (err) {
      console.error('❌ useProfiles: Errore caricamento profilo corrente:', err);
      setCurrentProfile(null);
    }
  }, []);

  // Inizializzazione - SENZA DIPENDENZE per evitare loop infinito
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        console.log('🔄 useProfiles: Inizializzazione...');
        await Promise.all([
          loadProfiles(),
          loadCurrentProfile()
        ]);
        console.log('✅ useProfiles: Inizializzazione completata');
      } catch (error) {
        console.error('❌ useProfiles: Errore durante inizializzazione sistema profili:', error);
        setError('Errore inizializzazione sistema profili');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []); // 🚨 NESSUNA DIPENDENZA per evitare loop infinito

  // Crea nuovo profilo
  const createProfile = useCallback(async (request: CreateProfileRequest): Promise<boolean> => {
    try {
      setError(null);
      console.log('Creazione profilo con request:', request);
      const response = await invoke<ProfileResponse<UserProfile>>('create_profile', { request });
      console.log('Risposta creazione profilo:', response);
      
      if (response.success && response.data) {
        // Ricarica lista profili
        await loadProfiles();
        // Imposta come profilo corrente
        setCurrentProfile(response.data);
        return true;
      } else {
        console.error('Errore creazione profilo:', response.error);
        setError(response.error || 'Errore creazione profilo');
        return false;
      }
    } catch (err) {
      console.error('Errore creazione profilo:', err);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [loadProfiles]);

  // Autentica profilo con transizione fluida
  const authenticateProfile = useCallback(async (name: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      console.log('🔐 useProfiles: Tentativo autenticazione per:', name);
      
      const response = await invoke<ProfileResponse<UserProfile>>('authenticate_profile', { 
        name, 
        password 
      });
      
      if (response.success && response.data) {
        console.log('✅ useProfiles: Autenticazione riuscita per:', response.data.name);
        
        // Transizione fluida - aggiorna stato senza ricaricare tutto
        setCurrentProfile(response.data);
        
        // Aggiorna session persistence in background
        setTimeout(async () => {
          try {
            const { sessionPersistence } = await import('@/lib/session-persistence');
            await sessionPersistence.syncWithBackend();
            console.log('🔄 Session persistence sincronizzata');
          } catch (error) {
            console.warn('⚠️ Errore sync session persistence:', error);
          }
        }, 100);
        
        // Ricarica profili in background senza bloccare UI
        setTimeout(() => {
          loadProfiles().catch(error => {
            console.warn('⚠️ Errore ricarica profili in background:', error);
          });
        }, 500);
        
        console.log('🔄 useProfiles: Transizione completata, currentProfile impostato');
        return true;
      } else {
        console.error('❌ useProfiles: Autenticazione fallita:', response.error);
        setError(response.error || 'Errore autenticazione');
        return false;
      }
    } catch (err) {
      console.error('❌ useProfiles: Errore autenticazione profilo:', err);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [loadProfiles]);

  // Cambia profilo con transizione fluida
  const switchProfile = useCallback(async (name: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      console.log('🔄 useProfiles: Cambio profilo a:', name);
      
      const response = await invoke<ProfileResponse<UserProfile>>('switch_profile', { 
        name, 
        password 
      });
      
      if (response.success && response.data) {
        console.log('✅ useProfiles: Cambio profilo riuscito per:', response.data.name);
        
        // Transizione fluida - aggiorna stato immediatamente
        setCurrentProfile(response.data);
        
        // Aggiorna session persistence in background
        setTimeout(async () => {
          try {
            const { sessionPersistence } = await import('@/lib/session-persistence');
            await sessionPersistence.syncWithBackend();
            console.log('🔄 Session persistence sincronizzata dopo switch');
          } catch (error) {
            console.warn('⚠️ Errore sync session persistence dopo switch:', error);
          }
        }, 100);
        
        // Ricarica lista in background per aggiornare last_accessed
        setTimeout(() => {
          loadProfiles().catch(error => {
            console.warn('⚠️ Errore ricarica profili dopo switch:', error);
          });
        }, 500);
        
        console.log('🔄 useProfiles: Switch completato senza riavvio');
        return true;
      } else {
        console.error('❌ useProfiles: Errore cambio profilo:', response.error);
        setError(response.error || 'Errore cambio profilo');
        return false;
      }
    } catch (err) {
      console.error('❌ useProfiles: Errore cambio profilo:', err);
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
        return true;
      } else {
        setError(response.error || 'Errore logout');
        return false;
      }
    } catch (err) {
      console.error('Errore logout:', err);
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
        profile_id: profileId, 
        password 
      });
      
      if (response.success) {
        // Ricarica lista profili
        await loadProfiles();
        return true;
      } else {
        setError(response.error || 'Errore eliminazione profilo');
        return false;
      }
    } catch (err) {
      console.error('Errore eliminazione profilo:', err);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [loadProfiles]);

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
  };
}