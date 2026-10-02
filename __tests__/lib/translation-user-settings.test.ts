/**
 * Temperatura e «Prompt personalizzato» delle Impostazioni arrivano davvero ai
 * provider (lib/ai/ai-translate-direct.ts).
 *
 * Fino al 01/10/2026 erano controlli placebo: lo slider della temperatura
 * salvava `translation.temperature` e ogni provider mandava 0.3 fisso; la card
 * del prompt personalizzato salvava `gs_custom_prompt_settings` e nessuno la
 * leggeva, anche se il prompt builder sapeva già usare persona/tono/istruzioni.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const posts: { url: string; body: Record<string, unknown> }[] = [];

vi.mock('@/lib/ai/http-proxy', () => ({
  httpPostJson: vi.fn(async (url: string, _headers: Record<string, string>, body: string) => {
    posts.push({ url, body: JSON.parse(body) });
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '["Ciao mondo"]' }] } }] }),
      text: async () => '',
    };
  }),
}));

// Il secondo passaggio (reflection) e i contesti RAG non c'entrano: li si spegne.
vi.mock('@/lib/ai/reflection-translator', () => ({
  maybeReflect: vi.fn(async (input: { translations: string[] }) => ({
    translations: input.translations,
    candidates: 0,
    refined: 0,
    repaired: 0,
  })),
}));
vi.mock('@/lib/ai/semantic-retriever', () => ({ getSemanticContext: vi.fn(async () => '') }));
vi.mock('@/lib/translation-memory', () => {
  throw new Error('TM non disponibile nel test');
});
vi.mock('@/lib/tm-network', () => ({
  getTMNetworkConfig: () => ({ enabled: false, pullOnTranslate: false }),
  lookupSharedTM: vi.fn(async () => new Map()),
}));

import {
  getUserTemperature,
  withStoredCustomPrompt,
  translateWithFallback,
  setChainPreset,
  resetProviderBlocks,
} from '@/lib/ai/ai-translate-direct';

const SETTINGS = 'gameStringerSettings';
const PROMPT = 'gs_custom_prompt_settings';

function setSettings(translation: Record<string, unknown>) {
  localStorage.setItem(SETTINGS, JSON.stringify({ translation }));
}

beforeEach(() => {
  localStorage.clear();
  posts.length = 0;
  resetProviderBlocks();
});

describe('getUserTemperature', () => {
  it('senza impostazioni resta 0.3, il valore storico', () => {
    expect(getUserTemperature()).toBe(0.3);
  });

  it('legge translation.temperature', () => {
    setSettings({ temperature: 0.7 });
    expect(getUserTemperature()).toBe(0.7);
  });

  it('tiene il valore tra 0 e 1 (oltre, alcuni provider rispondono 400)', () => {
    setSettings({ temperature: 1.8 });
    expect(getUserTemperature()).toBe(1);
    setSettings({ temperature: -2 });
    expect(getUserTemperature()).toBe(0);
  });

  it('un valore non numerico non passa', () => {
    setSettings({ temperature: '0.9' });
    expect(getUserTemperature()).toBe(0.3);
  });
});

describe('withStoredCustomPrompt', () => {
  const base = { texts: ['Hello'], targetLanguage: 'it' };

  it('card mai salvata o spenta: nessun cambiamento', () => {
    expect(withStoredCustomPrompt(base)).toBe(base);
    localStorage.setItem(PROMPT, JSON.stringify({ enabled: false, persona: 'a pirate captain' }));
    expect(withStoredCustomPrompt(base)).toBe(base);
  });

  it('card attiva: persona, tono e istruzioni entrano nelle opzioni', () => {
    localStorage.setItem(
      PROMPT,
      JSON.stringify({ enabled: true, persona: 'a pirate captain', tone: 'formal', customPrompt: '  Use archaic words.  ' }),
    );
    const out = withStoredCustomPrompt(base);
    expect(out.persona).toBe('a pirate captain');
    expect(out.tone).toBe('formal');
    expect(out.customPrompt).toBe('Use archaic words.');
  });

  it('quello che passa il chiamante vince, i campi vuoti non entrano', () => {
    localStorage.setItem(PROMPT, JSON.stringify({ enabled: true, persona: 'a pirate captain', tone: '', customPrompt: '   ' }));
    const out = withStoredCustomPrompt({ ...base, persona: 'a noble lady' });
    expect(out.persona).toBe('a noble lady');
    expect(out.tone).toBeUndefined();
    expect(out.customPrompt).toBeUndefined();
  });

  it('JSON rotto: nessun cambiamento', () => {
    localStorage.setItem(PROMPT, '{rotto');
    expect(withStoredCustomPrompt(base)).toBe(base);
  });
});

describe('translateWithFallback: le impostazioni arrivano alla richiesta', () => {
  it('la temperatura scelta e la persona finiscono nel corpo mandato a Gemini', async () => {
    setSettings({ apiKey: 'gemini-test-key', temperature: 0.8 });
    setChainPreset('long_context'); // primo provider: Gemini 3.1 Flash-Lite
    localStorage.setItem(PROMPT, JSON.stringify({ enabled: true, persona: 'a pirate captain', tone: 'sarcastic' }));

    const res = await translateWithFallback({ texts: ['Hello world'], targetLanguage: 'it', sourceLanguage: 'en' });

    expect(res.success).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
    const { body } = posts[0];
    const config = body.generationConfig as { temperature: number };
    expect(config.temperature).toBe(0.8);
    const prompt = JSON.stringify(body.contents);
    expect(prompt).toContain('Translate as if you are a pirate captain');
    expect(prompt).toContain('Use a sarcastic tone');
  });

  it('senza impostazioni la richiesta resta quella di prima (0.3, nessuna persona)', async () => {
    setSettings({ apiKey: 'gemini-test-key' });
    setChainPreset('long_context');

    await translateWithFallback({ texts: ['Hello world'], targetLanguage: 'it', sourceLanguage: 'en' });

    const { body } = posts[0];
    expect((body.generationConfig as { temperature: number }).temperature).toBe(0.3);
    expect(JSON.stringify(body.contents)).not.toContain('Persona:');
  });
});
