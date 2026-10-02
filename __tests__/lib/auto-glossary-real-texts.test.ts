/**
 * Glossario: l'estrazione termini lavora solo su testi VERI del gioco.
 *
 * Prima la pagina Glossario passava a extractTerms quattro frasi demo fisse
 * ("Your HP is low! Use a potion."...) e i termini estratti finivano nel
 * glossario reale del gioco. Ora la fonte è loadGameSourceTexts: stringhe su
 * disco (load_translation_strings) o checkpoint dell'auto-traduzione; se non
 * c'è nulla, array vuoto (la pagina disabilita il pulsante).
 *
 * Secondo difetto coperto: con tutti i provider giù, translateWithFallback
 * restituisce il prompt stesso come "traduzione" con success=false, e il JSON
 * d'esempio del prompt veniva parsato come termine vero ("term" → "translation").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
const idbGetMock = vi.fn();
const translateSmartMock = vi.fn();

vi.mock('@/lib/tauri-api', () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));
vi.mock('idb-keyval', () => ({
  get: (key: string) => idbGetMock(key),
}));
vi.mock('@/lib/ai/ai-translate-direct', () => ({
  translateSmart: (opts: unknown) => translateSmartMock(opts),
}));

import { loadGameSourceTexts, extractTerms, loadGlossary, createGlossary } from '@/lib/auto-glossary';

beforeEach(() => {
  invokeMock.mockReset();
  idbGetMock.mockReset();
  translateSmartMock.mockReset();
  // save/load glossario su Tauri sono fire & forget: devono solo non esplodere
  invokeMock.mockImplementation(async () => null);
});

describe('loadGameSourceTexts', () => {
  it('usa le stringhe persistite su disco per gioco e lingua', async () => {
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === 'load_translation_strings'
        ? { entries: [{ source: 'Open the Iron Gate' }, { source: '  Talk to Mira ' }, { source: 'Open the Iron Gate' }, { source: '' }] }
        : null
    );

    const texts = await loadGameSourceTexts('steam_42', 'ru');

    expect(invokeMock).toHaveBeenCalledWith('load_translation_strings', { gameId: 'steam_42', targetLanguage: 'ru' });
    expect(texts).toEqual(['Open the Iron Gate', 'Talk to Mira']);
    expect(idbGetMock).not.toHaveBeenCalled();
  });

  it('ripiega sul checkpoint dell\'auto-traduzione se su disco non c\'è nulla', async () => {
    idbGetMock.mockResolvedValue({
      data: {
        'lang/en.json': [{ original: 'Sword of Dawn' }, { original: 'Sword of Dawn' }],
        'lang/ui.json': [{ original: 'Inventory' }],
      },
    });

    const texts = await loadGameSourceTexts('g1', 'it');

    expect(idbGetMock).toHaveBeenCalledWith('gs_translation_checkpoint_g1_it');
    expect(texts).toEqual(['Sword of Dawn', 'Inventory']);
  });

  it('senza fonti restituisce un array vuoto, mai frasi d\'esempio', async () => {
    invokeMock.mockRejectedValue(new Error('not tauri'));
    idbGetMock.mockResolvedValue(undefined);

    await expect(loadGameSourceTexts('g2', 'it')).resolves.toEqual([]);
  });
});

describe('extractTerms', () => {
  it('con tutti i provider giù fallisce invece di salvare il JSON d\'esempio del prompt', async () => {
    createGlossary('g3', 'Game Three', 'en', 'it');
    // translateWithFallback: nessun provider → restituisce il prompt, success=false
    translateSmartMock.mockImplementation(async (opts: { texts: string[] }) => ({
      translations: opts.texts,
      provider: 'none',
      success: false,
    }));

    await expect(extractTerms('g3', 'Game Three', ['Open the Iron Gate'], 'en', 'it')).rejects.toThrow();
    expect(loadGlossary('g3')?.entries).toEqual([]);
  });

  it('se l\'unico provider rimasto restituisce il prompt (success=true) non salva il JSON d\'esempio', async () => {
    createGlossary('g5', 'Game Five', 'en', 'it');
    translateSmartMock.mockImplementation(async (opts: { texts: string[] }) => ({
      translations: [...opts.texts],
      provider: 'lingva',
      success: true,
    }));

    await expect(extractTerms('g5', 'Game Five', ['Open the Iron Gate'], 'en', 'it')).rejects.toThrow();
    expect(loadGlossary('g5')?.entries).toEqual([]);
  });

  it('manda all\'LLM i testi ricevuti e salva i termini restituiti', async () => {
    createGlossary('g4', 'Game Four', 'en', 'it');
    translateSmartMock.mockResolvedValue({
      translations: ['[{"source":"Iron Gate","target":"Cancello di Ferro","category":"location","tier":"locked"}]'],
      provider: 'test',
      success: true,
    });

    const result = await extractTerms('g4', 'Game Four', ['Open the Iron Gate', 'The Iron Gate is shut'], 'en', 'it');

    const prompt = (translateSmartMock.mock.calls[0][0] as { texts: string[] }).texts[0];
    expect(prompt).toContain('Open the Iron Gate');
    expect(prompt).not.toContain('Dragon Slayer');
    expect(result.newTerms.map(e => e.sourceTerm)).toEqual(['Iron Gate']);
    expect(loadGlossary('g4')?.entries.map(e => e.targetTerm)).toEqual(['Cancello di Ferro']);
  });
});
