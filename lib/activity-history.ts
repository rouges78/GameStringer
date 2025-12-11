/**
 * GameStringer Activity History Client
 * 
 * Client TypeScript per lo storico attività.
 * Traccia traduzioni, patch, sincronizzazioni e altre azioni utente.
 */

import { invoke } from '@/lib/tauri-api';

// Tipi di attività
export type ActivityType = 
  | 'translation'
  | 'patch'
  | 'steam_sync'
  | 'game_added'
  | 'game_launched'
  | 'profile_created'
  | 'settings_changed'
  | 'import_export'
  | 'translation_bridge'
  | 'other';

// Singola attività
export interface Activity {
  id: string;
  activity_type: ActivityType;
  title: string;
  description?: string;
  game_name?: string;
  game_id?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Pagina di attività
export interface ActivityPage {
  activities: Activity[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// Risposta standard
interface ActivityResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// Filtri
export interface ActivityFilter {
  activity_type?: ActivityType;
  game_id?: string;
  limit?: number;
  offset?: number;
}

// Icone per tipo
export const activityIcons: Record<ActivityType, string> = {
  translation: '🌐',
  patch: '🔧',
  steam_sync: '♻️',
  game_added: '➕',
  game_launched: '🎮',
  profile_created: '👤',
  settings_changed: '⚙️',
  import_export: '📦',
  translation_bridge: '🌉',
  other: '📝',
};

// Colori per tipo
export const activityColors: Record<ActivityType, string> = {
  translation: 'purple',
  patch: 'orange',
  steam_sync: 'green',
  game_added: 'blue',
  game_launched: 'cyan',
  profile_created: 'pink',
  settings_changed: 'gray',
  import_export: 'yellow',
  translation_bridge: 'indigo',
  other: 'slate',
};

// Nomi italiani per tipo
export const activityNames: Record<ActivityType, string> = {
  translation: 'Traduzione',
  patch: 'Patch',
  steam_sync: 'Sincronizzazione Steam',
  game_added: 'Gioco Aggiunto',
  game_launched: 'Gioco Avviato',
  profile_created: 'Profilo Creato',
  settings_changed: 'Impostazioni',
  import_export: 'Import/Export',
  translation_bridge: 'Translation Bridge',
  other: 'Altro',
};

/**
 * Activity History Client
 */
export class ActivityHistoryClient {
  /**
   * Aggiungi una nuova attività
   */
  async add(params: {
    activity_type: ActivityType;
    title: string;
    description?: string;
    game_name?: string;
    game_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Activity | null> {
    try {
      const response = await invoke<ActivityResponse<Activity>>('activity_add', {
        params,
      });
      return response.data;
    } catch (error) {
      console.error('[ActivityHistory] Failed to add activity:', error);
      return null;
    }
  }

  /**
   * Ottieni attività con filtri e paginazione
   */
  async get(filter: ActivityFilter = {}): Promise<ActivityPage | null> {
    try {
      const response = await invoke<ActivityResponse<ActivityPage>>('activity_get', {
        params: filter,
      });
      return response.data;
    } catch (error) {
      console.error('[ActivityHistory] Failed to get activities:', error);
      return null;
    }
  }

  /**
   * Ottieni le ultime N attività
   */
  async getRecent(limit: number = 10): Promise<Activity[]> {
    try {
      const response = await invoke<ActivityResponse<Activity[]>>('activity_get_recent', {
        limit,
      });
      return response.data ?? [];
    } catch (error) {
      console.error('[ActivityHistory] Failed to get recent activities:', error);
      return [];
    }
  }

  /**
   * Conta attività per tipo
   */
  async countByType(): Promise<Record<string, number>> {
    try {
      const response = await invoke<ActivityResponse<Record<string, number>>>('activity_count_by_type');
      return response.data ?? {};
    } catch (error) {
      console.error('[ActivityHistory] Failed to count activities:', error);
      return {};
    }
  }

  /**
   * Elimina una singola attività
   */
  async delete(id: string): Promise<boolean> {
    try {
      const response = await invoke<ActivityResponse<boolean>>('activity_delete', {
        id,
      });
      return response.data ?? false;
    } catch (error) {
      console.error('[ActivityHistory] Failed to delete activity:', error);
      return false;
    }
  }

  /**
   * Cancella tutto lo storico
   */
  async clear(): Promise<boolean> {
    try {
      const response = await invoke<ActivityResponse<string>>('activity_clear');
      return response.success;
    } catch (error) {
      console.error('[ActivityHistory] Failed to clear activities:', error);
      return false;
    }
  }

  // === Helper per tracciare attività comuni ===

  /**
   * Traccia una traduzione completata
   */
  async trackTranslation(gameName: string, gameId?: string, details?: string): Promise<void> {
    await this.add({
      activity_type: 'translation',
      title: `Traduzione completata: ${gameName}`,
      description: details,
      game_name: gameName,
      game_id: gameId,
    });
  }

  /**
   * Traccia una patch creata
   */
  async trackPatch(gameName: string, gameId?: string, patchName?: string): Promise<void> {
    await this.add({
      activity_type: 'patch',
      title: `Patch creata: ${gameName}`,
      description: patchName,
      game_name: gameName,
      game_id: gameId,
    });
  }

  /**
   * Traccia sincronizzazione Steam
   */
  async trackSteamSync(gamesCount: number): Promise<void> {
    await this.add({
      activity_type: 'steam_sync',
      title: `Sincronizzazione Steam completata`,
      description: `${gamesCount} giochi sincronizzati`,
      metadata: { games_count: gamesCount },
    });
  }

  /**
   * Traccia avvio gioco
   */
  async trackGameLaunch(gameName: string, gameId?: string): Promise<void> {
    await this.add({
      activity_type: 'game_launched',
      title: `Gioco avviato: ${gameName}`,
      game_name: gameName,
      game_id: gameId,
    });
  }

  /**
   * Formatta timestamp relativo
   */
  formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Adesso';
    if (minutes < 60) return `${minutes} min fa`;
    if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
    if (days < 7) return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
    
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

// Singleton instance
export const activityHistory = new ActivityHistoryClient();
