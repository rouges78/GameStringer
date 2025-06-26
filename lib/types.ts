export interface GameScanResult {
  steamAppId?: number; // Aggiunto per i giochi Steam
  id: string;
  title: string;
  platform: string;
  installPath: string;
  executablePath?: string; // Percorso dell'eseguibile principale
  icon?: string; // Icona in formato Base64
  imageUrl?: string; // URL della copertina
  isInstalled: boolean;
  createdAt: string; // o Date
}

export interface TranslationPreview {
  original: string;
  translated: string;
  confidence: number;
  suggestions: string[];
}

export interface PatchExportOptions {
  format: 'exe' | 'zip' | 'installer';
  includeBackup: boolean;
  compression: boolean;
  digitallySigned: boolean;
}

export interface StoreConnectionStatus {
  platform: string;
  isConnected: boolean;
  username?: string;
  gamesCount: number;
  lastSync?: Date;
}

export interface AITranslationConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface RealTimeTranslationState {
  isActive: boolean;
  gameProcess?: string;
  translationsApplied: number;
  memoryPatchCount: number;
  injectionStatus: 'idle' | 'hooking' | 'active' | 'error';
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  img_logo_url: string;
  last_played: number;
  is_installed: boolean;
  is_shared: boolean;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  genres?: { id: string; description: string }[];
  tags?: string[];
  is_free?: boolean;
  short_description?: string;
  header_image?: string;
  library_capsule?: string;
  categories?: { id: number; description: string }[];
  isVr: boolean;
  engine?: string;
}
