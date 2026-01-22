/**
 * Cultural Adaptation System
 * Sistema per adattare traduzioni al contesto culturale locale
 */

export type CultureCode = 'it' | 'en' | 'de' | 'fr' | 'es' | 'ja' | 'ko' | 'zh' | 'pt' | 'ru'

export interface CultureProfile {
  code: CultureCode
  name: string
  nameNative: string
  flag: string
  region: string
  formality: 'formal' | 'informal' | 'mixed'
  humor: 'literal' | 'localized' | 'adapted'
  dateFormat: string
  numberFormat: { decimal: string; thousand: string }
  currency: string
  measurementSystem: 'metric' | 'imperial'
  textDirection: 'ltr' | 'rtl'
  honorifics: boolean
  genderNeutral: boolean
}

export interface AdaptationRule {
  id: string
  category: AdaptationCategory
  original: string | RegExp
  replacement: string
  description: string
  descriptionIt: string
  example?: { before: string; after: string }
  cultures: CultureCode[]
  severity: 'required' | 'recommended' | 'optional'
}

export type AdaptationCategory = 
  | 'units'        // Unità di misura
  | 'currency'     // Valuta
  | 'dates'        // Formato date
  | 'numbers'      // Formato numeri
  | 'idioms'       // Modi di dire
  | 'references'   // Riferimenti culturali
  | 'humor'        // Umorismo
  | 'formality'    // Formalità
  | 'symbols'      // Simboli
  | 'colors'       // Significato colori
  | 'names'        // Nomi/titoli
  | 'food'         // Cibo
  | 'sports'       // Sport

export interface AdaptationSuggestion {
  id: string
  category: AdaptationCategory
  originalText: string
  suggestedText: string
  reason: string
  reasonIt: string
  confidence: number
  rule?: AdaptationRule
}

export interface AdaptationResult {
  original: string
  adapted: string
  sourceCulture: CultureCode
  targetCulture: CultureCode
  suggestions: AdaptationSuggestion[]
  appliedRules: string[]
  culturalScore: number // 0-100
}

// Configurazione categorie
export const ADAPTATION_CATEGORIES: Record<AdaptationCategory, {
  label: string
  labelIt: string
  icon: string
  color: string
  description: string
  descriptionIt: string
}> = {
  units: {
    label: 'Units',
    labelIt: 'Unità',
    icon: '📏',
    color: '#3b82f6',
    description: 'Measurement unit conversions',
    descriptionIt: 'Conversione unità di misura'
  },
  currency: {
    label: 'Currency',
    labelIt: 'Valuta',
    icon: '💰',
    color: '#22c55e',
    description: 'Currency format and symbols',
    descriptionIt: 'Formato e simboli valuta'
  },
  dates: {
    label: 'Dates',
    labelIt: 'Date',
    icon: '📅',
    color: '#f59e0b',
    description: 'Date and time formats',
    descriptionIt: 'Formati data e ora'
  },
  numbers: {
    label: 'Numbers',
    labelIt: 'Numeri',
    icon: '🔢',
    color: '#8b5cf6',
    description: 'Number formatting',
    descriptionIt: 'Formattazione numeri'
  },
  idioms: {
    label: 'Idioms',
    labelIt: 'Modi di dire',
    icon: '💬',
    color: '#ec4899',
    description: 'Idiomatic expressions',
    descriptionIt: 'Espressioni idiomatiche'
  },
  references: {
    label: 'References',
    labelIt: 'Riferimenti',
    icon: '🎭',
    color: '#14b8a6',
    description: 'Cultural references',
    descriptionIt: 'Riferimenti culturali'
  },
  humor: {
    label: 'Humor',
    labelIt: 'Umorismo',
    icon: '😄',
    color: '#f97316',
    description: 'Humor adaptation',
    descriptionIt: 'Adattamento umorismo'
  },
  formality: {
    label: 'Formality',
    labelIt: 'Formalità',
    icon: '👔',
    color: '#6366f1',
    description: 'Formal/informal tone',
    descriptionIt: 'Tono formale/informale'
  },
  symbols: {
    label: 'Symbols',
    labelIt: 'Simboli',
    icon: '⚡',
    color: '#ef4444',
    description: 'Symbol meanings',
    descriptionIt: 'Significato simboli'
  },
  colors: {
    label: 'Colors',
    labelIt: 'Colori',
    icon: '🎨',
    color: '#a855f7',
    description: 'Color symbolism',
    descriptionIt: 'Simbolismo colori'
  },
  names: {
    label: 'Names',
    labelIt: 'Nomi',
    icon: '👤',
    color: '#0ea5e9',
    description: 'Name conventions',
    descriptionIt: 'Convenzioni nomi'
  },
  food: {
    label: 'Food',
    labelIt: 'Cibo',
    icon: '🍕',
    color: '#84cc16',
    description: 'Food references',
    descriptionIt: 'Riferimenti cibo'
  },
  sports: {
    label: 'Sports',
    labelIt: 'Sport',
    icon: '⚽',
    color: '#06b6d4',
    description: 'Sports references',
    descriptionIt: 'Riferimenti sportivi'
  }
}

// Profili culturali
export const CULTURE_PROFILES: Record<CultureCode, CultureProfile> = {
  it: {
    code: 'it',
    name: 'Italian',
    nameNative: 'Italiano',
    flag: '🇮🇹',
    region: 'Europe',
    formality: 'mixed',
    humor: 'adapted',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousand: '.' },
    currency: '€',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: true,
    genderNeutral: false
  },
  en: {
    code: 'en',
    name: 'English',
    nameNative: 'English',
    flag: '🇬🇧',
    region: 'Global',
    formality: 'informal',
    humor: 'literal',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: { decimal: '.', thousand: ',' },
    currency: '$',
    measurementSystem: 'imperial',
    textDirection: 'ltr',
    honorifics: false,
    genderNeutral: true
  },
  de: {
    code: 'de',
    name: 'German',
    nameNative: 'Deutsch',
    flag: '🇩🇪',
    region: 'Europe',
    formality: 'formal',
    humor: 'literal',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousand: '.' },
    currency: '€',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: true,
    genderNeutral: false
  },
  fr: {
    code: 'fr',
    name: 'French',
    nameNative: 'Français',
    flag: '🇫🇷',
    region: 'Europe',
    formality: 'formal',
    humor: 'adapted',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousand: ' ' },
    currency: '€',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: true,
    genderNeutral: false
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nameNative: 'Español',
    flag: '🇪🇸',
    region: 'Global',
    formality: 'mixed',
    humor: 'adapted',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousand: '.' },
    currency: '€',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: true,
    genderNeutral: false
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nameNative: '日本語',
    flag: '🇯🇵',
    region: 'Asia',
    formality: 'formal',
    humor: 'localized',
    dateFormat: 'YYYY/MM/DD',
    numberFormat: { decimal: '.', thousand: ',' },
    currency: '¥',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: true,
    genderNeutral: true
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nameNative: '한국어',
    flag: '🇰🇷',
    region: 'Asia',
    formality: 'formal',
    humor: 'localized',
    dateFormat: 'YYYY.MM.DD',
    numberFormat: { decimal: '.', thousand: ',' },
    currency: '₩',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: true,
    genderNeutral: true
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nameNative: '中文',
    flag: '🇨🇳',
    region: 'Asia',
    formality: 'formal',
    humor: 'localized',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: { decimal: '.', thousand: ',' },
    currency: '¥',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: true,
    genderNeutral: true
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nameNative: 'Português',
    flag: '🇧🇷',
    region: 'Global',
    formality: 'informal',
    humor: 'adapted',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: { decimal: ',', thousand: '.' },
    currency: 'R$',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: false,
    genderNeutral: false
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nameNative: 'Русский',
    flag: '🇷🇺',
    region: 'Europe/Asia',
    formality: 'formal',
    humor: 'literal',
    dateFormat: 'DD.MM.YYYY',
    numberFormat: { decimal: ',', thousand: ' ' },
    currency: '₽',
    measurementSystem: 'metric',
    textDirection: 'ltr',
    honorifics: true,
    genderNeutral: false
  }
}

// Regole di adattamento EN -> IT
const EN_TO_IT_RULES: AdaptationRule[] = [
  // Units
  {
    id: 'unit-miles',
    category: 'units',
    original: /(\d+(?:\.\d+)?)\s*miles?/gi,
    replacement: '$1 km',
    description: 'Convert miles to kilometers',
    descriptionIt: 'Converti miglia in chilometri',
    example: { before: '5 miles away', after: '8 km di distanza' },
    cultures: ['it', 'de', 'fr', 'es'],
    severity: 'recommended'
  },
  {
    id: 'unit-feet',
    category: 'units',
    original: /(\d+(?:\.\d+)?)\s*(?:feet|ft)/gi,
    replacement: '$1 m',
    description: 'Convert feet to meters',
    descriptionIt: 'Converti piedi in metri',
    example: { before: '6 feet tall', after: '1,8 m di altezza' },
    cultures: ['it', 'de', 'fr', 'es'],
    severity: 'recommended'
  },
  {
    id: 'unit-pounds',
    category: 'units',
    original: /(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?)/gi,
    replacement: '$1 kg',
    description: 'Convert pounds to kilograms',
    descriptionIt: 'Converti libbre in chilogrammi',
    cultures: ['it', 'de', 'fr', 'es'],
    severity: 'recommended'
  },
  {
    id: 'unit-fahrenheit',
    category: 'units',
    original: /(\d+(?:\.\d+)?)\s*°?\s*F(?:ahrenheit)?/gi,
    replacement: '$1°C',
    description: 'Convert Fahrenheit to Celsius',
    descriptionIt: 'Converti Fahrenheit in Celsius',
    cultures: ['it', 'de', 'fr', 'es'],
    severity: 'required'
  },
  // Currency
  {
    id: 'currency-dollar',
    category: 'currency',
    original: /\$\s*(\d+(?:[.,]\d+)?)/g,
    replacement: '€$1',
    description: 'Convert dollar symbol to euro',
    descriptionIt: 'Converti simbolo dollaro in euro',
    cultures: ['it', 'de', 'fr', 'es'],
    severity: 'optional'
  },
  // Numbers
  {
    id: 'number-decimal',
    category: 'numbers',
    original: /(\d+)\.(\d+)/g,
    replacement: '$1,$2',
    description: 'Use comma as decimal separator',
    descriptionIt: 'Usa virgola come separatore decimale',
    cultures: ['it', 'de', 'fr', 'es'],
    severity: 'required'
  },
  // Idioms
  {
    id: 'idiom-piece-of-cake',
    category: 'idioms',
    original: /piece of cake/gi,
    replacement: 'un gioco da ragazzi',
    description: 'Localize "piece of cake" idiom',
    descriptionIt: 'Localizza l\'espressione "piece of cake"',
    example: { before: "This is a piece of cake!", after: "È un gioco da ragazzi!" },
    cultures: ['it'],
    severity: 'recommended'
  },
  {
    id: 'idiom-break-a-leg',
    category: 'idioms',
    original: /break a leg/gi,
    replacement: 'in bocca al lupo',
    description: 'Localize "break a leg" idiom',
    descriptionIt: 'Localizza l\'espressione "break a leg"',
    cultures: ['it'],
    severity: 'recommended'
  },
  {
    id: 'idiom-raining-cats',
    category: 'idioms',
    original: /raining cats and dogs/gi,
    replacement: 'piove a catinelle',
    description: 'Localize weather idiom',
    descriptionIt: 'Localizza modo di dire sul meteo',
    cultures: ['it'],
    severity: 'recommended'
  },
  // Sports references
  {
    id: 'sport-baseball',
    category: 'sports',
    original: /hit a home run/gi,
    replacement: 'fare centro',
    description: 'Adapt baseball reference',
    descriptionIt: 'Adatta riferimento al baseball',
    cultures: ['it'],
    severity: 'recommended'
  },
  {
    id: 'sport-football-us',
    category: 'sports',
    original: /touchdown/gi,
    replacement: 'gol',
    description: 'Adapt American football reference',
    descriptionIt: 'Adatta riferimento al football americano',
    cultures: ['it'],
    severity: 'optional'
  },
  // Food
  {
    id: 'food-thanksgiving',
    category: 'food',
    original: /Thanksgiving/gi,
    replacement: 'Festa del Ringraziamento',
    description: 'Explain Thanksgiving',
    descriptionIt: 'Spiega Thanksgiving',
    cultures: ['it', 'de', 'fr', 'es'],
    severity: 'required'
  },
  // Colors (symbolic meaning)
  {
    id: 'color-green-envy',
    category: 'colors',
    original: /green with envy/gi,
    replacement: 'verde dall\'invidia',
    description: 'Preserve color idiom',
    descriptionIt: 'Preserva modo di dire con colore',
    cultures: ['it'],
    severity: 'recommended'
  },
  // Formality
  {
    id: 'formality-you',
    category: 'formality',
    original: /\byou\b/gi,
    replacement: 'tu/Lei',
    description: 'Consider formal/informal "you"',
    descriptionIt: 'Considera tu/Lei formale/informale',
    cultures: ['it', 'de', 'fr', 'es'],
    severity: 'optional'
  }
]

// Funzioni di analisi

function detectUnits(text: string): AdaptationSuggestion[] {
  const suggestions: AdaptationSuggestion[] = []
  
  // Miles
  const milesMatch = text.match(/(\d+(?:\.\d+)?)\s*miles?/gi)
  if (milesMatch) {
    for (const match of milesMatch) {
      const num = parseFloat(match.replace(/[^\d.]/g, ''))
      const km = (num * 1.60934).toFixed(1)
      suggestions.push({
        id: `unit-miles-${num}`,
        category: 'units',
        originalText: match,
        suggestedText: `${km} km`,
        reason: `Convert ${num} miles to ${km} kilometers`,
        reasonIt: `Converti ${num} miglia in ${km} chilometri`,
        confidence: 95
      })
    }
  }
  
  // Feet
  const feetMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:feet|ft)/gi)
  if (feetMatch) {
    for (const match of feetMatch) {
      const num = parseFloat(match.replace(/[^\d.]/g, ''))
      const m = (num * 0.3048).toFixed(1)
      suggestions.push({
        id: `unit-feet-${num}`,
        category: 'units',
        originalText: match,
        suggestedText: `${m} m`,
        reason: `Convert ${num} feet to ${m} meters`,
        reasonIt: `Converti ${num} piedi in ${m} metri`,
        confidence: 95
      })
    }
  }
  
  // Fahrenheit
  const fahrenheitMatch = text.match(/(\d+(?:\.\d+)?)\s*°?\s*F(?:ahrenheit)?/gi)
  if (fahrenheitMatch) {
    for (const match of fahrenheitMatch) {
      const num = parseFloat(match.replace(/[^\d.]/g, ''))
      const c = ((num - 32) * 5 / 9).toFixed(0)
      suggestions.push({
        id: `unit-fahrenheit-${num}`,
        category: 'units',
        originalText: match,
        suggestedText: `${c}°C`,
        reason: `Convert ${num}°F to ${c}°C`,
        reasonIt: `Converti ${num}°F in ${c}°C`,
        confidence: 100
      })
    }
  }
  
  return suggestions
}

function detectIdioms(text: string, targetCulture: CultureCode): AdaptationSuggestion[] {
  const suggestions: AdaptationSuggestion[] = []
  
  for (const rule of EN_TO_IT_RULES.filter(r => r.category === 'idioms')) {
    if (!rule.cultures.includes(targetCulture)) continue
    
    const regex = rule.original instanceof RegExp ? rule.original : new RegExp(rule.original, 'gi')
    const match = text.match(regex)
    
    if (match) {
      suggestions.push({
        id: rule.id,
        category: 'idioms',
        originalText: match[0],
        suggestedText: rule.replacement,
        reason: rule.description,
        reasonIt: rule.descriptionIt,
        confidence: 85,
        rule
      })
    }
  }
  
  return suggestions
}

function detectCulturalReferences(text: string): AdaptationSuggestion[] {
  const suggestions: AdaptationSuggestion[] = []
  const textLower = text.toLowerCase()
  
  // American holidays
  if (textLower.includes('thanksgiving')) {
    suggestions.push({
      id: 'ref-thanksgiving',
      category: 'references',
      originalText: 'Thanksgiving',
      suggestedText: 'Festa del Ringraziamento',
      reason: 'American holiday not celebrated in target culture',
      reasonIt: 'Festività americana non celebrata nella cultura target',
      confidence: 90
    })
  }
  
  if (textLower.includes('fourth of july') || textLower.includes('4th of july')) {
    suggestions.push({
      id: 'ref-july4',
      category: 'references',
      originalText: 'Fourth of July',
      suggestedText: 'Festa dell\'Indipendenza americana (4 luglio)',
      reason: 'American holiday - add context',
      reasonIt: 'Festività americana - aggiungi contesto',
      confidence: 85
    })
  }
  
  // Sports
  if (textLower.includes('super bowl')) {
    suggestions.push({
      id: 'ref-superbowl',
      category: 'sports',
      originalText: 'Super Bowl',
      suggestedText: 'Super Bowl (finale campionato football americano)',
      reason: 'American sports event - may need context',
      reasonIt: 'Evento sportivo americano - potrebbe servire contesto',
      confidence: 70
    })
  }
  
  return suggestions
}

function detectNumberFormat(text: string, targetCulture: CultureCode): AdaptationSuggestion[] {
  const suggestions: AdaptationSuggestion[] = []
  const profile = CULTURE_PROFILES[targetCulture]
  
  // Find decimal numbers with period
  const decimalMatch = text.match(/\b\d+\.\d+\b/g)
  if (decimalMatch && profile.numberFormat.decimal === ',') {
    for (const match of decimalMatch) {
      suggestions.push({
        id: `number-decimal-${match}`,
        category: 'numbers',
        originalText: match,
        suggestedText: match.replace('.', ','),
        reason: `Use local decimal separator (${profile.numberFormat.decimal})`,
        reasonIt: `Usa separatore decimale locale (${profile.numberFormat.decimal})`,
        confidence: 95
      })
    }
  }
  
  return suggestions
}

// Main adaptation function
export function analyzeForAdaptation(
  text: string,
  sourceCulture: CultureCode = 'en',
  targetCulture: CultureCode = 'it'
): AdaptationResult {
  const suggestions: AdaptationSuggestion[] = []
  
  // Run all detectors
  suggestions.push(...detectUnits(text))
  suggestions.push(...detectIdioms(text, targetCulture))
  suggestions.push(...detectCulturalReferences(text))
  suggestions.push(...detectNumberFormat(text, targetCulture))
  
  // Calculate cultural score
  let score = 100
  for (const suggestion of suggestions) {
    if (suggestion.confidence >= 90) score -= 15
    else if (suggestion.confidence >= 70) score -= 8
    else score -= 3
  }
  score = Math.max(0, Math.min(100, score))
  
  return {
    original: text,
    adapted: text, // Would be modified with AI in real implementation
    sourceCulture,
    targetCulture,
    suggestions,
    appliedRules: [],
    culturalScore: score
  }
}

// Batch analysis
export function analyzeForAdaptationBatch(
  texts: string[],
  sourceCulture: CultureCode = 'en',
  targetCulture: CultureCode = 'it'
): { results: AdaptationResult[]; summary: { total: number; withIssues: number; avgScore: number; byCategory: Record<AdaptationCategory, number> } } {
  const results = texts.map(t => analyzeForAdaptation(t, sourceCulture, targetCulture))
  
  const byCategory: Record<AdaptationCategory, number> = {
    units: 0, currency: 0, dates: 0, numbers: 0, idioms: 0,
    references: 0, humor: 0, formality: 0, symbols: 0, colors: 0,
    names: 0, food: 0, sports: 0
  }
  
  for (const result of results) {
    for (const suggestion of result.suggestions) {
      byCategory[suggestion.category]++
    }
  }
  
  return {
    results,
    summary: {
      total: results.length,
      withIssues: results.filter(r => r.suggestions.length > 0).length,
      avgScore: Math.round(results.reduce((sum, r) => sum + r.culturalScore, 0) / results.length),
      byCategory
    }
  }
}
