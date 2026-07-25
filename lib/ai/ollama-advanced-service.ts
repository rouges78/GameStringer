/**
 * 🤖 Ollama Advanced Service
 * 
 * Feature avanzate:
 * - GPU Advisor: Rilevamento VRAM e suggerimento modello
 * - Smart Model Selector: Selezione automatica basata su complessità
 * - Advanced Parameters: Temperature, top_p, top_k control
 * - Custom Prompt Templates: Template per genere di gioco
 * - Multi-Model Ensemble: Voting system con 2-3 modelli
 * - Translation Cache: SQLite persistent cache
 */

import { invoke } from '@tauri-apps/api/core';
import { clientLogger } from '@/lib/client-logger';
import { ollamaArgs } from '@/lib/ai/ollama-endpoint';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface GPUInfo {
  name: string;
  vramTotalMB: number;
  vramAvailableMB: number;
  driverVersion: string;
  cudaSupport: boolean;
}

export interface ModelRequirements {
  model: string;
  minVramGB: number;
  recommendedVramGB: number;
  speed: 'fast' | 'medium' | 'slow';
  quality: 1 | 2 | 3 | 4 | 5;
}

export interface AdvancedParameters {
  temperature: number;      // 0.0 - 2.0, default 0.3
  topP: number;            // 0.0 - 1.0, default 0.9
  topK: number;            // 0 - 100, default 40
  repeatPenalty: number;    // 1.0 - 2.0, default 1.1
  numPredict: number;      // Max tokens, default 2048
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  genre?: string;
  systemPrompt: string;
  examples?: Array<{source: string; target: string}>;
}

export interface EnsembleConfig {
  models: string[];        // 2-3 modelli
  votingStrategy: 'best_quality' | 'majority_vote' | 'speed_priority';
}

export interface CachedTranslation {
  key: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  timestamp: number;
  hitCount: number;
}

// ═══════════════════════════════════════════════════════════════════
// GPU ADVISOR
// ═══════════════════════════════════════════════════════════════════

const MODEL_REQUIREMENTS: ModelRequirements[] = [
  // Ultra-lightweight
  { model: 'translategemma:2b', minVramGB: 1.5, recommendedVramGB: 2, speed: 'fast', quality: 3 },
  { model: 'hy-mt1.5:1.8b', minVramGB: 2, recommendedVramGB: 3, speed: 'fast', quality: 3 },
  { model: 'gemma4:e2b', minVramGB: 2, recommendedVramGB: 3, speed: 'fast', quality: 3 },
  
  // Lightweight
  { model: 'translategemma:4b', minVramGB: 3, recommendedVramGB: 4, speed: 'fast', quality: 3 },
  { model: 'hy-mt1.5:7b', minVramGB: 5, recommendedVramGB: 6, speed: 'medium', quality: 5 },
  { model: 'gemma4:e4b', minVramGB: 4, recommendedVramGB: 5, speed: 'fast', quality: 4 },
  
  // Medium
  { model: 'translategemma:12b', minVramGB: 10, recommendedVramGB: 12, speed: 'medium', quality: 4 },
  { model: 'qwen3:8b', minVramGB: 6, recommendedVramGB: 8, speed: 'medium', quality: 5 },
  { model: 'gemma3:12b', minVramGB: 10, recommendedVramGB: 12, speed: 'medium', quality: 4 },
  { model: 'glm4:8b', minVramGB: 6, recommendedVramGB: 8, speed: 'fast', quality: 5 },
  
  // Large
  { model: 'translategemma:27b', minVramGB: 18, recommendedVramGB: 22, speed: 'slow', quality: 5 },
  { model: 'gemma4:27b', minVramGB: 18, recommendedVramGB: 22, speed: 'fast', quality: 5 },
  { model: 'deepseek-r1:14b', minVramGB: 12, recommendedVramGB: 16, speed: 'slow', quality: 5 },
  { model: 'qwen3.5:35b-a3b', minVramGB: 5, recommendedVramGB: 6, speed: 'fast', quality: 5 },
  { model: 'lfm2:24b', minVramGB: 4, recommendedVramGB: 6, speed: 'fast', quality: 4 },
];

export async function detectGPU(): Promise<GPUInfo | null> {
  try {
    const info = await invoke<GPUInfo>('detect_gpu');
    return info;
  } catch (error) {
    clientLogger.warn('[GPU Advisor] Failed to detect GPU:', error);
    return null;
  }
}

export function recommendModels(gpuInfo: GPUInfo | null): {
  recommended: ModelRequirements[];
  compatible: ModelRequirements[];
  tooLarge: ModelRequirements[];
} {
  if (!gpuInfo) {
    // Fallback: assume 8GB VRAM
    return {
      recommended: MODEL_REQUIREMENTS.filter(m => m.recommendedVramGB <= 8 && m.quality >= 4),
      compatible: MODEL_REQUIREMENTS.filter(m => m.minVramGB <= 8),
      tooLarge: MODEL_REQUIREMENTS.filter(m => m.minVramGB > 8),
    };
  }

  const availableGB = gpuInfo.vramAvailableMB / 1024;

  return {
    recommended: MODEL_REQUIREMENTS.filter(m => 
      m.recommendedVramGB <= availableGB && m.quality >= 4
    ),
    compatible: MODEL_REQUIREMENTS.filter(m => 
      m.minVramGB <= availableGB
    ),
    tooLarge: MODEL_REQUIREMENTS.filter(m => 
      m.minVramGB > availableGB
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════
// SMART MODEL SELECTOR
// ═══════════════════════════════════════════════════════════════════

export interface TextComplexity {
  length: number;
  hasFormatting: boolean;
  hasSpecialChars: boolean;
  wordCount: number;
  complexity: 'simple' | 'medium' | 'complex';
}

export function analyzeTextComplexity(text: string): TextComplexity {
  const length = text.length;
  const wordCount = text.split(/\s+/).length;
  const hasFormatting = /[\n\r\t]/.test(text);
  const hasSpecialChars = /[<>{}\[\]()]/.test(text);
  
  let complexity: 'simple' | 'medium' | 'complex';
  if (length < 50 && wordCount < 10 && !hasSpecialChars) {
    complexity = 'simple';
  } else if (length > 200 || wordCount > 40 || hasSpecialChars) {
    complexity = 'complex';
  } else {
    complexity = 'medium';
  }

  return {
    length,
    hasFormatting,
    hasSpecialChars,
    wordCount,
    complexity,
  };
}

export function selectOptimalModel(
  text: string,
  availableModels: string[],
  gpuInfo: GPUInfo | null
): string {
  const complexity = analyzeTextComplexity(text);
  const recommendations = recommendModels(gpuInfo);
  
  // Priority: Quality models for complex text, speed for simple
  let candidates: ModelRequirements[];
  
  if (complexity.complexity === 'complex') {
    // Prefer quality 5 models
    candidates = recommendations.recommended.filter(m => 
      m.quality === 5 && availableModels.some(am => m.model.includes(am) || am.includes(m.model))
    );
  } else if (complexity.complexity === 'simple') {
    // Prefer fast models
    candidates = recommendations.recommended.filter(m => 
      m.speed === 'fast' && availableModels.some(am => m.model.includes(am) || am.includes(m.model))
    );
  } else {
    // Balanced
    candidates = recommendations.recommended.filter(m => 
      availableModels.some(am => m.model.includes(am) || am.includes(m.model))
    );
  }
  
  if (candidates.length === 0) {
    // Fallback to first available compatible model
    const compatible = recommendations.compatible.find(m => 
      availableModels.some(am => m.model.includes(am) || am.includes(m.model))
    );
    return compatible?.model || availableModels[0] || 'qwen2.5:14b';
  }
  
  return candidates[0].model;
}

// ═══════════════════════════════════════════════════════════════════
// ADVANCED PARAMETERS
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_ADVANCED_PARAMS: AdvancedParameters = {
  temperature: 0.3,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  numPredict: 2048,
};

export const PARAMETER_PRESETS: Record<string, AdvancedParameters> = {
  precise: {
    temperature: 0.1,
    topP: 0.5,
    topK: 20,
    repeatPenalty: 1.2,
    numPredict: 2048,
  },
  balanced: {
    temperature: 0.3,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.1,
    numPredict: 2048,
  },
  creative: {
    temperature: 0.7,
    topP: 0.95,
    topK: 60,
    repeatPenalty: 1.0,
    numPredict: 2048,
  },
  fast: {
    temperature: 0.5,
    topP: 1.0,
    topK: 50,
    repeatPenalty: 1.05,
    numPredict: 1024,
  },
};

// ═══════════════════════════════════════════════════════════════════
// CUSTOM PROMPT TEMPLATES
// ═══════════════════════════════════════════════════════════════════

export const GAME_GENRE_TEMPLATES: PromptTemplate[] = [
  {
    id: 'rpg',
    name: 'RPG / JRPG',
    description: 'Role-playing games with dialogue, quests, lore',
    genre: 'rpg',
    systemPrompt: `You are translating an RPG game. Preserve character voices, honorifics, and fantasy terminology. Adapt jokes/cultural references appropriately. Maintain consistency with previously established terms.`,
    examples: [
      { source: "勇者よ、魔王城へ行くのだ！", target: "O hero, thou must go to the Demon King's castle!" },
    ],
  },
  {
    id: 'visual_novel',
    name: 'Visual Novel',
    description: 'Story-heavy games with emotional dialogue',
    genre: 'visual_novel',
    systemPrompt: `You are translating a visual novel. Capture emotional nuance, character speech patterns, and maintain the tone (dramatic/comedic/romantic). Preserve Japanese honorifics and speech quirks where appropriate.`,
    examples: [
      { source: "先輩、好きです！", target: "Senpai... I love you!" },
    ],
  },
  {
    id: 'action',
    name: 'Action / Shooter',
    description: 'Fast-paced games with UI and brief dialogue',
    genre: 'action',
    systemPrompt: `You are translating an action game. Keep UI text concise and punchy. Military/shooter terminology should sound authentic. Brief dialogue should convey urgency.`,
    examples: [
      { source: "Reloading!", target: "Ricarica in corso!" },
    ],
  },
  {
    id: 'horror',
    name: 'Horror / Survival',
    description: 'Atmospheric horror games',
    genre: 'horror',
    systemPrompt: `You are translating a horror game. Maintain atmospheric dread in descriptions. Keep UI minimal and stark. Psychological horror text should be unsettling.`,
    examples: [
      { source: "You are not alone.", target: "Non sei solo." },
    ],
  },
  {
    id: 'strategy',
    name: 'Strategy / Simulation',
    description: 'Complex games with many UI elements',
    genre: 'strategy',
    systemPrompt: `You are translating a strategy/simulation game. Technical terms should be precise. UI should be clear and informative. Tutorial text should be helpful and encouraging.`,
    examples: [
      { source: "Insufficient resources", target: "Risorse insufficienti" },
    ],
  },
];

export function getPromptTemplate(genre: string): PromptTemplate {
  return GAME_GENRE_TEMPLATES.find(t => t.genre === genre) || GAME_GENRE_TEMPLATES[0];
}

// ═══════════════════════════════════════════════════════════════════
// MULTI-MODEL ENSEMBLE
// ═══════════════════════════════════════════════════════════════════

export interface EnsembleResult {
  bestTranslation: string;
  confidence: number;
  alternatives: Array<{model: string; translation: string; score: number}>;
  consensus: 'high' | 'medium' | 'low';
}

export async function translateWithEnsemble(
  text: string,
  sourceLang: string,
  targetLang: string,
  config: EnsembleConfig,
  params: AdvancedParameters
): Promise<EnsembleResult> {
  const results: Array<{model: string; translation: string; time: number}> = [];
  
  // Run translations in parallel
  const promises = config.models.map(async (model) => {
    const start = performance.now();
    try {
      const result = await invoke<string>('ollama_translate_advanced', {
        text,
        sourceLang,
        targetLang,
        model,
        temperature: params.temperature,
        topP: params.topP,
        topK: params.topK,
      });
      return {
        model,
        translation: result,
        time: performance.now() - start,
      };
    } catch {
      return {
        model,
        translation: '',
        time: 999999,
      };
    }
  });
  
  const settled = await Promise.allSettled(promises);
  
  settled.forEach((result, _i) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    }
  });
  
  // Simple voting strategy (can be improved with semantic similarity)
  const validResults = results.filter(r => r.translation);
  
  if (validResults.length === 0) {
    throw new Error('All models failed');
  }
  
  if (validResults.length === 1) {
    return {
      bestTranslation: validResults[0].translation,
      confidence: 0.5,
      alternatives: [],
      consensus: 'low',
    };
  }
  
  // Pick fastest if speed priority, else pick most common
  if (config.votingStrategy === 'speed_priority') {
    const fastest = validResults.reduce((a, b) => a.time < b.time ? a : b);
    return {
      bestTranslation: fastest.translation,
      confidence: 0.7,
      alternatives: validResults.filter(r => r.model !== fastest.model).map(r => ({
        model: r.model,
        translation: r.translation,
        score: 0.5,
      })),
      consensus: 'medium',
    };
  }
  
  // Default: use first result (can be improved with similarity metrics)
  const best = validResults[0];
  return {
    bestTranslation: best.translation,
    confidence: 0.8,
    alternatives: validResults.slice(1).map(r => ({
      model: r.model,
      translation: r.translation,
      score: 0.6,
    })),
    consensus: validResults.length >= 2 ? 'medium' : 'low',
  };
}

// ═══════════════════════════════════════════════════════════════════
// TRANSLATION CACHE (SQLite)
// ═══════════════════════════════════════════════════════════════════

export class TranslationCache {
  private static instance: TranslationCache;
  private constructor() {}
  
  static getInstance(): TranslationCache {
    if (!TranslationCache.instance) {
      TranslationCache.instance = new TranslationCache();
    }
    return TranslationCache.instance;
  }
  
  private generateKey(text: string, sourceLang: string, targetLang: string, model: string): string {
    // Simple hash - in production use proper hashing
    const normalized = text.toLowerCase().trim();
    return `${sourceLang}:${targetLang}:${model}:${normalized.slice(0, 100)}`;
  }
  
  async get(text: string, sourceLang: string, targetLang: string, model: string): Promise<CachedTranslation | null> {
    try {
      const key = this.generateKey(text, sourceLang, targetLang, model);
      const result = await invoke<CachedTranslation | null>('get_cached_translation', { key });
      return result;
    } catch (error) {
      clientLogger.error('[Cache] Get failed:', error);
      return null;
    }
  }
  
  async set(text: string, sourceLang: string, targetLang: string, model: string, translation: string): Promise<void> {
    try {
      const key = this.generateKey(text, sourceLang, targetLang, model);
      await invoke('set_cached_translation', {
        key,
        text: translation,
        sourceLang,
        targetLang,
        model,
      });
    } catch (error) {
      clientLogger.error('[Cache] Set failed:', error);
    }
  }
  
  async clear(): Promise<void> {
    try {
      await invoke('clear_translation_cache');
    } catch (error) {
      clientLogger.error('[Cache] Clear failed:', error);
    }
  }
  
  async getStats(): Promise<{totalEntries: number; totalSizeKB: number; hitRate: number}> {
    try {
      return await invoke('get_cache_stats');
    } catch {
      return { totalEntries: 0, totalSizeKB: 0, hitRate: 0 };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-UPDATE CHECKER
// ═══════════════════════════════════════════════════════════════════

export interface ModelUpdateInfo {
  model: string;
  currentDigest: string;
  latestDigest: string;
  hasUpdate: boolean;
  updateSize?: string;
}

export async function checkModelUpdates(): Promise<ModelUpdateInfo[]> {
  try {
    const updates = await invoke<ModelUpdateInfo[]>('check_ollama_model_updates');
    return updates;
  } catch (error) {
    clientLogger.error('[Auto-Update] Check failed:', error);
    return [];
  }
}

export async function updateModel(model: string): Promise<void> {
  try {
    await invoke('pull_ollama_model', { name: model, ...ollamaArgs() });
  } catch (error) {
    clientLogger.error('[Auto-Update] Update failed:', error);
    throw error;
  }
}
