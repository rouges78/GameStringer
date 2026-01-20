import { useState, useEffect } from 'react';
import { safeSetItem, safeGetItem, safeRemoveItem } from './safe-storage';

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
  } catch (error) {
    console.warn('Errore salvataggio filtri library:', error);
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
  } catch (error) {
    console.warn('Errore caricamento filtri library:', error);
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
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Match esatto
  if (textLower.includes(queryLower)) return true;
  
  // Match parole separate
  const queryWords = queryLower.split(/\s+/);
  const allWordsMatch = queryWords.every(word => textLower.includes(word));
  if (allWordsMatch) return true;
  
  // Fuzzy match con tolleranza errori
  // Cerca corrispondenza con 1-2 caratteri di differenza
  if (query.length >= 3) {
    // Genera varianti con 1 carattere mancante
    for (let i = 0; i < queryLower.length; i++) {
      const variant = queryLower.slice(0, i) + queryLower.slice(i + 1);
      if (textLower.includes(variant)) return true;
    }
    
    // Cerca sottostringhe consecutive
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
export function debounce<T extends (...args: any[]) => any>(
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
