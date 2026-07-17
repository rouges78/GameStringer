/**
 * Reflection Translator — pipeline agentica auto-correttiva (write → reflect → refine)
 *
 * Secondo passaggio LLM che critica la traduzione appena prodotta contro
 * glossario, contesto, coerenza terminologica, tono e formattazione, e la
 * riscrive quando trova problemi (pattern "reflection" di Andrew Ng / TransAgents).
 *
 * Design:
 * - Il critico usa lo STESSO provider che ha prodotto la traduzione (nessuna
 *   config extra): la mappa REFLECTION_PROVIDERS espone una chat generica per
 *   ogni provider LLM-capable. I provider MT puri (DeepL, MyMemory, Lingva,
 *   NLLB, LibreTranslate, HY-MT, TranslateGemma...) non sono riflettibili → skip.
 * - Attivazione SELETTIVA: solo le stringhe "a rischio" (placeholder complessi,
 *   anomalie di lunghezza, termini di glossario, dialoghi lunghi) passano dal
 *   critico, con un cap per batch per tenere i costi sotto controllo.
 * - Critica e riscrittura avvengono in UNA chiamata (critic-editor) per non
 *   raddoppiare i costi; una guardia deterministica scarta le revisioni che
 *   rompono i placeholder o esplodono in lunghezza.
 *
 * Aggancio: translateWithFallback() chiama maybeReflect() subito dopo il
 * successo di un provider, prima di restituire le traduzioni.
 */

import { clientLogger } from '@/lib/client-logger';
import { ollamaFetch } from './ollama-http';
import { httpPostJson } from './http-proxy';
import { extractPlaceholders, autoFixPlaceholders, placeholdersPreserved } from './placeholder-guard';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export type ReflectionMode = 'auto' | 'off' | 'always';

export interface ReflectionCandidate {
  index: number;
  source: string;
  translation: string;
  reasons: string[];
  severity: number;
}

export interface ReflectionInput {
  texts: string[];
  translations: string[];
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string;
  glossaryHint?: string;
  gameId?: string;
  /** Override esplicito della modalità (default: settings → 'auto') */
  mode?: ReflectionMode;
  /** Cap candidati per batch in modalità 'auto' */
  maxCandidates?: number;
  /** Auto-fix deterministico dei placeholder nel pass finale (default: true) */
  autoFix?: boolean;
}

export interface ReflectionOutcome {
  translations: string[];
  /** Quante stringhe sono state selezionate per la riflessione */
  candidates: number;
  /** Quante stringhe sono state effettivamente riscritte */
  refined: number;
  /** Quante stringhe sono state riparate dall'auto-fix dei placeholder */
  repaired: number;
}

type ChatFn = (key: string, system: string, user: string) => Promise<string>;

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------

/** Legge la modalità riflessione dalle impostazioni utente (default: 'auto') */
export function getReflectionMode(): ReflectionMode {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    const mode = settings?.translation?.reflectionMode;
    if (mode === 'off' || mode === 'always' || mode === 'auto') return mode;
  } catch {
    // localStorage non disponibile (SSR/test) → default
  }
  return 'auto';
}

// ---------------------------------------------------------------------------
// Euristica di selezione (deterministica, zero costi)
// ---------------------------------------------------------------------------

/**
 * Estrazione e auto-fix dei token protetti (placeholder, tag, control code, ruby)
 * sono centralizzati in `placeholder-guard`. Re-export per compatibilità con i
 * consumatori esistenti (test, agenti di review).
 */
export { extractPlaceholders, autoFixPlaceholders, placeholdersPreserved };

/**
 * Estrae i termini sorgente dal glossario manuale (glossaryHint), che usa
 * righe tipo "term -> translation", "term → translation", "term = translation"
 * o "term: translation".
 */
export function extractGlossaryTerms(hint?: string): string[] {
  if (!hint) return [];
  const terms: string[] = [];
  for (const rawLine of hint.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('[') || line.startsWith('#')) continue;
    const m = line.match(/^["']?(.+?)["']?\s*(?:->|→|=>|=|:)\s*.+$/);
    if (m) {
      const term = m[1].trim();
      if (term.length >= 2 && term.length <= 60) terms.push(term);
    }
  }
  return Array.from(new Set(terms));
}

/**
 * Seleziona le stringhe "a rischio" che meritano il secondo passaggio.
 * Ritorna i candidati ordinati per severità decrescente (cap applicato in 'auto').
 */
export function selectReflectionCandidates(
  texts: string[],
  translations: string[],
  opts: { glossaryHint?: string; mode?: ReflectionMode; maxCandidates?: number } = {}
): ReflectionCandidate[] {
  const mode: ReflectionMode = opts.mode || 'auto';
  if (mode === 'off') return [];

  const glossaryTerms = extractGlossaryTerms(opts.glossaryHint);
  const candidates: ReflectionCandidate[] = [];

  for (let i = 0; i < texts.length; i++) {
    const source = texts[i] ?? '';
    const translation = translations[i] ?? '';
    const trimmed = source.trim();
    if (trimmed.length < 4 || !translation.trim()) continue;

    const reasons: string[] = [];
    let severity = 0;

    // 1. Placeholder mancanti/aggiunti — sempre critico
    const srcPh = extractPlaceholders(source);
    const trPh = new Set(extractPlaceholders(translation));
    const missing = srcPh.filter(p => !trPh.has(p));
    if (missing.length > 0) {
      reasons.push('placeholder-mismatch');
      severity += 3;
    }

    // 2. Anomalia di lunghezza (traduzione esplosa o collassata)
    if (trimmed.length >= 12) {
      const ratio = translation.length / source.length;
      if (ratio > 2.2 || ratio < 0.35) {
        reasons.push('length-anomaly');
        severity += 3;
      }
    }

    // 3. Stringa lunga rimasta identica → probabilmente non tradotta
    if (trimmed.length >= 12 && translation.trim() === trimmed) {
      reasons.push('untranslated');
      severity += 2;
    }

    // 4. Termini di glossario presenti nel sorgente → verifica terminologia
    if (glossaryTerms.length > 0) {
      const lowerSrc = source.toLowerCase();
      if (glossaryTerms.some(t => lowerSrc.includes(t.toLowerCase()))) {
        reasons.push('glossary-term');
        severity += 2;
      }
    }

    // 5. Markup/placeholder complessi (≥2) → alto rischio di rottura
    if (srcPh.length >= 2) {
      reasons.push('complex-markup');
      severity += 2;
    }

    // 6. Dialogo lungo / testo narrativo → sfumature di tono e stile
    if (trimmed.length >= 100) {
      reasons.push('long-dialogue');
      severity += 1;
    } else if (trimmed.length >= 60 && /[!?…"'«»""]/.test(trimmed)) {
      reasons.push('long-dialogue');
      severity += 1;
    }

    if (mode === 'always' && reasons.length === 0) {
      reasons.push('always');
      severity = 1;
    }

    if (reasons.length > 0) {
      candidates.push({ index: i, source, translation, reasons, severity });
    }
  }

  candidates.sort((a, b) => b.severity - a.severity || a.index - b.index);

  if (mode === 'auto') {
    const cap = opts.maxCandidates ?? Math.min(10, Math.max(4, Math.ceil(texts.length * 0.2)));
    return candidates.slice(0, cap);
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Chat generiche per provider (il critico usa lo stesso provider del traduttore)
// ---------------------------------------------------------------------------

const GEMINI_MODEL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GEMINI_MODEL) ||
  'gemini-3.5-flash';
const ANTHROPIC_MODEL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ANTHROPIC_MODEL) ||
  'claude-sonnet-4-6';
const ANTHROPIC_MODEL_PREMIUM =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ANTHROPIC_MODEL_PREMIUM) ||
  'claude-opus-4-8';

function chatOpenAICompatible(endpoint: string, model: string, extraHeaders?: Record<string, string>): ChatFn {
  return async (key, system, user) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(extraHeaders || {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });
    if (!res.ok) throw new Error(`Reflection chat ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  };
}

/** Come sopra ma via backend Rust (aggira il CORS del webview, come le traduzioni) */
function chatOpenAICompatibleProxy(endpoint: string, model: string): ChatFn {
  return async (key, system, user) => {
    const res = await httpPostJson(
      endpoint,
      { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    );
    if (!res.ok) throw new Error(`Reflection chat ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  };
}

function chatGemini(model: string): ChatFn {
  return async (key, system, user) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      }
    );
    if (!res.ok) throw new Error(`Reflection chat ${res.status}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  };
}

function chatAnthropic(model: string): ChatFn {
  return async (key, system, user) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Reflection chat ${res.status}`);
    const data = await res.json();
    return data?.content?.[0]?.text || '';
  };
}

const chatCohere: ChatFn = async (key, system, user) => {
  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'command-r-plus-08-2024',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`Reflection chat ${res.status}`);
  const data = await res.json();
  return data?.message?.content?.[0]?.text || '';
};

const chatOllama: ChatFn = async (_key, system, user) => {
  // Selezione modello: preferenza utente, poi modelli istruiti generici
  let model = 'llama3';
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    const preferred: string = settings?.translation?.ollamaModel || '';
    const tags = await ollamaFetch('/api/tags', { timeoutMs: 3000 });
    if (tags.ok) {
      const data = await tags.json();
      const available = ((data.models || []) as { name: string }[]).map(m => m.name);
      if (preferred && available.some(n => n.startsWith(preferred))) {
        model = available.find(n => n.startsWith(preferred))!;
      } else {
        model = available.find(n => /qwen|llama3|mistral|tower/.test(n)) || available[0] || 'llama3';
      }
    }
  } catch {
    // Ollama offline → la chat sotto fallirà e la riflessione verrà saltata
  }
  const res = await ollamaFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
      options: { temperature: 0.2, num_predict: 4096 },
    }),
    timeoutMs: 90000,
  });
  if (!res.ok) throw new Error(`Reflection chat ${res.status}`);
  const data = await res.json();
  return data?.message?.content?.trim() || '';
};

/**
 * Provider su cui la riflessione è possibile (LLM chat-capable).
 * I provider MT puri (deepl, mymemory, lingva, nllb, libretranslate, azure,
 * hymt, translategemma, lmstudio, modelwiz) non hanno un critico → skip.
 */
const REFLECTION_PROVIDERS: Record<string, ChatFn> = {
  gemini: chatGemini(GEMINI_MODEL),
  'gemini-3.1': chatGemini('gemini-3.1-flash-lite'),
  groq: chatOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile'),
  'groq-gptoss': chatOpenAICompatibleProxy('https://api.groq.com/openai/v1/chat/completions', 'openai/gpt-oss-120b'),
  deepseek: chatOpenAICompatible('https://api.deepseek.com/chat/completions', 'deepseek-chat'),
  openai: chatOpenAICompatibleProxy('https://api.openai.com/v1/chat/completions', 'gpt-4o-mini'),
  anthropic: chatAnthropic(ANTHROPIC_MODEL),
  'anthropic-claude4': chatAnthropic(ANTHROPIC_MODEL),
  'anthropic-premium': chatAnthropic(ANTHROPIC_MODEL_PREMIUM),
  mistral: chatOpenAICompatible('https://api.mistral.ai/v1/chat/completions', 'mistral-small-latest'),
  cohere: chatCohere,
  together: chatOpenAICompatible('https://api.together.xyz/v1/chat/completions', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'),
  fireworks: chatOpenAICompatible('https://api.fireworks.ai/inference/v1/chat/completions', 'accounts/fireworks/models/llama-v3p3-70b-instruct'),
  openrouter: chatOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', 'meta-llama/llama-3.3-70b-instruct:free', {
    'HTTP-Referer': 'https://gamestringer.app',
    'X-Title': 'GameStringer',
  }),
  cerebras: chatOpenAICompatible('https://api.cerebras.ai/v1/chat/completions', 'llama-3.3-70b'),
  qwen: chatOpenAICompatible('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen-plus'),
  ollama: chatOllama,
};

/** True se il provider supporta il passaggio di riflessione */
export function isReflectionCapable(providerName: string): boolean {
  return providerName in REFLECTION_PROVIDERS;
}

// ---------------------------------------------------------------------------
// Critico: prompt, parsing, guardie
// ---------------------------------------------------------------------------

interface CriticVerdict {
  i: number;
  ok: boolean;
  issues?: string;
  revised?: string;
}

function buildCriticSystem(sourceLang: string, targetLang: string): string {
  return `You are a senior video game localization reviewer performing a reflection pass.
You receive SOURCE → TRANSLATION pairs (from ${sourceLang} to ${targetLang}), plus optional glossary and context.
For each item, judge the TRANSLATION on:
1. Glossary adherence — glossary terms MUST use the given target terms.
2. Accuracy — no added or lost meaning, no hallucinations.
3. Tone & register — must fit the game context (dialogue vs UI vs lore).
4. Fluency & cultural nuance — must read naturally to a native ${targetLang} player.
5. Formatting — placeholders (%s, %d, {0}, {name}), tags (<b>, [[T0]]) and \\n MUST be preserved EXACTLY as in the source.

Reply ONLY with a JSON array, one object per item, same order:
- {"i": <item number>, "ok": true} if the translation is good as-is;
- {"i": <item number>, "ok": false, "issues": "<short reason>", "revised": "<improved full translation>"} if it should be improved.
Never invent placeholders, never drop them. "revised" must be the complete corrected translation, nothing else. No prose outside the JSON array.`;
}

function buildCriticUser(
  candidates: ReflectionCandidate[],
  opts: { context?: string; glossaryHint?: string }
): string {
  let out = '';
  if (opts.glossaryHint) out += `[GLOSSARY]\n${opts.glossaryHint}\n\n`;
  if (opts.context) out += `[CONTEXT]\n${opts.context}\n\n`;
  out += candidates
    .map((c, n) => `${n + 1}. SOURCE: ${JSON.stringify(c.source)}\n   TRANSLATION: ${JSON.stringify(c.translation)}`)
    .join('\n');
  return out;
}

function parseCriticResponse(raw: string): CriticVerdict[] {
  try {
    const cleaned = raw.replace(/```(?:json)?\s*|\s*```/g, '');
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is CriticVerdict =>
        v && typeof v === 'object' && typeof v.i === 'number' && typeof v.ok === 'boolean'
    );
  } catch {
    return [];
  }
}

/**
 * Guardia deterministica: accetta la revisione solo se non rompe nulla.
 * Ritorna la stringa da usare (revised se valida, altrimenti current).
 */
export function guardRevision(source: string, current: string, revised: unknown): string {
  if (typeof revised !== 'string') return current;
  const trimmed = revised.trim();
  if (!trimmed || trimmed === current.trim()) return current;

  // I placeholder del sorgente devono sopravvivere tutti nella revisione
  const srcPh = extractPlaceholders(source);
  const revPh = extractPlaceholders(trimmed);
  const revSet = new Set(revPh);
  if (srcPh.some(p => !revSet.has(p))) return current;
  // La revisione non deve INVENTARE placeholder assenti dal sorgente
  const srcSet = new Set(srcPh);
  if (revPh.some(p => !srcSet.has(p))) return current;

  // Niente esplosioni di lunghezza (UI di gioco)
  if (trimmed.length > Math.max(source.length * 2.5, source.length + 40)) return current;

  return trimmed;
}

// ---------------------------------------------------------------------------
// Orchestrazione
// ---------------------------------------------------------------------------

/** Quanti item per singola chiamata al critico */
const CRITIC_BATCH_SIZE = 6;

/**
 * Esegue il ciclo reflect → refine sulle stringhe candidate usando la chat
 * del provider indicato. Non lancia mai: in caso di errore ritorna le
 * traduzioni originali (fail-open).
 */
export async function maybeReflect(
  input: ReflectionInput,
  providerName: string,
  providerKey: string
): Promise<ReflectionOutcome> {
  const mode = input.mode || getReflectionMode();
  if (mode === 'off') {
    // 'off' = mani ferme del tutto: né riflessione LLM né auto-fix.
    return { translations: input.translations, candidates: 0, refined: 0, repaired: 0 };
  }

  const result = [...input.translations];
  let refined = 0;
  let candidatesCount = 0;

  // 1) Riflessione LLM selettiva (solo per i provider LLM-capable)
  const chat = REFLECTION_PROVIDERS[providerName];
  if (chat) {
    const candidates = selectReflectionCandidates(input.texts, input.translations, {
      glossaryHint: input.glossaryHint,
      mode,
      maxCandidates: input.maxCandidates,
    });
    candidatesCount = candidates.length;

    if (candidates.length > 0) {
      const srcLang = input.sourceLanguage || 'en';
      const system = buildCriticSystem(srcLang, input.targetLanguage);

      for (let i = 0; i < candidates.length; i += CRITIC_BATCH_SIZE) {
        const chunk = candidates.slice(i, i + CRITIC_BATCH_SIZE);
        try {
          const user = buildCriticUser(chunk, {
            context: input.context,
            glossaryHint: input.glossaryHint,
          });
          const raw = await chat(providerKey, system, user);
          const verdicts = parseCriticResponse(raw);

          for (const v of verdicts) {
            const c = chunk[v.i - 1]; // il critico numera 1-based dentro il chunk
            if (!c || v.ok) continue;
            const guarded = guardRevision(c.source, result[c.index], v.revised);
            if (guarded !== result[c.index]) {
              clientLogger.debug(
                `[Reflection] ✏️ #${c.index} (${c.reasons.join(',')}): "${result[c.index].substring(0, 40)}" → "${guarded.substring(0, 40)}"${v.issues ? ` — ${v.issues}` : ''}`
              );
              result[c.index] = guarded;
              refined++;
            }
          }
        } catch (e: unknown) {
          // Fail-open: il chunk fallito mantiene le traduzioni del primo passaggio
          clientLogger.warn(`[Reflection] Chunk fallito su ${providerName}: ${String(e)}`);
        }
      }

      if (refined > 0) {
        clientLogger.debug(
          `[Reflection] ${providerName}: ${candidates.length} candidate, ${refined} raffinate (mode: ${mode})`
        );
      }
    }
  }

  // 2) Auto-fix deterministico FINALE: protezione GARANTITA di placeholder/tag/
  //    control code su OGNI stringa, indipendente dal provider e dall'LLM.
  //    Ripristina i token persi anche quando la riflessione è saltata (fail-open),
  //    non disponibile (provider MT) o non ha selezionato la stringa.
  let repaired = 0;
  if (input.autoFix !== false) {
    for (let i = 0; i < result.length; i++) {
      const current = result[i] ?? '';
      const fixed = autoFixPlaceholders(input.texts[i] ?? '', current);
      if (fixed !== current) {
        result[i] = fixed;
        repaired++;
      }
    }
    if (repaired > 0) {
      clientLogger.debug(`[Reflection] 🔧 auto-fix placeholder su ${repaired} stringhe (${providerName})`);
    }
  }

  return { translations: result, candidates: candidatesCount, refined, repaired };
}
