/**
 * Endpoint dei provider AI, con override configurabile dall'utente.
 *
 * PERCHÉ: fino al 26/07/2026 ogni endpoint era una stringa letterale dentro
 * `ai-translate-direct.ts` — quindici URL sparsi. Si poteva salvare la chiave, non
 * l'indirizzo. Un utente cinese l'ha segnalato il 30/06 («non riesco a salvare le
 * impostazioni API personalizzate di DeepSeek»), e la funzione che cercava non era
 * rotta: non esisteva.
 *
 * Serve a chi sta dietro un proxy aziendale, a chi in certi paesi non raggiunge il
 * dominio ufficiale, e a chi usa un gateway compatibile OpenAI (LiteLLM, OpenRouter
 * self-hosted, vLLM…). È lo stesso problema risolto il 25/07 per Ollama con
 * `normalize_ollama_url`, qui esteso agli altri provider.
 *
 * NON cambia il comportamento di default: senza override, l'URL composto è
 * identico byte per byte a quello che era hardcoded.
 *
 * ⚠️ VINCOLO CHE HA RESO NECESSARIO UN SECONDO PASSAGGIO — la `connect-src` della CSP
 * in `src-tauri/tauri.conf.json` elenca **trenta origini fisse**, una per provider. Una
 * `fetch()` verso un endpoint personalizzato verrebbe quindi bloccata dal webview, e la
 * prima versione di questo modulo funzionava solo per i due provider che già passavano
 * da `httpPostJson`. Ora **tutte** le chiamate ai provider usano `lib/ai/http-proxy.ts`,
 * che dentro Tauri instrada dal comando Rust `http_post_json` (reqwest, nessuna CSP e
 * nessun CORS) e fuori fa la fetch normale. È la stessa ragione per cui esiste
 * `lib/ai/ollama-http.ts`.
 *
 * Ne segue una regola: **una nuova chiamata a un provider va aggiunta con
 * `httpPostJson`, non con `fetch`**, altrimenti gli endpoint personalizzati smettono
 * di funzionare per quel provider e nessun test se ne accorge — il difetto si vede
 * solo a runtime, dentro il webview, con un endpoint custom configurato.
 */

import { clientLogger } from '@/lib/client-logger';

export type ProviderId =
  | 'deepseek' | 'openai' | 'groq' | 'anthropic' | 'mistral' | 'cohere'
  | 'together' | 'fireworks' | 'openrouter' | 'cerebras' | 'gemini';

/**
 * Base ufficiale di ogni provider. La base include l'eventuale prefisso di versione
 * (`/v1`), il path specifico della chiamata resta separato: così un override deve
 * fornire solo la radice del gateway, che è ciò che l'utente conosce.
 */
export const DEFAULT_BASES: Record<ProviderId, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  anthropic: 'https://api.anthropic.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  cohere: 'https://api.cohere.com/v2',
  together: 'https://api.together.xyz/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

/**
 * Normalizza quello che l'utente ha incollato nel campo.
 *
 * Accetta le forme in cui la gente scrive un indirizzo davvero: senza schema
 * (`mio-proxy.local:8080`), con lo slash finale, con spazi intorno. Rifiuta ciò che
 * non è un URL http(s) utilizzabile, restituendo `null` — il chiamante torna al
 * default invece di lanciare, perché un endpoint scritto male non deve impedire di
 * tradurre.
 *
 * Speculare a `normalize_ollama_url` lato Rust (src-tauri/commands/ollama_endpoint.rs).
 */
export function normalizeBaseUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Se uno schema c'è già, deve essere http(s).
  //
  // Senza questo controllo `ftp://x.example.com` non corrispondeva a
  // /^https?:\/\// , si beccava un `https://` davanti e diventava
  // `https://ftp//x.example.com`: un indirizzo plausibile invece di un rifiuto.
  // Il controllo sul protocollo più sotto non poteva accorgersene, perché lo
  // schema gliel'avevamo riscritto noi.
  const schema = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  if (schema) {
    const nome = schema[1].toLowerCase();
    const dopoIDuePunti = s.slice(schema[0].length);
    // `mio-proxy.local:8080` non è uno schema ma un host con la porta: dopo i
    // due punti ci sono solo cifre. Va accettato, è una forma in cui la gente
    // scrive davvero un indirizzo.
    const eUnaPorta = /^\d+(\/|$)/.test(dopoIDuePunti);
    if (!eUnaPorta && nome !== 'http' && nome !== 'https') return null;
  }

  // niente schema → https, che è ciò che vuole chiunque tranne un proxy locale
  if (!/^https?:\/\//i.test(s)) {
    s = (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(s) ? 'http://' : 'https://') + s;
  }

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;

  // via query e fragment: una base non li ha; via lo slash finale per comporre pulito
  url.search = '';
  url.hash = '';
  const out = url.toString().replace(/\/+$/, '');
  return out || null;
}

/** Override salvati dall'utente: `settings.translation.endpoints[provider]`. */
function readOverrides(): Partial<Record<ProviderId, string>> {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    const raw = settings?.translation?.endpoints;
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/**
 * Base effettiva del provider: l'override normalizzato se valido, altrimenti il
 * default ufficiale. Un override illeggibile viene loggato e ignorato — mai fatale.
 */
export function providerBase(provider: ProviderId): string {
  const override = readOverrides()[provider];
  if (!override) return DEFAULT_BASES[provider];

  const normalized = normalizeBaseUrl(override);
  if (!normalized) {
    clientLogger.warn(
      `[endpoints] endpoint personalizzato non valido per ${provider}: "${override}" — uso il default`,
      'AI'
    );
    return DEFAULT_BASES[provider];
  }
  return normalized;
}

/**
 * URL completo di una chiamata. `path` inizia con `/`.
 *
 *   providerUrl('deepseek', '/chat/completions')
 *     → https://api.deepseek.com/chat/completions          (default)
 *     → https://gateway.interno/v1/chat/completions        (con override)
 */
export function providerUrl(provider: ProviderId, path: string): string {
  const base = providerBase(provider);
  return base + (path.startsWith('/') ? path : `/${path}`);
}

/** Vero se l'utente ha impostato un endpoint diverso da quello ufficiale. */
export function hasCustomEndpoint(provider: ProviderId): boolean {
  return providerBase(provider) !== DEFAULT_BASES[provider];
}

/** Elenco dei provider con endpoint personalizzato, per diagnostica e UI. */
export function listCustomEndpoints(): { provider: ProviderId; base: string }[] {
  return (Object.keys(DEFAULT_BASES) as ProviderId[])
    .filter(hasCustomEndpoint)
    .map((provider) => ({ provider, base: providerBase(provider) }));
}
