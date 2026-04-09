/**
 * Centralized API Client
 * Gestisce tutte le chiamate API con retry, error handling, caching
 */

import { notifications } from './notifications';

/**
 * Secure fetch wrapper that adds CSRF protection headers for local API calls.
 * Use this instead of raw fetch() for any request to /api/* endpoints.
 */
export function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const isLocalApi = url.startsWith('/api/') || url.startsWith('/api');
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = isLocalApi && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  if (needsCsrf) {
    options.headers = {
      'Content-Type': 'application/json',
      'X-GS-Client': 'gamestringer',
      ...(options.headers || {}),
    };
  }

  return fetch(url, options);
}

interface RequestOptions extends Omit<RequestInit, 'cache'> {
  retry?: number;
  retryDelay?: number;
  timeout?: number;
  showError?: boolean;
  useCache?: boolean;
  cacheTime?: number;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Main API client function
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    retry = 2,
    retryDelay = 1000,
    timeout = 30000,
    showError = true,
    useCache = false,
    cacheTime = DEFAULT_CACHE_TIME,
    ...fetchOptions
  } = options;

  // Check cache for GET requests
  const cacheKey = `${fetchOptions.method || 'GET'}:${url}`;
  if (useCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      return { data: cached.data, error: null, status: 200 };
    }
  }

  let lastError: string = '';
  
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-GS-Client': 'gamestringer',
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        lastError = errorData.error || errorData.message || `HTTP ${response.status}`;
        
        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          break;
        }
        
        if (attempt < retry) {
          await sleep(retryDelay * (attempt + 1));
          continue;
        }
      }

      const data = await response.json();
      
      // Cache successful GET responses
      if (useCache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
        cache.set(cacheKey, { data, timestamp: Date.now() });
      }

      return { data, error: null, status: response.status };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.name === 'AbortError') {
        lastError = 'Request timeout';
      } else {
        lastError = error.message || 'Network error';
      }
      
      if (attempt < retry) {
        await sleep(retryDelay * (attempt + 1));
      }
    }
  }

  if (showError) {
    notifications.error(lastError);
  }

  return { data: null, error: lastError, status: 0 };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Convenience methods
export const api = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'GET' }),

  post: <T = unknown>(url: string, body: unknown, options?: RequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'POST', body: JSON.stringify(body) }),

  put: <T = unknown>(url: string, body: unknown, options?: RequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'PUT', body: JSON.stringify(body) }),

  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),

  // Translation-specific endpoints
  translate: (text: string, targetLang: string, options?: { provider?: string; emotionAware?: boolean }) =>
    apiRequest<{ translatedText: string; emotion?: string }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({
        text,
        targetLanguage: targetLang,
        sourceLanguage: 'en',
        provider: options?.provider || 'libre',
        emotionAware: options?.emotionAware || false,
      }),
    }),

  // Batch translation
  translateBatch: (texts: string[], targetLang: string, provider?: string) =>
    apiRequest<{ translations: string[] }>('/api/translate/batch', {
      method: 'POST',
      body: JSON.stringify({
        texts,
        targetLanguage: targetLang,
        provider: provider || 'libre',
      }),
      timeout: 120000, // 2 min for batch
    }),

  // Voice APIs
  tts: (text: string, language: string, provider?: string) =>
    apiRequest<{ audioData: string; audioFormat: string }>('/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text, language, provider: provider || 'edge' }),
    }),

  transcribe: (audioData: string, audioFormat: string, language?: string) =>
    apiRequest<{ text: string }>('/api/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioData, audioFormat, language }),
    }),

  // Clear cache
  clearCache: () => cache.clear(),
};

export default api;
