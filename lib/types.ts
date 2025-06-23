export interface GameScanResult {
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
