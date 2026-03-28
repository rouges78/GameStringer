/**
 * Incremental Translation System
 * 
 * Rileva stringhe nuove, modificate o rimosse quando un gioco si aggiorna.
 * Permette di tradurre solo il delta, preservando le traduzioni esistenti.
 * 
 * Funziona con qualsiasi formato: mantiene uno snapshot delle stringhe sorgente
 * e confronta con la versione corrente per produrre un diff.
 */

export interface StringEntry {
  key: string;
  value: string;
  file?: string;
  context?: string;
}

export interface TranslatedEntry extends StringEntry {
  translation: string;
  translatedAt?: number;
}

export interface IncrementalDiff {
  /** Stringhe nuove (non esistevano nello snapshot precedente) */
  added: StringEntry[];
  /** Stringhe modificate (stessa key, valore diverso — traduzione obsoleta) */
  modified: { current: StringEntry; previous: StringEntry; oldTranslation?: string }[];
  /** Stringhe rimosse (esistevano prima, non più presenti) */
  removed: StringEntry[];
  /** Stringhe invariate (stessa key e valore) */
  unchanged: StringEntry[];
  /** Statistiche */
  stats: {
    totalCurrent: number;
    totalPrevious: number;
    addedCount: number;
    modifiedCount: number;
    removedCount: number;
    unchangedCount: number;
    /** Percentuale di stringhe che richiedono traduzione */
    workPercent: number;
  };
}

export interface TranslationSnapshot {
  gameId: string;
  gameName: string;
  timestamp: number;
  version?: string;
  strings: StringEntry[];
  translations: Map<string, string>; // key → translation
}

const SNAPSHOT_PREFIX = 'gs_incremental_snapshot_';

/** Salva uno snapshot delle stringhe correnti */
export function saveSnapshot(
  gameId: string,
  gameName: string,
  strings: StringEntry[],
  translations?: Map<string, string>,
  version?: string,
): void {
  const snapshot: unknown = {
    gameId,
    gameName,
    timestamp: Date.now(),
    version,
    strings,
    translations: translations ? Object.fromEntries(translations) : {},
  };
  try {
    localStorage.setItem(`${SNAPSHOT_PREFIX}${gameId}`, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('[Incremental] Errore salvataggio snapshot:', e);
  }
}

/** Carica lo snapshot precedente */
export function loadSnapshot(gameId: string): TranslationSnapshot | null {
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_PREFIX}${gameId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      ...data,
      translations: new Map(Object.entries(data.translations || {})),
    };
  } catch {
    return null;
  }
}

/** Cancella lo snapshot */
export function clearSnapshot(gameId: string): void {
  localStorage.removeItem(`${SNAPSHOT_PREFIX}${gameId}`);
}

/** Lista tutti gli snapshot salvati */
export function listSnapshots(): { gameId: string; gameName: string; timestamp: number; stringCount: number; version?: string }[] {
  const results: { gameId: string; gameName: string; timestamp: number; stringCount: number; version?: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(SNAPSHOT_PREFIX)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key) || '');
      results.push({
        gameId: data.gameId,
        gameName: data.gameName,
        timestamp: data.timestamp,
        stringCount: data.strings?.length || 0,
        version: data.version,
      });
    } catch {}
  }
  return results.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Calcola il diff tra le stringhe correnti e lo snapshot precedente.
 * 
 * @param currentStrings Le stringhe sorgente attuali (dopo aggiornamento del gioco)
 * @param previousSnapshot Lo snapshot precedente (prima dell'aggiornamento)
 * @returns Il diff con stringhe aggiunte, modificate, rimosse e invariate
 */
export function calculateDiff(
  currentStrings: StringEntry[],
  previousSnapshot: TranslationSnapshot,
): IncrementalDiff {
  const prevMap = new Map<string, StringEntry>();
  for (const s of previousSnapshot.strings) {
    prevMap.set(s.key, s);
  }

  const currMap = new Map<string, StringEntry>();
  for (const s of currentStrings) {
    currMap.set(s.key, s);
  }

  const added: StringEntry[] = [];
  const modified: IncrementalDiff['modified'] = [];
  const unchanged: StringEntry[] = [];

  for (const curr of currentStrings) {
    const prev = prevMap.get(curr.key);
    if (!prev) {
      // Nuova stringa
      added.push(curr);
    } else if (prev.value !== curr.value) {
      // Stringa modificata
      modified.push({
        current: curr,
        previous: prev,
        oldTranslation: previousSnapshot.translations.get(curr.key),
      });
    } else {
      // Invariata
      unchanged.push(curr);
    }
  }

  // Stringhe rimosse (presenti prima, non più ora)
  const removed: StringEntry[] = [];
  for (const prev of previousSnapshot.strings) {
    if (!currMap.has(prev.key)) {
      removed.push(prev);
    }
  }

  const workCount = added.length + modified.length;
  const total = currentStrings.length;

  return {
    added,
    modified,
    removed,
    unchanged,
    stats: {
      totalCurrent: currentStrings.length,
      totalPrevious: previousSnapshot.strings.length,
      addedCount: added.length,
      modifiedCount: modified.length,
      removedCount: removed.length,
      unchangedCount: unchanged.length,
      workPercent: total > 0 ? Math.round((workCount / total) * 100) : 0,
    },
  };
}

/**
 * Applica le traduzioni esistenti dallo snapshot alle stringhe invariate.
 * Ritorna le stringhe che necessitano di traduzione (nuove + modificate).
 */
export function applyExistingTranslations(
  diff: IncrementalDiff,
  previousSnapshot: TranslationSnapshot,
): {
  /** Stringhe già tradotte (riutilizzate dallo snapshot) */
  reused: TranslatedEntry[];
  /** Stringhe che necessitano di nuova traduzione */
  needsTranslation: StringEntry[];
  /** Stringhe modificate con la vecchia traduzione come riferimento */
  needsRetranslation: { entry: StringEntry; oldTranslation: string; oldSource: string }[];
} {
  const reused: TranslatedEntry[] = [];
  const needsTranslation: StringEntry[] = [];
  const needsRetranslation: { entry: StringEntry; oldTranslation: string; oldSource: string }[] = [];

  // Stringhe invariate: riusa traduzione
  for (const entry of diff.unchanged) {
    const translation = previousSnapshot.translations.get(entry.key);
    if (translation) {
      reused.push({ ...entry, translation, translatedAt: previousSnapshot.timestamp });
    } else {
      // Invariata ma non aveva traduzione — aggiungila a quelle da tradurre
      needsTranslation.push(entry);
    }
  }

  // Stringhe nuove: da tradurre
  for (const entry of diff.added) {
    needsTranslation.push(entry);
  }

  // Stringhe modificate: da ritradurre (ma con la vecchia come riferimento)
  for (const mod of diff.modified) {
    if (mod.oldTranslation) {
      needsRetranslation.push({
        entry: mod.current,
        oldTranslation: mod.oldTranslation,
        oldSource: mod.previous.value,
      });
    } else {
      needsTranslation.push(mod.current);
    }
  }

  return { reused, needsTranslation, needsRetranslation };
}

/**
 * Genera una stringa con hash semplice per rilevare se un set di stringhe è cambiato.
 * Utile per check rapido senza caricare tutto lo snapshot.
 */
export function computeStringSetHash(strings: StringEntry[]): string {
  let hash = 0;
  const str = strings.map(s => `${s.key}:${s.value}`).sort().join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Formatta il diff in un messaggio leggibile per i log.
 */
export function formatDiffSummary(diff: IncrementalDiff): string {
  const parts: string[] = [];
  if (diff.stats.addedCount > 0) parts.push(`+${diff.stats.addedCount} nuove`);
  if (diff.stats.modifiedCount > 0) parts.push(`~${diff.stats.modifiedCount} modificate`);
  if (diff.stats.removedCount > 0) parts.push(`-${diff.stats.removedCount} rimosse`);
  parts.push(`=${diff.stats.unchangedCount} invariate`);
  return parts.join(', ');
}
