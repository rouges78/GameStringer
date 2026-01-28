'use client';

import { useState, useEffect, useCallback } from 'react';
import { safeInvoke } from '@/lib/tauri-wrapper';
import { 
  ProfileSettings, 
  GlobalSettings, 
  UseProfileSettingsReturn,
  ProfileResponse,
  DEFAULT_PROFILE_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS
} from '@/types/profiles';

export function useProfileSettings(): UseProfileSettingsReturn {
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carica settings del profilo corrente
  const loadCurrentSettings = useCallback(async () => {
    try {
      setError(null);
      const response = await safeInvoke<ProfileResponse<ProfileSettings | null>>('get_current_profile_settings');
      
      if (response.success) {
        setSettings(response.data || DEFAULT_PROFILE_SETTINGS);
      } else {
        setError(response.error || 'Errore caricamento settings');
        setSettings(DEFAULT_PROFILE_SETTINGS);
      }
    } catch (err) {
      console.error('Errore caricamento settings profilo:', err);
      setError('Errore di connessione al backend');
      setSettings(DEFAULT_PROFILE_SETTINGS);
    }
  }, []);

  // Carica settings globali
  const loadGlobalSettings = useCallback(async () => {
    try {
      const response = await safeInvoke<ProfileResponse<GlobalSettings>>('load_global_settings');
      
      if (response.success && response.data) {
        setGlobalSettings({ ...DEFAULT_GLOBAL_SETTINGS, ...response.data });
      } else {
        setGlobalSettings(DEFAULT_GLOBAL_SETTINGS);
      }
    } catch (err) {
      console.error('Errore caricamento settings globali:', err);
      setGlobalSettings(DEFAULT_GLOBAL_SETTINGS);
    }
  }, []);

  // Inizializzazione
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      await Promise.all([
        loadCurrentSettings(),
        loadGlobalSettings()
      ]);
      setIsLoading(false);
    };

    initialize();
  }, [loadCurrentSettings, loadGlobalSettings]);

  // Aggiorna settings del profilo corrente
  const updateSettings = useCallback(async (newSettings: Partial<ProfileSettings>): Promise<boolean> => {
    if (!settings) return false;

    try {
      setError(null);
      const updatedSettings = { ...settings, ...newSettings };
      
      const response = await safeInvoke<ProfileResponse<boolean>>('save_current_profile_settings', { 
        settings: updatedSettings 
      });
      
      if (response.success) {
        setSettings(updatedSettings);
        return true;
      } else {
        setError(response.error || 'Errore salvataggio settings');
        return false;
      }
    } catch (err) {
      console.error('Errore aggiornamento settings:', err);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [settings]);

  // Aggiorna settings globali
  const updateGlobalSettings = useCallback(async (newSettings: Partial<GlobalSettings>): Promise<boolean> => {
    try {
      setError(null);
      const updatedSettings = { ...globalSettings, ...newSettings };
      
      const response = await safeInvoke<ProfileResponse<boolean>>('save_global_settings', { 
        settings: updatedSettings 
      });
      
      if (response.success) {
        setGlobalSettings(updatedSettings);
        return true;
      } else {
        setError(response.error || 'Errore salvataggio settings globali');
        return false;
      }
    } catch (err) {
      console.error('Errore aggiornamento settings globali:', err);
      setError('Errore di connessione al backend');
      return false;
    }
  }, [globalSettings]);

  // Reset a valori di default
  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    return await updateSettings(DEFAULT_PROFILE_SETTINGS);
  }, [updateSettings]);

  return {
    settings,
    globalSettings,
    isLoading,
    error,
    updateSettings,
    updateGlobalSettings,
    resetToDefaults,
  };
}