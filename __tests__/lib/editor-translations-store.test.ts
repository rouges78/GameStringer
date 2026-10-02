/**
 * Store dell'Editor (gameTranslations su IndexedDB). Ogni scrittura riscrive
 * l'intera lista: prima una lettura fallita diventava [] e la scrittura dopo
 * cancellava tutte le stringhe; una scrittura fallita risultava salvata.
 * Qui IndexedDB (idb-keyval) è in memoria, con errori pilotabili.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { idb } = vi.hoisted(() => ({
  idb: {
    data: new Map<string, unknown>(),
    failReads: false,
    failWrites: false,
    writes: 0,
  },
}));

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => {
    if (idb.failReads) throw new Error('IndexedDB read failed');
    return structuredClone(idb.data.get(key));
  }),
  set: vi.fn(async (key: string, value: unknown) => {
    if (idb.failWrites) throw new Error('IndexedDB write failed');
    idb.writes++;
    idb.data.set(key, structuredClone(value));
  }),
  del: vi.fn(async (key: string) => {
    idb.data.delete(key);
  }),
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { storageManager } from '@/lib/storage-manager';
import {
  listEditorTranslations,
  upsertEditorTranslation,
  upsertEditorTranslations,
  removeEditorTranslation,
} from '@/lib/editor-translations-store';

const SAVED = [
  { id: 'a', gameId: 'g1', originalText: 'Hello', translatedText: 'Ciao', status: 'completed' },
  { id: 'b', gameId: 'g1', originalText: 'Bye', translatedText: 'Addio', status: 'completed' },
];

const stored = () => idb.data.get('gameTranslations') as Record<string, unknown>[] | undefined;

beforeEach(() => {
  idb.data = new Map([['gameTranslations', structuredClone(SAVED)]]);
  idb.failReads = false;
  idb.failWrites = false;
  idb.writes = 0;
});

describe('storageManager: varianti strict', () => {
  it('getTranslationsStrict rigetta se la lettura fallisce; getTranslations resta tollerante', async () => {
    idb.failReads = true;
    await expect(storageManager.getTranslationsStrict()).rejects.toThrow('IndexedDB read failed');
    await expect(storageManager.getTranslations()).resolves.toEqual([]);
  });

  it('saveTranslationsStrict rigetta se la scrittura fallisce; saveTranslations resta tollerante', async () => {
    idb.failWrites = true;
    await expect(storageManager.saveTranslationsStrict([])).rejects.toThrow('IndexedDB write failed');
    await expect(storageManager.saveTranslations([])).resolves.toBeUndefined();
  });

  it('getTranslationsStrict senza dati restituisce []', async () => {
    idb.data.clear();
    await expect(storageManager.getTranslationsStrict()).resolves.toEqual([]);
  });
});

describe('upsertEditorTranslations', () => {
  it('fonde per id con una sola scrittura e non tocca gli altri record', async () => {
    await upsertEditorTranslations([
      { id: 'a', translatedText: 'Salve' },
      { id: 'c', gameId: 'g1', originalText: 'Yes', translatedText: 'Sì' },
      { id: 'c', status: 'reviewed' },
    ]);

    expect(idb.writes).toBe(1);
    expect(stored()).toEqual([
      { ...SAVED[0], translatedText: 'Salve' },
      SAVED[1],
      { id: 'c', gameId: 'g1', originalText: 'Yes', translatedText: 'Sì', status: 'reviewed' },
    ]);
  });

  it('se la lettura fallisce rigetta e non scrive nulla (le stringhe salvate restano)', async () => {
    idb.failReads = true;
    await expect(upsertEditorTranslations([{ id: 'c', translatedText: 'Sì' }])).rejects.toThrow();

    expect(idb.writes).toBe(0);
    expect(stored()).toEqual(SAVED);
  });

  it('se la scrittura fallisce rigetta', async () => {
    idb.failWrites = true;
    await expect(upsertEditorTranslations([{ id: 'a', translatedText: 'Salve' }])).rejects.toThrow('IndexedDB write failed');
    expect(stored()).toEqual(SAVED);
  });

  it('lista vuota: nessuna lettura né scrittura', async () => {
    idb.failReads = true;
    await expect(upsertEditorTranslations([])).resolves.toBeUndefined();
    expect(idb.writes).toBe(0);
  });
});

describe('upsertEditorTranslation / removeEditorTranslation / listEditorTranslations', () => {
  it('upsertEditorTranslation aggiorna il record e rigetta se non può salvare', async () => {
    await upsertEditorTranslation({ id: 'b', translatedText: 'Arrivederci' });
    expect(stored()?.[1]).toMatchObject({ id: 'b', translatedText: 'Arrivederci', originalText: 'Bye' });

    idb.failWrites = true;
    await expect(upsertEditorTranslation({ id: 'b', translatedText: 'Ciao ciao' })).rejects.toThrow();

    idb.failWrites = false;
    idb.failReads = true;
    await expect(upsertEditorTranslation({ id: 'b', translatedText: 'Ciao ciao' })).rejects.toThrow();
    expect(stored()?.[1]).toMatchObject({ translatedText: 'Arrivederci' });
  });

  it('removeEditorTranslation con lettura fallita non svuota lo store', async () => {
    idb.failReads = true;
    await expect(removeEditorTranslation('a')).rejects.toThrow();
    expect(idb.writes).toBe(0);
    expect(stored()).toEqual(SAVED);
  });

  it('listEditorTranslations rigetta invece di mostrare uno store vuoto', async () => {
    await expect(listEditorTranslations({ gameId: 'g1' })).resolves.toHaveLength(2);
    idb.failReads = true;
    await expect(listEditorTranslations()).rejects.toThrow('IndexedDB read failed');
  });
});
