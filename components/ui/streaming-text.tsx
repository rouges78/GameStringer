'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  className?: string;
  cursorClassName?: string;
  showCursor?: boolean;
}

export function StreamingText({
  text,
  isStreaming,
  className,
  cursorClassName,
  showCursor = true
}: StreamingTextProps) {
  return (
    <div className={cn('relative', className)}>
      <span className="whitespace-pre-wrap">{text}</span>
      {isStreaming && showCursor && (
        <span 
          className={cn(
            'inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse',
            cursorClassName
          )}
        />
      )}
    </div>
  );
}

interface StreamingTranslationBoxProps {
  originalText: string;
  translatedText: string;
  isStreaming: boolean;
  error: string | null;
  provider: string | null;
  onRetry?: () => void;
  className?: string;
}

export function StreamingTranslationBox({
  originalText,
  translatedText,
  isStreaming,
  error,
  provider,
  onRetry,
  className
}: StreamingTranslationBoxProps) {
  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {isStreaming && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          <span className="text-sm font-medium">
            {isStreaming ? 'Traduzione in corso...' : 'Traduzione'}
          </span>
        </div>
        {provider && (
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
            {provider.toUpperCase()}
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Original */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Originale</label>
          <div className="text-sm bg-muted/20 rounded p-2 max-h-24 overflow-y-auto">
            {originalText}
          </div>
        </div>
        
        {/* Translation */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Traduzione</label>
          <div className="text-sm bg-primary/5 border border-primary/20 rounded p-2 min-h-[60px]">
            {error ? (
              <div className="text-red-500 flex items-center gap-2">
                <span>❌ {error}</span>
                {onRetry && (
                  <button 
                    onClick={onRetry}
                    className="text-xs underline hover:no-underline"
                  >
                    Riprova
                  </button>
                )}
              </div>
            ) : (
              <StreamingText 
                text={translatedText || (isStreaming ? '' : '—')}
                isStreaming={isStreaming}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Progress indicator */}
      {isStreaming && (
        <div className="h-1 bg-muted overflow-hidden">
          <div className="h-full bg-primary animate-pulse w-full origin-left" 
               style={{ animation: 'pulse 1s ease-in-out infinite' }} />
        </div>
      )}
    </div>
  );
}
