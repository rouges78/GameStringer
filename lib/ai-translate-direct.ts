/**
 * AI Translation - Chiamate dirette API (NO API routes Next.js)
 * Supporta fallback automatico: Gemini → Groq → DeepSeek → OpenAI → originale
 */

export interface TranslateOptions {
  texts: string[];
  targetLanguage: string;
  sourceLanguage?: string;
  context?: string;
}

export interface TranslateResult {
  translations: string[];
  provider: string;
  success: boolean;
}

// Session-level flags: skip provider dopo primo errore fatale
const blockedProviders = new Set<string>();

function blockProvider(name: string) {
  if (!blockedProviders.has(name)) {
    blockedProviders.add(name);
    console.warn(`[Session] ${name} bloccato per questa sessione`);
  }
}

/** Reset provider blocks (es. quando si cambia API key) */
export function resetProviderBlocks() {
  blockedProviders.clear();
}

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
    };
  } catch {
    return { gemini: '', groq: '', openai: '', deepseek: '', anthropic: '', mistral: '', cohere: '', together: '', fireworks: '', openrouter: '', cerebras: '', deepl: '' };
  }
}

/** Traduzione con Gemini API */
async function translateWithGemini(
  apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const srcLang = opts.sourceLanguage || 'en';
  const prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.${opts.context ? ` Context: ${opts.context}` : ''}\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
    }
  );

  if (res.status === 429) {
    blockProvider('gemini');
    throw new Error(`Gemini 429`);
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
  const srcLang = opts.sourceLanguage || 'en';
  const prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.${opts.context ? ` Context: ${opts.context}` : ''}\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

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
      max_tokens: 4096,
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
  const srcLang = opts.sourceLanguage || 'en';
  const prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.${opts.context ? ` Context: ${opts.context}` : ''}\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

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
      max_tokens: 4096,
    }),
  });

  if (res.status === 429) {
    blockProvider('groq');
    throw new Error(`Groq 429`);
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
  const srcLang = opts.sourceLanguage || 'en';
  const prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.${opts.context ? ` Context: ${opts.context}` : ''}\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

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
      max_tokens: 4096,
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
  const srcLang = opts.sourceLanguage || 'en';
  const prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.${opts.context ? ` Context: ${opts.context}` : ''}\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

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
      max_tokens: 4096,
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
  const srcLang = opts.sourceLanguage || 'en';
  const prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.${opts.context ? ` Context: ${opts.context}` : ''}\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

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
      max_tokens: 4096,
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

/** Cohere — Command R+, API diversa */
async function translateWithCohere(apiKey: string, opts: TranslateOptions): Promise<string[]> {
  const srcLang = opts.sourceLanguage || 'en';
  const prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.${opts.context ? ` Context: ${opts.context}` : ''}\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  const res = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'command-r-plus',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    blockProvider('cohere');
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
  const srcLang = opts.sourceLanguage || 'en';
  const prompt = `Translate the following texts from ${srcLang} to ${opts.targetLanguage}. Return ONLY a JSON array of translated strings, same order.${opts.context ? ` Context: ${opts.context}` : ''}\n\n${opts.texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

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
      max_tokens: 4096,
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
      blockProvider('mymemory');
      throw new Error('MyMemory quota exceeded');
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

/** HY-MT1.5 (Tencent) — via Ollama, ultraleggero 1.8B, 33 lingue, per PC con poca RAM */
async function translateWithHYMT(
  _apiKey: string,
  opts: TranslateOptions
): Promise<string[]> {
  const ollamaUrl = 'http://localhost:11434';
  const srcLang = opts.sourceLanguage || 'en';

  // Verifica se il modello è installato (cerca hy-mt o hunyuan-mt)
  try {
    const tagsRes = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!tagsRes.ok) throw new Error('Ollama non raggiungibile');
    const tagsData = await tagsRes.json();
    const available = (tagsData.models || []).map((m: any) => m.name);
    const hasModel = available.some((n: string) => n.includes('hy-mt') || n.startsWith('hunyuan'));
    if (!hasModel) throw new Error('HY-MT1.5 non installato. Esegui: ollama pull ali6parmak/hy-mt1.5:1.8b');
  } catch (err) {
    blockProvider('hymt');
    throw err;
  }

  const results: string[] = [];
  for (const text of opts.texts) {
    try {
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'ali6parmak/hy-mt1.5:1.8b',
          messages: [{ role: 'user', content: `Translate from ${srcLang} to ${opts.targetLanguage}: ${text}` }],
          stream: false,
          options: { temperature: 0.2, num_predict: 500 },
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`HY-MT ${res.status}`);
      const data = await res.json();
      results.push(data?.message?.content?.trim() || text);
    } catch (err) {
      blockProvider('hymt');
      throw err;
    }
  }
  return results;
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
      const res = await fetch(url);
      if (!res.ok) {
        blockProvider('lingva');
        throw new Error(`Lingva ${res.status}`);
      }
      const data = await res.json();
      results.push(data?.translation || text);
    } catch (err) {
      blockProvider('lingva');
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
    description: 'Solo provider gratuiti — TranslateGemma locale, Groq, Cerebras, OpenRouter free, MyMemory',
    cost: '$0',
    quality: '⭐⭐⭐⭐',
    speed: '🏎 Media',
    providers: ['translategemma', 'hymt', 'groq', 'cerebras', 'openrouter', 'mymemory', 'lingva'],
  },
  {
    id: 'economy',
    name: '💰 Economica',
    description: 'TranslateGemma + Gemini free + DeepSeek economico + fallback gratuiti',
    cost: '~$0.10',
    quality: '⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['translategemma', 'gemini', 'groq', 'cerebras', 'deepseek', 'mistral', 'openrouter', 'hymt', 'mymemory', 'lingva'],
  },
  {
    id: 'balanced',
    name: '⚖️ Bilanciata',
    description: 'Miglior rapporto qualità/prezzo — TranslateGemma + tutti i provider',
    cost: '~$0.25',
    quality: '⭐⭐⭐⭐',
    speed: '🚀 Veloce',
    providers: ['translategemma', 'gemini', 'deepseek', 'deepl', 'mistral', 'groq', 'cerebras', 'together', 'fireworks', 'cohere', 'openrouter', 'openai', 'hymt', 'mymemory', 'lingva'],
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
    providers: ['deepl', 'anthropic', 'openai', 'translategemma', 'mistral', 'gemini', 'cohere', 'together', 'deepseek', 'fireworks', 'groq', 'cerebras', 'openrouter', 'hymt', 'mymemory', 'lingva'],
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
  gemini: { getKey: (k) => k.gemini, fn: translateWithGemini, isBlocked: () => blockedProviders.has('gemini'), needsKey: true },
  groq: { getKey: (k) => k.groq, fn: translateWithGroq, isBlocked: () => blockedProviders.has('groq'), needsKey: true },
  deepseek: { getKey: (k) => k.deepseek, fn: translateWithDeepSeek, isBlocked: () => blockedProviders.has('deepseek'), needsKey: true },
  openai: { getKey: (k) => k.openai, fn: translateWithOpenAI, isBlocked: () => blockedProviders.has('openai'), needsKey: true },
  anthropic: { getKey: (k) => k.anthropic, fn: translateWithAnthropic, isBlocked: () => blockedProviders.has('anthropic'), needsKey: true },
  mistral: { getKey: (k) => k.mistral, fn: translateWithMistral, isBlocked: () => blockedProviders.has('mistral'), needsKey: true },
  cohere: { getKey: (k) => k.cohere, fn: translateWithCohere, isBlocked: () => blockedProviders.has('cohere'), needsKey: true },
  together: { getKey: (k) => k.together, fn: translateWithTogether, isBlocked: () => blockedProviders.has('together'), needsKey: true },
  fireworks: { getKey: (k) => k.fireworks, fn: translateWithFireworks, isBlocked: () => blockedProviders.has('fireworks'), needsKey: true },
  openrouter: { getKey: (k) => k.openrouter, fn: translateWithOpenRouter, isBlocked: () => blockedProviders.has('openrouter'), needsKey: true },
  cerebras: { getKey: (k) => k.cerebras, fn: translateWithCerebras, isBlocked: () => blockedProviders.has('cerebras'), needsKey: true },
  deepl: { getKey: (k) => k.deepl, fn: translateWithDeepL, isBlocked: () => blockedProviders.has('deepl'), needsKey: true },
  mymemory: { getKey: () => 'free', fn: translateWithMyMemory, isBlocked: () => blockedProviders.has('mymemory'), needsKey: false },
  lingva: { getKey: () => 'free', fn: translateWithLingva, isBlocked: () => blockedProviders.has('lingva'), needsKey: false },
  translategemma: { getKey: () => 'free', fn: translateWithTranslateGemma, isBlocked: () => blockedProviders.has('translategemma'), needsKey: false },
  hymt: { getKey: () => 'free', fn: translateWithHYMT, isBlocked: () => blockedProviders.has('hymt'), needsKey: false },
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
  hymt: 'HY-MT1.5 (locale)',
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
};

/** Provider che richiedono Ollama */
const OLLAMA_PROVIDERS = ['translategemma', 'hymt'];

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
          const modelName = prov === 'translategemma' ? 'translategemma' : 'hy-mt';
          const hasModel = installedModels.some((m: string) => m.includes(modelName));
          if (!hasModel) {
            warnings.push({
              provider: prov,
              label: PROVIDER_LABELS[prov] || prov,
              issue: 'ollama_no_model',
              severity: idx === 0 ? 'critical' : 'warning',
              message: `Modello ${prov === 'translategemma' ? 'translategemma' : 'hy-mt1.5'} non installato in Ollama`,
              fixSteps: [
                'Apri un terminale',
                `Esegui: ollama pull ${prov === 'translategemma' ? 'translategemma' : 'ali6parmak/hy-mt1.5:1.8b'}`,
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
    try {
      const translations = await provider.fn(provider.key, opts);
      if (translations.length > 0) {
        return { translations, provider: provider.name, success: true };
      }
    } catch (err) {
      console.warn(`[translateWithFallback] ${provider.name} failed:`, err);
      blockProvider(provider.name);
      continue;
    }
  }

  // Nessun provider disponibile, ritorna originali
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
