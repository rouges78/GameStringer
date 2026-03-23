import { NextRequest, NextResponse } from 'next/server';
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
}>();

export { progressMap };

export async function POST(req: NextRequest) {
  try {
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
    const progress = { total, done: 0, errors: 0, currentText: '', currentCharacter: '', rate: 0, eta: 0, status: 'running' as const };
    progressMap.set(gameDir, progress);

    // Start translation in background
    translateInBackground(remaining, translations, translationsPath, progressPath, gameDir, targetLang, model, characterProfiles);

    return NextResponse.json({ total, alreadyTranslated: strings.length - total });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

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

// ── Character-Aware Prompt Builder ───────────────────────────
function buildCharacterPrompt(
  text: string,
  langName: string,
  profile: CharacterVoiceProfile | null,
  textType: TextType
): string {
  if (!profile) {
    // Prompt base migliorato con context tipo testo
    const typeHint = textType === 'dialogue' ? 'This is character dialogue.' 
      : textType === 'narration' ? 'This is narrative/descriptive text.'
      : textType === 'action' ? 'This is a stage direction or action.'
      : 'This is a game system text.';
    
    return `You are an expert video game translator. ${typeHint}
Translate the following text from English to ${langName}.
Maintain the original tone, style, and any HTML/formatting tags.
Respond ONLY with the translation, no explanations.

English: ${text}
${langName}:`;
  }

  // Character-aware prompt
  let prompt = `You are an expert video game translator with deep understanding of character voices.

CHARACTER PROFILE: ${profile.name}
- Archetype: ${profile.archetype}
- Personality traits: ${profile.traits.join(', ')}
- Mood: ${profile.mood}
- Formality: ${profile.formality}
- Vocabulary style: ${profile.vocabulary}`;

  if (profile.catchphrases.length > 0) {
    prompt += `\n- Catchphrases/patterns: ${profile.catchphrases.join(', ')}`;
  }
  
  if (profile.avoidWords.length > 0) {
    prompt += `\n- Words to AVOID: ${profile.avoidWords.join(', ')}`;
  }
  
  if (Object.keys(profile.preferredWords).length > 0) {
    prompt += `\n- Preferred word substitutions:`;
    for (const [from, to] of Object.entries(profile.preferredWords)) {
      prompt += `\n  "${from}" → "${to}"`;
    }
  }

  if (profile.exampleDialogues.length > 0) {
    prompt += `\n\nTRANSLATION EXAMPLES for this character:`;
    for (const ex of profile.exampleDialogues.slice(0, 3)) {
      prompt += `\n  "${ex.original}" → "${ex.translated}"`;
    }
  }

  prompt += `\n\nTRANSLATION RULES:
- Maintain the character's voice and personality in ${langName}
- Keep HTML tags and formatting intact
- Preserve punctuation style (ellipsis, exclamation marks, etc.)
- Match the character's formality level
- Respond ONLY with the translation, no explanations

English: ${text}
${langName}:`;

  return prompt;
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
