import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { secretsManager } from '@/lib/secrets-manager';
import { withRateLimit, rateLimiters } from '@/lib/rate-limiter';

interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  provider?: string;
  context?: string;
  apiKey?: string; // API key passata dall'interfaccia utente
}

interface TranslationResponse {
  translatedText: string;
  confidence: number;
  suggestions: string[];
  provider: string;
  sourceLanguage: string;
  targetLanguage: string;
  cached: boolean;
}

// Simple in-memory cache for translations
const translationCache = new Map<string, TranslationResponse>();

export const POST = withRateLimit(withErrorHandler(async function(request: NextRequest) {
  try {
    const body: TranslationRequest = await request.json();
    const { text, targetLanguage, sourceLanguage = 'auto', provider = 'openai', context, apiKey: userApiKey } = body;

    if (!text || !targetLanguage) {
      throw new ValidationError('Missing required fields: text, targetLanguage');
    }

    logger.info('Translation request received', 'TRANSLATE_API', {
      textLength: text.length,
      targetLanguage,
      sourceLanguage,
      provider,
      hasContext: !!context
    });

    // Check cache first
    const cacheKey = `${text}_${sourceLanguage}_${targetLanguage}_${provider}`;
    const cached = translationCache.get(cacheKey);
    
    if (cached) {
      logger.debug('Translation served from cache', 'TRANSLATE_API', { cacheKey });
      return NextResponse.json({ ...cached, cached: true });
    }

    // Initialize secrets manager
    await secretsManager.initialize();

    let translationResult: TranslationResponse;

    switch (provider) {
      case 'openai':
        translationResult = await translateWithOpenAI(text, targetLanguage, sourceLanguage, context);
        break;
      case 'gpt5':
        translationResult = await translateWithGPT5(text, targetLanguage, sourceLanguage, context);
        break;
      case 'gemini':
        translationResult = await translateWithGemini(text, targetLanguage, sourceLanguage, context);
        break;
      case 'claude':
        translationResult = await translateWithClaude(text, targetLanguage, sourceLanguage, context, userApiKey);
        break;
      case 'deepseek':
        translationResult = await translateWithDeepSeek(text, targetLanguage, sourceLanguage, context);
        break;
      case 'mistral':
        translationResult = await translateWithMistral(text, targetLanguage, sourceLanguage, context);
        break;
      case 'openrouter':
        translationResult = await translateWithOpenRouter(text, targetLanguage, sourceLanguage, context);
        break;
      case 'deepl':
        translationResult = await translateWithDeepL(text, targetLanguage, sourceLanguage);
        break;
      case 'google':
        translationResult = await translateWithGoogle(text, targetLanguage, sourceLanguage);
        break;
      case 'mock':
        translationResult = await translateWithMock(text, targetLanguage, sourceLanguage);
        break;
      default:
        throw new ValidationError(`Unsupported translation provider: ${provider}`);
    }

    // Cache the result
    translationCache.set(cacheKey, translationResult);

    // Clear cache if it gets too large
    if (translationCache.size > 1000) {
      const firstKey = translationCache.keys().next().value;
      translationCache.delete(firstKey);
    }

    logger.info('Translation completed', 'TRANSLATE_API', {
      provider: translationResult.provider,
      confidence: translationResult.confidence,
      cached: false
    });

    return NextResponse.json({ ...translationResult, cached: false });

  } catch (error) {
    logger.error('Translation request failed', 'TRANSLATE_API', { error });
    throw error;
  }
}), rateLimiters.translation);

async function translateWithOpenAI(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string
): Promise<TranslationResponse> {
  const apiKey = secretsManager.get('OPENAI_API_KEY');
  
  if (!apiKey || !secretsManager.isAvailable('OPENAI_API_KEY')) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const systemPrompt = `You are a professional translator specializing in video game localization. 
    Translate the following text from ${sourceLanguage} to ${targetLanguage}.
    ${context ? `Context: ${context}` : ''}
    
    Provide the translation in this exact JSON format:
    {
      "translatedText": "your translation here",
      "confidence": 0.95,
      "suggestions": ["alternative 1", "alternative 2", "alternative 3"]
    }
    
    Make sure to:
    1. Keep the tone appropriate for gaming
    2. Preserve any technical terms or UI elements
    3. Maintain formatting and punctuation
    4. Provide confidence score (0-1)
    5. Include 3 alternative translations in suggestions array`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No translation received from OpenAI');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    
    return {
      translatedText: parsed.translatedText,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.8)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      provider: 'openai',
      sourceLanguage,
      targetLanguage,
      cached: false
    };

  } catch (error) {
    logger.error('OpenAI translation failed', 'TRANSLATE_API', { error });
    throw new Error(`OpenAI translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function translateWithGemini(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string
): Promise<TranslationResponse> {
  const apiKey = secretsManager.get('GEMINI_API_KEY');
  
  if (!apiKey || !secretsManager.isAvailable('GEMINI_API_KEY')) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in settings.');
  }

  try {
    const systemPrompt = `You are a professional translator specializing in video game localization. 
    Translate the following text from ${sourceLanguage} to ${targetLanguage}.
    ${context ? `Context: ${context}` : ''}
    
    Provide the translation in this exact JSON format:
    {
      "translatedText": "your translation here",
      "confidence": 0.95,
      "suggestions": ["alternative 1", "alternative 2", "alternative 3"]
    }
    
    Make sure to:
    1. Keep the tone appropriate for gaming
    2. Preserve any technical terms or UI elements
    3. Maintain formatting and punctuation
    4. Provide confidence score (0-1)
    5. Include 3 alternative translations in suggestions array`;

    // Gemini 2.5 Flash - Latest model with best performance/cost ratio
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nText to translate:\n${text}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No translation received from Gemini');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    
    return {
      translatedText: parsed.translatedText,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.85)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      provider: 'gemini',
      sourceLanguage,
      targetLanguage,
      cached: false
    };

  } catch (error) {
    logger.error('OpenRouter translation failed', 'TRANSLATE_API', { error });
    throw new Error(`OpenRouter translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function translateWithGPT5(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string
): Promise<TranslationResponse> {
  const apiKey = secretsManager.get('OPENAI_API_KEY');
  
  if (!apiKey || !secretsManager.isAvailable('OPENAI_API_KEY')) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const systemPrompt = `You are a professional translator specializing in video game localization. 
    Translate the following text from ${sourceLanguage} to ${targetLanguage}.
    ${context ? `Context: ${context}` : ''}
    
    Provide the translation in this exact JSON format:
    {
      "translatedText": "your translation here",
      "confidence": 0.95,
      "suggestions": ["alternative 1", "alternative 2", "alternative 3"]
    }`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`GPT-5 API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No translation received from GPT-5');
    }

    const parsed = JSON.parse(content);
    
    return {
      translatedText: parsed.translatedText,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.9)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      provider: 'gpt5',
      sourceLanguage,
      targetLanguage,
      cached: false
    };

  } catch (error) {
    logger.error('GPT-5 translation failed', 'TRANSLATE_API', { error });
    throw new Error(`GPT-5 translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function translateWithClaude(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string,
  userApiKey?: string
): Promise<TranslationResponse> {
  // Usa l'API key dell'utente se fornita, altrimenti prova dal secretsManager
  const apiKey = userApiKey || secretsManager.get('ANTHROPIC_API_KEY');
  
  if (!apiKey) {
    throw new Error('API key Anthropic non configurata. Inserisci la tua API key nel campo apposito.');
  }

  try {
    const systemPrompt = `You are a professional translator specializing in video game localization. 
    Translate the following text from ${sourceLanguage} to ${targetLanguage}.
    ${context ? `Context: ${context}` : ''}
    
    Provide the translation in this exact JSON format:
    {
      "translatedText": "your translation here",
      "confidence": 0.95,
      "suggestions": ["alternative 1", "alternative 2", "alternative 3"]
    }`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: text }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    
    if (!content) {
      throw new Error('No translation received from Claude');
    }

    const parsed = JSON.parse(content);
    
    return {
      translatedText: parsed.translatedText,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.9)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      provider: 'claude',
      sourceLanguage,
      targetLanguage,
      cached: false
    };

  } catch (error) {
    logger.error('Claude translation failed', 'TRANSLATE_API', { error });
    throw new Error(`Claude translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function translateWithOpenRouter(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string
): Promise<TranslationResponse> {
  const apiKey = secretsManager.get('OPENROUTER_API_KEY');
  
  if (!apiKey || !secretsManager.isAvailable('OPENROUTER_API_KEY')) {
    throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in settings.');
  }

  try {
    const systemPrompt = `You are a professional translator specializing in video game localization. 
    Translate the following text from ${sourceLanguage} to ${targetLanguage}.
    ${context ? `Context: ${context}` : ''}
    
    Provide the translation in this exact JSON format:
    {
      "translatedText": "your translation here",
      "confidence": 0.95,
      "suggestions": ["alternative 1", "alternative 2", "alternative 3"]
    }`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gamestringer.app',
        'X-Title': 'GameStringer Neural Translator'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No translation received from OpenRouter');
    }

    const parsed = JSON.parse(content);
    
    return {
      translatedText: parsed.translatedText,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.85)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      provider: 'openrouter',
      sourceLanguage,
      targetLanguage,
      cached: false
    };

  } catch (error) {
    logger.error('OpenRouter translation failed', 'TRANSLATE_API', { error });
    throw new Error(`OpenRouter translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function translateWithDeepSeek(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string
): Promise<TranslationResponse> {
  const apiKey = secretsManager.get('DEEPSEEK_API_KEY');
  
  if (!apiKey || !secretsManager.isAvailable('DEEPSEEK_API_KEY')) {
    throw new Error('DeepSeek API key not configured. Set DEEPSEEK_API_KEY in settings.');
  }

  try {
    const systemPrompt = `You are a professional translator specializing in video game localization. 
    Translate the following text from ${sourceLanguage} to ${targetLanguage}.
    ${context ? `Context: ${context}` : ''}
    
    Provide the translation in this exact JSON format:
    {
      "translatedText": "your translation here",
      "confidence": 0.95,
      "suggestions": ["alternative 1", "alternative 2", "alternative 3"]
    }`;

    // DeepSeek-V3 - Excellent for technical and bilingual translation
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No translation received from DeepSeek');
    }

    const parsed = JSON.parse(content);
    
    return {
      translatedText: parsed.translatedText,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.88)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      provider: 'deepseek',
      sourceLanguage,
      targetLanguage,
      cached: false
    };

  } catch (error) {
    logger.error('DeepSeek translation failed', 'TRANSLATE_API', { error });
    throw new Error(`DeepSeek translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function translateWithMistral(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string
): Promise<TranslationResponse> {
  const apiKey = secretsManager.get('MISTRAL_API_KEY');
  
  if (!apiKey || !secretsManager.isAvailable('MISTRAL_API_KEY')) {
    throw new Error('Mistral API key not configured. Set MISTRAL_API_KEY in settings.');
  }

  try {
    const systemPrompt = `You are a professional translator specializing in video game localization. 
    Translate the following text from ${sourceLanguage} to ${targetLanguage}.
    ${context ? `Context: ${context}` : ''}
    
    Provide the translation in this exact JSON format:
    {
      "translatedText": "your translation here",
      "confidence": 0.95,
      "suggestions": ["alternative 1", "alternative 2", "alternative 3"]
    }`;

    // Mixtral 8x7B - Open source, excellent multilingual performance
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Mistral API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No translation received from Mistral');
    }

    const parsed = JSON.parse(content);
    
    return {
      translatedText: parsed.translatedText,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.87)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      provider: 'mistral',
      sourceLanguage,
      targetLanguage,
      cached: false
    };

  } catch (error) {
    logger.error('Mistral translation failed', 'TRANSLATE_API', { error });
    throw new Error(`Mistral translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function translateWithDeepL(
  text: string,
  targetLanguage: string,
  sourceLanguage: string
): Promise<TranslationResponse> {
  // DeepL integration would go here
  // For now, return mock response
  logger.warn('DeepL integration not implemented, using fallback', 'TRANSLATE_API');
  return translateWithMock(text, targetLanguage, sourceLanguage);
}

async function translateWithGoogle(
  text: string,
  targetLanguage: string,
  sourceLanguage: string
): Promise<TranslationResponse> {
  // Google Translate integration would go here
  // For now, return mock response
  logger.warn('Google Translate integration not implemented, using fallback', 'TRANSLATE_API');
  return translateWithMock(text, targetLanguage, sourceLanguage);
}

async function translateWithMock(
  text: string,
  targetLanguage: string,
  sourceLanguage: string
): Promise<TranslationResponse> {
  // Mock translation for testing
  const mockTranslations: Record<string, Record<string, string>> = {
    'it': {
      'Hello': 'Ciao',
      'World': 'Mondo',
      'Game': 'Gioco',
      'Start': 'Inizia',
      'Options': 'Opzioni',
      'Settings': 'Impostazioni',
      'Exit': 'Esci',
      'Save': 'Salva',
      'Load': 'Carica',
      'New Game': 'Nuovo Gioco',
      'Continue': 'Continua',
      'Quit': 'Esci',
      'Pause': 'Pausa',
      'Resume': 'Riprendi',
      'Inventory': 'Inventario',
      'Health': 'Salute',
      'Mana': 'Mana',
      'Level': 'Livello',
      'Experience': 'Esperienza',
      'Skills': 'Abilità',
      'Equipment': 'Equipaggiamento',
      'Items': 'Oggetti',
      'Weapons': 'Armi',
      'Armor': 'Armatura',
      'Quest': 'Missione',
      'Mission': 'Missione',
      'Objective': 'Obiettivo',
      'Complete': 'Completa',
      'Failed': 'Fallito',
      'Victory': 'Vittoria',
      'Defeat': 'Sconfitta',
      'Score': 'Punteggio',
      'Time': 'Tempo',
      'Player': 'Giocatore',
      'Enemy': 'Nemico',
      'Attack': 'Attacco',
      'Defense': 'Difesa',
      'Magic': 'Magia',
      'Spell': 'Incantesimo',
      'Cast': 'Lancia',
      'Target': 'Bersaglio',
      'Damage': 'Danno',
      'Heal': 'Cura',
      'Potion': 'Pozione',
      'Gold': 'Oro',
      'Silver': 'Argento',
      'Bronze': 'Bronzo',
      'Rare': 'Raro',
      'Epic': 'Epico',
      'Legendary': 'Leggendario',
      'Common': 'Comune',
      'Uncommon': 'Non Comune'
    }
  };

  // Simple word-by-word translation for mock
  const translations = mockTranslations[targetLanguage] || {};
  const words = text.split(' ');
  const translatedWords = words.map(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    return translations[cleanWord] || word;
  });

  const translatedText = translatedWords.join(' ');

  // Generate mock suggestions
  const suggestions = [
    translatedText,
    translatedText.replace(/\b\w/g, l => l.toUpperCase()), // Title case
    translatedText.toLowerCase() // Lowercase
  ];

  return {
    translatedText,
    confidence: 0.7, // Lower confidence for mock
    suggestions,
    provider: 'mock',
    sourceLanguage,
    targetLanguage,
    cached: false
  };
}

export const GET = withRateLimit(withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'providers') {
      const providers = ['openai', 'gemini', 'deepl', 'google', 'mock'];
      const availableProviders = [];

      for (const provider of providers) {
        let available = false;
        let reason = '';

        switch (provider) {
          case 'openai':
            available = secretsManager.isAvailable('OPENAI_API_KEY');
            reason = available ? 'Available' : 'API key not configured';
            break;
          case 'gemini':
            available = secretsManager.isAvailable('GEMINI_API_KEY');
            reason = available ? 'Available' : 'API key not configured';
            break;
          case 'deepl':
            available = false;
            reason = 'Not implemented';
            break;
          case 'google':
            available = false;
            reason = 'Not implemented';
            break;
          case 'mock':
            available = true;
            reason = 'Mock provider for testing';
            break;
        }

        availableProviders.push({
          provider,
          available,
          reason
        });
      }

      return NextResponse.json({
        providers: availableProviders,
        cacheSize: translationCache.size
      });
    }

    if (action === 'cache') {
      return NextResponse.json({
        cacheSize: translationCache.size,
        cacheKeys: Array.from(translationCache.keys()).slice(0, 10) // First 10 keys
      });
    }

    return NextResponse.json({
      message: 'Translation API endpoint',
      availableActions: ['providers', 'cache'],
      usage: 'POST /api/translate with { text, targetLanguage, sourceLanguage?, provider?, context? }'
    });

  } catch (error) {
    logger.error('Translation API GET request failed', 'TRANSLATE_API', { error });
    throw error;
  }
}), rateLimiters.translation);

export const DELETE = withRateLimit(withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'cache') {
      const cacheSize = translationCache.size;
      translationCache.clear();
      
      logger.info('Translation cache cleared', 'TRANSLATE_API', { 
        clearedEntries: cacheSize 
      });

      return NextResponse.json({
        message: 'Translation cache cleared',
        clearedEntries: cacheSize
      });
    }

    return NextResponse.json({
      error: 'Invalid action. Use ?action=cache to clear cache'
    }, { status: 400 });

  } catch (error) {
    logger.error('Translation API DELETE request failed', 'TRANSLATE_API', { error });
    throw error;
  }
}), rateLimiters.translation);