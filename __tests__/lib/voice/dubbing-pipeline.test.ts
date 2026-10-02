/**
 * Test della pipeline di doppiaggio (lib/voice/dubbing-pipeline.ts).
 *
 * Fissa il bug di Fase 0 #11: nel desktop ogni segmento veniva saltato in
 * trascrizione senza contarlo come errore, e la pipeline annunciava "Dubbing
 * completato! 0 file audio patchati" con un toast verde. Qui: un segmento che
 * non produce nulla è un errore, `success` è vero solo se almeno un file è
 * stato patchato, e i sottotitoli usano le durate reali.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const invokeMock = vi.fn();
const translateMock = vi.fn();
const getApiKeysMock = vi.fn();
const synthesizeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@/lib/ai/ai-translate-direct', () => ({
  translateWithFallback: (...args: unknown[]) => translateMock(...args),
  getApiKeys: () => getApiKeysMock(),
}));

vi.mock('@/lib/voice/voice-clone', () => ({
  voiceCloneService: { synthesize: (...args: unknown[]) => synthesizeMock(...args) },
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Testo del motivo fisso, indipendente dalle traduzioni.
vi.mock('@/lib/i18n/t-static', () => ({
  tStatic: (key: string) => ({
    'dubbingPage.patchFormatMismatch': 'formato {actual} su .{expected}',
    'dubbingPage.noCompatibleAudio': 'nessun MP3 tra {count} file',
  }[key] ?? key),
}));

import { DubbingPipeline, detectAudioFormat, type DubbingConfig, type DubbingProgress } from '@/lib/voice/dubbing-pipeline';

/** La sintesi produce MP3: solo i file .mp3 del gioco sono sostituibili. */
const FILES = [
  { path: 'C:/game/a.mp3', name: 'a.mp3', size_bytes: 100 },
  { path: 'C:/game/b.mp3', name: 'b.mp3', size_bytes: 50 },
];

/** Intestazioni minime: bastano al riconoscimento dai magic number. */
const WAV = 'RIFF\0\0\0\0WAVEfmt ';
const MP3 = 'ID3\x04\0\0\0\0\0\0';

/** Nei test l'utente conferma sempre, salvo dove si prova il rifiuto. */
const confirmAll = async () => true;

function config(overrides: Partial<DubbingConfig> = {}): DubbingConfig {
  return {
    gamePath: 'C:/game',
    gameName: 'Game',
    sourceLanguage: 'en',
    targetLanguage: 'it',
    ttsProvider: 'openai',
    sttProvider: 'openai_whisper',
    defaultVoice: 'alloy',
    enableLipSync: false,
    enableSubtitles: true,
    subtitleFormat: 'srt',
    durationMatching: false,
    batchSize: 5,
    ...overrides,
  };
}

function whisperResponse(text: string, duration: number) {
  return new Response(
    JSON.stringify({ text, language: 'english', duration, segments: [{ avg_logprob: -0.1 }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  invokeMock.mockReset();
  translateMock.mockReset();
  getApiKeysMock.mockReset();
  synthesizeMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);

  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'scan_game_audio_files') return FILES;
    if (cmd === 'read_binary_file_base64') return btoa('RIFFfakeaudio');
    if (cmd === 'replace_audio_file') return true;
    throw new Error(`comando inatteso: ${cmd}`);
  });
  getApiKeysMock.mockReturnValue({ openai: 'sk-test' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DubbingPipeline — esiti onesti', () => {
  it('senza chiave OpenAI ogni segmento è un errore e non c è successo', async () => {
    getApiKeysMock.mockReturnValue({ openai: '' });
    const updates: DubbingProgress[] = [];

    const result = await new DubbingPipeline(config()).run(p => updates.push(p), confirmAll);

    expect(result.success).toBe(false);
    expect(result.stats.errors).toBe(2);
    expect(result.stats.patched).toBe(0);
    const transcribe = result.steps.find(s => s.id === 'transcribe')!;
    expect(transcribe.status).toBe('failed');
    expect(transcribe.error).toMatch(/OpenAI API key/);
    // La pipeline si ferma al passo fallito: i successivi non diventano verdi.
    expect(result.steps.find(s => s.id === 'translate')!.status).toBe('pending');
    expect(result.steps.find(s => s.id === 'patch')!.status).toBe('pending');
    expect(fetchMock).not.toHaveBeenCalled();
    // L'ultimo aggiornamento dice alla UI che la pipeline non è più in corso.
    expect(updates[updates.length - 1].isRunning).toBe(false);
  });

  it('Groq Whisper non collegato: fallisce dichiarandolo invece di saltare in silenzio', async () => {
    const result = await new DubbingPipeline(config({ sttProvider: 'groq_whisper' })).run(undefined, confirmAll);

    expect(result.success).toBe(false);
    expect(result.stats.errors).toBe(2);
    expect(result.steps.find(s => s.id === 'transcribe')!.error).toMatch(/groq_whisper/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nessun file audio: il passo di scansione fallisce, niente successo', async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === 'scan_game_audio_files' ? [] : undefined));

    const result = await new DubbingPipeline(config()).run(undefined, confirmAll);

    expect(result.success).toBe(false);
    expect(result.steps.find(s => s.id === 'scan')!.status).toBe('failed');
  });

  it('traduzione senza provider: i segmenti contano come errori', async () => {
    fetchMock.mockImplementation(async () => whisperResponse('Hello', 2));
    translateMock.mockResolvedValue({ translations: ['Hello', 'Hello'], provider: 'none', success: false });

    const result = await new DubbingPipeline(config()).run(undefined, confirmAll);

    expect(result.stats.transcribed).toBe(2);
    expect(result.stats.translated).toBe(0);
    expect(result.stats.errors).toBe(2);
    expect(result.success).toBe(false);
    expect(result.steps.find(s => s.id === 'translate')!.status).toBe('failed');
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it('percorso completo: Whisper vero, file patchati e sottotitoli dalle durate reali', async () => {
    fetchMock
      .mockImplementationOnce(async () => whisperResponse('Hello', 2.5))
      .mockImplementationOnce(async () => whisperResponse('World', 4));
    translateMock.mockResolvedValue({ translations: ['Ciao', 'Mondo'], provider: 'gemini', success: true });
    synthesizeMock
      .mockResolvedValueOnce({ audioUrl: 'blob:1', audioBlob: new Blob([MP3 + 'aaa']), duration: 2, characterCount: 4, provider: 'openai' })
      .mockResolvedValueOnce({ audioUrl: 'blob:2', audioBlob: new Blob([MP3 + 'bbb']), duration: 3.25, characterCount: 5, provider: 'openai' });

    const result = await new DubbingPipeline(config()).run(undefined, confirmAll);

    // Trascrizione: la stessa chiamata Whisper di voice-translator, mai /api/.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
      expect((init as RequestInit).headers).toEqual({ Authorization: 'Bearer sk-test' });
    }

    expect(result.success).toBe(true);
    expect(result.stats.patched).toBe(2);
    expect(result.stats.errors).toBe(0);
    expect(result.stats.avgTranscriptionConfidence).toBeCloseTo(Math.exp(-0.1));

    // Il patch scrive l'audio sintetizzato (dal Blob, senza fetch del blob: URL).
    const patches = invokeMock.mock.calls.filter(([cmd]) => cmd === 'replace_audio_file');
    expect(patches).toEqual([
      ['replace_audio_file', { originalPath: 'C:/game/a.mp3', newAudioBase64: btoa(MP3 + 'aaa') }],
      ['replace_audio_file', { originalPath: 'C:/game/b.mp3', newAudioBase64: btoa(MP3 + 'bbb') }],
    ]);

    // Sottotitoli: durate dell'audio doppiato, una battuta dopo l'altra (prima 5 s fissi).
    expect(result.subtitleFile).toBe(
      '1\n00:00:00,000 --> 00:00:02,000\nCiao\n\n2\n00:00:02,000 --> 00:00:05,250\nMondo\n',
    );
  });

  it('annullare durante la pausa chiude la pipeline senza altre chiamate Whisper', async () => {
    const pipeline = new DubbingPipeline(config());
    pipeline.pause();
    const running = pipeline.run(undefined, confirmAll);
    await new Promise(r => setTimeout(r, 20));
    pipeline.abort();

    const result = await running;

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.steps.find(s => s.id === 'translate')!.status).toBe('pending');
  });

  it('file senza parlato: segmento saltato, non tradotto né contato come patchato', async () => {
    fetchMock
      .mockImplementationOnce(async () => whisperResponse('', 30))
      .mockImplementationOnce(async () => whisperResponse('Hello', 2));
    translateMock.mockResolvedValue({ translations: ['Ciao'], provider: 'gemini', success: true });
    synthesizeMock.mockResolvedValue({ audioUrl: 'blob:1', audioBlob: new Blob([MP3 + 'aaa']), duration: 2, characterCount: 4, provider: 'openai' });

    const result = await new DubbingPipeline(config()).run(undefined, confirmAll);

    expect(result.stats.skipped).toBe(1);
    expect(result.stats.patched).toBe(1);
    expect(result.segments[0].status).toBe('skipped');
    expect(translateMock).toHaveBeenCalledWith(expect.objectContaining({ texts: ['Hello'] }));
  });
});

describe('DubbingPipeline — conferma prima delle chiamate a pagamento', () => {
  it('mostra numero e dimensione dei file; se l utente rifiuta non parte nessuna chiamata', async () => {
    const confirm = vi.fn(async () => false);

    const result = await new DubbingPipeline(config()).run(undefined, confirm);

    expect(confirm).toHaveBeenCalledWith({ fileCount: 2, totalBytes: 150 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(invokeMock.mock.calls.map(([cmd]) => cmd)).toEqual(['scan_game_audio_files']);
    expect(result.success).toBe(false);
    expect(result.steps.find(s => s.id === 'transcribe')!.status).toBe('pending');
  });
});

describe('DubbingPipeline — formato dell audio sintetizzato', () => {
  function fullRun(files: typeof FILES) {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'scan_game_audio_files') return files;
      if (cmd === 'read_binary_file_base64') return btoa('RIFFfakeaudio');
      if (cmd === 'replace_audio_file') return true;
      throw new Error(`comando inatteso: ${cmd}`);
    });
    fetchMock.mockImplementation(async () => whisperResponse('Hello', 2));
    translateMock.mockResolvedValue({ translations: ['Ciao', 'Ciao'], provider: 'gemini', success: true });
    // I provider TTS restituiscono MP3.
    synthesizeMock.mockImplementation(async () => ({ audioUrl: 'blob:x', audioBlob: new Blob([MP3 + 'aaa']), duration: 2, characterCount: 4, provider: 'openai' }));
    return new DubbingPipeline(config()).run(undefined, confirmAll);
  }

  it('solo file .wav: esclusi alla scansione, nessuna chiamata a pagamento né sostituzione', async () => {
    const confirm = vi.fn(async () => true);
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'scan_game_audio_files') return [
        { path: 'C:/game/a.wav', name: 'a.wav', size_bytes: 100 },
        { path: 'C:/game/b.wav', name: 'b.wav', size_bytes: 50 },
      ];
      throw new Error(`comando inatteso: ${cmd}`);
    });

    const result = await new DubbingPipeline(config()).run(undefined, confirm);

    expect(confirm).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(synthesizeMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.stats.errors).toBe(2);
    expect(result.segments.map(s => s.error)).toEqual(['formato MP3 su .wav', 'formato MP3 su .wav']);
    const scan = result.steps.find(s => s.id === 'scan')!;
    expect(scan.status).toBe('failed');
    expect(scan.error).toBe('nessun MP3 tra 2 file');
  });

  it('file misti: si trascrive e si patcha solo il .mp3, il .wav resta intatto e conta come errore', async () => {
    const confirm = vi.fn(async () => true);
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'scan_game_audio_files') return [
        { path: 'C:/game/a.MP3', name: 'a.MP3', size_bytes: 100 },
        { path: 'C:/game/b.wav', name: 'b.wav', size_bytes: 50 },
      ];
      if (cmd === 'read_binary_file_base64') return btoa('ID3fakeaudio');
      if (cmd === 'replace_audio_file') return true;
      throw new Error(`comando inatteso: ${cmd}`);
    });
    fetchMock.mockImplementation(async () => whisperResponse('Hello', 2));
    translateMock.mockResolvedValue({ translations: ['Ciao'], provider: 'gemini', success: true });
    synthesizeMock.mockResolvedValue({ audioUrl: 'blob:x', audioBlob: new Blob([MP3 + 'aaa']), duration: 2, characterCount: 4, provider: 'openai' });

    const result = await new DubbingPipeline(config()).run(undefined, confirm);

    // La conferma e le chiamate Whisper riguardano solo il file sostituibile.
    expect(confirm).toHaveBeenCalledWith({ fileCount: 1, totalBytes: 100 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(invokeMock.mock.calls.filter(([cmd]) => cmd === 'replace_audio_file')).toEqual([
      ['replace_audio_file', { originalPath: 'C:/game/a.MP3', newAudioBase64: btoa(MP3 + 'aaa') }],
    ]);
    expect(result.stats.patched).toBe(1);
    expect(result.stats.errors).toBe(1);
    expect(result.segments[1].status).toBe('error');
  });

  it('se la sintesi restituisce un formato diverso dal file, la sostituzione è rifiutata al patch', async () => {
    const result = await fullRun(FILES);
    // fullRun sintetizza MP3: qui si forza un WAV per provare il controllo sui magic number.
    expect(result.success).toBe(true);

    invokeMock.mockClear();
    synthesizeMock.mockImplementation(async () => ({ audioUrl: 'blob:x', audioBlob: new Blob([WAV + 'aaa']), duration: 2, characterCount: 4, provider: 'openai' }));
    const mismatch = await new DubbingPipeline(config()).run(undefined, confirmAll);

    expect(invokeMock.mock.calls.filter(([cmd]) => cmd === 'replace_audio_file')).toEqual([]);
    expect(mismatch.success).toBe(false);
    expect(mismatch.stats.patched).toBe(0);
    expect(mismatch.segments.map(s => s.error)).toEqual(['formato WAV su .mp3', 'formato WAV su .mp3']);
    expect(mismatch.steps.find(s => s.id === 'patch')!.status).toBe('failed');
  });
});

describe('detectAudioFormat', () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  const text = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));

  it('riconosce i formati dai magic number', () => {
    expect(detectAudioFormat(text(MP3))).toBe('mp3');
    expect(detectAudioFormat(bytes(0xFF, 0xFB, 0x90, 0x00))).toBe('mp3');
    expect(detectAudioFormat(bytes(0xFF, 0xF3, 0x48, 0xC4))).toBe('mp3');
    expect(detectAudioFormat(text(WAV))).toBe('wav');
    expect(detectAudioFormat(text('OggS\0\x02'))).toBe('ogg');
    expect(detectAudioFormat(text('fLaC\0\0\0\x22'))).toBe('flac');
  });

  it('null per ciò che non è uno dei quattro formati', () => {
    expect(detectAudioFormat(bytes())).toBeNull();
    expect(detectAudioFormat(text('aaa'))).toBeNull();
    expect(detectAudioFormat(text('RIFF\0\0\0\0AVI LIST'))).toBeNull();
    // AAC ADTS: stesso sync dell'MP3 ma layer 00.
    expect(detectAudioFormat(bytes(0xFF, 0xF1, 0x50, 0x80))).toBeNull();
  });
});
