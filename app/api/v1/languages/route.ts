import { NextResponse } from 'next/server';

/**
 * 🔌 GameStringer Public API v1 - Languages
 * 
 * GET /api/v1/languages
 * 
 * Returns list of supported languages with their codes.
 */

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  supported: {
    libre: boolean;
    gemini: boolean;
    openai: boolean;
    deepl: boolean;
  };
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺', supported: { libre: true, gemini: true, openai: true, deepl: true } },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', supported: { libre: true, gemini: true, openai: true, deepl: false } },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', supported: { libre: true, gemini: true, openai: true, deepl: false } },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', supported: { libre: true, gemini: true, openai: true, deepl: true } },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    count: LANGUAGES.length,
    languages: LANGUAGES,
    providers: ['libre', 'gemini', 'openai', 'deepl', 'claude', 'deepseek', 'mistral'],
    timestamp: new Date().toISOString()
  });
}
