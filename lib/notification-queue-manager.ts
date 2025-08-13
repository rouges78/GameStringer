'use client';

import { Notification, NotificationPriority } from '@/types/notifications';
import UIInterferenceDetector, { UIInterference } from './ui-interference-detector';

import React from 'react';

/**
 * Gestisce la coda delle notifiche durante le interferenze UI
 * Implementa logiche di priorità e timing intelligente
 */

export interface QueuedNotification extends Notification {
  queuedAt: number;
  attempts: number;
  maxAttempts: number;
  delayUntil?: number;
  onShow?: () => void;
  onDequeue?: () => void;
}

export interface NotificationQueueOptions {
  maxQueueSize?: number;
  maxRetryAttempts?: number;
  baseRetryDelay?: number;
  priorityBoost?: boolean;
  urgentBypassQueue?: boolean;
  debugMode?: boolean;
}

export interface QueueStats {
  totalQueued: number;
  byPriority: Record<NotificationPriority, number>;
  oldestQueueTime: number | null;
  averageWaitTime: number;
}

class NotificationQueueManager {
  private static instance: NotificationQueueManager;
  private queue: QueuedNotification[] = [];
  private interferenceDetector: UIInterferenceDetector;
  private processingInterval: NodeJS.Timeout | null = null;
  private callbacks: Set<(stats: QueueStats) => void> = new Set();
  
  private options: Required<NotificationQueueOptions> = {
    maxQueueSize: 50,
    maxRetryAttempts: 3,
    baseRetryDelay: 2000,
    priorityBoost: true,
    urgentBypassQueue: true,
    debugMode: false
  };

  private constructor(options?: NotificationQueueOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    this.interferenceDetector = UIInterferenceDetector.getInstance();
    this.initialize();
  }

  public static getInstance(options?: NotificationQueueOptions): NotificationQueueManager {
    if (!NotificationQueueManager.instance) {
      NotificationQueueManager.instance = new NotificationQueueManager(options);
    }
    return NotificationQueueManager.instance;
  }

  private initialize(): void {
    // Avvia il processamento della coda
    this.startQueueProcessing();

    // Ascolta cambiamenti nelle interferenze
    this.interferenceDetector.onInterferenceChange((interferences) => {
      this.handleInterferenceChange(interferences);
    });

    if (this.options.debugMode) {
      console.log('[NotificationQueueManager] Inizializzato con opzioni:', this.options);
    }
  }

  private startQueueProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Processa la coda ogni secondo
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000);
  }

  private handleInterferenceChange(interferences: UIInterference[]): void {
    if (this.options.debugMode) {
      console.log('[NotificationQueueManager] Interferenze cambiate:', interferences.length);
    }

    // Se non ci sono più interferenze, prova a processare la coda immediatamente
    if (interferences.length === 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    const now = Date.now();
    const hasInterferences = this.interferenceDetector.hasInterferences();
    const hasHighPriorityInterferences = this.interferenceDetector.hasHighPriorityInterferences();

    // Filtra notifiche pronte per essere mostrate
    const readyNotifications = this.queue.filter(notification => {
      // Controlla se è ancora in delay
      if (notification.delayUntil && notification.delayUntil > now) {
        return false;
      }

      // Le notifiche urgenti bypassano le interferenze se abilitato
      if (this.options.urgentBypassQueue && 
          notification.priority === NotificationPriority.URGENT) {
        return true;
      }

      // Se ci sono interferenze ad alta priorità, aspetta
      if (hasHighPriorityInterferences) {
        return false;
      }

      // Se ci sono interferenze ma la notifica ha priorità alta, mostrala comunque
      if (hasInterferences && notification.priority === NotificationPriority.HIGH) {
        return this.options.priorityBoost;
      }

      // Se non ci sono interferenze, mostra la notifica
      return !hasInterferences;
    });

    if (readyNotifications.length === 0) return;

    // Ordina per priorità e tempo di accodamento
    readyNotifications.sort((a, b) => {
      // Prima per priorità
      const priorityOrder = {
        [NotificationPriority.URGENT]: 4,
        [NotificationPriority.HIGH]: 3,
        [NotificationPriority.NORMAL]: 2,
        [NotificationPriority.LOW]: 1
      };

      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Poi per tempo di accodamento (più vecchie prima)
      return a.queuedAt - b.queuedAt;
    });

    // Mostra la prima notifica pronta
    const notificationToShow = readyNotifications[0];
    this.dequeueAndShow(notificationToShow);
  }

  private dequeueAndShow(notification: QueuedNotification): void {
    // Rimuovi dalla coda
    this.queue = this.queue.filter(n => n.id !== notification.id);

    try {
      // Mostra la notifica
      this.showNotification(notification);

      // Callback di dequeue
      if (notification.onDequeue) {
        notification.onDequeue();
      }

      if (this.options.debugMode) {
        console.log('[NotificationQueueManager] Notifica mostrata:', notification.title);
      }
    } catch (error) {
      console.error('[NotificationQueueManager] Errore nel mostrare notifica:', error);
      
      // Riprova se non ha superato il limite
      if (notification.attempts < notification.maxAttempts) {
        this.requeueWithDelay(notification);
      }
    }

    // Notifica i callback del cambiamento
    this.notifyStatsCallbacks();
  }

  private showNotification(notification: QueuedNotification): void {
    // Usa il sistema di toast esistente
    if (typeof window !== 'undefined' && (window as any).showNotificationToast) {
      (window as any).showNotificationToast(notification);
      
      if (notification.onShow) {
        notification.onShow();
      }
    } else {
      throw new Error('Sistema di toast non disponibile');
    }
  }

  private requeueWithDelay(notification: QueuedNotification): void {
    const delay = this.calculateRetryDelay(notification.attempts);
    const updatedNotification: QueuedNotification = {
      ...notification,
      attempts: notification.attempts + 1,
      delayUntil: Date.now() + delay
    };

    this.queue.push(updatedNotification);

    if (this.options.debugMode) {
      console.log(`[NotificationQueueManager] Notifica rimessa in coda con delay ${delay}ms:`, 
        notification.title);
    }
  }

  private calculateRetryDelay(attempts: number): number {
    // Backoff esponenziale con jitter
    const baseDelay = this.options.baseRetryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempts - 1);
    const jitter = Math.random() * 1000; // Fino a 1 secondo di jitter
    
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 secondi
  }

  private notifyStatsCallbacks(): void {
    const stats = this.getQueueStats();
    this.callbacks.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        console.error('[NotificationQueueManager] Errore nel callback stats:', error);
      }
    });
  }

  // API pubblica
  public enqueue(
    notification: Notification, 
    options?: {
      onShow?: () => void;
      onDequeue?: () => void;
      maxAttempts?: number;
    }
  ): boolean {
    // Controlla se la coda è piena
    if (this.queue.length >= this.options.maxQueueSize) {
      // Rimuovi la notifica più vecchia con priorità più bassa
      this.removeOldestLowPriorityNotification();
      
      if (this.queue.length >= this.options.maxQueueSize) {
        if (this.options.debugMode) {
          console.warn('[NotificationQueueManager] Coda piena, notifica scartata:', 
            notification.title);
        }
        return false;
      }
    }

    // Controlla se la notifica è già in coda
    if (this.queue.some(n => n.id === notification.id)) {
      if (this.options.debugMode) {
        console.warn('[NotificationQueueManager] Notifica già in coda:', notification.title);
      }
      return false;
    }

    const queuedNotification: QueuedNotification = {
      ...notification,
      queuedAt: Date.now(),
      attempts: 0,
      maxAttempts: options?.maxAttempts || this.options.maxRetryAttempts,
      onShow: options?.onShow,
      onDequeue: options?.onDequeue
    };

    // Le notifiche urgenti vanno in testa se abilitato
    if (this.options.urgentBypassQueue && 
        notification.priority === NotificationPriority.URGENT) {
      this.queue.unshift(queuedNotification);
    } else {
      this.queue.push(queuedNotification);
    }

    if (this.options.debugMode) {
      console.log('[NotificationQueueManager] Notifica accodata:', notification.title);
    }

    // Notifica i callback del cambiamento
    this.notifyStatsCallbacks();

    // Prova a processare immediatamente se non ci sono interferenze
    if (!this.interferenceDetector.hasInterferences()) {
      setTimeout(() => this.processQueue(), 100);
    }

    return true;
  }

  private removeOldestLowPriorityNotification(): void {
    // Trova la notifica più vecchia con priorità bassa o normale
    let oldestIndex = -1;
    let oldestTime = Date.now();

    for (let i = 0; i < this.queue.length; i++) {
      const notification = this.queue[i];
      if ((notification.priority === NotificationPriority.LOW || 
           notification.priority === NotificationPriority.NORMAL) &&
          notification.queuedAt < oldestTime) {
        oldestTime = notification.queuedAt;
        oldestIndex = i;
      }
    }

    if (oldestIndex >= 0) {
      const removed = this.queue.splice(oldestIndex, 1)[0];
      if (this.options.debugMode) {
        console.log('[NotificationQueueManager] Notifica rimossa per spazio:', removed.title);
      }
    }
  }

  public dequeue(notificationId: string): boolean {
    const index = this.queue.findIndex(n => n.id === notificationId);
    if (index >= 0) {
      const removed = this.queue.splice(index, 1)[0];
      
      if (removed.onDequeue) {
        removed.onDequeue();
      }

      this.notifyStatsCallbacks();

      if (this.options.debugMode) {
        console.log('[NotificationQueueManager] Notifica rimossa dalla coda:', removed.title);
      }
      
      return true;
    }
    return false;
  }

  public clearQueue(): number {
    const count = this.queue.length;
    
    // Chiama i callback di dequeue per tutte le notifiche
    this.queue.forEach(notification => {
      if (notification.onDequeue) {
        notification.onDequeue();
      }
    });

    this.queue = [];
    this.notifyStatsCallbacks();

    if (this.options.debugMode) {
      console.log(`[NotificationQueueManager] Coda svuotata: ${count} notifiche rimosse`);
    }

    return count;
  }

  public getQueueStats(): QueueStats {
    const now = Date.now();
    const byPriority: Record<NotificationPriority, number> = {
      [NotificationPriority.URGENT]: 0,
      [NotificationPriority.HIGH]: 0,
      [NotificationPriority.NORMAL]: 0,
      [NotificationPriority.LOW]: 0
    };

    let totalWaitTime = 0;
    let oldestQueueTime: number | null = null;

    this.queue.forEach(notification => {
      byPriority[notification.priority]++;
      
      const waitTime = now - notification.queuedAt;
      totalWaitTime += waitTime;
      
      if (oldestQueueTime === null || notification.queuedAt < oldestQueueTime) {
        oldestQueueTime = notification.queuedAt;
      }
    });

    return {
      totalQueued: this.queue.length,
      byPriority,
      oldestQueueTime,
      averageWaitTime: this.queue.length > 0 ? totalWaitTime / this.queue.length : 0
    };
  }

  public getQueuedNotifications(): QueuedNotification[] {
    return [...this.queue];
  }

  public hasQueuedNotifications(): boolean {
    return this.queue.length > 0;
  }

  public getQueuedNotificationById(id: string): QueuedNotification | undefined {
    return this.queue.find(n => n.id === id);
  }

  public onStatsChange(callback: (stats: QueueStats) => void): () => void {
    this.callbacks.add(callback);
    
    // Restituisci funzione di cleanup
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public forceProcessQueue(): void {
    this.processQueue();
  }

  public updateOptions(newOptions: Partial<NotificationQueueOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    if (this.options.debugMode) {
      console.log('[NotificationQueueManager] Opzioni aggiornate:', this.options);
    }
  }

  public destroy(): void {
    // Cleanup
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Svuota la coda
    this.clearQueue();
    this.callbacks.clear();

    if (this.options.debugMode) {
      console.log('[NotificationQueueManager] Distrutto');
    }
  }
}

// Hook React per utilizzare il queue manager
export function useNotificationQueue(options?: NotificationQueueOptions) {
  const [stats, setStats] = React.useState<QueueStats>({
    totalQueued: 0,
    byPriority: {
      [NotificationPriority.URGENT]: 0,
      [NotificationPriority.HIGH]: 0,
      [NotificationPriority.NORMAL]: 0,
      [NotificationPriority.LOW]: 0
    },
    oldestQueueTime: null,
    averageWaitTime: 0
  });

  const [queueManager] = React.useState(() => 
    NotificationQueueManager.getInstance(options)
  );

  React.useEffect(() => {
    const unsubscribe = queueManager.onStatsChange(setStats);
    
    // Carica stato iniziale
    setStats(queueManager.getQueueStats());
    
    return unsubscribe;
  }, [queueManager]);

  return {
    stats,
    enqueue: queueManager.enqueue.bind(queueManager),
    dequeue: queueManager.dequeue.bind(queueManager),
    clearQueue: queueManager.clearQueue.bind(queueManager),
    forceProcessQueue: queueManager.forceProcessQueue.bind(queueManager),
    getQueuedNotifications: queueManager.getQueuedNotifications.bind(queueManager),
    hasQueuedNotifications: queueManager.hasQueuedNotifications.bind(queueManager)
  };
}

export default NotificationQueueManager;