'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { clientLogger } from '@/lib/client-logger';
import { useTranslation } from '@/lib/i18n';
import { reportCrash } from '@/lib/crash-reporter';

// Error Fallback Component with translations
function ErrorFallback({ 
  error, 
  errorInfo, 
  onReset, 
  onGoHome 
}: { 
  error: Error | null; 
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  onGoHome: () => void;
}) {
  const { t } = useTranslation();
  
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>{t('common.somethingWentWrong')}</CardTitle>
          <CardDescription>
            {t('common.unexpectedErrorReload')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 rounded-lg bg-muted p-3 text-xs">
              <summary className="cursor-pointer font-medium">{t('common.errorDetails')}</summary>
              <pre className="mt-2 whitespace-pre-wrap text-destructive">
                {error.message}
              </pre>
              {errorInfo && (
                <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}
        </CardContent>
        <CardFooter className="flex gap-2 justify-center">
          <Button variant="outline" onClick={onGoHome}>
            <Home className="mr-2 h-4 w-4" />
            {t('common.home')}
          </Button>
          <Button onClick={onReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.retry')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    void reportCrash({ error, area: 'react-widget' });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      clientLogger.error('ErrorBoundary caught:', error, errorInfo as unknown as Record<string, unknown>);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback 
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

// Hook per error boundary funzionale
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Componente per errori specifici delle pagine
export function PageErrorFallback({ 
  title,
  message,
  onRetry 
}: { 
  title?: string; 
  message?: string; 
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
      <h2 className="text-2xl font-bold mb-2">{title || t('common.pageError')}</h2>
      <p className="text-muted-foreground mb-6 max-w-md">{message || t('common.cannotLoadPage')}</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          <Home className="mr-2 h-4 w-4" />
          {t('common.home')}
        </Button>
        {onRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.retry')}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// WidgetErrorBoundary — per singoli widget con auto-recovery
// ============================================================================

interface WidgetProps {
  children: ReactNode;
  name: string; // nome del widget per il messaggio di errore
  maxRetries?: number;
  retryDelayMs?: number;
}

interface WidgetState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
}

/**
 * Error boundary per singoli widget con auto-recovery.
 * Se il widget crasha, mostra un fallback compatto e tenta
 * automaticamente il recovery dopo retryDelayMs.
 */
export class WidgetErrorBoundary extends Component<WidgetProps, WidgetState> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: WidgetProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, isRetrying: false };
  }

  static getDerivedStateFromError(error: Error): Partial<WidgetState> {
    return { hasError: true, error, isRetrying: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    clientLogger.error(`[WidgetErrorBoundary:${this.props.name}]`, error, errorInfo as unknown as Record<string, unknown>);
    void reportCrash({ error, area: 'react-widget' });

    const maxRetries = this.props.maxRetries ?? 3;
    if (this.state.retryCount < maxRetries) {
      // Auto-retry dopo delay
      const delay = this.props.retryDelayMs ?? 5000;
      this.retryTimer = setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
          isRetrying: true,
        }));
      }, delay);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  handleManualRetry = () => {
    this.setState({ hasError: false, error: null, isRetrying: true });
  };

  render() {
    if (this.state.hasError) {
      const maxRetries = this.props.maxRetries ?? 3;
      const canRetry = this.state.retryCount < maxRetries;

      return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-muted-foreground">
            {this.props.name}: errore{canRetry ? ' — riprovo automatico...' : ' — ricarica la pagina'}
          </span>
          {canRetry && (
            <Button variant="ghost" size="sm" onClick={this.handleManualRetry} className="ml-auto h-7 px-2">
              <RefreshCw className="h-3 w-3 mr-1" />
              Riprova
            </Button>
          )}
        </div>
      );
    }

    return this.state.isRetrying ? (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>{this.props.name}: ripristino...</span>
      </div>
    ) : this.props.children;
  }
}

// ============================================================================
// AppErrorBoundary — wrapper globale per l'intera app
// ============================================================================

interface AppState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary globale per l'intera app.
 * Mostra una pagina di errore completa con opzioni di recovery.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, AppState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<AppState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    clientLogger.error('[AppErrorBoundary] Fatal error:', error, errorInfo as unknown as Record<string, unknown>);
    void reportCrash({ error, area: 'react-app' });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8 text-center">
          <div className="max-w-md space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold">Errore Critico</h1>
            <p className="text-muted-foreground">
              GameStringer ha riscontrato un errore imprevisto e non può continuare.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="rounded-lg bg-muted p-3 text-xs text-left">
                <summary className="cursor-pointer font-medium">Dettagli tecnici</summary>
                <pre className="mt-2 whitespace-pre-wrap text-destructive">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <Button size="lg" onClick={this.handleReload}>
                <RefreshCw className="mr-2 h-5 w-5" />
                Ricarica App
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

