'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { useNotifications } from '@/hooks/use-notifications';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
// Rimossa dipendenza da useProfileAuth per evitare dipendenza circolare
import { NotificationToastProvider } from './notification-toast-provider';
import { 
  Notification, 
  NotificationPreferences, 
  UseNotificationsReturn,
  NotificationType,
  NotificationPriority 
} from '@/types/notifications';

interface NotificationContextType extends UseNotificationsReturn {
  preferences: NotificationPreferences | null;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<boolean>;
  isPreferencesLoading: boolean;
  preferencesError: string | null;
  
  // Metodi di convenienza per toast
  showSuccessNotification: (title: string, message: string, actionUrl?: string) => Promise<boolean>;
  showErrorNotification: (title: string, message: string, actionUrl?: string) => Promise<boolean>;
  showInfoNotification: (title: string, message: string, actionUrl?: string) => Promise<boolean>;
  showWarningNotification: (title: string, message: string, actionUrl?: string) => Promise<boolean>;
  
  // System event handling
  handleSystemEvent: (eventType: string, data: any) => Promise<void>;
  handleProfileEvent: (eventType: string, profileId: string, data?: any) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
  options?: {
    autoRefresh?: boolean;
    refreshInterval?: number;
    enableRealTime?: boolean;
    maxNotifications?: number;
    enableSystemEvents?: boolean;
    enableProfileEvents?: boolean;
  };
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  options = {}
}) => {
  // Get current profile directly from existing hooks
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const initializationRef = useRef(false);
  const systemEventListenersRef = useRef<Array<() => void>>([]);

  const {
    autoRefresh = true,
    refreshInterval = 30000,
    enableRealTime = true,
    maxNotifications = 100,
    enableSystemEvents = true,
    enableProfileEvents = true
  } = options;

  // Hook for notification handling
  const notificationsHook = useNotifications({
    autoRefresh,
    refreshInterval,
    enableRealTime,
    maxNotifications
  });

  // Hook for preference handling
  const {
    preferences,
    updatePreferences,
    isLoading: isPreferencesLoading,
    error: preferencesError
  } = useNotificationPreferences();

  // Convenience methods for creating notifications with toast
  const showSuccessNotification = async (title: string, message: string, actionUrl?: string): Promise<boolean> => {
    if (!currentProfileId) return false;
    return await notificationsHook.createNotification({
      profileId: currentProfileId,
      type: NotificationType.PROFILE,
      title,
      message,
      actionUrl,
      priority: NotificationPriority.NORMAL,
      icon: '✅',
      metadata: {
        source: 'user-action',
        category: 'success',
        tags: ['success', 'user']
      }
    });
  };

  const showErrorNotification = async (title: string, message: string, actionUrl?: string): Promise<boolean> => {
    if (!currentProfileId) return false;
    return await notificationsHook.createNotification({
      profileId: currentProfileId,
      type: NotificationType.SECURITY,
      title,
      message,
      actionUrl,
      priority: NotificationPriority.HIGH,
      icon: '❌',
      metadata: {
        source: 'error-handler',
        category: 'error',
        tags: ['error', 'system']
      }
    });
  };

  const showInfoNotification = async (title: string, message: string, actionUrl?: string): Promise<boolean> => {
    if (!currentProfileId) return false;
    return await notificationsHook.createNotification({
      profileId: currentProfileId,
      type: NotificationType.SYSTEM,
      title,
      message,
      actionUrl,
      priority: NotificationPriority.NORMAL,
      icon: 'ℹ️',
      metadata: {
        source: 'system-info',
        category: 'info',
        tags: ['info', 'system']
      }
    });
  };

  const showWarningNotification = async (title: string, message: string, actionUrl?: string): Promise<boolean> => {
    if (!currentProfileId) return false;
    return await notificationsHook.createNotification({
      profileId: currentProfileId,
      type: NotificationType.SYSTEM,
      title,
      message,
      actionUrl,
      priority: NotificationPriority.HIGH,
      icon: '⚠️',
      metadata: {
        source: 'system-warning',
        category: 'warning',
        tags: ['warning', 'system']
      }
    });
  };

  // System event handling
  const handleSystemEvent = async (eventType: string, data: any): Promise<void> => {
    if (!enableSystemEvents || !currentProfileId) return;

    try {
      switch (eventType) {
        case 'app-update-available':
          await showInfoNotification(
            'Update Available',
            `New version ${data.version} available for download`,
            '/settings/updates'
          );
          break;

        case 'app-update-downloaded':
          await showSuccessNotification(
            'Update Downloaded',
            'Restart the application to apply the update',
            '/settings/updates'
          );
          break;

        case 'system-error':
          await showErrorNotification(
            'System Error',
            data.message || 'A system error occurred',
            data.actionUrl
          );
          break;

        case 'maintenance-mode':
          await showWarningNotification(
            'Maintenance Mode',
            'System will enter maintenance mode in 5 minutes',
            '/settings'
          );
          break;

        case 'backup-completed':
          await showSuccessNotification(
            'Backup Completed',
            'Data backup completed successfully'
          );
          break;

        case 'backup-failed':
          await showErrorNotification(
            'Backup Failed',
            'Error during data backup. Check settings.',
            '/settings/backup'
          );
          break;

        case 'storage-warning':
          await showWarningNotification(
            'Storage Space',
            'Storage space is almost full',
            '/settings/storage'
          );
          break;

        case 'network-error':
          await showErrorNotification(
            'Network Error',
            'Connection problems detected. Some features may not be available'
          );
          break;

        default:
          console.log('Unhandled system event:', eventType, data);
      }
    } catch (error) {
      console.error('Error handling system event:', error);
    }
  };

  // Profile event handling
  const handleProfileEvent = async (eventType: string, profileId: string, data?: any): Promise<void> => {
    if (!enableProfileEvents || !currentProfileId || profileId !== currentProfileId) return;

    try {
      switch (eventType) {
        case 'profile-created':
          await showSuccessNotification(
            'Welcome!',
            'Your profile has been created successfully. Start by configuring your preferences.',
            '/settings/profile'
          );
          break;

        case 'profile-authenticated':
          await showSuccessNotification(
            'Login Successful',
            'Welcome to your GameStringer profile'
          );
          break;

        case 'profile-locked':
          await showErrorNotification(
            'Profile Locked',
            'Profile has been locked due to too many failed login attempts',
            '/auth/unlock'
          );
          break;

        case 'profile-unlocked':
          await showSuccessNotification(
            'Profile Unlocked',
            'Your profile has been unlocked successfully'
          );
          break;

        case 'credential-added':
          await showSuccessNotification(
            'Credentials Added',
            `Credentials for ${data?.store || 'store'} added successfully`,
            '/settings/stores'
          );
          break;

        case 'credential-error':
          await showErrorNotification(
            'Credential Error',
            `Credential error for ${data?.store || 'store'}. Check settings.`,
            '/settings/stores'
          );
          break;

        case 'settings-updated':
          await showSuccessNotification(
            'Settings Updated',
            'Your settings have been saved successfully'
          );
          break;

        case 'backup-created':
          await showSuccessNotification(
            'Profile Backup',
            'Profile backup created successfully'
          );
          break;

        case 'backup-restored':
          await showSuccessNotification(
            'Profile Restored',
            'Profile has been restored from backup'
          );
          break;

        case 'migration-completed':
          await showSuccessNotification(
            'Migration Completed',
            'Profile data has been migrated to the new version'
          );
          break;

        case 'security-alert':
          await showWarningNotification(
            'Security Alert',
            data?.message || 'Suspicious activity detected on profile',
            '/settings/security'
          );
          break;

        default:
          console.log('Unhandled profile event:', eventType, profileId, data);
      }
    } catch (error) {
      console.error('Error handling profile event:', error);
    }
  };

  // Detect current profile from global events
  useEffect(() => {
    const handleProfileChange = (event: CustomEvent) => {
      const profileId = event.detail?.profileId || event.detail?.id;
      setCurrentProfileId(profileId);
    };

    // Listen for profile change events
    window.addEventListener('profile-changed', handleProfileChange as EventListener);
    window.addEventListener('profile-authenticated', handleProfileChange as EventListener);
    
    // Try to get current profile from localStorage
    const savedProfile = localStorage.getItem('currentProfileId');
    if (savedProfile) {
      setCurrentProfileId(savedProfile);
    }

    return () => {
      window.removeEventListener('profile-changed', handleProfileChange as EventListener);
      window.removeEventListener('profile-authenticated', handleProfileChange as EventListener);
    };
  }, []);

  // Notification system initialization
  useEffect(() => {
    if (!currentProfileId || initializationRef.current) return;

    const initializeNotificationSystem = async () => {
      try {
        console.log('Initializing notification system for profile:', currentProfileId);

        // Initialize Tauri notification system if available
        if (typeof window !== 'undefined') {
          const tauri = (window as any).__TAURI__;
          const invoke = tauri?.tauri?.invoke as undefined | ((cmd: string, args?: any) => Promise<any>);
          if (invoke) {
            try {
              await invoke('initialize_notification_system', {
                profile_id: currentProfileId
              });
              console.log('Tauri notification system initialized');
            } catch (error) {
              console.warn('Error initializing Tauri notification system:', error);
            }
          }
        }

        // Show welcome notification if this is a new profile
        const isNewProfile = localStorage.getItem(`profile_${currentProfileId}_welcomed`) !== 'true';
        if (isNewProfile) {
          setTimeout(async () => {
            await showInfoNotification(
              'Notification System Active',
              'The notification system is now active for this profile'
            );
            localStorage.setItem(`profile_${currentProfileId}_welcomed`, 'true');
          }, 1000);
        }

        initializationRef.current = true;
      } catch (error) {
        console.error('Error initializing notification system:', error);
      }
    };

    initializeNotificationSystem();

    return () => {
      initializationRef.current = false;
    };
  }, [currentProfileId]);

  // Setup event listeners for system and profile events
  useEffect(() => {
    if (!enableSystemEvents && !enableProfileEvents) return;

    const cleanup: Array<() => void> = [];

    // Event listeners for system events
    if (enableSystemEvents) {
      const handleSystemEventWrapper = (event: CustomEvent) => {
        handleSystemEvent(event.type.replace('system-', ''), event.detail);
      };

      // List of system events to listen for
      const systemEvents = [
        'system-app-update-available',
        'system-app-update-downloaded',
        'system-error',
        'system-maintenance-mode',
        'system-backup-completed',
        'system-backup-failed',
        'system-storage-warning',
        'system-network-error'
      ];

      systemEvents.forEach(eventType => {
        window.addEventListener(eventType, handleSystemEventWrapper as EventListener);
        cleanup.push(() => {
          window.removeEventListener(eventType, handleSystemEventWrapper as EventListener);
        });
      });
    }

    // Event listeners for profile events
    if (enableProfileEvents) {
      const handleProfileEventWrapper = (event: CustomEvent) => {
        const { profileId, ...data } = event.detail;
        handleProfileEvent(event.type.replace('profile-', ''), profileId, data);
      };

      // List of profile events to listen for
      const profileEvents = [
        'profile-created',
        'profile-authenticated',
        'profile-locked',
        'profile-unlocked',
        'profile-credential-added',
        'profile-credential-error',
        'profile-settings-updated',
        'profile-backup-created',
        'profile-backup-restored',
        'profile-migration-completed',
        'profile-security-alert'
      ];

      profileEvents.forEach(eventType => {
        window.addEventListener(eventType, handleProfileEventWrapper as EventListener);
        cleanup.push(() => {
          window.removeEventListener(eventType, handleProfileEventWrapper as EventListener);
        });
      });
    }

    // Setup Tauri event listeners se disponibili
    if (typeof window !== 'undefined') {
      const tauri = (window as any).__TAURI__;
      const event = tauri?.event;

      if (event?.listen) {
        const setupTauriEventListeners = async () => {
          try {
            if (enableSystemEvents) {
              const unlistenSystem = await event.listen('system-event', (event: any) => {
                handleSystemEvent(event.payload.type, event.payload.data);
              });
              cleanup.push(unlistenSystem);
            }

            if (enableProfileEvents) {
              const unlistenProfile = await event.listen('profile-event', (event: any) => {
                handleProfileEvent(event.payload.type, event.payload.profileId, event.payload.data);
              });
              cleanup.push(unlistenProfile);
            }
          } catch (error) {
            console.warn('Error setting up Tauri event listeners:', error);
          }
        };

        setupTauriEventListeners();
      }
    }

    systemEventListenersRef.current = cleanup;

    return () => {
      cleanup.forEach(fn => fn());
      systemEventListenersRef.current = [];
    };
  }, [enableSystemEvents, enableProfileEvents, currentProfileId]);

  // General cleanup
  useEffect(() => {
    return () => {
      // Cleanup notification system when provider unmounts
      if (typeof window !== 'undefined') {
        const tauri = (window as any).__TAURI__;
        const invoke = tauri?.tauri?.invoke as undefined | ((cmd: string, args?: any) => Promise<any>);
        if (invoke) {
          invoke('cleanup_notification_system').catch((error: any) => {
            console.warn('Error cleaning up notification system:', error);
          });
        }
      }

      // Cleanup event listeners
      systemEventListenersRef.current.forEach(fn => fn());
    };
  }, []);

  const contextValue: NotificationContextType = {
    ...notificationsHook,
    preferences,
    updatePreferences,
    isPreferencesLoading,
    preferencesError,
    showSuccessNotification,
    showErrorNotification,
    showInfoNotification,
    showWarningNotification,
    handleSystemEvent,
    handleProfileEvent
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      <NotificationToastProvider
        maxToasts={5}
        position="top-right"
        autoHideDuration={5000}
      >
        {children}
      </NotificationToastProvider>
    </NotificationContext.Provider>
  );
};

// Hook per utilizzare il sistema di notifiche completo
export const useNotificationSystem = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationSystem deve essere utilizzato all\'interno di NotificationProvider');
  }
  return context;
};

// Hook semplificato per compatibilità
export const useNotificationActions = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    // Fallback se il provider non è disponibile
    return {
      showSuccess: (title: string, message: string) => console.log('Success:', title, message),
      showError: (title: string, message: string) => console.log('Error:', title, message),
      showInfo: (title: string, message: string) => console.log('Info:', title, message),
      showWarning: (title: string, message: string) => console.log('Warning:', title, message)
    };
  }
  
  return {
    showSuccess: context.showSuccessNotification,
    showError: context.showErrorNotification,
    showInfo: context.showInfoNotification,
    showWarning: context.showWarningNotification
  };
};

export default NotificationProvider;