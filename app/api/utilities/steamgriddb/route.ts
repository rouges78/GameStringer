import { NextRequest, NextResponse } from 'next/server';
import SGDB from 'steamgriddb';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const gameName = searchParams.get('name');
    const type = searchParams.get('type') || 'grid'; // grid only for now
    
    if (!gameName) {
      return NextResponse.json({ error: 'Nome del gioco richiesto' }, { status: 400 });
    }

    // Get API key from header or user preferences
    let apiKey = request.headers.get('X-API-Key') || searchParams.get('apiKey');
    
    if (!apiKey && session.user.id) {
      // Try to get from user preferences
      const preference = await prisma.userPreference.findUnique({
        where: {
          userId_key: {
            userId: session.user.id,
            key: 'utility_steamgriddb',
          },
        },
      });
      
      if (preference) {
        const prefData = JSON.parse(preference.value);
        apiKey = prefData.apiKey;
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key di SteamGridDB richiesta' }, { status: 401 });
    }

    const sgdb = new SGDB(apiKey);

    // Search for the game
    const games = await sgdb.searchGame(gameName);
    
    if (!games || games.length === 0) {
      return NextResponse.json({
        found: false,
        message: 'Nessun gioco trovato su SteamGridDB'
      });
    }

    const game = games[0];
    let assets: any[] = [];

    // Get grids (the main supported asset type)
    try {
      assets = await sgdb.getGrids({ type: 'game', id: game.id });
    } catch (err) {
      console.error('Error fetching grids:', err);
    }

    return NextResponse.json({
      found: true,
      game: {
        id: game.id,
        name: game.name,
        types: game.types,
        verified: game.verified
      },
      assets: assets.map((asset: any) => ({
        id: asset.id,
        url: asset.url,
        thumb: asset.thumb,
        width: asset.width,
        height: asset.height,
        style: asset.style,
        score: asset.score,
        author: asset.author?.name || 'Unknown'
      })),
      assetType: 'grid'
    });

  } catch (error) {
    console.error('SteamGridDB API error:', error);
    return NextResponse.json({
      error: 'Errore durante la ricerca su SteamGridDB',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gameName, steamAppId, apiKey } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key richiesta' }, { status: 400 });
    }

    if (!gameName && !steamAppId) {
      return NextResponse.json({ error: 'Nome gioco o Steam App ID richiesto' }, { status: 400 });
    }

    const sgdb = new SGDB(apiKey);
    let grids: any[] = [];

    try {
      if (steamAppId) {
        // Search by Steam App ID
        grids = await sgdb.getGrids({ type: 'game', id: steamAppId });
      } else if (gameName) {
        // Search by game name
        const games = await sgdb.searchGame(gameName);
        if (games && games.length > 0) {
          grids = await sgdb.getGrids({ type: 'game', id: games[0].id });
        }
      }
    } catch (err) {
      console.error('Error fetching grids:', err);
    }

    // Format response
    const formattedAssets = grids.slice(0, 10).map((asset: any) => ({
      id: asset.id,
      url: asset.url,
      thumb: asset.thumb,
      width: asset.width,
      height: asset.height,
      style: asset.style,
      score: asset.score,
      author: asset.author?.name || 'Unknown'
    }));

    return NextResponse.json({
      found: formattedAssets.length > 0,
      assets: formattedAssets,
      totalAssets: formattedAssets.length
    });

  } catch (error) {
    console.error('SteamGridDB batch API error:', error);
    return NextResponse.json({
      error: 'Errore durante il recupero degli asset',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}