/**
 * # Language Detection
 * 
 * Sistema di rilevamento automatico della lingua del testo.
 * Usa pattern comuni e caratteri specifici per ogni lingua.
 */

export interface DetectionResult {
  language: string;
  confidence: number;
  alternatives: { language: string; confidence: number }[];
}

// Caratteri e pattern specifici per lingua
const LANGUAGE_PATTERNS: Record<string, {
  chars: RegExp;
  words: string[];
  weight: number;
}> = {
  // Asiatiche
  ja: {
    chars: /[\u3040-\u309F\u30A0-\u30FF]/,  // Hiragana + Katakana
    words: ['の', 'は', 'を', 'に', 'が', 'で', 'と', 'も', 'な', 'です', 'ます'],
    weight: 1.5,
  },
  zh: {
    chars: /[\u4E00-\u9FFF]/,  // CJK Unified
    words: ['的', '是', '不', '了', '在', '有', '这', '我', '他', '你'],
    weight: 1.2,
  },
  ko: {
    chars: /[\uAC00-\uD7AF\u1100-\u11FF]/,  // Hangul
    words: ['은', '는', '이', '가', '을', '를', '에', '의', '와', '과'],
    weight: 1.5,
  },
  
  // Cirilliche
  ru: {
    chars: /[\u0400-\u04FF]/,  // Cyrillic
    words: ['и', 'в', 'не', 'на', 'что', 'он', 'с', 'как', 'это', 'по'],
    weight: 1.3,
  },
  
  // Arabe
  ar: {
    chars: /[\u0600-\u06FF]/,  // Arabic
    words: ['من', 'في', 'على', 'إلى', 'أن', 'هذا', 'ما', 'لا', 'كان'],
    weight: 1.4,
  },
  
  // Thai
  th: {
    chars: /[\u0E00-\u0E7F]/,  // Thai
    words: ['ที่', 'และ', 'ใน', 'เป็น', 'ได้', 'จะ', 'มี', 'การ'],
    weight: 1.5,
  },
  
  // Europee (Latin-based)
  en: {
    chars: /[a-zA-Z]/,
    words: ['the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'with', 'as', 'his', 'they', 'be'],
    weight: 1.0,
  },
  it: {
    chars: /[a-zA-ZàèéìòùÀÈÉÌÒÙ]/,
    words: ['il', 'la', 'di', 'che', 'è', 'un', 'per', 'non', 'sono', 'da', 'una', 'del', 'con', 'le', 'si', 'dei', 'questo', 'anche', 'come', 'più'],
    weight: 1.1,
  },
  de: {
    chars: /[a-zA-ZäöüßÄÖÜ]/,
    words: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als'],
    weight: 1.1,
  },
  fr: {
    chars: /[a-zA-ZàâäéèêëîïôùûüÿçœæÀÂÄÉÈÊËÎÏÔÙÛÜŸÇŒÆ]/,
    words: ['le', 'la', 'de', 'et', 'les', 'des', 'en', 'un', 'du', 'une', 'que', 'est', 'pour', 'qui', 'dans', 'ce', 'il', 'pas', 'plus', 'par'],
    weight: 1.1,
  },
  es: {
    chars: /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ¿¡]/,
    words: ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'es'],
    weight: 1.1,
  },
  pt: {
    chars: /[a-zA-ZáàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/,
    words: ['de', 'que', 'e', 'o', 'a', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais'],
    weight: 1.1,
  },
  pl: {
    chars: /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/,
    words: ['i', 'w', 'nie', 'na', 'do', 'to', 'że', 'się', 'z', 'jest', 'po', 'co', 'tak', 'jak', 'za', 'ale', 'od', 'o', 'czy'],
    weight: 1.2,
  },
  nl: {
    chars: /[a-zA-Z]/,
    words: ['de', 'het', 'een', 'van', 'en', 'in', 'is', 'dat', 'op', 'te', 'zijn', 'voor', 'met', 'niet', 'aan', 'er', 'maar', 'om', 'ook'],
    weight: 1.1,
  },
  tr: {
    chars: /[a-zA-ZçğıöşüÇĞİÖŞÜ]/,
    words: ['bir', 've', 'bu', 'için', 'da', 'de', 'ile', 'ne', 'var', 'daha', 'ben', 'o', 'mi', 'ki', 'gibi', 'çok', 'kadar', 'ama'],
    weight: 1.2,
  },
};

// Nomi lingua per display
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  it: 'Italiano',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  ru: 'Русский',
  ar: 'العربية',
  th: 'ไทย',
  pl: 'Polski',
  nl: 'Nederlands',
  tr: 'Türkçe',
};

/**
 * Rileva la lingua di un testo.
 */
export function detectLanguage(text: string): DetectionResult {
  if (!text || text.trim().length === 0) {
    return { language: 'en', confidence: 0, alternatives: [] };
  }

  const scores: Record<string, number> = {};
  const cleanText = text.toLowerCase();
  const words = cleanText.split(/\s+/).filter(w => w.length > 1);
  const totalChars = cleanText.replace(/\s/g, '').length;

  // Calcola score per ogni lingua
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    let score = 0;

    // Score basato su caratteri specifici
    const charMatches = (cleanText.match(pattern.chars) || []).length;
    const charRatio = charMatches / totalChars;
    score += charRatio * 50 * pattern.weight;

    // Score basato su parole comuni
    let wordMatches = 0;
    for (const word of pattern.words) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = (cleanText.match(regex) || []).length;
      wordMatches += matches;
    }
    const wordRatio = wordMatches / Math.max(words.length, 1);
    score += wordRatio * 50 * pattern.weight;

    scores[lang] = Math.min(score, 100);
  }

  // Ordina per score
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0);

  if (sorted.length === 0) {
    return { language: 'en', confidence: 0, alternatives: [] };
  }

  const [bestLang, bestScore] = sorted[0];
  const alternatives = sorted.slice(1, 4).map(([lang, score]) => ({
    language: lang,
    confidence: Math.round(score),
  }));

  return {
    language: bestLang,
    confidence: Math.round(bestScore),
    alternatives,
  };
}

/**
 * Rileva lingua con API esterna (più accurato).
 * Fallback a detection locale se API non disponibile.
 */
export async function detectLanguageWithAPI(text: string): Promise<DetectionResult> {
  // Prima prova detection locale per lingue con caratteri distintivi
  const localResult = detectLanguage(text);
  
  // Se confidence alta per lingue non-latine, usa risultato locale
  if (localResult.confidence > 70 && ['ja', 'zh', 'ko', 'ru', 'ar', 'th'].includes(localResult.language)) {
    return localResult;
  }

  // Per lingue latine, tenta API se disponibile
  try {
    const response = await fetch('/api/detect-language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 500) }), // Max 500 chars
    });

    if (response.ok) {
      const data = await response.json();
      if (data.language) {
        return {
          language: data.language,
          confidence: data.confidence || 90,
          alternatives: data.alternatives || [],
        };
      }
    }
  } catch (e) {
    // API non disponibile, usa fallback locale
  }

  return localResult;
}

/**
 * Ottieni il nome della lingua dal codice.
 */
export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

/**
 * Ottieni tutti i codici lingua supportati.
 */
export function getSupportedLanguages(): { code: string; name: string }[] {
  return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name }));
}
