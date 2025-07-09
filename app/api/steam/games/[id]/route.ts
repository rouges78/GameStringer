import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;
    
    // Simuliamo la chiamata al backend Tauri per ottenere i dettagli del gioco
    // In futuro qui dovrebbe esserci la chiamata reale a invoke('get_game_details', { gameId })
    
    // Per ora simuliamo alcuni giochi noti con dati ricchi
    const mockGameData: Record<string, any> = {
      '570': {
        appid: 570,
        name: 'Dota 2',
        short_description: 'Dota 2 è un gioco multiplayer online battle arena (MOBA) sviluppato e pubblicato da Valve.',
        header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
        website: 'http://www.dota2.com/',
        developers: ['Valve'],
        publishers: ['Valve'],
        release_date: { coming_soon: false, date: '9 lug 2013' },
        is_free: true,
        supported_languages: 'Inglese, Russo, Cinese semplificato, Spagnolo - Spagna, Portoghese - Brasile',
        pc_requirements: {
          minimum: '<strong>Minimum:</strong><br><ul class="bb_ul"><li><strong>OS:</strong> Windows 7 or newer<br></li><li><strong>Processor:</strong> Dual core from Intel or AMD at 2.8 GHz<br></li><li><strong>Memory:</strong> 4 GB RAM<br></li><li><strong>Graphics:</strong> nVidia GeForce 8600/9600GT, ATI/AMD Radeon HD2600/3600<br></li><li><strong>DirectX:</strong> Version 9.0c<br></li><li><strong>Network:</strong> Broadband Internet connection<br></li><li><strong>Storage:</strong> 15 GB available space<br></li><li><strong>Sound Card:</strong> DirectX Compatible</li></ul>'
        },
        categories: [
          { id: 1, description: 'Multi-player' },
          { id: 9, description: 'Co-op' },
          { id: 22, description: 'Steam Achievements' }
        ],
        genres: [
          { id: 1, description: 'Action' },
          { id: 23, description: 'Indie' },
          { id: 2, description: 'Strategy' }
        ],
        is_installed: true
      },
      '730': {
        appid: 730,
        name: 'Counter-Strike 2',
        short_description: 'Per oltre due decenni, Counter-Strike ha offerto un\'esperienza di gioco competitiva di élite.',
        header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
        website: 'https://www.counter-strike.net/',
        developers: ['Valve'],
        publishers: ['Valve'],
        release_date: { coming_soon: false, date: '21 ago 2012' },
        is_free: true,
        supported_languages: 'Inglese, Francese, Italiano, Tedesco, Spagnolo',
        pc_requirements: {
          minimum: '<strong>Minimum:</strong><br><ul class="bb_ul"><li><strong>OS:</strong> Windows 10<br></li><li><strong>Processor:</strong> 4 hardware CPU threads - Intel® Core™ i5 750 or higher<br></li><li><strong>Memory:</strong> 8 GB RAM<br></li><li><strong>Graphics:</strong> Video card must be 1 GB or more and should be a DirectX 11-compatible<br></li><li><strong>DirectX:</strong> Version 11<br></li><li><strong>Storage:</strong> 85 GB available space</li></ul>'
        },
        categories: [
          { id: 1, description: 'Multi-player' },
          { id: 8, description: 'Valve Anti-Cheat enabled' },
          { id: 22, description: 'Steam Achievements' }
        ],
        genres: [
          { id: 1, description: 'Action' },
          { id: 37, description: 'Free to Play' }
        ],
        is_installed: false
      },
      '271590': {
        appid: 271590,
        name: 'Grand Theft Auto V',
        short_description: 'Quando un giovane spacciatore di strada, un ladro in pensione e un psychopatico terrificante si trovano invischiati con alcuni dei criminali più spaventosi e deragliati del mondo criminale...',
        header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg',
        website: 'http://www.rockstargames.com/V/',
        developers: ['Rockstar North'],
        publishers: ['Rockstar Games'],
        release_date: { coming_soon: false, date: '14 apr 2015' },
        is_free: false,
        supported_languages: 'Inglese, Francese, Italiano, Tedesco, Spagnolo, Giapponese, Russo, Portoghese',
        pc_requirements: {
          minimum: '<strong>Minimum:</strong><br><ul class="bb_ul"><li><strong>OS:</strong> Windows 8.1 64 Bit, Windows 8 64 Bit, Windows 7 64 Bit Service Pack 1<br></li><li><strong>Processor:</strong> Intel Core 2 Quad CPU Q6600 @ 2.40GHz (4 CPUs) / AMD Phenom 9850 Quad-Core Processor (4 CPUs) @ 2.5GHz<br></li><li><strong>Memory:</strong> 4 GB RAM<br></li><li><strong>Graphics:</strong> NVIDIA 9800 GT 1GB / AMD HD 4870 1GB (DX 10, 10.1, 11)<br></li><li><strong>Storage:</strong> 72 GB available space<br></li><li><strong>Sound Card:</strong> 100% DirectX 10 compatible</li></ul>',
          recommended: '<strong>Recommended:</strong><br><ul class="bb_ul"><li><strong>OS:</strong> Windows 8.1 64 Bit, Windows 8 64 Bit, Windows 7 64 Bit Service Pack 1<br></li><li><strong>Processor:</strong> Intel Core i5 3470 @ 3.2GHz (4 CPUs) / AMD X8 FX-8350 @ 4GHz (8 CPUs)<br></li><li><strong>Memory:</strong> 8 GB RAM<br></li><li><strong>Graphics:</strong> NVIDIA GTX 660 2GB / AMD HD 7870 2GB<br></li><li><strong>Storage:</strong> 72 GB available space<br></li><li><strong>Sound Card:</strong> 100% DirectX 10 compatible</li></ul>'
        },
        categories: [
          { id: 2, description: 'Single-player' },
          { id: 1, description: 'Multi-player' },
          { id: 22, description: 'Steam Achievements' },
          { id: 28, description: 'Full controller support' }
        ],
        genres: [
          { id: 1, description: 'Action' },
          { id: 3, description: 'Adventure' }
        ],
        is_installed: true
      }
    };

    const gameData = mockGameData[gameId];
    
    if (!gameData) {
      // Se non abbiamo dati mock, creiamo una struttura base
      const basicGameData = {
        appid: parseInt(gameId),
        name: `Gioco ${gameId}`,
        short_description: 'Descrizione non disponibile.',
        header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/header.jpg`,
        developers: ['Sconosciuto'],
        publishers: ['Sconosciuto'],
        release_date: { coming_soon: false, date: 'Data non disponibile' },
        is_free: false,
        supported_languages: 'Inglese',
        categories: [],
        genres: [],
        is_installed: false
      };
      
      console.log(`Restituendo dati base per il gioco ${gameId}`);
      return NextResponse.json(basicGameData);
    }
    
    console.log(`Restituendo dati dettagliati per il gioco ${gameId}: ${gameData.name}`);
    return NextResponse.json(gameData);
    
  } catch (error) {
    console.error(`Errore durante il recupero del gioco ${params.id}:`, error);
    return NextResponse.json({
      error: 'Errore interno del server durante il recupero del gioco'
    }, { status: 500 });
  }
}