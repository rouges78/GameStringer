/**
 * CRI Patcher: quando nessun provider risponde, translateWithFallback restituisce
 * la SORGENTE con success:false. translateCriEntries non deve marcarla come
 * tradotta: il contatore «Tradotte» della pagina e l'export CSV/PO la
 * spaccerebbero per una traduzione.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const translateWithFallback = vi.fn();

vi.mock('@/lib/ai/ai-translate-direct', () => ({
  translateWithFallback: (...args: unknown[]) => translateWithFallback(...args),
}));

import {
  translateCriEntries,
  exportToCSV,
  exportToPO,
  type CriStringEntry,
} from '@/lib/patchers/cri-patcher';

const entries: CriStringEntry[] = [
  { index: 0, key: 'msg_000', value: 'こんにちは', context: 'a.bmd', speaker: 'Joker' },
  { index: 1, key: 'msg_001', value: 'さようなら', context: 'a.bmd', speaker: 'Joker' },
];

describe('translateCriEntries — esito del fallback', () => {
  beforeEach(() => {
    translateWithFallback.mockReset();
  });

  it('success:false → translated vuoto, stato error, export senza la sorgente', async () => {
    translateWithFallback.mockImplementation(async ({ texts }: { texts: string[] }) => ({
      translations: texts,
      provider: 'none',
      success: false,
    }));

    const result = await translateCriEntries(entries, { targetLanguage: 'it' });

    for (const e of result) {
      expect(e.translated ?? '').toBe('');
      expect(e.translationStatus).toBe('error');
    }

    const csvRows = exportToCSV(result).split('\n').slice(1);
    for (const row of csvRows) {
      // index,key,speaker,value,translated,context → colonna translated vuota
      expect(row.split(',')[4]).toBe('');
    }
    expect(exportToPO(result, 'it')).not.toMatch(/msgstr "こんにちは"|msgstr "さようなら"/);
  });

  it('success:false non cancella una traduzione già presente', async () => {
    translateWithFallback.mockImplementation(async ({ texts }: { texts: string[] }) => ({
      translations: texts,
      provider: 'none',
      success: false,
    }));
    const withManual = entries.map((e, i) => (i === 0 ? { ...e, translated: 'Ciao' } : e));

    const result = await translateCriEntries(withManual, { targetLanguage: 'it' });

    expect(result[0].translated).toBe('Ciao');
    expect(result[0].translationStatus).toBe('error');
    expect(result[1].translated ?? '').toBe('');
  });

  it('success:true → traduzioni applicate', async () => {
    translateWithFallback.mockResolvedValue({
      translations: ['Ciao', 'Arrivederci'],
      provider: 'test',
      success: true,
    });

    const result = await translateCriEntries(entries, { targetLanguage: 'it' });

    expect(result.map((e) => e.translated)).toEqual(['Ciao', 'Arrivederci']);
    expect(result.every((e) => e.translationStatus === 'translated')).toBe(true);
  });
});
