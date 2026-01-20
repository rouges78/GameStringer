'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';
import {
  NotificationPreferences,
  NotificationType,
  TypePreference,
  DEFAULT_NOTIFICATION_PREFERENCES,
  UseNotificationPreferencesReturn
} from '@/types/notifications';
import { useProfiles } from './use-profiles';

export const useNotificationPreferences = (profileId?: string): UseNotificationPreferencesReturn => {
  // Se non viene fornito un profileId, usa il profilo corrente
  const { currentProfile } = useProfiles();
  const activeProfileId = profileId || currentProfile?.id;
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carica le preferenze - sistema notifiche temporaneamente disabilitato
  const loadPreferences = useCallback(async () => {
    if (!activeProfileId) {
      setIsLoading(false);
      setPreferences(null);
      return;
    }

    // Sistema notifiche disabilitato - usa direttamente i default
    const defaultPrefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      profileId: activeProfileId,
      updatedAt: new Date().toISOString()
    };
    setPreferences(defaultPrefs);
    setIsLoading(false);
  }, [activeProfileId]);

  // Carica le preferenze quando cambia il profilo
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Ricarica le preferenze quando cambia il profilo corrente
  useEffect(() => {
    if (activeProfileId) {
      // Usa il comando di sincronizzazione se disponibile
      const syncPreferences = async () => {
        // Sistema notifiche temporaneamente disabilitato - usa direttamente il fallback
        // Il comando sync_notification_preferences_on_profile_switch non è disponibile
        loadPreferences();
      };

      syncPreferences();
    } else {
      setPreferences(null);
      setIsLoading(false);
    }
  }, [activeProfileId, loadPreferences]);

  // Aggiorna le preferenze
  const updatePreferences = useCallback(async (
    newPreferences: Partial<NotificationPreferences>
  ): Promise<boolean> => {
    if (!preferences || !activeProfileId) {
      setError('Nessun profilo selezionato');
      return false;
    }

    const updatedPreferences: NotificationPreferences = {
      ...preferences,
      ...newPreferences,
      profileId: activeProfileId,
      updatedAt: new Date().toISOString()
    };

    try {
      setError(null);

      let response;
      try {
        response = await invoke('auto_save_notification_preferences', {
          profile_id: activeProfileId,
          preferences: updatedPreferences
        });
      } catch (e) {
        // Se il comando specifico fallisce, prova quello generico
        try {
          response = await invoke('update_notification_preferences', {
            preferences: updatedPreferences
          });
        } catch (innerError) {
          console.warn('Backend notifiche non disponibile, uso salvataggio locale:', innerError);
          // Fallback locale: simula successo e salva in localStorage se possibile
          localStorage.setItem(`notification_prefs_${activeProfileId}`, JSON.stringify(updatedPreferences));
          response = { success: true };
        }
      }

      if (response && response.success) {
        setPreferences(updatedPreferences);
        return true;
      } else {
        setError(response?.error || 'Errore nel salvataggio delle preferenze');
        return false;
      }
    } catch (err) {
      console.error('Errore nell\'aggiornamento delle preferenze:', err);
      // Fallback finale
      localStorage.setItem(`notification_prefs_${activeProfileId}`, JSON.stringify(updatedPreferences));
      setPreferences(updatedPreferences);
      return true;
    }
  }, [preferences, activeProfileId]);

  // Reset alle impostazioni predefinite
  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    if (!activeProfileId) {
      setError('Nessun profilo selezionato');
      return false;
    }

    try {
      setError(null);

      const defaultPrefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        profileId: activeProfileId,
        updatedAt: new Date().toISOString()
      };

      let response;
      try {
        response = await invoke('update_notification_preferences', {
          preferences: defaultPrefs
        });
      } catch (e) {
        console.warn('Backend notifiche non disponibile per reset, uso locale');
        localStorage.removeItem(`notification_prefs_${activeProfileId}`);
        response = { success: true };
      }

      if (response && response.success) {
        setPreferences(defaultPrefs);
        return true;
      } else {
        setError(response?.error || 'Errore nel reset delle preferenze');
        return false;
      }
    } catch (err) {
      console.error('Errore nel reset delle preferenze:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      return false;
    }
  }, [activeProfileId]);

  // Toggle per tipo di notifica
  const toggleNotificationType = useCallback(async (
    type: NotificationType,
    enabled: boolean
  ): Promise<boolean> => {
    if (!preferences) return false;

    return updatePreferences({
      typeSettings: {
        ...preferences.typeSettings,
        [type]: {
          ...preferences.typeSettings[type],
          enabled
        }
      }
    });
  }, [preferences, updatePreferences]);

  // Aggiorna ore di silenzio
  const updateQuietHours = useCallback(async (
    quietHours: NotificationPreferences['quietHours']
  ): Promise<boolean> => {
    return updatePreferences({ quietHours });
  }, [updatePreferences]);

  // Aggiorna impostazione globale
  const updateGlobalSetting = useCallback(async (
    setting: 'globalEnabled' | 'soundEnabled' | 'desktopEnabled',
    value: boolean
  ): Promise<boolean> => {
    return updatePreferences({ [setting]: value });
  }, [updatePreferences]);

  // Aggiorna limiti
  const updateLimits = useCallback(async (
    maxNotifications?: number,
    autoDeleteAfterDays?: number
  ): Promise<boolean> => {
    const updates: Partial<NotificationPreferences> = {};

    if (maxNotifications !== undefined) {
      updates.maxNotifications = maxNotifications;
    }

    if (autoDeleteAfterDays !== undefined) {
      updates.autoDeleteAfterDays = autoDeleteAfterDays;
    }

    return updatePreferences(updates);
  }, [updatePreferences]);

  // Verifica se le notifiche sono abilitate per un tipo specifico
  const isTypeEnabled = useCallback((type: NotificationType): boolean => {
    if (!preferences) return false;
    return preferences.globalEnabled && preferences.typeSettings[type]?.enabled;
  }, [preferences]);

  // Ottieni il numero di tipi di notifica abilitati
  const getEnabledTypesCount = useCallback((): number => {
    if (!preferences) return 0;
    return Object.values(preferences.typeSettings).filter((setting: TypePreference) => setting.enabled).length;
  }, [preferences]);

  // Verifica se siamo in ore di silenzio
  const isInQuietHours = useCallback((): boolean => {
    if (!preferences?.quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { startTime, endTime } = preferences.quietHours;

    // Gestisce il caso in cui le ore di silenzio attraversano la mezzanotte
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }, [preferences]);

  return {
    preferences,
    isLoading,
    error,

    // Actions
    updatePreferences,
    resetToDefaults,
    toggleNotificationType,
    updateQuietHours,
    updateGlobalSetting,
    updateLimits,

    // Utilities
    isTypeEnabled,
    getEnabledTypesCount,
    isInQuietHours,

    // Reload
    reload: loadPreferences
  };
};

export default useNotificationPreferences;