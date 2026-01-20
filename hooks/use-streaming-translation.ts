'use client';

import { useState, useCallback, useRef } from 'react';

interface StreamingTranslationOptions {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  provider?: string;
  context?: string;
  apiKey?: string;
}

interface StreamingState {
  isStreaming: boolean;
  currentText: string;
  fullText: string;
  error: string | null;
  provider: string | null;
}

export function useStreamingTranslation() {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    currentText: '',
    fullText: '',
    error: null,
    provider: null
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const translate = useCallback(async (options: StreamingTranslationOptions) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setState({
      isStreaming: true,
      currentText: '',
      fullText: '',
      error: null,
      provider: options.provider || 'openai'
    });

    try {
      const response = await fetch('/api/translate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'start':
                setState(prev => ({ ...prev, provider: data.provider }));
                break;
                
              case 'chunk':
                setState(prev => ({
                  ...prev,
                  currentText: prev.currentText + data.text
                }));
                break;
                
              case 'complete':
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                  fullText: data.fullText,
                  currentText: data.fullText
                }));
                break;
                
              case 'error':
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                  error: data.error
                }));
                break;
            }
          } catch (e) {
            // Skip unparseable events
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ ...prev, isStreaming: false }));
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({
      isStreaming: false,
      currentText: '',
      fullText: '',
      error: null,
      provider: null
    });
  }, [cancel]);

  return {
    ...state,
    translate,
    cancel,
    reset
  };
}
