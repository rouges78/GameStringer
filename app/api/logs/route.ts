import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';

export const POST = withErrorHandler(async function(request: NextRequest) {
  try {
    const body = await request.json();
    const { logs } = body;

    if (!logs || !Array.isArray(logs)) {
      throw new ValidationError('Invalid logs data. Expected array of log entries.');
    }

    // Process each log entry
    for (const logEntry of logs) {
      const { level, message, component, metadata, error } = logEntry;
      
      if (!level || !message) {
        continue; // Skip invalid entries
      }

      // Add client-side context
      const clientMetadata = {
        source: 'client',
        url: logEntry.url,
        userAgent: logEntry.userAgent,
        sessionId: logEntry.sessionId,
        userId: logEntry.userId,
        timestamp: logEntry.timestamp,
        ...metadata
      };

      // Log based on level
      switch (level) {
        case 'debug':
          logger.debug(message, component, clientMetadata);
          break;
        case 'info':
          logger.info(message, component, clientMetadata);
          break;
        case 'warn':
          logger.warn(message, component, clientMetadata);
          break;
        case 'error':
        case 'fatal':
          if (error) {
            // Create error object from client data
            const errorObj = new Error(error.message);
            errorObj.name = error.name;
            errorObj.stack = error.stack;
            logger.logError(errorObj, component, clientMetadata);
          } else {
            logger.error(message, component, clientMetadata);
          }
          break;
        default:
          logger.info(message, component, clientMetadata);
      }
    }

    return NextResponse.json({ 
      message: 'Logs processed successfully',
      count: logs.length
    });

  } catch (error) {
    console.error('Error processing client logs:', error);
    throw error;
  }
});

export const GET = withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const component = searchParams.get('component');
    const limit = parseInt(searchParams.get('limit') || '100');

    // This is a simplified implementation
    // In production, you'd want to query from a database or log store
    const config = logger.getConfig();
    
    return NextResponse.json({
      config,
      bufferSize: logger.getBufferSize(),
      message: 'Log endpoint is working. Use POST to send logs.'
    });

  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
});

export const DELETE = withErrorHandler(async function(request: NextRequest) {
  try {
    // Clear log buffer (for development/testing)
    logger.clearBuffer();
    
    return NextResponse.json({
      message: 'Log buffer cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing logs:', error);
    throw error;
  }
});