import { NextRequest, NextResponse } from 'next/server';
import { addTranslationToDictionary } from '@/lib/game-dictionaries';
import { withErrorHandler } from '@/lib/error-handler';
import { dictionaryAddSchema, validateBody } from '@/lib/api-schemas';

export const POST = withErrorHandler(async function(request: NextRequest) {
  const rawBody = await request.json();
  const validated = validateBody(dictionaryAddSchema, rawBody);
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400 }
    );
  }

  const { gameId, targetLanguage, original, translated } = validated.data;
  const dictionaryId = (gameId ?? 'default') as string;
  const targetLang = (targetLanguage ?? 'it') as string;

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
