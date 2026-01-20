'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface ErrorFallbackProps {
  error: Error;
  errorInfo?: React.ErrorInfo;
  resetError: () => void;
  errorId: string;
  title?: string;
  description?: string;
  showReportButton?: boolean;
  supportEmail?: string;
}

export function ErrorFallback({
  error,
  errorInfo,
  resetError,
  errorId,
  title = "Application Error",
  description = "An unexpected error occurred in the application.",
  showReportButton = true,
  supportEmail = "support@gamestringer.com"
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [reportCopied, setReportCopied] = React.useState(false);

  const errorReport = React.useMemo(() => {
    return {
      errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
    };
  }, [error, errorInfo, errorId]);

  const copyErrorReport = React.useCallback(async () => {
    try {
      const reportText = `
GameStringer Error Report
========================
Error ID: ${errorReport.errorId}
Timestamp: ${errorReport.timestamp}
Version: ${errorReport.appVersion}
URL: ${errorReport.url}
User Agent: ${errorReport.userAgent}

Error Message:
${errorReport.message}

Stack Trace:
${errorReport.stack}

Component Stack:
${errorReport.componentStack || 'Not available'}
      `.trim();

      await navigator.clipboard.writeText(reportText);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error report:', err);
    }
  }, [errorReport]);

  const sendErrorReport = React.useCallback(() => {
    const subject = `GameStringer Error Report - ${errorId}`;
    const body = `
Hello,

I encountered an error in the GameStringer application.

Error ID: ${errorId}
Timestamp: ${errorReport.timestamp}
URL: ${errorReport.url}

Problem description:
[Describe what you were doing when the error occurred]

Technical details:
${errorReport.message}

Thank you for your assistance.
    `.trim();

    const mailtoUrl = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }, [errorId, errorReport, supportEmail]);

  const reloadPage = React.useCallback(() => {
    window.location.reload();
  }, []);

  const goHome = React.useCallback(() => {
    window.location.href = '/';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            {title}
          </CardTitle>
          <CardDescription className="text-base">
            {description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <Bug className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>Error ID:</strong> 
                  <code className="bg-muted px-2 py-1 rounded ml-2">{errorId}</code>
                </div>
                <Badge variant="destructive">
                  {error.name || 'Runtime Error'}
                </Badge>
              </div>
              <div className="mt-2">
                <strong>Message:</strong> {error.message}
              </div>
            </AlertDescription>
          </Alert>

          {process.env.NODE_ENV === 'development' && (
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
                <div className="space-y-3">
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      Stack Trace:
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyErrorReport}
                        className="h-6 px-2"
                      >
                        <Copy className="h-3 w-3" />
                        {reportCopied ? 'Copied!' : 'Copy'}
                      </Button>
                    </h4>
                    <Textarea
                      value={error.stack || 'No stack trace available'}
                      readOnly
                      className="font-mono text-xs h-32 resize-none"
                    />
                  </div>
                  
                  {errorInfo?.componentStack && (
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Component Stack:</h4>
                      <Textarea
                        value={errorInfo.componentStack}
                        readOnly
                        className="font-mono text-xs h-32 resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={resetError} variant="default" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            
            <Button onClick={reloadPage} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
            
            <Button onClick={goHome} variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go to Home
            </Button>
          </div>

          {showReportButton && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={copyErrorReport}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                {reportCopied ? 'Report Copied!' : 'Copy Error Report'}
              </Button>
              
              <Button
                onClick={sendErrorReport}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Send Report via Email
              </Button>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            If the problem persists, contact technical support including the Error ID.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente per errori API specifici
interface ApiErrorFallbackProps extends Omit<ErrorFallbackProps, 'title' | 'description'> {
  endpoint?: string;
  statusCode?: number;
  method?: string;
}

export function ApiErrorFallback({
  endpoint,
  statusCode,
  method = 'GET',
  ...props
}: ApiErrorFallbackProps) {
  const title = `API Error (${statusCode || 'Unknown'})`;
  const description = `Error during ${method} call to ${endpoint || 'unknown endpoint'}.`;

  return (
    <ErrorFallback
      {...props}
      title={title}
      description={description}
    />
  );
}

// Componente per errori di caricamento
interface LoadingErrorFallbackProps extends Omit<ErrorFallbackProps, 'title' | 'description'> {
  resource?: string;
}

export function LoadingErrorFallback({
  resource = 'resource',
  ...props
}: LoadingErrorFallbackProps) {
  const title = `Loading Error`;
  const description = `Unable to load ${resource}. Check your connection and try again.`;

  return (
    <ErrorFallback
      {...props}
      title={title}
      description={description}
    />
  );
}

// Componente per errori di autenticazione
interface AuthErrorFallbackProps extends Omit<ErrorFallbackProps, 'title' | 'description'> {
  onLogin?: () => void;
}

export function AuthErrorFallback({
  onLogin,
  ...props
}: AuthErrorFallbackProps) {
  const title = `Authentication Error`;
  const description = `Your session has expired or you don't have the required permissions.`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            {title}
          </CardTitle>
          <CardDescription className="text-base">
            {description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <Bug className="h-4 w-4" />
            <AlertDescription>
              <strong>Error ID:</strong> {props.errorId}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-3">
            {onLogin && (
              <Button onClick={onLogin} variant="default" className="w-full">
                Login Again
              </Button>
            )}
            
            <Button onClick={props.resetError} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}