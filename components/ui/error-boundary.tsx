'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo;
  resetError: () => void;
  errorId: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error to monitoring service
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: React.ErrorInfo) => {
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Send to monitoring service (replace with actual service)
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry, LogRocket, etc.
      console.error('Error Report:', errorReport);
    }
  };

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  private reloadPage = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorId } = this.state;
      
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={error!}
            errorInfo={errorInfo!}
            resetError={this.resetError}
            errorId={errorId}
          />
        );
      }

      return (
        <DefaultErrorFallback
          error={error!}
          errorInfo={errorInfo!}
          resetError={this.resetError}
          errorId={errorId}
          showErrorDetails={this.props.showErrorDetails}
          onReload={this.reloadPage}
          onGoHome={this.goHome}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps extends ErrorFallbackProps {
  showErrorDetails?: boolean;
  onReload: () => void;
  onGoHome: () => void;
}

function DefaultErrorFallback({ 
  error, 
  errorInfo, 
  resetError, 
  errorId, 
  showErrorDetails = false,
  onReload,
  onGoHome
}: DefaultErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            Oops! Something went wrong
          </CardTitle>
          <CardDescription className="text-base">
            An unexpected error occurred. We apologize for the inconvenience.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <Bug className="h-4 w-4" />
            <AlertDescription>
              <strong>Error ID:</strong> {errorId}
              <br />
              <strong>Message:</strong> {error.message}
            </AlertDescription>
          </Alert>

          {(showErrorDetails || process.env.NODE_ENV === 'development') && (
            <div className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full"
              >
                {showDetails ? 'Hide' : 'Show'} technical details
              </Button>

              {showDetails && (
                <div className="space-y-2">
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Stack Trace:</h4>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                      {error.stack}
                    </pre>
                  </div>
                  
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Component Stack:</h4>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={resetError} variant="default" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            
            <Button onClick={onReload} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
            
            <Button onClick={onGoHome} variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go to Home
            </Button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            If the problem persists, contact technical support with the Error ID: 
            <code className="bg-muted px-2 py-1 rounded ml-1">{errorId}</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook per gestire errori in componenti funzionali
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: React.ErrorInfo) => {
    // Log error
    console.error('useErrorHandler:', error, errorInfo);

    // You can also throw the error to be caught by the nearest ErrorBoundary
    throw error;
  }, []);
}

// HOC per wrappare componenti con ErrorBoundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Componente per errori API
interface ApiErrorBoundaryProps extends ErrorBoundaryProps {
  endpoint?: string;
}

export function ApiErrorBoundary({ endpoint, children, ...props }: ApiErrorBoundaryProps) {
  const handleError = React.useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error(`API Error in ${endpoint}:`, error, errorInfo);
    
    // Custom API error handling
    if (props.onError) {
      props.onError(error, errorInfo);
    }
  }, [endpoint, props]);

  return (
    <ErrorBoundary {...props} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}

// Componente per errori di routing
export function RouteErrorBoundary({ children, ...props }: ErrorBoundaryProps) {
  const handleError = React.useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Route Error:', error, errorInfo);
    
    if (props.onError) {
      props.onError(error, errorInfo);
    }
  }, [props]);

  return (
    <ErrorBoundary {...props} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}