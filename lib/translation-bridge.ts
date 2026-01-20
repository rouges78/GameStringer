/**
 * GameStringer Translation Bridge Client
 * 
 * TypeScript client for the Rust Translation Bridge backend.
 * Provides real-time translation management for in-game translation.
 */

import { invoke } from '@/lib/tauri-api';

// Types matching Rust backend
export interface BridgeStats {
  total_requests: number;
  cache_hits: number;
  cache_misses: number;
  errors: number;
  avg_response_time_us: number;
  uptime_seconds: number;
}

export interface DictionaryStats {
  total_entries: number;
  language_pairs: string[];
  active_source: string;
  active_target: string;
}

export interface BridgeResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface TranslationPair {
  original: string;
  translated: string;
}

/**
 * Translation Bridge Client
 * 
 * Manages communication with the Rust Translation Bridge backend
 * for in-game translation functionality.
 */
export class TranslationBridgeClient {
  private isConnected: boolean = false;

  /**
   * Start the Translation Bridge server
   */
  async start(): Promise<boolean> {
    try {
      const response = await invoke<BridgeResponse<string>>('translation_bridge_start');
      this.isConnected = response.success;
      return response.success;
    } catch (error) {
      console.error('[TranslationBridge] Failed to start:', error);
      return false;
    }
  }

  /**
   * Stop the Translation Bridge server
   */
  async stop(): Promise<boolean> {
    try {
      const response = await invoke<BridgeResponse<string>>('translation_bridge_stop');
      this.isConnected = false;
      return response.success;
    } catch (error) {
      console.error('[TranslationBridge] Failed to stop:', error);
      return false;
    }
  }

  /**
   * Check if the bridge is running
   */
  async isRunning(): Promise<boolean> {
    try {
      const response = await invoke<BridgeResponse<boolean>>('translation_bridge_status');
      this.isConnected = response.data ?? false;
      return this.isConnected;
    } catch (error) {
      console.error('[TranslationBridge] Failed to check status:', error);
      return false;
    }
  }

  /**
   * Get bridge statistics
   */
  async getStats(): Promise<BridgeStats | null> {
    try {
      const response = await invoke<BridgeResponse<BridgeStats>>('translation_bridge_stats');
      return response.data;
    } catch (error) {
      console.error('[TranslationBridge] Failed to get stats:', error);
      return null;
    }
  }

  /**
   * Get dictionary statistics
   */
  async getDictionaryStats(): Promise<DictionaryStats | null> {
    try {
      const response = await invoke<BridgeResponse<DictionaryStats>>('translation_bridge_dictionary_stats');
      return response.data;
    } catch (error) {
      console.error('[TranslationBridge] Failed to get dictionary stats:', error);
      return null;
    }
  }

  /**
   * Load translations into the dictionary
   */
  async loadTranslations(
    sourceLang: string,
    targetLang: string,
    translations: TranslationPair[]
  ): Promise<number> {
    try {
      const response = await invoke<BridgeResponse<number>>('translation_bridge_load_translations', {
        params: {
          source_lang: sourceLang,
          target_lang: targetLang,
          translations: translations,
        },
      });
      return response.data ?? 0;
    } catch (error) {
      console.error('[TranslationBridge] Failed to load translations:', error);
      return 0;
    }
  }

  /**
   * Load translations from a JSON file
   */
  async loadFromJson(path: string): Promise<number> {
    try {
      const response = await invoke<BridgeResponse<number>>('translation_bridge_load_json', {
        path,
      });
      return response.data ?? 0;
    } catch (error) {
      console.error('[TranslationBridge] Failed to load JSON:', error);
      return 0;
    }
  }

  /**
   * Set active language pair
   */
  async setLanguages(source: string, target: string): Promise<boolean> {
    try {
      const response = await invoke<BridgeResponse<string>>('translation_bridge_set_languages', {
        source,
        target,
      });
      return response.success;
    } catch (error) {
      console.error('[TranslationBridge] Failed to set languages:', error);
      return false;
    }
  }

  /**
   * Add a single translation
   */
  async addTranslation(original: string, translated: string): Promise<boolean> {
    try {
      const response = await invoke<BridgeResponse<string>>('translation_bridge_add_translation', {
        original,
        translated,
      });
      return response.success;
    } catch (error) {
      console.error('[TranslationBridge] Failed to add translation:', error);
      return false;
    }
  }

  /**
   * Get translation for a text
   */
  async getTranslation(text: string): Promise<string | null> {
    try {
      const response = await invoke<BridgeResponse<string | null>>('translation_bridge_get_translation', {
        text,
      });
      return response.data;
    } catch (error) {
      console.error('[TranslationBridge] Failed to get translation:', error);
      return null;
    }
  }

  /**
   * Export translations to JSON file
   */
  async exportToJson(path: string): Promise<boolean> {
    try {
      const response = await invoke<BridgeResponse<string>>('translation_bridge_export_json', {
        path,
      });
      return response.success;
    } catch (error) {
      console.error('[TranslationBridge] Failed to export JSON:', error);
      return false;
    }
  }

  /**
   * Clear all dictionaries
   */
  async clear(): Promise<boolean> {
    try {
      const response = await invoke<BridgeResponse<string>>('translation_bridge_clear');
      return response.success;
    } catch (error) {
      console.error('[TranslationBridge] Failed to clear:', error);
      return false;
    }
  }

  /**
   * Format uptime for display
   */
  formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Format response time for display
   */
  formatResponseTime(microseconds: number): string {
    if (microseconds < 1000) return `${microseconds.toFixed(0)}µs`;
    if (microseconds < 1000000) return `${(microseconds / 1000).toFixed(2)}ms`;
    return `${(microseconds / 1000000).toFixed(2)}s`;
  }

  /**
   * Calculate cache hit rate
   */
  getCacheHitRate(stats: BridgeStats): number {
    if (stats.total_requests === 0) return 0;
    return (stats.cache_hits / stats.total_requests) * 100;
  }
}

// Singleton instance
export const translationBridge = new TranslationBridgeClient();
