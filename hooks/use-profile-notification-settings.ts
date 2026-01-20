'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfiles } from './use-profiles';
import { useNotificationPreferences } from './use-notification-preferences';
import { 
  NotificationPreferences, 
  NotificationType,
  DEFAULT_NOTIFICATION_PREFERENCES 
} from '@/types/notifications';

export interface UseProfileNotificationSettingsReturn {
  // Stato
  currentProfile: any;
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  
  // Azioni principali
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<boolean>;
  resetToDefaults: () => Promise<boolean>;
  saveChanges: () => Promise<boolean>;
  discardChanges: () => void;
  
  // Azioni rapide
  toggleGlobalNotifications: (enabled: boolean) => Promise<boolean>;
  toggleNotificationType: (type: NotificationType, enabled: boolean) => Promise<boolean>;
  toggleSounds: (enabled: boolean) => Promise<boolean>;
  toggleDesktopNotifications: (enabled: boolean) => Promise<boolean>;
  
  // Utilità
  isTypeEnabled: (type: NotificationType) => boolean;
  getEnabledTypesCount: () => number;
  isInQuietHours: () => boolean;
  canReceiveNotifications: () => boolean;
  
  // Eventi profilo
  onProfileChanged: (callback: (profileId: string | null) => void) => void;
}

export const useProfileNotificationSettings = (): UseProfileNotificationSettingsReturn => {
  const { currentProfile, isLoading: profilesLoading } = useProfiles();
  const {
    preferences,
    isLoading: preferencesLoading,
    error,
    updatePreferences: updatePrefs,
    resetToDefaults: resetPrefs,
    isTypeEnabled,
    getEnabledTypesCount,
    isInQuietHours
  } = useNotificationPreferences();

  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [profileChangeCallbacks, setProfileChangeCallbacks] = useState<Array<(profileId: string | null) => void>>([]);

  // Sincronizza le preferenze locali con quelle caricate
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
      setHasUnsavedChanges(false);
    }
  }, [preferences]);

  // Gestisce il cambio di profilo
  useEffect(() => {
    const profileId = currentProfile?.id || null;
    profileChangeCallbacks.forEach(callback => callback(profileId));
    
    // Reset delle modifiche non salvate quando cambia profilo
    setHasUnsavedChanges(false);
    setLocalPreferences(null);
  }, [currentProfile, profileChangeCallbacks]);

  const isLoading = profilesLoading || preferencesLoading;

  // Aggiorna le preferenze locali e marca come modificate
  const updateLocalPreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    if (!localPreferences) return;

    const updatedPreferences = {
      ...localPreferences,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    setLocalPreferences(updatedPreferences);
    setHasUnsavedChanges(true);
  }, [localPreferences]);

  // Aggiorna le preferenze (salva immediatamente)
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>): Promise<boolean> => {
    if (!currentProfile || !localPreferences) {
      return false;
    }

    try {
      const updatedPreferences = {
        ...localPreferences,
        ...updates,
        profileId: currentProfile.id,
        updatedAt: new Date().toISOString()
      };

      const success = await updatePrefs(updatedPreferences);
      if (success) {
        setLocalPreferences(updatedPreferences);
        setHasUnsavedChanges(false);
      }
      return success;
    } catch (error) {
      console.error('Errore nell\'aggiornamento delle preferenze:', error);
      return false;
    }
  }, [currentProfile, localPreferences, updatePrefs]);

  // Reset alle impostazioni predefinite
  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    if (!currentProfile) {
      return false;
    }

    try {
      const success = await resetPrefs();
      if (success) {
        setHasUnsavedChanges(false);
      }
      return success;
    } catch (error) {
      console.error('Errore nel reset delle preferenze:', error);
      return false;
    }
  }, [currentProfile, resetPrefs]);

  // Salva le modifiche locali
  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!hasUnsavedChanges || !localPreferences) {
      return true;
    }

    return updatePreferences(localPreferences);
  }, [hasUnsavedChanges, localPreferences, updatePreferences]);

  // Scarta le modifiche locali
  const discardChanges = useCallback(() => {
    if (preferences) {
      setLocalPreferences(preferences);
      setHasUnsavedChanges(false);
    }
  }, [preferences]);

  // Azioni rapide
  const toggleGlobalNotifications = useCallback(async (enabled: boolean): Promise<boolean> => {
    return updatePreferences({ globalEnabled: enabled });
  }, [updatePreferences]);

  const toggleNotificationType = useCallback(async (type: NotificationType, enabled: boolean): Promise<boolean> => {
    if (!localPreferences) return false;

    const updatedTypeSettings = {
      ...localPreferences.typeSettings,
      [type]: {
        ...localPreferences.typeSettings[type],
        enabled
      }
    };

    return updatePreferences({ typeSettings: updatedTypeSettings });
  }, [localPreferences, updatePreferences]);

  const toggleSounds = useCallback(async (enabled: boolean): Promise<boolean> => {
    return updatePreferences({ soundEnabled: enabled });
  }, [updatePreferences]);

  const toggleDesktopNotifications = useCallback(async (enabled: boolean): Promise<boolean> => {
    return updatePreferences({ desktopEnabled: enabled });
  }, [updatePreferences]);

  // Utilità
  const canReceiveNotifications = useCallback((): boolean => {
    if (!localPreferences) return false;
    return localPreferences.globalEnabled && !isInQuietHours();
  }, [localPreferences, isInQuietHours]);

  // Gestione callback per cambio profilo
  const onProfileChanged = useCallback((callback: (profileId: string | null) => void) => {
    setProfileChangeCallbacks(prev => [...prev, callback]);
    
    // Ritorna una funzione per rimuovere il callback
    return () => {
      setProfileChangeCallbacks(prev => prev.filter(cb => cb !== callback));
    };
  }, []);

  return {
    // Stato
    currentProfile,
    preferences: localPreferences,
    isLoading,
    error,
    hasUnsavedChanges,
    
    // Azioni principali
    updatePreferences,
    resetToDefaults,
    saveChanges,
    discardChanges,
    
    // Azioni rapide
    toggleGlobalNotifications,
    toggleNotificationType,
    toggleSounds,
    toggleDesktopNotifications,
    
    // Utilità
    isTypeEnabled,
    getEnabledTypesCount,
    isInQuietHours,
    canReceiveNotifications,
    
    // Eventi profilo
    onProfileChanged
  };
};

export default useProfileNotificationSettings;