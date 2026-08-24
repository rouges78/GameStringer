/**
 * Test per il remote-config di modelli/prezzi:
 * - validazione/pulizia di una config remota arbitraria
 * - merge sopra i default bundled
 * - getter prezzi/modelli/raccomandazioni
 */

import { describe, it, expect } from 'vitest';
import {
  BUNDLED_MODEL_CONFIG,
  validateModelConfig,
  mergeModelConfig,
  getProviderPrice1k,
  getProviderPrice1kOrNull,
  getProviderModels,
  getRecommendation,
} from '@/lib/remote-config';

describe('validateModelConfig', () => {
  it('accetta e ripulisce una config ben formata', () => {
    const cfg = validateModelConfig({
      version: 2,
      updatedAt: '2026-08-01',
      pricing: { claude: { per1kUsd: 0.0025, note: 'Nuovo prezzo' } },
      models: { claude: [{ id: 'claude-4', label: 'Claude 4', recommended: true }] },
      recommendations: { creative: 'claude' },
    });
    expect(cfg).not.toBeNull();
    expect(cfg!.version).toBe(2);
    expect(cfg!.pricing.claude.per1kUsd).toBe(0.0025);
    expect(cfg!.models.claude[0].id).toBe('claude-4');
  });

  it('scarta voci malformate ma tiene quelle valide', () => {
    const cfg = validateModelConfig({
      pricing: { claude: { per1kUsd: 0.01 }, bad: { per1kUsd: 'x' }, neg: { per1kUsd: -1 } },
      models: { openai: [{ id: 'gpt-x', label: 'GPT X' }, { label: 'senza id' }], empty: [] },
    });
    expect(Object.keys(cfg!.pricing)).toEqual(['claude']);
    expect(cfg!.models.openai).toHaveLength(1);
    expect(cfg!.models.empty).toBeUndefined();
  });

  it('ritorna null per input non validi o vuoti', () => {
    expect(validateModelConfig(null)).toBeNull();
    expect(validateModelConfig('nope')).toBeNull();
    expect(validateModelConfig({})).toBeNull();
    expect(validateModelConfig({ pricing: {}, models: {} })).toBeNull();
  });

  it('usa l\'id come label se manca', () => {
    const cfg = validateModelConfig({ models: { openai: [{ id: 'gpt-4o' }] } });
    expect(cfg!.models.openai[0].label).toBe('gpt-4o');
  });
});

describe('mergeModelConfig', () => {
  it('sovrascrive per chiave e mantiene i default mancanti', () => {
    const remote = validateModelConfig({
      version: 3,
      pricing: { claude: { per1kUsd: 0.99 } },
      models: { claude: [{ id: 'claude-new', label: 'Claude New' }] },
    });
    const merged = mergeModelConfig(BUNDLED_MODEL_CONFIG, remote);
    expect(merged.version).toBe(3);
    expect(merged.pricing.claude.per1kUsd).toBe(0.99); // override
    expect(merged.pricing.openai.per1kUsd).toBe(BUNDLED_MODEL_CONFIG.pricing.openai.per1kUsd); // bundled
    expect(merged.models.claude[0].id).toBe('claude-new'); // override
    expect(merged.models.openai).toEqual(BUNDLED_MODEL_CONFIG.models.openai); // bundled
  });

  it('con remote null ritorna i bundled', () => {
    expect(mergeModelConfig(BUNDLED_MODEL_CONFIG, null)).toBe(BUNDLED_MODEL_CONFIG);
  });
});

describe('getter', () => {
  it('prezzo con fallback 0.002 per provider sconosciuto', () => {
    expect(getProviderPrice1k(BUNDLED_MODEL_CONFIG, 'claude')).toBe(0.003);
    expect(getProviderPrice1k(BUNDLED_MODEL_CONFIG, 'sconosciuto')).toBe(0.002);
  });

  it('la variante OrNull distingue «gratis» da «non lo so»', () => {
    // È la distinzione che a chain-cost.ts serviva e non aveva: con il solo
    // fallback, un provider locale e uno sconosciuto rispondevano lo stesso.
    expect(getProviderPrice1kOrNull(BUNDLED_MODEL_CONFIG, 'claude')).toBe(0.003);
    expect(getProviderPrice1kOrNull(BUNDLED_MODEL_CONFIG, 'hymt')).toBe(0);
    expect(getProviderPrice1kOrNull(BUNDLED_MODEL_CONFIG, 'sconosciuto')).toBeNull();
  });

  it('le chiavi delle catene sono nel listino, non solo quelle dei vendor', () => {
    // Il difetto del 24/08: le catene chiedono 'anthropic-premium', il listino
    // conosceva solo 'claude', e Opus 5 veniva preventivato col ripiego 0.002.
    expect(getProviderPrice1kOrNull(BUNDLED_MODEL_CONFIG, 'anthropic')).toBe(0.003);
    expect(getProviderPrice1kOrNull(BUNDLED_MODEL_CONFIG, 'anthropic-claude4')).toBe(0.003);
    expect(getProviderPrice1kOrNull(BUNDLED_MODEL_CONFIG, 'anthropic-premium')).toBe(0.005);
  });

  it('modelli del provider (vuoto se assente)', () => {
    expect(getProviderModels(BUNDLED_MODEL_CONFIG, 'openai').length).toBeGreaterThan(0);
    expect(getProviderModels(BUNDLED_MODEL_CONFIG, 'inesistente')).toEqual([]);
  });

  it('raccomandazione con fallback a default', () => {
    expect(getRecommendation(BUNDLED_MODEL_CONFIG, 'creative')).toBe('claude');
    expect(getRecommendation(BUNDLED_MODEL_CONFIG, 'scenario-ignoto')).toBe('gpt5');
  });
});
