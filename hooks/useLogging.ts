'use client';

import { useCallback, useEffect, useRef } from 'react';
import { clientLogger, createClientComponentLogger } from '@/lib/client-logger';
import { LogLevel } from '@/lib/logger';

interface UseLoggingOptions {
  component?: string;
  enablePerformanceLogging?: boolean;
  enableUserActionLogging?: boolean;
  enableErrorLogging?: boolean;
}

export function useLogging(options: UseLoggingOptions = {}) {
  const {
    component = 'Component',
    enablePerformanceLogging = true,
    enableUserActionLogging = true,
    enableErrorLogging = true
  } = options;

  const componentLogger = useRef(createClientComponentLogger(component));
  const performanceTimers = useRef<Map<string, number>>(new Map());

  // Log component mount/unmount
  useEffect(() => {
    if (enablePerformanceLogging) {
      componentLogger.current.debug('Component mounted');
    }

    return () => {
      if (enablePerformanceLogging) {
        componentLogger.current.debug('Component unmounted');
      }
    };
  }, [enablePerformanceLogging]);

  const log = useCallback((
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ) => {
    componentLogger.current[level](message, metadata);
  }, []);

  const logError = useCallback((error: Error, metadata?: Record<string, any>) => {
    if (enableErrorLogging) {
      componentLogger.current.logError(error, metadata);
    }
  }, [enableErrorLogging]);

  const logUserAction = useCallback((
    action: string,
    metadata?: Record<string, any>
  ) => {
    if (enableUserActionLogging) {
      componentLogger.current.logUserAction(action, metadata);
    }
  }, [enableUserActionLogging]);

  const startPerformanceTimer = useCallback((operation: string) => {
    if (enablePerformanceLogging) {
      performanceTimers.current.set(operation, performance.now());
    }
  }, [enablePerformanceLogging]);

  const endPerformanceTimer = useCallback((
    operation: string,
    metadata?: Record<string, any>
  ) => {
    if (enablePerformanceLogging) {
      const startTime = performanceTimers.current.get(operation);
      if (startTime) {
        const duration = performance.now() - startTime;
        componentLogger.current.logPerformance(operation, duration, metadata);
        performanceTimers.current.delete(operation);
      }
    }
  }, [enablePerformanceLogging]);

  const logApiCall = useCallback((
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ) => {
    clientLogger.logApiCall(method, url, statusCode, duration, metadata);
  }, []);

  const withPerformanceLogging = useCallback(<T extends any[]>(
    fn: (...args: T) => any,
    operation: string
  ) => {
    return (...args: T) => {
      if (!enablePerformanceLogging) {
        return fn(...args);
      }

      const start = performance.now();
      
      try {
        const result = fn(...args);
        const duration = performance.now() - start;
        
        componentLogger.current.logPerformance(operation, duration);
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        
        if (enableErrorLogging) {
          componentLogger.current.logError(
            error instanceof Error ? error : new Error(String(error)),
            { operation, duration }
          );
        }
        
        throw error;
      }
    };
  }, [enablePerformanceLogging, enableErrorLogging]);

  const withAsyncPerformanceLogging = useCallback(<T extends any[]>(
    fn: (...args: T) => Promise<any>,
    operation: string
  ) => {
    return async (...args: T) => {
      if (!enablePerformanceLogging) {
        return await fn(...args);
      }

      const start = performance.now();
      
      try {
        const result = await fn(...args);
        const duration = performance.now() - start;
        
        componentLogger.current.logPerformance(operation, duration);
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        
        if (enableErrorLogging) {
          componentLogger.current.logError(
            error instanceof Error ? error : new Error(String(error)),
            { operation, duration }
          );
        }
        
        throw error;
      }
    };
  }, [enablePerformanceLogging, enableErrorLogging]);

  return {
    log,
    debug: (message: string, metadata?: Record<string, any>) => log('debug', message, metadata),
    info: (message: string, metadata?: Record<string, any>) => log('info', message, metadata),
    warn: (message: string, metadata?: Record<string, any>) => log('warn', message, metadata),
    error: (message: string, metadata?: Record<string, any>) => log('error', message, metadata),
    fatal: (message: string, metadata?: Record<string, any>) => log('fatal', message, metadata),
    logError,
    logUserAction,
    logApiCall,
    startPerformanceTimer,
    endPerformanceTimer,
    withPerformanceLogging,
    withAsyncPerformanceLogging
  };
}

// Specialized hooks for common use cases
export function usePageLogging(pageName: string) {
  const { log, logUserAction } = useLogging({ component: 'PAGE' });

  useEffect(() => {
    clientLogger.logPageView(pageName);
  }, [pageName]);

  return {
    logPageAction: logUserAction,
    logPageInfo: (message: string, metadata?: Record<string, any>) => 
      log('info', message, metadata)
  };
}

export function useApiLogging() {
  const { logApiCall } = useLogging({ component: 'API' });

  const logApiRequest = useCallback(async <T>(
    apiCall: () => Promise<T>,
    method: string,
    url: string,
    requestData?: any
  ): Promise<T> => {
    const start = performance.now();
    
    try {
      const result = await apiCall();
      const duration = performance.now() - start;
      
      logApiCall(method, url, 200, duration, { requestData });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      // Try to extract status code from error
      let statusCode = 500;
      if (error instanceof Error) {
        const match = error.message.match(/(\d{3})/);
        if (match) {
          statusCode = parseInt(match[1]);
        }
      }
      
      logApiCall(method, url, statusCode, duration, { 
        requestData, 
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }, [logApiCall]);

  return {
    logApiRequest
  };
}

export function useErrorLogging(component?: string) {
  const { logError } = useLogging({ component });

  const logAndThrow = useCallback((error: Error, metadata?: Record<string, any>) => {
    logError(error, metadata);
    throw error;
  }, [logError]);

  const handleError = useCallback((error: unknown, metadata?: Record<string, any>) => {
    if (error instanceof Error) {
      logError(error, metadata);
    } else {
      logError(new Error(String(error)), metadata);
    }
  }, [logError]);

  return {
    logError,
    logAndThrow,
    handleError
  };
}

export function usePerformanceLogging(component?: string) {
  const { startPerformanceTimer, endPerformanceTimer, withPerformanceLogging, withAsyncPerformanceLogging } = useLogging({ component });

  const measureAsync = useCallback(async <T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      clientLogger.logPerformance(operation, duration, component);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      clientLogger.logError(
        error instanceof Error ? error : new Error(String(error)),
        component,
        { operation, duration }
      );
      
      throw error;
    }
  }, [component]);

  const measure = useCallback(<T>(
    operation: string,
    fn: () => T
  ): T => {
    const start = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - start;
      
      clientLogger.logPerformance(operation, duration, component);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      clientLogger.logError(
        error instanceof Error ? error : new Error(String(error)),
        component,
        { operation, duration }
      );
      
      throw error;
    }
  }, [component]);

  return {
    startTimer: startPerformanceTimer,
    endTimer: endPerformanceTimer,
    measure,
    measureAsync,
    withPerformanceLogging,
    withAsyncPerformanceLogging
  };
}