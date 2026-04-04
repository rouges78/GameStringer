/**
 * Ollama Model Manager — API client per gestire modelli locali
 * Download consigliati, speed test, confronto A/B tra modelli
 */

const OLLAMA_URL = 'http://localhost:11434';

// ============================================================================
// TYPES
// ============================================================================

export interface OllamaModel {
  name: string;
  size: number;          // bytes
  digest: string;
  modified_at: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface RecommendedModel {
  name: string;
  pullName: string;       // nome per `ollama pull`
  description: string;
  sizeGb: string;
  category: 'translation' | 'general' | 'multilingual';
  languages: string;
  speed: 'fast' | 'medium' | 'slow';
  quality: 1 | 2 | 3 | 4 | 5;
  vramGb: number;
  recommended: boolean;   // consigliato per GameStringer
}

export interface SpeedTestResult {
  model: string;
  tokensPerSecond: number;
  totalTokens: number;
  totalTimeMs: number;
  firstTokenMs: number;
  promptEvalRate: number;  // tok/s prompt processing
}

export interface ABComparisonResult {
  modelA: { name: string; translation: string; timeMs: number; tokensPerSecond: number };
  modelB: { name: string; translation: string; timeMs: number; tokensPerSecond: number };
  testText: string;
  sourceLang: string;
  targetLang: string;
}

// ============================================================================
// RECOMMENDED MODELS FOR TRANSLATION
// ============================================================================

export const RECOMMENDED_MODELS: RecommendedModel[] = [
  // ─── TRADUZIONE SPECIALIZZATA ──────────────────────────────────
  {
    name: 'HY-MT 1.5 7B (Abliterated)',
    pullName: 'huihui_ai/hy-mt1.5-abliterated:7b',
    description: '⭐ #1 WMT25 — Tencent, batte Google Translate in 30/31 lingue. Senza censura.',
    sizeGb: '~4.5',
    category: 'translation',
    languages: '31 lingue (EN, IT, DE, FR, ES, JA, KO, ZH, RU, PL...)',
    speed: 'medium',
    quality: 5,
    vramGb: 5,
    recommended: true,
  },
  {
    name: 'HY-MT 1.5 1.8B',
    pullName: 'huihui_ai/hy-mt1.5-abliterated:1.8b',
    description: 'Tencent — versione ultra-leggera e velocissima. Ideale per batch massicci.',
    sizeGb: '~1.2',
    category: 'translation',
    languages: '31 lingue',
    speed: 'fast',
    quality: 3,
    vramGb: 2,
    recommended: true,
  },
  {
    name: 'TranslateGemma 12B',
    pullName: 'translategemma:12b',
    description: 'Google — specializzato traduzione, 55 lingue, qualità alta.',
    sizeGb: '~8.0',
    category: 'translation',
    languages: '55 lingue',
    speed: 'medium',
    quality: 4,
    vramGb: 10,
    recommended: false,
  },
  {
    name: 'TranslateGemma 2B',
    pullName: 'translategemma:2b',
    description: 'Google — leggero specializzato traduzione, 55 lingue. Ideale per GPU piccole.',
    sizeGb: '~1.5',
    category: 'translation',
    languages: '55 lingue',
    speed: 'fast',
    quality: 3,
    vramGb: 2,
    recommended: true,
  },
  // ─── GEMMA 4 (Aprile 2026) ────────────────────────────────────
  {
    name: 'Gemma 4 27B MoE (A4B)',
    pullName: 'gemma4:27b',
    description: '🆕 NUOVO — Google DeepMind, 27B totali ma attiva solo 4B. Qualità da 27B, velocità da 4B! 256K context, 35+ lingue, reasoning.',
    sizeGb: '~16',
    category: 'multilingual' as const,
    languages: '35+ lingue (pre-trained 140+)',
    speed: 'fast' as const,
    quality: 5 as const,
    vramGb: 18,
    recommended: true,
  },
  {
    name: 'Gemma 4 E4B',
    pullName: 'gemma4:e4b',
    description: '🆕 NUOVO — Google, edge-optimized. 128K context, multimodale, gira su GPU consumer.',
    sizeGb: '~3',
    category: 'multilingual' as const,
    languages: '35+ lingue',
    speed: 'fast' as const,
    quality: 4 as const,
    vramGb: 4,
    recommended: true,
  },
  {
    name: 'Gemma 4 E2B',
    pullName: 'gemma4:e2b',
    description: '🆕 NUOVO — Google, ultra-leggero. ASR + traduzione audio. Gira su Raspberry Pi!',
    sizeGb: '~1.5',
    category: 'multilingual' as const,
    languages: '35+ lingue + audio',
    speed: 'fast' as const,
    quality: 3 as const,
    vramGb: 2,
    recommended: false,
  },
  // ─── MoE ULTRA-VELOCI ───────────────────────────────────────
  {
    name: 'Qwen 3.5 35B-A3B (MoE)',
    pullName: 'qwen3.5:35b-a3b',
    description: '🚀 NUOVO — 35B parametri, attiva solo 3B. Velocità di un 3B, qualità di un 35B!',
    sizeGb: '~4.5',
    category: 'multilingual',
    languages: '100+ lingue (eccelle su CJK, arabo, europee)',
    speed: 'fast',
    quality: 5,
    vramGb: 5,
    recommended: true,
  },
  {
    name: 'LFM2 24B-A2B (MoE)',
    pullName: 'lfm2:24b',
    description: '🚀 NUOVO — Liquid AI, 24B parametri, attiva solo 2B. Velocissimo su 8GB RAM!',
    sizeGb: '~3.5',
    category: 'general',
    languages: '30+ lingue',
    speed: 'fast',
    quality: 4,
    vramGb: 4,
    recommended: true,
  },
  // ─── MULTILINGUE GENERAL PURPOSE ──────────────────────────────
  {
    name: 'GLM-4.7 Flash 8B',
    pullName: 'glm4:8b',
    description: '🆕 NUOVO — Zhipu AI, tuttofare veloce, molto lodato dalla community.',
    sizeGb: '~5.0',
    category: 'multilingual',
    languages: '50+ lingue',
    speed: 'fast',
    quality: 5,
    vramGb: 6,
    recommended: true,
  },
  {
    name: 'Qwen3 8B',
    pullName: 'qwen3:8b',
    description: 'Alibaba — top multilingue, ragionamento avanzato, eccellente su CJK e europee.',
    sizeGb: '~5.2',
    category: 'multilingual',
    languages: '100+ lingue (eccelle su CJK, arabo, europee)',
    speed: 'medium',
    quality: 5,
    vramGb: 6,
    recommended: false,
  },
  {
    name: 'Qwen3 4B',
    pullName: 'qwen3:4b',
    description: 'Alibaba — versione compatta, ottimo rapporto qualità/velocità per traduzione.',
    sizeGb: '~2.6',
    category: 'multilingual',
    languages: '100+ lingue',
    speed: 'fast',
    quality: 4,
    vramGb: 3,
    recommended: false,
  },
  {
    name: 'Gemma 3 12B',
    pullName: 'gemma3:12b',
    description: 'Google — prosa pulita, 128K context, multilingue. Buon equilibrio qualità/velocità.',
    sizeGb: '~8.1',
    category: 'multilingual',
    languages: '140+ lingue',
    speed: 'medium',
    quality: 4,
    vramGb: 10,
    recommended: false,
  },
  {
    name: 'Gemma 3 4B',
    pullName: 'gemma3:4b',
    description: 'Google — versione leggera di Gemma 3, gira su 8GB RAM.',
    sizeGb: '~2.8',
    category: 'multilingual',
    languages: '140+ lingue',
    speed: 'fast',
    quality: 3,
    vramGb: 4,
    recommended: false,
  },
  // ─── REASONING / ANALISI ──────────────────────────────────────
  {
    name: 'DeepSeek R1 14B',
    pullName: 'deepseek-r1:14b',
    description: 'DeepSeek — chain-of-thought esplicito, eccellente per ragionamento complesso.',
    sizeGb: '~9.0',
    category: 'general',
    languages: '20+ lingue',
    speed: 'medium',
    quality: 5,
    vramGb: 12,
    recommended: false,
  },
  {
    name: 'DeepSeek R1 7B',
    pullName: 'deepseek-r1:7b',
    description: 'DeepSeek — versione leggera con chain-of-thought, gira su 8GB.',
    sizeGb: '~4.7',
    category: 'general',
    languages: '20+ lingue',
    speed: 'medium',
    quality: 4,
    vramGb: 6,
    recommended: false,
  },
  {
    name: 'Phi-4 14B',
    pullName: 'phi4:14b',
    description: 'Microsoft — miglior ragionamento per GB (MATH: 80.4%), batte modelli da 30-70B.',
    sizeGb: '~8.5',
    category: 'general',
    languages: '15+ lingue',
    speed: 'medium',
    quality: 5,
    vramGb: 10,
    recommended: false,
  },
  {
    name: 'Phi-4 Mini 3.8B',
    pullName: 'phi4-mini',
    description: 'Microsoft — ultra-leggero, buono per traduzioni semplici con poca VRAM.',
    sizeGb: '~2.4',
    category: 'general',
    languages: '15+ lingue',
    speed: 'fast',
    quality: 3,
    vramGb: 3,
    recommended: false,
  },
  // ─── MODELLI GRANDI (16GB+ VRAM) ─────────────────────────────
  {
    name: 'Llama 3.3 8B',
    pullName: 'llama3.3:8b',
    description: 'Meta — miglior all-rounder nella classe 8B, ecosistema vasto.',
    sizeGb: '~5.0',
    category: 'general',
    languages: '8 lingue principali',
    speed: 'medium',
    quality: 4,
    vramGb: 6,
    recommended: false,
  },
  {
    name: 'Mistral Small 3 7B',
    pullName: 'mistral-small3.1:24b',
    description: 'Mistral AI — il più veloce (~50 tok/s), ottimo per lingue europee.',
    sizeGb: '~14',
    category: 'general',
    languages: '20+ lingue europee',
    speed: 'fast',
    quality: 4,
    vramGb: 16,
    recommended: false,
  },
  {
    name: 'DeepSeek R1 32B',
    pullName: 'deepseek-r1:32b',
    description: 'DeepSeek — ragionamento top, chain-of-thought. Richiede 24GB+ VRAM.',
    sizeGb: '~19',
    category: 'general',
    languages: '20+ lingue',
    speed: 'slow',
    quality: 5,
    vramGb: 24,
    recommended: false,
  },
  {
    name: 'Llama 3.3 70B',
    pullName: 'llama3.3:70b',
    description: 'Meta — general-purpose top. Richiede GPU potente (48GB+ VRAM).',
    sizeGb: '~40',
    category: 'general',
    languages: '8 lingue principali',
    speed: 'slow',
    quality: 5,
    vramGb: 48,
    recommended: false,
  },
];

// ============================================================================
// API FUNCTIONS
// ============================================================================

/** Verifica se Ollama è in esecuzione */
export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Lista modelli installati */
export async function listInstalledModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Ollama non raggiungibile');
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.models || []).map((m: any) => ({
    name: m.name,
    size: m.size || 0,
    digest: m.digest || '',
    modified_at: m.modified_at || '',
    details: m.details,
  }));
}

/** Pull (download) un modello — restituisce un ReadableStream per progress */
export async function pullModel(modelName: string, onProgress?: (status: string, completed?: number, total?: number) => void): Promise<void> {
  const res = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
  });
  if (!res.ok) throw new Error(`Errore pull: ${res.statusText}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        onProgress?.(json.status || '', json.completed, json.total);
      } catch {}
    }
  }
}

/** Elimina un modello */
export async function deleteModel(modelName: string): Promise<void> {
  const res = await fetch(`${OLLAMA_URL}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName }),
  });
  if (!res.ok) throw new Error(`Errore delete: ${res.statusText}`);
}

/** Speed test — misura tok/s con un prompt di traduzione reale */
export async function speedTest(modelName: string, testText?: string): Promise<SpeedTestResult> {
  const text = testText || 'The ancient castle stood tall against the crimson sunset, its weathered stones telling stories of centuries past. Knights once roamed these halls, their armor gleaming in the torchlight as they prepared for battle.';
  const prompt = `Translate the following text from English to Italian. Return ONLY the translation, nothing else.\n\n${text}`;

  const startTime = Date.now();
  let firstTokenTime = 0;

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      options: { temperature: 0.1, num_predict: 300 },
    }),
  });
  if (!res.ok) throw new Error(`Speed test fallito: ${res.statusText}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let totalTokens = 0;
  let promptEvalRate = 0;
  let evalRate = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content && !firstTokenTime) {
          firstTokenTime = Date.now();
        }
        if (json.done && json.eval_count) {
          totalTokens = json.eval_count;
          evalRate = json.eval_count / (json.eval_duration / 1e9) || 0;
          promptEvalRate = json.prompt_eval_count / (json.prompt_eval_duration / 1e9) || 0;
        }
      } catch {}
    }
  }

  const totalTimeMs = Date.now() - startTime;
  return {
    model: modelName,
    tokensPerSecond: evalRate || (totalTokens / (totalTimeMs / 1000)),
    totalTokens,
    totalTimeMs,
    firstTokenMs: firstTokenTime ? firstTokenTime - startTime : totalTimeMs,
    promptEvalRate,
  };
}

/** Confronto A/B — traduce lo stesso testo con due modelli e confronta */
export async function compareModels(
  modelA: string,
  modelB: string,
  testText: string,
  sourceLang: string,
  targetLang: string,
): Promise<ABComparisonResult> {
  const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translation, nothing else.\n\n${testText}`;

  const translateWith = async (model: string) => {
    const start = Date.now();
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.1, num_predict: 500 },
      }),
    });
    if (!res.ok) throw new Error(`${model}: ${res.statusText}`);
    const data = await res.json();
    const timeMs = Date.now() - start;
    const tokPerSec = data.eval_count ? data.eval_count / (data.eval_duration / 1e9) : 0;
    return {
      name: model,
      translation: data.message?.content?.trim() || '',
      timeMs,
      tokensPerSecond: Math.round(tokPerSec * 10) / 10,
    };
  };

  // Esegui in parallelo
  const [resultA, resultB] = await Promise.all([translateWith(modelA), translateWith(modelB)]);

  return {
    modelA: resultA,
    modelB: resultB,
    testText,
    sourceLang,
    targetLang,
  };
}

/** Formatta dimensione in GB leggibili */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

// ============================================================================
// AUTO-DISCOVERY: Scopri nuovi modelli dal registry Ollama
// ============================================================================

export interface DiscoveredModel {
  name: string;
  description: string;
  pulls: string;        // es. "4.5M", "90.6K"
  tags: number;
  updatedAgo: string;   // es. "14 hours ago", "1 week ago"
  categories: string[]; // es. ["tools", "thinking", "vision"]
  sizes: string[];      // es. ["4b", "8b", "27b"]
  isNew: boolean;       // aggiornato negli ultimi 14 giorni
  relevanceScore: number; // 0-100, quanto è utile per traduzione
}

// Cache per evitare richieste eccessive
let discoveryCache: { models: DiscoveredModel[]; timestamp: number } | null = null;
const DISCOVERY_CACHE_TTL = 60 * 60 * 1000; // 1 ora

// Parole chiave per determinare rilevanza alla traduzione
const TRANSLATION_RELEVANT_KEYWORDS = [
  'translat', 'multilingual', 'language', 'multimodal', 'chat',
  'reasoning', 'general', 'versatile', 'text', 'instruct',
];
const TRANSLATION_IRRELEVANT_KEYWORDS = [
  'coder', 'coding', 'code-only', 'math-only', 'embedding',
  'vision-only', 'ocr-only', 'audio-only', 'speech-only',
];

/**
 * Scopri nuovi modelli dal registry Ollama.
 * Fa scraping di ollama.com/search, estrae i modelli e li filtra
 * per rilevanza alla traduzione. Cachea per 1 ora.
 */
export async function discoverNewModels(
  installedNames: string[],
  forceRefresh = false,
): Promise<DiscoveredModel[]> {
  // Controlla cache
  if (!forceRefresh && discoveryCache && Date.now() - discoveryCache.timestamp < DISCOVERY_CACHE_TTL) {
    return filterDiscovered(discoveryCache.models, installedNames);
  }

  const allModels: DiscoveredModel[] = [];

  // Fetch multiple categorie dalla pagina di ricerca Ollama
  const searchUrls = [
    'https://ollama.com/search?q=translate',
    'https://ollama.com/search?q=multilingual',
    'https://ollama.com/search?q=&c=tools',   // modelli con tool use (spesso multilingue)
  ];

  for (const url of searchUrls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'Accept': 'text/html', 'User-Agent': 'GameStringer/1.4' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const parsed = parseOllamaSearchPage(html);
      for (const model of parsed) {
        if (!allModels.some(m => m.name === model.name)) {
          allModels.push(model);
        }
      }
    } catch {
      // Silently skip if network error
    }
  }

  // Calcola relevance score per ognuno
  for (const model of allModels) {
    model.relevanceScore = calculateRelevance(model);
  }

  // Ordina per relevance e popolarità
  allModels.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Salva in cache
  discoveryCache = { models: allModels, timestamp: Date.now() };

  return filterDiscovered(allModels, installedNames);
}

/** Filtra i modelli scoperti: rimuovi quelli già installati e quelli poco rilevanti */
function filterDiscovered(models: DiscoveredModel[], installedNames: string[]): DiscoveredModel[] {
  const installedLower = installedNames.map(n => n.split(':')[0].toLowerCase());
  const recommendedLower = RECOMMENDED_MODELS.map(r => r.pullName.split(':')[0].toLowerCase());

  return models.filter(m => {
    const nameLower = m.name.toLowerCase();
    // Escludi se già installato
    if (installedLower.some(n => nameLower.includes(n) || n.includes(nameLower))) return false;
    // Escludi se già nei consigliati
    if (recommendedLower.some(n => nameLower.includes(n) || n.includes(nameLower))) return false;
    // Escludi se relevance troppo bassa
    if (m.relevanceScore < 20) return false;
    return true;
  });
}

/** Parse la pagina HTML di ricerca Ollama per estrarre i modelli */
function parseOllamaSearchPage(html: string): DiscoveredModel[] {
  const models: DiscoveredModel[] = [];

  // Estrai blocchi di modelli — ogni modello è in un link/card con classe riconoscibile
  // Pattern: nome modello + descrizione + pulls + tags + updated
  const modelBlockRegex = /href="\/library\/([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
  let match;

  while ((match = modelBlockRegex.exec(html)) !== null) {
    const name = match[1].trim();
    if (!name || models.some(m => m.name === name)) continue;

    const block = match[0];

    // Estrai descrizione — testo dopo il nome, prima dei badge
    const descMatch = block.match(/(?:>\s*\n\s*)([\w][\s\S]{10,200}?)(?=\s*<)/);
    const description = descMatch ? descMatch[1].trim().replace(/\s+/g, ' ') : '';

    // Estrai pulls
    const pullsMatch = block.match(/([\d.]+[KMB]?)\s*Pull/i);
    const pulls = pullsMatch ? pullsMatch[1] : '0';

    // Estrai tags count
    const tagsMatch = block.match(/(\d+)\s*Tag/i);
    const tags = tagsMatch ? parseInt(tagsMatch[1]) : 0;

    // Estrai updated ago
    const updatedMatch = block.match(/Updated\s+([\w\s]+ago)/i);
    const updatedAgo = updatedMatch ? updatedMatch[1].trim() : 'unknown';

    // Estrai categorie (tools, thinking, vision, etc.)
    const categories: string[] = [];
    const catRegex = />\s*(tools|thinking|vision|embedding|code)\s*</gi;
    let catMatch;
    while ((catMatch = catRegex.exec(block)) !== null) {
      categories.push(catMatch[1].toLowerCase());
    }

    // Estrai sizes (0.5b, 1b, 4b, 8b, etc.)
    const sizes: string[] = [];
    const sizeRegex = />\s*([\d.]+b)\s*</gi;
    let sizeMatch;
    while ((sizeMatch = sizeRegex.exec(block)) !== null) {
      sizes.push(sizeMatch[1].toLowerCase());
    }

    // Determina se è nuovo (aggiornato di recente)
    const isNew = /\d+\s*(hour|minute|day)s?\s*ago/i.test(updatedAgo) &&
      !/\d+\s*(month|year)s?\s*ago/i.test(updatedAgo);

    models.push({
      name,
      description,
      pulls,
      tags,
      updatedAgo,
      categories,
      sizes,
      isNew,
      relevanceScore: 0, // calcolato dopo
    });
  }

  // Fallback: parsing più semplice se il regex complesso non trova nulla
  if (models.length === 0) {
    const simpleRegex = /\/library\/([\w.-]+)/g;
    let simpleMatch;
    const seenNames = new Set<string>();
    while ((simpleMatch = simpleRegex.exec(html)) !== null) {
      const name = simpleMatch[1];
      if (seenNames.has(name)) continue;
      seenNames.add(name);
      models.push({
        name,
        description: '',
        pulls: '0',
        tags: 0,
        updatedAgo: 'unknown',
        categories: [],
        sizes: [],
        isNew: false,
        relevanceScore: 0,
      });
    }
  }

  return models;
}

/** Calcola un punteggio di rilevanza per la traduzione (0-100) */
function calculateRelevance(model: DiscoveredModel): number {
  let score = 30; // Base score

  const text = `${model.name} ${model.description}`.toLowerCase();

  // Boost per keywords rilevanti alla traduzione
  for (const kw of TRANSLATION_RELEVANT_KEYWORDS) {
    if (text.includes(kw)) score += 8;
  }

  // Penalità per modelli solo-coding o non rilevanti
  for (const kw of TRANSLATION_IRRELEVANT_KEYWORDS) {
    if (text.includes(kw)) score -= 15;
  }

  // Boost per popolarità (più pulls = più testato)
  const pullsNum = parsePulls(model.pulls);
  if (pullsNum > 1_000_000) score += 15;
  else if (pullsNum > 100_000) score += 10;
  else if (pullsNum > 10_000) score += 5;

  // Boost per novità
  if (model.isNew) score += 10;

  // Boost per categories utili
  if (model.categories.includes('tools')) score += 5;
  if (model.categories.includes('thinking')) score += 3;
  if (model.categories.includes('vision')) score += 2; // multimodale è utile

  // Penalità per modelli solo embedding
  if (model.categories.includes('embedding')) score -= 20;

  // Boost se ha taglie piccole (più accessibili)
  if (model.sizes.some(s => ['4b', '7b', '8b'].includes(s))) score += 5;

  return Math.max(0, Math.min(100, score));
}

/** Converte "4.5M", "90.6K", "1234" in numero */
function parsePulls(pulls: string): number {
  const num = parseFloat(pulls);
  if (pulls.toUpperCase().includes('B')) return num * 1_000_000_000;
  if (pulls.toUpperCase().includes('M')) return num * 1_000_000;
  if (pulls.toUpperCase().includes('K')) return num * 1_000;
  return num || 0;
}

/** Invalida la cache discovery (es. dopo un pull) */
export function invalidateDiscoveryCache(): void {
  discoveryCache = null;
}
