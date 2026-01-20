'use client';

import { ErrorBoundary } from './ui/error-boundary';
import { ErrorFallback, ApiErrorFallback, LoadingErrorFallback } from './ui/error-fallback';
import { useErrorHandler } from '@/lib/error-handler';

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
  fallbackType?: 'default' | 'api' | 'loading';
  context?: string;
  endpoint?: string;
  resource?: string;
}

export function ErrorBoundaryWrapper({
  children,
  fallbackType = 'default',
  context = 'Component',
  endpoint,
  resource
}: ErrorBoundaryWrapperProps) {
  const { handleError } = useErrorHandler();

  const onError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error(`${context} Error:`, error, errorInfo);
    handleError(error, errorInfo);
  };

  const getFallbackComponent = () => {
    switch (fallbackType) {
      case 'api':
        return ({ error, errorInfo, resetError, errorId }: any) => (
          <ApiErrorFallback
            error={error}
            errorInfo={errorInfo}
            resetError={resetError}
            errorId={errorId}
            endpoint={endpoint}
          />
        );
      case 'loading':
        return ({ error, errorInfo, resetError, errorId }: any) => (
          <LoadingErrorFallback
            error={error}
            errorInfo={errorInfo}
            resetError={resetError}
            errorId={errorId}
            resource={resource}
          />
        );
      default:
        return ({ error, errorInfo, resetError, errorId }: any) => (
          <ErrorFallback
            error={error}
            errorInfo={errorInfo}
            resetError={resetError}
            errorId={errorId}
            title={`error in ${context}`}
          />
        );
    }
  };

  return (
    <ErrorBoundary
      fallback={getFallbackComponent()}
      onError={onError}
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundary>
  );
}

// Specialized wrappers for common use cases
export function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryWrapper context="Page">
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function ComponentErrorBoundary({ 
  children, 
  componentName 
}: { 
  children: React.ReactNode;
  componentName: string;
}) {
  return (
    <ErrorBoundaryWrapper context={componentName}>
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function ApiErrorBoundary({ 
  children, 
  endpoint 
}: { 
  children: React.ReactNode;
  endpoint: string;
}) {
  return (
    <ErrorBoundaryWrapper 
      context="API"
      fallbackType="api"
      endpoint={endpoint}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function LoadingErrorBoundary({ 
  children, 
  resource 
}: { 
  children: React.ReactNode;
  resource: string;
}) {
  return (
    <ErrorBoundaryWrapper 
      context="Loading"
      fallbackType="loading"
      resource={resource}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}


