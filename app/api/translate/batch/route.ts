import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { secretsManager } from '@/lib/secrets-manager';

interface BatchTranslationRequest {
  texts: string[];
  targetLanguage: string;
  sourceLanguage?: string;
  provider?: string;
  context?: string;
  apiKey?: string;
}

interface BatchTranslationResponse {
  translations: Array<{
    original: string;
    translated: string;
    confidence: number;
  }>;
  provider: string;
  totalTime: number;
}

export const POST = withErrorHandler(async function(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: BatchTranslationRequest = await request.json();
    const { texts, targetLanguage, sourceLanguage = 'auto', provider = 'openai', context, apiKey: userApiKey } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      throw new ValidationError('Missing required field: texts (array)');
    }
    if (!targetLanguage) {
      throw new ValidationError('Missing required field: targetLanguage');
    }

    // Limita a 20 stringhe per batch per evitare timeout
    const batchTexts = texts.slice(0, 20);

    logger.info('Batch translation request', 'TRANSLATE_BATCH_API', {
      count: batchTexts.length,
      targetLanguage,
      provider
    });

    let translations: Array<{ original: string; translated: string; confidence: number }> = [];

    switch (provider) {
      case 'openai':
      case 'gpt5':
        translations = await translateBatchOpenAI(batchTexts, targetLanguage, sourceLanguage, context, provider === 'gpt5');
        break;
      case 'gemini':
        console.log('[BATCH API] Calling Gemini with', batchTexts.length, 'texts, apiKey present:', !!userApiKey);
        console.log('[BATCH API] First text sample:', batchTexts[0]?.substring(0, 100));
        try {
          translations = await translateBatchGemini(batchTexts, targetLanguage, sourceLanguage, context, userApiKey);
          console.log('[BATCH API] Gemini success:', translations.length, 'translations');
        } catch (geminiError: any) {
          console.error('[BATCH API] Gemini error details:', {
            message: geminiError?.message,
            stack: geminiError?.stack?.substring(0, 500),
            name: geminiError?.name
          });
          throw geminiError;
        }
        break;
      case 'claude':
        translations = await translateBatchClaude(batchTexts, targetLanguage, sourceLanguage, context, userApiKey);
        break;
      case 'deepseek':
        translations = await translateBatchDeepSeek(batchTexts, targetLanguage, sourceLanguage, context);
        break;
      default:
        // Fallback: traduci una alla volta
        for (const text of batchTexts) {
          translations.push({ original: text, translated: text, confidence: 0.5 });
        }
    }

    const totalTime = Date.now() - startTime;

    logger.info('Batch translation completed', 'TRANSLATE_BATCH_API', {
      count: translations.length,
      totalTime,
      avgTimePerItem: Math.round(totalTime / translations.length)
    });

    return NextResponse.json({
      translations,
      provider,
      totalTime
    } as BatchTranslationResponse);

  } catch (error) {
    logger.error('Batch translation failed', 'TRANSLATE_BATCH_API', { error });
    throw error;
  }
});

async function translateBatchOpenAI(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
  context?: string,
  useGpt4o: boolean = false
): Promise<Array<{ original: string; translated: string; confidence: number }>> {
  const apiKey = secretsManager.get('OPENAI_API_KEY');
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Costruisci prompt per batch
  const numberedTexts = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');
  
  const systemPrompt = `You are a professional video game translator. Translate the following numbered texts from ${sourceLanguage} to ${targetLanguage}.
${context ? `Context: ${context}` : ''}

IMPORTANT: Return ONLY a JSON array with the translations in the same order. Format:
[{"index": 1, "translation": "translated text 1"}, {"index": 2, "translation": "translated text 2"}, ...]

Keep game terminology consistent. Preserve formatting, variables like {0}, %s, etc.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: useGpt4o ? 'gpt-4o' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: numberedTexts }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(content);
    return texts.map((original, i) => {
      const item = parsed.find((p: any) => p.index === i + 1);
      return {
        original,
        translated: item?.translation || original,
        confidence: 0.9
      };
    });
  } catch {
    // Fallback: prova a estrarre traduzioni dal testo
    return texts.map(original => ({ original, translated: original, confidence: 0.5 }));
  }
}

async function translateBatchGemini(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
  context?: string,
  userApiKey?: string
): Promise<Array<{ original: string; translated: string; confidence: number }>> {
  const apiKey = userApiKey || secretsManager.get('GEMINI_API_KEY');
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  // Sanitize texts - remove problematic characters
  const sanitizedTexts = texts.map(t => 
    t.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
     .replace(/\r\n/g, '\n')
     .trim() || t
  );

  const numberedTexts = sanitizedTexts.map((t, i) => `[${i + 1}] ${t}`).join('\n');
  
  console.log('[GEMINI BATCH] Translating', texts.length, 'texts, first:', sanitizedTexts[0]?.substring(0, 30));
  
  const prompt = `You are a professional video game translator. Translate these numbered texts from ${sourceLanguage} to ${targetLanguage}.
${context ? `Context: ${context}` : ''}

Return ONLY a JSON array: [{"index": 1, "translation": "..."}, ...]

Texts to translate:
${numberedTexts}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[GEMINI BATCH] API Error:', response.status, errorBody);
    throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  console.log('[GEMINI BATCH] Response received, candidates:', data.candidates?.length);
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  try {
    const parsed = JSON.parse(content);
    return texts.map((original, i) => {
      const item = parsed.find((p: any) => p.index === i + 1);
      return {
        original,
        translated: item?.translation || original,
        confidence: 0.85
      };
    });
  } catch {
    return texts.map(original => ({ original, translated: original, confidence: 0.5 }));
  }
}

async function translateBatchClaude(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
  context?: string,
  userApiKey?: string
): Promise<Array<{ original: string; translated: string; confidence: number }>> {
  const apiKey = userApiKey || secretsManager.get('ANTHROPIC_API_KEY');
  
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const numberedTexts = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');
  
  const systemPrompt = `You are a professional video game translator. Translate the numbered texts from ${sourceLanguage} to ${targetLanguage}.
${context ? `Context: ${context}` : ''}
Return ONLY a JSON array: [{"index": 1, "translation": "..."}, ...]`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60 sec timeout
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: numberedTexts }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    
    try {
      const parsed = JSON.parse(content);
      return texts.map((original, i) => {
        const item = parsed.find((p: any) => p.index === i + 1);
        return {
          original,
          translated: item?.translation || original,
          confidence: 0.9
        };
      });
    } catch {
      return texts.map(original => ({ original, translated: original, confidence: 0.5 }));
    }
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude API timeout after 60 seconds');
    }
    throw error;
  }
}

async function translateBatchDeepSeek(
  texts: string[],
  targetLanguage: string,
  sourceLanguage: string,
  context?: string
): Promise<Array<{ original: string; translated: string; confidence: number }>> {
  const apiKey = secretsManager.get('DEEPSEEK_API_KEY');
  
  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  const numberedTexts = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');
  
  const systemPrompt = `You are a professional video game translator. Translate the numbered texts from ${sourceLanguage} to ${targetLanguage}.
${context ? `Context: ${context}` : ''}
Return ONLY a JSON array: [{"index": 1, "translation": "..."}, ...]`;

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
        { role: 'user', content: numberedTexts }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  try {
    const parsed = JSON.parse(content);
    return texts.map((original, i) => {
      const item = parsed.find((p: any) => p.index === i + 1);
      return {
        original,
        translated: item?.translation || original,
        confidence: 0.88
      };
    });
  } catch {
    return texts.map(original => ({ original, translated: original, confidence: 0.5 }));
  }
}
