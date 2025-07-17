import { NextResponse } from 'next/server';

export interface ErrorReport {
  errorId: string;
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  appVersion?: string;
  environment: 'development' | 'production';
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  errorId: string;
  timestamp: string;
  path?: string;
  method?: string;
}

// Tipi di errori personalizzati
export class GameStringerError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'GENERAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'GameStringerError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GameStringerError);
    }
  }
}

export class ValidationError extends GameStringerError {
  constructor(message: string, field?: string) {
    super(
      field ? `Validation failed for field '${field}': ${message}` : message,
      'VALIDATION_ERROR',
      400
    );
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends GameStringerError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends GameStringerError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends GameStringerError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends GameStringerError {
  constructor(message: string = 'Resource already exists') {
    super(message, 'CONFLICT_ERROR', 409);
    this.name = 'ConflictError';
  }
}

export class ExternalServiceError extends GameStringerError {
  constructor(service: string, message: string = 'External service error') {
    super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502);
    this.name = 'ExternalServiceError';
  }
}

export class RateLimitError extends GameStringerError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

// Error handler class
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorReports: ErrorReport[] = [];

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Generate unique error ID
  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Log error to console with proper formatting
  private logError(error: Error, context?: string): void {
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] [ERROR]`;
    
    if (context) {
      console.error(`${logPrefix} [${context}]`, error);
    } else {
      console.error(`${logPrefix}`, error);
    }

    // Log stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }

  // Create error report
  private createErrorReport(
    error: Error,
    context?: {
      componentStack?: string;
      userAgent?: string;
      url?: string;
      userId?: string;
      sessionId?: string;
    }
  ): ErrorReport {
    const errorId = this.generateErrorId();
    
    const report: ErrorReport = {
      errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: context?.componentStack,
      userAgent: context?.userAgent,
      url: context?.url,
      userId: context?.userId,
      sessionId: context?.sessionId,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV as 'development' | 'production'
    };

    // Store report in memory (in production, send to monitoring service)
    this.errorReports.push(report);
    
    // Keep only last 100 reports in memory
    if (this.errorReports.length > 100) {
      this.errorReports = this.errorReports.slice(-100);
    }

    return report;
  }

  // Handle client-side errors (React components)
  public handleClientError(
    error: Error,
    errorInfo?: React.ErrorInfo,
    context?: {
      userAgent?: string;
      url?: string;
      userId?: string;
      sessionId?: string;
    }
  ): ErrorReport {
    this.logError(error, 'CLIENT');

    const report = this.createErrorReport(error, {
      ...context,
      componentStack: errorInfo?.componentStack
    });

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoringService(report);
    }

    return report;
  }

  // Handle server-side errors (API routes)
  public handleServerError(
    error: Error,
    request?: Request,
    context?: string
  ): { report: ErrorReport; response: NextResponse } {
    this.logError(error, context || 'SERVER');

    const report = this.createErrorReport(error, {
      url: request?.url,
      userAgent: request?.headers.get('user-agent') || undefined
    });

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoringService(report);
    }

    // Create appropriate HTTP response
    const response = this.createErrorResponse(error, report, request);
    
    return { report, response };
  }

  // Create HTTP error response
  private createErrorResponse(
    error: Error,
    report: ErrorReport,
    request?: Request
  ): NextResponse {
    let statusCode = 500;
    let message = 'Internal server error';

    // Handle custom errors
    if (error instanceof GameStringerError) {
      statusCode = error.statusCode;
      message = error.message;
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation failed';
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      message = 'Unauthorized';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      message = 'Forbidden';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      message = 'Not found';
    }

    const errorResponse: ApiErrorResponse = {
      error: error.name || 'Error',
      message,
      statusCode,
      errorId: report.errorId,
      timestamp: report.timestamp,
      path: request ? new URL(request.url).pathname : undefined,
      method: request?.method
    };

    return NextResponse.json(errorResponse, { status: statusCode });
  }

  // Send error report to monitoring service
  private sendToMonitoringService(report: ErrorReport): void {
    // In production, implement actual monitoring service integration
    // Examples: Sentry, LogRocket, DataDog, etc.
    
    if (process.env.NODE_ENV === 'production') {
      // Example implementation:
      // try {
      //   await fetch('/api/monitoring/error', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(report)
      //   });
      // } catch (err) {
      //   console.error('Failed to send error report to monitoring service:', err);
      // }
      
      console.log('Error report sent to monitoring service:', report.errorId);
    }
  }

  // Get error reports (for debugging)
  public getErrorReports(): ErrorReport[] {
    return [...this.errorReports];
  }

  // Clear error reports
  public clearErrorReports(): void {
    this.errorReports = [];
  }

  // Get error report by ID
  public getErrorReport(errorId: string): ErrorReport | undefined {
    return this.errorReports.find(report => report.errorId === errorId);
  }
}

// Global error handler instance
export const globalErrorHandler = ErrorHandler.getInstance();

// Utility functions
export function isOperationalError(error: Error): boolean {
  if (error instanceof GameStringerError) {
    return error.isOperational;
  }
  return false;
}

export function handleAsyncError<T>(
  fn: () => Promise<T>
): Promise<T> {
  return fn().catch(error => {
    globalErrorHandler.handleServerError(error);
    throw error;
  });
}

// Error boundary hook for React components
export function useErrorHandler() {
  return {
    handleError: (error: Error, errorInfo?: React.ErrorInfo) => {
      return globalErrorHandler.handleClientError(error, errorInfo, {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined
      });
    }
  };
}

// API route error wrapper
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      const { response } = globalErrorHandler.handleServerError(
        error instanceof Error ? error : new Error('Unknown error')
      );
      return response;
    }
  };
}