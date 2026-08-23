/**
 * VLM Batch Translate — Traduzione contestuale a lotto (una chiamata VLM per frame).
 *
 * Due modalita':
 *  - vlmBatchTranslate: l'OCR fornisce le righe + bbox, il VLM le traduce VEDENDO lo schermo
 *    (disambiguazione visiva). Mantiene le posizioni precise dell'OCR.
 *  - vlmFullTranslate: NESSUN OCR. Il VLM rileva da solo tutto il testo su schermo e restituisce
 *    testo tradotto + bounding box NORMALIZZATI (0..1). Utile con font stilizzati dove l'OCR fallisce.
 *
 * In entrambi i casi l'output e' un JSON strutturato, validato con Zod, con una riga per id.
 * Risolve l'ambiguita' classica ("Chest" = forziere o petto?) perche' il modello VEDE la scena.
 *
 * Provider: Ollama (locale), OpenAI (GPT-4o, JSON mode), Gemini (JSON response).
 */

import { z } from 'zod';
import { ollamaFetch } from '@/lib/ai/ollama-http';
import { clientLogger } from '@/lib/client-logger';
import type { BoundingBox } from './ocr-service';

// ============================================================================
// TIPI E SCHEMA
// ============================================================================

export type VlmProvider = 'ollama' | 'openai' | 'gemini';

/** Riga in ingresso: testo grezzo OCR + bbox, con un id stabile per il matching. */
export interface VlmLineInput {
  id: number;
  text: string;
  bbox: BoundingBox;
}

/** Bounding box normalizzato (0..1) restituito dal VLM nel path full. */
export interface NormalizedBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Riga tradotta restituita dal modello. */
export interface VlmLineOutput {
  id: number;
  translated: string;
  confidence: number;
  disambiguation?: string;
  /** Presente solo nel path full: posizione normalizzata 0..1 del testo sullo schermo. */
  bbox?: NormalizedBBox;
}

export interface VlmBatchResult {
  /** Descrizione sintetica della scena (utile come contesto/telemetria). */
  scene: string;
  lines: VlmLineOutput[];
}

export interface VlmBatchTranslateOptions {
  imageBase64: string;
  lines: VlmLineInput[];
  targetLanguage: string;
  sourceLanguage?: string;
  /** Righe di dialogo precedenti per coerenza narrativa. */
  contextLines?: string[];
  provider?: VlmProvider;
  model?: string;
  /** Lato lungo massimo dello screenshot inviato al modello (downscale). 0 = nessun downscale. */
  downscaleMaxPx?: number;
  /** Temperatura del modello (default 0.3, deterministica). */
  temperature?: number;
}

/** Opzioni del path full (senza OCR): il VLM rileva e posiziona il testo da solo. */
export interface VlmFullTranslateOptions {
  imageBase64: string;
  targetLanguage: string;
  sourceLanguage?: string;
  contextLines?: string[];
  provider?: VlmProvider;
  model?: string;
  downscaleMaxPx?: number;
  temperature?: number;
}

const normalizedBBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

/** Schema Zod per validare l'output JSON del modello prima di consumarlo. */
const vlmLineOutputSchema = z.object({
  id: z.number().int().nonnegative(),
  translated: z.string(),
  confidence: z.number().min(0).max(1).catch(0.8),
  disambiguation: z.string().optional(),
  bbox: normalizedBBoxSchema.optional(),
});

export const vlmBatchResultSchema = z.object({
  scene: z.string().catch(''),
  lines: z.array(vlmLineOutputSchema),
});

const DEFAULT_OLLAMA_MODEL = 'llava:13b';
const DEFAULT_OPENAI_MODEL = 'gpt-4o';
const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';
const DEFAULT_DOWNSCALE_MAX_PX = 1280;

const VLM_BATCH_SYSTEM_PROMPT = `You are an expert video game localizer with visual context. You can SEE the game screen.
You receive a screenshot and a JSON list of text lines detected on it (each with an id).
Rules:
- Translate every line accurately into the target language.
- Use the visual scene to disambiguate words (e.g. "Chest" = treasure chest if a box is visible, or body part if a character is shown).
- Detect speaker gender from character models on screen and inflect accordingly.
- Keep tone consistent with the visual atmosphere (dark dungeon = serious, colorful town = casual).
- Preserve placeholders, tags and variables (e.g. {name}, %s, <b>) exactly.
- Return ONLY a JSON object, no prose, matching exactly this shape:
{"scene":"<short scene description>","lines":[{"id":<int>,"translated":"<text>","confidence":<0..1>,"disambiguation":"<optional short note>"}]}
- Output one entry per input line, keeping the same id.`;

const VLM_FULL_SYSTEM_PROMPT = `You are an expert video game localizer with visual context. You can SEE the game screen.
No OCR is provided: YOU must detect every readable text region on the screenshot (menus, dialogue, buttons, HUD).
Rules:
- Detect each distinct text block and translate it into the target language.
- Use the visual scene to disambiguate words and to detect speaker gender; inflect accordingly.
- Preserve placeholders, tags and variables (e.g. {name}, %s, <b>) exactly.
- For each block give a NORMALIZED bounding box relative to the image size, with x,y = top-left and w,h = size, all in the range 0..1.
- Ignore purely decorative or illegible text.
- Return ONLY a JSON object, no prose, matching exactly this shape:
{"scene":"<short scene description>","lines":[{"id":<int>,"translated":"<text>","confidence":<0..1>,"disambiguation":"<optional short note>","bbox":{"x":<0..1>,"y":<0..1>,"w":<0..1>,"h":<0..1>}}]}
- Assign incremental ids starting from 0, ordered top-to-bottom.`;

// ============================================================================
// API PUBBLICA
// ============================================================================

/**
 * Path HYBRID: traduce a lotto le righe fornite dall'OCR usando il contesto visivo.
 */
export async function vlmBatchTranslate(opts: VlmBatchTranslateOptions): Promise<VlmBatchResult> {
  const {
    imageBase64,
    lines,
    targetLanguage,
    sourceLanguage,
    contextLines = [],
    provider = 'ollama',
    model,
    downscaleMaxPx = DEFAULT_DOWNSCALE_MAX_PX,
    temperature = 0.3,
  } = opts;

  if (lines.length === 0) {
    return { scene: '', lines: [] };
  }

  const image = await maybeDownscale(imageBase64, downscaleMaxPx);
  const userPrompt = buildBatchPrompt(lines, targetLanguage, sourceLanguage, contextLines);
  return dispatch(provider, VLM_BATCH_SYSTEM_PROMPT, userPrompt, image, model, temperature);
}

/**
 * Path FULL: nessun OCR. Il VLM rileva, posiziona (bbox normalizzati) e traduce tutto il testo.
 */
export async function vlmFullTranslate(opts: VlmFullTranslateOptions): Promise<VlmBatchResult> {
  const {
    imageBase64,
    targetLanguage,
    sourceLanguage,
    contextLines = [],
    provider = 'ollama',
    model,
    downscaleMaxPx = DEFAULT_DOWNSCALE_MAX_PX,
    temperature = 0.3,
  } = opts;

  const image = await maybeDownscale(imageBase64, downscaleMaxPx);
  const userPrompt = buildFullPrompt(targetLanguage, sourceLanguage, contextLines);
  return dispatch(provider, VLM_FULL_SYSTEM_PROMPT, userPrompt, image, model, temperature);
}

function dispatch(
  provider: VlmProvider,
  systemPrompt: string,
  userPrompt: string,
  image: string,
  model: string | undefined,
  temperature: number,
): Promise<VlmBatchResult> {
  if (provider === 'ollama') {
    return translateBatchWithOllama(systemPrompt, userPrompt, image, model || DEFAULT_OLLAMA_MODEL, temperature);
  }
  if (provider === 'openai') {
    return translateBatchWithOpenAI(systemPrompt, userPrompt, image, model || DEFAULT_OPENAI_MODEL, temperature);
  }
  if (provider === 'gemini') {
    return translateBatchWithGemini(systemPrompt, userPrompt, image, model || DEFAULT_GEMINI_MODEL, temperature);
  }
  throw new Error(`VLM batch provider '${provider}' not implemented yet`);
}

// ============================================================================
// PROMPT
// ============================================================================

export function buildBatchPrompt(
  lines: VlmLineInput[],
  targetLanguage: string,
  sourceLanguage: string | undefined,
  contextLines: string[],
): string {
  const linesJson = JSON.stringify(
    lines.map(l => ({ id: l.id, text: l.text })),
    null,
    0,
  );

  let prompt = `Target language: ${targetLanguage}`;
  if (sourceLanguage) prompt += `\nSource language: ${sourceLanguage}`;
  prompt += `\nLines detected on screen (translate each, keep the id):\n${linesJson}`;
  prompt += appendContext(contextLines);
  prompt += `\n\nLook at the screenshot to understand who is speaking and what is visible, then return the JSON object.`;
  return prompt;
}

export function buildFullPrompt(
  targetLanguage: string,
  sourceLanguage: string | undefined,
  contextLines: string[],
): string {
  let prompt = `Target language: ${targetLanguage}`;
  if (sourceLanguage) prompt += `\nSource language: ${sourceLanguage}`;
  prompt += `\nDetect ALL readable text on the screenshot, then translate each block.`;
  prompt += appendContext(contextLines);
  prompt += `\n\nReturn the JSON object with normalized bounding boxes.`;
  return prompt;
}

function appendContext(contextLines: string[]): string {
  if (contextLines.length === 0) return '';
  const recent = contextLines.slice(-5).map((c, i) => `${i + 1}. ${c}`).join('\n');
  return `\n\nPrevious dialogue for narrative consistency:\n${recent}`;
}

// ============================================================================
// PROVIDER: OLLAMA
// ============================================================================

async function translateBatchWithOllama(
  systemPrompt: string,
  prompt: string,
  imageBase64: string,
  model: string,
  temperature: number,
): Promise<VlmBatchResult> {
  const cleanBase64 = stripDataUri(imageBase64);

  const body = {
    model,
    prompt: `${systemPrompt}\n\n${prompt}`,
    images: [cleanBase64],
    stream: false,
    format: 'json', // Ollama: forza output JSON valido
    options: { temperature },
  };

  const response = await ollamaFetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 60_000,
  });

  if (!response.ok) {
    throw new Error(`Ollama VLM batch error: ${response.status}`);
  }

  const data = await response.json();
  return parseVlmResponse(data.response);
}

// ============================================================================
// PROVIDER: OPENAI (GPT-4o vision, JSON mode)
// ============================================================================

async function translateBatchWithOpenAI(
  systemPrompt: string,
  prompt: string,
  imageBase64: string,
  model: string,
  temperature: number,
): Promise<VlmBatchResult> {
  const { getSecureKey } = await import('@/lib/secure-key-store');
  const apiKey = await getSecureKey('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const dataUrl = `data:image/jpeg;base64,${stripDataUri(imageBase64)}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      // JSON mode: garantisce che la risposta sia un oggetto JSON valido.
      response_format: { type: 'json_object' },
      temperature,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI VLM batch error: ${response.status}`);
  }

  const data = await response.json();
  return parseVlmResponse(data.choices?.[0]?.message?.content);
}

// ============================================================================
// PROVIDER: GEMINI (multimodale, JSON response)
// ============================================================================

async function translateBatchWithGemini(
  systemPrompt: string,
  prompt: string,
  imageBase64: string,
  model: string,
  temperature: number,
): Promise<VlmBatchResult> {
  const { getSecureKey } = await import('@/lib/secure-key-store');
  const apiKey = await getSecureKey('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `${systemPrompt}\n\n${prompt}` },
            { inline_data: { mime_type: 'image/jpeg', data: stripDataUri(imageBase64) } },
          ],
        }],
        generationConfig: {
          temperature,
          maxOutputTokens: 1500,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini VLM batch error: ${response.status}`);
  }

  const data = await response.json();
  return parseVlmResponse(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

// ============================================================================
// PARSING / VALIDAZIONE
// ============================================================================

/**
 * Estrae e valida il JSON prodotto dal modello. Tollerante a rumore attorno al JSON
 * (alcuni modelli aggiungono testo pur richiedendo `format: json`).
 */
export function parseVlmResponse(raw: unknown): VlmBatchResult {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? '');
  const jsonSlice = extractJsonObject(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch (err) {
    clientLogger.warn('[vlm-batch] JSON non parsabile dal modello', { err: String(err) });
    throw new Error('VLM returned invalid JSON');
  }

  const result = vlmBatchResultSchema.safeParse(parsed);
  if (!result.success) {
    clientLogger.warn('[vlm-batch] Output non conforme allo schema', {
      issues: result.error.issues.map(i => i.message),
    });
    throw new Error('VLM output failed schema validation');
  }

  return result.data;
}

/** Ritaglia il primo oggetto JSON bilanciato presente nel testo. */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return text.trim();
  return text.slice(start, end + 1);
}

function stripDataUri(base64: string): string {
  return base64.replace(/^data:image\/[^;]+;base64,/, '');
}

// ============================================================================
// DOWNSCALE (opzionale, riduce token/latenza)
// ============================================================================

/**
 * Riduce lo screenshot al lato lungo massimo indicato.
 * 1) Prova il comando nativo Rust `downscale_capture` (piu' veloce, disponibile in Tauri).
 * 2) Fallback sul canvas del browser/webview.
 * In ambienti senza nessuno dei due (SSR/test) e' un no-op che restituisce l'immagine originale.
 */
async function maybeDownscale(imageBase64: string, maxPx: number): Promise<string> {
  if (!maxPx || maxPx <= 0) return imageBase64;

  // 1) Comando nativo (Rust): crop/resize/JPEG piu' veloce del canvas, disponibile in Tauri.
  try {
    const { safeInvoke } = await import('@/lib/tauri-wrapper');
    const res = (await safeInvoke('downscale_capture', {
      imageBase64: stripDataUri(imageBase64),
      maxPx,
      quality: 80,
    })) as { imageData?: string } | null;
    if (res && res.imageData) return res.imageData;
  } catch {
    // Non in Tauri o comando non disponibile -> fallback canvas.
  }

  // 2) Fallback canvas (browser/webview).
  if (typeof document === 'undefined' || typeof Image === 'undefined') return imageBase64;

  try {
    const dataUri = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const img = await loadImage(dataUri);
    const longSide = Math.max(img.width, img.height);
    if (longSide <= maxPx) return imageBase64;

    const scale = maxPx / longSide;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageBase64;
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (err) {
    clientLogger.debug('[vlm-batch] downscale saltato', { err: String(err) });
    return imageBase64;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
