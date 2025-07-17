import { NextRequest, NextResponse } from 'next/server';
import { RateLimitStats } from '@/lib/rate-limiter';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export const GET = withErrorHandler(async function(request: NextRequest) {
  try {
    logger.info('Rate limit statistics requested', 'RATE_LIMIT_ADMIN');

    const stats = RateLimitStats.getInstance();
    const currentStats = stats.getStats();

    const response = {
      timestamp: new Date().toISOString(),
      statistics: currentStats,
      summary: {
        totalRequests: Object.values(currentStats).reduce((sum, stat) => sum + stat.requests, 0),
        totalBlocked: Object.values(currentStats).reduce((sum, stat) => sum + stat.blocked, 0),
        overallBlockRate: 0
      }
    };

    // Calculate overall block rate
    if (response.summary.totalRequests > 0) {
      response.summary.overallBlockRate = (response.summary.totalBlocked / response.summary.totalRequests) * 100;
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    logger.error('Rate limit statistics request failed', 'RATE_LIMIT_ADMIN', { error });
    
    return NextResponse.json({
      error: 'Failed to retrieve rate limit statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

export const POST = withErrorHandler(async function(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    logger.info(`Rate limit admin action: ${action}`, 'RATE_LIMIT_ADMIN');

    const stats = RateLimitStats.getInstance();

    switch (action) {
      case 'reset':
        stats.reset();
        logger.info('Rate limit statistics reset', 'RATE_LIMIT_ADMIN');
        
        return NextResponse.json({
          success: true,
          message: 'Rate limit statistics reset successfully',
          timestamp: new Date().toISOString()
        });

      case 'status':
        const currentStats = stats.getStats();
        return NextResponse.json({
          success: true,
          statistics: currentStats,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['reset', 'status']
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('Rate limit admin action failed', 'RATE_LIMIT_ADMIN', { error });
    
    return NextResponse.json({
      error: 'Failed to perform rate limit action',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});