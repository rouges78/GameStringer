import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

// Real store connection testing using Tauri integration
const testStoreConnection = async (storeId: string): Promise<{ connected: boolean; error?: string; gamesCount?: number; lastSync?: string }> => {
  try {
    // Check if we're in a Tauri environment
    const isTauriEnvironment = typeof window !== 'undefined' && (window as any).__TAURI__;
    
    if (isTauriEnvironment) {
      // Use real Tauri integration
      const { tauriIntegration } = await import('@/lib/tauri-integration');
      await tauriIntegration.initialize();
      
      const result = await tauriIntegration.testStoreConnection(storeId);
      
      logger.info(`Store connection test completed`, 'STORES_API', { 
        storeId, 
        connected: result.connected,
        gamesCount: result.gamesCount 
      });
      
      return result;
    } else {
      // Web fallback - check database or return limited info
      try {
        const { prisma } = await import('@/lib/prisma');
        const { secretsManager } = await import('@/lib/secrets-manager');
        
        await secretsManager.initialize();
        
        let connected = false;
        let error = '';
        let gamesCount = 0;
        
        switch (storeId) {
          case 'steam':
            // Check if Steam API key is available
            connected = secretsManager.isAvailable('STEAM_API_KEY');
            if (!connected) {
              error = 'Steam API key not configured';
            } else {
              // Count games from database
              gamesCount = await prisma.game.count({ where: { platform: 'Steam' } });
            }
            break;
          
          case 'epic':
            // Check if Epic credentials are available
            connected = secretsManager.isAvailable('EPIC_CLIENT_ID') && secretsManager.isAvailable('EPIC_CLIENT_SECRET');
            if (!connected) {
              error = 'Epic Games credentials not configured';
            } else {
              gamesCount = await prisma.game.count({ where: { platform: 'Epic Games' } });
            }
            break;
          
          case 'itchio':
            // Check if itch.io credentials are available
            connected = secretsManager.isAvailable('ITCHIO_CLIENT_ID') && secretsManager.isAvailable('ITCHIO_CLIENT_SECRET');
            if (!connected) {
              error = 'itch.io credentials not configured';
            } else {
              gamesCount = await prisma.game.count({ where: { platform: 'itch.io' } });
            }
            break;
          
          case 'gog':
          case 'origin':
          case 'ubisoft':
          case 'battlenet':
            // These require Tauri environment
            connected = false;
            error = `${storeId} integration requires desktop app`;
            break;
          
          default:
            connected = false;
            error = 'Store not supported';
        }
        
        return { 
          connected, 
          error: error || undefined, 
          gamesCount: gamesCount > 0 ? gamesCount : undefined,
          lastSync: new Date().toISOString()
        };
      } catch (dbError) {
        logger.warn(`Database error during store test: ${storeId}`, 'STORES_API', { error: dbError });
        return { 
          connected: false, 
          error: 'Database unavailable' 
        };
      }
    }
  } catch (error) {
    logger.error(`Store connection test failed: ${storeId}`, 'STORES_API', { error });
    return { 
      connected: false, 
      error: `Error during test: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

export const GET = withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store');
    
    if (!storeId) {
      return NextResponse.json({
        error: 'Store ID è richiesto'
      }, { status: 400 });
    }
    
    logger.info(`Testing store connection: ${storeId}`, 'STORES_API');
    
    const result = await testStoreConnection(storeId);
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error during store connection test', 'STORES_API', { error });
    throw error;
  }
});

export const POST = withErrorHandler(async function(request: NextRequest) {
  try {
    const { storeId, action } = await request.json();
    
    if (!storeId || !action) {
      return NextResponse.json({
        error: 'Store ID e azione sono richiesti'
      }, { status: 400 });
    }
    
    logger.info(`Store operation requested: ${action} for ${storeId}`, 'STORES_API');
    
    switch (action) {
      case 'connect':
        // Real connection logic would go here
        // For now, just test the connection
        const connectResult = await testStoreConnection(storeId);
        
        if (connectResult.connected) {
          // Try to sync games if connection is successful
          try {
            const { tauriIntegration } = await import('@/lib/tauri-integration');
            await tauriIntegration.initialize();
            
            if (tauriIntegration.isTauriEnvironment()) {
              const syncResult = await tauriIntegration.syncGameLibrary();
              
              return NextResponse.json({ 
                success: true, 
                message: `${storeId} connected and ${syncResult.gamesCount} games synced`,
                gamesCount: syncResult.gamesCount
              });
            } else {
              return NextResponse.json({ 
                success: true, 
                message: `${storeId} connection verified`,
                gamesCount: connectResult.gamesCount
              });
            }
          } catch (syncError) {
            logger.warn(`Failed to sync games for ${storeId}`, 'STORES_API', { error: syncError });
            return NextResponse.json({ 
              success: true, 
              message: `${storeId} connected but sync failed`,
              warning: 'Game sync failed'
            });
          }
        } else {
          return NextResponse.json({ 
            success: false, 
            message: `Failed to connect to ${storeId}`,
            error: connectResult.error
          }, { status: 400 });
        }
      
      case 'disconnect':
        // Real disconnection logic would go here
        logger.info(`Disconnection from ${storeId} requested`, 'STORES_API');
        return NextResponse.json({ 
          success: true, 
          message: `${storeId} disconnected` 
        });
      
      case 'refresh':
        // Refresh store connection status
        const refreshResult = await testStoreConnection(storeId);
        return NextResponse.json(refreshResult);
      
      case 'sync':
        // Manual sync request
        try {
          const { tauriIntegration } = await import('@/lib/tauri-integration');
          await tauriIntegration.initialize();
          
          if (tauriIntegration.isTauriEnvironment()) {
            const games = await tauriIntegration.getGamesFromStore(storeId);
            
            return NextResponse.json({ 
              success: true, 
              message: `${games.length} games synced from ${storeId}`,
              gamesCount: games.length,
              games: games.slice(0, 5) // Return first 5 games as sample
            });
          } else {
            return NextResponse.json({ 
              success: false, 
              message: `Sync requires desktop app`,
              error: 'Tauri environment not available'
            }, { status: 400 });
          }
        } catch (syncError) {
          logger.error(`Sync failed for ${storeId}`, 'STORES_API', { error: syncError });
          return NextResponse.json({ 
            success: false, 
            message: `Sync failed for ${storeId}`,
            error: syncError instanceof Error ? syncError.message : 'Unknown error'
          }, { status: 500 });
        }
      
      default:
        return NextResponse.json({
          error: 'Azione non supportata. Azioni disponibili: connect, disconnect, refresh, sync'
        }, { status: 400 });
    }
  } catch (error) {
    logger.error('Error during store operation', 'STORES_API', { error });
    throw error;
  }
});
