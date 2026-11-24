/**
 * Sintesi vocale OpenAI via Realtime API (lib/voice/openai-realtime-tts.ts).
 *
 * tts-1 e tts-1-hd si spengono il 6 gennaio 2027; il sostituto
 * gpt-realtime-2.1-mini funziona solo via Realtime. Qui si simula il server:
 * chiave effimera via fetch, poi gli eventi WebSocket.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { synthesizeOpenAISpeech, toRealtimeVoice, OPENAI_TTS_MODEL } from '@/lib/voice/openai-realtime-tts';

class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public url: string, public protocols: string[]) {
    FakeWebSocket.last = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  /** Evento dal server. */
  emit(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

const fetchMock = vi.fn();

function secretOk(value = 'ek_test') {
  return new Response(JSON.stringify({ value, expires_at: 0 }), { status: 200 });
}

/** Attende che il WebSocket venga aperto (dopo la fetch della chiave effimera). */
async function socket(): Promise<FakeWebSocket> {
  await vi.waitFor(() => expect(FakeWebSocket.last).not.toBeNull());
  return FakeWebSocket.last!;
}

/** jsdom non implementa Blob.arrayBuffer(). */
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

const pcmBase64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

beforeEach(() => {
  FakeWebSocket.last = null;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('synthesizeOpenAISpeech', () => {
  it('chiede la chiave effimera con la sessione configurata e non usa più /v1/audio/speech', async () => {
    fetchMock.mockImplementation(async () => secretOk());
    const promise = synthesizeOpenAISpeech({ apiKey: 'sk-user', text: 'Ciao', voice: 'nova', speed: 3 });
    const ws = await socket();
    ws.emit({ type: 'session.created' });
    ws.emit({ type: 'response.output_audio.delta', delta: pcmBase64([1, 0]) });
    ws.emit({ type: 'response.done', response: { status: 'completed' } });
    await promise;

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/realtime/client_secrets');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-user');
    const { session } = JSON.parse(init.body as string);
    expect(session.model).toBe(OPENAI_TTS_MODEL);
    expect(session.output_modalities).toEqual(['audio']);
    expect(session.audio.input.turn_detection).toBeNull();
    expect(session.audio.output.voice).toBe('coral'); // nova non esiste in Realtime
    expect(session.audio.output.speed).toBe(1.5); // limite Realtime
  });

  it('apre il WebSocket con la chiave effimera, mai con quella dell utente', async () => {
    fetchMock.mockImplementation(async () => secretOk('ek_abc'));
    const promise = synthesizeOpenAISpeech({ apiKey: 'sk-user', text: 'Ciao', voice: 'alloy' });
    const ws = await socket();

    expect(ws.url).toBe(`wss://api.openai.com/v1/realtime?model=${OPENAI_TTS_MODEL}`);
    expect(ws.protocols).toEqual(['realtime', 'openai-insecure-api-key.ek_abc']);
    expect(ws.protocols.join()).not.toContain('sk-user');

    ws.emit({ type: 'error', error: { message: 'stop' } });
    await expect(promise).rejects.toThrow('stop');
  });

  it('invia il testo dopo session.created e restituisce un WAV con tutto l audio ricevuto', async () => {
    fetchMock.mockImplementation(async () => secretOk());
    const promise = synthesizeOpenAISpeech({ apiKey: 'sk-user', text: 'Ciao mondo', voice: 'marin' });
    const ws = await socket();

    expect(ws.sent).toHaveLength(0);
    ws.emit({ type: 'session.created' });
    expect(ws.sent[0]).toEqual({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Ciao mondo' }] },
    });
    expect(ws.sent[1].type).toBe('response.create');

    ws.emit({ type: 'response.output_audio.delta', delta: pcmBase64([1, 2, 3, 4]) });
    ws.emit({ type: 'response.output_audio.delta', delta: pcmBase64([5, 6]) });
    ws.emit({ type: 'response.done', response: { status: 'completed' } });

    const blob = await promise;
    expect(blob.type).toBe('audio/wav');
    const bytes = new Uint8Array(await readBlob(blob));
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(40, true)).toBe(6);
    expect([...bytes.slice(44)]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ws.closed).toBe(true);
  });

  it('fallisce con il messaggio di OpenAI se la chiave effimera viene rifiutata', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), { status: 401 }));

    await expect(synthesizeOpenAISpeech({ apiKey: 'sk-bad', text: 'Ciao', voice: 'alloy' }))
      .rejects.toThrow('Incorrect API key');
    expect(FakeWebSocket.last).toBeNull();
  });

  it('fallisce se la risposta non è completata o non contiene audio', async () => {
    fetchMock.mockImplementation(async () => secretOk());
    const failed = synthesizeOpenAISpeech({ apiKey: 'sk-user', text: 'Ciao', voice: 'alloy' });
    const ws1 = await socket();
    ws1.emit({ type: 'response.done', response: { status: 'failed', status_details: { error: { message: 'quota' } } } });
    await expect(failed).rejects.toThrow('quota');

    FakeWebSocket.last = null;
    const empty = synthesizeOpenAISpeech({ apiKey: 'sk-user', text: 'Ciao', voice: 'alloy' });
    const ws2 = await socket();
    ws2.emit({ type: 'response.done', response: { status: 'completed' } });
    await expect(empty).rejects.toThrow(/nessun audio/);
  });

  it('fallisce se la connessione si chiude prima della fine', async () => {
    fetchMock.mockImplementation(async () => secretOk());
    const promise = synthesizeOpenAISpeech({ apiKey: 'sk-user', text: 'Ciao', voice: 'alloy' });
    const ws = await socket();
    ws.onclose?.();
    await expect(promise).rejects.toThrow(/chiusa/);
  });
});

describe('toRealtimeVoice', () => {
  it('porta le voci solo-tts-1 su voci Realtime e lascia le altre', () => {
    expect(toRealtimeVoice('nova')).toBe('coral');
    expect(toRealtimeVoice('fable')).toBe('verse');
    expect(toRealtimeVoice('onyx')).toBe('ash');
    expect(toRealtimeVoice('alloy')).toBe('alloy');
    expect(toRealtimeVoice('marin')).toBe('marin');
  });
});
