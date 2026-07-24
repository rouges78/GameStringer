/**
 * Opzioni di inferenza Ollama centralizzate.
 *
 * PERCHÉ: i parametri di generazione (temperature, top_p, top_k, repeat_penalty,
 * num_ctx, seed) erano hardcoded e sparsi nei call-site di ai-translate-direct.ts.
 * Qui diventano un'unica sorgente, salvata in localStorage sotto
 * `gameStringerSettings.translation.ollamaOptions`, pilotabile dal pannello
 * /ollama-manager/advanced.
 *
 * NON-BREAKING: se l'utente non ha mai configurato nulla, `buildOllamaOptions`
 * restituisce solo `{ temperature: <fallback del call-site> }` — identico al
 * comportamento precedente. I parametri avanzati vengono inviati a Ollama solo
 * quando l'utente li imposta esplicitamente (preset o modalità esperto).
 */

const SETTINGS_KEY = 'gameStringerSettings';

export interface OllamaInferenceOptions {
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  num_ctx: number;
  /** Seed fisso per risultati riproducibili (utile ai benchmark). Assente = casuale. */
  seed?: number;
}

export type OllamaPresetId = 'fedele' | 'bilanciato' | 'creativo' | 'custom';

/** I parametri realmente pilotabili (in ordine di UI). */
export const OLLAMA_OPTION_KEYS = [
  'temperature',
  'top_p',
  'top_k',
  'repeat_penalty',
  'num_ctx',
  'seed',
] as const;

/**
 * Preset data-driven per la traduzione videogiochi.
 * "Fedele" = poca invenzione + contesto ampio (default consigliato).
 */
export const OLLAMA_PRESETS: Record<Exclude<OllamaPresetId, 'custom'>, OllamaInferenceOptions> = {
  fedele: { temperature: 0.1, top_p: 0.85, top_k: 30, repeat_penalty: 1.1, num_ctx: 8192 },
  bilanciato: { temperature: 0.3, top_p: 0.9, top_k: 40, repeat_penalty: 1.1, num_ctx: 4096 },
  creativo: { temperature: 0.7, top_p: 0.95, top_k: 60, repeat_penalty: 1.05, num_ctx: 4096 },
};

/** Limiti di sicurezza per la modalità esperto. */
export const OLLAMA_OPTION_BOUNDS: Record<
  keyof OllamaInferenceOptions,
  { min: number; max: number; step: number }
> = {
  temperature: { min: 0, max: 1.5, step: 0.05 },
  top_p: { min: 0.1, max: 1, step: 0.05 },
  top_k: { min: 1, max: 100, step: 1 },
  repeat_penalty: { min: 0.8, max: 1.5, step: 0.05 },
  num_ctx: { min: 512, max: 32768, step: 512 },
  seed: { min: 0, max: 2147483647, step: 1 },
};

function readSettings(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Opzioni salvate dall'utente, o null se mai configurate. */
export function loadStoredOllamaOptions(): Partial<OllamaInferenceOptions> | null {
  try {
    const settings = readSettings();
    const t = (settings?.translation ?? {}) as Record<string, unknown>;
    const o = t.ollamaOptions;
    if (o && typeof o === 'object') return o as Partial<OllamaInferenceOptions>;
  } catch {
    /* SSR/test → nessuna config */
  }
  return null;
}

/** Preset attualmente selezionato (default 'fedele' in UI, ma non forzato sul motore). */
export function loadOllamaPreset(): OllamaPresetId {
  try {
    const settings = readSettings();
    const t = (settings?.translation ?? {}) as Record<string, unknown>;
    const p = t.ollamaPreset;
    if (p === 'fedele' || p === 'bilanciato' || p === 'creativo' || p === 'custom') return p;
  } catch {
    /* ignore */
  }
  return 'fedele';
}

/**
 * Costruisce l'oggetto `options` da passare a Ollama.
 * @param fallback valore di default del call-site (usato solo se l'utente non ha configurato nulla).
 */
export function buildOllamaOptions(fallback: { temperature?: number } = {}): Record<string, number> {
  const cfg = loadStoredOllamaOptions();
  const fallbackTemp =
    typeof fallback.temperature === 'number' ? fallback.temperature : OLLAMA_PRESETS.fedele.temperature;

  if (!cfg) return { temperature: fallbackTemp };

  const out: Record<string, number> = {};
  for (const k of OLLAMA_OPTION_KEYS) {
    const v = cfg[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  if (typeof out.temperature !== 'number') out.temperature = fallbackTemp;
  return out;
}

/** Salva preset + opzioni risolte in localStorage (merge non distruttivo col resto dei settings). */
export function saveOllamaOptions(preset: OllamaPresetId, options: Partial<OllamaInferenceOptions>): void {
  try {
    const settings = readSettings();
    const translation = (settings.translation ?? {}) as Record<string, unknown>;
    translation.ollamaPreset = preset;
    translation.ollamaOptions = options;
    settings.translation = translation;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* localStorage non disponibile → no-op */
  }
}

/** Rimuove la configurazione (torna al comportamento di default del motore). */
export function resetOllamaOptions(): void {
  try {
    const settings = readSettings();
    const translation = (settings.translation ?? {}) as Record<string, unknown>;
    delete translation.ollamaPreset;
    delete translation.ollamaOptions;
    settings.translation = translation;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* no-op */
  }
}
