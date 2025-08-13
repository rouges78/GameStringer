'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNotificationToast } from '@/components/notifications/notification-toast-provider';
import { Notification, NotificationPreferences, shouldShowNotification } from '@/types/notifications';

interface UseNotificationToastIntegrationOptions {
  profileId?: string;
  autoShowNewNotifications?: boolean;
  respectPreferences?: boolean;
}

export const useNotificationToastIntegration = (options: UseNotificationToastIntegrationOptions = {}) => {
  const {
    profileId = 'current',
    autoShowNewNotifications = true,
    respectPreferences = true
  } = options;

  const { showToast, isUIBlocked } = useNotificationToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  // Carica le preferenze del profilo corrente
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Integrazione con il sistema Tauri per caricare le preferenze
        if (typeof window !== 'undefined' && window.__TAURI__) {
          const { invoke } = window.__TAURI__.tauri;
          const result = await invoke('get_notification_preferences', { profileId });

          if (result.success && result.data) {
            setPreferences(result.data);
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento delle preferenze notifiche:', error);
      }
    };

    if (profileId) {
      loadPreferences();
    }
  }, [profileId]);

  // Ascolta le nuove notifiche dal backend
  useEffect(() => {
    if (!autoShowNewNotifications) return;

    const handleNewNotification = (event: CustomEvent<Notification>) => {
      const notification = event.detail;

      // Evita di mostrare la stessa notifica più volte
      if (notification.id === lastNotificationId) return;
      setLastNotificationId(notification.id);

      // Controlla se la notifica appartiene al profilo corrente
      if (notification.profileId !== profileId) return;

      // Rispetta le preferenze se richiesto
      if (respectPreferences && preferences) {
        if (!shouldShowNotification(notification, preferences)) {
          return;
        }
      }

      // Mostra il toast
      showToast(notification);
    };

    // Ascolta eventi personalizzati per nuove notifiche
    window.addEventListener('new-notification', handleNewNotification as EventListener);

    // Ascolta eventi Tauri se disponibili
    if (typeof window !== 'undefined' && window.__TAURI__) {
      const { event } = window.__TAURI__;

      const unlistenPromise = event.listen('notification-created', (event) => {
        const notification = event.payload as Notification;
        handleNewNotification(new CustomEvent('new-notification', { detail: notification }));
      });

      return () => {
        window.removeEventListener('new-notification', handleNewNotification as EventListener);
        unlistenPromise.then(unlisten => unlisten());
      };
    }

    return () => {
      window.removeEventListener('new-notification', handleNewNotification as EventListener);
    };
  }, [autoShowNewNotifications, profileId, preferences, respectPreferences, showToast, lastNotificationId]);

  // Funzione per mostrare una notifica manualmente
  const showNotificationToast = useCallback((notification: Notification) => {
    // Controlla le preferenze se richiesto
    if (respectPreferences && preferences) {
      if (!shouldShowNotification(notification, preferences)) {
        console.log('Notifica bloccata dalle preferenze:', notification.title);
        return false;
      }
    }

    showToast(notification);
    return true;
  }, [showToast, preferences, respectPreferences]);

  // Funzione per aggiornare le preferenze
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        const { invoke } = window.__TAURI__.tauri;
        const updatedPreferences = { ...preferences, ...newPreferences };

        const result = await invoke('update_notification_preferences', {
          preferences: updatedPreferences
        });

        if (result.success) {
          setPreferences(updatedPreferences as NotificationPreferences);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Errore nell\'aggiornamento delle preferenze:', error);
      return false;
    }
  }, [preferences]);

  // Funzione per testare una notifica
  const testNotification = useCallback((type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const testNotifications = {
      success: {
        id: `test-success-${Date.now()}`,
        profileId,
        type: 'Profile' as any,
        title: 'Test Successo',
        message: 'Questa è una notifica di test per verificare il funzionamento del sistema.',
        priority: 'Normal' as any,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'success',
          tags: ['test', 'success']
        }
      },
      error: {
        id: `test-error-${Date.now()}`,
        profileId,
        type: 'Security' as any,
        title: 'Test Errore',
        message: 'Questa è una notifica di errore di test.',
        priority: 'High' as any,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'error',
          tags: ['test', 'error']
        }
      },
      info: {
        id: `test-info-${Date.now()}`,
        profileId,
        type: 'System' as any,
        title: 'Test Informazione',
        message: 'Questa è una notifica informativa di test.',
        priority: 'Normal' as any,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'info',
          tags: ['test', 'info']
        }
      },
      warning: {
        id: `test-warning-${Date.now()}`,
        profileId,
        type: 'System' as any,
        title: 'Test Avviso',
        message: 'Questa è una notifica di avviso di test.',
        priority: 'High' as any,
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'test',
          category: 'warning',
          tags: ['test', 'warning']
        }
      }
    };

    showNotificationToast(testNotifications[type]);
  }, [profileId, showNotificationToast]);

  return {
    // Stato
    preferences,
    isUIBlocked,

    // Azioni
    showNotificationToast,
    updatePreferences,
    testNotification,

    // Utilità
    canShowNotification: (notification: Notification) => {
      if (!respectPreferences || !preferences) return true;
      return shouldShowNotification(notification, preferences);
    }
  };
};

// Hook semplificato per l'uso comune
export const useToastNotifications = (profileId?: string) => {
  return useNotificationToastIntegration({
    profileId,
    autoShowNewNotifications: true,
    respectPreferences: true
  });
};

export default useNotificationToastIntegration;