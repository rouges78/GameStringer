import { useState, useEffect } from 'react';
import { safeSetItem, safeGetItem, safeRemoveItem } from './safe-storage';
import { clientLogger } from '@/lib/client-logger';

const FILTERS_KEY = 'library_filters';

export interface LibraryFilters {
  sortBy: 'alphabetical' | 'lastPlayed' | 'recentlyAdded' | 'playtime';
  viewMode: 'grid' | 'list';
  selectedPlatforms: string[];
  selectedEngines: string[];
  selectedLanguages: string[];
  selectedGenres: string[];
  selectedStatus: string[];
  selectedTags: string[];
  searchTerm: string;
}

const defaultFilters: LibraryFilters = {
  sortBy: 'alphabetical',
  viewMode: 'grid',
  selectedPlatforms: [],
  selectedEngines: [],
  selectedLanguages: [],
  selectedGenres: [],
  selectedStatus: [],
  selectedTags: [],
  searchTerm: '',
};

/**
 * Salva i filtri della library per il profilo corrente
 */
export function saveLibraryFilters(filters: Partial<LibraryFilters>): void {
  try {
    const current = loadLibraryFilters();
    const updated = { ...current, ...filters };
    safeSetItem(FILTERS_KEY, updated);
  } catch (error: unknown) {
    clientLogger.warn('Errore salvataggio filtri library:', error);
  }
}

/**
 * Carica i filtri salvati della library
 */
export function loadLibraryFilters(): LibraryFilters {
  try {
    const saved = safeGetItem<LibraryFilters>(FILTERS_KEY);
    if (saved) {
      return { ...defaultFilters, ...saved };
    }
  } catch (error: unknown) {
    clientLogger.warn('Errore caricamento filtri library:', error);
  }
  return defaultFilters;
}

/**
 * Resetta i filtri ai valori di default
 */
export function resetLibraryFilters(): void {
  safeRemoveItem(FILTERS_KEY);
}

/**
 * Ricerca fuzzy - tollerante a errori di battitura
 * Usa algoritmo Levenshtein distance semplificato
 */
export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  if (!text) return false;

  const textLower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const queryLower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Match esatto o sottostringa
  if (textLower.includes(queryLower)) return true;

  // Match parole separate (ogni parola della query deve essere in qualche parola del testo)
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
  const textWords = textLower.split(/\s+/).filter(w => w.length > 0);

  // Ogni parola della query deve matchare l'inizio di qualche parola del testo
  const allQueryWordsMatch = queryWords.every(qWord =>
    textWords.some(tWord =>
      tWord.startsWith(qWord) ||
      tWord.includes(qWord) ||
      qWord.startsWith(tWord)
    )
  );
  if (allQueryWordsMatch) return true;

  // Fuzzy match con tolleranza errori
  if (query.length >= 3) {
    // Genera varianti con 1 carattere mancante
    for (let i = 0; i < queryLower.length; i++) {
      const variant = queryLower.slice(0, i) + queryLower.slice(i + 1);
      if (textLower.includes(variant)) return true;
    }

    // Cerca sottostringhe consecutive (70% dei caratteri)
    const minMatch = Math.max(3, Math.floor(queryLower.length * 0.7));
    for (let i = 0; i <= queryLower.length - minMatch; i++) {
      const substring = queryLower.slice(i, i + minMatch);
      if (textLower.includes(substring)) return true;
    }
  }

  return false;
}

/**
 * Debounce utility per ritardare chiamate
 */
export function debounce<T extends (...args: unknown[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Hook custom per usare debounce con useState
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

/** Etichetta del chip per i giochi il cui motore non è stato rilevato */
export const UNKNOWN_ENGINE = 'Unknown';

/**
 * Normalizza il motore di un gioco: null, vuoto o "unknown" diventano UNKNOWN_ENGINE.
 * Senza questo un motore vuoto combaciava con ogni chip ('unity'.includes('') è sempre vero).
 */
export function normalizeEngine(engine: string | null | undefined): string {
  const trimmed = (engine ?? '').trim();
  return !trimmed || trimmed.toLowerCase() === UNKNOWN_ENGINE.toLowerCase() ? UNKNOWN_ENGINE : trimmed;
}

/**
 * True se il motore del gioco è tra quelli selezionati (nessuna selezione = passa tutto).
 * Confronto esatto, senza distinzione maiuscole: i chip nascono dai motori rilevati.
 */
export function matchesEngineFilter(engine: string | null | undefined, selectedEngines: string[]): boolean {
  if (selectedEngines.length === 0) return true;
  const key = normalizeEngine(engine).toLowerCase();
  return selectedEngines.some(sel => normalizeEngine(sel).toLowerCase() === key);
}

/**
 * Chip del filtro motore generati dai motori rilevati in libreria: ordinati, senza
 * doppioni per maiuscole, con UNKNOWN_ENGINE in coda se serve. Le selezioni salvate
 * restano visibili anche se nessun gioco le ha più, così si possono deselezionare.
 */
export function buildEngineChips(engines: Array<string | null | undefined>, selectedEngines: string[] = []): string[] {
  const chips = new Map<string, string>();
  let hasUnknown = false;
  for (const raw of [...selectedEngines, ...engines]) {
    const label = normalizeEngine(raw);
    if (label === UNKNOWN_ENGINE) {
      hasUnknown = true;
      continue;
    }
    const key = label.toLowerCase();
    if (!chips.has(key)) chips.set(key, label);
  }
  const sorted = [...chips.values()].sort((a, b) => a.localeCompare(b));
  return hasUnknown ? [...sorted, UNKNOWN_ENGINE] : sorted;
}

/** App ID Steam di un gioco, sia con app_id "123" sia con id "steam_123" / "steam_shared_123" */
function steamAppIdOf(g: { id: string; app_id?: string }): string {
  return (g.app_id || g.id || '').replace(/^steam_(shared_)?/, '');
}

/**
 * Unisce una lista parziale di giochi a quella corrente senza perdere nulla: chi è in
 * entrambe prende la versione nuova, chi manca da `incoming` resta. Serve quando la
 * scansione non è completa (API Steam ancora in arrivo o fallita, uno store che non
 * risponde). Chiave: piattaforma + app_id (o id); per Steam l'App ID senza prefisso,
 * così "steam_123", "steam_shared_123" e "123" sono lo stesso gioco.
 */
export function mergeGameLists<T extends { id: string; app_id?: string; platform?: string }>(current: T[], incoming: T[]): T[] {
  const keyOf = (g: T) => (g.platform === 'Steam' ? `Steam:${steamAppIdOf(g)}` : `${g.platform ?? ''}:${g.app_id || g.id}`);
  const fresh = new Map(incoming.map(g => [keyOf(g), g] as const));
  const merged = current.map(g => {
    const key = keyOf(g);
    const next = fresh.get(key);
    if (!next) return g;
    fresh.delete(key);
    return next;
  });
  return [...merged, ...fresh.values()];
}

const PLACEHOLDER_TITLE = /^(Game|Shared Game) \d+$/;

/** True per titoli mancanti o segnaposto ("Game 123", "Shared Game 123") */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  return !title || !title.trim() || PLACEHOLDER_TITLE.test(title);
}

/**
 * Applica i nomi di `update_remote_game_database` (cache Steam grezza: `steam_app_id`,
 * `title`, ...) alla libreria: cambia solo il `title` dei giochi Steam con nome
 * segnaposto, senza aggiungere né togliere giochi.
 */
export function applySteamTitles<T extends { id: string; app_id: string; platform: string; title: string }>(
  games: T[],
  entries: ReadonlyArray<{ steam_app_id?: number | null; title?: string | null }> | null | undefined,
): { games: T[]; updated: number } {
  const names = new Map<string, string>();
  for (const e of entries ?? []) {
    if (e?.steam_app_id && e.title && !isPlaceholderTitle(e.title)) names.set(String(e.steam_app_id), e.title);
  }
  let updated = 0;
  const next = games.map(g => {
    if (g.platform !== 'Steam' || !isPlaceholderTitle(g.title)) return g;
    const name = names.get(steamAppIdOf(g));
    if (!name) return g;
    updated++;
    return { ...g, title: name };
  });
  return { games: updated > 0 ? next : games, updated };
}

