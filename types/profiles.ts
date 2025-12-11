// Tipi TypeScript per il sistema di profili utente

export interface UserProfile {
  id: string;
  name: string;
  avatar_path?: string;
  created_at: string;
  last_accessed: string;
  settings: ProfileSettings;
  credentials: Record<string, EncryptedCredential>;
  metadata: ProfileMetadata;
}

export interface ProfileInfo {
  id: string;
  name: string;
  avatar_path?: string;
  created_at: string;
  last_accessed: string;
  is_locked: boolean;
  failed_attempts: number;
}

export interface CreateProfileRequest {
  name: string;
  password: string;
  avatar_path?: string;
  settings?: ProfileSettings;
}

export interface ProfileSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  auto_login: boolean;
  notifications: NotificationSettings;
  game_library: LibrarySettings;
  security: SecuritySettings;
}

export interface NotificationSettings {
  desktop_enabled: boolean;
  sound_enabled: boolean;
  new_games: boolean;
  updates: boolean;
  deals: boolean;
}

export interface LibrarySettings {
  default_view: 'grid' | 'list';
  default_sort: 'alphabetical' | 'last_played' | 'recently_added' | 'platform';
  show_hidden: boolean;
  auto_refresh: boolean;
  refresh_interval: number;
}

export interface SecuritySettings {
  session_timeout: number;
  require_password_for_sensitive: boolean;
  auto_lock_failed_attempts: number;
  lock_duration: number;
}

export interface EncryptedCredential {
  store: string;
  encrypted_data: string;
  nonce: string;
  salt: string;
  created_at: string;
  updated_at: string;
  encryption_version: number;
}

export interface ProfileMetadata {
  version: number;
  data_size: number;
  integrity_hash: string;
  access_count: number;
  usage_stats: UsageStats;
}

export interface UsageStats {
  total_usage_time: number;
  games_added: number;
  stores_connected: number;
  last_backup?: string;
}

export interface GlobalSettings {
  last_profile?: string;
  auto_start_last_profile: boolean;
  window_position?: WindowPosition;
  window_size?: WindowSize;
  debug_mode: boolean;
  custom_log_path?: string;
}

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface AuthStats {
  total_profiles: number;
  locked_profiles: number;
  profiles_with_failed_attempts: number;
  total_failed_attempts: number;
  last_successful_login?: string;
  last_failed_login?: string;
}

export interface ProfileResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Tipi per le API Tauri
export interface TauriProfileAPI {
  // Gestione profili
  list_profiles(): Promise<ProfileResponse<ProfileInfo[]>>;
  create_profile(request: CreateProfileRequest): Promise<ProfileResponse<UserProfile>>;
  authenticate_profile(name: string, password: string): Promise<ProfileResponse<UserProfile>>;
  switch_profile(name: string, password: string): Promise<ProfileResponse<UserProfile>>;
  get_current_profile(): Promise<ProfileResponse<UserProfile | null>>;
  logout(): Promise<ProfileResponse<boolean>>;
  
  // Gestione settings
  load_profile_settings(profile_id: string): Promise<ProfileResponse<ProfileSettings>>;
  save_profile_settings(profile_id: string, settings: ProfileSettings): Promise<ProfileResponse<boolean>>;
  get_current_profile_settings(): Promise<ProfileResponse<ProfileSettings | null>>;
  save_current_profile_settings(settings: ProfileSettings): Promise<ProfileResponse<boolean>>;
  
  // Settings globali
  load_global_settings(): Promise<ProfileResponse<GlobalSettings>>;
  save_global_settings(settings: GlobalSettings): Promise<ProfileResponse<boolean>>;
  
  // Sicurezza e autenticazione
  can_authenticate(name: string): Promise<ProfileResponse<boolean>>;
  unlock_profile(name: string): Promise<ProfileResponse<boolean>>;
  get_failed_attempts(name: string): Promise<ProfileResponse<number>>;
  get_auth_stats(): Promise<ProfileResponse<AuthStats>>;
  
  // Sessione
  is_session_expired(timeout_seconds: number): Promise<ProfileResponse<boolean>>;
  renew_session(): Promise<ProfileResponse<boolean>>;
  get_session_time_remaining(timeout_seconds: number): Promise<ProfileResponse<number | null>>;
  
  // Import/Export
  export_profile(profile_id: string, password: string, export_path: string, export_password?: string): Promise<ProfileResponse<string>>;
  import_profile(file_path: string, import_password: string, new_name?: string): Promise<ProfileResponse<UserProfile>>;
  validate_export_file(file_path: string): Promise<ProfileResponse<any>>;
  create_profile_backup(profile_id: string, password: string): Promise<ProfileResponse<string>>;
}

// Hook personalizzati
export interface UseProfilesReturn {
  profiles: ProfileInfo[];
  currentProfile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createProfile: (request: CreateProfileRequest) => Promise<boolean>;
  authenticateProfile: (name: string, password: string) => Promise<boolean>;
  switchProfile: (name: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  refreshProfiles: () => Promise<void>;
  deleteProfile: (profileId: string, password: string) => Promise<boolean>;
  getProfileAvatar: (profileId: string) => Promise<string | null>;
}

export interface UseProfileSettingsReturn {
  settings: ProfileSettings | null;
  globalSettings: GlobalSettings;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updateSettings: (settings: Partial<ProfileSettings>) => Promise<boolean>;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => Promise<boolean>;
  resetToDefaults: () => Promise<boolean>;
}

// Costanti
export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  theme: 'auto',
  language: 'it',
  auto_login: false,
  notifications: {
    desktop_enabled: true,
    sound_enabled: true,
    new_games: true,
    updates: true,
    deals: false,
  },
  game_library: {
    default_view: 'grid',
    default_sort: 'alphabetical',
    show_hidden: false,
    auto_refresh: true,
    refresh_interval: 30,
  },
  security: {
    session_timeout: 60,
    require_password_for_sensitive: true,
    auto_lock_failed_attempts: 3,
    lock_duration: 15,
  },
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  auto_start_last_profile: false,
  debug_mode: false,
};

// Utility types
export type ProfileTheme = ProfileSettings['theme'];
export type LibraryView = LibrarySettings['default_view'];
export type LibrarySort = LibrarySettings['default_sort'];