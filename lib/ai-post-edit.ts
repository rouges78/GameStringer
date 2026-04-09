/**
 * AI Post-Editing Assistant
 * 
 * Suggerisce miglioramenti per traduzioni già fatte, usando il contesto del genere,
 * quality score e istruzioni specifiche per il tipo di testo.
 */

import { getGenreConfig, type GameGenre } from './genre-prompts';
import { clientLogger } from '@/lib/client-logger';

export interface PostEditSuggestion {
  improved: string;
  reason: string;
  confidence: number; // 0-100: quanto l'AI è sicura che il miglioramento sia valido
  changes: PostEditChange[];
}

export interface PostEditChange {
  type: 'tone' | 'accuracy' | 'fluency' | 'terminology' | 'style' | 'ambiguity' | 'formatting';
  description: string;
}

export interface PostEditRequest {
  original: string;
  translation: string;
  targetLang: string;
  sourceLang?: string;
  genre?: GameGenre;
  context?: string; // testo precedente/successivo per contesto
  qaScore?: number;
  qaIssues?: string[];
}

/**
 * Costruisce il prompt per il post-editing assistito.
 */
function buildPostEditPrompt(req: PostEditRequest): string {
  const langMap: Record<string, string> = {
    it: 'Italian', de: 'German', es: 'Spanish', fr: 'French',
    pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ru: 'Russian', en: 'English',
  };
  const tgtName = langMap[req.targetLang] || req.targetLang;
  const srcName = langMap[req.sourceLang || 'en'] || 'English';

  const parts: string[] = [];

  parts.push(`You are a professional game translation reviewer and post-editor.
Your task: review a ${srcName} → ${tgtName} translation and suggest improvements.`);

  // Istruzioni genere-specifiche
  if (req.genre && req.genre !== 'generic') {
    const config = getGenreConfig(req.genre);
    parts.push(`\nGENRE: ${config.label}`);
    parts.push(config.styleDirective);
  }

  // Problemi QA noti
  if (req.qaIssues && req.qaIssues.length > 0) {
    parts.push(`\nKNOWN ISSUES with this translation:\n${req.qaIssues.map(i => `- ${i}`).join('\n')}`);
  }
  if (req.qaScore !== undefined) {
    parts.push(`Current QA score: ${req.qaScore}/100`);
  }

  // Contesto
  if (req.context) {
    parts.push(`\nSurrounding context: ${req.context}`);
  }

  parts.push(`\nOriginal (${srcName}): ${req.original}
Current translation (${tgtName}): ${req.translation}

Analyze the translation and respond in this EXACT JSON format:
{
  "improved": "your improved translation here (or same if already good)",
  "reason": "brief explanation of changes in ${tgtName}",
  "confidence": 85,
  "changes": [
    {"type": "tone", "description": "brief description"}
  ]
}

RULES:
- If the translation is already good, return it unchanged with confidence 95+ and empty changes
- "type" must be one of: tone, accuracy, fluency, terminology, style, ambiguity, formatting
- Keep proper nouns unchanged
- Preserve ALL formatting (line breaks, ellipsis, tags, placeholders)
- "reason" should be in ${tgtName} so the user understands
- Be conservative: only suggest changes that genuinely improve the translation
- Return ONLY the JSON, nothing else`);

  return parts.join('\n');
}

/**
 * Chiede all'AI di suggerire un miglioramento per una traduzione.
 * Usa Ollama locale o provider API a seconda della disponibilità.
 */
export async function suggestImprovement(req: PostEditRequest): Promise<PostEditSuggestion> {
  const prompt = buildPostEditPrompt(req);

  // Prova Ollama locale prima
  try {
    const ollamaModel = getOllamaModel();
    if (ollamaModel) {
      const resp = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 2048 },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const result = parsePostEditResponse(data.response || '');
        if (result) return result;
      }
    }
  } catch (e: unknown) {
    clientLogger.warn('[PostEdit] Ollama non disponibile:', e);
  }

  // Fallback: Gemini API
  try {
    const geminiKey = getGeminiKey();
    if (geminiKey) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const result = parsePostEditResponse(text);
        if (result) return result;
      }
    }
  } catch (e: unknown) {
    clientLogger.warn('[PostEdit] Gemini non disponibile:', e);
  }

  // Nessun provider disponibile
  throw new Error('Nessun provider AI disponibile per il post-editing');
}

/**
 * Suggerisce miglioramenti per un batch di traduzioni.
 * Ritorna solo quelle che hanno effettivamente cambiamenti.
 */
export async function suggestBatchImprovements(
  items: PostEditRequest[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, PostEditSuggestion>> {
  const results = new Map<number, PostEditSuggestion>();

  for (let i = 0; i < items.length; i++) {
    onProgress?.(i, items.length);
    try {
      const suggestion = await suggestImprovement(items[i]);
      // Solo se ha cambiamenti reali
      if (suggestion.changes.length > 0 && suggestion.improved !== items[i].translation) {
        results.set(i, suggestion);
      }
    } catch (e: unknown) {
      clientLogger.warn(`[PostEdit] Errore su item ${i}:`, e);
    }
  }

  onProgress?.(items.length, items.length);
  return results;
}

// ─── HELPERS ─────────────────────────────────────────────────────

function parsePostEditResponse(raw: string): PostEditSuggestion | null {
  try {
    // Cerca JSON nel testo (potrebbe esserci testo prima/dopo)
    const jsonMatch = raw.match(/\{[\s\S]*"improved"[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.improved) return null;

    return {
      improved: String(parsed.improved).trim(),
      reason: String(parsed.reason || '').trim(),
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 70)),
      changes: Array.isArray(parsed.changes)
        ? parsed.changes.map((c: Record<string, unknown>) => ({
            type: String(c.type || 'fluency') as PostEditChange['type'],
            description: String(c.description || ''),
          }))
        : [],
    };
  } catch {
    // Se il JSON parsing fallisce, prova a estrarre la traduzione migliorata dal testo
    const improvedMatch = raw.match(/"improved"\s*:\s*"([^"]+)"/);
    if (improvedMatch) {
      return {
        improved: improvedMatch[1],
        reason: 'Suggerimento AI',
        confidence: 60,
        changes: [{ type: 'fluency', description: 'Miglioramento automatico' }],
      };
    }
    return null;
  }
}

function getOllamaModel(): string {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    return settings?.translation?.ollamaModel || '';
  } catch {
    return '';
  }
}

function getGeminiKey(): string {
  try {
    const settings = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
    return settings?.translation?.apiKey || '';
  } catch {
    return '';
  }
}
