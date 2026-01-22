import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

interface SyncRequest {
  provider?: string;
  forceRefresh?: boolean;
  includeUninstalled?: boolean;
}

interface SyncResult {
  success: boolean;
  gamesAdded: number;
  gamesUpdated: number;
  gamesRemoved: number;
  totalGames: number;
  providers: string[];
  errors: string[];
  duration: number;
}

export const POST = withErrorHandler(async function(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: SyncRequest = await request.json();
    const { provider, forceRefresh = false, includeUninstalled = true } = body;

    logger.info('Game library sync started', 'LIBRARY_SYNC', {
      provider,
      forceRefresh,
      includeUninstalled
    });

    // Check if we're in a Tauri environment
    const isTauriEnvironment = typeof window !== 'undefined' && (window as any).__TAURI__;
    
    if (!isTauriEnvironment) {
      return NextResponse.json({
        success: false,
        message: 'Game library sync requires desktop app',
        error: 'Tauri environment not available'
      }, { status: 400 });
    }

    // Use Tauri integration for real game sync
    const { tauriIntegration } = await import('@/lib/tauri-integration');
    await tauriIntegration.initialize();

    let allGames;
    if (provider) {
      allGames = await tauriIntegration.getGamesFromStore(provider);
    } else {
      allGames = await tauriIntegration.getAllGames();
    }

    // Sync games to database
    const syncResult = await syncGamesToDatabase(allGames, forceRefresh, includeUninstalled);

    const duration = Date.now() - startTime;

    logger.info('Game library sync completed', 'LIBRARY_SYNC', {
      ...syncResult,
      duration
    });

    return NextResponse.json({
      ...syncResult,
      duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Game library sync failed', 'LIBRARY_SYNC', { error, duration });
    throw error;
  }
});

async function syncGamesToDatabase(
  games: any[],
  forceRefresh: boolean,
  includeUninstalled: boolean
): Promise<SyncResult> {
  const errors: string[] = [];
  let gamesAdded = 0;
  let gamesUpdated = 0;
  let gamesRemoved = 0;
  
  const providers = [...new Set(games.map(g => g.provider))];

  try {
    // Filter games if needed
    const filteredGames = includeUninstalled 
      ? games 
      : games.filter(game => game.installed);

    // Process each game
    for (const game of filteredGames) {
      try {
        // Check if game already exists
        const existingGame = await prisma.game.findFirst({
          where: {
            OR: [
              { id: game.id },
              game.id.startsWith('steam_') ? { steamAppId: parseInt(game.id.replace('steam_', '')) } : {},
              { title: game.name, platform: game.provider }
            ]
          }
        });

        if (existingGame) {
          // Update existing game
          if (forceRefresh || shouldUpdateGame(existingGame, game)) {
            await prisma.game.update({
              where: { id: existingGame.id },
              data: {
                title: game.name,
                platform: game.provider,
                imageUrl: game.imageUrl,
                isInstalled: game.installed,
                lastPlayed: game.lastPlayed ? new Date(game.lastPlayed) : null,
                installPath: game.installPath,
                executablePath: game.executablePath,
                steamAppId: game.id.startsWith('steam_') ? parseInt(game.id.replace('steam_', '')) : null,
                updatedAt: new Date()
              }
            });
            gamesUpdated++;
          }
        } else {
          // Create new game
          await prisma.game.create({
            data: {
              title: game.name,
              platform: game.provider,
              imageUrl: game.imageUrl,
              isInstalled: game.installed,
              lastPlayed: game.lastPlayed ? new Date(game.lastPlayed) : null,
              installPath: game.installPath,
              executablePath: game.executablePath,
              steamAppId: game.id.startsWith('steam_') ? parseInt(game.id.replace('steam_', '')) : null
            }
          });
          gamesAdded++;
        }
      } catch (gameError) {
        const errorMessage = `Failed to sync game ${game.name}: ${gameError instanceof Error ? gameError.message : 'Unknown error'}`;
        errors.push(errorMessage);
        logger.warn('Failed to sync individual game', 'LIBRARY_SYNC', { 
          game: game.name, 
          error: gameError 
        });
      }
    }

    // Remove games that are no longer detected (optional)
    if (forceRefresh) {
      const gameIds = filteredGames.map(g => g.id);
      const platformsToClean = providers;
      
      const removedGames = await prisma.game.deleteMany({
        where: {
          platform: { in: platformsToClean },
          NOT: {
            OR: [
              { id: { in: gameIds } },
              { title: { in: filteredGames.map(g => g.name) } }
            ]
          }
        }
      });
      
      gamesRemoved = removedGames.count;
    }

    const totalGames = await prisma.game.count({
      where: providers.length > 0 ? { platform: { in: providers } } : {}
    });

    return {
      success: true,
      gamesAdded,
      gamesUpdated,
      gamesRemoved,
      totalGames,
      providers,
      errors,
      duration: 0
    };

  } catch (error) {
    logger.error('Database sync failed', 'LIBRARY_SYNC', { error });
    throw error;
  }
}

function shouldUpdateGame(existingGame: any, newGame: any): boolean {
  // Check if any important fields have changed
  if (existingGame.title !== newGame.name) return true;
  if (existingGame.isInstalled !== newGame.installed) return true;
  if (existingGame.imageUrl !== newGame.imageUrl) return true;
  if (existingGame.installPath !== newGame.installPath) return true;
  if (existingGame.executablePath !== newGame.executablePath) return true;
  
  // Check if last played date has changed
  if (newGame.lastPlayed) {
    const newLastPlayed = new Date(newGame.lastPlayed);
    const existingLastPlayed = existingGame.lastPlayed ? new Date(existingGame.lastPlayed) : null;
    
    if (!existingLastPlayed || newLastPlayed.getTime() !== existingLastPlayed.getTime()) {
      return true;
    }
  }

  return false;
}

export const GET = withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'status') {
      // Get sync status and statistics
      const totalGames = await prisma.game.count();
      const providers = await prisma.game.groupBy({
        by: ['platform'],
        _count: { platform: true }
      });

      const installedGames = await prisma.game.count({
        where: { isInstalled: true }
      });

      const recentlyPlayed = await prisma.game.count({
        where: {
          lastPlayed: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      });

      return NextResponse.json({
        totalGames,
        installedGames,
        recentlyPlayed,
        providers: providers.map(p => ({
          platform: p.platform,
          count: p._count.platform
        })),
        lastSync: new Date().toISOString() // This would be stored in database in real implementation
      });
    }

    return NextResponse.json({
      message: 'Library sync API endpoint',
      availableActions: ['status'],
      usage: 'POST /api/library/sync with { provider?, forceRefresh?, includeUninstalled? }'
    });

  } catch (error) {
    logger.error('Library sync status request failed', 'LIBRARY_SYNC', { error });
    throw error;
  }
});