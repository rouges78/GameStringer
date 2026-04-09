/**
 * Vision LLM Translation — Usa modelli multimodali (Llama 3.2 Vision, LLaVA, GPT-4V)
 * per tradurre testo con contesto visivo dallo screenshot del gioco.
 * 
 * Risolve il problema storico: "Chest" = forziere o petto? L'IA VEDE lo schermo.
 */

export interface VisionTranslateOptions {
  text: string;
  targetLanguage: string;
  screenshotBase64?: string;
  context?: string[];
  model?: string;
  provider?: 'ollama' | 'openai' | 'gemini';
}

export interface VisionTranslateResult {
  translated: string;
  confidence: number;
  visualContext: string;
  disambiguation?: string;
}

const VISION_SYSTEM_PROMPT = `You are a game translation expert with visual context. You can SEE the game screen.
Rules:
- Translate the given text accurately using the screenshot as context
- Use the visual scene to disambiguate words (e.g., "Chest" = treasure chest if you see a box, or body part if you see a character)
- Detect speaker gender from character models visible on screen
- Maintain consistent tone based on the visual atmosphere (dark dungeon = serious, colorful town = casual)
- Return ONLY the translated text, nothing else`;

/**
 * Traduce testo usando un Vision LLM con screenshot contestuale
 */
export async function visionTranslate(opts: VisionTranslateOptions): Promise<VisionTranslateResult> {
  const { text, targetLanguage, screenshotBase64, context = [], model, provider = 'ollama' } = opts;

  const userPrompt = buildPrompt(text, targetLanguage, context);

  if (provider === 'ollama') {
    return translateWithOllamaVision(userPrompt, screenshotBase64, model || 'llava:13b');
  } else if (provider === 'openai') {
    return translateWithOpenAIVision(userPrompt, screenshotBase64);
  } else if (provider === 'gemini') {
    return translateWithGeminiVision(userPrompt, screenshotBase64);
  }

  throw new Error(`Vision provider '${provider}' not supported`);
}

function buildPrompt(text: string, targetLanguage: string, context: string[]): string {
  let prompt = `Translate to ${targetLanguage}: "${text}"`;
  if (context.length > 0) {
    prompt += `\nPrevious dialogue lines for context:\n${context.slice(-5).map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
  }
  prompt += `\nLook at the screenshot to understand the scene. Who is speaking? What objects are visible? Use this visual context to translate accurately.`;
  return prompt;
}

/**
 * Ollama Vision (llava, llama3.2-vision, bakllava, etc.)
 */
async function translateWithOllamaVision(
  prompt: string, 
  imageBase64?: string,
  model: string = 'llava:13b'
): Promise<VisionTranslateResult> {
  const body: Record<string, unknown> = {
    model,
    prompt: `${VISION_SYSTEM_PROMPT}\n\n${prompt}`,
    stream: false,
    options: { temperature: 0.3 }
  };

  if (imageBase64) {
    // Rimuovi prefix data:image/...;base64, se presente
    const cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
    body.images = [cleanBase64];
  }

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Ollama Vision error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const translated = (data.response || '').trim().replace(/^["']|["']$/g, '');

  return {
    translated,
    confidence: imageBase64 ? 0.95 : 0.8,
    visualContext: imageBase64 ? 'Screenshot analyzed' : 'No screenshot provided',
    disambiguation: imageBase64 ? 'Visual context used for disambiguation' : undefined,
  };
}

/**
 * OpenAI GPT-4 Vision
 */
async function translateWithOpenAIVision(
  prompt: string, 
  imageBase64?: string
): Promise<VisionTranslateResult> {
  const { getSecureKey } = await import('@/lib/secure-key-store');
  const apiKey = await getSecureKey('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const messages: unknown[] = [
    { role: 'system', content: VISION_SYSTEM_PROMPT },
  ];

  if (imageBase64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64.replace(/^data:image\/[^;]+;base64,/, '')}` } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI Vision error: ${response.status}`);
  const data = await response.json();
  const translated = (data.choices?.[0]?.message?.content || '').trim();

  return {
    translated,
    confidence: 0.95,
    visualContext: imageBase64 ? 'GPT-4V analyzed screenshot' : 'Text-only translation',
  };
}

/**
 * Google Gemini Vision
 */
async function translateWithGeminiVision(
  prompt: string, 
  imageBase64?: string
): Promise<VisionTranslateResult> {
  const { getSecureKey } = await import('@/lib/secure-key-store');
  const apiKey = await getSecureKey('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not configured');

  const parts: unknown[] = [{ text: `${VISION_SYSTEM_PROMPT}\n\n${prompt}` }];
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: imageBase64.replace(/^data:image\/[^;]+;base64,/, ''),
      }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini Vision error: ${response.status}`);
  const data = await response.json();
  const translated = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

  return {
    translated,
    confidence: 0.93,
    visualContext: imageBase64 ? 'Gemini analyzed screenshot' : 'Text-only translation',
  };
}

/**
 * Cattura screenshot dalla finestra del gioco (wrapper per Tauri command)
 */
export async function captureGameScreenshot(): Promise<string | null> {
  try {
    const { invoke } = await import('@/lib/tauri-wrapper');
    const result = await invoke('capture_screen') as string;
    return result || null;
  } catch {
    // Fallback: canvas capture se disponibile
    return null;
  }
}

/**
 * Lista modelli Vision disponibili su Ollama
 */
export async function getAvailableVisionModels(): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) return [];
    const data = await response.json();
    const models = data.models || [];
    return models
      .map((m: { name: string }) => m.name as string)
      .filter((name: string) => 
        name.includes('llava') || 
        name.includes('vision') || 
        name.includes('bakllava') ||
        name.includes('moondream') ||
        name.includes('llama3.2')
      );
  } catch {
    return [];
  }
}
