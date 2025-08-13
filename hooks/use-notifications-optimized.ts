'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { Notification, NotificationFilter, NotificationPreferences, CreateNotificationRequest } from '@/types/notifications';

interface NotificationCache {
  [profileId: string]: {
    notifications: Notification[];
    lastFetch: number;
    unreadCount: number;
    totalCount: number;
  };
}

interface UseNotificationsOptimizedOptions {
  profileId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  cacheTimeout?: number;
  enableBatching?: boolean;
  batchSize?: number;
  enableVirtualization?: boolean;
}

export function useNotificationsOptimized({
  profileId,
  autoRefresh = true,
  refreshInterval = 30000, // 30 secondi
  cacheTimeout = 300000, // 5 minuti
  enableBatching = true,
  batchSize = 10,
  enableVirtualization = false,
}: UseNotificationsOptimizedOptions) {
  // Cache globale per le notifiche
  const cacheRef = useRef<NotificationCache>({});
  
  // Stati locali
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Batch operations queue
  const batchQueueRef = useRef<{
    markAsRead: string[];
    delete: string[];
    update: Notification[];
  }>({
    markAsRead: [],
    delete: [],
    update: [],
  });
  
  const batchTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoizza il filtro per evitare re-fetch inutili
  const defaultFilter = useMemo(() => ({
    limit: enableVirtualization ? 50 : undefined,
    offset: 0,
  }), [enableVirtualization]);

  // Controlla se i dati in cache sono ancora validi
  const isCacheValid = useCallback((profileId: string) => {
    const cached = cacheRef.current[profileId];
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.lastFetch) < cacheTimeout;
  }, [cacheTimeout]);

  // Carica notifiche con cache
  const loadNotifications = useCallback(async (
    filter: NotificationFilter = defaultFilter,
    forceRefresh = false
  ) => {
    if (!forceRefresh && isCacheValid(profileId)) {
      const cached = cacheRef.current[profileId];
      setNotifications(cached.notifications);
      setUnreadCount(cached.unreadCount);
      setTotalCount(cached.totalCount);
      return cached.notifications;
    }

    setLoading(true);
    setError(null);

    try {
      const [notificationsResult, unreadCountResult] = await Promise.all([
        invoke<Notification[]>('get_notifications', { profileId, filter }),
        invoke<number>('get_unread_notifications_count', { profileId }),
      ]);

      // Aggiorna cache
      cacheRef.current[profileId] = {
        notifications: notificationsResult,
        lastFetch: Date.now(),
        unreadCount: unreadCountResult,
        totalCount: notificationsResult.length,
      };

      setNotifications(notificationsResult);
      setUnreadCount(unreadCountResult);
      setTotalCount(notificationsResult.length);
      
      return notificationsResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento notifiche';
      setError(errorMessage);
      console.error('Errore caricamento notifiche:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [profileId, defaultFilter, isCacheValid]);

  // Carica pagina specifica per virtual scrolling
  const loadNotificationsPage = useCallback(async (
    offset: number,
    limit: number,
    filter?: Partial<NotificationFilter>
  ): Promise<Notification[]> => {
    try {
      const pageFilter: NotificationFilter = {
        ...defaultFilter,
        ...filter,
        offset,
        limit,
      };

      const result = await invoke<Notification[]>('get_notifications_paginated', {
        profileId,
        filter: pageFilter,
      });

      return result;
    } catch (err) {
      console.error('Errore caricamento pagina notifiche:', err);
      return [];
    }
  }, [profileId, defaultFilter]);

  // Processa la coda batch
  const processBatchQueue = useCallback(async () => {
    const queue = batchQueueRef.current;
    
    if (queue.markAsRead.length === 0 && queue.delete.length === 0 && queue.update.length === 0) {
      return;
    }

    try {
      const promises: Promise<any>[] = [];

      if (queue.markAsRead.length > 0) {
        promises.push(
          invoke('batch_mark_notifications_as_read', {
            profileId,
            notificationIds: queue.markAsRead,
          })
        );
      }

      if (queue.delete.length > 0) {
        promises.push(
          invoke('batch_delete_notifications', {
            notificationIds: queue.delete,
          })
        );
      }

      if (queue.update.length > 0) {
        promises.push(
          invoke('batch_update_notifications', {
            notifications: queue.update,
          })
        );
      }

      await Promise.all(promises);

      // Aggiorna lo stato locale
      setNotifications(prev => {
        let updated = [...prev];
        
        // Rimuovi notifiche eliminate
        updated = updated.filter(n => !queue.delete.includes(n.id));
        
        // Aggiorna notifiche modificate
        queue.update.forEach(updatedNotification => {
          const index = updated.findIndex(n => n.id === updatedNotification.id);
          if (index !== -1) {
            updated[index] = updatedNotification;
          }
        });
        
        // Marca come lette
        queue.markAsRead.forEach(id => {
          const index = updated.findIndex(n => n.id === id);
          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              readAt: new Date().toISOString(),
            };
          }
        });
        
        return updated;
      });

      // Aggiorna conteggio non lette
      if (queue.markAsRead.length > 0) {
        setUnreadCount(prev => Math.max(0, prev - queue.markAsRead.length));
      }

      // Pulisci la coda
      batchQueueRef.current = {
        markAsRead: [],
        delete: [],
        update: [],
      };

      // Invalida cache
      delete cacheRef.current[profileId];

    } catch (err) {
      console.error('Errore elaborazione batch:', err);
      setError('Errore durante l\'elaborazione delle operazioni');
    }
  }, [profileId]);

  // Schedula elaborazione batch
  const scheduleBatchProcessing = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    batchTimeoutRef.current = setTimeout(processBatchQueue, 1000); // 1 secondo di debounce
  }, [processBatchQueue]);

  // Marca notifica come letta (con batching opzionale)
  const markAsRead = useCallback(async (notificationId: string) => {
    if (enableBatching) {
      batchQueueRef.current.markAsRead.push(notificationId);
      scheduleBatchProcessing();
    } else {
      try {
        await invoke('mark_notification_as_read', { profileId, notificationId });
        
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, readAt: new Date().toISOString() }
              : n
          )
        );
        
        setUnreadCount(prev => Math.max(0, prev - 1));
        delete cacheRef.current[profileId];
      } catch (err) {
        console.error('Errore marcatura come letta:', err);
        setError('Errore durante la marcatura come letta');
      }
    }
  }, [profileId, enableBatching, scheduleBatchProcessing]);

  // Elimina notifica (con batching opzionale)
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (enableBatching) {
      batchQueueRef.current.delete.push(notificationId);
      scheduleBatchProcessing();
    } else {
      try {
        await invoke('delete_notification', { notificationId });
        
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        
        // Aggiorna conteggio se era non letta
        const notification = notifications.find(n => n.id === notificationId);
        if (notification && !notification.readAt) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        
        delete cacheRef.current[profileId];
      } catch (err) {
        console.error('Errore eliminazione notifica:', err);
        setError('Errore durante l\'eliminazione');
      }
    }
  }, [profileId, notifications, enableBatching, scheduleBatchProcessing]);

  // Marca tutte come lette
  const markAllAsRead = useCallback(async () => {
    try {
      await invoke('mark_all_notifications_as_read', { profileId });
      
      setNotifications(prev =>
        prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      
      setUnreadCount(0);
      delete cacheRef.current[profileId];
    } catch (err) {
      console.error('Errore marcatura tutte come lette:', err);
      setError('Errore durante la marcatura di tutte come lette');
    }
  }, [profileId]);

  // Elimina tutte le notifiche
  const clearAllNotifications = useCallback(async () => {
    try {
      await invoke('clear_all_notifications', { profileId });
      
      setNotifications([]);
      setUnreadCount(0);
      setTotalCount(0);
      delete cacheRef.current[profileId];
    } catch (err) {
      console.error('Errore pulizia notifiche:', err);
      setError('Errore durante la pulizia delle notifiche');
    }
  }, [profileId]);

  // Crea nuova notifica
  const createNotification = useCallback(async (request: CreateNotificationRequest) => {
    try {
      const newNotification = await invoke<Notification>('create_notification', {
        profileId,
        request,
      });
      
      setNotifications(prev => [newNotification, ...prev]);
      
      if (!newNotification.readAt) {
        setUnreadCount(prev => prev + 1);
      }
      
      setTotalCount(prev => prev + 1);
      delete cacheRef.current[profileId];
      
      return newNotification;
    } catch (err) {
      console.error('Errore creazione notifica:', err);
      setError('Errore durante la creazione della notifica');
      throw err;
    }
  }, [profileId]);

  // Ascolta eventi real-time
  useEffect(() => {
    const unlistenPromise = listen<Notification>('notification-created', (event) => {
      const notification = event.payload;
      if (notification.profileId === profileId) {
        setNotifications(prev => [notification, ...prev]);
        
        if (!notification.readAt) {
          setUnreadCount(prev => prev + 1);
        }
        
        setTotalCount(prev => prev + 1);
        delete cacheRef.current[profileId];
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [profileId]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadNotifications(defaultFilter, true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadNotifications, defaultFilter]);

  // Caricamento iniziale
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  // Memoizza i valori di ritorno per evitare re-render inutili
  const memoizedReturn = useMemo(() => ({
    notifications,
    unreadCount,
    totalCount,
    loading,
    error,
    loadNotifications,
    loadNotificationsPage,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    clearAllNotifications,
    createNotification,
    refresh: () => loadNotifications(defaultFilter, true),
    clearError: () => setError(null),
  }), [
    notifications,
    unreadCount,
    totalCount,
    loading,
    error,
    loadNotifications,
    loadNotificationsPage,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    clearAllNotifications,
    createNotification,
    defaultFilter,
  ]);

  return memoizedReturn;
}

// Hook per le preferenze notifiche ottimizzato
export function useNotificationPreferencesOptimized(profileId: string) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache per le preferenze
  const cacheRef = useRef<{ [profileId: string]: { preferences: NotificationPreferences; timestamp: number } }>({});
  const cacheTimeout = 300000; // 5 minuti

  const loadPreferences = useCallback(async (forceRefresh = false) => {
    const cached = cacheRef.current[profileId];
    if (!forceRefresh && cached && (Date.now() - cached.timestamp) < cacheTimeout) {
      setPreferences(cached.preferences);
      return cached.preferences;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<NotificationPreferences>('get_notification_preferences', { profileId });
      
      cacheRef.current[profileId] = {
        preferences: result,
        timestamp: Date.now(),
      };
      
      setPreferences(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore caricamento preferenze';
      setError(errorMessage);
      console.error('Errore caricamento preferenze:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    if (!preferences) return;

    const updatedPreferences = { ...preferences, ...newPreferences };
    
    try {
      await invoke('update_notification_preferences', { profileId, preferences: updatedPreferences });
      
      cacheRef.current[profileId] = {
        preferences: updatedPreferences,
        timestamp: Date.now(),
      };
      
      setPreferences(updatedPreferences);
      return updatedPreferences;
    } catch (err) {
      console.error('Errore aggiornamento preferenze:', err);
      setError('Errore durante l\'aggiornamento delle preferenze');
      throw err;
    }
  }, [profileId, preferences]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return useMemo(() => ({
    preferences,
    loading,
    error,
    updatePreferences,
    refresh: () => loadPreferences(true),
    clearError: () => setError(null),
  }), [preferences, loading, error, updatePreferences, loadPreferences]);
}