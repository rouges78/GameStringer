import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export const GET = withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const forceRefresh = searchParams.get('refresh') === 'true';

    logger.info('Fetching game library', 'GAMES_API', { provider, forceRefresh });

    // Check if we're in a Tauri environment
    const isTauriEnvironment = typeof window !== 'undefined' && (window as any).__TAURI__;
    
    if (isTauriEnvironment) {
      // Use Tauri integration for real game detection
      const { tauriIntegration } = await import('@/lib/tauri-integration');
      await tauriIntegration.initialize();

      let games;
      if (provider) {
        games = await tauriIntegration.getGamesFromStore(provider);
      } else {
        games = await tauriIntegration.getAllGames();
      }

      const providers = [...new Set(games.map(g => g.provider))];

      logger.info(`Retrieved ${games.length} games from library`, 'GAMES_API', { 
        providers, 
        gamesCount: games.length 
      });

      return NextResponse.json({
        success: true,
        games,
        totalGames: games.length,
        providers,
        source: 'tauri'
      });
    } else {
      // Web fallback - try to get games from database or return empty
      try {
        const { prisma } = await import('@/lib/prisma');
        const games = await prisma.game.findMany({
          where: provider ? { platform: provider } : {},
          select: {
            id: true,
            title: true,
            platform: true,
            imageUrl: true,
            isInstalled: true,
            lastPlayed: true,
            steamAppId: true,
            installPath: true,
            executablePath: true
          }
        });

        const formattedGames = games.map(game => ({
          id: game.id,
          name: game.title,
          provider: game.platform,
          imageUrl: game.imageUrl,
          installed: game.isInstalled,
          lastPlayed: game.lastPlayed?.toISOString(),
          installPath: game.installPath,
          executablePath: game.executablePath
        }));

        const providers = [...new Set(formattedGames.map(g => g.provider))];

        logger.info(`Retrieved ${formattedGames.length} games from database`, 'GAMES_API', { 
          providers,
          gamesCount: formattedGames.length
        });

        return NextResponse.json({
          success: true,
          games: formattedGames,
          totalGames: formattedGames.length,
          providers,
          source: 'database'
        });
      } catch (dbError) {
        logger.warn('Database unavailable, returning empty library', 'GAMES_API', { error: dbError });
        
        return NextResponse.json({
          success: true,
          games: [],
          totalGames: 0,
          providers: [],
          source: 'empty',
          message: 'No games found. Install the desktop app for full game detection.'
        });
      }
    }
  } catch (error) {
    logger.error('Error fetching game library', 'GAMES_API', { error });
    throw error;
  }
});
