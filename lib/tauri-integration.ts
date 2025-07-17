'use client';

import { invoke } from '@tauri-apps/api/core';

// Client-side clientLogger (console only)
const clientLogger = {
  info: (message: string, component?: string, metadata?: any) => {
    console.info(`[${component || 'TAURI'}] ${message}`, metadata);
  },
  warn: (message: string, component?: string, metadata?: any) => {
    console.warn(`[${component || 'TAURI'}] ${message}`, metadata);
  },
  error: (message: string, component?: string, metadata?: any) => {
    console.error(`[${component || 'TAURI'}] ${message}`, metadata);
  },
  debug: (message: string, component?: string, metadata?: any) => {
    console.debug(`[${component || 'TAURI'}] ${message}`, metadata);
  }
};

// Client-side secrets access
const getSecret = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`gs_secret_${key}`);
  }
  return null;
};

export interface TauriError {
  message: string;
  code?: string;
  details?: any;
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url?: string;
  img_logo_url?: string;
  has_community_visible_stats?: boolean;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  rtime_last_played?: number;
}

export interface GameLibraryEntry {
  id: string;
  name: string;
  provider: string;
  imageUrl?: string;
  installed: boolean;
  lastPlayed?: string;
  playtime?: number;
  installPath?: string;
  executablePath?: string;
}

export interface StoreConnectionStatus {
  connected: boolean;
  error?: string;
  gamesCount?: number;
  lastSync?: string;
}

export interface StoreCredentials {
  apiKey?: string;
  username?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export class TauriIntegration {
  private static instance: TauriIntegration;
  private isInitialized = false;
  private isTauriAvailable = false;

  private constructor() {}

  public static getInstance(): TauriIntegration {
    if (!TauriIntegration.instance) {
      TauriIntegration.instance = new TauriIntegration();
    }
    return TauriIntegration.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if we're in a Tauri environment
      if (typeof window !== 'undefined' && window.__TAURI__) {
        this.isTauriAvailable = true;
        clientLogger.info('Tauri environment detected', 'TAURI_INTEGRATION');
      } else {
        this.isTauriAvailable = false;
        clientLogger.warn('Tauri environment not available, using fallback mode', 'TAURI_INTEGRATION');
      }

      this.isInitialized = true;
      clientLogger.info('Tauri integration initialized', 'TAURI_INTEGRATION');
    } catch (error) {
      clientLogger.error('Failed to initialize Tauri integration', 'TAURI_INTEGRATION', { error });
      throw error;
    }
  }

  public isTauriEnvironment(): boolean {
    return this.isTauriAvailable;
  }

  private async invokeCommand<T>(command: string, args?: any): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isTauriAvailable) {
      throw new Error('Tauri environment not available');
    }

    try {
      clientLogger.debug(`Invoking Tauri command: ${command}`, 'TAURI_INTEGRATION', { args });
      const result = await invoke<T>(command, args);
      clientLogger.debug(`Tauri command completed: ${command}`, 'TAURI_INTEGRATION', { result });
      return result;
    } catch (error) {
      clientLogger.error(`Tauri command failed: ${command}`, 'TAURI_INTEGRATION', { error, args });
      throw error;
    }
  }

  // Steam Integration
  public async getSteamGames(): Promise<GameLibraryEntry[]> {
    try {
      if (!this.isTauriAvailable) {
        // Fallback to web API if available
        return await this.getSteamGamesFromWebAPI();
      }

      const steamGames = await this.invokeCommand<SteamGame[]>('get_steam_games');
      
      return steamGames.map(game => ({
        id: `steam_${game.appid}`,
        name: game.name,
        provider: 'Steam',
        imageUrl: game.img_icon_url 
          ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
          : undefined,
        installed: true, // Assume installed if in library
        lastPlayed: game.rtime_last_played 
          ? new Date(game.rtime_last_played * 1000).toISOString()
          : undefined,
        playtime: game.playtime_forever || 0
      }));
    } catch (error) {
      clientLogger.error('Failed to get Steam games', 'TAURI_INTEGRATION', { error });
      throw error;
    }
  }

  private async getSteamGamesFromWebAPI(): Promise<GameLibraryEntry[]> {
    try {
      const apiKey = getSecret('STEAM_API_KEY');
      if (!apiKey) {
        throw new Error('Steam API key not configured');
      }

      // This would require Steam ID - for now return empty array
      clientLogger.warn('Steam Web API integration not fully implemented', 'TAURI_INTEGRATION');
      return [];
    } catch (error) {
      clientLogger.error('Failed to get Steam games from Web API', 'TAURI_INTEGRATION', { error });
      throw error;
    }
  }

  public async testSteamConnection(): Promise<StoreConnectionStatus> {
    try {
      if (!this.isTauriAvailable) {
        return await this.testSteamConnectionWeb();
      }

      const result = await this.invokeCommand<{ success: boolean; games_count?: number; error?: string }>('test_steam_connection');
      
      return {
        connected: result.success,
        gamesCount: result.games_count,
        error: result.error,
        lastSync: new Date().toISOString()
      };
    } catch (error) {
      clientLogger.error('Failed to test Steam connection', 'TAURI_INTEGRATION', { error });
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testSteamConnectionWeb(): Promise<StoreConnectionStatus> {
    try {
      const apiKey = getSecret('STEAM_API_KEY');
      if (!apiKey) {
        return {
          connected: false,
          error: 'Steam API key not configured'
        };
      }

      // Test with a simple API call
      const response = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=76561197960435530`);
      
      if (!response.ok) {
        throw new Error(`Steam API error: ${response.status}`);
      }

      return {
        connected: true,
        lastSync: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Epic Games Integration
  public async getEpicGames(): Promise<GameLibraryEntry[]> {
    try {
      if (!this.isTauriAvailable) {
        throw new Error('Epic Games integration requires Tauri environment');
      }

      const epicGames = await this.invokeCommand<any[]>('get_epic_games');
      
      return epicGames.map(game => ({
        id: `epic_${game.app_name}`,
        name: game.display_name,
        provider: 'Epic Games',
        imageUrl: game.key_images?.find((img: any) => img.type === 'DieselStoreFrontWide')?.url,
        installed: game.is_installed || false,
        installPath: game.install_path
      }));
    } catch (error) {
      clientLogger.error('Failed to get Epic Games', 'TAURI_INTEGRATION', { error });
      throw error;
    }
  }

  public async testEpicConnection(): Promise<StoreConnectionStatus> {
    try {
      if (!this.isTauriAvailable) {
        return {
          connected: false,
          error: 'Epic Games integration requires Tauri environment'
        };
      }

      const result = await this.invokeCommand<{ success: boolean; games_count?: number; error?: string }>('test_epic_connection');
      
      return {
        connected: result.success,
        gamesCount: result.games_count,
        error: result.error,
        lastSync: new Date().toISOString()
      };
    } catch (error) {
      clientLogger.error('Failed to test Epic connection', 'TAURI_INTEGRATION', { error });
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generic store operations
  public async getGamesFromStore(storeId: string): Promise<GameLibraryEntry[]> {
    switch (storeId) {
      case 'steam':
        return await this.getSteamGames();
      case 'epic':
        return await this.getEpicGames();
      default:
        throw new Error(`Store ${storeId} not supported`);
    }
  }

  public async testStoreConnection(storeId: string): Promise<StoreConnectionStatus> {
    switch (storeId) {
      case 'steam':
        return await this.testSteamConnection();
      case 'epic':
        return await this.testEpicConnection();
      default:
        return {
          connected: false,
          error: `Store ${storeId} not supported`
        };
    }
  }

  public async getAllGames(): Promise<GameLibraryEntry[]> {
    const allGames: GameLibraryEntry[] = [];
    const stores = ['steam', 'epic'];

    for (const store of stores) {
      try {
        const games = await this.getGamesFromStore(store);
        allGames.push(...games);
      } catch (error) {
        clientLogger.warn(`Failed to get games from ${store}`, 'TAURI_INTEGRATION', { error });
      }
    }

    return allGames;
  }

  public async syncGameLibrary(): Promise<{
    success: boolean;
    gamesCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let totalGames = 0;

    try {
      const allGames = await this.getAllGames();
      totalGames = allGames.length;

      // Here you would typically save to database
      clientLogger.info(`Synced ${totalGames} games from all stores`, 'TAURI_INTEGRATION');

      return {
        success: true,
        gamesCount: totalGames,
        errors
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      clientLogger.error('Failed to sync game library', 'TAURI_INTEGRATION', { error });

      return {
        success: false,
        gamesCount: totalGames,
        errors
      };
    }
  }

  // System utilities
  public async getSystemInfo(): Promise<any> {
    if (!this.isTauriAvailable) {
      return {
        platform: 'web',
        version: '1.0.0'
      };
    }

    try {
      return await this.invokeCommand('get_system_info');
    } catch (error) {
      clientLogger.error('Failed to get system info', 'TAURI_INTEGRATION', { error });
      throw error;
    }
  }

  public async openGameDirectory(gamePath: string): Promise<void> {
    if (!this.isTauriAvailable) {
      throw new Error('Directory operations require Tauri environment');
    }

    try {
      await this.invokeCommand('open_directory', { path: gamePath });
    } catch (error) {
      clientLogger.error('Failed to open game directory', 'TAURI_INTEGRATION', { error, gamePath });
      throw error;
    }
  }

  public async launchGame(gameId: string): Promise<void> {
    if (!this.isTauriAvailable) {
      throw new Error('Game launching requires Tauri environment');
    }

    try {
      await this.invokeCommand('launch_game', { game_id: gameId });
    } catch (error) {
      clientLogger.error('Failed to launch game', 'TAURI_INTEGRATION', { error, gameId });
      throw error;
    }
  }
}

// Export singleton instance
export const tauriIntegration = TauriIntegration.getInstance();

// Utility functions
export async function initializeTauriIntegration(): Promise<void> {
  await tauriIntegration.initialize();
}

export function isTauriEnvironment(): boolean {
  return tauriIntegration.isTauriEnvironment();
}

export async function getGameLibrary(): Promise<GameLibraryEntry[]> {
  return await tauriIntegration.getAllGames();
}

export async function testStoreConnection(storeId: string): Promise<StoreConnectionStatus> {
  return await tauriIntegration.testStoreConnection(storeId);
}