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
    return NextResponse.json(games);
  } catch (error) {
    console.error('Errore durante il recupero dei giochi dal database:', error);
    return NextResponse.json({ message: 'Errore nel recupero dei giochi.' }, { status: 500 });
  }
}
