import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAllInstalledSteamGames } from '@/lib/steam-utils';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // La logica precedente con l'API key di Steam è stata rimossa per usare solo il rilevamento locale.
    console.log('[API Route] Tentativo di ottenere i giochi installati localmente...');
    const installedGames = await getAllInstalledSteamGames();
    
    // Ordiniamo i giochi alfabeticamente per nome, come richiesto dal frontend
    installedGames.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[API Route] Restituiti ${installedGames.length} giochi.`);

    return NextResponse.json({ games: installedGames });

  } catch (error) {
    console.error('Errore API in games/route.ts:', error);
    return NextResponse.json({ error: 'Errore interno del server durante il recupero dei giochi locali' }, { status: 500 });
  }
}

