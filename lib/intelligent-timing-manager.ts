'use client';

import { NotificationPriority } from '@/types/notifications';
import UIInterferenceDetector from './ui-interference-detector';

/**
 * Gestisce il timing intelligente per il dismissal automatico delle notifiche
 * Adatta i tempi in base al contesto, interferenze e priorità
 */

export interface TimingRule {
  priority: NotificationPriority;
  baseTimeout: number;
  interferenceMultiplier: number;
  userActivityMultiplier: number;
  maxTimeout: number;
  minTimeout: number;
}

export interface TimingContext {
  hasInterferences: boolean;
  hasHighPriorityInterferences: boolean;
  userActivity: 'active' | 'idle' | 'away';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  notificationCount: number;
}

export interface IntelligentTimingOptions {
  enableAdaptiveTiming?: boolean;
  enableUserActivityDetection?: boolean;
  enableTimeOfDayAdjustment?: boolean;
  enableInterferenceAdjustment?: boolean;
  debugMode?: boolean;
}

class IntelligentTimingManager {
  private static instance: IntelligentTimingManager;
  private interferenceDetector: UIInterferenceDetector;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private userActivity: TimingContext['userActivity'] = 'active';
  private lastUserActivity: number = Date.now();
  private activityListeners: (() => void)[] = [];

  private options: Required<IntelligentTimingOptions> = {
    enableAdaptiveTiming: true,
    enableUserActivityDetection: true,
    enableTimeOfDayAdjustment: true,
    enableInterferenceAdjustment: true,
    debugMode: false
  };

  // Regole di timing per priorità
  private timingRules: Record<NotificationPriority, TimingRule> = {
    [NotificationPriority.URGENT]: {
      priority: NotificationPriority.URGENT,
      baseTimeout: 10000, // 10 secondi
      interferenceMultiplier: 1.5,
      userActivityMultiplier: 1.2,
      maxTimeout: 20000,
      minTimeout: 8000
    },
    [NotificationPriority.HIGH]: {
      priority: NotificationPriority.HIGH,
      baseTimeout: 8000, // 8 secondi
      interferenceMultiplier: 2.0,
      userActivityMultiplier: 1.5,
      maxTimeout: 15000,
      minTimeout: 6000
    },
    [NotificationPriority.NORMAL]: {
      priority: NotificationPriority.NORMAL,
      baseTimeout: 5000, // 5 secondi
      interferenceMultiplier: 3.0,
      userActivityMultiplier: 2.0,
      maxTimeout: 12000,
      minTimeout: 4000
    },
    [NotificationPriority.LOW]: {
      priority: NotificationPriority.LOW,
      baseTimeout: 3000, // 3 secondi
      interferenceMultiplier: 4.0,
      userActivityMultiplier: 2.5,
      maxTimeout: 8000,
      minTimeout: 2000
    }
  };

  private constructor(options?: IntelligentTimingOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    this.interferenceDetector = UIInterferenceDetector.getInstance();
    this.initialize();
  }

  public static getInstance(options?: IntelligentTimingOptions): IntelligentTimingManager {
    if (!IntelligentTimingManager.instance) {
      IntelligentTimingManager.instance = new IntelligentTimingManager(options);
    }
    return IntelligentTimingManager.instance;
  }

  private initialize(): void {
    if (typeof window === 'undefined') return;

    if (this.options.enableUserActivityDetection) {
      this.setupUserActivityDetection();
    }

    if (this.options.debugMode) {
      console.log('[IntelligentTimingManager] Inizializzato con opzioni:', this.options);
    }
  }

  private setupUserActivityDetection(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      this.lastUserActivity = Date.now();
      this.userActivity = 'active';
    };

    events.forEach(event => {
      const listener = () => updateActivity();
      document.addEventListener(event, listener, true);
      this.activityListeners.push(() => {
        document.removeEventListener(event, listener, true);
      });
    });

    // Controlla periodicamente l'attività dell'utente
    const checkActivity = () => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastUserActivity;

      if (timeSinceActivity > 300000) { // 5 minuti
        this.userActivity = 'away';
      } else if (timeSinceActivity > 60000) { // 1 minuto
        this.userActivity = 'idle';
      } else {
        this.userActivity = 'active';
      }
    };

    setInterval(checkActivity, 10000); // Controlla ogni 10 secondi
  }

  private getCurrentContext(): TimingContext {
    const now = new Date();
    const hour = now.getHours();
    
    let timeOfDay: TimingContext['timeOfDay'];
    if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    return {
      hasInterferences: this.interferenceDetector.hasInterferences(),
      hasHighPriorityInterferences: this.interferenceDetector.hasHighPriorityInterferences(),
      userActivity: this.userActivity,
      timeOfDay,
      notificationCount: this.activeTimers.size
    };
  }

  private calculateOptimalTimeout(
    priority: NotificationPriority,
    context: TimingContext
  ): number {
    const rule = this.timingRules[priority];
    let timeout = rule.baseTimeout;

    if (!this.options.enableAdaptiveTiming) {
      return timeout;
    }

    // Aggiustamento per interferenze
    if (this.options.enableInterferenceAdjustment) {
      if (context.hasHighPriorityInterferences) {
        timeout *= rule.interferenceMultiplier;
      } else if (context.hasInterferences) {
        timeout *= (rule.interferenceMultiplier * 0.7);
      }
    }

    // Aggiustamento per attività utente
    if (this.options.enableUserActivityDetection) {
      switch (context.userActivity) {
        case 'away':
          timeout *= rule.userActivityMultiplier * 1.5;
          break;
        case 'idle':
          timeout *= rule.userActivityMultiplier;
          break;
        case 'active':
          // Nessun aggiustamento per utente attivo
          break;
      }
    }

    // Aggiustamento per ora del giorno
    if (this.options.enableTimeOfDayAdjustment) {
      switch (context.timeOfDay) {
        case 'night':
          timeout *= 1.5; // Più tempo di notte
          break;
        case 'evening':
          timeout *= 1.2;
          break;
        case 'morning':
          timeout *= 0.9; // Meno tempo al mattino (più attenzione)
          break;
        case 'afternoon':
          // Nessun aggiustamento
          break;
      }
    }

    // Aggiustamento per numero di notifiche attive
    if (context.notificationCount > 3) {
      timeout *= 1.3; // Più tempo se ci sono molte notifiche
    }

    // Applica limiti min/max
    timeout = Math.max(rule.minTimeout, Math.min(rule.maxTimeout, timeout));

    if (this.options.debugMode) {
      console.log(`[IntelligentTimingManager] Timeout calcolato per ${priority}:`, {
        base: rule.baseTimeout,
        calculated: timeout,
        context
      });
    }

    return Math.round(timeout);
  }

  // API pubblica
  public scheduleAutoDismiss(
    notificationId: string,
    priority: NotificationPriority,
    onDismiss: () => void,
    customTimeout?: number
  ): void {
    // Cancella timer esistente se presente
    this.cancelAutoDismiss(notificationId);

    const context = this.getCurrentContext();
    const timeout = customTimeout || this.calculateOptimalTimeout(priority, context);

    const timer = setTimeout(() => {
      this.activeTimers.delete(notificationId);
      onDismiss();
      
      if (this.options.debugMode) {
        console.log(`[IntelligentTimingManager] Auto-dismiss eseguito per ${notificationId}`);
      }
    }, timeout);

    this.activeTimers.set(notificationId, timer);

    if (this.options.debugMode) {
      console.log(`[IntelligentTimingManager] Timer schedulato per ${notificationId}: ${timeout}ms`);
    }
  }

  public cancelAutoDismiss(notificationId: string): boolean {
    const timer = this.activeTimers.get(notificationId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(notificationId);
      
      if (this.options.debugMode) {
        console.log(`[IntelligentTimingManager] Timer cancellato per ${notificationId}`);
      }
      
      return true;
    }
    return false;
  }

  public pauseAutoDismiss(notificationId: string): boolean {
    // Per ora, semplicemente cancella il timer
    // In futuro potremmo implementare una pausa vera
    return this.cancelAutoDismiss(notificationId);
  }

  public resumeAutoDismiss(
    notificationId: string,
    priority: NotificationPriority,
    onDismiss: () => void,
    remainingTime?: number
  ): void {
    if (remainingTime) {
      this.scheduleAutoDismiss(notificationId, priority, onDismiss, remainingTime);
    } else {
      this.scheduleAutoDismiss(notificationId, priority, onDismiss);
    }
  }

  public extendTimeout(notificationId: string, additionalTime: number): boolean {
    const timer = this.activeTimers.get(notificationId);
    if (timer) {
      // Cancella il timer esistente e crea uno nuovo con tempo esteso
      clearTimeout(timer);
      
      const newTimer = setTimeout(() => {
        this.activeTimers.delete(notificationId);
        // Nota: non possiamo chiamare onDismiss qui perché non l'abbiamo salvato
        // Questo è un limite dell'implementazione attuale
      }, additionalTime);
      
      this.activeTimers.set(notificationId, newTimer);
      
      if (this.options.debugMode) {
        console.log(`[IntelligentTimingManager] Timeout esteso per ${notificationId}: +${additionalTime}ms`);
      }
      
      return true;
    }
    return false;
  }

  public getActiveTimers(): string[] {
    return Array.from(this.activeTimers.keys());
  }

  public getTimingRule(priority: NotificationPriority): TimingRule {
    return { ...this.timingRules[priority] };
  }

  public updateTimingRule(priority: NotificationPriority, updates: Partial<TimingRule>): void {
    this.timingRules[priority] = {
      ...this.timingRules[priority],
      ...updates
    };

    if (this.options.debugMode) {
      console.log(`[IntelligentTimingManager] Regola aggiornata per ${priority}:`, 
        this.timingRules[priority]);
    }
  }

  public getCurrentUserActivity(): TimingContext['userActivity'] {
    return this.userActivity;
  }

  public getTimingStats(): {
    activeTimers: number;
    userActivity: TimingContext['userActivity'];
    context: TimingContext;
  } {
    return {
      activeTimers: this.activeTimers.size,
      userActivity: this.userActivity,
      context: this.getCurrentContext()
    };
  }

  public updateOptions(newOptions: Partial<IntelligentTimingOptions>): void {
    this.options = { ...this.options, ...newOptions };
    
    if (this.options.debugMode) {
      console.log('[IntelligentTimingManager] Opzioni aggiornate:', this.options);
    }
  }

  public destroy(): void {
    // Cancella tutti i timer attivi
    this.activeTimers.forEach(timer => clearTimeout(timer));
    this.activeTimers.clear();

    // Rimuovi listener attività utente
    this.activityListeners.forEach(cleanup => cleanup());
    this.activityListeners = [];

    if (this.options.debugMode) {
      console.log('[IntelligentTimingManager] Distrutto');
    }
  }
}

import React from 'react';

// Hook React per utilizzare il timing manager
export function useIntelligentTiming(options?: IntelligentTimingOptions) {
  const [timingManager] = React.useState(() => 
    IntelligentTimingManager.getInstance(options)
  );

  const [stats, setStats] = React.useState(() => timingManager.getTimingStats());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStats(timingManager.getTimingStats());
    }, 5000); // Aggiorna ogni 5 secondi

    return () => clearInterval(interval);
  }, [timingManager]);

  return {
    scheduleAutoDismiss: timingManager.scheduleAutoDismiss.bind(timingManager),
    cancelAutoDismiss: timingManager.cancelAutoDismiss.bind(timingManager),
    pauseAutoDismiss: timingManager.pauseAutoDismiss.bind(timingManager),
    resumeAutoDismiss: timingManager.resumeAutoDismiss.bind(timingManager),
    extendTimeout: timingManager.extendTimeout.bind(timingManager),
    getTimingRule: timingManager.getTimingRule.bind(timingManager),
    updateTimingRule: timingManager.updateTimingRule.bind(timingManager),
    stats
  };
}

export default IntelligentTimingManager;