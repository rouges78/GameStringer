/**
 * Unified Notification System
 * Centralizza tutte le notifiche dell'app (toast, alerts, etc.)
 */

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Store reference to toast function
let toastFn: ((opts: any) => void) | null = null;

/**
 * Initialize the notification system with the toast function
 * Call this once in your app root with useToast hook
 */
export function initNotifications(toast: (opts: any) => void) {
  toastFn = toast;
}

/**
 * Show a notification
 */
export function notify(
  type: NotificationType,
  message: string,
  options?: NotificationOptions
) {
  if (!toastFn) {
    console.warn('Notifications not initialized. Call initNotifications first.');
    console.log(`[${type.toUpperCase()}] ${message}`);
    return;
  }

  const variantMap: Record<NotificationType, 'default' | 'destructive'> = {
    success: 'default',
    error: 'destructive',
    warning: 'default',
    info: 'default',
  };

  toastFn({
    title: options?.title || getDefaultTitle(type),
    description: options?.description || message,
    variant: variantMap[type],
    duration: options?.duration || 4000,
    action: options?.action,
  });
}

function getDefaultTitle(type: NotificationType): string {
  switch (type) {
    case 'success': return '✓ Successo';
    case 'error': return '✕ Errore';
    case 'warning': return '⚠ Attenzione';
    case 'info': return 'ℹ Info';
  }
}

// Convenience methods
export const notifications = {
  success: (message: string, options?: Omit<NotificationOptions, 'title'>) =>
    notify('success', message, { title: '✓ Successo', ...options }),
  
  error: (message: string, options?: Omit<NotificationOptions, 'title'>) =>
    notify('error', message, { title: '✕ Errore', ...options }),
  
  warning: (message: string, options?: Omit<NotificationOptions, 'title'>) =>
    notify('warning', message, { title: '⚠ Attenzione', ...options }),
  
  info: (message: string, options?: Omit<NotificationOptions, 'title'>) =>
    notify('info', message, { title: 'ℹ Info', ...options }),

  // Promise-based for async operations
  promise: async <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    }
  ): Promise<T> => {
    notify('info', messages.loading);
    
    try {
      const result = await promise;
      const successMsg = typeof messages.success === 'function' 
        ? messages.success(result) 
        : messages.success;
      notify('success', successMsg);
      return result;
    } catch (err) {
      const errorMsg = typeof messages.error === 'function'
        ? messages.error(err as Error)
        : messages.error;
      notify('error', errorMsg);
      throw err;
    }
  },
};

export default notifications;
