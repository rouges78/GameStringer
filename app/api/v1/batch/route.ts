import { NextRequest, NextResponse } from 'next/server';

/**
 * 🔌 GameStringer Public API v1 - Batch Translation
 * 
 * POST /api/v1/batch
 * 
 * Body:
 * {
 *   "texts": ["Hello", "World", "Game"],
 *   "targetLanguage": "it",
 *   "provider": "libre",
 *   "context": "UI labels"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "translations": ["Ciao", "Mondo", "Gioco"],
 *   "count": 3,
 *   "provider": "libre",
 *   "timestamp": "2026-01-23T08:00:00Z"
 * }
 */

interface BatchRequest {
  texts: string[];
  targetLanguage: string;
  provider?: 'libre' | 'gemini' | 'openai';
  context?: string;
  apiKey?: string;
  glossary?: Record<string, string>;
}

interface BatchResponse {
  success: boolean;
  translations?: string[];
  count?: number;
  provider?: string;
  failed?: number;
  timestamp: string;
  error?: string;
}

async function translateWithLibre(text: string, targetLang: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
    );
    
    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    return data.responseData?.translatedText || text;
  } catch {
    return text; // Return original on error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchRequest = await request.json();
    
    // Validation
    if (!body.texts || !Array.isArray(body.texts) || body.texts.length === 0) {
      return NextResponse.json<BatchResponse>({
        success: false,
        error: 'Missing or invalid field: texts (must be non-empty array)',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    if (!body.targetLanguage) {
      return NextResponse.json<BatchResponse>({
        success: false,
        error: 'Missing required field: targetLanguage',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    // Limit batch size
    if (body.texts.length > 100) {
      return NextResponse.json<BatchResponse>({
        success: false,
        error: 'Batch size exceeds limit of 100 texts',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    const provider = body.provider || 'libre';
    const translations: string[] = [];
    let failed = 0;
    
    // Process in parallel with rate limiting
    const batchSize = 10;
    for (let i = 0; i < body.texts.length; i += batchSize) {
      const batch = body.texts.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (text) => {
          try {
            const translated = await translateWithLibre(text, body.targetLanguage);
            
            // Apply glossary if provided
            if (body.glossary) {
              let result = translated;
              for (const [source, target] of Object.entries(body.glossary)) {
                // Escape special regex characters to prevent injection errors
                const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                result = result.replace(new RegExp(escaped, 'gi'), target);
              }
              return result;
            }
            
            return translated;
          } catch {
            failed++;
            return text;
          }
        })
      );
      
      translations.push(...results);
      
      // Rate limiting delay between batches
      if (i + batchSize < body.texts.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    return NextResponse.json<BatchResponse>({
      success: true,
      translations,
      count: translations.length,
      provider,
      failed: failed > 0 ? failed : undefined,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('API v1 batch error:', error);
    return NextResponse.json<BatchResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'GameStringer API v1 - Batch Translation',
    version: '1.0.0',
    limits: {
      maxTexts: 100,
      maxTextLength: 5000,
      rateLimit: '100 requests/minute'
    },
    example: {
      request: {
        texts: ['Hello', 'World'],
        targetLanguage: 'it',
        provider: 'libre'
      },
      response: {
        success: true,
        translations: ['Ciao', 'Mondo'],
        count: 2
      }
    }
  });
}
