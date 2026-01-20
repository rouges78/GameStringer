import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { secretsManager } from '@/lib/secrets-manager';

interface TranscribeRequest {
  audioData: string; // Base64 encoded audio
  audioFormat?: string; // 'wav', 'mp3', 'webm', etc.
  language?: string; // Source language hint
  provider?: 'openai' | 'local'; // Whisper provider
}

interface TranscribeResponse {
  text: string;
  language: string;
  confidence: number;
  segments: {
    start: number;
    end: number;
    text: string;
  }[];
  provider: string;
}

export const POST = withErrorHandler(async function(request: NextRequest) {
  try {
    const body: TranscribeRequest = await request.json();
    const { 
      audioData, 
      audioFormat = 'webm', 
      language = 'auto',
      provider = 'openai'
    } = body;

    if (!audioData) {
      throw new ValidationError('Missing required field: audioData');
    }

    logger.info('Transcription request received', 'VOICE_API', {
      audioFormat,
      language,
      provider,
      audioSize: audioData.length
    });

    await secretsManager.initialize();

    let result: TranscribeResponse;

    if (provider === 'openai') {
      result = await transcribeWithWhisperAPI(audioData, audioFormat, language);
    } else {
      // Local Whisper (requires whisper.cpp or similar)
      result = await transcribeWithLocalWhisper(audioData, audioFormat, language);
    }

    logger.info('Transcription completed', 'VOICE_API', {
      textLength: result.text.length,
      language: result.language,
      segmentCount: result.segments.length
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('Transcription failed', 'VOICE_API', { error });
    throw error;
  }
});

async function transcribeWithWhisperAPI(
  audioData: string,
  audioFormat: string,
  language: string
): Promise<TranscribeResponse> {
  const apiKey = secretsManager.get('OPENAI_API_KEY');
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured for Whisper');
  }

  // Decode base64 to buffer
  const audioBuffer = Buffer.from(audioData, 'base64');
  
  // Create form data
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: `audio/${audioFormat}` });
  formData.append('file', blob, `audio.${audioFormat}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  
  if (language !== 'auto') {
    formData.append('language', language);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    text: data.text || '',
    language: data.language || language,
    confidence: 0.95, // Whisper doesn't return confidence
    segments: (data.segments || []).map((seg: any) => ({
      start: seg.start || 0,
      end: seg.end || 0,
      text: seg.text || ''
    })),
    provider: 'openai-whisper'
  };
}

async function transcribeWithLocalWhisper(
  audioData: string,
  audioFormat: string,
  language: string
): Promise<TranscribeResponse> {
  // Placeholder for local Whisper implementation
  // This would use whisper.cpp via Tauri command or local server
  
  logger.warn('Local Whisper not implemented, returning placeholder', 'VOICE_API');
  
  return {
    text: '[Local Whisper not configured - use OpenAI provider]',
    language: language,
    confidence: 0,
    segments: [],
    provider: 'local-whisper'
  };
}

// GET endpoint for info
export async function GET() {
  return NextResponse.json({
    message: 'Voice Transcription API (Whisper)',
    providers: ['openai', 'local'],
    supportedFormats: ['wav', 'mp3', 'webm', 'ogg', 'm4a', 'flac'],
    usage: {
      method: 'POST',
      body: {
        audioData: 'base64 encoded audio (required)',
        audioFormat: 'string (default: webm)',
        language: 'string (default: auto)',
        provider: 'openai | local (default: openai)'
      }
    }
  });
}
