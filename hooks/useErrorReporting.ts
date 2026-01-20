'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

interface ErrorReportContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

export function useErrorReporting() {
  const reportError = useCallback(async (
    error: Error,
    context?: ErrorReportContext
  ) => {
    try {
      // Send error report to API
      const response = await fetch('/api/error-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          context: {
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            ...context
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send error report');
      }

      const result = await response.json();
      
      // Show success notification
      toast.success(`Error report sent successfully (ID: ${result.errorId})`);
      
      return result.errorId;
    } catch (reportError) {
      console.error('Failed to send error report:', reportError);
      
      // Show error notification
      toast.error('Failed to send error report. Please try again.');
      
      return null;
    }
  }, []);

  const reportAsyncError = useCallback(async (
    asyncOperation: () => Promise<any>,
    context?: ErrorReportContext
  ) => {
    try {
      return await asyncOperation();
    } catch (error) {
      if (error instanceof Error) {
        await reportError(error, context);
      }
      throw error;
    }
  }, [reportError]);

  const withErrorReporting = useCallback(<T extends any[]>(
    fn: (...args: T) => void,
    context?: ErrorReportContext
  ) => {
    return (...args: T) => {
      try {
        return fn(...args);
      } catch (error) {
        if (error instanceof Error) {
          reportError(error, context);
        }
        throw error;
      }
    };
  }, [reportError]);

  const withAsyncErrorReporting = useCallback(<T extends any[]>(
    fn: (...args: T) => Promise<any>,
    context?: ErrorReportContext
  ) => {
    return async (...args: T) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (error instanceof Error) {
          await reportError(error, context);
        }
        throw error;
      }
    };
  }, [reportError]);

  return {
    reportError,
    reportAsyncError,
    withErrorReporting,
    withAsyncErrorReporting
  };
}

// Hook for handling API errors specifically
export function useApiErrorReporting() {
  const { reportError } = useErrorReporting();

  const reportApiError = useCallback(async (
    error: Error,
    endpoint: string,
    method: string = 'GET',
    requestData?: any
  ) => {
    return reportError(error, {
      component: 'API',
      action: `${method} ${endpoint}`,
      additionalData: {
        endpoint,
        method,
        requestData: requestData ? JSON.stringify(requestData) : undefined
      }
    });
  }, [reportError]);

  const handleApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET',
    requestData?: any
  ): Promise<T> => {
    try {
      return await apiCall();
    } catch (error) {
      if (error instanceof Error) {
        await reportApiError(error, endpoint, method, requestData);
      }
      throw error;
    }
  }, [reportApiError]);

  return {
    reportApiError,
    handleApiCall
  };
}