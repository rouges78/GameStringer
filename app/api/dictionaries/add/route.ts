import { NextRequest, NextResponse } from 'next/server';
import { addTranslationToDictionary } from '@/lib/game-dictionaries';
import { withErrorHandler } from '@/lib/error-handler';

export const POST = withErrorHandler(async function(request: NextRequest) {
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
});
