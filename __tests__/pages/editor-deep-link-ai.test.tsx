/**
 * Editor: deep link e «Traduci con AI».
 * - /editor?gameId=<id> (Progetti) e ?game=<titolo> (stepper di auto-traduzione)
 *   prima venivano ignorati: l'Editor si apriva su «tutti i giochi».
 * - «Traduci con AI» era uno stub che azzerava i suggerimenti e non traduceva
 *   nulla; i messaggi passavano da un sistema di notifiche mai inizializzato.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { tauriApiInvoke, coreInvoke, storage, translateSingleSmart, toastMock } = vi.hoisted(() => ({
  tauriApiInvoke: vi.fn(),
  coreInvoke: vi.fn(),
  storage: { editorFile: null as Record<string, unknown> | null, rows: [] as Record<string, unknown>[] },
  translateSingleSmart: vi.fn(),
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
    getTranslations: vi.fn(async () => storage.rows),
    saveTranslations: vi.fn(async () => {}),
    getTranslationsStrict: vi.fn(async () => storage.rows),
    saveTranslationsStrict: vi.fn(async () => {}),
    getPartialTranslations: vi.fn(async () => null),
    getEditorFile: vi.fn(async () => storage.editorFile),
    clearEditorFile: vi.fn(async () => {}),
  },
}));
vi.mock('@/lib/ai/ai-translate-direct', () => ({
  translateSingleSmart: (...args: unknown[]) => translateSingleSmart(...args),
}));

import EditorPage from '@/app/editor/page';

function setUrl(search: string) {
  window.history.replaceState({}, '', `/editor${search}`);
}

describe('Editor deep link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.editorFile = null;
    storage.rows = [];
    coreInvoke.mockImplementation(async (cmd: string) =>
      cmd === 'get_games' ? [{ id: 'g1', title: 'Game One' }, { id: 'g2', title: 'Game Two' }] : null);
    tauriApiInvoke.mockImplementation(async (cmd: string) =>
      cmd === 'list_installed_dictionaries'
        ? [
            { id: 'd1', game_id: 'g1', game_name: 'Game One', entries_count: 3, target_language: 'it' },
            { id: 'd2', game_id: 'g2', game_name: 'Game Two', entries_count: 5, target_language: 'de' },
          ]
        : null);
  });

  it('senza parametri resta sulla lista dei giochi', async () => {
    setUrl('');
    render(<EditorPage />);
    await waitFor(() => expect(screen.getByText('Game Two')).toBeTruthy());
    expect(screen.queryByText('Dizionario DE')).toBeNull();
    expect(toastMock.info).not.toHaveBeenCalled();
  });

  it('?gameId= apre il progetto del gioco', async () => {
    setUrl('?gameId=g2');
    render(<EditorPage />);
    await waitFor(() => expect(screen.getByText('Dizionario DE')).toBeTruthy());
    expect(screen.queryByText('Dizionario IT')).toBeNull();
  });

  it('?game=<titolo> (stepper) risolve il gioco per titolo', async () => {
    setUrl('?game=game%20one&path=C%3A%5CGames%5COne');
    render(<EditorPage />);
    await waitFor(() => expect(screen.getByText('Dizionario IT')).toBeTruthy());
  });

  it('le stringhe salvate nello store sono raggiungibili dal progetto', async () => {
    storage.rows = [{ id: 'r1', gameId: 'g1', originalText: 'Hello', translatedText: 'Ciao', status: 'completed', targetLanguage: 'it', game: { id: 'g1', title: 'Game One' } }];
    setUrl('?gameId=g1');
    render(<EditorPage />);
    await waitFor(() => expect(screen.getByText('editorPage.savedStringsFile')).toBeTruthy());
  });

  it('se il gioco non ha dati nell\'Editor lo dice', async () => {
    setUrl('?gameId=nope');
    render(<EditorPage />);
    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith('editorPage.deepLinkNoData'));
  });
});

describe('Editor «Traduci con AI»', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl('');
    storage.rows = [];
    coreInvoke.mockImplementation(async () => []);
    tauriApiInvoke.mockImplementation(async () => []);
    // File aperto dal Neural Translator, senza lingua di destinazione dichiarata.
    storage.editorFile = { filename: 'dialog.ini', content: 'greet=Hello world\nbye=Goodbye now', gameId: 'g1', gameName: 'Game One' };
    localStorage.setItem('gameStringerSettings', JSON.stringify({ translation: { defaultTargetLang: 'de' } }));
  });

  it('traduce la riga selezionata verso la lingua predefinita e la scrive nel campo', async () => {
    translateSingleSmart.mockResolvedValue({ translated: 'Hallo Welt', provider: 'deepl' });
    render(<EditorPage />);
    const button = await screen.findByText('editorPage.translateAi');
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByPlaceholderText('editorPage.translationPh')).toHaveValue('Hallo Welt'));
    expect(translateSingleSmart).toHaveBeenCalledWith('Hello world', 'de', 'en');
    expect(toastMock.success).toHaveBeenCalledWith('editorPage.aiTranslated');
  });

  it('se nessun provider risponde lo dice e non scrive il testo originale come traduzione', async () => {
    translateSingleSmart.mockResolvedValue({ translated: 'Hello world', provider: 'none' });
    render(<EditorPage />);
    fireEvent.click(await screen.findByText('editorPage.translateAi'));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('editorPage.aiNoProvider'));
    expect(screen.getByPlaceholderText('editorPage.translationPh')).toHaveValue('');
    expect(toastMock.success).not.toHaveBeenCalledWith('editorPage.aiTranslated');
  });
});
