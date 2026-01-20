/**
 * 🔍 Quality Gates System
 * 
 * Sistema di validazione automatica per traduzioni di giochi.
 * Verifica qualità, lunghezza, terminologia e coerenza.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface QualityCheck {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  passed: boolean;
  message?: string;
  details?: Record<string, any>;
}

export interface QualityReport {
  overallScore: number;        // 0-100
  passed: boolean;             // Se supera la soglia minima
  checks: QualityCheck[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
  suggestions: string[];
  timestamp: string;
}

export interface QualityOptions {
  sourceText: string;
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  context?: 'ui' | 'dialogue' | 'narrative' | 'system' | 'item' | 'general';
  maxLength?: number;          // Limite caratteri (per UI)
  glossaryTerms?: Array<{ original: string; translation: string }>;
  minQualityScore?: number;    // Soglia minima (default 70)
}

export interface LengthValidation {
  sourceLength: number;
  targetLength: number;
  ratio: number;
  maxAllowed?: number;
  isWithinLimit: boolean;
  overflow?: number;
}

// ============================================================================
// QUALITY CHECK FUNCTIONS
// ============================================================================

/**
 * Verifica la lunghezza della traduzione rispetto all'originale
 */
export function checkLength(
  source: string,
  target: string,
  maxLength?: number
): QualityCheck {
  const sourceLen = source.length;
  const targetLen = target.length;
  const ratio = targetLen / sourceLen;
  
  // L'italiano è tipicamente 15-25% più lungo dell'inglese
  const expectedRatioMin = 0.8;
  const expectedRatioMax = 1.4;
  
  let passed = true;
  let severity: QualityCheck['severity'] = 'info';
  let message = '';
  
  // Check limite assoluto
  if (maxLength && targetLen > maxLength) {
    passed = false;
    severity = 'error';
    message = `Traduzione troppo lunga: ${targetLen}/${maxLength} caratteri (overflow: ${targetLen - maxLength})`;
  }
  // Check ratio anomalo
  else if (ratio < expectedRatioMin) {
    severity = 'warning';
    message = `Traduzione molto più corta dell'originale (${Math.round(ratio * 100)}%)`;
  }
  else if (ratio > expectedRatioMax) {
    severity = 'warning';
    message = `Traduzione molto più lunga dell'originale (${Math.round(ratio * 100)}%)`;
  }
  else {
    message = `Lunghezza OK (${targetLen} caratteri, ${Math.round(ratio * 100)}% dell'originale)`;
  }
  
  return {
    id: 'length_check',
    name: 'Controllo Lunghezza',
    description: 'Verifica che la traduzione abbia una lunghezza appropriata',
    severity,
    passed,
    message,
    details: {
      sourceLength: sourceLen,
      targetLength: targetLen,
      ratio: Math.round(ratio * 100) / 100,
      maxLength,
      overflow: maxLength ? Math.max(0, targetLen - maxLength) : 0
    }
  };
}

/**
 * Verifica che i termini del glossario siano usati correttamente
 */
export function checkGlossaryTerms(
  source: string,
  target: string,
  glossaryTerms: Array<{ original: string; translation: string }>
): QualityCheck {
  const missingTerms: string[] = [];
  const incorrectTerms: Array<{ original: string; expected: string; found?: string }> = [];
  
  for (const term of glossaryTerms) {
    const sourceHasTerm = source.toLowerCase().includes(term.original.toLowerCase());
    const targetHasTerm = target.toLowerCase().includes(term.translation.toLowerCase());
    
    if (sourceHasTerm && !targetHasTerm) {
      // Il termine originale c'è ma la traduzione corretta no
      missingTerms.push(term.original);
      
      // Cerca se c'è una traduzione alternativa (errata)
      const words = target.split(/\s+/);
      // Potrebbe essere tradotto in modo diverso
    }
  }
  
  const passed = missingTerms.length === 0;
  let severity: QualityCheck['severity'] = passed ? 'info' : 'warning';
  let message = '';
  
  if (missingTerms.length > 0) {
    message = `Termini glossario mancanti: ${missingTerms.join(', ')}`;
  } else if (glossaryTerms.length > 0) {
    message = `Tutti i ${glossaryTerms.length} termini del glossario sono stati usati correttamente`;
  } else {
    message = 'Nessun termine di glossario da verificare';
  }
  
  return {
    id: 'glossary_check',
    name: 'Controllo Glossario',
    description: 'Verifica che i termini del glossario siano tradotti correttamente',
    severity,
    passed,
    message,
    details: {
      totalTerms: glossaryTerms.length,
      missingTerms,
      incorrectTerms
    }
  };
}

/**
 * Verifica la presenza di placeholder/variabili
 */
export function checkPlaceholders(source: string, target: string): QualityCheck {
  // Pattern comuni per placeholder nei giochi
  const patterns = [
    /\{[^}]+\}/g,           // {variable}
    /%[sd%]/g,              // %s, %d, %%
    /\$\{[^}]+\}/g,         // ${variable}
    /\[\[[^\]]+\]\]/g,      // [[variable]]
    /<[^>]+>/g,             // <tag>
    /\{[0-9]+\}/g,          // {0}, {1}
    /%[0-9]+/g,             // %1, %2
  ];
  
  const sourcePlaceholders: string[] = [];
  const targetPlaceholders: string[] = [];
  
  for (const pattern of patterns) {
    const sourceMatches = source.match(pattern) || [];
    const targetMatches = target.match(pattern) || [];
    sourcePlaceholders.push(...sourceMatches);
    targetPlaceholders.push(...targetMatches);
  }
  
  // Verifica che tutti i placeholder siano presenti
  const missingInTarget = sourcePlaceholders.filter(p => !targetPlaceholders.includes(p));
  const extraInTarget = targetPlaceholders.filter(p => !sourcePlaceholders.includes(p));
  
  const passed = missingInTarget.length === 0;
  let severity: QualityCheck['severity'] = 'info';
  let message = '';
  
  if (missingInTarget.length > 0) {
    severity = 'error';
    message = `Placeholder mancanti nella traduzione: ${missingInTarget.join(', ')}`;
  } else if (extraInTarget.length > 0) {
    severity = 'warning';
    message = `Placeholder extra nella traduzione: ${extraInTarget.join(', ')}`;
  } else if (sourcePlaceholders.length > 0) {
    message = `Tutti i ${sourcePlaceholders.length} placeholder sono stati preservati`;
  } else {
    message = 'Nessun placeholder rilevato';
  }
  
  return {
    id: 'placeholder_check',
    name: 'Controllo Placeholder',
    description: 'Verifica che variabili e placeholder siano preservati',
    severity,
    passed,
    message,
    details: {
      sourcePlaceholders,
      targetPlaceholders,
      missingInTarget,
      extraInTarget
    }
  };
}

/**
 * Verifica la formattazione (punteggiatura, maiuscole, etc.)
 */
export function checkFormatting(source: string, target: string): QualityCheck {
  const issues: string[] = [];
  
  // Verifica punteggiatura finale
  const sourcePunctuation = source.match(/[.!?…]$/);
  const targetPunctuation = target.match(/[.!?…]$/);
  
  if (sourcePunctuation && !targetPunctuation) {
    issues.push('Punteggiatura finale mancante');
  } else if (!sourcePunctuation && targetPunctuation) {
    issues.push('Punteggiatura finale aggiunta');
  } else if (sourcePunctuation && targetPunctuation && sourcePunctuation[0] !== targetPunctuation[0]) {
    // Eccezione: ? e ! possono essere intercambiabili in alcune lingue
    if (!(['?', '!'].includes(sourcePunctuation[0]) && ['?', '!'].includes(targetPunctuation[0]))) {
      issues.push(`Punteggiatura finale diversa: "${sourcePunctuation[0]}" → "${targetPunctuation[0]}"`);
    }
  }
  
  // Verifica maiuscola iniziale
  const sourceStartsUpper = /^[A-Z]/.test(source);
  const targetStartsUpper = /^[A-ZÀ-Ú]/.test(target);
  
  if (sourceStartsUpper && !targetStartsUpper) {
    issues.push('Maiuscola iniziale mancante');
  }
  
  // Verifica spazi multipli
  if (/\s{2,}/.test(target)) {
    issues.push('Spazi multipli rilevati');
  }
  
  // Verifica spazi prima della punteggiatura (errore comune)
  if (/\s[.,!?;:]/.test(target)) {
    issues.push('Spazio prima della punteggiatura');
  }
  
  const passed = issues.length === 0;
  
  return {
    id: 'formatting_check',
    name: 'Controllo Formattazione',
    description: 'Verifica punteggiatura, maiuscole e spaziatura',
    severity: passed ? 'info' : 'warning',
    passed,
    message: passed ? 'Formattazione corretta' : issues.join('; '),
    details: { issues }
  };
}

/**
 * Verifica che il testo non sia stato lasciato in inglese
 */
export function checkUntranslated(source: string, target: string): QualityCheck {
  // Se sono identici e contengono lettere, probabilmente non è stato tradotto
  const sourceNormalized = source.toLowerCase().trim();
  const targetNormalized = target.toLowerCase().trim();
  
  const hasLetters = /[a-zA-Z]/.test(source);
  const isIdentical = sourceNormalized === targetNormalized;
  
  // Eccezioni: nomi propri, acronimi, termini tecnici corti
  const isShort = source.length < 4;
  const isAllCaps = source === source.toUpperCase() && source.length < 10;
  const looksLikeName = /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(source);
  
  let passed = true;
  let severity: QualityCheck['severity'] = 'info';
  let message = 'Testo tradotto correttamente';
  
  if (hasLetters && isIdentical && !isShort && !isAllCaps && !looksLikeName) {
    passed = false;
    severity = 'warning';
    message = 'Il testo sembra non essere stato tradotto';
  }
  
  return {
    id: 'untranslated_check',
    name: 'Controllo Traduzione',
    description: 'Verifica che il testo sia stato effettivamente tradotto',
    severity,
    passed,
    message,
    details: {
      isIdentical,
      sourceLength: source.length,
      exceptions: { isShort, isAllCaps, looksLikeName }
    }
  };
}

/**
 * Verifica la coerenza del tono/registro
 */
export function checkToneConsistency(
  target: string,
  context?: QualityOptions['context']
): QualityCheck {
  const issues: string[] = [];
  
  // Verifica uso del "tu" vs "Lei" (importante per italiano)
  const hasTu = /\b(tu|tuo|tua|tuoi|tue|ti)\b/i.test(target);
  const hasLei = /\b(Lei|Suo|Sua|Suoi|Sue|La)\b/.test(target); // Case sensitive per Lei formale
  
  if (hasTu && hasLei) {
    issues.push('Mix di registro formale (Lei) e informale (tu)');
  }
  
  // Per UI di giochi, tipicamente si usa il "tu"
  if (context === 'ui' && hasLei && !hasTu) {
    issues.push('Registro formale (Lei) inusuale per UI di gioco');
  }
  
  // Verifica slang/colloquialismi in contesti formali
  const slangPatterns = /\b(figo|fico|ganzo|boh|mah|cioè|tipo)\b/i;
  if (context === 'system' && slangPatterns.test(target)) {
    issues.push('Linguaggio colloquiale in contesto di sistema');
  }
  
  const passed = issues.length === 0;
  
  return {
    id: 'tone_check',
    name: 'Controllo Tono',
    description: 'Verifica coerenza del registro linguistico',
    severity: passed ? 'info' : 'warning',
    passed,
    message: passed ? 'Tono coerente' : issues.join('; '),
    details: { issues, context, hasTu, hasLei }
  };
}

/**
 * Verifica numeri e unità di misura
 */
export function checkNumbersAndUnits(source: string, target: string): QualityCheck {
  // Estrai numeri
  const sourceNumbers = source.match(/\d+([.,]\d+)?/g) || [];
  const targetNumbers = target.match(/\d+([.,]\d+)?/g) || [];
  
  const issues: string[] = [];
  
  // Verifica che i numeri siano preservati
  for (const num of sourceNumbers) {
    // Normalizza (1,000 vs 1.000)
    const normalized = (num as string).replace(/[.,]/g, '');
    const found = targetNumbers.some((t: string) => t.replace(/[.,]/g, '') === normalized);
    if (!found) {
      issues.push(`Numero "${num}" non trovato nella traduzione`);
    }
  }
  
  // Verifica unità di misura comuni
  const unitPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\b(HP|MP|XP|SP)\b/g, name: 'stat points' },
    { pattern: /\b(kg|lb|km|mi|m|ft)\b/gi, name: 'units' },
    // Escludi contrazioni inglesi ('s, 's) - richiedi numero prima dell'unità
    { pattern: /\d\s*(sec|min|hr|s|h)\b/gi, name: 'time' },
  ];
  
  for (const { pattern, name } of unitPatterns) {
    const sourceUnits: string[] = source.match(pattern) || [];
    const targetUnits: string[] = target.match(pattern) || [];
    
    for (const unit of sourceUnits) {
      if (!targetUnits.some((u: string) => u.toLowerCase() === unit.toLowerCase())) {
        issues.push(`Unità "${unit}" (${name}) non trovata`);
      }
    }
  }
  
  const passed = issues.length === 0;
  
  return {
    id: 'numbers_check',
    name: 'Controllo Numeri',
    description: 'Verifica che numeri e unità siano preservati',
    severity: passed ? 'info' : 'error',
    passed,
    message: passed ? 'Numeri e unità corretti' : issues.join('; '),
    details: { sourceNumbers, targetNumbers, issues }
  };
}

/**
 * Calcola un punteggio di qualità complessivo
 */
export function calculateQualityScore(checks: QualityCheck[]): number {
  if (checks.length === 0) return 100;
  
  let score = 100;
  
  for (const check of checks) {
    if (!check.passed) {
      switch (check.severity) {
        case 'error':
          score -= 25;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 2;
          break;
      }
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// MAIN QUALITY GATE FUNCTION
// ============================================================================

/**
 * Esegue tutti i controlli di qualità su una traduzione
 */
export function runQualityGates(options: QualityOptions): QualityReport {
  const {
    sourceText,
    translatedText,
    context = 'general',
    maxLength,
    glossaryTerms = [],
    minQualityScore = 70
  } = options;
  
  const checks: QualityCheck[] = [];
  
  // Esegui tutti i controlli
  checks.push(checkLength(sourceText, translatedText, maxLength));
  checks.push(checkPlaceholders(sourceText, translatedText));
  checks.push(checkFormatting(sourceText, translatedText));
  checks.push(checkUntranslated(sourceText, translatedText));
  checks.push(checkToneConsistency(translatedText, context));
  checks.push(checkNumbersAndUnits(sourceText, translatedText));
  
  if (glossaryTerms.length > 0) {
    checks.push(checkGlossaryTerms(sourceText, translatedText, glossaryTerms));
  }
  
  // Calcola statistiche
  const summary = {
    errors: checks.filter(c => !c.passed && c.severity === 'error').length,
    warnings: checks.filter(c => !c.passed && c.severity === 'warning').length,
    infos: checks.filter(c => !c.passed && c.severity === 'info').length
  };
  
  const overallScore = calculateQualityScore(checks);
  const passed = overallScore >= minQualityScore;
  
  // Genera suggerimenti
  const suggestions: string[] = [];
  
  for (const check of checks) {
    if (!check.passed && check.severity !== 'info') {
      switch (check.id) {
        case 'length_check':
          if (check.details?.overflow > 0) {
            suggestions.push(`Accorcia la traduzione di ${check.details.overflow} caratteri`);
          }
          break;
        case 'placeholder_check':
          suggestions.push('Assicurati di mantenere tutti i placeholder {variabile}');
          break;
        case 'glossary_check':
          suggestions.push('Usa i termini del glossario per coerenza');
          break;
        case 'untranslated_check':
          suggestions.push('Verifica che il testo sia stato tradotto');
          break;
        case 'formatting_check':
          suggestions.push('Controlla punteggiatura e formattazione');
          break;
      }
    }
  }
  
  return {
    overallScore,
    passed,
    checks,
    summary,
    suggestions,
    timestamp: new Date().toISOString()
  };
}

/**
 * Versione rapida per batch processing
 */
export function quickQualityCheck(
  source: string,
  target: string,
  maxLength?: number
): { score: number; passed: boolean; criticalIssues: string[] } {
  const criticalIssues: string[] = [];
  let score = 100;
  
  // Check placeholder (critico)
  const placeholderCheck = checkPlaceholders(source, target);
  if (!placeholderCheck.passed && placeholderCheck.severity === 'error') {
    score -= 30;
    criticalIssues.push(placeholderCheck.message || 'Placeholder mancanti');
  }
  
  // Check lunghezza (critico se overflow)
  if (maxLength && target.length > maxLength) {
    score -= 25;
    criticalIssues.push(`Overflow: ${target.length - maxLength} caratteri`);
  }
  
  // Check numeri (critico)
  const numbersCheck = checkNumbersAndUnits(source, target);
  if (!numbersCheck.passed) {
    score -= 20;
    criticalIssues.push(numbersCheck.message || 'Numeri mancanti');
  }
  
  // Check non tradotto
  const untranslatedCheck = checkUntranslated(source, target);
  if (!untranslatedCheck.passed) {
    score -= 15;
    criticalIssues.push('Possibile testo non tradotto');
  }
  
  return {
    score: Math.max(0, score),
    passed: score >= 70,
    criticalIssues
  };
}

// ============================================================================
// BATCH QUALITY VALIDATION
// ============================================================================

export interface BatchQualityResult {
  totalItems: number;
  passedItems: number;
  failedItems: number;
  averageScore: number;
  criticalErrors: Array<{
    index: number;
    source: string;
    target: string;
    issues: string[];
  }>;
}

/**
 * Valida un batch di traduzioni
 */
export function validateBatch(
  translations: Array<{ source: string; target: string; maxLength?: number }>,
  glossaryTerms?: Array<{ original: string; translation: string }>
): BatchQualityResult {
  let totalScore = 0;
  let passedCount = 0;
  const criticalErrors: BatchQualityResult['criticalErrors'] = [];
  
  for (let i = 0; i < translations.length; i++) {
    const { source, target, maxLength } = translations[i];
    
    const report = runQualityGates({
      sourceText: source,
      translatedText: target,
      maxLength,
      glossaryTerms
    });
    
    totalScore += report.overallScore;
    
    if (report.passed) {
      passedCount++;
    } else {
      // Raccogli errori critici
      const issues = report.checks
        .filter(c => !c.passed && c.severity === 'error')
        .map(c => c.message || c.name);
      
      if (issues.length > 0) {
        criticalErrors.push({
          index: i,
          source: source.substring(0, 50) + (source.length > 50 ? '...' : ''),
          target: target.substring(0, 50) + (target.length > 50 ? '...' : ''),
          issues
        });
      }
    }
  }
  
  return {
    totalItems: translations.length,
    passedItems: passedCount,
    failedItems: translations.length - passedCount,
    averageScore: translations.length > 0 ? Math.round(totalScore / translations.length) : 0,
    criticalErrors
  };
}
