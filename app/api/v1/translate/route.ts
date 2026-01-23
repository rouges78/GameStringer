import { NextRequest, NextResponse } from 'next/server';

/**
 * 🔌 GameStringer Public API v1
 * 
 * Endpoint per traduzione singola stringa.
 * Ideale per integrazione CI/CD e automazione.
 * 
 * POST /api/v1/translate
 * 
 * Body:
 * {
 *   "text": "Hello world",
 *   "sourceLanguage": "en",
 *   "targetLanguage": "it",
 *   "provider": "libre" | "gemini" | "openai" | "claude",
 *   "context": "UI button",
 *   "glossary": { "Hello": "Ciao" }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "translation": "Ciao mondo",
 *   "provider": "libre",
 *   "cached": false,
 *   "timestamp": "2026-01-23T08:00:00Z"
 * }
 */

interface TranslateRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  provider?: 'libre' | 'gemini' | 'openai' | 'claude' | 'deepseek';
  context?: string;
  glossary?: Record<string, string>;
  apiKey?: string;
}

interface TranslateResponse {
  success: boolean;
  translation?: string;
  provider?: string;
  cached?: boolean;
  timestamp: string;
  error?: string;
}

// Simple in-memory cache
const translationCache = new Map<string, { translation: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCacheKey(text: string, target: string, provider: string): string {
  return `${provider}:${target}:${text}`;
}

async function translateWithLibre(text: string, targetLang: string): Promise<string> {
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
  );
  
  if (!response.ok) {
    throw new Error('MyMemory API error');
  }
  
  const data = await response.json();
  return data.responseData?.translatedText || text;
}

async function translateWithGemini(text: string, targetLang: string, apiKey: string, context?: string): Promise<string> {
  const prompt = context 
    ? `Translate this text to ${targetLang}. Context: ${context}\n\nText: "${text}"\n\nProvide only the translation, no explanations.`
    : `Translate this text to ${targetLang}: "${text}"\n\nProvide only the translation, no explanations.`;
    
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    }
  );
  
  if (!response.ok) {
    throw new Error('Gemini API error');
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
}

async function translateWithOpenAI(text: string, targetLang: string, apiKey: string, context?: string): Promise<string> {
  const systemPrompt = context
    ? `You are a professional translator. Translate text to ${targetLang}. Context: ${context}. Provide only the translation.`
    : `You are a professional translator. Translate text to ${targetLang}. Provide only the translation.`;
    
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3
    })
  });
  
  if (!response.ok) {
    throw new Error('OpenAI API error');
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}

function applyGlossary(text: string, glossary: Record<string, string>): string {
  let result = text;
  for (const [source, target] of Object.entries(glossary)) {
    result = result.replace(new RegExp(source, 'gi'), target);
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body: TranslateRequest = await request.json();
    
    // Validation
    if (!body.text) {
      return NextResponse.json<TranslateResponse>({
        success: false,
        error: 'Missing required field: text',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    if (!body.targetLanguage) {
      return NextResponse.json<TranslateResponse>({
        success: false,
        error: 'Missing required field: targetLanguage',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    const provider = body.provider || 'libre';
    const cacheKey = getCacheKey(body.text, body.targetLanguage, provider);
    
    // Check cache
    const cached = translationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      let translation = cached.translation;
      if (body.glossary) {
        translation = applyGlossary(translation, body.glossary);
      }
      
      return NextResponse.json<TranslateResponse>({
        success: true,
        translation,
        provider,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Translate
    let translation: string;
    
    switch (provider) {
      case 'gemini':
        if (!body.apiKey) {
          return NextResponse.json<TranslateResponse>({
            success: false,
            error: 'API key required for Gemini provider',
            timestamp: new Date().toISOString()
          }, { status: 400 });
        }
        translation = await translateWithGemini(body.text, body.targetLanguage, body.apiKey, body.context);
        break;
        
      case 'openai':
        if (!body.apiKey) {
          return NextResponse.json<TranslateResponse>({
            success: false,
            error: 'API key required for OpenAI provider',
            timestamp: new Date().toISOString()
          }, { status: 400 });
        }
        translation = await translateWithOpenAI(body.text, body.targetLanguage, body.apiKey, body.context);
        break;
        
      case 'libre':
      default:
        translation = await translateWithLibre(body.text, body.targetLanguage);
    }
    
    // Cache result
    translationCache.set(cacheKey, { translation, timestamp: Date.now() });
    
    // Apply glossary
    if (body.glossary) {
      translation = applyGlossary(translation, body.glossary);
    }
    
    return NextResponse.json<TranslateResponse>({
      success: true,
      translation,
      provider,
      cached: false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('API v1 translate error:', error);
    return NextResponse.json<TranslateResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'GameStringer API v1 - Translate',
    version: '1.0.0',
    endpoints: {
      'POST /api/v1/translate': 'Translate single text',
      'POST /api/v1/batch': 'Translate multiple texts',
      'GET /api/v1/languages': 'List supported languages',
      'GET /api/v1/health': 'Health check'
    },
    documentation: 'https://gamestringer.dev/docs/api'
  });
}
