'use client';

/**
 * Store del CONTENUTO tradotto per progetto (IndexedDB).
 *
 * PERCHÉ: i progetti (translation-projects) tengono solo metadati/progresso; il
 * contenuto vero dei file tradotti non era persistito quando una traduzione
 * arriva da fuori l'editor (es. import di un .gspack). Senza contenuto, la
 * pubblicazione/esportazione dal progetto poteva solo allegare un manifest di
 * metadati, non il file reale. Qui salviamo i file tradotti indicizzati per
 * gioco+lingua, così Pubblica/Esporta/Applica possono usare il file vero.
 */

import { get, set, del } from 'idb-keyval';

export interface StoredTranslatedFile {
  path: string;
  /** Percorso RELATIVO nell'installazione del gioco (per "Applica al gioco"). */
  originalPath?: string;
  content: string;
  format: string;
}

const KEY = 'gs_translated_files';
type Store = Record<string, StoredTranslatedFile[]>;

function keyFor(gameId: string, targetLanguage: string): string {
  return `${gameId}::${targetLanguage}`;
}

export async function saveTranslatedFiles(
  gameId: string,
  targetLanguage: string,
  files: StoredTranslatedFile[],
): Promise<void> {
  if (!files?.length) return;
  const all = ((await get(KEY)) as Store) || {};
  all[keyFor(gameId, targetLanguage)] = files;
  await set(KEY, all);
}

export async function loadTranslatedFiles(
  gameId: string,
  targetLanguage: string,
): Promise<StoredTranslatedFile[] | null> {
  try {
    const all = ((await get(KEY)) as Store) || {};
    return all[keyFor(gameId, targetLanguage)] || null;
  } catch {
    return null;
  }
}

export async function deleteTranslatedFiles(gameId: string, targetLanguage: string): Promise<void> {
  const all = ((await get(KEY)) as Store) || {};
  delete all[keyFor(gameId, targetLanguage)];
  if (Object.keys(all).length === 0) await del(KEY);
  else await set(KEY, all);
}
