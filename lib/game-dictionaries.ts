/**
 * GameStringer Game Dictionaries Client
 * 
 * TypeScript client per la gestione dei dizionari di traduzione game-specific.
 * Integra con il backend Rust per import/export, ricerca, e applicazione a XUnity.
 */

import { invoke } from '@/lib/tauri-api';
import { clientLogger } from '@/lib/client-logger';

// Types
export interface DictionaryInfo {
  id: string;
  game_name: string;
  game_id?: string;
  source_language: string;
  target_language: string;
  entries_count: number;
  version: string;
  author?: string;
  description?: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface GameDictionary {
  info: DictionaryInfo;
  translations: Record<string, string>;
}

export interface DictionaryResult {
  success: boolean;
  message: string;
  dictionary_id?: string;
  entries_loaded?: number;
}

export interface LocalDictionaryStatus {
  installed: boolean;
  dictionary_id?: string;
  entries_count: number;
  last_updated?: string;
  file_path?: string;
}

export interface DictionariesStats {
  total_dictionaries: number;
  total_entries: number;
  total_size_mb: number;
  by_language: Record<string, number>;
  dictionaries: DictionaryInfo[];
}

/**
 * Lista tutti i dizionari installati localmente
 */
export async function listInstalledDictionaries(): Promise<DictionaryInfo[]> {
  try {
    return await invoke<DictionaryInfo[]>('list_installed_dictionaries');
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore lista dizionari: ${String(error)}`, 'DICT');
    return [];
  }
}

/**
 * Carica un dizionario completo
 */
export async function loadDictionary(gameId: string, targetLang: string): Promise<GameDictionary | null> {
  try {
    return await invoke<GameDictionary>('load_dictionary', {
      gameId,
      targetLang,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore caricamento dizionario: ${String(error)}`, 'DICT');
    return null;
  }
}

/**
 * Salva un dizionario
 */
export async function saveDictionary(dictionary: GameDictionary): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('save_dictionary', { dictionary });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore salvataggio dizionario: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Importa un dizionario da file JSON (auto-rileva metadati da _meta)
 */
export async function importDictionaryAuto(filePath: string): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('import_dictionary_auto', {
      filePath: filePath,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore importazione auto: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Importa un dizionario da file JSON (parametri manuali)
 */
export async function importDictionaryFromFile(
  filePath: string,
  gameId: string,
  gameName: string,
  sourceLang: string,
  targetLang: string
): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('import_dictionary_from_file', {
      filePath,
      gameId,
      gameName,
      sourceLang,
      targetLang,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore importazione: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Esporta un dizionario in formato semplice (solo traduzioni)
 */
export async function exportDictionarySimple(
  gameId: string,
  targetLang: string,
  outputPath: string
): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('export_dictionary_simple', {
      gameId,
      targetLang,
      outputPath,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore esportazione: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Elimina un dizionario locale
 */
export async function deleteDictionary(gameId: string, targetLang: string): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('delete_dictionary', {
      gameId,
      targetLang,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore eliminazione: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Verifica se un dizionario è installato
 */
export async function getDictionaryStatus(gameId: string, targetLang: string): Promise<LocalDictionaryStatus> {
  try {
    return await invoke<LocalDictionaryStatus>('get_dictionary_status', {
      gameId,
      targetLang,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore status dizionario: ${String(error)}`, 'DICT');
    return {
      installed: false,
      entries_count: 0,
    };
  }
}

/**
 * Cerca nel dizionario
 */
export async function searchInDictionary(
  gameId: string,
  targetLang: string,
  query: string,
  limit?: number
): Promise<[string, string][]> {
  try {
    return await invoke<[string, string][]>('search_in_dictionary', {
      gameId,
      targetLang,
      query,
      limit,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore ricerca: ${String(error)}`, 'DICT');
    return [];
  }
}

/**
 * Aggiunge una traduzione al dizionario
 */
export async function addTranslationToDictionary(
  gameId: string,
  targetLang: string,
  original: string,
  translated: string
): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('add_translation_to_dictionary', {
      gameId,
      targetLang,
      original,
      translated,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore aggiunta traduzione: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Unisce due dizionari
 */
export async function mergeDictionaries(
  baseGameId: string,
  baseLang: string,
  mergeFilePath: string
): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('merge_dictionaries', {
      baseGameId,
      baseLang,
      mergeFilePath,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore merge: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Applica dizionario a XUnity AutoTranslator
 */
export async function applyDictionaryToXUnity(
  gameId: string,
  targetLang: string,
  gamePath: string
): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('apply_dictionary_to_xunity', {
      gameId,
      targetLang,
      gamePath,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore applicazione XUnity: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Estrae traduzioni da XUnity AutoTranslator
 */
export async function extractXUnityTranslations(
  gamePath: string,
  targetLang: string
): Promise<Record<string, string>> {
  try {
    return await invoke<Record<string, string>>('extract_xunity_translations', {
      gamePath,
      targetLang,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore estrazione XUnity: ${String(error)}`, 'DICT');
    return {};
  }
}

/**
 * Importa traduzioni da XUnity nel dizionario GameStringer
 */
export async function importFromXUnity(
  gamePath: string,
  gameId: string,
  gameName: string,
  targetLang: string
): Promise<DictionaryResult> {
  try {
    return await invoke<DictionaryResult>('import_from_xunity', {
      gamePath,
      gameId,
      gameName,
      targetLang,
    });
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore import da XUnity: ${String(error)}`, 'DICT');
    return {
      success: false,
      message: `Errore: ${error}`,
    };
  }
}

/**
 * Ottieni statistiche aggregate sui dizionari
 */
export async function getDictionariesStats(): Promise<DictionariesStats | null> {
  try {
    return await invoke<DictionariesStats>('get_dictionaries_stats');
  } catch (error: unknown) {
    clientLogger.error(`[GameDictionaries] Errore statistiche: ${String(error)}`, 'DICT');
    return null;
  }
}

// Utility functions

/**
 * Formatta dimensione file
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formatta data
 */
export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Ottieni nome lingua da codice
 */
export function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    it: 'Italiano',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    pt: 'Português',
    ru: 'Русский',
    ja: '日本語',
    ko: '한국어',
    zh: '中文',
    pl: 'Polski',
    nl: 'Nederlands',
    tr: 'Türkçe',
    ar: 'العربية',
  };
  return languages[code] || code.toUpperCase();
}

/**
 * Ottieni bandiera da codice lingua
 */
export function getLanguageFlag(code: string): string {
  const flags: Record<string, string> = {
    en: '🇬🇧',
    it: '🇮🇹',
    de: '🇩🇪',
    fr: '🇫🇷',
    es: '🇪🇸',
    pt: '🇵🇹',
    ru: '🇷🇺',
    ja: '🇯🇵',
    ko: '🇰🇷',
    zh: '🇨🇳',
    pl: '🇵🇱',
    nl: '🇳🇱',
    tr: '🇹🇷',
    ar: '🇸🇦',
  };
  return flags[code] || '🌐';
}
