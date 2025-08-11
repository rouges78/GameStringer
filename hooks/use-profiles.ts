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
      
      if (response.success) {
        setCurrentProfile(response.data || null);
      } else {
        setCurrentProfile(null);
      }
    } catch (err) {
      console.error('Errore caricamento profilo corrente:', err);
      setCurrentProfile(null);
    }
  }, []);

  // Inizializzazione
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadProfiles(),
          loadCurrentProfile()
        ]);
      } catch (error) {
        console.error('Errore durante inizializzazione sistema profili:', error);
        setError('Errore inizializzazione sistema profili');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [loadProfiles, loadCurrentProfile]);

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

  // Autentica profilo
  const authenticateProfile = useCallback(async (name: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      const response = await invoke<ProfileResponse<UserProfile>>('authenticate_profile', { 
        name, 
        password 
      });
      
      if (response.success && response.data) {
        setCurrentProfile(response.data);
        // Ricarica lista per aggiornare last_accessed
        await loadProfiles();
        return true;
      } else {
        setError(response.error || 'Errore autenticazione');
        return false;
      }
    } catch (err) {
      console.error('Errore autenticazione profilo:', err);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [loadProfiles]);

  // Cambia profilo
  const switchProfile = useCallback(async (name: string, password: string): Promise<boolean> => {
    try {
      setError(null);
      const response = await invoke<ProfileResponse<UserProfile>>('switch_profile', { 
        name, 
        password 
      });
      
      if (response.success && response.data) {
        setCurrentProfile(response.data);
        // Ricarica lista per aggiornare last_accessed
        await loadProfiles();
        return true;
      } else {
        setError(response.error || 'Errore cambio profilo');
        return false;
      }
    } catch (err) {
      console.error('Errore cambio profilo:', err);
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