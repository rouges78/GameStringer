// Tipi TypeScript per il sistema di notifiche

export interface Notification {
  id: string;
  profileId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  actionUrl?: string;
  priority: NotificationPriority;
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
  metadata: NotificationMetadata;
}

export enum NotificationType {
  SYSTEM = 'System',
  PROFILE = 'Profile',
  SECURITY = 'Security',
  UPDATE = 'Update',
  GAME = 'Game',
  STORE = 'Store',
  CUSTOM = 'Custom'
}

export enum NotificationPriority {
  LOW = 'Low',
  NORMAL = 'Normal',
  HIGH = 'High',
  URGENT = 'Urgent'
}

export interface NotificationMetadata {
  source: string;
  category: string;
  tags: string[];
  customData?: Record<string, any>;
}

export interface CreateNotificationRequest {
  profileId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  expiresAt?: string;
  metadata?: NotificationMetadata;
}

export interface NotificationFilter {
  type?: NotificationType;
  priority?: NotificationPriority;
  unreadOnly?: boolean;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationPreferences {
  profileId: string;
  globalEnabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  typeSettings: Record<NotificationType, TypePreference>;
  quietHours?: QuietHoursSettings;
  maxNotifications: number;
  autoDeleteAfterDays: number;
  updatedAt: string;
}

export interface TypePreference {
  enabled: boolean;
  priority: NotificationPriority;
  showToast: boolean;
  playSound: boolean;
  persistInCenter: boolean;
}

export interface QuietHoursSettings {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  allowUrgent: boolean;
}

export interface NotificationResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Tipi per le API Tauri
export interface TauriNotificationAPI {
  // Gestione notifiche
  create_notification(request: CreateNotificationRequest): Promise<NotificationResponse<Notification>>;
  get_notifications(profileId: string, filter: NotificationFilter): Promise<NotificationResponse<Notification[]>>;
  mark_notification_as_read(notificationId: string, profileId: string): Promise<NotificationResponse<boolean>>;
  delete_notification(notificationId: string, profileId: string): Promise<NotificationResponse<boolean>>;
  get_unread_count(profileId: string): Promise<NotificationResponse<number>>;
  clear_all_notifications(profileId: string): Promise<NotificationResponse<number>>;
  
  // Gestione preferenze
  get_notification_preferences(profileId: string): Promise<NotificationResponse<NotificationPreferences>>;
  update_notification_preferences(preferences: NotificationPreferences): Promise<NotificationResponse<boolean>>;
  
  // Utilità
  cleanup_expired_notifications(): Promise<NotificationResponse<number>>;
}

// Hook personalizzati
export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createNotification: (request: CreateNotificationRequest) => Promise<boolean>;
  markAsRead: (notificationId: string) => Promise<boolean>;
  deleteNotification: (notificationId: string) => Promise<boolean>;
  clearAllNotifications: () => Promise<boolean>;
  refreshNotifications: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
}

export interface UseNotificationPreferencesReturn {
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<boolean>;
  resetToDefaults: () => Promise<boolean>;
  toggleNotificationType: (type: NotificationType, enabled: boolean) => Promise<boolean>;
  updateQuietHours: (quietHours: QuietHoursSettings) => Promise<boolean>;
}

// Costanti
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'profileId' | 'updatedAt'> = {
  globalEnabled: true,
  soundEnabled: true,
  desktopEnabled: true,
  typeSettings: {
    [NotificationType.SYSTEM]: {
      enabled: true,
      priority: NotificationPriority.NORMAL,
      showToast: true,
      playSound: true,
      persistInCenter: true,
    },
    [NotificationType.PROFILE]: {
      enabled: true,
      priority: NotificationPriority.NORMAL,
      showToast: true,
      playSound: false,
      persistInCenter: true,
    },
    [NotificationType.SECURITY]: {
      enabled: true,
      priority: NotificationPriority.HIGH,
      showToast: true,
      playSound: true,
      persistInCenter: true,
    },
    [NotificationType.UPDATE]: {
      enabled: true,
      priority: NotificationPriority.NORMAL,
      showToast: true,
      playSound: false,
      persistInCenter: true,
    },
    [NotificationType.GAME]: {
      enabled: true,
      priority: NotificationPriority.LOW,
      showToast: false,
      playSound: false,
      persistInCenter: true,
    },
    [NotificationType.STORE]: {
      enabled: true,
      priority: NotificationPriority.LOW,
      showToast: false,
      playSound: false,
      persistInCenter: true,
    },
    [NotificationType.CUSTOM]: {
      enabled: true,
      priority: NotificationPriority.NORMAL,
      showToast: true,
      playSound: false,
      persistInCenter: true,
    },
  },
  maxNotifications: 50,
  autoDeleteAfterDays: 30,
};

// Utility types
export type NotificationTypeKey = keyof typeof NotificationType;
export type NotificationPriorityKey = keyof typeof NotificationPriority;

// Utility functions
export const getNotificationTypeColor = (type: NotificationType): string => {
  switch (type) {
    case NotificationType.SYSTEM:
      return 'blue';
    case NotificationType.PROFILE:
      return 'green';
    case NotificationType.SECURITY:
      return 'red';
    case NotificationType.UPDATE:
      return 'purple';
    case NotificationType.GAME:
      return 'orange';
    case NotificationType.STORE:
      return 'cyan';
    case NotificationType.CUSTOM:
      return 'gray';
    default:
      return 'gray';
  }
};

export const getNotificationPriorityIcon = (priority: NotificationPriority): string => {
  switch (priority) {
    case NotificationPriority.LOW:
      return '🔵';
    case NotificationPriority.NORMAL:
      return '🟡';
    case NotificationPriority.HIGH:
      return '🟠';
    case NotificationPriority.URGENT:
      return '🔴';
    default:
      return '🟡';
  }
};

export const formatNotificationTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'Ora';
  } else if (diffMins < 60) {
    return `${diffMins} min fa`;
  } else if (diffHours < 24) {
    return `${diffHours} ore fa`;
  } else if (diffDays < 7) {
    return `${diffDays} giorni fa`;
  } else {
    return date.toLocaleDateString('it-IT');
  }
};

export const isNotificationExpired = (notification: Notification): boolean => {
  if (!notification.expiresAt) return false;
  return new Date(notification.expiresAt) < new Date();
};

export const shouldShowNotification = (
  notification: Notification,
  preferences: NotificationPreferences
): boolean => {
  if (!preferences.globalEnabled) return false;
  
  const typePreference = preferences.typeSettings[notification.type];
  if (!typePreference?.enabled) return false;
  
  // Controlla le ore di silenzio
  if (preferences.quietHours?.enabled) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { startTime, endTime, allowUrgent } = preferences.quietHours;
    
    const isInQuietHours = (currentTime >= startTime && currentTime <= endTime) ||
                          (startTime > endTime && (currentTime >= startTime || currentTime <= endTime));
    
    if (isInQuietHours && !(allowUrgent && notification.priority === NotificationPriority.URGENT)) {
      return false;
    }
  }
  
  return true;
};