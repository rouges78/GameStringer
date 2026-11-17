/**
 * Import traduzioni dell'Editor. Prima i parser emettevano `originalText` ma il
 * salvataggio leggeva `rec.source`, scriveva in una chiave localStorage che
 * nessuno legge e contava ogni riga come importata: «Importate N di N» e
 * nell'Editor non compariva nulla.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const { store, toastMock } = vi.hoisted(() => ({
  store: { rows: [] as Record<string, unknown>[], failWrites: false },
  toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));

// Lo store dell'Editor (lib/editor-translations-store) passa da storageManager:
// qui è in memoria. `failWrites` simula IndexedDB che rifiuta la scrittura —
// saveTranslations la logga e non la propaga, come quello vero.
vi.mock('@/lib/storage-manager', () => ({
  storageManager: {
    getTranslations: vi.fn(async () => structuredClone(store.rows)),
    saveTranslations: vi.fn(async (rows: Record<string, unknown>[]) => {
      if (!store.failWrites) store.rows = structuredClone(rows);
    }),
    // Le varianti strict, usate dallo store dell'Editor, propagano l'errore.
    getTranslationsStrict: vi.fn(async () => structuredClone(store.rows)),
    saveTranslationsStrict: vi.fn(async (rows: Record<string, unknown>[]) => {
      if (store.failWrites) throw new Error('IndexedDB write failed');
      store.rows = structuredClone(rows);
    }),
  },
}));

// Select Radix → <select> nativo: in jsdom i portali/pointer events di Radix
// non si pilotano in modo affidabile, e qui interessa l'import, non il widget.
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

import {
  TranslationImportDialog,
  parseCsvRecords,
  parseImportCsv,
  parseImportJson,
  mergeImportRows,
} from '@/components/translation-import-dialog';

const GAMES = [{ id: 'g1', title: 'Game One' }, { id: 'g2', title: 'Game Two' }];

async function importFile(name: string, content: string, gameId = 'g1') {
  const onImportComplete = vi.fn();
  render(
    <TranslationImportDialog open onOpenChange={vi.fn()} games={GAMES} onImportComplete={onImportComplete} />,
  );
  fireEvent.change(screen.getByTestId('game-select'), { target: { value: gameId } });
  const input = document.getElementById('import-file-input') as HTMLInputElement;
  const file = new File([content], name);
  // jsdom non implementa Blob.text() (WebView2 sì).
  Object.defineProperty(file, 'text', { value: async () => content });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: /^Import$/ }));
  // Ogni esito (riuscito, parziale, fallito) termina con un toast.
  await waitFor(() => expect(Object.values(toastMock).some(fn => fn.mock.calls.length > 0)).toBe(true));
  return onImportComplete;
}

describe('parser CSV', () => {
  it('gestisce virgolette, "" escape, campi vuoti, CRLF e a-capo nei campi', () => {
    const csv = '\uFEFFa,b,c\r\n"x, y","he said ""hi""",\r\n"multi\nline",,z\n';
    expect(parseCsvRecords(csv)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'he said "hi"', ''],
      ['multi\nline', '', 'z'],
    ]);
  });

  it("legge l'export CSV dell'Editor per nome di colonna", () => {
    const rows = parseImportCsv('original,translated,status,targetLanguage\n"Hello","Ciao","completed","it"\n');
    expect(rows).toEqual([
      { filePath: undefined, originalText: 'Hello', translatedText: 'Ciao', targetLanguage: 'it', sourceLanguage: undefined, context: undefined },
    ]);
  });

  it('senza header riconoscibile usa lo schema posizionale storico', () => {
    const rows = parseImportCsv('col1,col2,col3,col4,col5,col6\nfile.txt,Hello,Ciao,es,x,menu\n');
    expect(rows[0]).toMatchObject({ filePath: 'file.txt', originalText: 'Hello', translatedText: 'Ciao', targetLanguage: 'es', context: 'menu' });
  });
});

describe('parser JSON', () => {
  it("accetta l'export JSON dell'Editor e { translations: [...] }", () => {
    const editorExport = JSON.stringify([{ id: 'x', originalText: 'Hello', translatedText: 'Hallo', targetLanguage: 'de', sourceLanguage: 'en' }]);
    expect(parseImportJson(editorExport)[0]).toMatchObject({ originalText: 'Hello', translatedText: 'Hallo', targetLanguage: 'de' });
    const wrapped = JSON.stringify({ translations: [{ source: 'Yes', target: 'Sì' }] });
    expect(parseImportJson(wrapped)[0]).toMatchObject({ originalText: 'Yes', translatedText: 'Sì' });
  });
});

describe('mergeImportRows', () => {
  it('aggiorna la stringa già presente per lo stesso gioco e lingua invece di duplicarla', () => {
    const existing = [{ id: 'old', gameId: 'g1', originalText: 'Hello', translatedText: 'Salve', targetLanguage: 'it', status: 'edited' }];
    const { merged, written } = mergeImportRows(
      existing,
      [{ originalText: 'Hello', translatedText: 'Ciao', targetLanguage: 'it' }, { originalText: 'Bye', translatedText: '' }],
      GAMES[0], 'it', '2026-10-01T00:00:00.000Z',
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 'old', translatedText: 'Ciao', status: 'completed' });
    expect([...written]).toEqual([['old', 'Ciao']]);
  });
});

describe('TranslationImportDialog', () => {
  beforeEach(() => {
    store.rows = [];
    store.failWrites = false;
    Object.values(toastMock).forEach(fn => fn.mockClear());
  });

  it("scrive nello store dell'Editor record completi e lo dice solo dopo averli riletti", async () => {
    const onImportComplete = await importFile('export.csv', 'original,translated,status,targetLanguage\nHello,Ciao,completed,it\nBye,Addio,completed,it\n');

    expect(store.rows).toHaveLength(2);
    expect(store.rows[0]).toMatchObject({
      gameId: 'g1',
      originalText: 'Hello',
      translatedText: 'Ciao',
      targetLanguage: 'it',
      status: 'completed',
      game: { id: 'g1', title: 'Game One' },
    });
    expect(toastMock.success).toHaveBeenCalledWith('translationImportDialogComp.importResult');
    expect(onImportComplete).toHaveBeenCalledWith('g1');
    expect(localStorage.getItem('gs_translation_memory')).toBeNull();
  });

  it('le righe senza traduzione non contano come importate', async () => {
    const onImportComplete = await importFile('t.json', JSON.stringify([
      { originalText: 'Hello', translatedText: 'Ciao' },
      { originalText: 'Bye', translatedText: '' },
    ]));

    expect(store.rows).toHaveLength(1);
    expect(toastMock.warning).toHaveBeenCalledWith('translationImportDialogComp.importResult');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(onImportComplete).toHaveBeenCalledWith('g1');
  });

  it('se la scrittura non arriva allo store non annuncia nessun import', async () => {
    store.failWrites = true;
    const onImportComplete = await importFile('t.json', JSON.stringify([{ originalText: 'Hello', translatedText: 'Ciao' }]));

    expect(toastMock.error).toHaveBeenCalledWith('common.impossibileSalvareLeTraduzioni');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(onImportComplete).not.toHaveBeenCalled();
  });

  it('senza lingua nel file usa la lingua di destinazione predefinita, non "it"', async () => {
    localStorage.setItem('gameStringerSettings', JSON.stringify({ translation: { defaultTargetLang: 'pl' } }));
    await importFile('t.json', JSON.stringify([{ originalText: 'Hello', translatedText: 'Cześć' }]));

    expect(store.rows[0]).toMatchObject({ targetLanguage: 'pl' });
  });
});
