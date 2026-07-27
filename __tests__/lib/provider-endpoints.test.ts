/**
 * Endpoint dei provider AI.
 *
 * Il primo blocco è il più importante: congela gli URL che prima erano stringhe
 * letterali dentro ai-translate-direct.ts. Se una base o un path cambiano per
 * sbaglio durante un refactor, qui si vede subito — e senza questi casi il
 * refactor del 26/07 sarebbe stato una modifica non verificabile a quindici
 * chiamate di rete.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_BASES,
  normalizeBaseUrl,
  providerBase,
  providerUrl,
  hasCustomEndpoint,
  listCustomEndpoints,
  type ProviderId,
} from '@/lib/ai/provider-endpoints';

const KEY = 'gameStringerSettings';

function setEndpoints(endpoints: Record<string, string> | null) {
  if (endpoints === null) {
    localStorage.removeItem(KEY);
    return;
  }
  localStorage.setItem(KEY, JSON.stringify({ translation: { endpoints } }));
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('endpoint di default: identici a quelli storici', () => {
  // Copiati dal codice PRIMA del refactor del 26/07/2026.
  const STORICI: [ProviderId, string, string][] = [
    ['deepseek', '/chat/completions', 'https://api.deepseek.com/chat/completions'],
    ['openai', '/chat/completions', 'https://api.openai.com/v1/chat/completions'],
    ['groq', '/chat/completions', 'https://api.groq.com/openai/v1/chat/completions'],
    ['anthropic', '/messages', 'https://api.anthropic.com/v1/messages'],
    ['mistral', '/chat/completions', 'https://api.mistral.ai/v1/chat/completions'],
    ['cohere', '/chat', 'https://api.cohere.com/v2/chat'],
    ['together', '/chat/completions', 'https://api.together.xyz/v1/chat/completions'],
    ['fireworks', '/chat/completions', 'https://api.fireworks.ai/inference/v1/chat/completions'],
    ['openrouter', '/chat/completions', 'https://openrouter.ai/api/v1/chat/completions'],
    ['cerebras', '/chat/completions', 'https://api.cerebras.ai/v1/chat/completions'],
    ['gemini', '/models/gemini-3.1-flash-lite:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'],
  ];

  for (const [provider, path, atteso] of STORICI) {
    it(`${provider} compone l'URL storico`, () => {
      expect(providerUrl(provider, path)).toBe(atteso);
    });
  }

  it('senza override nessun provider risulta personalizzato', () => {
    for (const p of Object.keys(DEFAULT_BASES) as ProviderId[]) {
      expect(hasCustomEndpoint(p)).toBe(false);
    }
    expect(listCustomEndpoints()).toEqual([]);
  });
});

describe('normalizeBaseUrl', () => {
  it('accetta un URL già completo e toglie lo slash finale', () => {
    expect(normalizeBaseUrl('https://gateway.example.com/v1/')).toBe('https://gateway.example.com/v1');
  });

  it('aggiunge https:// quando manca lo schema', () => {
    expect(normalizeBaseUrl('gateway.example.com/v1')).toBe('https://gateway.example.com/v1');
  });

  it('usa http:// per localhost, che è il caso dei proxy locali', () => {
    expect(normalizeBaseUrl('localhost:8080/v1')).toBe('http://localhost:8080/v1');
    expect(normalizeBaseUrl('127.0.0.1:4000')).toBe('http://127.0.0.1:4000');
  });

  // Un host con la porta e senza schema (`mio-proxy.local:8080`) somiglia a un
  // URL con schema, perché anche gli schemi possono contenere punti e trattini.
  // È la forma in cui un proxy aziendale viene scritto davvero, e il rifiuto
  // degli schemi non-http non deve inghiottirla.
  it('accetta host con porta anche senza schema', () => {
    expect(normalizeBaseUrl('mio-proxy.local:8080/v1')).toBe('https://mio-proxy.local:8080/v1');
    expect(normalizeBaseUrl('gateway.interno:3000')).toBe('https://gateway.interno:3000');
  });

  it('tollera spazi intorno', () => {
    expect(normalizeBaseUrl('  https://x.example.com  ')).toBe('https://x.example.com');
  });

  it('scarta query e fragment: una base non li ha', () => {
    expect(normalizeBaseUrl('https://x.example.com/v1?k=1#z')).toBe('https://x.example.com/v1');
  });

  it('rifiuta ciò che non è utilizzabile', () => {
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('   ')).toBeNull();
    expect(normalizeBaseUrl(null)).toBeNull();
    expect(normalizeBaseUrl(undefined)).toBeNull();
    expect(normalizeBaseUrl('ftp://x.example.com')).toBeNull();
    expect(normalizeBaseUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('override dell utente', () => {
  it('un endpoint personalizzato sostituisce il default', () => {
    setEndpoints({ deepseek: 'https://proxy.interno/v1' });
    expect(providerUrl('deepseek', '/chat/completions')).toBe('https://proxy.interno/v1/chat/completions');
    expect(hasCustomEndpoint('deepseek')).toBe(true);
  });

  it('non tocca gli altri provider', () => {
    setEndpoints({ deepseek: 'https://proxy.interno/v1' });
    expect(providerUrl('openai', '/chat/completions')).toBe('https://api.openai.com/v1/chat/completions');
    expect(listCustomEndpoints()).toEqual([{ provider: 'deepseek', base: 'https://proxy.interno/v1' }]);
  });

  it('un override scritto male torna al default invece di far fallire la traduzione', () => {
    setEndpoints({ groq: 'non un url' });
    // "non un url" con lo spazio non è un hostname valido → default
    expect(providerBase('groq')).toBe(DEFAULT_BASES.groq);
  });

  it('sopravvive a settings illeggibili', () => {
    localStorage.setItem(KEY, '{ questo non è json');
    expect(providerUrl('openai', '/chat/completions')).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('ignora una forma inattesa di endpoints', () => {
    localStorage.setItem(KEY, JSON.stringify({ translation: { endpoints: 'stringa' } }));
    expect(providerBase('mistral')).toBe(DEFAULT_BASES.mistral);
  });
});
