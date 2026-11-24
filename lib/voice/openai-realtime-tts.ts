/**
 * Sintesi vocale OpenAI tramite Realtime API.
 *
 * OpenAI spegne tts-1, tts-1-hd e gpt-4o-mini-tts il 6 gennaio 2027. Il
 * sostituto indicato, gpt-realtime-2.1-mini, non funziona su /v1/audio/speech:
 * va usato via Realtime. Flusso (guide OpenAI "Text to speech" e "Realtime
 * WebSocket", 2026-11):
 *   1. POST /v1/realtime/client_secrets con la chiave dell'utente → chiave
 *      effimera (`value`), con la sessione già configurata.
 *   2. WebSocket wss://api.openai.com/v1/realtime con la chiave effimera nel
 *      sottoprotocollo `openai-insecure-api-key.<chiave>`.
 *   3. Dopo `session.created`: conversation.item.create (il testo) e
 *      response.create. L'audio arriva a pezzi in `response.output_audio.delta`
 *      (PCM16 mono 24 kHz in base64), la fine in `response.done`.
 * Il PCM viene avvolto in un WAV, così chi chiama riceve un Blob riproducibile
 * come prima.
 */

export const OPENAI_TTS_MODEL = 'gpt-realtime-2.1-mini';
/** Limiti di `audio.output.speed` nella Realtime API (prima, su tts-1: 0.25–4). */
export const OPENAI_TTS_MIN_SPEED = 0.25;
export const OPENAI_TTS_MAX_SPEED = 1.5;

const CLIENT_SECRETS_URL = 'https://api.openai.com/v1/realtime/client_secrets';
const REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_TTS_MODEL}`;
const SAMPLE_RATE = 24000;

/**
 * fable, nova e onyx esistevano solo per tts-1/tts-1-hd. Profili e
 * impostazioni salvati possono ancora contenerli: li si porta sulla voce
 * Realtime più vicina invece di far fallire la sintesi.
 */
const LEGACY_VOICES: Record<string, string> = { nova: 'coral', fable: 'verse', onyx: 'ash' };

export function toRealtimeVoice(voice: string): string {
  return LEGACY_VOICES[voice] ?? voice;
}

// Il modello è conversazionale: senza istruzioni risponderebbe al testo invece di leggerlo.
const READ_ALOUD_INSTRUCTIONS =
  "You are a text-to-speech engine. Read the user's message aloud exactly as written, word for word, " +
  'in the language it is written in. Do not answer it, translate it, comment on it, or add anything before or after it.';

/** I soli campi degli eventi server che servono qui. */
interface RealtimeServerEvent {
  type?: string;
  delta?: string;
  response?: { status?: string; status_details?: { error?: { message?: string } } };
  error?: { message?: string };
}

export interface OpenAISpeechRequest {
  apiKey: string;
  text: string;
  voice: string;
  speed?: number;
  timeoutMs?: number;
}

export async function synthesizeOpenAISpeech({
  apiKey,
  text,
  voice,
  speed = 1,
  timeoutMs = 60_000,
}: OpenAISpeechRequest): Promise<Blob> {
  const secretResponse = await fetch(CLIENT_SECRETS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: OPENAI_TTS_MODEL,
        instructions: READ_ALOUD_INSTRUCTIONS,
        output_modalities: ['audio'],
        audio: {
          input: { turn_detection: null },
          output: {
            voice: toRealtimeVoice(voice),
            speed: Math.min(OPENAI_TTS_MAX_SPEED, Math.max(OPENAI_TTS_MIN_SPEED, speed)),
            format: { type: 'audio/pcm', rate: SAMPLE_RATE },
          },
        },
      },
    }),
  });

  if (!secretResponse.ok) {
    const err = await secretResponse.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Errore sintesi vocale OpenAI (${secretResponse.status})`);
  }
  const { value: ephemeralKey } = await secretResponse.json();
  if (!ephemeralKey) {
    throw new Error('Errore sintesi vocale OpenAI: chiave di sessione mancante');
  }

  return new Promise<Blob>((resolve, reject) => {
    const ws = new WebSocket(REALTIME_URL, ['realtime', `openai-insecure-api-key.${ephemeralKey}`]);
    const chunks: Uint8Array[] = [];
    let settled = false;

    const finish = (error: Error | null, blob?: Blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      if (error) reject(error);
      else resolve(blob!);
    };

    const timer = setTimeout(() => finish(new Error('Sintesi vocale OpenAI: tempo scaduto')), timeoutMs);

    ws.onmessage = (event: MessageEvent) => {
      let message: RealtimeServerEvent;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }

      switch (message.type) {
        case 'session.created':
          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
          }));
          ws.send(JSON.stringify({ type: 'response.create', response: { output_modalities: ['audio'] } }));
          break;
        case 'response.output_audio.delta':
          if (message.delta) chunks.push(base64ToBytes(message.delta));
          break;
        case 'response.done': {
          const status = message.response?.status;
          if (status !== 'completed') {
            const reason = message.response?.status_details?.error?.message || status;
            finish(new Error(`Sintesi vocale OpenAI non completata: ${reason}`));
          } else if (chunks.length === 0) {
            finish(new Error('Sintesi vocale OpenAI: nessun audio ricevuto'));
          } else {
            finish(null, pcm16ToWav(chunks, SAMPLE_RATE));
          }
          break;
        }
        case 'error':
          finish(new Error(message.error?.message || 'Errore sintesi vocale OpenAI'));
          break;
      }
    };
    ws.onerror = () => finish(new Error('Sintesi vocale OpenAI: connessione non riuscita'));
    ws.onclose = () => finish(new Error('Sintesi vocale OpenAI: connessione chiusa prima della fine'));
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** PCM16 mono little-endian → WAV (intestazione RIFF di 44 byte). */
function pcm16ToWav(chunks: Uint8Array[], sampleRate: number): Blob {
  const dataLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const header = new DataView(new ArrayBuffer(44));
  const writeTag = (offset: number, tag: string) => {
    for (let i = 0; i < 4; i++) header.setUint8(offset + i, tag.charCodeAt(i));
  };
  writeTag(0, 'RIFF');
  header.setUint32(4, 36 + dataLength, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  header.setUint32(16, 16, true); // dimensione blocco fmt
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true); // byte al secondo
  header.setUint16(32, 2, true); // byte per campione
  header.setUint16(34, 16, true); // bit per campione
  writeTag(36, 'data');
  header.setUint32(40, dataLength, true);
  return new Blob([header.buffer, ...chunks], { type: 'audio/wav' });
}
