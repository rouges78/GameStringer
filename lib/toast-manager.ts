/**
 * Toast Notification Manager
 * Centralized toast system with queue, priority, and persistence
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'promise';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastOptions {
  id?: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
  position?: ToastPosition;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  icon?: React.ReactNode;
  progress?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

export interface Toast extends ToastOptions {
  id: string;
  createdAt: number;
  visible: boolean;
}

type ToastListener = (toasts: Toast[]) => void;

class ToastManager {
  private toasts: Toast[] = [];
  private listeners: Set<ToastListener> = new Set();
  private defaultDuration = 5000;
  private maxToasts = 5;
  private defaultPosition: ToastPosition = 'bottom-right';

  /**
   * Show a toast notification
   */
  show(options: ToastOptions): string {
    const id = options.id || `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const toast: Toast = {
      ...options,
      id,
      createdAt: Date.now(),
      visible: true,
      duration: options.duration ?? this.getDurationByType(options.type),
      position: options.position ?? this.defaultPosition,
      dismissible: options.dismissible ?? true,
      priority: options.priority ?? 'normal',
    };

    // Remove oldest toasts if at max
    while (this.toasts.length >= this.maxToasts) {
      const oldestNonPriority = this.toasts.find(t => t.priority !== 'high');
      if (oldestNonPriority) {
        this.dismiss(oldestNonPriority.id);
      } else {
        break;
      }
    }

    // Sort by priority
    this.toasts.push(toast);
    this.toasts.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority!] - priorityOrder[b.priority!];
    });

    this.notify();

    // Auto dismiss
    if (toast.duration && toast.duration > 0 && toast.type !== 'loading') {
      setTimeout(() => this.dismiss(id), toast.duration);
    }

    return id;
  }

  /**
   * Show success toast
   */
  success(title: string, description?: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, title, description, type: 'success' });
  }

  /**
   * Show error toast
   */
  error(title: string, description?: string, options?: Partial<ToastOptions>): string {
    return this.show({ 
      ...options, 
      title, 
      description, 
      type: 'error',
      duration: options?.duration ?? 8000, // Errors last longer
      priority: 'high'
    });
  }

  /**
   * Show warning toast
   */
  warning(title: string, description?: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, title, description, type: 'warning' });
  }

  /**
   * Show info toast
   */
  info(title: string, description?: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, title, description, type: 'info' });
  }

  /**
   * Show loading toast (persists until dismissed)
   */
  loading(title: string, description?: string, options?: Partial<ToastOptions>): string {
    return this.show({ 
      ...options, 
      title, 
      description, 
      type: 'loading',
      duration: 0,
      dismissible: false
    });
  }

  /**
   * Show promise toast (loading -> success/error)
   */
  async promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    },
    options?: Partial<ToastOptions>
  ): Promise<T> {
    const id = this.loading(messages.loading, undefined, options);

    try {
      const result = await promise;
      this.update(id, {
        title: typeof messages.success === 'function' ? messages.success(result) : messages.success,
        type: 'success',
        duration: 3000,
        dismissible: true,
      });
      return result;
    } catch (error: unknown) {
      this.update(id, {
        title: typeof messages.error === 'function' ? messages.error(error as Error) : messages.error,
        type: 'error',
        duration: 5000,
        dismissible: true,
      });
      throw error;
    }
  }

  /**
   * Update existing toast
   */
  update(id: string, updates: Partial<ToastOptions>): void {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index === -1) return;

    this.toasts[index] = { ...this.toasts[index], ...updates };
    this.notify();

    // Set new auto-dismiss if duration changed
    if (updates.duration && updates.duration > 0) {
      setTimeout(() => this.dismiss(id), updates.duration);
    }
  }

  /**
   * Dismiss a toast
   */
  dismiss(id: string): void {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast) return;

    toast.visible = false;
    toast.onDismiss?.();
    
    // Remove after animation
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.notify();
    }, 300);

    this.notify();
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this.toasts.forEach(t => t.visible = false);
    this.notify();
    
    setTimeout(() => {
      this.toasts = [];
      this.notify();
    }, 300);
  }

  /**
   * Get all toasts
   */
  getToasts(): Toast[] {
    return [...this.toasts];
  }

  /**
   * Subscribe to toast changes
   */
  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notify(): void {
    const toasts = this.getToasts();
    this.listeners.forEach(listener => listener(toasts));
  }

  /**
   * Get default duration by type
   */
  private getDurationByType(type: ToastType): number {
    switch (type) {
      case 'success': return 3000;
      case 'error': return 8000;
      case 'warning': return 5000;
      case 'info': return 4000;
      case 'loading': return 0;
      default: return this.defaultDuration;
    }
  }

  /**
   * Configure defaults
   */
  configure(options: {
    defaultDuration?: number;
    maxToasts?: number;
    defaultPosition?: ToastPosition;
  }): void {
    if (options.defaultDuration) this.defaultDuration = options.defaultDuration;
    if (options.maxToasts) this.maxToasts = options.maxToasts;
    if (options.defaultPosition) this.defaultPosition = options.defaultPosition;
  }
}

// Singleton instance
export const toast = new ToastManager();

// React hook
import { useState, useEffect } from 'react';

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return toast.subscribe(setToasts);
  }, []);

  return {
    toasts,
    show: toast.show.bind(toast),
    success: toast.success.bind(toast),
    error: toast.error.bind(toast),
    warning: toast.warning.bind(toast),
    info: toast.info.bind(toast),
    loading: toast.loading.bind(toast),
    promise: toast.promise.bind(toast),
    dismiss: toast.dismiss.bind(toast),
    dismissAll: toast.dismissAll.bind(toast),
    update: toast.update.bind(toast),
  };
}

// Convenience export
export default toast;
