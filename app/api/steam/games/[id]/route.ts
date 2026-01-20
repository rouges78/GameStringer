import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;
    
    // Prova a ottenere il nome del gioco dalla query string (passato dal frontend)
    const url = new URL(request.url);
    const gameName = url.searchParams.get('name');
    const installDir = url.searchParams.get('installDir');
    const isInstalled = url.searchParams.get('installed') === 'true';
    
    // Costruisci dati base con le info disponibili
    const gameData = {
      appid: parseInt(gameId),
      name: gameName || `Game ${gameId}`,
      install_dir: installDir || null,
      short_description: 'Descrizione non disponibile.',
      header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/header.jpg`,
      developers: [],
      publishers: [],
      release_date: { coming_soon: false, date: '' },
      is_free: false,
      supported_languages: '',
      categories: [],
      genres: [],
      is_installed: isInstalled
    };
    
    return NextResponse.json(gameData);
    
  } catch (error) {
    console.error(`Errore durante il recupero del gioco ${params.id}:`, error);
    return NextResponse.json({
      error: 'Errore interno del server durante il recupero del gioco'
    }, { status: 500 });
  }
}