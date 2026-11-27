import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ollamaFetchMock = vi.fn();
vi.mock('@/lib/ai/ollama-http', () => ({
  ollamaFetch: (...args: unknown[]) => ollamaFetchMock(...args),
  OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
}));

import { translateWithFallback, setChainPreset } from '@/lib/ai/ai-translate-direct';

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('Ollama generico nella catena gratuita', () => {
  beforeEach(() => {
    ollamaFetchMock.mockReset();
    setChainPreset('free');
  });

  it('chiede a qwen di non ragionare, così la risposta non arriva vuota', async () => {
    const chatBodies: Record<string, unknown>[] = [];
    ollamaFetchMock.mockImplementation(async (path: string, init?: { body?: string }) => {
      if (path === '/api/tags') return json({ models: [{ name: 'qwen3.5:35b-a3b' }] });
      const body = JSON.parse(init?.body || '{}');
      chatBodies.push(body);
      // Come Ollama vero: senza think:false qwen3.5 spende num_predict nel ragionamento.
      return json({ message: { content: body.think === false ? 'Attivo' : '' } });
    });

    const res = await translateWithFallback({ texts: ['On'], targetLanguage: 'it', sourceLanguage: 'en', semanticRag: 'off' });

    expect(chatBodies[0]?.think).toBe(false);
    expect(res.provider).toBe('ollama');
    expect(res.translations).toEqual(['Attivo']);
  });
});
