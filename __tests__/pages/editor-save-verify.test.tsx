/**
 * Editor: «Salvato» solo se la modifica è davvero nello store.
 * storageManager.saveTranslations logga e inghiotte gli errori di IndexedDB, quindi
 * dopo upsertEditorTranslation l'Editor rilegge il record prima di annunciarlo.
 * In più: il deep link mostra le stringhe del gioco anche quando in memoria ci
 * sono risultati parziali del Neural Translator (che bloccano il caricamento dallo store).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { tauriApiInvoke, coreInvoke, storage, toastMock } = vi.hoisted(() => ({
  tauriApiInvoke: vi.fn(),
  coreInvoke: vi.fn(),
  storage: { rows: [] as Record<string, unknown>[], failWrites: false, partial: null as Record<string, unknown> | null },
  toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/lib/tauri-api', () => ({
  invoke: (cmd: string, args?: unknown) => tauriApiInvoke(cmd, args),
  isTauri: () => true,
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown) => coreInvoke(cmd, args),
}));
vi.mock('@/lib/storage-manager', () => ({
  storageManager: {
    getTranslations: vi.fn(async () => structuredClone(storage.rows)),
    // Come quello vero: un errore di scrittura non arriva al chiamante.
    saveTranslations: vi.fn(async (rows: Record<string, unknown>[]) => {
      if (!storage.failWrites) storage.rows = structuredClone(rows);
    }),
    // Le varianti strict, usate dallo store dell'Editor, propagano l'errore.
    getTranslationsStrict: vi.fn(async () => structuredClone(storage.rows)),
    saveTranslationsStrict: vi.fn(async (rows: Record<string, unknown>[]) => {
      if (storage.failWrites) throw new Error('IndexedDB write failed');
      storage.rows = structuredClone(rows);
    }),
    getPartialTranslations: vi.fn(async () => storage.partial),
    getEditorFile: vi.fn(async () => null),
    clearEditorFile: vi.fn(async () => {}),
  },
}));

import EditorPage from '@/app/editor/page';

async function editAndSave(newText: string) {
  window.history.replaceState({}, '', '/editor?gameId=g1');
  render(<EditorPage />);
  fireEvent.click(await screen.findByText('editorPage.savedStringsFile'));
  fireEvent.click(await screen.findByText('Hello'));
  fireEvent.change(await screen.findByPlaceholderText('qaCheck.enterTranslation'), { target: { value: newText } });
  fireEvent.click(screen.getByText('editorPage.save'));
}

describe('Editor: salvataggio di una traduzione', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.failWrites = false;
    storage.partial = null;
    storage.rows = [{
      id: 'r1', gameId: 'g1', filePath: 'import', originalText: 'Hello', translatedText: 'Ciao',
      status: 'completed', targetLanguage: 'it', sourceLanguage: 'en', confidence: 0, isManualEdit: false,
      updatedAt: '2026-10-01T00:00:00.000Z', game: { id: 'g1', title: 'Game One' }, suggestions: [],
    }];
    coreInvoke.mockImplementation(async (cmd: string) => (cmd === 'get_games' ? [{ id: 'g1', title: 'Game One' }] : null));
    tauriApiInvoke.mockImplementation(async () => []);
  });

  it('scrittura riuscita: «Salvato»', async () => {
    await editAndSave('Salve');

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('editor.saved', expect.anything()));
    expect(storage.rows[0]).toMatchObject({ id: 'r1', translatedText: 'Salve' });
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('scrittura persa da IndexedDB: errore, niente «Salvato»', async () => {
    storage.failWrites = true;
    await editAndSave('Salve');

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('common.impossibileSalvareLeModifiche'));
    expect(toastMock.success).not.toHaveBeenCalledWith('editor.saved', expect.anything());
    expect(toastMock.success).not.toHaveBeenCalledWith('editor.saved', undefined);
    // Niente scrittura nel dizionario a nome di una modifica non salvata.
    expect(coreInvoke).not.toHaveBeenCalledWith('add_translation_to_dictionary', expect.anything());
  });
});

describe('Editor: deep link con risultati parziali in memoria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.failWrites = false;
    storage.rows = [{
      id: 'r1', gameId: 'g1', filePath: 'import', originalText: 'Hello', translatedText: 'Ciao',
      status: 'completed', targetLanguage: 'it', game: { id: 'g1', title: 'Game One' }, suggestions: [],
    }];
    storage.partial = { timestamp: 0, gameId: 'other', gameName: 'Other', items: [{ id: 'p', sourceText: 'Partial line', translatedText: '' }] };
    coreInvoke.mockImplementation(async (cmd: string) => (cmd === 'get_games' ? [{ id: 'g1', title: 'Game One' }] : null));
    tauriApiInvoke.mockImplementation(async () => []);
  });

  it('le stringhe salvate del gioco sono nella lista', async () => {
    window.history.replaceState({}, '', '/editor?gameId=g1');
    render(<EditorPage />);
    fireEvent.click(await screen.findByText('editorPage.savedStringsFile'));
    expect(await screen.findByText('Hello')).toBeTruthy();
  });
});
