import { NextResponse } from 'next/server';
import { listInstalledDictionaries } from '@/lib/game-dictionaries';
import { withErrorHandler } from '@/lib/error-handler';

export const GET = withErrorHandler(async function() {
  const dictionaries = await listInstalledDictionaries();

  return NextResponse.json(dictionaries);
});
