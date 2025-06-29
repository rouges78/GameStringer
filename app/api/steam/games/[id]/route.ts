import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { SteamGame } from '@/lib/types'; // Assumiamo che il tipo esista già

const cacheFilePath = path.join(process.cwd(), '.cache', 'steam-games.json');

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const gameId = params.id;

  if (!gameId) {
    return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
  }

  try {
    // Leggi la cache dei giochi
    const cachedData = await fs.readFile(cacheFilePath, 'utf-8');
    const cacheObject = JSON.parse(cachedData);

    // Controlla che la cache abbia la struttura corretta
    if (!cacheObject || !Array.isArray(cacheObject.games)) {
        throw new Error('Formato della cache non valido.');
    }

    const games: SteamGame[] = cacheObject.games;

    // Trova il gioco specifico
    const game = games.find(g => g.appid.toString() === gameId);

    if (game) {
      return NextResponse.json(game);
    } else {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Failed to read steam games cache:', error);
    // Se la cache non esiste, significa che non abbiamo dati
    return NextResponse.json({ error: 'Game cache not found. Please load /games first.' }, { status: 500 });
  }
}
