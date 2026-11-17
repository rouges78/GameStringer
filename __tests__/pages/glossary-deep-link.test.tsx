/**
 * Il link «Glossario» dell'Editor apre /glossary?gameId=<id>. Prima la pagina
 * ignorava il parametro e mostrava sempre il primo glossario della lista.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, configure } from '@testing-library/react';

// La pagina è pesante (Radix, tab, dialog): sotto carico il default di 1s non basta.
configure({ asyncUtilTimeout: 5000 });

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));
vi.mock('@/lib/tauri-api', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));
vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
}));

function seedGlossaries() {
  const make = (gameId: string, gameName: string, targetLang: string) => ({
    id: `gl_${gameId}`, gameId, gameName, sourceLang: 'en', targetLang, entries: [],
    stats: { totalTerms: 0, lockedTerms: 0, syncedTerms: 0, flexibleTerms: 0, autoExtracted: 0, manuallyAdded: 0, byCategory: {} },
    createdAt: 1, updatedAt: 1,
  });
  localStorage.setItem('gs_auto_glossaries', JSON.stringify({
    steam_111: make('steam_111', 'First Game', 'it'),
    steam_222: make('steam_222', 'Second Game', 'ru'),
  }));
}

async function renderAt(search: string) {
  window.history.replaceState({}, '', `/glossary${search}`);
  vi.resetModules(); // auto-glossary tiene una cache di modulo: riparti pulito
  const { default: GlossaryPage } = await import('@/app/glossary/page');
  return render(<GlossaryPage />);
}

describe('GlossaryPage deep link ?gameId=', () => {
  beforeEach(() => {
    localStorage.clear();
    seedGlossaries();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async () => null);
  });

  it('senza parametro apre il primo glossario (comportamento invariato)', async () => {
    await renderAt('');
    await waitFor(() => expect(screen.getByText('EN → IT')).toBeTruthy());
  });

  it('preseleziona il glossario del gioco passato nel link', async () => {
    await renderAt('?gameId=steam_222');
    await waitFor(() => expect(screen.getByText('EN → RU')).toBeTruthy());
    expect(screen.queryByText('EN → IT')).toBeNull();
  });

  it('accetta l\'ID Steam senza prefisso', async () => {
    await renderAt('?gameId=222');
    await waitFor(() => expect(screen.getByText('EN → RU')).toBeTruthy());
  });

  it('se il gioco non ha glossario propone di crearlo, con l\'ID già compilato', async () => {
    await renderAt('?gameId=steam_999');
    await waitFor(() => expect(screen.getByText('glossaryPage.noGlossaryForGame')).toBeTruthy());
    expect(screen.getByDisplayValue('steam_999')).toBeTruthy();
  });
});

describe('GlossaryPage estrazione termini', () => {
  beforeEach(() => {
    localStorage.clear();
    seedGlossaries();
    invokeMock.mockReset();
  });

  it('senza stringhe salvate del gioco il pulsante è disabilitato e spiegato', async () => {
    invokeMock.mockImplementation(async () => null);
    await renderAt('?gameId=steam_111');
    fireEvent.mouseDown(screen.getByText('glossaryPage.aiExtraction'));
    await waitFor(() => expect(screen.getByText('glossaryPage.noGameTexts')).toBeTruthy());
    const button = screen.getByText('glossaryPage.extractTerms').closest('button');
    expect(button?.disabled).toBe(true);
  });

  it('con le stringhe reali su disco il pulsante si abilita', async () => {
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === 'load_translation_strings' ? { entries: [{ source: 'Open the Iron Gate' }] } : null
    );
    await renderAt('?gameId=steam_111');
    fireEvent.mouseDown(screen.getByText('glossaryPage.aiExtraction'));
    await waitFor(() => expect(screen.getByText('glossaryPage.gameTextsAvailable')).toBeTruthy());
    const button = screen.getByText('glossaryPage.extractTerms').closest('button');
    expect(button?.disabled).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('load_translation_strings', { gameId: 'steam_111', targetLanguage: 'it' });
  });
});
