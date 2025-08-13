/**
 * Utility functions for notification accessibility and screen reader support
 */

import { NotificationType, NotificationPriority } from '@/types/notifications';

/**
 * Announces a message to screen readers using a live region
 */
export function announceToScreenReader(
  message: string, 
  priority: 'polite' | 'assertive' = 'polite',
  duration: number = 1000
): void {
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.setAttribute('class', 'sr-only');
  liveRegion.textContent = message;
  
  document.body.appendChild(liveRegion);
  
  setTimeout(() => {
    if (document.body.contains(liveRegion)) {
      document.body.removeChild(liveRegion);
    }
  }, duration);
}

/**
 * Gets human-readable text for notification priority
 */
export function getPriorityText(priority: NotificationPriority): string {
  switch (priority) {
    case NotificationPriority.URGENT:
      return 'Notifica urgente';
    case NotificationPriority.HIGH:
      return 'Notifica ad alta priorità';
    case NotificationPriority.NORMAL:
      return 'Notifica';
    case NotificationPriority.LOW:
      return 'Notifica a bassa priorità';
    default:
      return 'Notifica';
  }
}

/**
 * Gets human-readable text for notification type
 */
export function getTypeText(type: NotificationType): string {
  switch (type) {
    case NotificationType.SECURITY:
      return 'di sicurezza';
    case NotificationType.SYSTEM:
      return 'di sistema';
    case NotificationType.PROFILE:
      return 'del profilo';
    case NotificationType.UPDATE:
      return 'di aggiornamento';
    case NotificationType.GAME:
      return 'di gioco';
    case NotificationType.STORE:
      return 'dello store';
    case NotificationType.CUSTOM:
      return 'personalizzata';
    default:
      return 'generica';
  }
}

/**
 * Gets ARIA label for notification icons
 */
export function getIconAriaLabel(type: NotificationType): string {
  switch (type) {
    case NotificationType.SECURITY:
      return 'Icona sicurezza';
    case NotificationType.SYSTEM:
      return 'Icona sistema';
    case NotificationType.PROFILE:
      return 'Icona profilo';
    case NotificationType.UPDATE:
      return 'Icona aggiornamento';
    case NotificationType.GAME:
      return 'Icona gioco';
    case NotificationType.STORE:
      return 'Icona store';
    default:
      return 'Icona notifica';
  }
}

/**
 * Creates a comprehensive announcement for a new notification
 */
export function createNotificationAnnouncement(
  title: string,
  message: string,
  type: NotificationType,
  priority: NotificationPriority
): string {
  const priorityText = getPriorityText(priority);
  const typeText = getTypeText(type);
  return `${priorityText} ${typeText}: ${title}. ${message}`;
}

/**
 * Announces notification count changes
 */
export function announceNotificationCount(
  newCount: number,
  previousCount: number = 0
): void {
  const difference = newCount - previousCount;
  
  if (difference > 0) {
    const message = difference === 1 
      ? `Nuova notifica ricevuta. Totale: ${newCount} notifiche non lette.`
      : `${difference} nuove notifiche ricevute. Totale: ${newCount} notifiche non lette.`;
    
    announceToScreenReader(message, 'polite');
  } else if (newCount === 0 && previousCount > 0) {
    announceToScreenReader('Tutte le notifiche sono state lette.', 'polite');
  }
}

/**
 * Announces notification dismissal
 */
export function announceDismissal(title: string): void {
  announceToScreenReader(`Notifica "${title}" chiusa`, 'polite');
}

/**
 * Announces batch operations
 */
export function announceBatchOperation(
  operation: 'read' | 'delete' | 'select',
  count: number
): void {
  let message: string;
  
  switch (operation) {
    case 'read':
      message = count === 1 
        ? '1 notifica marcata come letta'
        : `${count} notifiche marcate come lette`;
      break;
    case 'delete':
      message = count === 1 
        ? '1 notifica eliminata'
        : `${count} notifiche eliminate`;
      break;
    case 'select':
      message = count === 1 
        ? '1 notifica selezionata'
        : `${count} notifiche selezionate`;
      break;
    default:
      message = `Operazione completata su ${count} notifiche`;
  }
  
  announceToScreenReader(message, 'polite');
}

/**
 * Announces filter changes
 */
export function announceFilterChange(
  totalNotifications: number,
  filteredNotifications: number,
  filterDescription?: string
): void {
  let message = `Mostrando ${filteredNotifications} di ${totalNotifications} notifiche`;
  
  if (filterDescription) {
    message += `. Filtro attivo: ${filterDescription}`;
  }
  
  announceToScreenReader(message, 'polite');
}

/**
 * Announces search results
 */
export function announceSearchResults(
  query: string,
  resultCount: number,
  totalCount: number
): void {
  const message = resultCount === 0
    ? `Nessun risultato trovato per "${query}"`
    : `${resultCount} risultati trovati per "${query}" su ${totalCount} notifiche totali`;
  
  announceToScreenReader(message, 'polite');
}

/**
 * Gets keyboard shortcut descriptions for screen readers
 */
export function getKeyboardShortcuts(): Record<string, string> {
  return {
    // Global shortcuts
    'Ctrl+Shift+N': 'Apri centro notifiche',
    'F2': 'Attiva/disattiva centro notifiche',
    'Ctrl+Alt+B': 'Vai alle notifiche (Bell)',
    
    // Navigation shortcuts (when notification center is open)
    'Escape': 'Chiudi centro notifiche o esci dalla modalità selezione',
    'Ctrl+A': 'Seleziona tutte le notifiche o marca tutte come lette',
    'Ctrl+F': 'Vai alla barra di ricerca',
    'Delete': 'Elimina notifica selezionata',
    'Ctrl+Delete': 'Elimina tutte le notifiche',
    'Enter': 'Attiva elemento selezionato o marca come letta',
    'Space': 'Seleziona/deseleziona notifica in modalità selezione',
    'ArrowUp': 'Naviga alla notifica precedente',
    'ArrowDown': 'Naviga alla notifica successiva',
    'Home': 'Vai alla prima notifica',
    'End': 'Vai all\'ultima notifica',
    'M': 'Marca notifica corrente come letta',
    'Tab': 'Naviga tra gli elementi dell\'interfaccia',
    'Shift+Tab': 'Naviga indietro tra gli elementi'
  };
}

/**
 * Creates help text for screen readers
 */
export function createHelpText(context: 'toast' | 'center' | 'indicator'): string {
  switch (context) {
    case 'toast':
      return 'Notifica toast. Premi Escape per chiudere o clicca il pulsante X. Le notifiche urgenti non si chiudono automaticamente.';
    case 'center':
      return 'Centro notifiche. Usa le frecce per navigare tra le notifiche, Enter per attivare, Space per selezionare. Premi Escape per chiudere, Ctrl+A per selezionare tutto, Ctrl+F per cercare, Delete per eliminare.';
    case 'indicator':
      return 'Indicatore notifiche. Clicca per aprire il centro notifiche. Scorciatoie globali: Ctrl+Shift+N o F2 per aprire il centro notifiche.';
    default:
      return 'Elemento notifica. Usa frecce per navigare, Enter per attivare, M per marcare come letta, Delete per eliminare.';
  }
}

/**
 * Manages focus for accessibility
 */
export class NotificationFocusManager {
  private static instance: NotificationFocusManager;
  private previousFocus: HTMLElement | null = null;
  
  static getInstance(): NotificationFocusManager {
    if (!NotificationFocusManager.instance) {
      NotificationFocusManager.instance = new NotificationFocusManager();
    }
    return NotificationFocusManager.instance;
  }
  
  /**
   * Saves current focus and moves to notification center
   */
  focusNotificationCenter(): void {
    this.previousFocus = document.activeElement as HTMLElement;
    
    // Focus on the notification center
    const notificationCenter = document.querySelector('[role="dialog"][aria-label="Centro notifiche"]') as HTMLElement;
    if (notificationCenter) {
      notificationCenter.focus();
    }
  }
  
  /**
   * Restores focus to previous element
   */
  restoreFocus(): void {
    if (this.previousFocus && document.body.contains(this.previousFocus)) {
      this.previousFocus.focus();
    }
    this.previousFocus = null;
  }
  
  /**
   * Focuses on first notification in list
   */
  focusFirstNotification(): void {
    const firstNotification = document.querySelector('[role="article"], [role="checkbox"]') as HTMLElement;
    if (firstNotification) {
      firstNotification.focus();
    }
  }
  
  /**
   * Focuses on search input
   */
  focusSearch(): void {
    const searchInput = document.getElementById('notification-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }
}

/**
 * Utility to check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Utility to check if user is using a screen reader
 */
export function isUsingScreenReader(): boolean {
  // Check for common screen reader indicators
  return !!(
    window.navigator.userAgent.match(/NVDA|JAWS|VoiceOver|TalkBack|Dragon/i) ||
    window.speechSynthesis ||
    document.querySelector('[aria-live]')
  );
}