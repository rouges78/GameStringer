import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    console.log('Recupero i giochi dal database...');
    const games = await prisma.game.findMany({
      orderBy: {
        title: 'asc',
      },
    });
    console.log(`Trovati ${games.length} giochi nel database.`);
    
    // Mappa i giochi nel formato atteso da GameInfo
    const gameInfos = games.map(game => ({
      id: game.id,
      title: game.title,
      path: game.installPath || game.executablePath || '', // Usa installPath o executablePath come fallback
      isInstalled: game.isInstalled
    }));
    
    return NextResponse.json(gameInfos);
  } catch (error) {
    console.error('Errore durante il recupero dei giochi dal database:', error);
    return NextResponse.json({ message: 'Errore nel recupero dei giochi.' }, { status: 500 });
  }
}
