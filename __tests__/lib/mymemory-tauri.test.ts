/**
 * MyMemory dentro l'app Tauri: la richiesta passa dal lato Rust.
 *
 * Fino al 13/11/2026 usava la `fetch` della webview, che verso un dominio
 * esterno fallisce: nell'app il provider non poteva funzionare mai.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock('@/lib/tauri-api', async (orig) => ({ ...(await orig<object>()), isTauri: () => true }));

import { translateWithMyMemory, resetProviderBlocks } from '@/lib/ai/ai-translate-direct';

beforeEach(() => {
  invoke.mockReset();
  resetProviderBlocks();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Failed to fetch'); }));
});

describe('translateWithMyMemory in Tauri', () => {
  it('chiede il testo al comando Rust e non alla fetch della webview', async () => {
    invoke.mockResolvedValue(JSON.stringify({ responseStatus: 200, responseData: { translatedText: 'Nuova partita' } }));

    const out = await translateWithMyMemory('', { texts: ['New Game'], targetLanguage: 'it', sourceLanguage: 'en' });

    expect(out).toEqual(['Nuova partita']);
    expect(invoke).toHaveBeenCalledWith('fetch_url_content', { url: expect.stringContaining('langpair=en|it') });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('un 429 del server resta un limite di richieste', async () => {
    invoke.mockRejectedValue('HTTP 429 per https://api.mymemory.translated.net/get?q=x');

    await expect(
      translateWithMyMemory('', { texts: ['New Game'], targetLanguage: 'it', sourceLanguage: 'en' }),
    ).rejects.toThrow('RateLimit');
  });
});
