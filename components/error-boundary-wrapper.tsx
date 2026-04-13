'use client';

import { ErrorBoundary } from './ui/error-boundary';
import { ErrorFallback, ApiErrorFallback, LoadingErrorFallback } from './ui/error-fallback';
import { useErrorHandler } from '@/lib/error-handler';
import { clientLogger } from '@/lib/client-logger';

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
    clientLogger.error(`${context} Error:`, error, errorInfo);
    handleError(error, errorInfo);
  };

  const getFallbackComponent = () => {
    switch (fallbackType) {
      case 'api': {
        const ApiFallbackComponent = ({ error, errorInfo, resetError, errorId }: { error: Error; errorInfo: unknown; resetError: () => void; errorId: string }) => (
          <ApiErrorFallback
            error={error}
            errorInfo={errorInfo}
            resetError={resetError}
            errorId={errorId}
            endpoint={endpoint}
          />
        );
        ApiFallbackComponent.displayName = 'ApiFallbackComponent';
        return ApiFallbackComponent;
      }
      case 'loading': {
        const LoadingFallbackComponent = ({ error, errorInfo, resetError, errorId }: { error: Error; errorInfo: unknown; resetError: () => void; errorId: string }) => (
          <LoadingErrorFallback
            error={error}
            errorInfo={errorInfo}
            resetError={resetError}
            errorId={errorId}
            resource={resource}
          />
        );
        LoadingFallbackComponent.displayName = 'LoadingFallbackComponent';
        return LoadingFallbackComponent;
      }
      default: {
        const DefaultFallbackComponent = ({ error, errorInfo, resetError, errorId }: { error: Error; errorInfo: unknown; resetError: () => void; errorId: string }) => (
          <ErrorFallback
            error={error}
            errorInfo={errorInfo}
            resetError={resetError}
            errorId={errorId}
            title={`error in ${context}`}
          />
        );
        DefaultFallbackComponent.displayName = 'DefaultFallbackComponent';
        return DefaultFallbackComponent;
      }
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


