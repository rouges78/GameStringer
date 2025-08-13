'use client';

import React from 'react';
import { NotificationPriority } from '@/types/notifications';
import OptimalPositioningAlgorithm, { PositionCandidate, ToastDimensions } from './optimal-positioning-algorithm';
import { UIInterference } from './ui-interference-detector';

/**
 * Gestisce lo stack di notifiche multiple con posizionamento ottimale
 * Coordina il posizionamento di più toast evitando sovrapposizioni
 */

export interface StackedToast {
  id: string;
  element: HTMLElement;
  dimensions: ToastDimensions;
  priority: NotificationPriority;
  timestamp: number;
  position: PositionCandidate;
  isVisible: boolean;
  isAnimating: boolean;
}

export interface StackConfiguration {
  maxVisible: number;
  stackDirection: 'vertical' | 'horizontal' | 'grid' | 'adaptive';
  spacing: number;
  animationDuration: number;
  collapseThreshold: number;
  enableAutoCollapse: boolean;
  enablePriorityReordering: boolean;
}

export interface StackStats {
  totalToasts: number;
  visibleToasts: number;
  hiddenToasts: number;
  byPriority: Record<NotificationPriority, number>;
  averageAge: number;
  stackHeight: number;
  stackWidth: number;
}

class NotificationStackManager {
  private static instance: NotificationStackManager;
  private toasts: Map<string, StackedToast> = new Map();
  private positioningAlgorithm: OptimalPositioningAlgorithm;
  private repositionTimer: NodeJS.Timeout | null = null;
  private callbacks: Set<(stats: StackStats) => void> = new Set();

  private config: StackConfiguration = {
    maxVisible: 5,
    stackDirection: 'adaptive',
    spacing: 16,
    animationDuration: 300,
    collapseThreshold: 3,
    enableAutoCollapse: true,
    enablePriorityReordering: true
  };

  private constructor(config?: Partial<StackConfiguration>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.positioningAlgorithm = OptimalPositioningAlgorithm.getInstance();
    this.initialize();
  }

  public static getInstance(config?: Partial<StackConfiguration>): NotificationStackManager {
    if (!NotificationStackManager.instance) {
      NotificationStackManager.instance = new NotificationStackManager(config);
    }
    return NotificationStackManager.instance;
  }

  private initialize(): void {
    // Ascolta cambiamenti nella finestra per riposizionare
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleWindowResize);
      window.addEventListener('scroll', this.handleWindowScroll);
    }
  }

  private handleWindowResize = (): void => {
    this.debounceReposition();
  };

  private handleWindowScroll = (): void => {
    this.debounceReposition();
  };

  private debounceReposition(): void {
    if (this.repositionTimer) {
      clearTimeout(this.repositionTimer);
    }

    this.repositionTimer = setTimeout(() => {
      this.repositionAllToasts();
    }, 150);
  }

  /**
   * Aggiunge un toast allo stack
   */
  public addToast(
    id: string,
    element: HTMLElement,
    priority: NotificationPriority,
    dimensions?: ToastDimensions
  ): boolean {
    if (this.toasts.has(id)) {
      return false; // Toast già presente
    }

    const rect = element.getBoundingClientRect();
    const toastDimensions = dimensions || {
      width: rect.width || 400,
      height: rect.height || 100
    };

    const stackedToast: StackedToast = {
      id,
      element,
      dimensions: toastDimensions,
      priority,
      timestamp: Date.now(),
      position: {
        x: 0,
        y: 0,
        score: 0,
        conflicts: 0,
        reason: 'Initial position',
        area: 'top-right'
      },
      isVisible: false,
      isAnimating: false
    };

    this.toasts.set(id, stackedToast);
    this.repositionAllToasts();
    this.notifyCallbacks();

    return true;
  }

  /**
   * Rimuove un toast dallo stack
   */
  public removeToast(id: string): boolean {
    const toast = this.toasts.get(id);
    if (!toast) {
      return false;
    }

    // Anima l'uscita
    toast.isAnimating = true;
    this.animateToastExit(toast);

    // Rimuovi dopo l'animazione
    setTimeout(() => {
      this.toasts.delete(id);
      this.repositionAllToasts();
      this.notifyCallbacks();
    }, this.config.animationDuration);

    return true;
  }

  /**
   * Riposiziona tutti i toast nello stack
   */
  public repositionAllToasts(interferences: UIInterference[] = []): void {
    const visibleToasts = Array.from(this.toasts.values())
      .filter(toast => !toast.isAnimating)
      .sort(this.getToastSortComparator());

    // Limita il numero di toast visibili
    const toastsToShow = visibleToasts.slice(0, this.config.maxVisible);
    const toastsToHide = visibleToasts.slice(this.config.maxVisible);

    // Nascondi toast in eccesso
    toastsToHide.forEach(toast => {
      if (toast.isVisible) {
        this.hideToast(toast);
      }
    });

    if (toastsToShow.length === 0) return;

    // Calcola posizioni ottimali
    const positions = this.calculateOptimalPositions(toastsToShow, interferences);

    // Applica le posizioni
    positions.forEach((position, index) => {
      const toast = toastsToShow[index];
      if (toast) {
        this.updateToastPosition(toast, position);
      }
    });
  }

  private getToastSortComparator() {
    return (a: StackedToast, b: StackedToast) => {
      if (this.config.enablePriorityReordering) {
        // Prima per priorità
        const priorityOrder = {
          [NotificationPriority.URGENT]: 4,
          [NotificationPriority.HIGH]: 3,
          [NotificationPriority.NORMAL]: 2,
          [NotificationPriority.LOW]: 1
        };

        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
      }

      // Poi per timestamp (più recenti prima)
      return b.timestamp - a.timestamp;
    };
  }

  private calculateOptimalPositions(
    toasts: StackedToast[],
    interferences: UIInterference[]
  ): PositionCandidate[] {
    const toastData = toasts.map(toast => ({
      id: toast.id,
      dimensions: toast.dimensions,
      priority: this.getPriorityScore(toast.priority)
    }));

    const positions = this.positioningAlgorithm.findOptimalStackPositions(
      toastData,
      interferences,
      {
        minMargin: this.config.spacing,
        maxToastsPerArea: this.config.maxVisible,
        stackDirection: this.config.stackDirection === 'adaptive' 
          ? this.determineAdaptiveDirection(toasts.length)
          : this.config.stackDirection,
        allowOverlap: false
      }
    );

    return positions.map(pos => ({
      x: pos.x,
      y: pos.y,
      score: pos.score,
      conflicts: pos.conflicts,
      reason: pos.reason,
      area: pos.area
    }));
  }

  private determineAdaptiveDirection(toastCount: number): 'vertical' | 'horizontal' | 'grid' {
    if (toastCount <= 2) return 'vertical';
    if (toastCount <= 4) return 'horizontal';
    return 'grid';
  }

  private getPriorityScore(priority: NotificationPriority): number {
    const scores = {
      [NotificationPriority.URGENT]: 4,
      [NotificationPriority.HIGH]: 3,
      [NotificationPriority.NORMAL]: 2,
      [NotificationPriority.LOW]: 1
    };
    return scores[priority];
  }

  private updateToastPosition(toast: StackedToast, position: PositionCandidate): void {
    toast.position = position;
    
    if (!toast.isVisible) {
      this.showToast(toast);
    } else {
      this.animateToastMove(toast, position);
    }
  }

  private showToast(toast: StackedToast): void {
    toast.isVisible = true;
    toast.isAnimating = true;

    const element = toast.element;
    
    // Imposta posizione iniziale (fuori schermo)
    element.style.position = 'fixed';
    element.style.transform = `translate(${toast.position.x + 400}px, ${toast.position.y}px)`;
    element.style.opacity = '0';
    element.style.transition = `all ${this.config.animationDuration}ms ease-out`;

    // Anima verso la posizione finale
    requestAnimationFrame(() => {
      element.style.transform = `translate(${toast.position.x}px, ${toast.position.y}px)`;
      element.style.opacity = '1';
    });

    // Rimuovi flag animazione
    setTimeout(() => {
      toast.isAnimating = false;
    }, this.config.animationDuration);
  }

  private hideToast(toast: StackedToast): void {
    toast.isVisible = false;
    toast.isAnimating = true;

    this.animateToastExit(toast);

    setTimeout(() => {
      toast.isAnimating = false;
    }, this.config.animationDuration);
  }

  private animateToastMove(toast: StackedToast, newPosition: PositionCandidate): void {
    const element = toast.element;
    
    element.style.transition = `transform ${this.config.animationDuration}ms ease-out`;
    element.style.transform = `translate(${newPosition.x}px, ${newPosition.y}px)`;
  }

  private animateToastExit(toast: StackedToast): void {
    const element = toast.element;
    
    element.style.transition = `all ${this.config.animationDuration}ms ease-in`;
    element.style.transform = `translate(${toast.position.x + 400}px, ${toast.position.y}px)`;
    element.style.opacity = '0';
  }

  /**
   * Collassa lo stack quando ci sono troppi toast
   */
  public collapseStack(): void {
    if (!this.config.enableAutoCollapse) return;

    const visibleToasts = Array.from(this.toasts.values())
      .filter(toast => toast.isVisible)
      .sort(this.getToastSortComparator());

    if (visibleToasts.length <= this.config.collapseThreshold) return;

    // Mantieni solo i toast più importanti
    const toastsToKeep = visibleToasts.slice(0, this.config.collapseThreshold);
    const toastsToCollapse = visibleToasts.slice(this.config.collapseThreshold);

    toastsToCollapse.forEach(toast => {
      this.hideToast(toast);
    });

    // Riposiziona i toast rimanenti
    setTimeout(() => {
      this.repositionAllToasts();
    }, this.config.animationDuration);
  }

  /**
   * Espande lo stack mostrando toast nascosti
   */
  public expandStack(): void {
    const hiddenToasts = Array.from(this.toasts.values())
      .filter(toast => !toast.isVisible && !toast.isAnimating)
      .sort(this.getToastSortComparator());

    const availableSlots = this.config.maxVisible - this.getVisibleCount();
    const toastsToShow = hiddenToasts.slice(0, availableSlots);

    toastsToShow.forEach(toast => {
      this.showToast(toast);
    });

    this.repositionAllToasts();
  }

  // API pubblica
  public getToast(id: string): StackedToast | undefined {
    return this.toasts.get(id);
  }

  public getAllToasts(): StackedToast[] {
    return Array.from(this.toasts.values());
  }

  public getVisibleToasts(): StackedToast[] {
    return Array.from(this.toasts.values()).filter(toast => toast.isVisible);
  }

  public getVisibleCount(): number {
    return this.getVisibleToasts().length;
  }

  public getTotalCount(): number {
    return this.toasts.size;
  }

  public getStackStats(): StackStats {
    const toasts = Array.from(this.toasts.values());
    const visible = toasts.filter(t => t.isVisible);
    const now = Date.now();

    const byPriority: Record<NotificationPriority, number> = {
      [NotificationPriority.URGENT]: 0,
      [NotificationPriority.HIGH]: 0,
      [NotificationPriority.NORMAL]: 0,
      [NotificationPriority.LOW]: 0
    };

    let totalAge = 0;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    toasts.forEach(toast => {
      byPriority[toast.priority]++;
      totalAge += now - toast.timestamp;

      if (toast.isVisible) {
        minX = Math.min(minX, toast.position.x);
        maxX = Math.max(maxX, toast.position.x + toast.dimensions.width);
        minY = Math.min(minY, toast.position.y);
        maxY = Math.max(maxY, toast.position.y + toast.dimensions.height);
      }
    });

    return {
      totalToasts: toasts.length,
      visibleToasts: visible.length,
      hiddenToasts: toasts.length - visible.length,
      byPriority,
      averageAge: toasts.length > 0 ? totalAge / toasts.length : 0,
      stackHeight: maxY - minY,
      stackWidth: maxX - minX
    };
  }

  public updateConfiguration(newConfig: Partial<StackConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    this.repositionAllToasts();
  }

  public clearStack(): void {
    this.toasts.forEach(toast => {
      this.animateToastExit(toast);
    });

    setTimeout(() => {
      this.toasts.clear();
      this.notifyCallbacks();
    }, this.config.animationDuration);
  }

  public onStatsChange(callback: (stats: StackStats) => void): () => void {
    this.callbacks.add(callback);
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private notifyCallbacks(): void {
    const stats = this.getStackStats();
    this.callbacks.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        console.error('[NotificationStackManager] Errore nel callback:', error);
      }
    });
  }

  public destroy(): void {
    if (this.repositionTimer) {
      clearTimeout(this.repositionTimer);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleWindowResize);
      window.removeEventListener('scroll', this.handleWindowScroll);
    }

    this.clearStack();
    this.callbacks.clear();
  }
}

// Hook React per utilizzare lo stack manager
export function useNotificationStack(config?: Partial<StackConfiguration>) {
  const [stackManager] = React.useState(() => 
    NotificationStackManager.getInstance(config)
  );

  const [stats, setStats] = React.useState<StackStats>(() => 
    stackManager.getStackStats()
  );

  React.useEffect(() => {
    const unsubscribe = stackManager.onStatsChange(setStats);
    return unsubscribe;
  }, [stackManager]);

  return {
    addToast: stackManager.addToast.bind(stackManager),
    removeToast: stackManager.removeToast.bind(stackManager),
    repositionAllToasts: stackManager.repositionAllToasts.bind(stackManager),
    collapseStack: stackManager.collapseStack.bind(stackManager),
    expandStack: stackManager.expandStack.bind(stackManager),
    clearStack: stackManager.clearStack.bind(stackManager),
    getVisibleToasts: stackManager.getVisibleToasts.bind(stackManager),
    updateConfiguration: stackManager.updateConfiguration.bind(stackManager),
    stats
  };
}

export default NotificationStackManager;