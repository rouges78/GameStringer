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

  // Carica le preferenze dal backend
  const loadPreferences = useCallback(async () => {
    if (!activeProfileId) {
      setIsLoading(false);
      setPreferences(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await invoke('get_notification_preferences', {
        profile_id: activeProfileId
      });

      if (response.success && response.data) {
        setPreferences(response.data);
      } else {
        // Se non ci sono preferenze salvate, usa quelle predefinite
        const defaultPrefs: NotificationPreferences = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          profileId: activeProfileId,
          updatedAt: new Date().toISOString()
        };
        setPreferences(defaultPrefs);
      }
    } catch (err) {
      console.error('Errore nel caricamento delle preferenze notifiche:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');

      // Fallback alle preferenze predefinite
      const defaultPrefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        profileId: activeProfileId,
        updatedAt: new Date().toISOString()
      };
      setPreferences(defaultPrefs);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  // Carica le preferenze quando cambia il profilo
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Ricarica le preferenze quando cambia il profilo corrente
  useEffect(() => {
    if (activeProfileId) {
      // Usa il comando di sincronizzazione se disponibile
      const syncPreferences = async () => {
        try {
          const response = await invoke('sync_notification_preferences_on_profile_switch', {
            old_profile_id: null, // Non abbiamo traccia del profilo precedente qui
            new_profile_id: activeProfileId
          });

          if (response) {
            setPreferences(response);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.warn('Comando di sincronizzazione non disponibile, uso caricamento standard');
        }

        // Fallback al caricamento standard
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

    try {
      setError(null);

      const updatedPreferences: NotificationPreferences = {
        ...preferences,
        ...newPreferences,
        profileId: activeProfileId,
        updatedAt: new Date().toISOString()
      };

      // Usa il comando di salvataggio automatico se disponibile
      const response = await invoke('auto_save_notification_preferences', {
        profile_id: activeProfileId,
        preferences: updatedPreferences
      }).catch(async () => {
        // Fallback al comando standard se il nuovo non è disponibile
        return await invoke('update_notification_preferences', {
          preferences: updatedPreferences
        });
      });

      if (response.success) {
        setPreferences(updatedPreferences);
        return true;
      } else {
        setError(response.error || 'Errore nel salvataggio delle preferenze');
        return false;
      }
    } catch (err) {
      console.error('Errore nell\'aggiornamento delle preferenze:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      return false;
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

      const response = await invoke('update_notification_preferences', {
        preferences: defaultPrefs
      });

      if (response.success) {
        setPreferences(defaultPrefs);
        return true;
      } else {
        setError(response.error || 'Errore nel reset delle preferenze');
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