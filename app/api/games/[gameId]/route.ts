import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const { gameId } = params;

    if (!gameId) {
        return NextResponse.json({ message: 'ID del gioco non fornito.' }, { status: 400 });
    }

    const game = await prisma.game.findUnique({
      where: {
        id: gameId,
      },
    });

    if (!game) {
      return NextResponse.json({ message: 'Gioco non trovato.' }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Errore durante il recupero del gioco:', error);
    return NextResponse.json({ message: 'Errore nel recupero del gioco.' }, { status: 500 });
  }
}
