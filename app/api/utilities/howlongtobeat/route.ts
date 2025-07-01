import { NextRequest, NextResponse } from 'next/server';
import { HowLongToBeatService } from 'howlongtobeat';

const hltbService = new HowLongToBeatService();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gameName = searchParams.get('name');
    
    if (!gameName) {
      return NextResponse.json({ error: 'Nome del gioco richiesto' }, { status: 400 });
    }

    // Search for the game
    const searchResults = await hltbService.search(gameName);
    
    if (searchResults.length === 0) {
      return NextResponse.json({ 
        found: false,
        message: 'Nessun risultato trovato su HowLongToBeat' 
      });
    }

    // Get the most relevant result (first one)
    const game = searchResults[0];
    
    // Format the response
    const gameInfo = {
      found: true,
      id: game.id,
      name: game.name,
      imageUrl: game.imageUrl,
      description: game.description,
      platforms: game.platforms,
      times: {
        mainStory: {
          hours: game.gameplayMain,
          label: 'Storia Principale'
        },
        mainExtra: {
          hours: game.gameplayMainExtra,
          label: 'Storia + Extra'
        },
        completionist: {
          hours: game.gameplayCompletionist,
          label: 'Completista'
        }
      },
      similarity: game.similarity, // How similar the result is to the search query
      searchTerm: gameName
    };

    return NextResponse.json(gameInfo);

  } catch (error) {
    console.error('HowLongToBeat API error:', error);
    return NextResponse.json({ 
      error: 'Errore durante la ricerca su HowLongToBeat',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gameNames } = await request.json();
    
    if (!Array.isArray(gameNames)) {
      return NextResponse.json({ error: 'Array di nomi richiesto' }, { status: 400 });
    }

    // Batch search for multiple games
    const results = await Promise.all(
      gameNames.map(async (name) => {
        try {
          const searchResults = await hltbService.search(name);
          if (searchResults.length > 0) {
            const game = searchResults[0];
            return {
              name: name,
              found: true,
              data: {
                id: game.id,
                name: game.name,
                mainStory: game.gameplayMain,
                mainExtra: game.gameplayMainExtra,
                completionist: game.gameplayCompletionist,
                imageUrl: game.imageUrl
              }
            };
          }
          return { name, found: false };
        } catch (error) {
          return { name, found: false, error: 'Search failed' };
        }
      })
    );

    return NextResponse.json({ results });

  } catch (error) {
    console.error('HowLongToBeat batch API error:', error);
    return NextResponse.json({ 
      error: 'Errore durante la ricerca batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}