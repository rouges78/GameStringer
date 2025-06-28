import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getSteamLibraryFolders, findSteamGamePath } from '@/lib/steam-utils';

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  img_logo_url: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const steamAccount = session.user.accounts?.find(acc => acc.provider === 'steam-credentials');
    if (!steamAccount) {
        return NextResponse.json({ games: [] }); 
    }
    const steamId = steamAccount.providerAccountId;

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      console.error('STEAM_API_KEY non è impostata nel file .env');
      return NextResponse.json({ error: 'Configurazione del server incompleta' }, { status: 500 });
    }

    const url = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_appinfo=1`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Errore API Steam: ${response.status} ${response.statusText}`);
      return NextResponse.json({ error: 'Impossibile contattare i server di Steam' }, { status: response.status });
    }

    const data = await response.json();
    const allGames: SteamGame[] = data.response?.games || [];

    const libraryFolders = await getSteamLibraryFolders();
    
    const installedGamesPromises = allGames.map(async (game) => {
      try {
        const gamePath = await findSteamGamePath(String(game.appid), libraryFolders);
        if (gamePath) {
          return {
            id: `${game.appid}`,
            name: game.name,
            imageUrl: `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`,
            provider: 'steam',
          };
        }
      } catch (e) {
        console.error(`Errore durante la verifica del gioco ${game.appid}:`, e);
      }
      return null;
    });

    const results = await Promise.allSettled(installedGamesPromises);
    const installedGames = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        installedGames.push(result.value);
      }
    }

    return NextResponse.json({ games: installedGames });

  } catch (error) {
    console.error('Errore API in games:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
