/**
 * Translation Confidence Heatmap System
 * Analizza le traduzioni e genera punteggi di confidenza visualizzabili
 */

import { analyzeEmotion } from './emotion-analyzer'
import { calculateSimilarity } from './translation-memory'

// Cache TM per evitare import dinamici ripetuti
let tmManagerInstance: any = null

export type ConfidenceLevel = 'critical' | 'low' | 'medium' | 'high' | 'perfect'

export interface ConfidenceMetrics {
  // Punteggi individuali (0-100)
  lengthRatio: number        // Rapporto lunghezza originale/tradotto
  placeholderMatch: number   // Placeholder preservati correttamente
  numberMatch: number        // Numeri preservati
  punctuationMatch: number   // Punteggiatura coerente
  capitalizationMatch: number // Maiuscole/minuscole coerenti
  consistencyScore: number   // Coerenza con traduzioni simili
  formatPreservation: number // Tag HTML/formattazione preservati
  emotionMatch: number       // Tono emotivo preservato (se rilevante)
}

export interface ConfidenceResult {
  score: number              // Punteggio finale 0-100
  level: ConfidenceLevel     // Livello categorico
  color: string              // Colore per heatmap
  bgColor: string            // Background color
  metrics: ConfidenceMetrics // Dettaglio metriche
  issues: ConfidenceIssue[]  // Problemi rilevati
  suggestions: string[]      // Suggerimenti miglioramento
}

export interface ConfidenceIssue {
  type: 'error' | 'warning' | 'info'
  code: string
  message: string
  messageIt: string
}

export interface TranslationPair {
  id: string
  original: string
  translated: string
  context?: string
  metadata?: Record<string, any>
}

export interface HeatmapData {
  pairs: TranslationPair[]
  results: Map<string, ConfidenceResult>
  summary: HeatmapSummary
}

export interface HeatmapSummary {
  total: number
  critical: number
  low: number
  medium: number
  high: number
  perfect: number
  averageScore: number
  topIssues: { code: string; count: number; message: string }[]
}

// Configurazione colori per heatmap
export const CONFIDENCE_COLORS: Record<ConfidenceLevel, { color: string; bg: string; label: string; labelIt: string }> = {
  critical: { 
    color: '#ef4444', // red-500
    bg: '#fef2f2',    // red-50
    label: 'Critical',
    labelIt: 'Critico'
  },
  low: { 
    color: '#f97316', // orange-500
    bg: '#fff7ed',    // orange-50
    label: 'Low',
    labelIt: 'Basso'
  },
  medium: { 
    color: '#eab308', // yellow-500
    bg: '#fefce8',    // yellow-50
    label: 'Medium',
    labelIt: 'Medio'
  },
  high: { 
    color: '#22c55e', // green-500
    bg: '#f0fdf4',    // green-50
    label: 'High',
    labelIt: 'Alto'
  },
  perfect: { 
    color: '#10b981', // emerald-500
    bg: '#ecfdf5',    // emerald-50
    label: 'Perfect',
    labelIt: 'Perfetto'
  }
}

// Soglie per livelli di confidenza
const THRESHOLDS = {
  critical: 40,
  low: 60,
  medium: 75,
  high: 90,
  perfect: 100
}

/**
 * Calcola il rapporto di lunghezza tra originale e traduzione
 * Lingue diverse hanno espansione/contrazione tipica
 */
function calculateLengthRatio(original: string, translated: string): number {
  if (!original || !translated) return 0
  
  const origLen = original.length
  const transLen = translated.length
  
  // Rapporto ideale varia per lingua, usiamo range accettabile 0.5-2.0
  const ratio = transLen / origLen
  
  if (ratio >= 0.7 && ratio <= 1.5) return 100
  if (ratio >= 0.5 && ratio <= 2.0) return 80
  if (ratio >= 0.3 && ratio <= 3.0) return 50
  return 20
}

/**
 * Verifica che i placeholder siano preservati
 */
function checkPlaceholders(original: string, translated: string): { score: number; missing: string[] } {
  // Pattern comuni per placeholder
  const patterns = [
    /\{[^}]+\}/g,           // {variable}
    /%[sd@]/g,              // %s, %d, %@
    /\$\{[^}]+\}/g,         // ${variable}
    /<[^>]+>/g,             // <tag>
    /\[\[[^\]]+\]\]/g,      // [[variable]]
    /{{[^}]+}}/g,           // {{variable}}
    /#\{[^}]+\}/g,          // #{variable} (Ruby)
  ]
  
  const originalPlaceholders = new Set<string>()
  const translatedPlaceholders = new Set<string>()
  
  for (const pattern of patterns) {
    const origMatches = original.match(pattern) || []
    const transMatches = translated.match(pattern) || []
    
    origMatches.forEach(m => originalPlaceholders.add(m))
    transMatches.forEach(m => translatedPlaceholders.add(m))
  }
  
  if (originalPlaceholders.size === 0) {
    return { score: 100, missing: [] }
  }
  
  const missing: string[] = []
  for (const ph of originalPlaceholders) {
    if (!translatedPlaceholders.has(ph)) {
      missing.push(ph)
    }
  }
  
  const matchRate = (originalPlaceholders.size - missing.length) / originalPlaceholders.size
  return { score: Math.round(matchRate * 100), missing }
}

/**
 * Verifica che i numeri siano preservati
 */
function checkNumbers(original: string, translated: string): { score: number; missing: string[] } {
  const numberPattern = /\d+([.,]\d+)?/g
  
  const origNumbers = original.match(numberPattern) || []
  const transNumbers = translated.match(numberPattern) || []
  
  if (origNumbers.length === 0) {
    return { score: 100, missing: [] }
  }
  
  const missing: string[] = []
  const transNumberSet = new Set(transNumbers)
  
  for (const num of origNumbers) {
    // Considera anche formati diversi (1,000 vs 1.000)
    const normalized = num.replace(',', '.')
    const altFormat = num.replace('.', ',')
    
    if (!transNumberSet.has(num) && !transNumberSet.has(normalized) && !transNumberSet.has(altFormat)) {
      missing.push(num)
    }
  }
  
  const matchRate = (origNumbers.length - missing.length) / origNumbers.length
  return { score: Math.round(matchRate * 100), missing }
}

/**
 * Verifica coerenza punteggiatura
 */
function checkPunctuation(original: string, translated: string): number {
  // Punteggiatura finale dovrebbe essere coerente
  const endPunctuation = /[.!?…]$/
  
  const origEnds = original.trim().match(endPunctuation)
  const transEnds = translated.trim().match(endPunctuation)
  
  // Se originale ha punteggiatura finale, traduzione dovrebbe averla
  if (origEnds && !transEnds) return 60
  if (!origEnds && transEnds) return 80 // Meno grave
  
  // Verifica esclamazioni/domande
  const origExclaim = (original.match(/!/g) || []).length
  const transExclaim = (translated.match(/!/g) || []).length
  const origQuestion = (original.match(/\?/g) || []).length
  const transQuestion = (translated.match(/\?/g) || []).length
  
  let score = 100
  
  // Penalizza se manca enfasi
  if (origExclaim > 0 && transExclaim === 0) score -= 20
  if (origQuestion > 0 && transQuestion === 0) score -= 30
  
  return Math.max(0, score)
}

/**
 * Verifica capitalizzazione
 */
function checkCapitalization(original: string, translated: string): number {
  // Se originale è TUTTO MAIUSCOLO, traduzione dovrebbe esserlo
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    if (translated !== translated.toUpperCase()) {
      return 60
    }
  }
  
  // Prima lettera maiuscola
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    if (translated[0] !== translated[0].toUpperCase()) {
      return 80
    }
  }
  
  return 100
}

/**
 * Verifica preservazione tag/formattazione
 */
function checkFormatPreservation(original: string, translated: string): { score: number; missing: string[] } {
  // Tag HTML/XML
  const tagPattern = /<\/?[a-zA-Z][^>]*>/g
  
  const origTags = original.match(tagPattern) || []
  const transTags = translated.match(tagPattern) || []
  
  if (origTags.length === 0) {
    return { score: 100, missing: [] }
  }
  
  const missing: string[] = []
  const transTagSet = new Set(transTags.map(t => t.toLowerCase()))
  
  for (const tag of origTags) {
    if (!transTagSet.has(tag.toLowerCase())) {
      missing.push(tag)
    }
  }
  
  const matchRate = (origTags.length - missing.length) / origTags.length
  return { score: Math.round(matchRate * 100), missing }
}

/**
 * Genera issue basate sui problemi trovati
 */
function generateIssues(
  original: string,
  translated: string,
  metrics: ConfidenceMetrics
): ConfidenceIssue[] {
  const issues: ConfidenceIssue[] = []
  
  // Traduzione vuota
  if (!translated || translated.trim() === '') {
    issues.push({
      type: 'error',
      code: 'EMPTY_TRANSLATION',
      message: 'Translation is empty',
      messageIt: 'Traduzione vuota'
    })
    return issues
  }
  
  // Traduzione identica all'originale
  if (original.trim() === translated.trim()) {
    issues.push({
      type: 'warning',
      code: 'IDENTICAL_TRANSLATION',
      message: 'Translation is identical to original',
      messageIt: 'Traduzione identica all\'originale'
    })
  }
  
  // Lunghezza sospetta
  if (metrics.lengthRatio < 50) {
    issues.push({
      type: 'warning',
      code: 'LENGTH_MISMATCH',
      message: 'Unusual length difference between original and translation',
      messageIt: 'Differenza di lunghezza insolita'
    })
  }
  
  // Placeholder mancanti
  if (metrics.placeholderMatch < 100) {
    issues.push({
      type: 'error',
      code: 'MISSING_PLACEHOLDER',
      message: 'Some placeholders are missing in translation',
      messageIt: 'Alcuni placeholder mancano nella traduzione'
    })
  }
  
  // Numeri mancanti
  if (metrics.numberMatch < 100) {
    issues.push({
      type: 'error',
      code: 'MISSING_NUMBER',
      message: 'Some numbers are missing in translation',
      messageIt: 'Alcuni numeri mancano nella traduzione'
    })
  }
  
  // Punteggiatura incoerente
  if (metrics.punctuationMatch < 80) {
    issues.push({
      type: 'warning',
      code: 'PUNCTUATION_MISMATCH',
      message: 'Punctuation differs significantly',
      messageIt: 'Punteggiatura significativamente diversa'
    })
  }
  
  // Capitalizzazione
  if (metrics.capitalizationMatch < 80) {
    issues.push({
      type: 'info',
      code: 'CAPITALIZATION_CHANGE',
      message: 'Capitalization style changed',
      messageIt: 'Stile maiuscole/minuscole cambiato'
    })
  }
  
  // Tag/formattazione
  if (metrics.formatPreservation < 100) {
    issues.push({
      type: 'error',
      code: 'MISSING_TAGS',
      message: 'Some HTML/format tags are missing',
      messageIt: 'Alcuni tag HTML/formattazione mancano'
    })
  }
  
  return issues
}

/**
 * Genera suggerimenti basati sui problemi
 */
function generateSuggestions(issues: ConfidenceIssue[]): string[] {
  const suggestions: string[] = []
  
  for (const issue of issues) {
    switch (issue.code) {
      case 'EMPTY_TRANSLATION':
        suggestions.push('Aggiungi una traduzione per questo testo')
        break
      case 'IDENTICAL_TRANSLATION':
        suggestions.push('Verifica se il testo necessita realmente traduzione')
        break
      case 'MISSING_PLACEHOLDER':
        suggestions.push('Assicurati di includere tutti i placeholder ({}, %s, etc.)')
        break
      case 'MISSING_NUMBER':
        suggestions.push('Verifica che tutti i numeri siano presenti')
        break
      case 'PUNCTUATION_MISMATCH':
        suggestions.push('Controlla la punteggiatura finale (! ? .)')
        break
      case 'MISSING_TAGS':
        suggestions.push('Preserva i tag HTML/formattazione originali')
        break
    }
  }
  
  return [...new Set(suggestions)] // Rimuovi duplicati
}

/**
 * Calcola score di coerenza basato su pattern linguistici e Translation Memory
 */
function calculateConsistencyScore(
  original: string, 
  translated: string,
  tmMatches?: Array<{ sourceText: string; targetText: string; similarity: number }>
): number {
  let score = 100
  
  // Penalizza se traduzione identica all'originale (potrebbe essere non tradotto)
  if (original === translated && original.length > 5) {
    score -= 30
  }
  
  // Controlla coerenza strutturale (stesso numero di frasi approssimativo)
  const originalSentences = original.split(/[.!?]+/).filter(s => s.trim())
  const translatedSentences = translated.split(/[.!?]+/).filter(s => s.trim())
  
  if (originalSentences.length > 0) {
    const sentenceRatio = translatedSentences.length / originalSentences.length
    if (sentenceRatio < 0.5 || sentenceRatio > 2) {
      score -= 15
    }
  }
  
  // Controlla se parole chiave tecniche sono preservate
  const techTerms = original.match(/\b[A-Z][a-z]*[A-Z]\w*\b/g) || [] // CamelCase
  for (const term of techTerms) {
    if (!translated.includes(term)) {
      score -= 5
    }
  }
  
  // Verifica coerenza con Translation Memory
  if (tmMatches && tmMatches.length > 0) {
    // Trova il match più simile
    const bestMatch = tmMatches.reduce((best, m) => 
      m.similarity > best.similarity ? m : best, tmMatches[0])
    
    if (bestMatch.similarity >= 90) {
      // Per originali molto simili, verifica che le traduzioni siano coerenti
      const translationSimilarity = calculateSimilarity(translated, bestMatch.targetText)
      
      if (translationSimilarity >= 80) {
        // Traduzioni coerenti: bonus
        score = Math.min(100, score + 10)
      } else if (translationSimilarity < 50) {
        // Traduzioni molto diverse per testi simili: penalità
        score -= 20
      }
    }
  }
  
  return Math.max(0, Math.min(100, score))
}

/**
 * Calcola match emotivo tra originale e traduzione usando emotion-analyzer
 */
function calculateEmotionMatch(original: string, translated: string): number {
  try {
    const originalEmotion = analyzeEmotion(original)
    const translatedEmotion = analyzeEmotion(translated)
    
    // Se stessa emozione primaria, score alto
    if (originalEmotion.primary === translatedEmotion.primary) {
      // Bonus se anche l'intensità è simile
      if (originalEmotion.intensity === translatedEmotion.intensity) {
        return 100
      }
      return 90
    }
    
    // Se emozione neutra nell'originale, la traduzione può variare
    if (originalEmotion.primary === 'neutral') {
      return 85
    }
    
    // Emozioni correlate (es. joy/excitement, anger/tension)
    const relatedEmotions: Record<string, string[]> = {
      'joy': ['excitement', 'surprise'],
      'excitement': ['joy', 'surprise'],
      'anger': ['tension', 'disgust'],
      'tension': ['anger', 'fear'],
      'sadness': ['fear', 'disgust'],
      'fear': ['tension', 'sadness'],
      'sarcasm': ['disgust', 'neutral']
    }
    
    const related = relatedEmotions[originalEmotion.primary] || []
    if (related.includes(translatedEmotion.primary)) {
      return 75
    }
    
    // Emozioni diverse
    return 50
  } catch {
    // Se analyzeEmotion fallisce, ritorna valore neutro
    return 85
  }
}

/**
 * Determina il livello di confidenza dal punteggio
 */
function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score < THRESHOLDS.critical) return 'critical'
  if (score < THRESHOLDS.low) return 'low'
  if (score < THRESHOLDS.medium) return 'medium'
  if (score < THRESHOLDS.high) return 'high'
  return 'perfect'
}

/**
 * Calcola la confidenza per una singola coppia traduzione
 */
export function calculateConfidence(
  original: string,
  translated: string,
  context?: string
): ConfidenceResult {
  // Caso speciale: traduzione vuota
  if (!translated || translated.trim() === '') {
    return {
      score: 0,
      level: 'critical',
      color: CONFIDENCE_COLORS.critical.color,
      bgColor: CONFIDENCE_COLORS.critical.bg,
      metrics: {
        lengthRatio: 0,
        placeholderMatch: 0,
        numberMatch: 0,
        punctuationMatch: 0,
        capitalizationMatch: 0,
        consistencyScore: 0,
        formatPreservation: 0,
        emotionMatch: 0
      },
      issues: [{
        type: 'error',
        code: 'EMPTY_TRANSLATION',
        message: 'Translation is empty',
        messageIt: 'Traduzione vuota'
      }],
      suggestions: ['Aggiungi una traduzione per questo testo']
    }
  }
  
  // Calcola metriche individuali
  const placeholderCheck = checkPlaceholders(original, translated)
  const numberCheck = checkNumbers(original, translated)
  const formatCheck = checkFormatPreservation(original, translated)
  
  const metrics: ConfidenceMetrics = {
    lengthRatio: calculateLengthRatio(original, translated),
    placeholderMatch: placeholderCheck.score,
    numberMatch: numberCheck.score,
    punctuationMatch: checkPunctuation(original, translated),
    capitalizationMatch: checkCapitalization(original, translated),
    consistencyScore: calculateConsistencyScore(original, translated),
    formatPreservation: formatCheck.score,
    emotionMatch: calculateEmotionMatch(original, translated)
  }
  
  // Pesi per calcolo punteggio finale
  const weights = {
    lengthRatio: 0.10,
    placeholderMatch: 0.25,  // Critico
    numberMatch: 0.20,       // Molto importante
    punctuationMatch: 0.10,
    capitalizationMatch: 0.05,
    consistencyScore: 0.10,
    formatPreservation: 0.15,
    emotionMatch: 0.05
  }
  
  // Calcola punteggio pesato
  let score = 0
  for (const [key, weight] of Object.entries(weights)) {
    score += metrics[key as keyof ConfidenceMetrics] * weight
  }
  score = Math.round(score)
  
  // Penalità aggiuntive per errori critici
  if (metrics.placeholderMatch < 100) score = Math.min(score, 60)
  if (metrics.numberMatch < 100) score = Math.min(score, 70)
  if (metrics.formatPreservation < 100) score = Math.min(score, 75)
  
  const level = getConfidenceLevel(score)
  const issues = generateIssues(original, translated, metrics)
  const suggestions = generateSuggestions(issues)
  
  return {
    score,
    level,
    color: CONFIDENCE_COLORS[level].color,
    bgColor: CONFIDENCE_COLORS[level].bg,
    metrics,
    issues,
    suggestions
  }
}

/**
 * Calcola confidenza per un batch di traduzioni
 */
export function calculateBatchConfidence(pairs: TranslationPair[]): HeatmapData {
  const results = new Map<string, ConfidenceResult>()
  
  // Calcola confidenza per ogni coppia
  for (const pair of pairs) {
    const result = calculateConfidence(pair.original, pair.translated, pair.context)
    results.set(pair.id, result)
  }
  
  // Genera summary
  const summary: HeatmapSummary = {
    total: pairs.length,
    critical: 0,
    low: 0,
    medium: 0,
    high: 0,
    perfect: 0,
    averageScore: 0,
    topIssues: []
  }
  
  const issueCounts = new Map<string, { count: number; message: string }>()
  let totalScore = 0
  
  for (const [_, result] of results) {
    totalScore += result.score
    summary[result.level]++
    
    for (const issue of result.issues) {
      const existing = issueCounts.get(issue.code)
      if (existing) {
        existing.count++
      } else {
        issueCounts.set(issue.code, { count: 1, message: issue.messageIt })
      }
    }
  }
  
  summary.averageScore = pairs.length > 0 ? Math.round(totalScore / pairs.length) : 0
  
  // Top issues
  summary.topIssues = Array.from(issueCounts.entries())
    .map(([code, data]) => ({ code, count: data.count, message: data.message }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  
  return { pairs, results, summary }
}

/**
 * Esporta dati heatmap in formato per grafico
 */
export function getHeatmapChartData(heatmapData: HeatmapData): {
  distribution: { level: string; count: number; color: string }[]
  scoreDistribution: { range: string; count: number }[]
} {
  const distribution = [
    { level: 'Critico', count: heatmapData.summary.critical, color: CONFIDENCE_COLORS.critical.color },
    { level: 'Basso', count: heatmapData.summary.low, color: CONFIDENCE_COLORS.low.color },
    { level: 'Medio', count: heatmapData.summary.medium, color: CONFIDENCE_COLORS.medium.color },
    { level: 'Alto', count: heatmapData.summary.high, color: CONFIDENCE_COLORS.high.color },
    { level: 'Perfetto', count: heatmapData.summary.perfect, color: CONFIDENCE_COLORS.perfect.color },
  ]
  
  // Distribuzione per range di punteggio
  const ranges = [
    { range: '0-20', min: 0, max: 20, count: 0 },
    { range: '21-40', min: 21, max: 40, count: 0 },
    { range: '41-60', min: 41, max: 60, count: 0 },
    { range: '61-80', min: 61, max: 80, count: 0 },
    { range: '81-100', min: 81, max: 100, count: 0 },
  ]
  
  for (const [_, result] of heatmapData.results) {
    for (const range of ranges) {
      if (result.score >= range.min && result.score <= range.max) {
        range.count++
        break
      }
    }
  }
  
  return {
    distribution,
    scoreDistribution: ranges.map(r => ({ range: r.range, count: r.count }))
  }
}

/**
 * Filtra traduzioni per livello di confidenza
 */
export function filterByConfidenceLevel(
  heatmapData: HeatmapData,
  levels: ConfidenceLevel[]
): TranslationPair[] {
  return heatmapData.pairs.filter(pair => {
    const result = heatmapData.results.get(pair.id)
    return result && levels.includes(result.level)
  })
}

/**
 * Ordina traduzioni per punteggio (ascendente = problemi prima)
 */
export function sortByConfidence(
  heatmapData: HeatmapData,
  ascending: boolean = true
): TranslationPair[] {
  return [...heatmapData.pairs].sort((a, b) => {
    const scoreA = heatmapData.results.get(a.id)?.score || 0
    const scoreB = heatmapData.results.get(b.id)?.score || 0
    return ascending ? scoreA - scoreB : scoreB - scoreA
  })
}

/**
 * Calcola confidenza batch con supporto Translation Memory
 * Usa la TM per verificare coerenza tra traduzioni simili
 */
export async function calculateBatchConfidenceWithTM(
  pairs: TranslationPair[],
  sourceLang: string = 'en',
  targetLang: string = 'it'
): Promise<HeatmapData> {
  try {
    // Import dinamico per evitare dipendenze circolari
    const { TranslationMemoryManager } = await import('./translation-memory')
    
    if (!tmManagerInstance) {
      tmManagerInstance = new TranslationMemoryManager()
    }
    await tmManagerInstance.initialize(sourceLang, targetLang)
    
    const results = new Map<string, ConfidenceResult>()
    
    // Calcola confidenza per ogni coppia con supporto TM
    for (const pair of pairs) {
      // Cerca match nella TM per verificare coerenza
      const tmResults = tmManagerInstance.search(pair.original, {
        minSimilarity: 70,
        maxResults: 3
      })
      
      const tmMatches = tmResults.map((r: any) => ({
        sourceText: r.unit.sourceText,
        targetText: r.unit.targetText,
        similarity: r.similarity
      }))
      
      // Calcola metriche base
      const placeholderCheck = checkPlaceholders(pair.original, pair.translated)
      const numberCheck = checkNumbers(pair.original, pair.translated)
      const formatCheck = checkFormatPreservation(pair.original, pair.translated)
      
      const metrics: ConfidenceMetrics = {
        lengthRatio: calculateLengthRatio(pair.original, pair.translated),
        placeholderMatch: placeholderCheck.score,
        numberMatch: numberCheck.score,
        punctuationMatch: checkPunctuation(pair.original, pair.translated),
        capitalizationMatch: checkCapitalization(pair.original, pair.translated),
        consistencyScore: calculateConsistencyScore(pair.original, pair.translated, tmMatches),
        formatPreservation: formatCheck.score,
        emotionMatch: calculateEmotionMatch(pair.original, pair.translated)
      }
      
      // Calcola punteggio
      const weights = {
        lengthRatio: 0.10,
        placeholderMatch: 0.25,
        numberMatch: 0.20,
        punctuationMatch: 0.10,
        capitalizationMatch: 0.05,
        consistencyScore: 0.10,
        formatPreservation: 0.15,
        emotionMatch: 0.05
      }
      
      let score = 0
      for (const [key, weight] of Object.entries(weights)) {
        score += metrics[key as keyof ConfidenceMetrics] * weight
      }
      score = Math.round(score)
      
      if (metrics.placeholderMatch < 100) score = Math.min(score, 60)
      if (metrics.numberMatch < 100) score = Math.min(score, 70)
      if (metrics.formatPreservation < 100) score = Math.min(score, 75)
      
      const level = getConfidenceLevel(score)
      const issues = generateIssues(pair.original, pair.translated, metrics)
      const suggestions = generateSuggestions(issues)
      
      results.set(pair.id, {
        score,
        level,
        color: CONFIDENCE_COLORS[level].color,
        bgColor: CONFIDENCE_COLORS[level].bg,
        metrics,
        issues,
        suggestions
      })
    }
    
    // Genera summary
    const summary = generateSummary(pairs, results)
    
    return { pairs, results, summary }
  } catch (error) {
    // Fallback a calcolo senza TM
    return calculateBatchConfidence(pairs)
  }
}

/**
 * Genera summary per heatmap data
 */
function generateSummary(
  pairs: TranslationPair[], 
  results: Map<string, ConfidenceResult>
): HeatmapSummary {
  const summary: HeatmapSummary = {
    total: pairs.length,
    critical: 0,
    low: 0,
    medium: 0,
    high: 0,
    perfect: 0,
    averageScore: 0,
    topIssues: []
  }
  
  const issueCounts = new Map<string, { count: number; message: string }>()
  let totalScore = 0
  
  for (const [_, result] of results) {
    totalScore += result.score
    summary[result.level]++
    
    for (const issue of result.issues) {
      const existing = issueCounts.get(issue.code)
      if (existing) {
        existing.count++
      } else {
        issueCounts.set(issue.code, { count: 1, message: issue.messageIt })
      }
    }
  }
  
  summary.averageScore = pairs.length > 0 ? Math.round(totalScore / pairs.length) : 0
  summary.topIssues = Array.from(issueCounts.entries())
    .map(([code, data]) => ({ code, count: data.count, message: data.message }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  
  return summary
}
