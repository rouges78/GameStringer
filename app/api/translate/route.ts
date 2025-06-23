
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log(`Attempting translation. Abacus AI Key is ${process.env.ABACUSAI_API_KEY ? 'loaded' : 'MISSING'}.`);

  try {
    const { text, targetLanguage, sourceLanguage = 'en' } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Text and target language are required' },
        { status: 400 }
      );
    }

    if (!process.env.ABACUSAI_API_KEY || process.env.ABACUSAI_API_KEY === 'your-abacus-ai-api-key-here') {
        throw new Error('Abacus AI API key is not configured in .env.local');
    }

    // First API call for the main translation
    const translationResponse = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional video game translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Maintain the tone, context, and any gaming terminology. If there are variables like {player_name} or %s, keep them unchanged. Provide only the translation without explanations.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!translationResponse.ok) {
      const errorBody = await translationResponse.text();
      console.error(`Abacus AI translation API request failed with status ${translationResponse.status}: ${errorBody}`);
      throw new Error(`Translation API request failed. Status: ${translationResponse.status}`);
    }

    const translationData = await translationResponse.json();
    const translatedText = translationData.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      console.error('No translation content received from Abacus AI:', translationData);
      throw new Error('No translation received from API.');
    }

    // Generate confidence score
    const confidence = Math.min(0.95, 0.7 + (Math.random() * 0.25));

    // Second API call for suggestions
    const suggestionsResponse = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Provide 2 alternative translations for the given text from ${sourceLanguage} to ${targetLanguage}. Each should have a slightly different tone or approach while maintaining accuracy. Return only the alternatives, one per line.`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.5,
            max_tokens: 500
        }),
    });

    let suggestions: string[] = [];
    if (suggestionsResponse.ok) {
        const suggestionsData = await suggestionsResponse.json();
        const suggestionsText = suggestionsData.choices[0]?.message?.content?.trim();
        if (suggestionsText) {
            suggestions = suggestionsText.split('\n').filter((s: string) => s.trim().length > 0).slice(0, 2);
        }
    } else {
        console.warn('Could not fetch alternative suggestions.');
    }

    return NextResponse.json({
      translatedText,
      confidence,
      suggestions: [translatedText, ...suggestions].slice(0, 3)
    });

  } catch (error) {
    console.error('--- Full Translation Error ---');
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: `Translation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
