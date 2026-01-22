/**
 * AI Review Agent
 * Sistema di revisione automatica delle traduzioni con suggerimenti intelligenti
 */

export type ReviewSeverity = 'critical' | 'warning' | 'suggestion' | 'info'

export type ReviewCategory = 
  | 'accuracy'      // Precisione della traduzione
  | 'consistency'   // Coerenza terminologica
  | 'grammar'       // Errori grammaticali
  | 'style'         // Stile e tono
  | 'placeholder'   // Problemi con placeholder
  | 'length'        // Problemi di lunghezza
  | 'cultural'      // Problemi culturali
  | 'gaming'        // Terminologia gaming specifica

export interface ReviewIssue {
  id: string
  category: ReviewCategory
  severity: ReviewSeverity
  message: string
  messageIt: string
  suggestion?: string
  suggestionIt?: string
  originalSegment?: string
  translatedSegment?: string
  position?: { start: number; end: number }
}

export interface ReviewResult {
  translationId: string
  original: string
  translated: string
  score: number // 0-100
  issues: ReviewIssue[]
  suggestions: string[]
  autoFixAvailable: boolean
  reviewedAt: Date
}

export interface ReviewStats {
  total: number
  reviewed: number
  passed: number
  failed: number
  avgScore: number
  issuesByCategory: Record<ReviewCategory, number>
  issuesBySeverity: Record<ReviewSeverity, number>
}

// Configurazione categorie
export const REVIEW_CATEGORIES: Record<ReviewCategory, {
  label: string
  labelIt: string
  icon: string
  color: string
  description: string
  descriptionIt: string
}> = {
  accuracy: {
    label: 'Accuracy',
    labelIt: 'Precisione',
    icon: '🎯',
    color: '#3b82f6',
    description: 'Translation accuracy and meaning preservation',
    descriptionIt: 'Precisione della traduzione e preservazione del significato'
  },
  consistency: {
    label: 'Consistency',
    labelIt: 'Coerenza',
    icon: '🔗',
    color: '#8b5cf6',
    description: 'Terminology and style consistency',
    descriptionIt: 'Coerenza terminologica e stilistica'
  },
  grammar: {
    label: 'Grammar',
    labelIt: 'Grammatica',
    icon: '📝',
    color: '#ef4444',
    description: 'Grammar and spelling errors',
    descriptionIt: 'Errori grammaticali e ortografici'
  },
  style: {
    label: 'Style',
    labelIt: 'Stile',
    icon: '✨',
    color: '#f59e0b',
    description: 'Tone and style appropriateness',
    descriptionIt: 'Appropriatezza di tono e stile'
  },
  placeholder: {
    label: 'Placeholders',
    labelIt: 'Placeholder',
    icon: '🔤',
    color: '#ec4899',
    description: 'Variable and placeholder handling',
    descriptionIt: 'Gestione variabili e placeholder'
  },
  length: {
    label: 'Length',
    labelIt: 'Lunghezza',
    icon: '📏',
    color: '#14b8a6',
    description: 'Text length constraints',
    descriptionIt: 'Vincoli di lunghezza testo'
  },
  cultural: {
    label: 'Cultural',
    labelIt: 'Culturale',
    icon: '🌍',
    color: '#22c55e',
    description: 'Cultural adaptation issues',
    descriptionIt: 'Problemi di adattamento culturale'
  },
  gaming: {
    label: 'Gaming',
    labelIt: 'Gaming',
    icon: '🎮',
    color: '#6366f1',
    description: 'Gaming-specific terminology',
    descriptionIt: 'Terminologia specifica gaming'
  }
}

export const SEVERITY_CONFIG: Record<ReviewSeverity, {
  label: string
  labelIt: string
  color: string
  bgColor: string
  icon: string
}> = {
  critical: {
    label: 'Critical',
    labelIt: 'Critico',
    color: '#ef4444',
    bgColor: '#fef2f2',
    icon: '🚨'
  },
  warning: {
    label: 'Warning',
    labelIt: 'Attenzione',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    icon: '⚠️'
  },
  suggestion: {
    label: 'Suggestion',
    labelIt: 'Suggerimento',
    color: '#3b82f6',
    bgColor: '#eff6ff',
    icon: '💡'
  },
  info: {
    label: 'Info',
    labelIt: 'Info',
    color: '#6b7280',
    bgColor: '#f9fafb',
    icon: 'ℹ️'
  }
}

// Pattern di rilevamento problemi
const PLACEHOLDER_PATTERNS = [
  /\{[^}]+\}/g,           // {variable}
  /\{\{[^}]+\}\}/g,       // {{variable}}
  /%[sd@]/g,              // %s, %d, %@
  /%\d+\$[sd@]/g,         // %1$s, %2$d
  /\$\{[^}]+\}/g,         // ${variable}
  /<[^>]+>/g,             // <tag>
  /\[\[[^\]]+\]\]/g,      // [[variable]]
]

const GAMING_TERMS: Record<string, string[]> = {
  en: ['level', 'score', 'health', 'mana', 'XP', 'HP', 'MP', 'NPC', 'quest', 'achievement', 'inventory', 'spawn', 'respawn', 'buff', 'debuff', 'cooldown', 'DPS', 'tank', 'healer', 'boss', 'loot', 'raid', 'dungeon', 'guild', 'clan'],
  it: ['livello', 'punteggio', 'salute', 'mana', 'XP', 'HP', 'MP', 'NPC', 'missione', 'obiettivo', 'inventario', 'spawn', 'respawn', 'buff', 'debuff', 'cooldown', 'DPS', 'tank', 'curatore', 'boss', 'bottino', 'raid', 'dungeon', 'gilda', 'clan']
}

// Funzioni di rilevamento

function extractPlaceholders(text: string): string[] {
  const placeholders: string[] = []
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) {
      placeholders.push(...matches)
    }
  }
  return placeholders
}

function checkPlaceholders(original: string, translated: string): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  const originalPlaceholders = extractPlaceholders(original)
  const translatedPlaceholders = extractPlaceholders(translated)
  
  // Check missing placeholders
  for (const ph of originalPlaceholders) {
    if (!translatedPlaceholders.includes(ph)) {
      issues.push({
        id: `ph-missing-${ph}`,
        category: 'placeholder',
        severity: 'critical',
        message: `Missing placeholder: ${ph}`,
        messageIt: `Placeholder mancante: ${ph}`,
        suggestion: `Add "${ph}" to the translation`,
        suggestionIt: `Aggiungi "${ph}" alla traduzione`,
        originalSegment: ph
      })
    }
  }
  
  // Check extra placeholders
  for (const ph of translatedPlaceholders) {
    if (!originalPlaceholders.includes(ph)) {
      issues.push({
        id: `ph-extra-${ph}`,
        category: 'placeholder',
        severity: 'warning',
        message: `Extra placeholder in translation: ${ph}`,
        messageIt: `Placeholder extra nella traduzione: ${ph}`,
        translatedSegment: ph
      })
    }
  }
  
  return issues
}

function checkLength(original: string, translated: string): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  const ratio = translated.length / original.length
  
  if (ratio > 1.5) {
    issues.push({
      id: 'length-too-long',
      category: 'length',
      severity: 'warning',
      message: `Translation is ${Math.round((ratio - 1) * 100)}% longer than original`,
      messageIt: `La traduzione è ${Math.round((ratio - 1) * 100)}% più lunga dell'originale`,
      suggestion: 'Consider shortening the translation for UI constraints',
      suggestionIt: 'Considera di accorciare la traduzione per vincoli UI'
    })
  } else if (ratio < 0.5 && original.length > 10) {
    issues.push({
      id: 'length-too-short',
      category: 'length',
      severity: 'suggestion',
      message: `Translation is ${Math.round((1 - ratio) * 100)}% shorter than original`,
      messageIt: `La traduzione è ${Math.round((1 - ratio) * 100)}% più corta dell'originale`,
      suggestion: 'Verify no content was lost in translation',
      suggestionIt: 'Verifica che non sia andato perso contenuto nella traduzione'
    })
  }
  
  return issues
}

function checkGrammar(translated: string, targetLang: string): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  
  // Basic checks for Italian
  if (targetLang === 'it') {
    // Double spaces
    if (/\s{2,}/.test(translated)) {
      issues.push({
        id: 'grammar-double-space',
        category: 'grammar',
        severity: 'suggestion',
        message: 'Double spaces detected',
        messageIt: 'Rilevati spazi doppi',
        suggestion: 'Remove extra spaces',
        suggestionIt: 'Rimuovi gli spazi extra'
      })
    }
    
    // Space before punctuation (Italian specific error)
    if (/\s[.,!?;:]/.test(translated)) {
      issues.push({
        id: 'grammar-space-before-punct',
        category: 'grammar',
        severity: 'warning',
        message: 'Space before punctuation',
        messageIt: 'Spazio prima della punteggiatura',
        suggestion: 'Remove space before punctuation marks',
        suggestionIt: 'Rimuovi lo spazio prima dei segni di punteggiatura'
      })
    }
    
    // Missing space after punctuation
    if (/[.,!?;:][a-zA-ZÀ-ÿ]/.test(translated)) {
      issues.push({
        id: 'grammar-no-space-after-punct',
        category: 'grammar',
        severity: 'warning',
        message: 'Missing space after punctuation',
        messageIt: 'Manca spazio dopo la punteggiatura',
        suggestion: 'Add space after punctuation marks',
        suggestionIt: 'Aggiungi spazio dopo i segni di punteggiatura'
      })
    }
  }
  
  // Universal checks
  // Repeated punctuation (except ... and !!)
  if (/([.,;:])\1{2,}|[!?]{3,}/.test(translated)) {
    issues.push({
      id: 'grammar-repeated-punct',
      category: 'grammar',
      severity: 'suggestion',
      message: 'Excessive repeated punctuation',
      messageIt: 'Punteggiatura ripetuta eccessiva'
    })
  }
  
  return issues
}

function checkStyle(original: string, translated: string): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  
  // Check capitalization consistency
  const originalAllCaps = original === original.toUpperCase() && original.length > 2
  const translatedAllCaps = translated === translated.toUpperCase() && translated.length > 2
  
  if (originalAllCaps && !translatedAllCaps) {
    issues.push({
      id: 'style-caps-mismatch',
      category: 'style',
      severity: 'suggestion',
      message: 'Original is ALL CAPS but translation is not',
      messageIt: 'L\'originale è TUTTO MAIUSCOLO ma la traduzione no',
      suggestion: 'Consider using ALL CAPS to match original emphasis',
      suggestionIt: 'Considera di usare TUTTO MAIUSCOLO per mantenere l\'enfasi'
    })
  }
  
  // Check exclamation consistency
  const originalExclamations = (original.match(/!/g) || []).length
  const translatedExclamations = (translated.match(/!/g) || []).length
  
  if (originalExclamations > 0 && translatedExclamations === 0) {
    issues.push({
      id: 'style-exclamation-missing',
      category: 'style',
      severity: 'suggestion',
      message: 'Original has exclamation but translation does not',
      messageIt: 'L\'originale ha esclamativo ma la traduzione no',
      suggestion: 'Consider adding exclamation to preserve tone',
      suggestionIt: 'Considera di aggiungere esclamativo per preservare il tono'
    })
  }
  
  // Check question consistency
  const originalQuestions = (original.match(/\?/g) || []).length
  const translatedQuestions = (translated.match(/\?/g) || []).length
  
  if (originalQuestions !== translatedQuestions) {
    issues.push({
      id: 'style-question-mismatch',
      category: 'style',
      severity: 'warning',
      message: `Question mark count mismatch (${originalQuestions} vs ${translatedQuestions})`,
      messageIt: `Disallineamento punti interrogativi (${originalQuestions} vs ${translatedQuestions})`
    })
  }
  
  return issues
}

function checkGamingTerms(original: string, translated: string, targetLang: string): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  const originalLower = original.toLowerCase()
  
  // Check if gaming terms are properly handled
  for (const term of GAMING_TERMS.en) {
    if (originalLower.includes(term.toLowerCase())) {
      // Some terms should NOT be translated (XP, HP, NPC, DPS, etc.)
      const keepInEnglish = ['XP', 'HP', 'MP', 'NPC', 'DPS', 'buff', 'debuff', 'boss', 'spawn', 'respawn', 'cooldown', 'raid', 'dungeon']
      
      if (keepInEnglish.map(t => t.toLowerCase()).includes(term.toLowerCase())) {
        if (!translated.toLowerCase().includes(term.toLowerCase())) {
          issues.push({
            id: `gaming-term-${term}`,
            category: 'gaming',
            severity: 'info',
            message: `Gaming term "${term}" might need to stay in English`,
            messageIt: `Il termine gaming "${term}" potrebbe dover restare in inglese`,
            originalSegment: term
          })
        }
      }
    }
  }
  
  return issues
}

function checkAccuracy(original: string, translated: string): ReviewIssue[] {
  const issues: ReviewIssue[] = []
  
  // Check for identical translation (potential untranslated)
  if (original === translated && original.length > 3 && !/^[A-Z0-9_]+$/.test(original)) {
    issues.push({
      id: 'accuracy-identical',
      category: 'accuracy',
      severity: 'warning',
      message: 'Translation is identical to original',
      messageIt: 'La traduzione è identica all\'originale',
      suggestion: 'Verify if translation is needed',
      suggestionIt: 'Verifica se è necessaria una traduzione'
    })
  }
  
  // Check for empty translation
  if (!translated.trim()) {
    issues.push({
      id: 'accuracy-empty',
      category: 'accuracy',
      severity: 'critical',
      message: 'Translation is empty',
      messageIt: 'La traduzione è vuota'
    })
  }
  
  // Check numbers preservation
  const originalNumbers: string[] = original.match(/\d+/g) || []
  const translatedNumbers: string[] = translated.match(/\d+/g) || []
  
  for (const num of originalNumbers) {
    if (!translatedNumbers.includes(num)) {
      issues.push({
        id: `accuracy-number-${num}`,
        category: 'accuracy',
        severity: 'warning',
        message: `Number "${num}" from original not found in translation`,
        messageIt: `Il numero "${num}" dell'originale non trovato nella traduzione`,
        originalSegment: num
      })
    }
  }
  
  return issues
}

// Main review function
export function reviewTranslation(
  original: string,
  translated: string,
  targetLang: string = 'it',
  context?: string
): ReviewResult {
  const issues: ReviewIssue[] = []
  
  // Run all checks
  issues.push(...checkPlaceholders(original, translated))
  issues.push(...checkLength(original, translated))
  issues.push(...checkGrammar(translated, targetLang))
  issues.push(...checkStyle(original, translated))
  issues.push(...checkGamingTerms(original, translated, targetLang))
  issues.push(...checkAccuracy(original, translated))
  
  // Calculate score
  let score = 100
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical': score -= 25; break
      case 'warning': score -= 10; break
      case 'suggestion': score -= 3; break
      case 'info': score -= 1; break
    }
  }
  score = Math.max(0, Math.min(100, score))
  
  // Generate suggestions
  const suggestions: string[] = issues
    .filter(i => i.suggestion)
    .map(i => i.suggestion!)
  
  return {
    translationId: `review-${Date.now()}`,
    original,
    translated,
    score,
    issues,
    suggestions,
    autoFixAvailable: issues.some(i => 
      i.category === 'grammar' && 
      ['grammar-double-space', 'grammar-space-before-punct'].includes(i.id)
    ),
    reviewedAt: new Date()
  }
}

// Batch review
export function reviewBatch(
  translations: Array<{ id: string; original: string; translated: string }>,
  targetLang: string = 'it'
): { results: ReviewResult[]; stats: ReviewStats } {
  const results = translations.map(t => ({
    ...reviewTranslation(t.original, t.translated, targetLang),
    translationId: t.id
  }))
  
  const issuesByCategory: Record<ReviewCategory, number> = {
    accuracy: 0, consistency: 0, grammar: 0, style: 0,
    placeholder: 0, length: 0, cultural: 0, gaming: 0
  }
  
  const issuesBySeverity: Record<ReviewSeverity, number> = {
    critical: 0, warning: 0, suggestion: 0, info: 0
  }
  
  for (const result of results) {
    for (const issue of result.issues) {
      issuesByCategory[issue.category]++
      issuesBySeverity[issue.severity]++
    }
  }
  
  const stats: ReviewStats = {
    total: results.length,
    reviewed: results.length,
    passed: results.filter(r => r.score >= 80).length,
    failed: results.filter(r => r.score < 60).length,
    avgScore: Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length),
    issuesByCategory,
    issuesBySeverity
  }
  
  return { results, stats }
}

// Auto-fix function
export function autoFix(translated: string): string {
  let fixed = translated
  
  // Fix double spaces
  fixed = fixed.replace(/\s{2,}/g, ' ')
  
  // Fix space before punctuation
  fixed = fixed.replace(/\s([.,!?;:])/g, '$1')
  
  // Fix missing space after punctuation (but not for numbers like 1.5)
  fixed = fixed.replace(/([.,!?;:])([a-zA-ZÀ-ÿ])/g, '$1 $2')
  
  return fixed.trim()
}
