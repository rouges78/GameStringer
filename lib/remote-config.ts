'use client';

/**
 * Remote model/pricing config — catalogo modelli, prezzi e raccomandazioni
 * aggiornabili SENZA rilasciare l'app (task ROADMAP `remote-models`).
 *
 * Problema: oggi liste e prezzi ("Claude 3.5, GPT-4o", "$3/1M"…) sono hardcoded
 * e invecchiano a ogni release. Soluzione: un JSON remoto che sovrascrive i
 * default bundled. Se il remoto non c'è (offline, CSP, host giù) si usa il
 * bundled: fail-open totale, l'app funziona sempre.
 *
 * Design:
 * - `BUNDLED_MODEL_CONFIG` è la verità offline (allineata a ciò che l'app spedisce).
 * - Le funzioni di validazione/merge sono PURE e testabili.
 * - `getModelConfig()` è sincrona (bundled+cache) e, se la cache è vecchia,
 *   lancia in background un refresh (fire-and-forget). Nessun aggancio esterno
 *   necessario: si auto-aggiorna al primo uso.
 */

// ── Tipi ───────────────────────────────────────────────────

export interface ModelInfo {
  /** ID modello lato API, es. "gpt-4o". */
  id: string;
  /** Nome mostrato all'utente. */
  label: string;
  /** Modello consigliato per questo provider. */
  recommended?: boolean;
}

export interface ProviderPricing {
  /** USD per 1K token (stima input, coerente con estimateBatchCost). */
  per1kUsd: number;
  /** Nota leggibile (modello a cui si riferisce il prezzo). */
  note?: string;
}

export interface RemoteModelConfig {
  version: number;
  updatedAt?: string;
  /** Prezzi per provider id. */
  pricing: Record<string, ProviderPricing>;
  /** Catalogo modelli per provider id. */
  models: Record<string, ModelInfo[]>;
  /** Provider consigliato per scenario (chiave libera → provider id). */
  recommendations?: Record<string, string>;
}

// ── Default bundled (allineati ai valori spediti) ──────────

// ⚠️ DATARE SEMPRE questa tabella, e scrivere ACCANTO A OGNI VOCE quando è stata
// verificata l'ultima volta. Un listino vecchio travestito da fatto è il modo più
// facile per sbagliare una decisione di spesa — ed è già successo qui: fino al
// 16/08/2026 questo catalogo raccomandava `claude-3-5-sonnet`, `gpt-4o-mini` e
// `gemini-2.0-flash` mentre il resto del codice usava già `claude-sonnet-4-6` e
// `gemini-3.5-flash`. Due verità diverse nello stesso repo: chi leggeva di qui
// vedeva un'app di due generazioni prima di quella che stava usando.
//
// I modelli qui sotto sono ALLINEATI ai default che il codice usa davvero
// (ai-translate-direct.ts:400 e :408, smart-content-router.ts:360,
// reflection-translator.ts:216). Non sono una scelta nuova: sono la fotografia
// corretta di quella già fatta. I modelli usciti ad agosto 2026 (Gemini 3.7
// Flash, DeepSeek-V4-Pro-0813, Qwen3.8-27B) NON sono qui di proposito: entrano
// quando passano da un benchmark, non perché sono nuovi.
export const BUNDLED_MODEL_CONFIG: RemoteModelConfig = {
  version: 1,
  updatedAt: '2026-08-23',
  pricing: {
    // ⏰ OpenAI — VERIFICATO IL 23/08/2026 su developers.openai.com/api/docs/pricing.
    // gpt-4o-mini è ancora listato a $0.15/1M input e resta il modello che il codice
    // chiama davvero (ai-translate-direct.ts, reflection-translator.ts). La cifra era
    // giusta: qui cambia solo il fatto che ora qualcuno l'ha guardata.
    openai: { per1kUsd: 0.00015, note: 'GPT-4o mini ($0.15/1M input) · verificato 23/08/2026' },
    // ⏰ gpt5 — VERIFICATO IL 23/08/2026. Il nome della chiave è storico e mente: non è
    // GPT-5, è GPT-4o. Lo dicono sia il costo-calcolatore (modelLabelById('openai',
    // 'gpt-4o')) sia la tendina del Translator Pro, che mostra 'GPT-4o'. gpt-4o è
    // ancora listato a $2.50/1M input, quindi la cifra era giusta.
    // OpenAI ha ora modelli più recenti (gpt-5.6-sol $4/1M, gpt-5.6-luna $0.20/1M,
    // gpt-5-nano $0.05/1M) ma nessuno di essi è chiamato da questo codice: aggiungerli
    // al catalogo è una decisione di prodotto, non una correzione di prezzo.
    gpt5: { per1kUsd: 0.0025, note: 'GPT-4o ($2.50/1M input) · verificato 23/08/2026 · la chiave si chiama gpt5 per ragioni storiche' },
    // ⏰ Gemini — VERIFICATO IL 23/08/2026 su ai.google.dev/gemini-api/docs/pricing.
    // Il default del codice è gemini-3.7-flash, che costa $0.75/1M input fino al
    // 31/12/2026 e $1.50/1M dal 01/01/2027. Qui resta $1.50/1M di proposito: è il
    // prezzo che il modello avrà comunque fra pochi mesi, e fino ad allora la stima
    // sbaglia per eccesso anziché per difetto. Abbassarla adesso significherebbe
    // dover rincorrere il rialzo a Capodanno, con il rischio di non accorgersene.
    // Il valore precedente (0.000125) era il prezzo di Gemini 2.0 Flash, rimasto qui
    // dopo il passaggio del codice a 3.5: 12× troppo basso.
    gemini: { per1kUsd: 0.0015, note: 'Gemini 3.7 Flash · verificato 23/08/2026 · $0.75/1M fino al 31/12/2026, poi $1.50/1M — qui sta il prezzo pieno' },
    // ⏰ Claude — VERIFICATO IL 23/08/2026. Il default del codice è claude-sonnet-4-6,
    // che costa $3/1M input: la cifra storica di Claude 3.5 Sonnet coincide, quindi il
    // numero era giusto per il motivo sbagliato. Ora è giusto e verificato.
    // Nota: la variante premium (claude-opus-5) costa $5/1M, ~1.7× questa stima; il
    // catalogo prezzi ha una sola chiave per provider, quindi chi sceglie Opus paga più
    // del preventivo. È l'unico caso in cui questa tabella sbaglia per difetto.
    claude: { per1kUsd: 0.003, note: 'Claude Sonnet 4.6 ($3/1M input), default del codice · verificato 23/08/2026 · Opus 5 costa $5/1M' },
    // ⏰ DeepSeek — VERIFICATO IL 16/08/2026 con ricerca (api-docs.deepseek.com non
    // rispondeva; cifre confermate da due ricerche indipendenti). Dalle 16:00 UTC
    // del 16/08/2026 la famiglia V4 ha tariffe a fasce:
    //   V4-Flash PICCO      (01:00-04:00 e 06:00-10:00 UTC): $0.44/1M input cache-miss · $1.32/1M output
    //   V4-Flash FUORI PICCO (tutte le altre ore)           : $0.22/1M input cache-miss · $0.66/1M output
    //   prima del 16/08: $0.14 input · $0.28 output (cache-hit $0.0028, 50× più basso)
    // Qui sta il prezzo DI PICCO by design: una stima deve sbagliare per eccesso.
    // Una fattura più alta del preventivo è il difetto peggiore che possa fare
    // questo numero. Nota per chi lo legge: la fascia di picco 06:00-10:00 UTC è
    // 08:00-12:00 in Italia, cioè la mattina — tradurre il pomeriggio costa metà.
    deepseek: { per1kUsd: 0.00044, note: 'DeepSeek V4 Flash, tariffa di PICCO ($0.44/1M input cache-miss, dal 16/08/2026 16:00 UTC) · fuori picco costa la metà' },
    // ⏰ Mistral — VERIFICATO IL 23/08/2026 su mistral.ai/pricing/api.
    // Il 23/08 questo provider diceva tre cose diverse in tre punti: il codice
    // chiamava mistral-small-latest, il catalogo offriva solo mistral-large-latest
    // e la tendina del Translator Pro scriveva 'Mistral Large 2' (una versione che
    // nel frattempo non esisteva più). Il prezzo, 0.002, era il vecchio $2/1M e non
    // corrispondeva a nessuno dei tre.
    // Deciso: la verità è ciò che il codice chiama davvero, cioè Mistral Small 4.
    // Catalogo e tendina sono stati allineati a quello, e il prezzo è il suo:
    // $0.15/1M input. Non c'è più un modello più caro in gioco, quindi qui non
    // serve il margine prudenziale che porta la voce deepseek — la stima è esatta.
    mistral: { per1kUsd: 0.00015, note: 'Mistral Small 4 ($0.15/1M input), il modello che il codice chiama · verificato 23/08/2026' },
    openrouter: { per1kUsd: 0.001, note: 'Varia per modello' },
    deepl: { per1kUsd: 0.02, note: 'DeepL Pro' },
    google: { per1kUsd: 0.00002, note: 'Google Translate' },

    // ── Le chiavi che le CATENE usano davvero — 24/08/2026 ──────────────────
    //
    // ⛔ PERCHÉ ESISTONO: fino a oggi questa tabella era indicizzata con i nomi
    // dei vendor (`claude`, `gemini`), mentre le catene di chain-presets.ts e il
    // dispatch di PROVIDER_MAP (ai-translate-direct.ts:1680) usano le chiavi dei
    // provider (`anthropic-premium`, `hymt`, `gemini-3.1`…). Nomi diversi per la
    // stessa cosa = nessuna corrispondenza, e getProviderPrice1k rispondeva a
    // TUTTI con il fallback 0.002. Misurato prima della correzione, su 10.000
    // stringhe: il preset «🆓 Gratis», che parte da HY-MT locale, era
    // preventivato $0,60 — un modello che gira sul PC dell'utente, fatturato
    // come il secondo prezzo più alto del listino.
    // Le chiavi qui sotto si AGGIUNGONO, non rinominano niente: rinominarle
    // dall'altra parte romperebbe il dispatch delle traduzioni.

    // Locali o senza API key: costo ZERO per costruzione, che è un fatto, non
    // una stima — non c'è nessuna fattura da sbagliare. Verificato il
    // 24/08/2026 leggendo PROVIDER_MAP (`needsKey: false`) e gli endpoint:
    // Ollama in locale (hymt, translategemma, ollama), localhost:1234
    // (lmstudio), localhost:8080 (modelwiz), API pubbliche interrogate senza
    // chiave (mymemory, lingva, nllb via HuggingFace, libretranslate).
    // Sono anche la ragione per cui `gratuitiPrima` esiste in chain-cost.ts:
    // senza queste voci quel contatore restava a zero per sempre.
    hymt: { per1kUsd: 0, note: 'HY-MT su Ollama locale · nessuna API key · verificato in PROVIDER_MAP 24/08/2026' },
    translategemma: { per1kUsd: 0, note: 'TranslateGemma su Ollama locale · nessuna API key · verificato in PROVIDER_MAP 24/08/2026' },
    ollama: { per1kUsd: 0, note: 'Ollama locale · nessuna API key · verificato in PROVIDER_MAP 24/08/2026' },
    lmstudio: { per1kUsd: 0, note: 'LM Studio su localhost:1234 · nessuna API key · verificato in PROVIDER_MAP 24/08/2026' },
    modelwiz: { per1kUsd: 0, note: 'Alocai ModelWiz su localhost:8080 · nessuna API key · verificato in PROVIDER_MAP 24/08/2026' },
    nllb: { per1kUsd: 0, note: 'NLLB-200 via HuggingFace Inference, chiamata anonima · verificato in PROVIDER_MAP 24/08/2026' },
    mymemory: { per1kUsd: 0, note: 'MyMemory API pubblica, nessuna chiave · verificato in PROVIDER_MAP 24/08/2026' },
    lingva: { per1kUsd: 0, note: 'Lingva istanza pubblica, nessuna chiave · verificato in PROVIDER_MAP 24/08/2026' },
    libretranslate: { per1kUsd: 0, note: 'LibreTranslate self-hosted o istanza pubblica · nessuna chiave · verificato in PROVIDER_MAP 24/08/2026' },

    // Claude, con le tre chiavi che le catene usano davvero. Le cifre e la data
    // sono quelle della voce `claude` qui sopra (verificata il 23/08/2026):
    // `anthropic` e `anthropic-claude4` chiamano entrambe translateWithAnthropic
    // → claude-sonnet-4-6, $3/1M; `anthropic-premium` chiama
    // translateWithAnthropicPremium → claude-opus-5, $5/1M
    // (ai-translate-direct.ts:400 e :408). Prima di oggi pagavano tutte e tre il
    // fallback 0.002: il preset «👑 Massima Qualità», che parte proprio da
    // Opus 5, era preventivato a 2,5 volte meno del vero. Questo è il verso
    // sbagliato dell'errore — una fattura più alta del preventivo.
    anthropic: { per1kUsd: 0.003, note: 'Claude Sonnet 4.6 ($3/1M input) · stessa cifra e stessa verifica della voce `claude` (23/08/2026)' },
    'anthropic-claude4': { per1kUsd: 0.003, note: 'Claude Sonnet 4.6 ($3/1M input) · stessa fn di `anthropic` · verificato 23/08/2026' },
    'anthropic-premium': { per1kUsd: 0.005, note: 'Claude Opus 5 ($5/1M input) · variante premium di ai-translate-direct.ts:408 · verificato 23/08/2026' },

    // Varianti dello stesso vendor, stessa API key, nessun listino separato in
    // questa tabella: prendono il prezzo della voce base come TETTO. Gemini 3.1
    // Flash-Lite costa meno di 3.7 Flash, quindi qui la stima sbaglia per
    // eccesso — il verso giusto, lo stesso della nota `deepseek`.
    'gemini-3.1': { per1kUsd: 0.0015, note: 'Gemini 3.1 Flash-Lite · tetto: prezzo della voce `gemini` (23/08/2026), il Lite costa meno' },
    'deepl-voice': { per1kUsd: 0.02, note: 'DeepL Voice · tetto: prezzo della voce `deepl`, nessun listino separato verificato' },

    // ⚠️ RESTANO SENZA PREZZO, di proposito: groq, groq-gptoss, cerebras, qwen,
    // cohere, together, fireworks, azure. Hanno tutti bisogno di una API key
    // dell'utente e di un listino che nessuno ha ancora verificato: inventarne
    // uno qui sarebbe esattamente il difetto che questo blocco corregge.
    // Finché mancano, chain-cost.ts li stima con il fallback e lo DICHIARA
    // (StimaCosto.prezzoIgnoto, '?' accanto alla cifra). Chi verifica un
    // listino, aggiunga la voce qui con data e fonte e il '?' sparisce da solo.
  },
  models: {
    openai: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', recommended: true },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    ],
    claude: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', recommended: true },
      { id: 'claude-opus-5', label: 'Claude Opus 5' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
    gemini: [
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', recommended: true },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
    ],
    deepseek: [{ id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', recommended: true }],
    mistral: [{ id: 'mistral-small-latest', label: 'Mistral Small 4' }],
  },
  recommendations: {
    creative: 'claude',
    asian: 'deepseek',
    ui_variables: 'gemini',
    large_project: 'claude',
    european_ui: 'gpt5',
    rare_language: 'openrouter',
    default: 'gpt5',
  },
};

// ── Validazione & merge (puri, testabili) ──────────────────

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Valida e RIPULISCE una config remota arbitraria: tiene solo le voci ben
 * formate, scarta il resto. Ritorna null se non è nemmeno un oggetto.
 */
export function validateModelConfig(raw: unknown): RemoteModelConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const pricing: Record<string, ProviderPricing> = {};
  if (r.pricing && typeof r.pricing === 'object') {
    for (const [k, v] of Object.entries(r.pricing as Record<string, unknown>)) {
      const pv = v as Record<string, unknown>;
      if (pv && isFiniteNumber(pv.per1kUsd) && pv.per1kUsd >= 0) {
        pricing[k] = {
          per1kUsd: pv.per1kUsd,
          note: typeof pv.note === 'string' ? pv.note.slice(0, 120) : undefined,
        };
      }
    }
  }

  const models: Record<string, ModelInfo[]> = {};
  if (r.models && typeof r.models === 'object') {
    for (const [k, v] of Object.entries(r.models as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      const list: ModelInfo[] = [];
      for (const m of v) {
        const mm = m as Record<string, unknown>;
        if (mm && typeof mm.id === 'string' && mm.id) {
          list.push({
            id: mm.id.slice(0, 80),
            label: typeof mm.label === 'string' && mm.label ? mm.label.slice(0, 80) : mm.id,
            recommended: mm.recommended === true,
          });
        }
      }
      if (list.length > 0) models[k] = list;
    }
  }

  const recommendations: Record<string, string> = {};
  if (r.recommendations && typeof r.recommendations === 'object') {
    for (const [k, v] of Object.entries(r.recommendations as Record<string, unknown>)) {
      if (typeof v === 'string' && v) recommendations[k] = v.slice(0, 40);
    }
  }

  // Serve almeno un campo utile per considerarla valida.
  if (Object.keys(pricing).length === 0 && Object.keys(models).length === 0) return null;

  return {
    version: isFiniteNumber(r.version) ? r.version : 0,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    pricing,
    models,
    recommendations: Object.keys(recommendations).length ? recommendations : undefined,
  };
}

/** Sovrappone la config remota (già validata) sopra i default bundled. */
export function mergeModelConfig(
  bundled: RemoteModelConfig,
  remote: RemoteModelConfig | null
): RemoteModelConfig {
  if (!remote) return bundled;
  return {
    version: remote.version || bundled.version,
    updatedAt: remote.updatedAt || bundled.updatedAt,
    pricing: { ...bundled.pricing, ...remote.pricing },
    models: { ...bundled.models, ...remote.models },
    recommendations: { ...bundled.recommendations, ...remote.recommendations },
  };
}

/**
 * Prezzo di ripiego per un provider che il catalogo non conosce. È una CIFRA
 * INVENTATA, ereditata dallo storico: sta qui, con un nome, perché chi la usa
 * possa dire di starla usando (vedi getProviderPrice1kOrNull).
 */
export const FALLBACK_PRICE_1K = 0.002;

/**
 * Prezzo per 1K token del provider, `null` se il provider NON è in catalogo.
 *
 * ⛔ PERCHÉ ESISTE (24/08/2026): `getProviderPrice1k` risponde comunque, con
 * FALLBACK_PRICE_1K, e va benissimo per estimateBatchCost — lì il provider è
 * uno solo, scelto dall'utente, e una stima prudente è meglio di nessuna. Ma
 * chi ragiona su una CATENA deve distinguere tre casi, non due: gratis (0),
 * a pagamento (>0) e ignoto (null). chain-cost.ts li confondeva, e trattava
 * «assente dal catalogo» come «gratuito»: siccome nessuna voce valeva 0, quel
 * ramo non scattava mai e i provider locali finivano fatturati a 0.002.
 *
 * Nota: 0 è un prezzo LEGITTIMO, non un'assenza — validateModelConfig accetta
 * `per1kUsd >= 0` apposta, così una config remota può dichiarare gratuito un
 * provider. Per questo il controllo è sul tipo e non sulla verità del valore.
 */
export function getProviderPrice1kOrNull(config: RemoteModelConfig, provider: string): number | null {
  const p = config.pricing[provider]?.per1kUsd;
  return typeof p === 'number' ? p : null;
}

/** Prezzo per 1K token del provider (fallback: 0.002, come lo storico). */
export function getProviderPrice1k(config: RemoteModelConfig, provider: string): number {
  return getProviderPrice1kOrNull(config, provider) ?? FALLBACK_PRICE_1K;
}

/** Catalogo modelli del provider (vuoto se assente). */
export function getProviderModels(config: RemoteModelConfig, provider: string): ModelInfo[] {
  return config.models[provider] ?? [];
}

/** Provider consigliato per uno scenario, fallback a 'default' e poi a 'gpt5'. */
export function getRecommendation(config: RemoteModelConfig, scenario: string): string {
  return config.recommendations?.[scenario] ?? config.recommendations?.default ?? 'gpt5';
}

// ── Fetch / cache (fail-open) ──────────────────────────────

const CACHE_KEY = 'gs-model-config';
const TTL_MS = 12 * 3600_000; // 12h
const DEFAULT_URL = 'https://gamestringer.ai/config/models.json';

function configUrl(): string {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    const u = settings?.advanced?.modelConfigUrl;
    return typeof u === 'string' && /^https?:\/\//.test(u) ? u : DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

function readCache(): { config: RemoteModelConfig; ts: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (v && typeof v === 'object' && v.config && typeof v.ts === 'number') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(config: RemoteModelConfig): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ config, ts: Date.now() }));
  } catch {
    /* storage pieno: ignora */
  }
}

let inFlight: Promise<void> | null = null;

/**
 * Scarica e valida la config remota, aggiornando la cache. Fail-open: qualsiasi
 * errore lascia la cache/bundled invariati. Deduplica le chiamate concorrenti.
 */
export async function refreshModelConfig(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(configUrl(), { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!res.ok) return;
      const raw = await res.json();
      const valid = validateModelConfig(raw);
      if (valid) writeCache(valid);
    } catch {
      /* offline / CSP / host giù → si resta sul bundled */
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Config effettiva (sincrona): bundled sovrascritto dalla cache remota, se c'è.
 * Se la cache è vecchia o assente, lancia un refresh in background (il valore
 * fresco sarà disponibile alla chiamata successiva).
 */
export function getModelConfig(): RemoteModelConfig {
  if (typeof window === 'undefined') return BUNDLED_MODEL_CONFIG;
  const cached = readCache();
  if (!cached || Date.now() - cached.ts > TTL_MS) {
    void refreshModelConfig();
  }
  return cached ? mergeModelConfig(BUNDLED_MODEL_CONFIG, cached.config) : BUNDLED_MODEL_CONFIG;
}
