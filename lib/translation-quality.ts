/**
 * Translation Quality Scoring System
 * Sistema avanzato per valutare la qualità delle traduzioni
 */

export interface QualityScore {
  overall: number;
  fluency: number;
  accuracy: number;
  consistency: number;
  style: number;
  lengthRatio: number;
  details: string[];
}

export interface CharacterProfile {
  id: string;
  name: string;
  personality: string;
  speechPatterns?: string[];
  vocabulary?: 'arcaico' | 'moderno' | 'slang' | 'tecnico' | 'bambino';
  tone?: 'formale' | 'informale' | 'neutro';
  examples?: { source: string; translation: string }[];
}

// Profili personaggio predefiniti
export const CHARACTER_PRESETS: Record<string, Omit<CharacterProfile, 'id' | 'name'>> = {
  'pirate': {
    personality: 'Pirata rozzo e sarcastico, usa espressioni marinaresche',
    speechPatterns: ['Arrr!', 'Per mille balene!', 'Ciurma di...'],
    vocabulary: 'slang',
    tone: 'informale'
  },
  'noble': {
    personality: 'Nobile aristocratico, parla in modo raffinato e distaccato',
    speechPatterns: ['Mi consenta di...', 'Ella comprenderà...', 'Invero...'],
    vocabulary: 'arcaico',
    tone: 'formale'
  },
  'child': {
    personality: 'Bambino curioso ed entusiasta, usa frasi semplici',
    speechPatterns: ['Wow!', 'Davvero?!', 'Ma perché...?'],
    vocabulary: 'bambino',
    tone: 'informale'
  },
  'robot': {
    personality: 'IA/Robot, parla in modo preciso e tecnico',
    speechPatterns: ['Analisi completata.', 'Probabilità:', 'Errore:'],
    vocabulary: 'tecnico',
    tone: 'neutro'
  },
  'warrior': {
    personality: 'Guerriero stoico, poche parole ma incisive',
    speechPatterns: ['...', 'Hmph.', 'Per l\'onore!'],
    vocabulary: 'moderno',
    tone: 'neutro'
  },
  'merchant': {
    personality: 'Mercante astuto e persuasivo, sempre pronto a contrattare',
    speechPatterns: ['Affare!', 'Solo per te...', 'Prezzo speciale!'],
    vocabulary: 'moderno',
    tone: 'informale'
  },
  'wizard': {
    personality: 'Mago saggio e misterioso, usa termini arcani',
    speechPatterns: ['Le antiche profezie...', 'La magia richiede...', 'Scrutando le stelle...'],
    vocabulary: 'arcaico',
    tone: 'formale'
  },
  'villain': {
    personality: 'Villain melodrammatico, ama i monologhi',
    speechPatterns: ['Mwahahaha!', 'Sciocchi mortali!', 'Il mio piano...'],
    vocabulary: 'moderno',
    tone: 'formale'
  }
};

// Gaming terminology per lingua
export const GAMING_GLOSSARY: Record<string, Record<string, string>> = {
  'en': {
    'health': 'health',
    'mana': 'mana',
    'stamina': 'stamina',
    'level': 'level',
    'experience': 'experience',
    'quest': 'quest',
    'inventory': 'inventory',
    'skill': 'skill',
    'ability': 'ability',
    'boss': 'boss',
    'dungeon': 'dungeon',
    'loot': 'loot',
    'spawn': 'spawn',
    'respawn': 'respawn',
    'buff': 'buff',
    'debuff': 'debuff',
    'cooldown': 'cooldown',
    'DPS': 'DPS',
    'tank': 'tank',
    'healer': 'healer'
  },
  'it': {
    'health': 'salute',
    'mana': 'mana',
    'stamina': 'vigore',
    'level': 'livello',
    'experience': 'esperienza',
    'quest': 'missione',
    'inventory': 'inventario',
    'skill': 'abilità',
    'ability': 'capacità',
    'boss': 'boss',
    'dungeon': 'dungeon',
    'loot': 'bottino',
    'spawn': 'comparsa',
    'respawn': 'rinascita',
    'buff': 'potenziamento',
    'debuff': 'indebolimento',
    'cooldown': 'tempo di ricarica',
    'DPS': 'DPS',
    'tank': 'tank',
    'healer': 'guaritore'
  },
  'de': {
    'health': 'Gesundheit',
    'mana': 'Mana',
    'stamina': 'Ausdauer',
    'level': 'Stufe',
    'experience': 'Erfahrung',
    'quest': 'Quest',
    'inventory': 'Inventar',
    'skill': 'Fertigkeit',
    'ability': 'Fähigkeit',
    'boss': 'Boss',
    'dungeon': 'Verlies',
    'loot': 'Beute',
    'spawn': 'Erscheinen',
    'respawn': 'Wiedergeburt',
    'buff': 'Verstärkung',
    'debuff': 'Schwächung',
    'cooldown': 'Abklingzeit',
    'DPS': 'DPS',
    'tank': 'Tank',
    'healer': 'Heiler'
  },
  'es': {
    'health': 'salud',
    'mana': 'maná',
    'stamina': 'resistencia',
    'level': 'nivel',
    'experience': 'experiencia',
    'quest': 'misión',
    'inventory': 'inventario',
    'skill': 'habilidad',
    'ability': 'capacidad',
    'boss': 'jefe',
    'dungeon': 'mazmorra',
    'loot': 'botín',
    'spawn': 'aparición',
    'respawn': 'reaparición',
    'buff': 'mejora',
    'debuff': 'debilitación',
    'cooldown': 'tiempo de reutilización',
    'DPS': 'DPS',
    'tank': 'tanque',
    'healer': 'sanador'
  },
  'fr': {
    'health': 'santé',
    'mana': 'mana',
    'stamina': 'endurance',
    'level': 'niveau',
    'experience': 'expérience',
    'quest': 'quête',
    'inventory': 'inventaire',
    'skill': 'compétence',
    'ability': 'capacité',
    'boss': 'boss',
    'dungeon': 'donjon',
    'loot': 'butin',
    'spawn': 'apparition',
    'respawn': 'réapparition',
    'buff': 'amélioration',
    'debuff': 'affaiblissement',
    'cooldown': 'temps de recharge',
    'DPS': 'DPS',
    'tank': 'tank',
    'healer': 'soigneur'
  },
  'ja': {
    'health': '体力',
    'mana': 'マナ',
    'stamina': 'スタミナ',
    'level': 'レベル',
    'experience': '経験値',
    'quest': 'クエスト',
    'inventory': 'インベントリ',
    'skill': 'スキル',
    'ability': 'アビリティ',
    'boss': 'ボス',
    'dungeon': 'ダンジョン',
    'loot': '戦利品',
    'spawn': '出現',
    'respawn': 'リスポーン',
    'buff': 'バフ',
    'debuff': 'デバフ',
    'cooldown': 'クールダウン',
    'DPS': 'DPS',
    'tank': 'タンク',
    'healer': 'ヒーラー'
  }
};

/**
 * Calcola un punteggio di qualità completo per una traduzione
 */
export function calculateQualityScore(
  sourceText: string,
  translatedText: string,
  targetLanguage: string,
  characterProfile?: CharacterProfile
): QualityScore {
  const details: string[] = [];
  
  const fluency = calculateFluencyScore(translatedText, targetLanguage, details);
  const accuracy = calculateAccuracyScore(sourceText, translatedText, details);
  const consistency = calculateConsistencyScore(translatedText, targetLanguage, details);
  const style = calculateStyleScore(translatedText, targetLanguage, details, characterProfile);
  const lengthRatio = translatedText.length / Math.max(sourceText.length, 1);
  
  const overall = Math.round(
    fluency * 0.25 +
    accuracy * 0.30 +
    consistency * 0.20 +
    style * 0.25
  );
  
  return { overall, fluency, accuracy, consistency, style, lengthRatio, details };
}

function calculateFluencyScore(text: string, lang: string, details: string[]): number {
  if (!text || text.length < 2) {
    details.push('❌ Testo vuoto o troppo corto');
    return 0;
  }
  
  let score = 80;
  
  // Punteggiatura finale
  if (text.length > 20 && !/[.!?。！？]$/.test(text.trim())) {
    score -= 5;
    details.push('⚠️ Manca punteggiatura finale');
  }
  
  // Spazi multipli
  if (/\s{3,}/.test(text)) {
    score -= 10;
    details.push('⚠️ Spazi multipli eccessivi');
  } else if (/\s{2}/.test(text)) {
    score -= 3;
  }
  
  // Parentesi bilanciate
  const openParens = (text.match(/\(/g) || []).length;
  const closeParens = (text.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    score -= 10;
    details.push('⚠️ Parentesi non bilanciate');
  }
  
  // Virgolette bilanciate
  const quotes = (text.match(/"/g) || []).length;
  if (quotes % 2 !== 0) {
    score -= 5;
    details.push('⚠️ Virgolette non bilanciate');
  }
  
  // Lunghezza frasi equilibrata
  const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    const avgLen = text.length / sentences.length;
    if (avgLen >= 15 && avgLen <= 120) {
      score += 10;
      details.push('✓ Struttura frasi equilibrata');
    } else if (avgLen > 200) {
      score -= 10;
      details.push('⚠️ Frasi troppo lunghe');
    }
  }
  
  return Math.min(100, Math.max(0, score));
}

function calculateAccuracyScore(source: string, translated: string, details: string[]): number {
  let score = 75;
  
  // Rapporto lunghezza
  const ratio = translated.length / Math.max(source.length, 1);
  
  if (ratio < 0.4) {
    score -= 25;
    details.push('❌ Traduzione molto più corta (-60% o più)');
  } else if (ratio < 0.6) {
    score -= 15;
    details.push('⚠️ Traduzione significativamente più corta');
  } else if (ratio > 2.5) {
    score -= 20;
    details.push('⚠️ Traduzione molto più lunga (+150% o più)');
  } else if (ratio >= 0.75 && ratio <= 1.5) {
    score += 15;
    details.push('✓ Lunghezza proporzionata');
  }
  
  // Preservazione numeri
  const srcNumbers = source.match(/\d+(?:[.,]\d+)?/g) || [];
  const tgtNumbers = translated.match(/\d+(?:[.,]\d+)?/g) || [];
  
  if (srcNumbers.length > 0) {
    const preserved = srcNumbers.filter(n => 
      tgtNumbers.some(tn => tn.replace(',', '.') === n.replace(',', '.'))
    ).length;
    
    if (preserved === srcNumbers.length) {
      score += 10;
      details.push('✓ Numeri preservati correttamente');
    } else if (preserved < srcNumbers.length * 0.5) {
      score -= 15;
      details.push(`⚠️ ${srcNumbers.length - preserved}/${srcNumbers.length} numeri mancanti`);
    }
  }
  
  // Preservazione placeholder
  const placeholderPatterns = [
    /\{[^}]+\}/g,           // {variable}
    /%[sdifxXo%]/g,         // printf-style
    /\$\w+/g,               // $variable
    /<[^>]+>/g,             // <tag>
    /\[\[[^\]]+\]\]/g,      // [[wiki-style]]
    /@@\w+@@/g              // @@placeholder@@
  ];
  
  let totalPlaceholders = 0;
  let preservedPlaceholders = 0;
  
  for (const pattern of placeholderPatterns) {
    const srcMatches = source.match(pattern) || [];
    const tgtMatches = translated.match(pattern) || [];
    
    totalPlaceholders += srcMatches.length;
    preservedPlaceholders += srcMatches.filter((p: string) => tgtMatches.includes(p)).length;
  }
  
  if (totalPlaceholders > 0) {
    if (preservedPlaceholders === totalPlaceholders) {
      score += 10;
      details.push('✓ Tutti i placeholder preservati');
    } else {
      const missing = totalPlaceholders - preservedPlaceholders;
      score -= Math.min(20, missing * 5);
      details.push(`⚠️ ${missing} placeholder mancanti o modificati`);
    }
  }
  
  return Math.min(100, Math.max(0, score));
}

function calculateConsistencyScore(text: string, lang: string, details: string[]): number {
  let score = 85;
  
  // Capitalizzazione coerente
  const midSentenceCaps = text.match(/[a-zàèìòù]\s+[A-ZÀÈÌÒÙ][a-zàèìòù]/g) || [];
  if (midSentenceCaps.length > 3) {
    score -= 10;
    details.push('⚠️ Capitalizzazione inconsistente');
  }
  
  // Ripetizioni eccessive (stesso gruppo di 3+ parole ripetuto)
  const words = text.toLowerCase().split(/\s+/);
  const trigrams: Record<string, number> = {};
  
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i+1]} ${words[i+2]}`;
    trigrams[trigram] = (trigrams[trigram] || 0) + 1;
  }
  
  const maxRepeat = Math.max(0, ...Object.values(trigrams));
  if (maxRepeat > 2) {
    score -= 10;
    details.push('⚠️ Frasi ripetute rilevate');
  }
  
  // Uso coerente terminologia gaming
  const glossary = GAMING_GLOSSARY[lang] || GAMING_GLOSSARY['en'];
  const usedTerms = Object.values(glossary).filter(term => 
    text.toLowerCase().includes(term.toLowerCase())
  );
  
  if (usedTerms.length > 0) {
    score += 5;
    details.push(`✓ ${usedTerms.length} termini gaming standard`);
  }
  
  return Math.min(100, Math.max(0, score));
}

function calculateStyleScore(
  text: string,
  lang: string,
  details: string[],
  profile?: CharacterProfile
): number {
  let score = 80;
  
  // Check base per stile gaming
  const hasExclamations = (text.match(/!/g) || []).length;
  const hasQuestions = (text.match(/\?/g) || []).length;
  const hasEllipsis = text.includes('...');
  
  // Testo troppo monotono
  if (text.length > 100 && hasExclamations === 0 && hasQuestions === 0 && !hasEllipsis) {
    score -= 5;
    details.push('💡 Testo potrebbe essere più espressivo');
  }
  
  if (!profile) {
    return Math.min(100, Math.max(0, score));
  }
  
  // Valutazione character profile
  const lowerText = text.toLowerCase();
  
  // Check speech patterns
  if (profile.speechPatterns && profile.speechPatterns.length > 0) {
    const patternsFound = profile.speechPatterns.filter(p => 
      lowerText.includes(p.toLowerCase())
    ).length;
    
    if (patternsFound > 0) {
      score += patternsFound * 5;
      details.push(`✓ ${patternsFound} pattern vocali del personaggio`);
    }
  }
  
  // Check vocabulary style
  if (profile.vocabulary) {
    switch (profile.vocabulary) {
      case 'arcaico':
        if (/\b(dunque|orsù|invero|cotesto|codesto|egli|ella|esso)\b/i.test(text)) {
          score += 10;
          details.push('✓ Vocabolario arcaico rispettato');
        }
        break;
      case 'slang':
        if (/\b(tipo|cioè|boh|mah|wow|ok|cool)\b/i.test(text)) {
          score += 10;
          details.push('✓ Slang appropriato');
        }
        break;
      case 'tecnico':
        if (/\b(sistema|analisi|parametr|processo|funzion|calcol)\b/i.test(text)) {
          score += 10;
          details.push('✓ Linguaggio tecnico');
        }
        break;
      case 'bambino':
        if (/\b(mamma|papà|bello|grande|piccol|buon)\b/i.test(text) || hasExclamations > 1) {
          score += 10;
          details.push('✓ Linguaggio semplice/infantile');
        }
        break;
    }
  }
  
  // Check tone
  if (profile.tone) {
    const hasFormalPronouns = /\b(lei|voi|ella|loro|usted|vous|sie|ihr)\b/i.test(text);
    const hasInformalMarkers = /\b(tu|te|ti|tuo|tua|tú|du|dein)\b/i.test(text);
    
    if (profile.tone === 'formale' && hasFormalPronouns) {
      score += 5;
      details.push('✓ Tono formale rispettato');
    } else if (profile.tone === 'informale' && (hasInformalMarkers || hasExclamations > 0)) {
      score += 5;
      details.push('✓ Tono informale rispettato');
    }
  }
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Confronta due traduzioni e determina quale è migliore
 */
export function compareTranslations(
  a: { text: string; score: QualityScore },
  b: { text: string; score: QualityScore }
): 'a' | 'b' | 'equal' {
  const diff = a.score.overall - b.score.overall;
  
  if (Math.abs(diff) < 5) return 'equal';
  return diff > 0 ? 'a' : 'b';
}

/**
 * Genera suggerimenti per migliorare una traduzione
 */
export function generateImprovementSuggestions(score: QualityScore): string[] {
  const suggestions: string[] = [];
  
  if (score.fluency < 70) {
    suggestions.push('Rivedi la struttura grammaticale delle frasi');
  }
  
  if (score.accuracy < 70) {
    suggestions.push('Verifica che numeri e placeholder siano preservati');
  }
  
  if (score.consistency < 70) {
    suggestions.push('Uniforma la capitalizzazione e i termini utilizzati');
  }
  
  if (score.style < 70) {
    suggestions.push('Adatta il tono al contesto videoludico');
  }
  
  if (score.lengthRatio < 0.6 || score.lengthRatio > 1.8) {
    suggestions.push('La lunghezza della traduzione sembra anomala, verifica completezza');
  }
  
  return suggestions;
}

/**
 * Calcola score per review threshold
 */
export function needsHumanReview(score: QualityScore, threshold: number = 75): boolean {
  return score.overall < threshold;
}

/**
 * Classifica la qualità in categorie
 */
export function getQualityCategory(score: number): {
  category: 'excellent' | 'good' | 'acceptable' | 'needs_review' | 'poor';
  label: string;
  color: string;
} {
  if (score >= 90) {
    return { category: 'excellent', label: 'Eccellente', color: 'text-green-500' };
  } else if (score >= 80) {
    return { category: 'good', label: 'Buona', color: 'text-emerald-500' };
  } else if (score >= 70) {
    return { category: 'acceptable', label: 'Accettabile', color: 'text-yellow-500' };
  } else if (score >= 50) {
    return { category: 'needs_review', label: 'Da rivedere', color: 'text-orange-500' };
  } else {
    return { category: 'poor', label: 'Scarsa', color: 'text-red-500' };
  }
}
