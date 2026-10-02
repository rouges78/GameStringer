/**
 * Import dell'Editor contro uno store IndexedDB che fallisce. Prima una lettura
 * fallita dava [] e l'import riscriveva la lista con le sole righe importate
 * (le stringhe già salvate sparivano); una scrittura fallita veniva ignorata.
 * Qui passa per lo store vero (editor-translations-store → storageManager) con
 * idb-keyval in memoria e errori pilotabili.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const { idb, toastMock } = vi.hoisted(() => ({
  idb: {
    data: new Map<string, unknown>(),
    failReads: false,
    failWrites: false,
    writes: 0,
  },
  toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

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

// Select Radix → <select> nativo (in jsdom i portali di Radix non si pilotano bene).
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select data-testid="game-select" value={value} onChange={e => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

import { TranslationImportDialog } from '@/components/translation-import-dialog';

const GAMES = [{ id: 'g1', title: 'Game One' }];
const SAVED = [
  { id: 'old-1', gameId: 'g1', originalText: 'Hello', translatedText: 'Salve', targetLanguage: 'it', status: 'edited' },
  { id: 'old-2', gameId: 'g2', originalText: 'Start', translatedText: 'Inizia', targetLanguage: 'it', status: 'completed' },
];
const FILE = JSON.stringify([
  { originalText: 'Hello', translatedText: 'Ciao', targetLanguage: 'it' },
  { originalText: 'Bye', translatedText: 'Addio', targetLanguage: 'it' },
]);

const stored = () => idb.data.get('gameTranslations') as Record<string, unknown>[] | undefined;

async function importFile(content: string) {
  const onImportComplete = vi.fn();
  render(<TranslationImportDialog open onOpenChange={vi.fn()} games={GAMES} onImportComplete={onImportComplete} />);
  fireEvent.change(screen.getByTestId('game-select'), { target: { value: 'g1' } });
  const input = document.getElementById('import-file-input') as HTMLInputElement;
  const file = new File([content], 't.json');
  Object.defineProperty(file, 'text', { value: async () => content });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: /^Import$/ }));
  await waitFor(() => expect(Object.values(toastMock).some(fn => fn.mock.calls.length > 0)).toBe(true));
  return onImportComplete;
}

describe('TranslationImportDialog con store che fallisce', () => {
  beforeEach(() => {
    idb.data = new Map([['gameTranslations', structuredClone(SAVED)]]);
    idb.failReads = false;
    idb.failWrites = false;
    idb.writes = 0;
    Object.values(toastMock).forEach(fn => fn.mockClear());
  });

  it('lettura fallita: nessuna scrittura, le stringhe salvate restano, nessun "Importate"', async () => {
    idb.failReads = true;
    const onImportComplete = await importFile(FILE);

    expect(idb.writes).toBe(0);
    expect(stored()).toEqual(SAVED);
    expect(toastMock.error).toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(onImportComplete).not.toHaveBeenCalled();
  });

  it('scrittura fallita: errore onesto, nessun "Importate", store invariato', async () => {
    idb.failWrites = true;
    const onImportComplete = await importFile(FILE);

    expect(toastMock.error).toHaveBeenCalledWith('common.impossibileSalvareLeTraduzioni');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(onImportComplete).not.toHaveBeenCalled();
    expect(stored()).toEqual(SAVED);
  });

  it('riuscito: una sola scrittura, aggiorna la stringa esistente e conserva quelle degli altri giochi', async () => {
    const onImportComplete = await importFile(FILE);

    expect(idb.writes).toBe(1);
    const rows = stored()!;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ id: 'old-1', translatedText: 'Ciao', status: 'completed' });
    expect(rows[1]).toEqual(SAVED[1]);
    expect(rows[2]).toMatchObject({ gameId: 'g1', originalText: 'Bye', translatedText: 'Addio' });
    expect(toastMock.success).toHaveBeenCalledWith('translationImportDialogComp.importResult');
    expect(onImportComplete).toHaveBeenCalledWith('g1');
  });
});
