import { NextRequest, NextResponse } from 'next/server';
import { addTranslationToDictionary } from '@/lib/game-dictionaries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, targetLanguage, original, translated } = body;

    if (!original || !translated) {
      return NextResponse.json(
        { error: 'Missing original or translated text' },
        { status: 400 }
      );
    }

    // Usa il gameId come identificatore del dizionario
    const dictionaryId = gameId || 'default';
    const targetLang = targetLanguage || 'it';

    const result = await addTranslationToDictionary(
      dictionaryId,
      targetLang,
      original,
      translated
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Translation added to dictionary',
        dictionaryId,
        targetLanguage: targetLang
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to add translation', message: result.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[DICT API] Error adding translation:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
