import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { secretsManager } from '@/lib/secrets-manager';

interface TTSRequest {
  text: string;
  voice?: string; // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
  speed?: number; // 0.25 to 4.0
  language?: string;
  provider?: 'openai' | 'edge' | 'local';
}

interface TTSResponse {
  audioData: string; // Base64 encoded audio
  audioFormat: string;
  duration?: number;
  provider: string;
}

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

export const POST = withErrorHandler(async function(request: NextRequest) {
  try {
    const body: TTSRequest = await request.json();
    const { 
      text, 
      voice = 'nova',
      speed = 1.0,
      language = 'en',
      provider = 'openai'
    } = body;

    if (!text) {
      throw new ValidationError('Missing required field: text');
    }

    if (text.length > 4096) {
      throw new ValidationError('Text too long. Maximum 4096 characters.');
    }

    logger.info('TTS request received', 'VOICE_API', {
      textLength: text.length,
      voice,
      speed,
      provider
    });

    await secretsManager.initialize();

    let result: TTSResponse;

    switch (provider) {
      case 'openai':
        result = await synthesizeWithOpenAI(text, voice, speed);
        break;
      case 'edge':
        result = await synthesizeWithEdgeTTS(text, voice, language);
        break;
      default:
        result = await synthesizeWithOpenAI(text, voice, speed);
    }

    logger.info('TTS completed', 'VOICE_API', {
      audioSize: result.audioData.length,
      provider: result.provider
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('TTS failed', 'VOICE_API', { error });
    throw error;
  }
});

async function synthesizeWithOpenAI(
  text: string,
  voice: string,
  speed: number
): Promise<TTSResponse> {
  const apiKey = secretsManager.get('OPENAI_API_KEY');
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured for TTS');
  }

  const validVoice = OPENAI_VOICES.includes(voice) ? voice : 'nova';

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: validVoice,
      speed: Math.max(0.25, Math.min(4.0, speed)),
      response_format: 'mp3'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error: ${response.status} - ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const audioData = Buffer.from(audioBuffer).toString('base64');

  return {
    audioData,
    audioFormat: 'mp3',
    provider: 'openai-tts'
  };
}

async function synthesizeWithEdgeTTS(
  text: string,
  voice: string,
  language: string
): Promise<TTSResponse> {
  // Edge TTS is free and works offline with Microsoft Edge voices
  // This would require a local server or Tauri command
  
  // Map language to Edge voice
  const edgeVoices: Record<string, string> = {
    'it': 'it-IT-ElsaNeural',
    'en': 'en-US-JennyNeural',
    'de': 'de-DE-KatjaNeural',
    'es': 'es-ES-ElviraNeural',
    'fr': 'fr-FR-DeniseNeural',
    'ja': 'ja-JP-NanamiNeural',
    'ko': 'ko-KR-SunHiNeural',
    'zh': 'zh-CN-XiaoxiaoNeural'
  };

  logger.warn('Edge TTS not fully implemented, falling back to OpenAI', 'VOICE_API');
  
  // Fallback to OpenAI for now
  return synthesizeWithOpenAI(text, 'nova', 1.0);
}

// GET endpoint for available voices
export async function GET() {
  return NextResponse.json({
    message: 'Text-to-Speech API',
    providers: {
      openai: {
        voices: OPENAI_VOICES,
        description: 'High quality neural voices',
        requiresApiKey: true
      },
      edge: {
        voices: ['auto'],
        description: 'Free Microsoft Edge voices (local)',
        requiresApiKey: false
      }
    },
    limits: {
      maxTextLength: 4096,
      speedRange: [0.25, 4.0]
    },
    usage: {
      method: 'POST',
      body: {
        text: 'string (required)',
        voice: 'string (default: nova)',
        speed: 'number (default: 1.0)',
        language: 'string (default: en)',
        provider: 'openai | edge (default: openai)'
      }
    }
  });
}
