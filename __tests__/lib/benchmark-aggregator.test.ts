/**
 * Test per il motore di aggregazione/ranking del benchmark qualità:
 * - statistica incrementale (Welford)
 * - lower bound di confidenza
 * - ranking per coppia lingua+genere
 * - riordino data-driven della chain (stabile, nessun provider perso)
 */

import { describe, it, expect } from 'vitest';
import {
  addSample,
  stddevOf,
  confidenceLowerBound,
  rankProviders,
  recommendChainOrder,
  benchKey,
  type BenchAggregate,
} from '@/lib/translation/benchmark-aggregator';

function build(samples: Array<[string, string, string, string | null, number]>): BenchAggregate {
  const agg: BenchAggregate = {};
  for (const [p, s, t, g, score] of samples) {
    addSample(agg, { provider: p, sourceLang: s, targetLang: t, genre: g, score });
  }
  return agg;
}

describe('addSample / Welford', () => {
  it('calcola media e deviazione standard corrette', () => {
    const agg: BenchAggregate = {};
    for (const s of [80, 90, 100]) {
      addSample(agg, { provider: 'x', sourceLang: 'it', targetLang: 'ja', genre: 'jrpg', score: s });
    }
    const stat = agg[benchKey('x', 'it', 'ja', 'jrpg')];
    expect(stat.n).toBe(3);
    expect(stat.mean).toBeCloseTo(90, 6);
    expect(stddevOf(stat)).toBeCloseTo(10, 6); // sd campionaria di [80,90,100]
  });

  it('clampa i punteggi fuori scala 0–100', () => {
    const agg: BenchAggregate = {};
    addSample(agg, { provider: 'x', sourceLang: 'it', targetLang: 'ja', score: 150 });
    addSample(agg, { provider: 'x', sourceLang: 'it', targetLang: 'ja', score: -20 });
    const stat = agg[benchKey('x', 'it', 'ja', 'any')];
    expect(stat.mean).toBeCloseTo(50, 6); // (100 + 0) / 2
  });
});

describe('confidenceLowerBound', () => {
  it('penalizza i campioni scarsi (prior alta con n=1)', () => {
    const one = { n: 1, mean: 95, m2: 0 };
    const many = { n: 50, mean: 85, m2: 50 * 4 }; // sd ~2
    expect(confidenceLowerBound(many)).toBeGreaterThan(confidenceLowerBound(one));
  });
});

describe('rankProviders', () => {
  it('mette davanti il provider affidabile, non quello con 1 solo campione alto', () => {
    const agg = build([
      ['fluke', 'it', 'ja', 'jrpg', 100],
      ...Array.from({ length: 8 }, () => ['solid', 'it', 'ja', 'jrpg', 88] as [string, string, string, string, number]),
    ]);
    const ranks = rankProviders(agg, { sourceLang: 'it', targetLang: 'ja', genre: 'jrpg' });
    expect(ranks[0].provider).toBe('solid');
    expect(ranks[0].confident).toBe(true);
    expect(ranks.find(r => r.provider === 'fluke')?.confident).toBe(false);
  });

  it('filtra per coppia lingua+genere', () => {
    const agg = build([
      ['a', 'it', 'ja', 'jrpg', 90],
      ['b', 'it', 'en', 'jrpg', 95],
      ['c', 'it', 'ja', 'visualnovel', 99],
    ]);
    const ranks = rankProviders(agg, { sourceLang: 'it', targetLang: 'ja', genre: 'jrpg' });
    expect(ranks.map(r => r.provider)).toEqual(['a']);
  });
});

describe('recommendChainOrder', () => {
  it('promuove i provider confidenti migliori, mantiene stabile il resto', () => {
    const agg = build([
      ...Array.from({ length: 6 }, () => ['deepl', 'it', 'ja', 'jrpg', 92] as [string, string, string, string, number]),
      ...Array.from({ length: 6 }, () => ['gpt', 'it', 'ja', 'jrpg', 78] as [string, string, string, string, number]),
    ]);
    const chain = ['gpt', 'claude', 'deepl', 'gemini'];
    const out = recommendChainOrder(chain, agg, { sourceLang: 'it', targetLang: 'ja', genre: 'jrpg' });
    // deepl (92) e gpt (78) sono confidenti → davanti, deepl prima di gpt;
    // claude e gemini (senza dati) restano nell'ordine originale, dopo.
    expect(out).toEqual(['deepl', 'gpt', 'claude', 'gemini']);
  });

  it('non perde né duplica provider e non cambia nulla senza dati', () => {
    const chain = ['a', 'b', 'c'];
    const out = recommendChainOrder(chain, {}, { sourceLang: 'it', targetLang: 'ja' });
    expect(out).toEqual(['a', 'b', 'c']);
  });
});
