import { NextResponse } from 'next/server';
import { getInstalledGames, InstalledGame } from '@/lib/steam-utils';

// Disabilita la cache per questa rotta per avere sempre dati freschi durante il debug
export const dynamic = 'force-dynamic';

/**
 * @route GET /api/library/games
 * @description Recupera la lista dei giochi Steam installati.
 */
export async function GET() {
  try {
    console.log('[API /api/library/games] Inizio recupero giochi installati.');
    const games: InstalledGame[] = await getInstalledGames();

    // Ordina i giochi alfabeticamente per nome
    games.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[API /api/library/games] Recuperati ${games.length} giochi.`);
    return NextResponse.json(games);

  } catch (error) {
    console.error('--- ERRORE CRITICO IN /api/library/games ---', error);
    return NextResponse.json(
      { message: 'Errore interno del server durante il caricamento della libreria dei giochi.' },
      { status: 500 }
    );
  }
}
