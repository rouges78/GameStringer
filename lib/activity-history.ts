/**
 * GameStringer Activity History Client
 * 
 * Client TypeScript per lo storico attività.
 * Traccia traduzioni, patch, sincronizzazioni e altre azioni utente.
 */

import { invoke } from '@/lib/tauri-api';
import { clientLogger } from '@/lib/client-logger';

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

// Localized activity type names
const activityNamesI18n: Record<string, Record<ActivityType, string>> = {
  it: { translation: 'Traduzione', patch: 'Patch', steam_sync: 'Sincronizzazione Steam', game_added: 'Gioco Aggiunto', game_launched: 'Gioco Avviato', profile_created: 'Profilo Creato', settings_changed: 'Impostazioni', import_export: 'Import/Export', translation_bridge: 'Translation Bridge', other: 'Altro' },
  en: { translation: 'Translation', patch: 'Patch', steam_sync: 'Steam Sync', game_added: 'Game Added', game_launched: 'Game Launched', profile_created: 'Profile Created', settings_changed: 'Settings', import_export: 'Import/Export', translation_bridge: 'Translation Bridge', other: 'Other' },
  es: { translation: 'Traduccion', patch: 'Parche', steam_sync: 'Sincronizacion Steam', game_added: 'Juego Agregado', game_launched: 'Juego Iniciado', profile_created: 'Perfil Creado', settings_changed: 'Ajustes', import_export: 'Import/Export', translation_bridge: 'Translation Bridge', other: 'Otro' },
  fr: { translation: 'Traduction', patch: 'Patch', steam_sync: 'Synchronisation Steam', game_added: 'Jeu Ajoute', game_launched: 'Jeu Lance', profile_created: 'Profil Cree', settings_changed: 'Parametres', import_export: 'Import/Export', translation_bridge: 'Translation Bridge', other: 'Autre' },
  de: { translation: 'Ubersetzung', patch: 'Patch', steam_sync: 'Steam-Synchronisierung', game_added: 'Spiel Hinzugefugt', game_launched: 'Spiel Gestartet', profile_created: 'Profil Erstellt', settings_changed: 'Einstellungen', import_export: 'Import/Export', translation_bridge: 'Translation Bridge', other: 'Sonstiges' },
  ja: { translation: '翻訳', patch: 'パッチ', steam_sync: 'Steam同期', game_added: 'ゲーム追加', game_launched: 'ゲーム起動', profile_created: 'プロファイル作成', settings_changed: '設定', import_export: 'インポート/エクスポート', translation_bridge: 'Translation Bridge', other: 'その他' },
  zh: { translation: '翻译', patch: '补丁', steam_sync: 'Steam同步', game_added: '游戏添加', game_launched: '游戏启动', profile_created: '配置文件创建', settings_changed: '设置', import_export: '导入/导出', translation_bridge: 'Translation Bridge', other: '其他' },
  ko: { translation: '번역', patch: '패치', steam_sync: 'Steam 동기화', game_added: '게임 추가', game_launched: '게임 실행', profile_created: '프로필 생성', settings_changed: '설정', import_export: '가져오기/내보내기', translation_bridge: 'Translation Bridge', other: '기타' },
  pt: { translation: 'Traducao', patch: 'Patch', steam_sync: 'Sincronizacao Steam', game_added: 'Jogo Adicionado', game_launched: 'Jogo Iniciado', profile_created: 'Perfil Criado', settings_changed: 'Configuracoes', import_export: 'Import/Export', translation_bridge: 'Translation Bridge', other: 'Outro' },
  ru: { translation: 'Перевод', patch: 'Патч', steam_sync: 'Синхронизация Steam', game_added: 'Игра добавлена', game_launched: 'Игра запущена', profile_created: 'Профиль создан', settings_changed: 'Настройки', import_export: 'Импорт/Экспорт', translation_bridge: 'Translation Bridge', other: 'Другое' },
  pl: { translation: 'Tlumaczenie', patch: 'Patch', steam_sync: 'Synchronizacja Steam', game_added: 'Gra Dodana', game_launched: 'Gra Uruchomiona', profile_created: 'Profil Utworzony', settings_changed: 'Ustawienia', import_export: 'Import/Export', translation_bridge: 'Translation Bridge', other: 'Inne' },
};

// Default (Italian fallback)
export const activityNames: Record<ActivityType, string> = activityNamesI18n.it;

/** Get localized activity name */
export function getLocalizedActivityName(type: ActivityType, lang: string = 'it'): string {
  return (activityNamesI18n[lang] || activityNamesI18n.en)?.[type] || activityNamesI18n.en[type] || type;
}

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
        params: {
          activityType: params.activity_type,
          title: params.title,
          description: params.description,
          gameName: params.game_name,
          gameId: params.game_id,
          metadata: params.metadata,
        }
      });
      return response.data;
    } catch (error: unknown) {
      clientLogger.error('[ActivityHistory] Failed to add activity:', error);
      return null;
    }
  }

  /**
   * Ottieni attività con filtri e paginazione
   */
  async get(filter: ActivityFilter = {}): Promise<ActivityPage | null> {
    try {
      const response = await invoke<ActivityResponse<ActivityPage>>('activity_get', {
        params: {
          activityType: filter.activity_type,
          gameId: filter.game_id,
          limit: filter.limit,
          offset: filter.offset,
        }
      });
      return response.data;
    } catch (error: unknown) {
      clientLogger.error('[ActivityHistory] Failed to get activities:', error);
      return null;
    }
  }

  /**
   * Ottieni le ultime N attività (con cache globalThis 5s per evitare chiamate duplicate)
   */
  private get _recentCache(): Map<number, { data: Activity[]; ts: number }> {
    const g = globalThis as unknown as Record<string, Map<number, { data: Activity[]; ts: number }> | undefined>;
    if (!g.__gsActivityCache) g.__gsActivityCache = new Map();
    return g.__gsActivityCache;
  }
  async getRecent(limit: number = 10): Promise<Activity[]> {
    const cached = this._recentCache.get(limit);
    if (cached && Date.now() - cached.ts < 5000) {
      return cached.data;
    }
    try {
      const response = await invoke<ActivityResponse<Activity[]>>('activity_get_recent', {
        limit,
      });
      const data = response.data ?? [];
      this._recentCache.set(limit, { data, ts: Date.now() });
      return data;
    } catch (error: unknown) {
      clientLogger.error('[ActivityHistory] Failed to get recent activities:', error);
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
    } catch (error: unknown) {
      clientLogger.error('[ActivityHistory] Failed to count activities:', error);
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
    } catch (error: unknown) {
      clientLogger.error('[ActivityHistory] Failed to delete activity:', error);
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
    } catch (error: unknown) {
      clientLogger.error('[ActivityHistory] Failed to clear activities:', error);
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
   * Format relative timestamp
   */
  formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    // Localized relative time
    const lang = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('gamestringer_language') || 'it')
      : 'it';
    const locale = lang === 'ja' ? 'ja-JP' : lang === 'zh' ? 'zh-CN' : lang === 'ko' ? 'ko-KR' : lang;

    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      if (minutes < 1) return rtf.format(0, 'minute');
      if (minutes < 60) return rtf.format(-minutes, 'minute');
      if (hours < 24) return rtf.format(-hours, 'hour');
      if (days < 7) return rtf.format(-days, 'day');
    } catch {
      // Fallback
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} min ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
    }

    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

// Singleton instance
export const activityHistory = new ActivityHistoryClient();
