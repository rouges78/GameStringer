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

// Rate limiter rimosso per supportare OCR real-time
export const POST = withErrorHandler(async function(request: NextRequest) {
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

    // Funzione helper per traduzione con fallback a libre
    const translateWithProvider = async (): Promise<TranslationResponse> => {
      switch (provider) {
        case 'openai':
          return await translateWithOpenAI(text, targetLanguage, sourceLanguage, context);
        case 'gpt5':
          return await translateWithGPT5(text, targetLanguage, sourceLanguage, context);
        case 'gemini':
          return await translateWithGemini(text, targetLanguage, sourceLanguage, context, userApiKey);
        case 'claude':
          return await translateWithClaude(text, targetLanguage, sourceLanguage, context, userApiKey);
        case 'deepseek':
          return await translateWithDeepSeek(text, targetLanguage, sourceLanguage, context);
        case 'mistral':
          return await translateWithMistral(text, targetLanguage, sourceLanguage, context);
        case 'openrouter':
          return await translateWithOpenRouter(text, targetLanguage, sourceLanguage, context);
        case 'deepl':
          return await translateWithDeepL(text, targetLanguage, sourceLanguage);
        case 'google':
          return await translateWithGoogle(text, targetLanguage, sourceLanguage);
        case 'mock':
          return await translateWithMock(text, targetLanguage, sourceLanguage);
        case 'libre':
          return await translateWithLibre(text, targetLanguage, sourceLanguage);
        case 'qwen3':
          return await translateWithQwen3(text, targetLanguage, sourceLanguage, context);
        case 'nllb':
          return await translateWithNLLB(text, targetLanguage, sourceLanguage);
        case 'ollama':
          return await translateWithOllama(text, targetLanguage, sourceLanguage, context, userApiKey);
        default:
          throw new ValidationError(`Unsupported translation provider: ${provider}`);
      }
    };

    // Prova provider richiesto, fallback a libre se fallisce
    try {
      translationResult = await translateWithProvider();
    } catch (providerError: any) {
      if (provider !== 'libre' && provider !== 'mock') {
        logger.warn(`Provider ${provider} failed, falling back to libre`, 'TRANSLATE_API', { error: providerError.message });
        translationResult = await translateWithLibre(text, targetLanguage, sourceLanguage);
      } else {
        throw providerError;
      }
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
});

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
  context?: string,
  userApiKey?: string
): Promise<TranslationResponse> {
  const apiKey = userApiKey || secretsManager.get('GEMINI_API_KEY');
  
  console.log('[GEMINI] API Key ricevuta:', userApiKey ? 'da utente (' + userApiKey.substring(0,8) + '...)' : 'da secrets');
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in settings.');
  }

  // Sanitize text - remove problematic characters
  const sanitizedText = text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Control characters
    .replace(/\r\n/g, '\n') // Normalize line endings
    .trim();

  // Skip empty or very short texts
  if (!sanitizedText || sanitizedText.length < 2) {
    return {
      translatedText: text,
      confidence: 1,
      suggestions: [],
      provider: 'gemini',
      sourceLanguage,
      targetLanguage,
      cached: false
    };
  }

  console.log('[GEMINI SINGLE] Translating:', sanitizedText.substring(0, 50), '...');

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

    // Gemini 1.5 Flash - Stable model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nText to translate:\n${sanitizedText}` }
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
      console.error('[GEMINI] Errore API:', response.status, JSON.stringify(errorData));
      throw new Error(`Gemini API error: ${response.status} - ${errorData?.error?.message || JSON.stringify(errorData)}`);
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
  sourceLanguage: string,
  apiKey?: string
): Promise<TranslationResponse> {
  const deeplKey = apiKey || secretsManager.get('DEEPL_API_KEY');
  
  if (!deeplKey) {
    throw new Error('DeepL API key not configured');
  }
  
  // DeepL usa codici lingua uppercase
  const targetLang = targetLanguage.toUpperCase();
  const sourceLang = sourceLanguage.toUpperCase();
  
  // Determina endpoint (free vs pro)
  const isFreeKey = deeplKey.endsWith(':fx');
  const baseUrl = isFreeKey 
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
  
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${deeplKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang,
      source_lang: sourceLang,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  const translatedText = data.translations?.[0]?.text || text;
  
  return {
    translatedText,
    provider: 'deepl',
    confidence: 0.95,
    cached: false,
    suggestions: [],
    sourceLanguage,
    targetLanguage,
  };
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
    translatedText.replace(/\b\w/g, l => l.toUpperCase()),
    translatedText.toLowerCase()
  ];

  return {
    translatedText,
    confidence: 0.7,
    suggestions,
    provider: 'mock',
    sourceLanguage,
    targetLanguage,
    cached: false
  };
}

// LibreTranslate - Provider gratuito e open source
async function translateWithLibre(
  text: string,
  targetLanguage: string,
  sourceLanguage: string
): Promise<TranslationResponse> {
  const langMap: Record<string, string> = {
    'en': 'en', 'it': 'it', 'de': 'de', 'fr': 'fr', 'es': 'es',
    'pt': 'pt', 'ru': 'ru', 'zh': 'zh', 'ja': 'ja', 'ko': 'ko',
    'auto': 'auto'
  };
  
  const source = langMap[sourceLanguage] || 'en';
  const target = langMap[targetLanguage] || 'it';
  
  // Usa MyMemory API (gratuita, 1000 parole/giorno, no API key)
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`
    );
    
    if (!response.ok) {
      throw new Error(`MyMemory API error: ${response.status}`);
    }
    
    const data = await response.json();
    const translatedText = data.responseData?.translatedText || text;
    
    return {
      translatedText,
      confidence: 0.8,
      suggestions: [],
      provider: 'libre',
      sourceLanguage,
      targetLanguage,
      cached: false
    };
  } catch (error) {
    logger.error('LibreTranslate failed', 'TRANSLATE_API', { error });
    throw new Error(`LibreTranslate failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Qwen 3 via Ollama - Eccellente per lingue asiatiche (CN/JP/KR)
async function translateWithQwen3(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string
): Promise<TranslationResponse> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  
  // Modelli Qwen3 in ordine di preferenza (dal più grande al più piccolo)
  const qwenModels = ['qwen3:32b', 'qwen3:14b', 'qwen3:8b', 'qwen3:4b', 'qwen3:1.7b', 'qwen3', 'qwen2.5:14b', 'qwen2.5:7b', 'qwen2.5'];
  
  try {
    const tagsResponse = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!tagsResponse.ok) throw new Error('Ollama non raggiungibile');
    
    const tagsData = await tagsResponse.json();
    const availableModels = tagsData.models?.map((m: any) => m.name) || [];
    
    let selectedModel = qwenModels.find(m => 
      availableModels.some((am: string) => am.startsWith(m.split(':')[0]))
    );
    
    if (!selectedModel) throw new Error('Nessun modello Qwen. Installa con: ollama pull qwen3:14b');
    
    selectedModel = availableModels.find((am: string) => am.startsWith(selectedModel!.split(':')[0])) || selectedModel;

    const systemPrompt = `Translate from ${sourceLanguage} to ${targetLanguage}. ${context ? `Context: ${context}` : ''} Preserve variables and tags. Respond ONLY with the translation.`;

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        stream: false,
        options: { temperature: 0.3, num_predict: 500 }
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) throw new Error(`Qwen3 error: ${response.status}`);

    const data = await response.json();
    const translatedText = data.message?.content?.trim() || '';
    if (!translatedText) throw new Error('Nessuna traduzione da Qwen3');

    return {
      translatedText,
      confidence: 0.9,
      suggestions: [],
      provider: 'qwen3',
      sourceLanguage,
      targetLanguage,
      cached: false
    };

  } catch (error) {
    logger.error('Qwen3 translation failed', 'TRANSLATE_API', { error });
    throw new Error(`Qwen3 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// NLLB-200 (Meta) - 200 lingue via HuggingFace
async function translateWithNLLB(
  text: string,
  targetLanguage: string,
  sourceLanguage: string
): Promise<TranslationResponse> {
  const nllbLangMap: Record<string, string> = {
    'en': 'eng_Latn', 'it': 'ita_Latn', 'de': 'deu_Latn', 'fr': 'fra_Latn', 
    'es': 'spa_Latn', 'pt': 'por_Latn', 'ru': 'rus_Cyrl', 'pl': 'pol_Latn',
    'zh': 'zho_Hans', 'ja': 'jpn_Jpan', 'ko': 'kor_Hang', 'th': 'tha_Thai',
    'vi': 'vie_Latn', 'id': 'ind_Latn', 'ar': 'arb_Arab', 'hi': 'hin_Deva',
    'tr': 'tur_Latn', 'uk': 'ukr_Cyrl', 'auto': 'eng_Latn'
  };
  
  const srcLang = nllbLangMap[sourceLanguage] || 'eng_Latn';
  const tgtLang = nllbLangMap[targetLanguage] || 'ita_Latn';
  const hfApiKey = secretsManager.get('HUGGINGFACE_API_KEY');
  
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hfApiKey ? { 'Authorization': `Bearer ${hfApiKey}` } : {})
        },
        body: JSON.stringify({ inputs: text, parameters: { src_lang: srcLang, tgt_lang: tgtLang } }),
        signal: AbortSignal.timeout(30000)
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 503 && errorData.estimated_time) {
        await new Promise(resolve => setTimeout(resolve, Math.min(errorData.estimated_time * 1000, 20000)));
        const retryResponse = await fetch(
          'https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(hfApiKey ? { 'Authorization': `Bearer ${hfApiKey}` } : {}) },
            body: JSON.stringify({ inputs: text, parameters: { src_lang: srcLang, tgt_lang: tgtLang } }),
            signal: AbortSignal.timeout(30000)
          }
        );
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          return { translatedText: retryData[0]?.translation_text || text, confidence: 0.85, suggestions: [], provider: 'nllb', sourceLanguage, targetLanguage, cached: false };
        }
      }
      throw new Error(`NLLB API error: ${response.status}`);
    }

    const data = await response.json();
    return { translatedText: data[0]?.translation_text || text, confidence: 0.85, suggestions: [], provider: 'nllb', sourceLanguage, targetLanguage, cached: false };

  } catch (error) {
    logger.error('NLLB translation failed', 'TRANSLATE_API', { error });
    throw new Error(`NLLB failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Ollama generico
async function translateWithOllama(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string,
  modelName?: string
): Promise<TranslationResponse> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  
  try {
    const tagsResponse = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(5000) });
    if (!tagsResponse.ok) throw new Error('Ollama non raggiungibile');
    
    const tagsData = await tagsResponse.json();
    const availableModels = tagsData.models?.map((m: any) => m.name) || [];
    if (availableModels.length === 0) throw new Error('Nessun modello Ollama installato');
    
    const selectedModel = modelName && availableModels.includes(modelName) ? modelName : availableModels[0];
    const systemPrompt = `Translate from ${sourceLanguage} to ${targetLanguage}. ${context || ''} Preserve variables. Respond ONLY with the translation.`;

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
        stream: false,
        options: { temperature: 0.3, num_predict: 500 }
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
    const data = await response.json();
    const translatedText = data.message?.content?.trim() || '';
    if (!translatedText) throw new Error('Nessuna traduzione');

    return { translatedText, confidence: 0.85, suggestions: [], provider: 'ollama', sourceLanguage, targetLanguage, cached: false };

  } catch (error) {
    logger.error('Ollama translation failed', 'TRANSLATE_API', { error });
    throw new Error(`Ollama failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const GET = withRateLimit(withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'providers') {
      const providers = ['openai', 'gemini', 'deepl', 'libre', 'qwen3', 'nllb', 'ollama', 'mock'];
      const availableProviders = providers.map(provider => {
        let available = false, reason = '';
        switch (provider) {
          case 'openai': available = secretsManager.isAvailable('OPENAI_API_KEY'); reason = available ? 'Available' : 'API key not configured'; break;
          case 'gemini': available = secretsManager.isAvailable('GEMINI_API_KEY'); reason = available ? 'Available' : 'API key not configured'; break;
          case 'qwen3': case 'ollama': available = true; reason = 'Local via Ollama'; break;
          case 'nllb': available = true; reason = '200 languages via HuggingFace'; break;
          case 'libre': available = true; reason = 'Free via MyMemory'; break;
          case 'mock': available = true; reason = 'Testing'; break;
          default: reason = 'Not implemented';
        }
        return { provider, available, reason };
      });
      return NextResponse.json({ providers: availableProviders, cacheSize: translationCache.size });
    }

    if (action === 'cache') {
      return NextResponse.json({ cacheSize: translationCache.size, cacheKeys: Array.from(translationCache.keys()).slice(0, 10) });
    }

    return NextResponse.json({ message: 'Translation API', availableActions: ['providers', 'cache'] });

  } catch (error) {
    logger.error('Translation API GET failed', 'TRANSLATE_API', { error });
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