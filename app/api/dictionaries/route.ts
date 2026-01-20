import { NextRequest, NextResponse } from 'next/server';
import { listInstalledDictionaries, getDictionariesStats } from '@/lib/game-dictionaries';

export async function GET(request: NextRequest) {
  try {
    const dictionaries = await listInstalledDictionaries();
    
    return NextResponse.json(dictionaries);
  } catch (error) {
    console.error('[DICT API] Error listing dictionaries:', error);
    return NextResponse.json(
      { error: 'Failed to list dictionaries', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
