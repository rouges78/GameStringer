import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { secretsManager } from '@/lib/secrets-manager';

interface CompareRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  providers?: string[];
  context?: string;
  characterProfile?: CharacterProfile;
  apiKeys?: Record<string, string>;
}

interface CharacterProfile {
  name: string;
  personality: string; // es: "pirata sarcastico", "nobile formale", "bambino curioso"
  speechPatterns?: string[]; // es: ["usa molte esclamazioni", "parla in terza persona"]
  vocabulary?: string; // es: "arcaico", "moderno", "slang"
}

interface TranslationResult {
  provider: string;
  translatedText: string;
  confidence: number;
  suggestions: string[];
  qualityScore: QualityScore;
  latencyMs: number;
  error?: string;
}

interface QualityScore {
  overall: number; // 0-100
  fluency: number; // Naturalezza del testo
  accuracy: number; // Fedeltà al significato (stimata)
  consistency: number; // Coerenza terminologica
  style: number; // Adeguatezza al contesto gaming
  lengthRatio: number; // Rapporto lunghezza source/target
  details: string[];
}

interface CompareResponse {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  results: TranslationResult[];
  bestResult: TranslationResult | null;
  consensusTranslation: string | null;
  processingTimeMs: number;
}

// Provider disponibili per confronto
const AVAILABLE_PROVIDERS = ['openai', 'gemini', 'claude', 'deepseek', 'mistral', 'deepl', 'libre'];

export const POST = withErrorHandler(async function(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: CompareRequest = await request.json();
    const { 
      text, 
      targetLanguage, 
      sourceLanguage = 'auto', 
      providers = ['openai', 'gemini', 'claude'],
      context,
      characterProfile,
      apiKeys = {}
    } = body;

    if (!text || !targetLanguage) {
      throw new ValidationError('Missing required fields: text, targetLanguage');
    }

    // Filtra solo provider validi
    const validProviders = providers.filter(p => AVAILABLE_PROVIDERS.includes(p));
    
    if (validProviders.length === 0) {
      throw new ValidationError('No valid providers specified');
    }

    logger.info('Multi-LLM comparison started', 'COMPARE_API', {
      textLength: text.length,
      targetLanguage,
      providers: validProviders,
      hasCharacterProfile: !!characterProfile
    });

    await secretsManager.initialize();

    // Esegui traduzioni in parallelo
    const translationPromises = validProviders.map(provider => 
      translateWithProvider(provider, text, targetLanguage, sourceLanguage, context, characterProfile, apiKeys[provider])
    );

    const results = await Promise.allSettled(translationPromises);

    // Processa risultati
    const translationResults: TranslationResult[] = results.map((result, index) => {
      const provider = validProviders[index];
      
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          provider,
          translatedText: '',
          confidence: 0,
          suggestions: [],
          qualityScore: createEmptyQualityScore(),
          latencyMs: 0,
          error: result.reason?.message || 'Translation failed'
        };
      }
    });

    // Trova il miglior risultato
    const successfulResults = translationResults.filter(r => !r.error);
    const bestResult = successfulResults.length > 0
      ? successfulResults.reduce((best, current) => 
          current.qualityScore.overall > best.qualityScore.overall ? current : best
        )
      : null;

    // Calcola traduzione di consenso (se almeno 2 traduzioni simili)
    const consensusTranslation = findConsensusTranslation(successfulResults);

    const response: CompareResponse = {
      sourceText: text,
      sourceLanguage,
      targetLanguage,
      results: translationResults,
      bestResult,
      consensusTranslation,
      processingTimeMs: Date.now() - startTime
    };

    logger.info('Multi-LLM comparison completed', 'COMPARE_API', {
      successfulProviders: successfulResults.length,
      bestProvider: bestResult?.provider,
      processingTimeMs: response.processingTimeMs
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Multi-LLM comparison failed', 'COMPARE_API', { error });
    throw error;
  }
});

async function translateWithProvider(
  provider: string,
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  context?: string,
  characterProfile?: CharacterProfile,
  apiKey?: string
): Promise<TranslationResult> {
  const startTime = Date.now();
  
  try {
    // Costruisci prompt con character profile se presente
    const enhancedContext = buildEnhancedContext(context, characterProfile);
    
    // Chiama l'endpoint translate esistente
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3135'}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLanguage,
        sourceLanguage,
        provider,
        context: enhancedContext,
        apiKey
      })
    });

    if (!response.ok) {
      throw new Error(`Provider ${provider} returned ${response.status}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    // Calcola quality score
    const qualityScore = calculateQualityScore(text, data.translatedText, targetLanguage, characterProfile);

    return {
      provider,
      translatedText: data.translatedText,
      confidence: data.confidence || 0.8,
      suggestions: data.suggestions || [],
      qualityScore,
      latencyMs
    };

  } catch (error) {
    return {
      provider,
      translatedText: '',
      confidence: 0,
      suggestions: [],
      qualityScore: createEmptyQualityScore(),
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function buildEnhancedContext(context?: string, characterProfile?: CharacterProfile): string {
  const parts: string[] = [];
  
  if (context) {
    parts.push(context);
  }
  
  if (characterProfile) {
    parts.push(`\n[CHARACTER PROFILE]`);
    parts.push(`Name: ${characterProfile.name}`);
    parts.push(`Personality: ${characterProfile.personality}`);
    
    if (characterProfile.speechPatterns?.length) {
      parts.push(`Speech patterns: ${characterProfile.speechPatterns.join(', ')}`);
    }
    
    if (characterProfile.vocabulary) {
      parts.push(`Vocabulary style: ${characterProfile.vocabulary}`);
    }
    
    parts.push(`\nIMPORTANT: Maintain the character's voice and personality in the translation.`);
  }
  
  return parts.join('\n');
}

function calculateQualityScore(
  sourceText: string,
  translatedText: string,
  targetLanguage: string,
  characterProfile?: CharacterProfile
): QualityScore {
  const details: string[] = [];
  
  // 1. Fluency Score - basato su pattern linguistici
  const fluency = calculateFluencyScore(translatedText, targetLanguage, details);
  
  // 2. Accuracy Score - basato su lunghezza e preservazione elementi
  const accuracy = calculateAccuracyScore(sourceText, translatedText, details);
  
  // 3. Consistency Score - terminologia coerente
  const consistency = calculateConsistencyScore(translatedText, details);
  
  // 4. Style Score - appropriatezza per gaming
  const style = calculateStyleScore(translatedText, targetLanguage, details, characterProfile);
  
  // 5. Length Ratio
  const lengthRatio = translatedText.length / Math.max(sourceText.length, 1);
  
  // Overall score (weighted average)
  const overall = Math.round(
    fluency * 0.25 +
    accuracy * 0.30 +
    consistency * 0.20 +
    style * 0.25
  );
  
  return {
    overall,
    fluency,
    accuracy,
    consistency,
    style,
    lengthRatio,
    details
  };
}

function calculateFluencyScore(text: string, targetLanguage: string, details: string[]): number {
  let score = 80; // Base score
  
  // Penalizza testo troppo corto o vuoto
  if (text.length < 2) {
    details.push('⚠️ Testo troppo corto');
    return 0;
  }
  
  // Controlla punteggiatura corretta
  const hasProperPunctuation = /[.!?]$/.test(text.trim()) || text.length < 20;
  if (!hasProperPunctuation && text.length > 20) {
    score -= 5;
    details.push('⚠️ Manca punteggiatura finale');
  }
  
  // Controlla spazi multipli
  if (/\s{2,}/.test(text)) {
    score -= 5;
    details.push('⚠️ Spazi multipli rilevati');
  }
  
  // Controlla caratteri strani
  if (/[^\w\s\p{P}\p{L}]/u.test(text.replace(/[\n\r]/g, ''))) {
    score -= 10;
    details.push('⚠️ Caratteri non standard rilevati');
  }
  
  // Bonus per frasi ben strutturate
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    const avgSentenceLength = text.length / sentences.length;
    if (avgSentenceLength > 10 && avgSentenceLength < 150) {
      score += 10;
      details.push('✓ Struttura frasi equilibrata');
    }
  }
  
  return Math.min(100, Math.max(0, score));
}

function calculateAccuracyScore(source: string, translated: string, details: string[]): number {
  let score = 75;
  
  // Controlla rapporto lunghezza (traduzioni troppo diverse sono sospette)
  const ratio = translated.length / Math.max(source.length, 1);
  
  if (ratio < 0.5) {
    score -= 20;
    details.push('⚠️ Traduzione molto più corta dell\'originale');
  } else if (ratio > 2.0) {
    score -= 15;
    details.push('⚠️ Traduzione molto più lunga dell\'originale');
  } else if (ratio >= 0.8 && ratio <= 1.5) {
    score += 15;
    details.push('✓ Lunghezza proporzionata');
  }
  
  // Verifica preservazione numeri
  const sourceNumbers: string[] = source.match(/\d+/g) || [];
  const translatedNumbers: string[] = translated.match(/\d+/g) || [];
  
  const numbersPreserved = sourceNumbers.every((n) => translatedNumbers.includes(n));
  if (sourceNumbers.length > 0) {
    if (numbersPreserved) {
      score += 10;
      details.push('✓ Numeri preservati');
    } else {
      score -= 10;
      details.push('⚠️ Alcuni numeri potrebbero essere cambiati');
    }
  }
  
  // Verifica preservazione variabili/placeholder
  const placeholders: string[] = source.match(/\{[^}]+\}|%[sdifx]|\$\w+/g) || [];
  const translatedPlaceholders: string[] = translated.match(/\{[^}]+\}|%[sdifx]|\$\w+/g) || [];
  
  if (placeholders.length > 0) {
    const preserved = placeholders.filter((p) => translatedPlaceholders.includes(p)).length;
    if (preserved === placeholders.length) {
      score += 10;
      details.push('✓ Placeholder preservati');
    } else {
      score -= 15;
      details.push(`⚠️ ${placeholders.length - preserved}/${placeholders.length} placeholder mancanti`);
    }
  }
  
  return Math.min(100, Math.max(0, score));
}

function calculateConsistencyScore(text: string, details: string[]): number {
  let score = 85;
  
  // Controlla maiuscole coerenti
  const words = text.split(/\s+/);
  const capitalizedWords = words.filter(w => /^[A-Z]/.test(w));
  
  // Se ci sono molte parole capitalizzate a caso nel mezzo delle frasi
  const midSentenceCapitals = text.match(/[a-z]\s+[A-Z][a-z]/g) || [];
  if (midSentenceCapitals.length > 2) {
    score -= 10;
    details.push('⚠️ Capitalizzazione inconsistente');
  }
  
  // Controlla ripetizioni eccessive
  const wordFreq: Record<string, number> = {};
  words.forEach(w => {
    const lower = w.toLowerCase();
    wordFreq[lower] = (wordFreq[lower] || 0) + 1;
  });
  
  const maxFreq = Math.max(...Object.values(wordFreq));
  if (maxFreq > 5 && words.length > 10) {
    score -= 5;
    details.push('⚠️ Possibili ripetizioni eccessive');
  }
  
  return Math.min(100, Math.max(0, score));
}

function calculateStyleScore(
  text: string, 
  targetLanguage: string, 
  details: string[],
  characterProfile?: CharacterProfile
): number {
  let score = 80;
  
  // Gaming terminology check (basic)
  const gamingTerms: Record<string, string[]> = {
    'it': ['livello', 'punti', 'vite', 'giocatore', 'missione', 'boss', 'inventario', 'abilità'],
    'en': ['level', 'points', 'lives', 'player', 'mission', 'boss', 'inventory', 'skills'],
    'de': ['level', 'punkte', 'leben', 'spieler', 'mission', 'boss', 'inventar', 'fähigkeiten'],
    'es': ['nivel', 'puntos', 'vidas', 'jugador', 'misión', 'jefe', 'inventario', 'habilidades'],
    'fr': ['niveau', 'points', 'vies', 'joueur', 'mission', 'boss', 'inventaire', 'compétences']
  };
  
  const terms = gamingTerms[targetLanguage] || gamingTerms['en'];
  const hasGamingTerms = terms.some(term => text.toLowerCase().includes(term));
  
  if (hasGamingTerms) {
    score += 10;
    details.push('✓ Terminologia gaming appropriata');
  }
  
  // Character profile adherence
  if (characterProfile) {
    // Check for personality markers (basic heuristics)
    const lowerText = text.toLowerCase();
    
    if (characterProfile.personality.includes('sarcastico') || characterProfile.personality.includes('sarcastic')) {
      if (lowerText.includes('!') || lowerText.includes('?')) {
        score += 5;
        details.push('✓ Tono sarcastico rilevato');
      }
    }
    
    if (characterProfile.personality.includes('formale') || characterProfile.personality.includes('formal')) {
      if (!lowerText.includes('!') && /\b(lei|voi|ella|usted|vous|sie)\b/i.test(text)) {
        score += 5;
        details.push('✓ Registro formale rispettato');
      }
    }
    
    if (characterProfile.vocabulary === 'arcaico' || characterProfile.vocabulary === 'archaic') {
      // Bonus se usa termini arcaici
      if (/\b(dunque|orsù|invero|forsanche|cotesto)\b/i.test(text)) {
        score += 10;
        details.push('✓ Vocabolario arcaico presente');
      }
    }
  }
  
  return Math.min(100, Math.max(0, score));
}

function createEmptyQualityScore(): QualityScore {
  return {
    overall: 0,
    fluency: 0,
    accuracy: 0,
    consistency: 0,
    style: 0,
    lengthRatio: 0,
    details: ['❌ Traduzione non disponibile']
  };
}

function findConsensusTranslation(results: TranslationResult[]): string | null {
  if (results.length < 2) return null;
  
  // Trova traduzioni simili (Levenshtein distance < 20% della lunghezza)
  const translations = results.map(r => r.translatedText.toLowerCase().trim());
  
  for (let i = 0; i < translations.length; i++) {
    for (let j = i + 1; j < translations.length; j++) {
      const similarity = calculateSimilarity(translations[i], translations[j]);
      if (similarity > 0.8) {
        // Restituisci quella con quality score più alto
        return results[i].qualityScore.overall >= results[j].qualityScore.overall
          ? results[i].translatedText
          : results[j].translatedText;
      }
    }
  }
  
  return null;
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  // Simple word overlap similarity
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  
  return intersection / union; // Jaccard similarity
}

// GET endpoint per info
export async function GET() {
  return NextResponse.json({
    message: 'Multi-LLM Translation Comparison API',
    availableProviders: AVAILABLE_PROVIDERS,
    usage: {
      method: 'POST',
      body: {
        text: 'string (required)',
        targetLanguage: 'string (required)',
        sourceLanguage: 'string (optional, default: auto)',
        providers: 'string[] (optional, default: [openai, gemini, claude])',
        context: 'string (optional)',
        characterProfile: {
          name: 'string',
          personality: 'string (es: pirata sarcastico)',
          speechPatterns: 'string[] (optional)',
          vocabulary: 'string (optional: arcaico, moderno, slang)'
        },
        apiKeys: 'Record<provider, apiKey> (optional)'
      }
    },
    qualityMetrics: ['fluency', 'accuracy', 'consistency', 'style', 'lengthRatio']
  });
}
