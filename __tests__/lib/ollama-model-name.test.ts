import { describe, it, expect } from 'vitest';
import { pickInstalledModel, installedVariants } from '@/lib/ai/ollama-model-name';

// Lista reale di `ollama list` del 24/11/2026: translategemma solo con tag.
const INSTALLED = [
  'qwen3.5:35b-a3b',
  'gemma4:e4b',
  'translategemma:12b',
  'llava:latest',
  'huihui_ai/hy-mt1.5-abliterated:7b',
];

describe('pickInstalledModel', () => {
  it('prende la variante con tag quando il nome nudo non è installato', () => {
    expect(pickInstalledModel(INSTALLED, 'translategemma')).toBe('translategemma:12b');
  });

  it('preferisce il nome esatto se installato', () => {
    expect(pickInstalledModel(['translategemma:4b', 'translategemma'], 'translategemma')).toBe('translategemma');
  });

  it('preferisce :latest alle altre varianti', () => {
    expect(pickInstalledModel(['translategemma:4b', 'translategemma:latest'], 'translategemma')).toBe('translategemma:latest');
  });

  it('non confonde famiglie con lo stesso prefisso', () => {
    expect(pickInstalledModel(['translategemma2:9b'], 'translategemma')).toBeNull();
  });

  it('null quando la famiglia non è installata', () => {
    expect(pickInstalledModel(INSTALLED, 'mistral')).toBeNull();
    expect(pickInstalledModel([], 'translategemma')).toBeNull();
  });
});

describe('installedVariants', () => {
  it('elenca solo le varianti installate della famiglia', () => {
    expect(installedVariants(INSTALLED, 'translategemma')).toEqual(['translategemma:12b']);
    expect(installedVariants(['translategemma', 'translategemma:4b', 'llava:latest'], 'translategemma'))
      .toEqual(['translategemma', 'translategemma:4b']);
  });
});
