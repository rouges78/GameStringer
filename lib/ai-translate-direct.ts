/**
 * AI Translation - Chiamate dirette API (NO API routes Next.js)
 * Supporta fallback automatico: Gemini → Groq → DeepSeek → OpenAI → originale
 */

export interface TranslateOptions {
  texts: string[];
  targetLanguage: string;
  sourceLanguage?: string;
  context?: string;
  glossaryHint?: string;
}

export interface TranslateResult {
  translations: string[];
  provider: string;
  success: boolean;
}

// Session-level flags: skip provider dopo errore fatale (permanente) o rate-limit (cooldown)
const blockedProviders = new Set<string>();
const cooldownProviders = new Map<string, number>(); // provider → timestamp sblocco

function blockProvider(name: string, permanent = true) {
  if (permanent) {
    blockedProviders.add(name);
    console.warn(`[Session] ${name} bloccato permanentemente (errore fatale)`);
  } else {
    // Cooldown 30s per rate-limit — il provider verrà riprovato dopo
    const unblockAt = Date.now() + 30000;
    cooldownProviders.set(name, unblockAt);
    console.warn(`[Session] ${name} in cooldown 30s (rate-limit)`);
  }
}

function isProviderBlocked(name: string): boolean {
  if (blockedProviders.has(name)) return true;
  const cooldownUntil = cooldownProviders.get(name);
  if (cooldownUntil) {
    if (Date.now() < cooldownUntil) return true;
    cooldownProviders.delete(name); // Cooldown scaduto, riprova
  }
  return false;
}

/** Reset provider blocks (es. quando si cambia API key) */
export function resetProviderBlocks() {
  blockedProviders.clear();
  cooldownProviders.clear();
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Legge API keys da localStorage */
export function getApiKeys() {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    return {
      gemini: settings?.translation?.apiKey || '',
      groq: settings?.translation?.groqApiKey || '',
      deepseek: settings?.translation?.deepseekApiKey || settings?.deepseekApiKey || '',
      openai: settings?.translation?.openaiApiKey || settings?.openaiApiKey || settings?.voice?.openaiKey || '',
      anthropic: settings?.translation?.anthropicApiKey || settings?.anthropicApiKey || '',
      mistral: settings?.translation?.mistralApiKey || '',
      cohere: settings?.translation?.cohereApiKey || '',
      together: settings?.translation?.togetherApiKey || '',
      fireworks: settings?.translation?.fireworksApiKey || '',
      openrouter: settings?.translation?.openrouterApiKey || '',
      cerebras: settings?.translation?.cerebrasApiKey || '',
      deepl: settings?.translation?.deeplApiKey || '',
      ollamaModel: settings?.translation?.ollamaModel || '',
    };
  } catch {
    return { gemini: '', groq: '', openai: '', deepseek: '', anthropic: '', mistral: '', cohere: '', together: '', fireworks: '', openrouter: '', cerebras: '', deepl: '', ollamaModel: '' };
  }
}

/** Costruisce il prompt di traduzione con glossario opzionale */
function buildTranslationPrompt(opts: TranslateOptions): string {
  const srcLang = opts.sourceLanguage || 'en';
  let prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.`;
  
  if (opts.glossaryHint) {
    prompt += `\n\n${opts.glossaryHint}`;
  }
  
  if (opts.context) {
    prompt += ` Context: ${opts.context}`;
  }
  
  prompt += `\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  
  return prompt;
}

/** Traduzione con Gemini API */
async function translateWithGemini(
  apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const prompt = buildTranslationPrompt(opts);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    }
  );

  if (res.status === 429) {
    throw new Error(`RateLimit`);
  }
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}`);
  }

  const data = await res.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return responseText
    .split('\n')
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Traduzione con DeepSeek API (fallback) */
async function translateWithDeepSeek(
  apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const prompt = buildTranslationPrompt(opts);

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (res.status === 402 || res.status === 429) {
    blockProvider('deepseek');
    throw new Error(`DeepSeek ${res.status}`);
  }
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);

  const data = await res.json();
  const responseText = data?.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return responseText
    .split('\n')
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Traduzione con Groq API — Llama 3.3 70B (gratuito) */
async function translateWithGroq(
  apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const prompt = buildTranslationPrompt(opts);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (res.status === 429) {
    throw new Error(`RateLimit`);
  }
  if (res.status === 413) {
    throw new Error(`ContentTooLarge`);
  }
  if (!res.ok) throw new Error(`Groq ${res.status}`);

  const data = await res.json();
  const responseText = data?.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return responseText
    .split('\n')
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Traduzione con OpenAI API (fallback) */
async function translateWithOpenAI(
  apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const prompt = buildTranslationPrompt(opts);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    blockProvider('openai');
    throw new Error(`OpenAI ${res.status}`);
  }

  const data = await res.json();
  const responseText = data?.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return responseText
    .split('\n')
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Traduzione con Anthropic Claude API */
async function translateWithAnthropic(
  apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const prompt = buildTranslationPrompt(opts);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    blockProvider('anthropic');
    throw new Error(`Anthropic ${res.status}`);
  }

  const data = await res.json();
  const responseText = data?.content?.[0]?.text || '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return responseText
    .split('\n')
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Funzione generica per API OpenAI-compatible */
async function translateWithOpenAICompatible(
  apiKey: string,
  opts: TranslateOptions,
  endpoint: string,
  model: string,
  providerName: string,
): Promise<string[]> {
  const prompt = buildTranslationPrompt(opts);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    blockProvider(providerName);
    throw new Error(`${providerName} ${res.status}`);
  }

  const data = await res.json();
  const responseText = data?.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return responseText
    .split('\n')
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Mistral AI — free tier disponibile, ottima qualità */
async function translateWithMistral(apiKey: string, opts: TranslateOptions): Promise<string[]> {
  return translateWithOpenAICompatible(apiKey, opts,
    'https://api.mistral.ai/v1/chat/completions',
    'mistral-small-latest',
    'Mistral',
  );
}

/** Cohere — Command R+, API v2 (OpenAI-compatible messages) */
async function translateWithCohere(apiKey: string, opts: TranslateOptions): Promise<string[]> {
  const prompt = buildTranslationPrompt(opts);

  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'command-r-plus-08-2024',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (res.status === 429) {
    throw new Error(`RateLimit`);
  }
  if (!res.ok) {
    throw new Error(`Cohere ${res.status}`);
  }

  const data = await res.json();
  const responseText = data?.message?.content?.[0]?.text || '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return responseText
    .split('\n')
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Together AI — OpenAI-compatible, Llama/Mixtral/Qwen, $25 free credit */
async function translateWithTogether(apiKey: string, opts: TranslateOptions): Promise<string[]> {
  return translateWithOpenAICompatible(apiKey, opts,
    'https://api.together.xyz/v1/chat/completions',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'Together',
  );
}

/** Fireworks AI — OpenAI-compatible, velocissimo, free tier */
async function translateWithFireworks(apiKey: string, opts: TranslateOptions): Promise<string[]> {
  return translateWithOpenAICompatible(apiKey, opts,
    'https://api.fireworks.ai/inference/v1/chat/completions',
    'accounts/fireworks/models/llama-v3p3-70b-instruct',
    'Fireworks',
  );
}

/** OpenRouter — aggregatore, OpenAI-compatible, modelli gratuiti disponibili */
async function translateWithOpenRouter(apiKey: string, opts: TranslateOptions): Promise<string[]> {
  const prompt = buildTranslationPrompt(opts);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://gamestringer.app',
      'X-Title': 'GameStringer',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    blockProvider('openrouter');
    throw new Error(`OpenRouter ${res.status}`);
  }

  const data = await res.json();
  const responseText = data?.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}

  return responseText
    .split('\n')
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line: string) => line.length > 0);
}

/** Cerebras — velocissimo (Llama 70B in <1s), free tier generoso */
async function translateWithCerebras(apiKey: string, opts: TranslateOptions): Promise<string[]> {
  return translateWithOpenAICompatible(apiKey, opts,
    'https://api.cerebras.ai/v1/chat/completions',
    'llama-3.3-70b',
    'Cerebras',
  );
}

/** DeepL — qualità top per traduzioni, 500K chars/mese gratis */
async function translateWithDeepL(
  apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  // DeepL usa codici lingua diversi
  const langMap: Record<string, string> = {
    en: 'EN', it: 'IT', de: 'DE', fr: 'FR', es: 'ES', pt: 'PT-BR',
    nl: 'NL', pl: 'PL', ru: 'RU', ja: 'JA', zh: 'ZH', ko: 'KO',
    sv: 'SV', da: 'DA', fi: 'FI', el: 'EL', cs: 'CS', ro: 'RO',
    hu: 'HU', sk: 'SK', bg: 'BG', sl: 'SL', et: 'ET', lv: 'LV', lt: 'LT',
  };
  const targetLang = langMap[opts.targetLanguage] || opts.targetLanguage.toUpperCase();
  // Determina endpoint (free vs pro)
  const isFree = apiKey.endsWith(':fx');
  const baseUrl = isFree ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

  const res = await fetch(`${baseUrl}/v2/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body: JSON.stringify({
      text: opts.texts,
      target_lang: targetLang,
    }),
  });

  if (!res.ok) {
    blockProvider('deepl');
    throw new Error(`DeepL ${res.status}`);
  }

  const data = await res.json();
  return (data?.translations || []).map((t: { text: string }) => t.text);
}

/** MyMemory — gratis, nessuna API key, 5000 chars/day */
async function translateWithMyMemory(
  _apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const srcLang = opts.sourceLanguage || 'en';
  const tgtLang = opts.targetLanguage || 'it';
  const results: string[] = [];
  
  for (const text of opts.texts) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcLang}|${tgtLang}`;
    const res = await fetch(url);
    if (!res.ok) {
      blockProvider('mymemory');
      throw new Error(`MyMemory ${res.status}`);
    }
    const data = await res.json();
    if (data?.responseStatus === 429) {
      blockProvider('mymemory', false); // cooldown, non blocco permanente
      throw new Error('RateLimit');
    }
    results.push(data?.responseData?.translatedText || text);
  }
  return results;
}

/** TranslateGemma — Google, via Ollama, specializzato traduzione, 55 lingue, gratuito locale */
async function translateWithTranslateGemma(
  _apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const ollamaUrl = 'http://localhost:11434';
  const srcLang = opts.sourceLanguage || 'en';

  // Verifica se il modello è installato
  try {
    const tagsRes = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!tagsRes.ok) throw new Error('Ollama non raggiungibile');
    const tagsData = await tagsRes.json();
    const available = (tagsData.models || []).map((m: any) => m.name);
    const hasModel = available.some((n: string) => n.startsWith('translategemma'));
    if (!hasModel) throw new Error('TranslateGemma non installato. Esegui: ollama pull translategemma');
  } catch (err) {
    blockProvider('translategemma');
    throw err;
  }

  // TranslateGemma usa prompt specifico per traduzione
  const results: string[] = [];
  const batchText = opts.texts.join('\n|||\n');
  const prompt = `Translate from ${srcLang} to ${opts.targetLanguage}. Return ONLY the translations, one per line, separated by |||. Do NOT add explanations.\n\n${batchText}`;

  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'translategemma',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.2, num_predict: 4096 },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      blockProvider('translategemma');
      throw new Error(`TranslateGemma ${res.status}`);
    }

    const data = await res.json();
    const responseText = data?.message?.content?.trim() || '';

    // Parse: se c'è ||| usa quello, altrimenti split per newline
    if (responseText.includes('|||')) {
      results.push(...responseText.split('|||').map((s: string) => s.trim()).filter((s: string) => s));
    } else {
      results.push(...responseText.split('\n').map((s: string) => s.trim()).filter((s: string) => s));
    }

    // Se le righe non corrispondono, prova uno-a-uno
    if (results.length !== opts.texts.length && opts.texts.length > 1) {
      results.length = 0;
      for (const text of opts.texts) {
        const singleRes = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'translategemma',
            messages: [{ role: 'user', content: `Translate from ${srcLang} to ${opts.targetLanguage}: ${text}` }],
            stream: false,
            options: { temperature: 0.2, num_predict: 500 },
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (!singleRes.ok) throw new Error(`TranslateGemma ${singleRes.status}`);
        const singleData = await singleRes.json();
        results.push(singleData?.message?.content?.trim() || text);
      }
    }

    return results;
  } catch (err) {
    blockProvider('translategemma');
    throw err;
  }
}

// Mappa codici lingua → nomi completi per HY-MT
const LANG_NAMES: Record<string, string> = {
  en: 'English', it: 'Italian', de: 'German', fr: 'French', es: 'Spanish',
  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  'zh-Hans': 'Simplified Chinese', 'zh-Hant': 'Traditional Chinese',
  pl: 'Polish', nl: 'Dutch', sv: 'Swedish', da: 'Danish', fi: 'Finnish',
  no: 'Norwegian', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', tr: 'Turkish',
  ar: 'Arabic', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', uk: 'Ukrainian',
  el: 'Greek', bg: 'Bulgarian', hr: 'Croatian', sk: 'Slovak', sl: 'Slovenian',
  'pt-BR': 'Brazilian Portuguese', 'es-419': 'Latin American Spanish',
};

/** HY-MT1.5 (Tencent) — via Ollama, #1 WMT25, batte Google Translate in 30/31 lingue */
async function translateWithHYMT(
  _apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const ollamaUrl = 'http://localhost:11434';
  const srcCode = opts.sourceLanguage || 'en';
  const tgtCode = opts.targetLanguage || 'it';
  const srcLang = LANG_NAMES[srcCode] || srcCode;
  const tgtLang = LANG_NAMES[tgtCode] || tgtCode;

  // Auto-detect miglior modello HY-MT disponibile (7B > 1.8B)
  let modelName = '';
  try {
    const tagsRes = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!tagsRes.ok) throw new Error('Ollama non raggiungibile');
    const tagsData = await tagsRes.json();
    const available = (tagsData.models || []).map((m: any) => m.name);
    const prefer = [
      (n: string) => n.includes('hy-mt') && n.includes('abliterated') && n.includes('7b'),
      (n: string) => n.includes('hy-mt') && n.includes('7b'),
      (n: string) => n.includes('hy-mt') && n.includes('abliterated'),
      (n: string) => n.includes('hy-mt'),
      (n: string) => n.includes('hunyuan') && n.includes('mt'),
    ];
    for (const check of prefer) {
      const found = available.find(check);
      if (found) { modelName = found; break; }
    }
    if (!modelName) throw new Error('HY-MT1.5 non installato. Vai in Settings → Ollama e premi Pull su HY-MT');
  } catch (err) {
    blockProvider('hymt');
    throw err;
  }

  console.log(`[HY-MT] Usando modello: ${modelName} (${srcLang} → ${tgtLang})`);

  // Traduzione singola con richieste parallele (5 alla volta) per affidabilità + velocità
  const CONCURRENCY = 3;
  const results: string[] = new Array(opts.texts.length).fill('');

  // Prompt base per contesto videogioco
  const systemPrompt = `You are a professional video game translator. Translate the source text from ${srcLang} to ${tgtLang}.
Rules:
- This text is from a video game (menus, dialogues, items, UI).
- Output ONLY the translation, nothing else.
- Keep the same length, tone, and capitalization style.
- Do NOT add punctuation that was not in the original.
- Do NOT add explanations or notes.
- PRESERVE ALL HTML/XML tags exactly as they appear: <b>, </>, <i>, </i>, <br>, etc. Copy them character-by-character.
- PRESERVE placeholders like {0}, {name}, %s, %d, ID_INTERACT, ID_RUN, ID_CROUCH exactly as-is.
- For game UI terms: "Resume" = resume/continue play (not CV), "Hold" = hold button, "Run" = run/sprint, "Select" = select/choose.`;

  // Pre-processing: proteggi tag HTML/XML con placeholder prima di inviare al LLM
  const TAG_REGEX = /<\/?[a-zA-Z][^>]*\/?>/g;  // Standard HTML tags
  const UNREAL_CLOSE_REGEX = /<\/>/g;           // Unreal rich text close tag
  const protectTags = (text: string): { cleaned: string; tags: Map<string, string> } => {
    const tags = new Map<string, string>();
    let counter = 0;
    // Prima proteggi tag standard HTML/XML
    let cleaned = text.replace(TAG_REGEX, (match) => {
      const placeholder = `[[T${counter}]]`;
      tags.set(placeholder, match);
      counter++;
      return placeholder;
    });
    // Poi proteggi </> di Unreal (non catturato dal regex standard)
    cleaned = cleaned.replace(UNREAL_CLOSE_REGEX, () => {
      const placeholder = `[[T${counter}]]`;
      tags.set(placeholder, '</>');
      counter++;
      return placeholder;
    });
    return { cleaned, tags };
  };
  const restoreTags = (text: string, tags: Map<string, string>): string => {
    let result = text;
    for (const [placeholder, original] of tags) {
      result = result.replace(placeholder, original);
    }
    return result;
  };

  // Post-processing: correggi typos comuni del LLM
  const fixCommonTypos = (text: string): string => {
    return text
      .replace(/\bSOIO\b/g, 'SONO')
      .replace(/\bsoio\b/g, 'sono')
      .replace(/\bperchè\b/g, 'perché')
      .replace(/\bPERCHÈ\b/g, 'PERCHÉ')
      .replace(/\bpò\b/g, 'po\'')
      .replace(/\bquà\b/g, 'qua')
      .replace(/\bsù\b/g, 'su')
      .replace(/\bfà\b/g, 'fa');
  };

  const translateOne = async (text: string, index: number): Promise<void> => {
    try {
      // Proteggi tag HTML prima dell'invio
      TAG_REGEX.lastIndex = 0; // Reset regex state prima di test()
      const hasTags = TAG_REGEX.test(text) || text.includes('</>');
      TAG_REGEX.lastIndex = 0; // Reset dopo test() per protectTags
      const { cleaned: inputText, tags } = hasTags ? protectTags(text) : { cleaned: text, tags: new Map<string, string>() };

      // Scala num_predict in base alla lunghezza del testo
      const numPredict = Math.max(500, Math.min(2000, text.length * 3));

      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: inputText },
          ],
          stream: false,
          options: { temperature: 0.1, num_predict: numPredict },
        }),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) throw new Error(`HY-MT ${res.status}`);
      const data = await res.json();
      let translated = data?.message?.content?.trim() || '';
      // Rimuovi eventuali prefissi come "Translation:" o virgolette
      translated = translated.replace(/^(Translation|Traduzione|Output)\s*:\s*/i, '');
      translated = translated.replace(/^["']|["']$/g, '');
      // Post-processing: rimuovi punti aggiunti dal modello su stringhe corte senza punto originale
      if (text.length < 30 && !text.endsWith('.') && translated.endsWith('.')) {
        translated = translated.slice(0, -1);
      }
      // Ripristina tag HTML protetti
      if (hasTags) {
        translated = restoreTags(translated, tags);
      }
      // Correggi typos comuni
      translated = fixCommonTypos(translated);
      results[index] = translated || text;
    } catch {
      results[index] = text; // Fallback: testo originale
    }
  };

  // Esegui in batch paralleli di CONCURRENCY
  for (let i = 0; i < opts.texts.length; i += CONCURRENCY) {
    const batch = opts.texts.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((text, j) => translateOne(text, i + j)));
  }

  console.log(`[HY-MT] Completate ${results.length} traduzioni (es: "${opts.texts[0]}" → "${results[0]}")`);
  return results;
}

/** Ollama Generico — qualsiasi modello installato in Ollama (llama3, mistral, phi, qwen, ecc.) */
async function translateWithOllamaGeneric(
  _apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const ollamaUrl = 'http://localhost:11434';
  const srcLang = opts.sourceLanguage || 'en';
  const keys = getApiKeys();
  const preferredModel = keys.ollamaModel;

  // Trova modello disponibile
  let selectedModel = '';
  try {
    const tagsRes = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!tagsRes.ok) throw new Error('Ollama non raggiungibile');
    const tagsData = await tagsRes.json();
    const available = (tagsData.models || []).map((m: any) => m.name) as string[];
    if (available.length === 0) throw new Error('Nessun modello Ollama installato');

    // Usa modello preferito se disponibile, altrimenti primo disponibile
    if (preferredModel && available.some(n => n.startsWith(preferredModel))) {
      selectedModel = available.find(n => n.startsWith(preferredModel))!;
    } else {
      selectedModel = available[0];
    }
  } catch (err) {
    blockProvider('ollama');
    throw err;
  }

  const prompt = buildTranslationPrompt(opts);

  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.3, num_predict: 4096 },
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      blockProvider('ollama');
      throw new Error(`Ollama ${res.status}`);
    }

    const data = await res.json();
    const responseText = data?.message?.content?.trim() || '';

    // Parse JSON array
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}

    // Fallback: split per newline
    const lines = responseText
      .split('\n')
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
      .filter((line: string) => line.length > 0);

    if (lines.length >= opts.texts.length) return lines.slice(0, opts.texts.length);

    // Ultimo fallback: testo uno a uno
    const results: string[] = [];
    for (const text of opts.texts) {
      const singleRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: `Translate from ${srcLang} to ${opts.targetLanguage}. Return ONLY the translation:\n${text}` }],
          stream: false,
          options: { temperature: 0.3, num_predict: 500 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!singleRes.ok) throw new Error(`Ollama ${singleRes.status}`);
      const singleData = await singleRes.json();
      results.push(singleData?.message?.content?.trim() || text);
    }
    return results;
  } catch (err) {
    blockProvider('ollama');
    throw err;
  }
}

/** Lingva Translate — gratis, nessuna API key, proxy Google Translate */
async function translateWithLingva(
  _apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const srcLang = opts.sourceLanguage || 'en';
  const tgtLang = opts.targetLanguage || 'it';
  const results: string[] = [];
  
  for (const text of opts.texts) {
    const url = `https://lingva.ml/api/v1/${srcLang}/${tgtLang}/${encodeURIComponent(text)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        blockProvider('lingva', false); // cooldown, non blocco permanente
        throw new Error(`Lingva ${res.status}`);
      }
      const data = await res.json();
      results.push(data?.translation || text);
    } catch (err) {
      blockProvider('lingva', false); // cooldown, non blocco permanente
      throw err;
    }
  }
  return results;
}

/** Preset di chain selezionabili per costo/qualità */
export type ChainPreset = 'free' | 'economy' | 'balanced' | 'quality' | 'max_quality';

export interface ChainPresetInfo {
  id: ChainPreset;
  name: string;
  description: string;
  cost: string;
  quality: string;
  speed: string;
  providers: string[];
}

export const CHAIN_PRESETS: ChainPresetInfo[] = [
  {
    id: 'free',
    name: '🆓 Gratis',
    description: 'Solo provider gratuiti — HY-MT + TranslateGemma locali, Groq, Cerebras, OpenRouter free',
    cost: '$0',
    quality: '⭐⭐⭐⭐',
    speed: '🏎 Media',
    providers: ['hymt', 'translategemma', 'ollama', 'groq', 'cerebras', 'openrouter', 'mymemory', 'lingva'],
  },
  {
    id: 'economy',
    name: '💰 Economica',
    description: 'HY-MT/TranslateGemma locali + Gemini free + DeepSeek economico + fallback',
    cost: '~$0.10',
    quality: '⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['hymt', 'translategemma', 'gemini', 'groq', 'cerebras', 'deepseek', 'mistral', 'openrouter', 'mymemory', 'lingva'],
  },
  {
    id: 'balanced',
    name: '⚖️ Bilanciata',
    description: 'Miglior rapporto qualità/prezzo — HY-MT locale + tutti i provider cloud',
    cost: '~$0.25',
    quality: '⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['hymt', 'translategemma', 'gemini', 'deepseek', 'deepl', 'mistral', 'groq', 'cerebras', 'together', 'fireworks', 'cohere', 'openrouter', 'openai', 'mymemory', 'lingva'],
  },
  {
    id: 'quality',
    name: '✨ Qualità',
    description: 'AI premium — Anthropic, OpenAI, Mistral come priorità',
    cost: '~$0.50',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['deepl', 'anthropic', 'openai', 'mistral', 'gemini', 'cohere', 'together', 'deepseek', 'fireworks', 'mymemory'],
  },
  {
    id: 'max_quality',
    name: '👑 Massima Qualità',
    description: 'Tutti i 16 provider — mai senza traduzione',
    cost: '~$1.00+',
    quality: '⭐⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['deepl', 'anthropic', 'openai', 'translategemma', 'ollama', 'mistral', 'gemini', 'cohere', 'together', 'deepseek', 'fireworks', 'groq', 'cerebras', 'openrouter', 'hymt', 'mymemory', 'lingva'],
  },
];

// Chain preset attivo (default: balanced)
let activeChainPreset: ChainPreset = 'balanced';

export function setChainPreset(preset: ChainPreset) {
  activeChainPreset = preset;
  // Reset blocks quando si cambia chain
  resetProviderBlocks();
  console.log(`[Chain] Preset impostato: ${preset}`);
}

export function getChainPreset(): ChainPreset {
  return activeChainPreset;
}

/** Mappa nome provider → funzione + blocked flag */
const PROVIDER_MAP: Record<string, {
  getKey: (keys: ReturnType<typeof getApiKeys>) => string;
  fn: (key: string, opts: TranslateOptions) => Promise<string[]>;
  isBlocked: () => boolean;
  needsKey: boolean;
}> = {
  gemini: { getKey: (k) => k.gemini, fn: translateWithGemini, isBlocked: () => isProviderBlocked('gemini'), needsKey: true },
  groq: { getKey: (k) => k.groq, fn: translateWithGroq, isBlocked: () => isProviderBlocked('groq'), needsKey: true },
  deepseek: { getKey: (k) => k.deepseek, fn: translateWithDeepSeek, isBlocked: () => isProviderBlocked('deepseek'), needsKey: true },
  openai: { getKey: (k) => k.openai, fn: translateWithOpenAI, isBlocked: () => isProviderBlocked('openai'), needsKey: true },
  anthropic: { getKey: (k) => k.anthropic, fn: translateWithAnthropic, isBlocked: () => isProviderBlocked('anthropic'), needsKey: true },
  mistral: { getKey: (k) => k.mistral, fn: translateWithMistral, isBlocked: () => isProviderBlocked('mistral'), needsKey: true },
  cohere: { getKey: (k) => k.cohere, fn: translateWithCohere, isBlocked: () => isProviderBlocked('cohere'), needsKey: true },
  together: { getKey: (k) => k.together, fn: translateWithTogether, isBlocked: () => isProviderBlocked('together'), needsKey: true },
  fireworks: { getKey: (k) => k.fireworks, fn: translateWithFireworks, isBlocked: () => isProviderBlocked('fireworks'), needsKey: true },
  openrouter: { getKey: (k) => k.openrouter, fn: translateWithOpenRouter, isBlocked: () => isProviderBlocked('openrouter'), needsKey: true },
  cerebras: { getKey: (k) => k.cerebras, fn: translateWithCerebras, isBlocked: () => isProviderBlocked('cerebras'), needsKey: true },
  deepl: { getKey: (k) => k.deepl, fn: translateWithDeepL, isBlocked: () => isProviderBlocked('deepl'), needsKey: true },
  mymemory: { getKey: () => 'free', fn: translateWithMyMemory, isBlocked: () => isProviderBlocked('mymemory'), needsKey: false },
  lingva: { getKey: () => 'free', fn: translateWithLingva, isBlocked: () => isProviderBlocked('lingva'), needsKey: false },
  translategemma: { getKey: () => 'free', fn: translateWithTranslateGemma, isBlocked: () => isProviderBlocked('translategemma'), needsKey: false },
  hymt: { getKey: () => 'free', fn: translateWithHYMT, isBlocked: () => isProviderBlocked('hymt'), needsKey: false },
  ollama: { getKey: () => 'free', fn: translateWithOllamaGeneric, isBlocked: () => isProviderBlocked('ollama'), needsKey: false },
};

/** Info requisito mancante per un provider */
export interface ProviderRequirement {
  provider: string;
  label: string;
  issue: 'ollama_offline' | 'ollama_no_model' | 'no_api_key';
  severity: 'critical' | 'warning'; // critical = primo nella chain, warning = fallback
  message: string;
  fixSteps: string[];
  links: { label: string; url: string }[];
}

/** Provider → nome leggibile */
const PROVIDER_LABELS: Record<string, string> = {
  translategemma: 'TranslateGemma (locale)',
  hymt: 'HY-MT1.5 Tencent (locale, #1 WMT25)',
  gemini: 'Google Gemini',
  groq: 'Groq',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  mistral: 'Mistral AI',
  cohere: 'Cohere',
  together: 'Together AI',
  fireworks: 'Fireworks AI',
  openrouter: 'OpenRouter',
  cerebras: 'Cerebras',
  deepl: 'DeepL',
  mymemory: 'MyMemory',
  lingva: 'Lingva Translate',
  ollama: 'Ollama (qualsiasi modello)',
};

/** Provider che richiedono Ollama */
const OLLAMA_PROVIDERS = ['translategemma', 'hymt', 'ollama'];

/** Provider → URL per ottenere API key */
const API_KEY_URLS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/app/apikey',
  groq: 'https://console.groq.com/keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  mistral: 'https://console.mistral.ai/api-keys',
  cohere: 'https://dashboard.cohere.com/api-keys',
  together: 'https://api.together.xyz/settings/api-keys',
  fireworks: 'https://fireworks.ai/account/api-keys',
  openrouter: 'https://openrouter.ai/keys',
  cerebras: 'https://cloud.cerebras.ai/platform',
  deepl: 'https://www.deepl.com/pro-api',
};

/** Controlla requisiti mancanti per un preset chain */
export async function checkChainRequirements(presetId: ChainPreset): Promise<ProviderRequirement[]> {
  const preset = CHAIN_PRESETS.find(p => p.id === presetId);
  if (!preset) return [];

  const keys = getApiKeys();
  const warnings: ProviderRequirement[] = [];

  // Check Ollama per provider locali
  const ollamaProviders = preset.providers.filter(p => OLLAMA_PROVIDERS.includes(p));
  let ollamaOnline = false;

  if (ollamaProviders.length > 0) {
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        ollamaOnline = true;
        const data = await res.json();
        const installedModels = (data.models || []).map((m: any) => m.name?.toLowerCase() || '');

        // Check modelli installati
        for (const prov of ollamaProviders) {
          const idx = preset.providers.indexOf(prov);
          const hasModel = prov === 'translategemma'
            ? installedModels.some((m: string) => m.includes('translategemma'))
            : installedModels.some((m: string) => m.includes('hy-mt') || m.includes('hunyuan'));
          if (!hasModel) {
            warnings.push({
              provider: prov,
              label: PROVIDER_LABELS[prov] || prov,
              issue: 'ollama_no_model',
              severity: idx === 0 ? 'critical' : 'warning',
              message: `Modello ${prov === 'translategemma' ? 'translategemma' : 'HY-MT1.5'} non installato in Ollama`,
              fixSteps: [
                'Vai in Settings → Ollama Manager',
                `Premi "Pull" su ${prov === 'translategemma' ? 'translategemma' : 'HY-MT 1.5 7B (consigliato) o 1.8B'}`,
                'Attendi il download (~2-4 GB)',
              ],
              links: [
                { label: 'Ollama Models', url: 'https://ollama.com/library' },
              ],
            });
          }
        }
      }
    } catch {
      // Ollama offline
    }

    if (!ollamaOnline) {
      for (const prov of ollamaProviders) {
        const idx = preset.providers.indexOf(prov);
        warnings.push({
          provider: prov,
          label: PROVIDER_LABELS[prov] || prov,
          issue: 'ollama_offline',
          severity: idx === 0 ? 'critical' : 'warning',
          message: 'Ollama non è in esecuzione — i modelli locali non funzioneranno',
          fixSteps: [
            '1. Installa Ollama da ollama.com',
            '2. Avvia Ollama (icona nel system tray)',
            `3. Scarica il modello: ollama pull ${prov === 'translategemma' ? 'translategemma' : 'ali6parmak/hy-mt1.5:1.8b'}`,
          ],
          links: [
            { label: 'Scarica Ollama', url: 'https://ollama.com/download' },
            { label: 'Guida installazione', url: 'https://ollama.com' },
          ],
        });
      }
    }
  }

  // Check API keys per provider a pagamento
  for (const provName of preset.providers) {
    const info = PROVIDER_MAP[provName];
    if (!info || !info.needsKey) continue;

    const key = info.getKey(keys);
    if (!key) {
      const idx = preset.providers.indexOf(provName);
      const keyUrl = API_KEY_URLS[provName];
      warnings.push({
        provider: provName,
        label: PROVIDER_LABELS[provName] || provName,
        issue: 'no_api_key',
        severity: idx <= 2 ? 'critical' : 'warning',
        message: `API key mancante per ${PROVIDER_LABELS[provName] || provName}`,
        fixSteps: [
          `1. Vai su ${keyUrl || 'il sito del provider'}`,
          '2. Crea un account / accedi',
          '3. Genera una API key',
          '4. Incollala in Impostazioni → Traduzione',
        ],
        links: [
          ...(keyUrl ? [{ label: 'Ottieni API Key', url: keyUrl }] : []),
          { label: 'Impostazioni', url: '/settings' },
        ],
      });
    }
  }

  return warnings;
}

/** Controlla se almeno un provider della catena attiva è disponibile */
export function hasAvailableProviders(): { available: boolean; providers: string[] } {
  const keys = getApiKeys();
  const preset = CHAIN_PRESETS.find(p => p.id === activeChainPreset) || CHAIN_PRESETS[2];
  const available: string[] = [];
  for (const name of preset.providers) {
    const info = PROVIDER_MAP[name];
    if (!info) continue;
    if (info.isBlocked()) continue;
    const key = info.getKey(keys);
    if (info.needsKey && !key) continue;
    available.push(name);
  }
  return { available: available.length > 0, providers: available };
}

/**
 * Traduzione con fallback automatico basato sul chain preset attivo.
 * Default: balanced (Gemini → DeepSeek → Groq → OpenAI → MyMemory → Lingva)
 */
export async function translateWithFallback(
  opts: TranslateOptions
): Promise<TranslateResult> {
  const keys = getApiKeys();
  const preset = CHAIN_PRESETS.find(p => p.id === activeChainPreset) || CHAIN_PRESETS[2]; // balanced default
  
  const providers: Array<{ name: string; key: string; fn: (key: string, opts: TranslateOptions) => Promise<string[]> }> = [];

  for (const providerName of preset.providers) {
    const info = PROVIDER_MAP[providerName];
    if (!info) continue;
    if (info.isBlocked()) continue;
    const key = info.getKey(keys);
    if (info.needsKey && !key) continue;
    providers.push({ name: providerName, key, fn: info.fn });
  }

  for (const provider of providers) {
    const MAX_RETRIES = 3;
    let retries = 0;
    let lastErr: unknown = null;
    
    while (retries <= MAX_RETRIES) {
      try {
        let translations = await provider.fn(provider.key, opts);
        if (translations.length > 0) {
          // Validazione: se il provider ha restituito meno traduzioni degli input,
          // completa con i testi originali per evitare stringhe mancanti
          if (translations.length < opts.texts.length) {
            console.warn(`[translateWithFallback] ${provider.name}: ricevute ${translations.length}/${opts.texts.length} traduzioni, padding con originali`);
            translations = [
              ...translations,
              ...opts.texts.slice(translations.length),
            ];
          }
          console.log(`[translateWithFallback] ✅ ${provider.name}: ${translations.length} traduzioni (es: "${opts.texts[0]?.substring(0, 40)}" → "${translations[0]?.substring(0, 40)}")`);
          return { translations, provider: provider.name, success: true };
        }
        break;
      } catch (err) {
        lastErr = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        
        if (errMsg === 'RateLimit' && retries < MAX_RETRIES) {
          const delay = Math.pow(2, retries) * 2000; // 2s, 4s, 8s
          console.warn(`[translateWithFallback] ${provider.name} rate-limited, retry ${retries + 1}/${MAX_RETRIES} in ${delay}ms`);
          await sleep(delay);
          retries++;
          continue;
        }
        
        console.warn(`[translateWithFallback] ${provider.name} failed:`, err);
        const isFreeProvider = !PROVIDER_MAP[provider.name]?.needsKey;
        if (errMsg === 'RateLimit' || errMsg === 'ContentTooLarge' || isFreeProvider) {
          // Rate-limit/payload o provider gratuito: cooldown temporaneo (mai blocco permanente)
          blockProvider(provider.name, false);
        } else {
          // Errore fatale (402, 404, auth, offline) su provider a pagamento: blocco permanente
          blockProvider(provider.name, true);
        }
        break;
      }
    }
    
    // Se dopo tutti i retry è ancora RateLimit, cooldown (non permanente)
    if (lastErr instanceof Error && lastErr.message === 'RateLimit' && retries >= MAX_RETRIES) {
      console.warn(`[translateWithFallback] ${provider.name} in cooldown dopo ${MAX_RETRIES} retry`);
      blockProvider(provider.name, false);
    }
  }

  // Nessun provider disponibile, ritorna originali
  console.error(`[translateWithFallback] ❌ NESSUN provider riuscito! ${opts.texts.length} stringhe NON tradotte (restituite come originali)`);
  return { translations: opts.texts, provider: 'none', success: false };
}

/**
 * Traduzione singola con fallback
 */
export async function translateSingleWithFallback(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
  context?: string
): Promise<{ translated: string; provider: string }> {
  const result = await translateWithFallback({
    texts: [text],
    targetLanguage,
    sourceLanguage,
    context,
  });
  return {
    translated: result.translations[0] || text,
    provider: result.provider,
  };
}

/**
 * Traduzione con fallback + batching automatico.
 * Splitta testi in chunk di maxBatch per evitare 413/payload too large.
 */
export async function translateWithFallbackBatched(
  opts: TranslateOptions,
  maxBatch: number = 20,
  onProgress?: (done: number, total: number) => void
): Promise<TranslateResult> {
  const { texts, ...rest } = opts;
  if (texts.length <= maxBatch) {
    return translateWithFallback(opts);
  }
  
  const allTranslations: string[] = [];
  let lastProvider = 'none';
  let anySuccess = false;
  
  const totalBatches = Math.ceil(texts.length / maxBatch);
  console.log(`[Batched] Inizio traduzione: ${texts.length} stringhe in ${totalBatches} batch da ${maxBatch}`);
  
  for (let i = 0; i < texts.length; i += maxBatch) {
    const batchNum = Math.floor(i / maxBatch) + 1;
    const chunk = texts.slice(i, i + maxBatch);
    const result = await translateWithFallback({ ...rest, texts: chunk });
    allTranslations.push(...result.translations);
    if (result.success) {
      anySuccess = true;
      lastProvider = result.provider;
    } else {
      console.warn(`[Batched] ⚠️ Batch ${batchNum}/${totalBatches} FALLITO — stringhe non tradotte`);
    }
    onProgress?.(Math.min(i + maxBatch, texts.length), texts.length);
    
    // Delay tra batch per evitare rate-limit
    if (i + maxBatch < texts.length) {
      await sleep(2500);
    }
  }
  
  return { translations: allTranslations, provider: lastProvider, success: anySuccess };
}

// ═══════════════════════════════════════════════════════════════════
// MULTI-LLM COMPARISON SYSTEM
// Invia la stessa traduzione a N provider in parallelo,
// un giudice (euristico + opzionale LLM) sceglie la migliore.
// ═══════════════════════════════════════════════════════════════════

/** Risultato di un singolo candidato */
export interface ComparisonCandidate {
  provider: string;
  label: string;
  translations: string[];
  score: number;
  scoreDetails: {
    lengthSimilarity: number;
    noArtifacts: number;
    punctuation: number;
    noUntranslated: number;
    llmScore: number | null;
  };
  timeMs: number;
  error?: string;
}

/** Risultato completo del confronto */
export interface ComparisonResult {
  winner: ComparisonCandidate;
  candidates: ComparisonCandidate[];
  translations: string[];
  provider: string;
  success: boolean;
  comparisonTimeMs: number;
  judgeUsed: 'heuristic' | 'llm' | 'heuristic+llm';
}

/** Configurazione Multi-LLM Comparison */
export interface ComparisonConfig {
  enabled: boolean;
  maxCandidates: number;        // Quanti provider usare (default: 3)
  useLlmJudge: boolean;         // Usa LLM per giudicare (più preciso ma costa)
  llmJudgeProvider: string;     // Provider per il giudice LLM
  timeoutMs: number;            // Timeout per singolo provider
}

const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  enabled: false,
  maxCandidates: 3,
  useLlmJudge: false,
  llmJudgeProvider: 'gemini',
  timeoutMs: 15000,
};

let comparisonConfig: ComparisonConfig = { ...DEFAULT_COMPARISON_CONFIG };

/** Carica configurazione da localStorage */
export function loadComparisonConfig(): ComparisonConfig {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    const saved = settings?.translation?.comparison;
    if (saved) {
      comparisonConfig = { ...DEFAULT_COMPARISON_CONFIG, ...saved };
    }
  } catch {}
  return comparisonConfig;
}

/** Salva configurazione in localStorage */
export function saveComparisonConfig(config: Partial<ComparisonConfig>): void {
  comparisonConfig = { ...comparisonConfig, ...config };
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    if (!settings.translation) settings.translation = {};
    settings.translation.comparison = comparisonConfig;
    localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
  } catch {}
}

/** Getter per config corrente */
export function getComparisonConfig(): ComparisonConfig {
  return { ...comparisonConfig };
}

/** Controlla se la comparison è attiva */
export function isComparisonEnabled(): boolean {
  return comparisonConfig.enabled;
}

/**
 * Scoring euristico per una traduzione (0-100)
 * Valuta qualità senza bisogno di un LLM
 */
function heuristicScore(
  original: string,
  translated: string,
  targetLanguage: string
): { total: number; lengthSimilarity: number; noArtifacts: number; punctuation: number; noUntranslated: number } {
  let lengthSimilarity = 0;
  let noArtifacts = 0;
  let punctuation = 0;
  let noUntranslated = 0;

  // 1. Similarità lunghezza (max 25 punti)
  // Traduzioni buone hanno lunghezza simile all'originale (±50%)
  const ratio = translated.length / Math.max(original.length, 1);
  if (ratio >= 0.5 && ratio <= 2.0) {
    lengthSimilarity = 25 - Math.abs(1 - ratio) * 20;
  } else {
    lengthSimilarity = Math.max(0, 10 - Math.abs(1 - ratio) * 5);
  }

  // 2. Assenza di artefatti (max 25 punti)
  // Penalizza JSON, markdown, spiegazioni, tag non voluti
  noArtifacts = 25;
  if (translated.includes('```')) noArtifacts -= 15;
  if (translated.includes('"translatedText"')) noArtifacts -= 20;
  if (translated.match(/^\[[\s\S]*\]$/)) noArtifacts -= 10;
  if (translated.match(/^\{[\s\S]*\}$/)) noArtifacts -= 15;
  if (translated.toLowerCase().includes('here is the translation')) noArtifacts -= 15;
  if (translated.toLowerCase().includes('translation:')) noArtifacts -= 10;
  if (translated.startsWith('"') && translated.endsWith('"')) noArtifacts -= 3;
  noArtifacts = Math.max(0, noArtifacts);

  // 3. Punteggiatura preservata (max 25 punti)
  // Verifica che punteggiatura finale sia coerente
  punctuation = 25;
  const origEnds = original.match(/[.!?…。！？]$/);
  const transEnds = translated.match(/[.!?…。！？]$/);
  if (origEnds && !transEnds) punctuation -= 10;
  if (!origEnds && transEnds) punctuation -= 5;
  // Verifica variabili preservate
  const origVars = original.match(/\{[^}]+\}|%[sd]|\$\d+/g) || [];
  const transVars = translated.match(/\{[^}]+\}|%[sd]|\$\d+/g) || [];
  if (origVars.length !== transVars.length) punctuation -= 15;
  punctuation = Math.max(0, punctuation);

  // 4. Non tradotto / testo identico (max 25 punti)
  noUntranslated = 25;
  // Se originale e traduzione sono identici (e lingua diversa), probabilmente non è stato tradotto
  if (translated.trim().toLowerCase() === original.trim().toLowerCase() && targetLanguage !== 'en') {
    noUntranslated = 0;
  }
  // Se contiene troppo testo identico all'originale
  const origWords = original.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (origWords.length > 2) {
    const untranslatedCount = origWords.filter(w => translated.toLowerCase().includes(w)).length;
    const untranslatedRatio = untranslatedCount / origWords.length;
    if (untranslatedRatio > 0.8) noUntranslated = 5;
    else if (untranslatedRatio > 0.5) noUntranslated = 15;
  }

  const total = Math.round(lengthSimilarity + noArtifacts + punctuation + noUntranslated);

  return {
    total: Math.max(0, Math.min(100, total)),
    lengthSimilarity: Math.round(lengthSimilarity),
    noArtifacts: Math.round(noArtifacts),
    punctuation: Math.round(punctuation),
    noUntranslated: Math.round(noUntranslated),
  };
}

/**
 * Giudice LLM — chiede a un LLM di scegliere la traduzione migliore
 * Ritorna indice del vincitore (0-based)
 */
async function llmJudge(
  original: string,
  candidates: { provider: string; translation: string }[],
  targetLanguage: string
): Promise<{ winnerIndex: number; scores: number[] }> {
  const keys = getApiKeys();
  const judgeProvider = comparisonConfig.llmJudgeProvider;
  const info = PROVIDER_MAP[judgeProvider];

  if (!info) {
    return { winnerIndex: 0, scores: candidates.map(() => 50) };
  }

  const key = info.getKey(keys);
  if (info.needsKey && !key) {
    return { winnerIndex: 0, scores: candidates.map(() => 50) };
  }

  const candidateList = candidates
    .map((c, i) => `[${i + 1}] (${c.provider}): "${c.translation}"`)
    .join('\n');

  const judgePrompt = `You are a translation quality judge. Given the original text and ${candidates.length} translation candidates to ${targetLanguage}, rate each on a scale of 0-100 and pick the best one.

ORIGINAL: "${original}"

CANDIDATES:
${candidateList}

Evaluate based on: accuracy, naturalness, preservation of tone/style, no artifacts.
Reply ONLY with a JSON object: {"winner": <1-based index>, "scores": [<score1>, <score2>, ...]}`;

  try {
    const result = await info.fn(key, {
      texts: [judgePrompt],
      targetLanguage: 'en',
      sourceLanguage: 'en',
    });

    const responseText = result[0] || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const winnerIdx = Math.max(0, Math.min(candidates.length - 1, (parsed.winner || 1) - 1));
      const scores = Array.isArray(parsed.scores) ? parsed.scores.map(Number) : candidates.map(() => 50);
      return { winnerIndex: winnerIdx, scores };
    }
  } catch (err) {
    console.warn('[Multi-LLM Judge] LLM judge failed:', err);
  }

  return { winnerIndex: 0, scores: candidates.map(() => 50) };
}

/**
 * MULTI-LLM COMPARISON — Traduzione parallela con N provider + giudizio
 */
export async function translateWithComparison(
  opts: TranslateOptions
): Promise<ComparisonResult> {
  const startTime = Date.now();
  const keys = getApiKeys();
  const preset = CHAIN_PRESETS.find(p => p.id === activeChainPreset) || CHAIN_PRESETS[2];

  // Seleziona i provider disponibili
  const availableProviders: Array<{ name: string; key: string; fn: (key: string, opts: TranslateOptions) => Promise<string[]> }> = [];

  for (const providerName of preset.providers) {
    const info = PROVIDER_MAP[providerName];
    if (!info) continue;
    if (info.isBlocked()) continue;
    const key = info.getKey(keys);
    if (info.needsKey && !key) continue;
    availableProviders.push({ name: providerName, key, fn: info.fn });
  }

  // Prendi i primi N provider
  const maxCandidates = Math.min(comparisonConfig.maxCandidates, availableProviders.length);

  if (maxCandidates === 0) {
    return {
      winner: { provider: 'none', label: '-', translations: opts.texts, score: 0, scoreDetails: { lengthSimilarity: 0, noArtifacts: 0, punctuation: 0, noUntranslated: 0, llmScore: null }, timeMs: 0 },
      candidates: [],
      translations: opts.texts,
      provider: 'none',
      success: false,
      comparisonTimeMs: Date.now() - startTime,
      judgeUsed: 'heuristic',
    };
  }

  const selectedProviders = availableProviders.slice(0, maxCandidates);

  // Invio parallelo con timeout
  const promises = selectedProviders.map(async (provider) => {
    const provStart = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), comparisonConfig.timeoutMs);

      const translations = await Promise.race([
        provider.fn(provider.key, opts),
        new Promise<string[]>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), comparisonConfig.timeoutMs)
        ),
      ]);

      clearTimeout(timeout);

      return {
        provider: provider.name,
        label: PROVIDER_LABELS[provider.name] || provider.name,
        translations,
        timeMs: Date.now() - provStart,
        error: undefined as string | undefined,
      };
    } catch (err: any) {
      return {
        provider: provider.name,
        label: PROVIDER_LABELS[provider.name] || provider.name,
        translations: [] as string[],
        timeMs: Date.now() - provStart,
        error: err?.message || 'Unknown error',
      };
    }
  });

  const results = await Promise.allSettled(promises);

  // Raccogli i candidati riusciti
  const candidates: ComparisonCandidate[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.translations.length > 0 && !result.value.error) {
      const val = result.value;
      // Score euristico per la prima stringa tradotta
      const hScore = heuristicScore(
        opts.texts[0] || '',
        val.translations[0] || '',
        opts.targetLanguage
      );

      candidates.push({
        provider: val.provider,
        label: val.label,
        translations: val.translations,
        score: hScore.total,
        scoreDetails: {
          lengthSimilarity: hScore.lengthSimilarity,
          noArtifacts: hScore.noArtifacts,
          punctuation: hScore.punctuation,
          noUntranslated: hScore.noUntranslated,
          llmScore: null,
        },
        timeMs: val.timeMs,
      });
    } else if (result.status === 'fulfilled' && result.value.error) {
      candidates.push({
        provider: result.value.provider,
        label: result.value.label,
        translations: [],
        score: 0,
        scoreDetails: { lengthSimilarity: 0, noArtifacts: 0, punctuation: 0, noUntranslated: 0, llmScore: null },
        timeMs: result.value.timeMs,
        error: result.value.error,
      });
    }
  }

  // Se nessun candidato riuscito, fallback
  if (candidates.filter(c => !c.error).length === 0) {
    console.warn('[Multi-LLM] Nessun candidato riuscito, fallback a translateWithFallback');
    const fallback = await translateWithFallback(opts);
    return {
      winner: { provider: fallback.provider, label: PROVIDER_LABELS[fallback.provider] || fallback.provider, translations: fallback.translations, score: 50, scoreDetails: { lengthSimilarity: 12, noArtifacts: 12, punctuation: 12, noUntranslated: 12, llmScore: null }, timeMs: Date.now() - startTime },
      candidates,
      translations: fallback.translations,
      provider: fallback.provider,
      success: fallback.success,
      comparisonTimeMs: Date.now() - startTime,
      judgeUsed: 'heuristic',
    };
  }

  // Giudice LLM opzionale
  let judgeUsed: 'heuristic' | 'llm' | 'heuristic+llm' = 'heuristic';
  const successCandidates = candidates.filter(c => !c.error);

  if (comparisonConfig.useLlmJudge && successCandidates.length >= 2) {
    try {
      const judgeResult = await llmJudge(
        opts.texts[0] || '',
        successCandidates.map(c => ({ provider: c.label, translation: c.translations[0] || '' })),
        opts.targetLanguage
      );

      // Integra score LLM (peso 40%) con euristico (peso 60%)
      for (let i = 0; i < successCandidates.length; i++) {
        const llmScore = judgeResult.scores[i] || 50;
        successCandidates[i].scoreDetails.llmScore = llmScore;
        successCandidates[i].score = Math.round(successCandidates[i].score * 0.6 + llmScore * 0.4);
      }

      judgeUsed = 'heuristic+llm';
      console.log(`[Multi-LLM] Giudice LLM applicato, vincitore index: ${judgeResult.winnerIndex}`);
    } catch (err) {
      console.warn('[Multi-LLM] Giudice LLM fallito, uso solo euristico:', err);
    }
  }

  // Ordina per score decrescente
  const sorted = [...successCandidates].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  console.log(
    `[Multi-LLM] Confronto completato: ${successCandidates.length}/${selectedProviders.length} candidati | ` +
    `Vincitore: ${winner.label} (${winner.score}pts) | ` +
    `Tempo: ${Date.now() - startTime}ms | Giudice: ${judgeUsed}`
  );

  return {
    winner,
    candidates: [...candidates].sort((a, b) => b.score - a.score),
    translations: winner.translations,
    provider: winner.provider,
    success: true,
    comparisonTimeMs: Date.now() - startTime,
    judgeUsed,
  };
}

let comparisonConfigLoaded = false;

/**
 * Traduzione smart — usa comparison se attiva, altrimenti fallback normale
 */
export async function translateSmart(
  opts: TranslateOptions
): Promise<TranslateResult & { comparison?: ComparisonResult }> {
  // Lazy load config da localStorage alla prima chiamata
  if (!comparisonConfigLoaded) {
    try { loadComparisonConfig(); } catch {}
    comparisonConfigLoaded = true;
  }
  if (comparisonConfig.enabled) {
    const result = await translateWithComparison(opts);
    return {
      translations: result.translations,
      provider: result.provider,
      success: result.success,
      comparison: result,
    };
  }
  return translateWithFallback(opts);
}

/**
 * Traduzione singola smart
 */
export async function translateSingleSmart(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string,
  context?: string
): Promise<{ translated: string; provider: string; comparison?: ComparisonResult }> {
  const result = await translateSmart({
    texts: [text],
    targetLanguage,
    sourceLanguage,
    context,
  });
  return {
    translated: result.translations[0] || text,
    provider: result.provider,
    comparison: result.comparison,
  };
}
