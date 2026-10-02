/**
 * Chiavi voce (lib/voice/voice-clone.ts) — bug di Fase 0 #38.
 *
 * Prima le chiavi stavano solo in un oggetto in memoria: quelle inserite in
 * /voice-clone sparivano al riavvio e /dubbing, che non chiama mai setApiKey,
 * falliva con "API key OpenAI non configurata" anche con la chiave nelle
 * Impostazioni. Ora si leggono dallo store centrale (gameStringerSettings) e
 * setApiKey le salva lì.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getApiKeysMock = vi.fn();
const persistMock = vi.fn();

vi.mock('@/lib/ai/ai-translate-direct', () => ({
  getApiKeys: () => getApiKeysMock(),
}));

vi.mock('@/lib/settings-persistence', () => ({
  persistSettingsToDisk: () => persistMock(),
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const LS_KEY = 'gameStringerSettings';

/** Il servizio è un singleton di modulo: per simulare un riavvio va reimportato. */
async function freshService() {
  vi.resetModules();
  return (await import('@/lib/voice/voice-clone')).voiceCloneService;
}

beforeEach(() => {
  localStorage.clear();
  getApiKeysMock.mockReset();
  getApiKeysMock.mockReturnValue({ openai: '' });
  persistMock.mockReset();
  persistMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('voiceCloneService — chiavi dallo store centrale', () => {
  it('OpenAI: usa la chiave delle Impostazioni se nessuno ha chiamato setApiKey', async () => {
    getApiKeysMock.mockReturnValue({ openai: 'sk-settings' });
    const service = await freshService();

    expect(service.getApiKey('openai')).toBe('sk-settings');
  });

  it('setApiKey salva la chiave nello store e sopravvive a un riavvio', async () => {
    const service = await freshService();
    service.setApiKey('elevenlabs', 'xi-123');

    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    expect(stored.voice.elevenlabsKey).toBe('xi-123');
    expect(persistMock).toHaveBeenCalled();

    const afterRestart = await freshService();
    expect(afterRestart.getApiKey('elevenlabs')).toBe('xi-123');
  });

  it('setApiKey non cancella le altre impostazioni', async () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ translation: { apiKey: 'gem' }, voice: { localTtsUrl: 'http://127.0.0.1:8000' } }));
    const service = await freshService();
    service.setApiKey('openai', 'sk-voice');

    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    expect(stored.translation.apiKey).toBe('gem');
    expect(stored.voice).toEqual({ localTtsUrl: 'http://127.0.0.1:8000', openaiKey: 'sk-voice' });
  });

  it('la sintesi OpenAI (usata da /dubbing) parte con la chiave delle Impostazioni', async () => {
    getApiKeysMock.mockReturnValue({ openai: 'sk-settings' });
    const fetchMock = vi.fn(async () => new Response(new Blob(['mp3']), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(() => 'blob:x'); // jsdom non lo implementa
    const service = await freshService();

    await service.synthesize({
      text: 'Ciao',
      voiceProfile: {
        id: 'default', name: 'Default', provider: 'openai', voiceId: 'alloy',
        settings: { stability: 0.5, similarityBoost: 0.75 }, createdAt: '',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-settings');
  });

  it('senza chiave da nessuna parte fallisce prima della rete', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = await freshService();

    await expect(service.synthesize({
      text: 'Ciao',
      voiceProfile: {
        id: 'default', name: 'Default', provider: 'elevenlabs', voiceId: 'v1',
        settings: { stability: 0.5, similarityBoost: 0.75 }, createdAt: '',
      },
    })).rejects.toThrow(/ElevenLabs non configurata/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
