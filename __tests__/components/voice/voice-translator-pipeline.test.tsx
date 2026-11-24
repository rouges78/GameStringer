/**
 * "Esegui pipeline completa" del Voice Translator — bug di Fase 0 #41.
 *
 * Prima il bottone chiamava solo transcribeAudio(): traduzione e audio non
 * partivano mai. Ora i tre passi sono concatenati, ognuno riceve il risultato
 * del precedente (non lo `state` vecchio della closure) e la catena si ferma
 * al primo errore.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const translateMock = vi.fn();
const synthMock = vi.fn();

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'it' }),
}));

vi.mock('@/lib/ai/ai-translate-direct', () => ({
  getApiKeys: () => ({ openai: 'sk-test' }),
  translateWithFallback: (...args: unknown[]) => translateMock(...args),
}));

vi.mock('@/lib/voice/openai-realtime-tts', () => ({
  OPENAI_TTS_MAX_SPEED: 1.5,
  synthesizeOpenAISpeech: (...args: unknown[]) => synthMock(...args),
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { VoiceTranslator } from '@/components/voice/voice-translator';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

const fetchMock = vi.fn();

function whisperOk(text: string) {
  return new Response(JSON.stringify({ text, segments: [] }), { status: 200 });
}

async function loadAudioAndRunPipeline() {
  const { container } = render(<VoiceTranslator />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['abc'], 'clip.webm', { type: 'audio/webm' })] } });
  const button = await screen.findByText('voiceTranslator.runFullPipeline');
  fireEvent.click(button);
}

function callsTo(url: string) {
  return fetchMock.mock.calls.filter(([u]) => u === url);
}

beforeEach(() => {
  translateMock.mockReset();
  synthMock.mockReset();
  synthMock.mockResolvedValue(new Blob(['wav'], { type: 'audio/wav' }));
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:x'); // jsdom non lo implementa
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VoiceTranslator — pipeline completa', () => {
  it('trascrive, traduce e genera l audio passando i risultati da un passo all altro', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === WHISPER_URL ? whisperOk('Hello') : new Response('{}', { status: 404 }));
    translateMock.mockResolvedValue({ translations: ['Ciao'], provider: 'gemini', success: true });

    await loadAudioAndRunPipeline();

    await waitFor(() => expect(synthMock).toHaveBeenCalledTimes(1));
    expect(callsTo(WHISPER_URL)).toHaveLength(1);
    expect(translateMock).toHaveBeenCalledWith(expect.objectContaining({ texts: ['Hello'], targetLanguage: 'it' }));
    expect(synthMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-test', text: 'Ciao' }));
  });

  it('si ferma se la trascrizione fallisce', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }));

    await loadAudioAndRunPipeline();

    expect(await screen.findByText('quota')).toBeInTheDocument();
    expect(translateMock).not.toHaveBeenCalled();
    expect(synthMock).not.toHaveBeenCalled();
  });

  it('si ferma se nessun provider traduce, invece di leggere il testo originale come tradotto', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === WHISPER_URL ? whisperOk('Hello') : new Response('{}', { status: 404 }));
    translateMock.mockResolvedValue({ translations: ['Hello'], provider: 'none', success: false });

    await loadAudioAndRunPipeline();

    expect(await screen.findByText('voiceTranslator.translationError')).toBeInTheDocument();
    expect(synthMock).not.toHaveBeenCalled();
  });

  it('nessun parlato riconosciuto: lo dice e non traduce', async () => {
    fetchMock.mockImplementation(async () => whisperOk('   '));

    await loadAudioAndRunPipeline();

    expect(await screen.findByText('voiceTranslator.noSpeechDetected')).toBeInTheDocument();
    expect(translateMock).not.toHaveBeenCalled();
  });
});
