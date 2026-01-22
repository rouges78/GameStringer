/**
 * Emotion-Aware Translation System
 * Analizza il sentiment/emozione del testo e adatta il tono della traduzione
 */

// Emozioni supportate con i loro marker linguistici
export type EmotionType = 
  | 'anger'      // Rabbia
  | 'joy'        // Gioia
  | 'sadness'    // Tristezza
  | 'fear'       // Paura
  | 'surprise'   // Sorpresa
  | 'disgust'    // Disgusto
  | 'neutral'    // Neutro
  | 'sarcasm'    // Sarcasmo
  | 'excitement' // Eccitazione
  | 'tension'    // Tensione/Suspense

export interface EmotionAnalysis {
  primary: EmotionType
  secondary?: EmotionType
  confidence: number // 0-100
  intensity: 'low' | 'medium' | 'high'
  markers: string[] // Parole/pattern che hanno triggerato l'emozione
}

export interface EmotionStyle {
  emotion: EmotionType
  label: string
  labelIt: string
  color: string
  icon: string
  translationGuidelines: string
  vocabularyStyle: 'formal' | 'informal' | 'aggressive' | 'soft' | 'dramatic' | 'neutral'
  punctuationStyle: 'normal' | 'exclamatory' | 'ellipsis' | 'questioning'
  wordChoiceHints: string[]
}

// Configurazione stili per ogni emozione
export const EMOTION_STYLES: Record<EmotionType, EmotionStyle> = {
  anger: {
    emotion: 'anger',
    label: 'Anger',
    labelIt: 'Rabbia',
    color: '#ef4444', // red-500
    icon: '😠',
    translationGuidelines: 'Use harsh, direct language. Short, punchy sentences. Strong verbs. Avoid softening words.',
    vocabularyStyle: 'aggressive',
    punctuationStyle: 'exclamatory',
    wordChoiceHints: ['damn', 'hell', 'furious', 'rage', 'hate', 'destroy', 'kill']
  },
  joy: {
    emotion: 'joy',
    label: 'Joy',
    labelIt: 'Gioia',
    color: '#eab308', // yellow-500
    icon: '😊',
    translationGuidelines: 'Use warm, positive language. Enthusiastic tone. Can use diminutives and affectionate terms.',
    vocabularyStyle: 'informal',
    punctuationStyle: 'exclamatory',
    wordChoiceHints: ['wonderful', 'amazing', 'love', 'happy', 'great', 'fantastic']
  },
  sadness: {
    emotion: 'sadness',
    label: 'Sadness',
    labelIt: 'Tristezza',
    color: '#3b82f6', // blue-500
    icon: '😢',
    translationGuidelines: 'Use gentle, melancholic language. Longer sentences with pauses. Soft vocabulary. Ellipsis for trailing thoughts.',
    vocabularyStyle: 'soft',
    punctuationStyle: 'ellipsis',
    wordChoiceHints: ['sorry', 'miss', 'lost', 'gone', 'alone', 'tears', 'grief']
  },
  fear: {
    emotion: 'fear',
    label: 'Fear',
    labelIt: 'Paura',
    color: '#8b5cf6', // violet-500
    icon: '😨',
    translationGuidelines: 'Use tense, uncertain language. Fragmented sentences. Words expressing doubt and worry.',
    vocabularyStyle: 'dramatic',
    punctuationStyle: 'ellipsis',
    wordChoiceHints: ['afraid', 'scared', 'terror', 'dark', 'danger', 'run', 'hide']
  },
  surprise: {
    emotion: 'surprise',
    label: 'Surprise',
    labelIt: 'Sorpresa',
    color: '#f97316', // orange-500
    icon: '😲',
    translationGuidelines: 'Use exclamatory language. Short, impactful sentences. Interjections welcome.',
    vocabularyStyle: 'informal',
    punctuationStyle: 'exclamatory',
    wordChoiceHints: ['what', 'how', 'impossible', 'unbelievable', 'wow', 'suddenly']
  },
  disgust: {
    emotion: 'disgust',
    label: 'Disgust',
    labelIt: 'Disgusto',
    color: '#22c55e', // green-500
    icon: '🤢',
    translationGuidelines: 'Use visceral, repulsed language. Strong negative adjectives. Can be crude if context allows.',
    vocabularyStyle: 'aggressive',
    punctuationStyle: 'normal',
    wordChoiceHints: ['disgusting', 'vile', 'sick', 'revolting', 'pathetic', 'trash']
  },
  neutral: {
    emotion: 'neutral',
    label: 'Neutral',
    labelIt: 'Neutro',
    color: '#6b7280', // gray-500
    icon: '😐',
    translationGuidelines: 'Use clear, straightforward language. Professional tone. No emotional coloring.',
    vocabularyStyle: 'neutral',
    punctuationStyle: 'normal',
    wordChoiceHints: []
  },
  sarcasm: {
    emotion: 'sarcasm',
    label: 'Sarcasm',
    labelIt: 'Sarcasmo',
    color: '#ec4899', // pink-500
    icon: '😏',
    translationGuidelines: 'Preserve ironic tone. Use italics or quotes if needed. Maintain the double meaning.',
    vocabularyStyle: 'informal',
    punctuationStyle: 'normal',
    wordChoiceHints: ['oh sure', 'right', 'of course', 'brilliant', 'wonderful', 'great job']
  },
  excitement: {
    emotion: 'excitement',
    label: 'Excitement',
    labelIt: 'Eccitazione',
    color: '#f59e0b', // amber-500
    icon: '🤩',
    translationGuidelines: 'Use energetic, fast-paced language. Multiple exclamations. Action verbs.',
    vocabularyStyle: 'informal',
    punctuationStyle: 'exclamatory',
    wordChoiceHints: ['awesome', 'incredible', 'can\'t wait', 'let\'s go', 'amazing', 'epic']
  },
  tension: {
    emotion: 'tension',
    label: 'Tension',
    labelIt: 'Tensione',
    color: '#64748b', // slate-500
    icon: '😰',
    translationGuidelines: 'Use suspenseful language. Short, clipped sentences. Build anticipation. Dramatic pauses.',
    vocabularyStyle: 'dramatic',
    punctuationStyle: 'ellipsis',
    wordChoiceHints: ['careful', 'watch out', 'quiet', 'listen', 'something', 'wait']
  }
}

// Pattern per rilevamento emozioni (regex + keywords)
interface EmotionPattern {
  emotion: EmotionType
  keywords: string[]
  patterns: RegExp[]
  intensityBoost: number // Bonus intensità per questo pattern
}

const EMOTION_PATTERNS: EmotionPattern[] = [
  {
    emotion: 'anger',
    keywords: ['damn', 'hell', 'hate', 'fury', 'furious', 'rage', 'angry', 'mad', 'kill', 'destroy', 'bastard', 'idiot', 'fool', 'stupid', 'shut up', 'get out', 'leave me', 'enough'],
    patterns: [
      /(!{2,})/gi,  // Multiple exclamation marks
      /\b(SHUT|STOP|GET OUT|LEAVE|DIE)\b/gi,
      /\b(you|he|she|they)\s+(will|shall)\s+(pay|die|regret)/gi
    ],
    intensityBoost: 20
  },
  {
    emotion: 'joy',
    keywords: ['happy', 'joy', 'love', 'wonderful', 'amazing', 'fantastic', 'great', 'awesome', 'beautiful', 'perfect', 'glad', 'delighted', 'thank', 'hooray', 'yay', 'finally'],
    patterns: [
      /\b(I|we)\s+(love|adore)\b/gi,
      /\b(so|very|really)\s+(happy|glad|excited)\b/gi,
      /(:\)|😊|😃|❤️|💕)/g
    ],
    intensityBoost: 15
  },
  {
    emotion: 'sadness',
    keywords: ['sad', 'sorry', 'miss', 'lost', 'gone', 'alone', 'lonely', 'cry', 'tears', 'grief', 'mourn', 'farewell', 'goodbye', 'never again', 'regret', 'wish'],
    patterns: [
      /\.{3,}/g,  // Ellipsis
      /\b(I|we)\s+(miss|lost|wish)\b/gi,
      /\b(never|no more|gone forever)\b/gi,
      /(😢|😭|💔)/g
    ],
    intensityBoost: 15
  },
  {
    emotion: 'fear',
    keywords: ['afraid', 'scared', 'fear', 'terror', 'terrified', 'horror', 'nightmare', 'danger', 'run', 'hide', 'help', 'dark', 'monster', 'death', 'dying'],
    patterns: [
      /\b(don't|do not)\s+(go|leave|die)\b/gi,
      /\b(help|save)\s+(me|us)\b/gi,
      /\b(what|who)\s+(is|was)\s+that\b/gi,
      /(😨|😱|👻)/g
    ],
    intensityBoost: 20
  },
  {
    emotion: 'surprise',
    keywords: ['what', 'how', 'impossible', 'unbelievable', 'incredible', 'wow', 'whoa', 'suddenly', 'unexpected', 'shocked', 'stunned', 'can\'t believe'],
    patterns: [
      /^(What|How|Who)\?*!*$/gm,
      /\b(can't|cannot)\s+believe\b/gi,
      /\?{2,}|!\?|\?!/g,
      /(😲|😮|🤯)/g
    ],
    intensityBoost: 10
  },
  {
    emotion: 'disgust',
    keywords: ['disgusting', 'vile', 'sick', 'revolting', 'pathetic', 'gross', 'nasty', 'filthy', 'repulsive', 'hideous', 'horrible', 'trash', 'garbage'],
    patterns: [
      /\b(you|this)\s+(disgust|sicken)\b/gi,
      /\b(how|so)\s+(pathetic|disgusting)\b/gi,
      /(🤢|🤮|💩)/g
    ],
    intensityBoost: 15
  },
  {
    emotion: 'sarcasm',
    keywords: ['oh sure', 'right', 'of course', 'brilliant', 'genius', 'great job', 'nice work', 'how lovely', 'what a surprise'],
    patterns: [
      /\b(oh,?\s+)?(sure|right|yeah|wonderful)\b/gi,
      /"[^"]+"/g, // Quoted phrases often indicate sarcasm
      /\b(as if|like that)\b/gi,
      /(😏|🙄)/g
    ],
    intensityBoost: 10
  },
  {
    emotion: 'excitement',
    keywords: ['awesome', 'incredible', 'amazing', 'epic', 'legendary', 'let\'s go', 'can\'t wait', 'so excited', 'bring it', 'here we go'],
    patterns: [
      /!{2,}/g,
      /\b(let's|here we)\s+(go|do this)\b/gi,
      /\b(ready|time)\s+(to|for)\b/gi,
      /(🤩|🎉|🔥|⚡)/g
    ],
    intensityBoost: 15
  },
  {
    emotion: 'tension',
    keywords: ['careful', 'watch out', 'quiet', 'listen', 'wait', 'something', 'coming', 'close', 'behind', 'above', 'below', 'they\'re here'],
    patterns: [
      /\.{2,}/g,
      /\b(be|stay)\s+(quiet|still|alert)\b/gi,
      /\b(do you|did you)\s+(hear|see|feel)\b/gi
    ],
    intensityBoost: 10
  }
]

/**
 * Analizza il testo e identifica l'emozione dominante
 */
export function analyzeEmotion(text: string): EmotionAnalysis {
  const lowerText = text.toLowerCase()
  const scores: Record<EmotionType, { score: number; markers: string[] }> = {
    anger: { score: 0, markers: [] },
    joy: { score: 0, markers: [] },
    sadness: { score: 0, markers: [] },
    fear: { score: 0, markers: [] },
    surprise: { score: 0, markers: [] },
    disgust: { score: 0, markers: [] },
    neutral: { score: 0, markers: [] },
    sarcasm: { score: 0, markers: [] },
    excitement: { score: 0, markers: [] },
    tension: { score: 0, markers: [] }
  }

  // Analizza ogni pattern
  for (const pattern of EMOTION_PATTERNS) {
    // Check keywords
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[pattern.emotion].score += 10
        scores[pattern.emotion].markers.push(keyword)
      }
    }

    // Check regex patterns
    for (const regex of pattern.patterns) {
      const matches = text.match(regex)
      if (matches) {
        scores[pattern.emotion].score += pattern.intensityBoost
        scores[pattern.emotion].markers.push(...matches.slice(0, 3))
      }
    }
  }

  // Analisi aggiuntiva: punteggiatura
  const exclamationCount = (text.match(/!/g) || []).length
  const questionCount = (text.match(/\?/g) || []).length
  const ellipsisCount = (text.match(/\.\.\./g) || []).length
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length

  if (exclamationCount >= 2) {
    scores.anger.score += 10
    scores.excitement.score += 10
  }
  if (ellipsisCount >= 1) {
    scores.sadness.score += 5
    scores.tension.score += 5
    scores.fear.score += 5
  }
  if (capsRatio > 0.5 && text.length > 5) {
    scores.anger.score += 15
    scores.anger.markers.push('CAPS')
  }

  // Trova emozione primaria e secondaria
  const sorted = Object.entries(scores)
    .filter(([emotion]) => emotion !== 'neutral')
    .sort((a, b) => b[1].score - a[1].score)

  const primary = sorted[0]
  const secondary = sorted[1]

  // Se nessuna emozione forte rilevata, ritorna neutro
  if (primary[1].score < 10) {
    return {
      primary: 'neutral',
      confidence: 90,
      intensity: 'low',
      markers: []
    }
  }

  // Calcola confidence e intensità
  const maxScore = primary[1].score
  const confidence = Math.min(95, 50 + maxScore)
  
  let intensity: 'low' | 'medium' | 'high' = 'low'
  if (maxScore >= 50) intensity = 'high'
  else if (maxScore >= 25) intensity = 'medium'

  return {
    primary: primary[0] as EmotionType,
    secondary: secondary[1].score >= 15 ? secondary[0] as EmotionType : undefined,
    confidence,
    intensity,
    markers: [...new Set(primary[1].markers)].slice(0, 5)
  }
}

/**
 * Genera istruzioni di traduzione basate sull'emozione
 */
export function getEmotionTranslationPrompt(emotion: EmotionAnalysis, targetLanguage: string): string {
  const style = EMOTION_STYLES[emotion.primary]
  const secondaryStyle = emotion.secondary ? EMOTION_STYLES[emotion.secondary] : null

  let prompt = `## Emotion-Aware Translation Guidelines

**Detected Emotion:** ${style.label} (${style.labelIt}) - Intensity: ${emotion.intensity}
**Confidence:** ${emotion.confidence}%
${emotion.markers.length > 0 ? `**Emotional Markers:** ${emotion.markers.join(', ')}` : ''}

### Translation Style:
${style.translationGuidelines}

### Vocabulary:
- Style: ${style.vocabularyStyle}
- Punctuation: ${style.punctuationStyle}
${style.wordChoiceHints.length > 0 ? `- Reference words: ${style.wordChoiceHints.join(', ')}` : ''}
`

  if (secondaryStyle) {
    prompt += `
### Secondary Emotion: ${secondaryStyle.label}
Also incorporate subtle elements of: ${secondaryStyle.translationGuidelines}
`
  }

  // Aggiungi istruzioni specifiche per lingua target
  prompt += `
### Target Language: ${targetLanguage}
Adapt the emotional intensity appropriately for ${targetLanguage} cultural context.
Preserve the emotional impact while ensuring natural flow in the target language.
`

  return prompt
}

/**
 * Analizza batch di testi e raggruppa per emozione
 */
export function analyzeEmotionBatch(texts: string[]): Map<EmotionType, { texts: string[]; avgConfidence: number }> {
  const grouped = new Map<EmotionType, { texts: string[]; totalConfidence: number; count: number }>()

  for (const text of texts) {
    const analysis = analyzeEmotion(text)
    
    if (!grouped.has(analysis.primary)) {
      grouped.set(analysis.primary, { texts: [], totalConfidence: 0, count: 0 })
    }
    
    const group = grouped.get(analysis.primary)!
    group.texts.push(text)
    group.totalConfidence += analysis.confidence
    group.count++
  }

  // Calcola medie
  const result = new Map<EmotionType, { texts: string[]; avgConfidence: number }>()
  for (const [emotion, data] of grouped) {
    result.set(emotion, {
      texts: data.texts,
      avgConfidence: Math.round(data.totalConfidence / data.count)
    })
  }

  return result
}

/**
 * Suggerisce traduzioni alternative basate sull'emozione
 */
export function suggestEmotionalVariants(
  originalTranslation: string, 
  emotion: EmotionType,
  targetLanguage: string
): { variant: string; emotionLevel: 'softer' | 'standard' | 'stronger' }[] {
  // Questo sarebbe idealmente fatto da un LLM, ma qui forniamo struttura
  return [
    { variant: originalTranslation, emotionLevel: 'standard' },
    { variant: `[Softer version needed]`, emotionLevel: 'softer' },
    { variant: `[Stronger version needed]`, emotionLevel: 'stronger' }
  ]
}
