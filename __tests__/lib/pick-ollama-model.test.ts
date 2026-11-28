import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { pickOllamaModel } from '@/lib/ai/ai-translate-direct';

// I modelli installati sul PC di prova, nell'ordine in cui li elenca Ollama.
const INSTALLED = ['qwen3.5:35b-a3b', 'gemma4:e4b', 'translategemma:12b', 'llava:latest', 'huihui_ai/hy-mt1.5-abliterated:7b'];

describe('pickOllamaModel', () => {
  it('usa il modello scelto dall\'utente', () => {
    expect(pickOllamaModel(INSTALLED, 'gemma4')).toBe('gemma4:e4b');
  });

  it('senza scelta preferisce un modello da localizzazione', () => {
    expect(pickOllamaModel(INSTALLED)).toBe('qwen3.5:35b-a3b');
    expect(pickOllamaModel(INSTALLED, 'non-installato')).toBe('qwen3.5:35b-a3b');
  });

  it('non sceglie un modello di visione o di embedding se c\'è altro', () => {
    expect(pickOllamaModel(['llava:latest', 'nomic-embed-text:latest', 'mistral:7b'])).toBe('mistral:7b');
  });

  it('con soli modelli non testuali prende comunque il primo', () => {
    expect(pickOllamaModel(['llava:latest'])).toBe('llava:latest');
  });
});
