/**
 * Transport HTTP unificato verso Ollama locale.
 *
 * PERCHÉ: dentro il webview Tauri (origine `tauri://localhost` o, su Windows/WebView2,
 * `http://tauri.localhost`) le `fetch()` dirette verso http://127.0.0.1:11434 vengono
 * bloccate dal CORS, perché quell'origine non rientra negli `OLLAMA_ORIGINS` di default.
 * Da terminale (curl / `ollama list`) funziona tutto perché la CLI non applica il CORS.
 *
 * SOLUZIONE: in Tauri instradiamo la richiesta via comando Rust `ollama_http` (reqwest,
 * nessun CORS). In browser/dev usiamo la fetch diretta. L'oggetto restituito è
 * "fetch-like" (ok / status / json() / text()) così i call-site cambiano di una riga.
 *
 * NB: gestisce solo chiamate NON-streaming (`stream:false`). Per lo streaming usare i
 * comandi Rust dedicati (ollama_streaming).
 */

import { ollamaArgs } from './ollama-endpoint';

export const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export interface OllamaLikeResponse {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: () => Promise<any>;
  text: () => Promise<string>;
}

export interface OllamaFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Timeout in ms. In browser genera un AbortSignal; in Tauri viene passato a Rust. */
  timeoutMs?: number;
  /** AbortSignal esplicito (usato solo nel ramo browser). */
  signal?: AbortSignal;
}

function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ ||
      (window as unknown as Record<string, unknown>).__TAURI_IPC__
    )
  );
}

/**
 * Esegue una richiesta verso Ollama.
 * @param path percorso relativo, es. '/api/tags' o '/api/chat'
 */
export async function ollamaFetch(path: string, init: OllamaFetchInit = {}): Promise<OllamaLikeResponse> {
  const method = (init.method || 'GET').toUpperCase();

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const res = await invoke<{ status: number; ok: boolean; body: string }>('ollama_http', {
      method,
      path,
      body: typeof init.body === 'string' ? init.body : undefined,
      timeoutMs: init.timeoutMs,
      ...ollamaArgs(),
    });
    return {
      ok: res.ok,
      status: res.status,
      json: async () => JSON.parse(res.body),
      text: async () => res.body,
    };
  }

  // Browser / dev: fetch diretta (Response è già "fetch-like").
  const signal = init.signal || (init.timeoutMs ? AbortSignal.timeout(init.timeoutMs) : undefined);
  return fetch(`${OLLAMA_BASE_URL}${path}`, {
    method,
    headers: init.headers,
    body: init.body,
    signal,
  });
}
