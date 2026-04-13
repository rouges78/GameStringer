import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import fs from 'fs';
import path from 'path';

// ── Character Voice Profile (mirrored from lib/character-voice-ai.ts) ──
interface CharacterVoiceProfile {
  id: string;
  name: string;
  archetype: string;
  traits: string[];
  mood: string;
  formality: string;
  vocabulary: string;
  catchphrases: string[];
  preferredWords: Record<string, string>;
  avoidWords: string[];
  exampleDialogues: Array<{ original: string; translated: string }>;
}

// In-memory progress tracking per game directory
const progressMap = new Map<string, {
  total: number;
  done: number;
  errors: number;
  currentText: string;
  currentCharacter: string;
  rate: number;
  eta: number;
  status: 'running' | 'done' | 'error';
  _createdAt: number;
}>();

// Cleanup completed/stale entries every 10 minutes (TTL: 30 min)
const PROGRESS_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of progressMap) {
    if (entry.status !== 'running' && now - entry._createdAt > PROGRESS_TTL_MS) {
      progressMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

// progressMap is used internally and by other modules that import from this file
// Next.js route files only allow HTTP method exports, so we expose it via a getter
export function getProgressMap() { return progressMap; }

export const POST = withErrorHandler(async function(req: NextRequest) {
  const { gameDir, targetLang = 'it', model = 'huihui_ai/hy-mt1.5-abliterated:7b', characterProfiles = [] } = await req.json();

  if (!gameDir) {
    return NextResponse.json({ error: 'gameDir richiesto' }, { status: 400 });
  }

  const gsDir = path.join(gameDir, '_gamestringer');
  const stringsPath = path.join(gsDir, 'extracted_strings.json');
  const translationsPath = path.join(gsDir, 'translations.json');
  const progressPath = path.join(gsDir, 'translate_progress.json');

  if (!fs.existsSync(stringsPath)) {
    return NextResponse.json({ error: 'Stringhe non estratte. Esegui prima l\'estrazione.' }, { status: 400 });
  }

  const strings: string[] = JSON.parse(fs.readFileSync(stringsPath, 'utf-8'));

  // Load existing translations
  let translations: Record<string, string> = {};
  if (fs.existsSync(translationsPath)) {
    translations = JSON.parse(fs.readFileSync(translationsPath, 'utf-8'));
  }

  const remaining = strings.filter(s => !translations[s]);
  const total = remaining.length;

  if (total === 0) {
    return NextResponse.json({ total: 0, message: 'Tutte le stringhe sono già tradotte' });
  }

  // Initialize progress
  const progress = { total, done: 0, errors: 0, currentText: '', currentCharacter: '', rate: 0, eta: 0, status: 'running' as const, _createdAt: Date.now() };
  progressMap.set(gameDir, progress);

  // Start translation in background
  translateInBackground(remaining, translations, translationsPath, progressPath, gameDir, targetLang, model, characterProfiles);

  return NextResponse.json({ total, alreadyTranslated: strings.length - total });
});

const LANG_NAMES: Record<string, string> = {
  it: 'Italian', es: 'Spanish', de: 'German', fr: 'French',
  pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  ru: 'Russian', pl: 'Polish',
};

// ── Text Type Detection ──────────────────────────────────────
type TextType = 'dialogue' | 'narration' | 'action' | 'system';

function detectTextType(text: string): TextType {
  // Dialogo: inizia con virgolette o contiene discorso diretto
  if (/^["']/.test(text) || /^\\"/.test(text) || text.includes('" ')) return 'dialogue';
  // Narrazione: corsivo HTML o descrizione in terza persona
  if (text.startsWith('<i>') || text.startsWith('<em>')) return 'narration';
  // Azione: parentesi tonde per stage directions
  if (/^\(/.test(text)) return 'action';
  // Sistema: tutto maiuscolo, variabili, tags
  if (/^[A-Z_]{3,}/.test(text) || text.includes('{') || text.includes('DC')) return 'system';
  // Default: dialogo se contiene punteggiatura espressiva, altrimenti narrazione
  if (/[!?]"?$/.test(text) || text.includes('...')) return 'dialogue';
  return 'narration';
}

function detectSpeaker(text: string): string | null {
  // Pattern comuni nei giochi Ink per identificare il parlante
  // Es: "He says, \"..." → detect "He"
  // Es: testo che inizia con un nome seguito da due punti
  const colonMatch = text.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?):\s/);
  if (colonMatch) return colonMatch[1];
  return null;
}

function matchProfileToText(
  text: string,
  textType: TextType,
  profiles: CharacterVoiceProfile[]
): CharacterVoiceProfile | null {
  if (profiles.length === 0) return null;

  const speaker = detectSpeaker(text);
  if (speaker) {
    const match = profiles.find(p =>
      p.name.toLowerCase() === speaker.toLowerCase()
    );
    if (match) return match;
  }

  // Match per tipo di testo → archetipo appropriato
  if (textType === 'narration') {
    return profiles.find(p => p.archetype === 'narrator') || null;
  }

  // Per dialoghi senza speaker identificato, usa il profilo generico se disponibile
  return null;
}

// ── Background Translation Worker ────────────────────────────
async function translateInBackground(
  remaining: string[],
  translations: Record<string, string>,
  translationsPath: string,
  progressPath: string,
  gameDir: string,
  targetLang: string,
  model: string,
  characterProfiles: CharacterVoiceProfile[] = []
) {
  const progress = progressMap.get(gameDir)!;
  const startTime = Date.now();
  const langName = LANG_NAMES[targetLang] || 'Italian';

  for (let i = 0; i < remaining.length; i++) {
    const text = remaining[i];
    progress.currentText = text.substring(0, 80);

    try {
      const textType = detectTextType(text);
      const profile = matchProfileToText(text, textType, characterProfiles);
      progress.currentCharacter = profile?.name || (textType === 'narration' ? '📖 Narratore' : '');

      let result = '';

      // Simple prompt that works with specialized translation models (hy-mt, translategemma)
      const prompt = `<|im_start|>user\nTranslate the following text from English to ${langName}.\nEnglish: ${text}\n${langName}:<|im_end|>\n<|im_start|>assistant\n`;

      const resp = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { temperature: profile ? 0.4 : 0.3, num_predict: 512 }
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (resp.ok) {
        const data = await resp.json();
        result = (data.response || '').trim();
      }

      // Clean up result
      result = result.replace(/^["']|["']$/g, '').trim();
      if (result.toLowerCase().startsWith(`${langName.toLowerCase()}:`)) {
        result = result.substring(langName.length + 1).trim();
      }
      // Remove common LLM artifacts
      result = result
        .replace(/^(Here'?s? the translation:?\s*)/i, '')
        .replace(/^(Translation:?\s*)/i, '')
        .replace(/^(Traduzione:?\s*)/i, '')
        .trim();

      if (result && result.length > 1) {
        // Apply preferred word substitutions from profile
        if (profile && Object.keys(profile.preferredWords).length > 0) {
          for (const [from, to] of Object.entries(profile.preferredWords)) {
            const regex = new RegExp(`\\b${from}\\b`, 'gi');
            result = result.replace(regex, to);
          }
        }
        translations[text] = result;
        progress.done++;
      } else {
        progress.errors++;
      }
    } catch {
      progress.errors++;
    }

    // Update rate & ETA
    const elapsed = (Date.now() - startTime) / 1000;
    progress.rate = elapsed > 0 ? progress.done / elapsed : 0;
    progress.eta = progress.rate > 0 ? (remaining.length - i - 1) / progress.rate / 60 : 0;

    // Save progress every 50 strings
    if ((i + 1) % 50 === 0 || i === remaining.length - 1) {
      try {
        fs.writeFileSync(translationsPath, JSON.stringify(translations, null, 2), 'utf-8');
        fs.writeFileSync(progressPath, JSON.stringify({
          total: progress.total,
          done: progress.done,
          errors: progress.errors,
          rate: progress.rate,
          eta: progress.eta,
          status: progress.status,
          currentCharacter: progress.currentCharacter,
        }), 'utf-8');
      } catch { /* ignore write errors */ }
    }
  }

  // Final save
  progress.status = progress.errors > remaining.length / 2 ? 'error' : 'done';
  progressMap.set(gameDir, progress);

  try {
    fs.writeFileSync(translationsPath, JSON.stringify(translations, null, 2), 'utf-8');
    fs.writeFileSync(progressPath, JSON.stringify({ ...progress, currentText: '' }), 'utf-8');
  } catch { /* ignore */ }
}
