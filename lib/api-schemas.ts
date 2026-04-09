/**
 * Zod validation schemas for API endpoints.
 * Centralizes input validation to prevent injection, DoS, and malformed data.
 */

import { z } from 'zod';

// ── Shared validators ──────────────────────────────────────

/** ISO 639-1 language codes supported by GameStringer */
const SUPPORTED_LANGUAGES = [
  'auto', 'en', 'it', 'es', 'fr', 'de', 'ja', 'zh', 'ko', 'pt', 'ru', 'pl',
  'ar', 'cs', 'da', 'nl', 'fi', 'el', 'he', 'hi', 'hu', 'id', 'ms', 'no',
  'ro', 'sk', 'sv', 'th', 'tr', 'uk', 'vi', 'bg', 'ca', 'et', 'hr', 'lt',
  'lv', 'sl', 'sr',
] as const;

const languageCode = z.string().min(2).max(10).refine(
  (val) => SUPPORTED_LANGUAGES.includes(val as typeof SUPPORTED_LANGUAGES[number]) || /^[a-z]{2}(-[A-Z]{2})?$/.test(val),
  { message: 'Invalid language code' }
);

/** AI provider identifiers */
const AI_PROVIDERS = [
  'openai', 'gpt5', 'anthropic', 'claude', 'gemini', 'deepseek', 'mistral',
  'openrouter', 'groq', 'cohere', 'ollama', 'libre', 'local',
] as const;

const providerCode = z.string().min(2).max(30).refine(
  (val) => AI_PROVIDERS.includes(val as typeof AI_PROVIDERS[number]) || /^[a-z0-9_-]+$/.test(val),
  { message: 'Invalid provider identifier' }
);

// ── Translation schemas ────────────────────────────────────

export const translateRequestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(50000, 'Text exceeds 50000 character limit'),
  targetLanguage: languageCode,
  sourceLanguage: languageCode.optional().default('auto'),
  provider: providerCode.optional().default('openai'),
  context: z.string().max(5000, 'Context exceeds 5000 character limit').optional(),
  apiKey: z.string().max(256, 'API key too long').optional(),
});

export const batchTranslateRequestSchema = z.object({
  texts: z.array(
    z.string().min(1).max(50000, 'Individual text exceeds 50000 character limit')
  ).min(1, 'At least one text required').max(20, 'Maximum 20 texts per batch'),
  targetLanguage: languageCode,
  sourceLanguage: languageCode.optional().default('auto'),
  provider: providerCode.optional().default('openai'),
  context: z.string().max(5000).optional(),
  apiKey: z.string().max(256).optional(),
});

// ── Secrets schema ─────────────────────────────────────────

const ALLOWED_SECRET_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'MISTRAL_API_KEY',
  'OPENROUTER_API_KEY',
] as const;

export const secretsRequestSchema = z.object({
  key: z.enum(ALLOWED_SECRET_KEYS, { errorMap: () => ({ message: 'Invalid API key name' }) }),
  value: z.string().max(256, 'API key value too long (max 256 chars)').optional().default(''),
});

// ── Dictionary schema ──────────────────────────────────────

export const dictionaryAddSchema = z.object({
  gameId: z.string().max(100, 'Game ID too long').optional(),
  targetLanguage: languageCode.optional().default('it'),
  original: z.string().min(1, 'Original text required').max(10000, 'Original text too long'),
  translated: z.string().min(1, 'Translated text required').max(10000, 'Translated text too long'),
});

// ── Helper to validate and parse request body ──────────────

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { success: false, error: messages };
}

export type TranslateRequest = z.infer<typeof translateRequestSchema>;
export type BatchTranslateRequest = z.infer<typeof batchTranslateRequestSchema>;
export type SecretsRequest = z.infer<typeof secretsRequestSchema>;
export type DictionaryAddRequest = z.infer<typeof dictionaryAddSchema>;
