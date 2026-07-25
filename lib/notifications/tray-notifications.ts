/**
 * 🔔 Tray Notifications Bridge
 * 
 * Collega gli eventi dell'app (chat, traduzioni, errori, news, presenza)
 * alle notifiche native del sistema operativo via Tauri e aggiorna
 * il tooltip del tray icon.
 * 
 * Tipi di notifica supportati:
 * - 💬 Messaggi chat (quando l'app non è in focus)
 * - ✅ Traduzioni completate (background + normale)
 * - ❌ Errori traduzione / sistema
 * - 📰 News / aggiornamenti app
 * - 🟢 Utenti online (amici che si connettono)
 * - 🔄 Aggiornamenti gioco rilevati
 */

import { clientLogger } from '@/lib/client-logger';

// ============================================================================
// TYPES
// ============================================================================

export type TrayNotificationType =
  | 'chat_message'
  | 'translation_completed'
  | 'translation_failed'
  | 'translation_paused'
  | 'system_error'
  | 'app_update'
  | 'game_update'
  | 'friend_online'
  | 'news';

export interface TrayNotification {
  type: TrayNotificationType;
  title: string;
  body: string;
  icon?: string;
  actionUrl?: string;  // navigate to this URL when clicked
  silent?: boolean;    // don't show OS notification, just update tray
}

export interface NotificationPreferences {
  enabled: boolean;
  chatMessages: boolean;
  translationCompleted: boolean;
  translationFailed: boolean;
  systemErrors: boolean;
  appUpdates: boolean;
  gameUpdates: boolean;
  friendOnline: boolean;
  news: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:MM
  quietHoursEnd: string;   // HH:MM
}

// ============================================================================
// DEFAULTS
// ============================================================================

const STORAGE_KEY_PREFS = 'gs_tray_notification_prefs';

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  chatMessages: true,
  translationCompleted: true,
  translationFailed: true,
  systemErrors: true,
  appUpdates: true,
  gameUpdates: true,
  friendOnline: false,
  news: true,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
};

// ============================================================================
// STATE
// ============================================================================

let _prefs: NotificationPreferences = DEFAULT_PREFS;
let _unreadCounts: Record<TrayNotificationType, number> = {
  chat_message: 0,
  translation_completed: 0,
  translation_failed: 0,
  translation_paused: 0,
  system_error: 0,
  app_update: 0,
  game_update: 0,
  friend_online: 0,
  news: 0,
};
let _totalUnread = 0;
let _activeTranslations = 0; // job di traduzione attualmente in corso (badge tray)
let _isWindowFocused = true;
const _listeners: Set<(counts: Record<TrayNotificationType, number>, total: number) => void> = new Set();

// ============================================================================
// PREFERENCES
// ============================================================================

export function getNotificationPrefs(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (raw) {
      _prefs = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    }
  } catch { /* ignore */ }
  return _prefs;
}

export function saveNotificationPrefs(prefs: Partial<NotificationPreferences>): void {
  _prefs = { ..._prefs, ...prefs };
  try {
    localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(_prefs));
  } catch { /* ignore */ }
}

function isTypeEnabled(type: TrayNotificationType): boolean {
  if (!_prefs.enabled) return false;
  
  // Critical notifications bypass quiet hours
  const isCritical = type === 'system_error' || type === 'app_update' || type === 'translation_failed';
  if (isQuietHours() && !isCritical) return false;
  
  switch (type) {
    case 'chat_message': return _prefs.chatMessages;
    case 'translation_completed': return _prefs.translationCompleted;
    case 'translation_failed': return _prefs.translationFailed;
    case 'translation_paused': return _prefs.translationCompleted;
    case 'system_error': return _prefs.systemErrors;
    case 'app_update': return _prefs.appUpdates;
    case 'game_update': return _prefs.gameUpdates;
    case 'friend_online': return _prefs.friendOnline;
    case 'news': return _prefs.news;
    default: return true;
  }
}

function isQuietHours(): boolean {
  if (!_prefs.quietHoursEnabled) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startH, startM] = _prefs.quietHoursStart.split(':').map(Number);
  const [endH, endM] = _prefs.quietHoursEnd.split(':').map(Number);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes <= endMinutes) {
    // Same day range (e.g., 08:00 - 22:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 23:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

// ============================================================================
// TAURI INVOKE
// ============================================================================

async function invokeTauri(command: string, args: Record<string, unknown>): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke(command, args);
  } catch (err) {
    // Not in Tauri or command not available — silent
    clientLogger.debug(`[TrayNotif] Tauri invoke failed: ${command}: ${String(err)}`);
  }
}

// ============================================================================
// CORE API
// ============================================================================

/**
 * Invia una notifica al system tray e/o come notifica OS nativa
 */
export async function sendTrayNotification(notification: TrayNotification): Promise<void> {
  const typeEnabled = isTypeEnabled(notification.type);
  
  // Always update unread count
  _unreadCounts[notification.type] = (_unreadCounts[notification.type] || 0) + 1;
  _totalUnread++;
  notifyCountListeners();
  
  // Update tray tooltip
  await updateTrayTooltip();
  
  // If silent or type disabled, don't show OS notification
  if (notification.silent || !typeEnabled) return;
  
  // Don't show OS notification if window is focused (except for errors and updates)
  const skipWhenFocused = notification.type !== 'system_error' && 
                          notification.type !== 'app_update' && 
                          notification.type !== 'translation_failed';
  if (_isWindowFocused && skipWhenFocused) return;
  
  // Send native OS notification
  await invokeTauri('send_native_notification', {
    title: notification.title,
    body: notification.body,
    icon: notification.icon || null,
  });
}

/**
 * Aggiorna il tooltip del tray icon con i conteggi correnti
 */
/** Aggiorna il numero di traduzioni in corso (badge/tooltip tray) */
export async function setActiveTranslations(n: number): Promise<void> {
  _activeTranslations = Math.max(0, n);
  notifyCountListeners();
  await updateTrayTooltip();
}
export async function incrementActiveTranslations(): Promise<void> {
  await setActiveTranslations(_activeTranslations + 1);
}
export async function decrementActiveTranslations(): Promise<void> {
  await setActiveTranslations(_activeTranslations - 1);
}
export function getActiveTranslations(): number {
  return _activeTranslations;
}

export async function updateTrayTooltip(): Promise<void> {
  const parts: string[] = ['GameStringer'];

  if (_activeTranslations > 0) {
    parts.push(`🔄 ${_activeTranslations} traduzion${_activeTranslations === 1 ? 'e' : 'i'} in corso`);
  }

  if (_totalUnread > 0) {
    parts.push(`— ${_totalUnread} notific${_totalUnread === 1 ? 'a' : 'he'}`);
  }
  
  const chatUnread = _unreadCounts.chat_message || 0;
  if (chatUnread > 0) {
    parts.push(`💬 ${chatUnread} msg`);
  }
  
  const transUnread = _unreadCounts.translation_completed + _unreadCounts.translation_failed;
  if (transUnread > 0) {
    parts.push(`✅ ${transUnread} trad.`);
  }
  
  const tooltip = parts.join(' ');
  await invokeTauri('update_tray_tooltip', { tooltip });
}

/**
 * Resetta i conteggi notifica per un tipo specifico (o tutti)
 */
export async function clearTrayNotifications(type?: TrayNotificationType): Promise<void> {
  if (type) {
    _totalUnread -= _unreadCounts[type];
    _unreadCounts[type] = 0;
  } else {
    _unreadCounts = {
      chat_message: 0, translation_completed: 0, translation_failed: 0,
      translation_paused: 0, system_error: 0, app_update: 0,
      game_update: 0, friend_online: 0, news: 0,
    };
    _totalUnread = 0;
  }
  notifyCountListeners();
  await updateTrayTooltip();
}

/**
 * Ottieni i conteggi correnti
 */
export function getUnreadCounts(): { counts: Record<TrayNotificationType, number>; total: number } {
  return { counts: { ..._unreadCounts }, total: _totalUnread };
}

/**
 * Iscriviti agli aggiornamenti dei conteggi
 */
export function onUnreadCountUpdate(
  listener: (counts: Record<TrayNotificationType, number>, total: number) => void
): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/** Notifica traduzione completata */
export async function notifyTranslationCompleted(gameName: string, stringCount: number): Promise<void> {
  await sendTrayNotification({
    type: 'translation_completed',
    title: '✅ Traduzione completata',
    body: `${gameName}: ${stringCount} stringhe tradotte`,
    actionUrl: '/auto-translate',
  });
}

/** Notifica traduzione fallita */
export async function notifyTranslationFailed(gameName: string, error: string): Promise<void> {
  await sendTrayNotification({
    type: 'translation_failed',
    title: '❌ Errore traduzione',
    body: `${gameName}: ${error}`,
    actionUrl: '/auto-translate',
  });
}

/** Notifica traduzione in pausa */
export async function notifyTranslationPaused(gameName: string, progress: number): Promise<void> {
  await sendTrayNotification({
    type: 'translation_paused',
    title: '⏸️ Traduzione in pausa',
    body: `${gameName}: ${progress}% completato`,
    actionUrl: '/auto-translate',
    silent: true, // don't spam OS notification for pause
  });
}

/** Notifica errore di sistema */
export async function notifySystemError(component: string, error: string): Promise<void> {
  await sendTrayNotification({
    type: 'system_error',
    title: '❌ Errore di sistema',
    body: `${component}: ${error}`,
  });
}

/** Notifica aggiornamento app disponibile */
export async function notifyAppUpdate(version: string): Promise<void> {
  await sendTrayNotification({
    type: 'app_update',
    title: '🔄 Aggiornamento disponibile',
    body: `GameStringer v${version} è disponibile`,
    actionUrl: '/settings',
  });
}

/** Notifica aggiornamento gioco rilevato */
export async function notifyGameUpdate(gameName: string): Promise<void> {
  await sendTrayNotification({
    type: 'game_update',
    title: '🎮 Aggiornamento gioco',
    body: `${gameName} è stato aggiornato — verifica patch traduzione`,
    actionUrl: '/library',
  });
}

/** Notifica amico online */
export async function notifyFriendOnline(username: string): Promise<void> {
  await sendTrayNotification({
    type: 'friend_online',
    title: '🟢 Amico online',
    body: `${username} è ora online`,
    actionUrl: '/community-hub',
  });
}

/** Notifica news */
export async function notifyNews(title: string, source: string): Promise<void> {
  await sendTrayNotification({
    type: 'news',
    title: '📰 Novità',
    body: `${title} — ${source}`,
  });
}

// ============================================================================
// WINDOW FOCUS TRACKING
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => { _isWindowFocused = true; });
  window.addEventListener('blur', () => { _isWindowFocused = false; });
}

// ============================================================================
// INTERNAL
// ============================================================================

function notifyCountListeners(): void {
  const counts = { ..._unreadCounts };
  const total = _totalUnread;
  for (const listener of _listeners) {
    try { listener(counts, total); } catch { /* ignore */ }
  }
  
  // Also dispatch window event for cross-component reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gs-tray-unread-update', { 
      detail: { counts, total } 
    }));
  }
}

// ============================================================================
// AUTO-LISTEN TO APP EVENTS
// ============================================================================

if (typeof window !== 'undefined') {
  // Load preferences on init
  getNotificationPrefs();
  
  // Background translation events (from BackgroundTranslationManager)
  window.addEventListener('bg-translation-event', ((e: CustomEvent) => {
    const { type, job } = e.detail || {};
    if (!job) return;
    if (type === 'job_completed') {
      notifyTranslationCompleted(job.gameName || 'Gioco', job.translatedCount || 0);
    } else if (type === 'job_failed') {
      notifyTranslationFailed(job.gameName || 'Gioco', job.errors?.[0] || 'Errore sconosciuto');
    }
  }) as EventListener);
  
  // Presence events (friend online)
  window.addEventListener('gs-presence-update', ((_e: CustomEvent) => {
    // Only notify for new users, not every sync — handled by the presence module
    // This is a lightweight hook; the presence module itself tracks joins/leaves
  }) as EventListener);
}

