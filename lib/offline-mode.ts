import { useState, useEffect, useCallback } from 'react';
import { safeSetItem, safeGetItem } from './safe-storage';

const OFFLINE_QUEUE_KEY = 'offline_action_queue';
const OFFLINE_CACHE_KEY = 'offline_data_cache';

export interface OfflineAction {
  id: string;
  type: 'translation' | 'save' | 'sync' | 'backup';
  payload: any;
  createdAt: number;
  retries: number;
}

export interface OfflineCache {
  games: any[];
  profiles: any[];
  translationMemory: any[];
  lastSyncedAt: number;
}

/**
 * Stato della connessione
 */
export type ConnectionStatus = 'online' | 'offline' | 'slow';

/**
 * Rileva lo stato della connessione
 */
export function getConnectionStatus(): ConnectionStatus {
  if (typeof navigator === 'undefined') return 'online';
  
  if (!navigator.onLine) return 'offline';
  
  // Controlla se la connessione è lenta
  const connection = (navigator as any).connection;
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return 'slow';
    }
  }
  
  return 'online';
}

/**
 * Hook per monitorare lo stato della connessione
 */
export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [wasOffline, setWasOffline] = useState(false);
  
  useEffect(() => {
    const updateStatus = () => {
      const newStatus = getConnectionStatus();
      setStatus(prev => {
        if (prev === 'offline' && newStatus === 'online') {
          setWasOffline(true);
        }
        return newStatus;
      });
    };
    
    updateStatus();
    
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    
    // Check periodico
    const interval = setInterval(updateStatus, 30000);
    
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);
  
  const clearWasOffline = useCallback(() => setWasOffline(false), []);
  
  return { status, wasOffline, clearWasOffline, isOnline: status === 'online' };
}

/**
 * Salva un'azione nella coda offline
 */
export function queueOfflineAction(action: Omit<OfflineAction, 'id' | 'createdAt' | 'retries'>): void {
  const queue = getOfflineQueue();
  
  const newAction: OfflineAction = {
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    retries: 0,
  };
  
  queue.push(newAction);
  safeSetItem(OFFLINE_QUEUE_KEY, queue);
}

/**
 * Ottiene la coda delle azioni offline
 */
export function getOfflineQueue(): OfflineAction[] {
  return safeGetItem<OfflineAction[]>(OFFLINE_QUEUE_KEY) || [];
}

/**
 * Rimuove un'azione dalla coda
 */
export function removeFromQueue(actionId: string): void {
  const queue = getOfflineQueue().filter(a => a.id !== actionId);
  safeSetItem(OFFLINE_QUEUE_KEY, queue);
}

/**
 * Incrementa i retry di un'azione
 */
export function incrementRetry(actionId: string): void {
  const queue = getOfflineQueue();
  const action = queue.find(a => a.id === actionId);
  if (action) {
    action.retries++;
    safeSetItem(OFFLINE_QUEUE_KEY, queue);
  }
}

/**
 * Cache dati per uso offline
 */
export function cacheForOffline(key: keyof OfflineCache, data: any): void {
  const cache = getOfflineCache();
  cache[key] = data;
  cache.lastSyncedAt = Date.now();
  safeSetItem(OFFLINE_CACHE_KEY, cache);
}

/**
 * Ottiene dati dalla cache offline
 */
export function getOfflineCache(): OfflineCache {
  return safeGetItem<OfflineCache>(OFFLINE_CACHE_KEY) || {
    games: [],
    profiles: [],
    translationMemory: [],
    lastSyncedAt: 0,
  };
}

/**
 * Ottiene dati specifici dalla cache
 */
export function getFromOfflineCache<T>(key: keyof OfflineCache): T | null {
  const cache = getOfflineCache();
  return cache[key] as T || null;
}

/**
 * Hook per gestire la modalità offline
 */
export function useOfflineMode() {
  const { status, wasOffline, clearWasOffline, isOnline } = useConnectionStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActions, setPendingActions] = useState<number>(0);
  
  // Aggiorna conteggio azioni pending
  useEffect(() => {
    const updatePending = () => {
      setPendingActions(getOfflineQueue().length);
    };
    
    updatePending();
    const interval = setInterval(updatePending, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Sincronizza quando torna online
  const syncPendingActions = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    const queue = getOfflineQueue();
    
    for (const action of queue) {
      try {
        // Esegui l'azione in base al tipo
        await executeOfflineAction(action);
        removeFromQueue(action.id);
      } catch (error) {
        console.error(`Errore sync azione ${action.id}:`, error);
        if (action.retries < 3) {
          incrementRetry(action.id);
        } else {
          // Troppi retry, rimuovi
          removeFromQueue(action.id);
          console.warn(`Azione ${action.id} rimossa dopo 3 tentativi falliti`);
        }
      }
    }
    
    setPendingActions(getOfflineQueue().length);
    setIsSyncing(false);
    clearWasOffline();
  }, [isOnline, isSyncing, clearWasOffline]);
  
  // Sincronizza automaticamente quando torna online
  useEffect(() => {
    if (wasOffline && isOnline) {
      syncPendingActions();
    }
  }, [wasOffline, isOnline, syncPendingActions]);
  
  return {
    status,
    isOnline,
    isOffline: status === 'offline',
    isSlow: status === 'slow',
    isSyncing,
    pendingActions,
    syncPendingActions,
    queueAction: queueOfflineAction,
    cacheData: cacheForOffline,
    getCachedData: getFromOfflineCache,
  };
}

/**
 * Esegue un'azione offline quando torna online
 */
async function executeOfflineAction(action: OfflineAction): Promise<void> {
  const { invoke } = await import('@/lib/tauri-api');
  
  switch (action.type) {
    case 'translation':
      // Riprendi traduzione
      console.log('Ripresa traduzione offline:', action.payload);
      break;
      
    case 'save':
      // Salva dati
      console.log('Salvataggio dati offline:', action.payload);
      break;
      
    case 'sync':
      // Sincronizza con server
      console.log('Sincronizzazione:', action.payload);
      break;
      
    case 'backup':
      // Crea backup
      await invoke('backup_translation_memory');
      break;
      
    default:
      console.warn('Tipo azione sconosciuto:', action.type);
  }
}

/**
 * Wrapper per funzioni che richiedono connessione
 * Se offline, salva l'azione per dopo
 */
export function withOfflineSupport<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  actionType: OfflineAction['type']
): T {
  return (async (...args: Parameters<T>) => {
    const status = getConnectionStatus();
    
    if (status === 'offline') {
      queueOfflineAction({
        type: actionType,
        payload: { fn: fn.name, args },
      });
      return { queued: true, message: 'Azione salvata per quando tornerai online' };
    }
    
    return fn(...args);
  }) as T;
}
