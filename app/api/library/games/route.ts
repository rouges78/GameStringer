import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Per ora simuliamo i giochi Steam rilevati
    // In futuro qui andrebbe la logica per recuperare realmente i giochi dal backend Tauri
    
    const steamGames = [
      {
        id: 'steam_570',
        name: 'Dota 2',
        imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
        provider: 'Steam'
      },
      {
        id: 'steam_730',
        name: 'Counter-Strike 2',
        imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
        provider: 'Steam'
      },
      {
        id: 'steam_440',
        name: 'Team Fortress 2',
        imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg',
        provider: 'Steam'
      },
      {
        id: 'steam_1172470',
        name: 'Apex Legends',
        imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg',
        provider: 'Steam'
      },
      {
        id: 'steam_271590',
        name: 'Grand Theft Auto V',
        imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg',
        provider: 'Steam'
      },
      {
        id: 'steam_1085660',
        name: 'Destiny 2',
        imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1085660/header.jpg',
        provider: 'Steam'
      }
    ];
    
    console.log(`Restituendo ${steamGames.length} giochi Steam dalla libreria`);
    
    return NextResponse.json({
      success: true,
      games: steamGames,
      totalGames: steamGames.length,
      providers: ['Steam']
    });
    
  } catch (error) {
    console.error('Errore durante il recupero dei giochi:', error);
    return NextResponse.json({
      error: 'Errore interno del server durante il recupero dei giochi'
    }, { status: 500 });
  }
}
