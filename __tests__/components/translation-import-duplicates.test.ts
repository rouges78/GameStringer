/**
 * Import dell'Editor: le righe ripetute nel file finiscono nello stesso record e
 * non devono far apparire un import «parziale» quando nulla è andato perso.
 */
import { describe, it, expect } from 'vitest';
import { mergeImportRows, countStoredImports } from '@/components/translation-import-dialog';

const GAME = { id: 'g1', title: 'Game One' };
const NOW = '2026-10-01T00:00:00.000Z';

describe('import con righe ripetute', () => {
  it('stessa riga due volte: un record, entrambe le righe contate', () => {
    const rows = [
      { originalText: 'Yes', translatedText: 'Sì' },
      { originalText: 'Yes', translatedText: 'Sì' },
    ];
    const { merged, written } = mergeImportRows([], rows, GAME, 'it', NOW);
    expect(merged).toHaveLength(1);
    expect(countStoredImports(merged, written)).toBe(rows.length);
  });

  it('stesso testo con traduzioni diverse: conta solo quella rimasta nello store', () => {
    const rows = [
      { originalText: 'Ready', translatedText: 'Pronto' },
      { originalText: 'Ready', translatedText: 'Pronta' },
    ];
    const { merged, written } = mergeImportRows([], rows, GAME, 'it', NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ translatedText: 'Pronta' });
    expect(countStoredImports(merged, written)).toBe(1);
  });
});
