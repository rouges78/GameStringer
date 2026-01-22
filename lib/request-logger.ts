import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

export interface RequestLogData {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: any;
  ip?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  requestId: string;
}

export interface ResponseLogData {
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  duration: number;
  size?: number;
}

export class RequestLogger {
  private static instance: RequestLogger;
  private requestStore: Map<string, { request: RequestLogData; startTime: number }> = new Map();

  private constructor() {}

  public static getInstance(): RequestLogger {
    if (!RequestLogger.instance) {
      RequestLogger.instance = new RequestLogger();
    }
    return RequestLogger.instance;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeHeaders(headers: Headers): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    headers.forEach((value, key) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = Array.isArray(body) ? [...body] : { ...body };
    const sensitiveFields = ['password', 'apiKey', 'token', 'secret', 'key'];

    for (const key in sanitized) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeBody(sanitized[key]);
      }
    }

    return sanitized;
  }

  public async logRequest(request: NextRequest): Promise<string> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    // Parse URL for query parameters
    const url = new URL(request.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // Parse body if present
    let body: any = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          body = await request.json();
        } else if (contentType?.includes('application/x-www-form-urlencoded')) {
          body = await request.formData();
        }
      } catch (error) {
        // Body parsing failed, continue without body
      }
    }

    const requestData: RequestLogData = {
      method: request.method,
      url: request.url,
      headers: this.sanitizeHeaders(request.headers),
      query,
      body: this.sanitizeBody(body),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      requestId
    };

    // Store request data for response logging
    this.requestStore.set(requestId, { request: requestData, startTime });

    // Log incoming request
    logger.logApiRequest(
      requestData.method,
      requestData.url,
      0, // Status code unknown at this point
      0, // Duration unknown at this point
      requestData.userId,
      {
        requestId,
        ip: requestData.ip,
        userAgent: requestData.userAgent,
        query: requestData.query,
        headers: requestData.headers
      }
    );

    return requestId;
  }

  public logResponse(requestId: string, response: NextResponse): void {
    const requestData = this.requestStore.get(requestId);
    if (!requestData) {
      logger.warn('Request data not found for response logging', 'REQUEST_LOGGER', { requestId });
      return;
    }

    const { request, startTime } = requestData;
    const duration = Date.now() - startTime;

    const responseData: ResponseLogData = {
      statusCode: response.status,
      headers: this.sanitizeHeaders(response.headers),
      duration
    };

    // Log completed request
    logger.logApiRequest(
      request.method,
      request.url,
      responseData.statusCode,
      duration,
      request.userId,
      {
        requestId,
        ip: request.ip,
        userAgent: request.userAgent,
        statusCode: responseData.statusCode,
        responseHeaders: responseData.headers
      }
    );

    // Log slow requests
    if (duration > 1000) {
      logger.warn(`Slow request detected: ${request.method} ${request.url}`, 'PERFORMANCE', {
        requestId,
        duration,
        statusCode: responseData.statusCode
      });
    }

    // Log errors
    if (responseData.statusCode >= 400) {
      const level = responseData.statusCode >= 500 ? 'error' : 'warn';
      logger.log(level, `HTTP ${responseData.statusCode}: ${request.method} ${request.url}`, 'API_ERROR', {
        requestId,
        method: request.method,
        url: request.url,
        statusCode: responseData.statusCode,
        duration,
        ip: request.ip,
        userAgent: request.userAgent
      });
    }

    // Clean up stored request data
    this.requestStore.delete(requestId);
  }

  public logError(requestId: string, error: Error): void {
    const requestData = this.requestStore.get(requestId);
    if (!requestData) {
      logger.logError(error, 'REQUEST_LOGGER', { requestId });
      return;
    }

    const { request, startTime } = requestData;
    const duration = Date.now() - startTime;

    logger.logError(error, 'API_ERROR', {
      requestId,
      method: request.method,
      url: request.url,
      duration,
      ip: request.ip,
      userAgent: request.userAgent,
      query: request.query
    });

    // Clean up stored request data
    this.requestStore.delete(requestId);
  }

  public getActiveRequests(): number {
    return this.requestStore.size;
  }

  public clearStaleRequests(): void {
    const now = Date.now();
    const staleThreshold = 60000; // 1 minute

    for (const [requestId, { startTime }] of this.requestStore.entries()) {
      if (now - startTime > staleThreshold) {
        logger.warn('Clearing stale request from store', 'REQUEST_LOGGER', { requestId });
        this.requestStore.delete(requestId);
      }
    }
  }
}

// Export singleton instance
export const requestLogger = RequestLogger.getInstance();

// Middleware wrapper function
export function withRequestLogging(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = await requestLogger.logRequest(request);
    
    try {
      const response = await handler(request);
      requestLogger.logResponse(requestId, response);
      return response;
    } catch (error) {
      requestLogger.logError(requestId, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };
}

// Start cleanup interval
if (typeof window === 'undefined') {
  setInterval(() => {
    requestLogger.clearStaleRequests();
  }, 60000); // Clean up every minute
}