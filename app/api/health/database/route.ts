import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseHealthMonitor } from '@/lib/prisma';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

export const GET = withErrorHandler(async function(request: NextRequest) {
  try {
    logger.info('Database health check requested', 'DATABASE_HEALTH_API');

    const healthMonitor = getDatabaseHealthMonitor();
    
    if (!healthMonitor) {
      return NextResponse.json({
        error: 'Database health monitor not initialized',
        status: 'unavailable'
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const force = searchParams.get('force') === 'true';

    let healthStatus;
    
    if (force) {
      // Forza un nuovo health check
      logger.info('Forcing new database health check', 'DATABASE_HEALTH_API');
      healthStatus = await healthMonitor.performHealthCheck();
    } else {
      // Usa l'ultimo health check se disponibile
      healthStatus = healthMonitor.getLastHealthCheck();
      
      if (!healthStatus) {
        logger.info('No cached health status, performing new check', 'DATABASE_HEALTH_API');
        healthStatus = await healthMonitor.performHealthCheck();
      }
    }

    const response: any = {
      status: healthStatus.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: healthStatus.lastCheck,
      latency: healthStatus.latency,
      uptime: healthStatus.uptime,
      connections: healthStatus.connections
    };

    if (detailed) {
      response.detailed = {
        version: healthStatus.version,
        diskSpace: healthStatus.diskSpace,
        errors: healthStatus.errors,
        stats: await healthMonitor.getDatabaseStats()
      };
    }

    if (!healthStatus.isHealthy) {
      response.errors = healthStatus.errors;
      logger.warn('Database health check failed', 'DATABASE_HEALTH_API', {
        errors: healthStatus.errors,
        latency: healthStatus.latency
      });
    }

    const statusCode = healthStatus.isHealthy ? 200 : 503;
    
    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    logger.error('Database health check endpoint failed', 'DATABASE_HEALTH_API', { error });
    
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

export const POST = withErrorHandler(async function(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    logger.info(`Database health action requested: ${action}`, 'DATABASE_HEALTH_API');

    const healthMonitor = getDatabaseHealthMonitor();
    
    if (!healthMonitor) {
      return NextResponse.json({
        error: 'Database health monitor not initialized',
        status: 'unavailable'
      }, { status: 503 });
    }

    switch (action) {
      case 'reconnect':
        await healthMonitor.reconnect();
        logger.info('Database reconnection completed', 'DATABASE_HEALTH_API');
        
        return NextResponse.json({
          status: 'success',
          message: 'Database reconnection completed',
          timestamp: new Date().toISOString()
        });

      case 'start-monitoring':
        const interval = body.interval || 60000;
        healthMonitor.startHealthMonitoring(interval);
        logger.info(`Database health monitoring started (${interval}ms)`, 'DATABASE_HEALTH_API');
        
        return NextResponse.json({
          status: 'success',
          message: `Health monitoring started with ${interval}ms interval`,
          timestamp: new Date().toISOString()
        });

      case 'stop-monitoring':
        healthMonitor.stopHealthMonitoring();
        logger.info('Database health monitoring stopped', 'DATABASE_HEALTH_API');
        
        return NextResponse.json({
          status: 'success',
          message: 'Health monitoring stopped',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['reconnect', 'start-monitoring', 'stop-monitoring']
        }, { status: 400 });
    }

  } catch (error) {
    logger.error('Database health action failed', 'DATABASE_HEALTH_API', { error });
    
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});