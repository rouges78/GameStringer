/**
 * 🏷️ Content Classification System
 * 
 * Classifica automaticamente il contenuto dei giochi per routing intelligente:
 * - UI elements → traduzione diretta AI
 * - Dialoghi → context injection + review opzionale
 * - Narrative → human review gates
 * - System messages → traduzione tecnica
 */

// ============================================================================
// TYPES
// ============================================================================

export type ContentType = 
  | 'ui'           // Pulsanti, menu, etichette
  | 'dialogue'     // Dialoghi personaggi
  | 'narrative'    // Testo narrativo, descrizioni
  | 'system'       // Messaggi di sistema, errori
  | 'item'         // Nomi oggetti, descrizioni item
  | 'tutorial'     // Tutorial, guide
  | 'achievement'  // Achievement, trofei
  | 'subtitle'     // Sottotitoli
  | 'unknown';

export type ContentPriority = 'critical' | 'high' | 'medium' | 'low';

export type TranslationRoute = 
  | 'direct_ai'           // Traduzione AI diretta
  | 'ai_with_context'     // AI con context injection
  | 'ai_with_review'      // AI + human review
  | 'human_only'          // Solo traduzione umana
  | 'skip';               // Non tradurre

export interface ContentClassification {
  type: ContentType;
  confidence: number;        // 0-1
  priority: ContentPriority;
  route: TranslationRoute;
  metadata: {
    hasPlaceholders: boolean;
    hasCharacterLimit: boolean;
    estimatedCharLimit?: number;
    isRepeated: boolean;
    complexity: 'simple' | 'medium' | 'complex';
    culturalSensitivity: 'none' | 'low' | 'medium' | 'high';
    tags: string[];
  };
  reasoning: string;
}

export interface ClassificationRule {
  id: string;
  name: string;
  patterns: RegExp[];
  keywords: string[];
  type: ContentType;
  priority: ContentPriority;
  route: TranslationRoute;
  weight: number;
}

// ============================================================================
// CLASSIFICATION RULES
// ============================================================================

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // UI Elements
  {
    id: 'ui_buttons',
    name: 'UI Buttons',
    patterns: [
      /^(OK|Cancel|Yes|No|Back|Next|Continue|Start|Exit|Quit|Save|Load|Apply|Reset|Close|Open|New|Delete|Edit|Add|Remove|Confirm|Retry|Skip)$/i,
      /^(Accept|Decline|Submit|Send|Play|Pause|Stop|Resume|Restart)$/i,
    ],
    keywords: ['button', 'btn', 'click', 'press'],
    type: 'ui',
    priority: 'high',
    route: 'direct_ai',
    weight: 10
  },
  {
    id: 'ui_menu',
    name: 'UI Menu Items',
    patterns: [
      /^(Settings|Options|Preferences|Configuration|Audio|Video|Graphics|Controls|Gameplay|Language|Display)$/i,
      /^(Main Menu|New Game|Load Game|Save Game|Multiplayer|Single Player|Co-op|Online|Offline)$/i,
    ],
    keywords: ['menu', 'option', 'setting'],
    type: 'ui',
    priority: 'high',
    route: 'direct_ai',
    weight: 9
  },
  {
    id: 'ui_labels',
    name: 'UI Labels',
    patterns: [
      /^(Level|Score|Time|Health|Mana|Stamina|Energy|Gold|Coins|Points|Lives|Ammo|Armor):\s*$/i,
      /^(Player|Enemy|Ally|Team|Party|Guild|Clan):\s*$/i,
    ],
    keywords: ['label', 'stat', 'hud'],
    type: 'ui',
    priority: 'medium',
    route: 'direct_ai',
    weight: 8
  },
  
  // Dialogue
  {
    id: 'dialogue_quoted',
    name: 'Quoted Dialogue',
    patterns: [
      /^[""].*[""]$/,
      /^[«»].*[«»]$/,
      /^'.*'$/,
    ],
    keywords: [],
    type: 'dialogue',
    priority: 'high',
    route: 'ai_with_context',
    weight: 9
  },
  {
    id: 'dialogue_character',
    name: 'Character Dialogue',
    patterns: [
      /^[A-Z][a-z]+:\s*.+/,  // "John: Hello there"
      /^\[[A-Z][a-z]+\]\s*.+/,  // "[John] Hello there"
    ],
    keywords: ['say', 'said', 'speak', 'spoke', 'ask', 'asked', 'reply', 'replied'],
    type: 'dialogue',
    priority: 'high',
    route: 'ai_with_context',
    weight: 9
  },
  
  // Narrative
  {
    id: 'narrative_description',
    name: 'Narrative Description',
    patterns: [
      /^(The|A|An)\s+.{50,}/i,  // Long sentences starting with articles
      /.{100,}/,  // Very long text
    ],
    keywords: ['description', 'story', 'lore', 'history', 'legend'],
    type: 'narrative',
    priority: 'medium',
    route: 'ai_with_review',
    weight: 7
  },
  
  // System Messages
  {
    id: 'system_error',
    name: 'Error Messages',
    patterns: [
      /^(Error|Warning|Notice|Info|Debug):/i,
      /^(Failed|Unable|Cannot|Could not)/i,
      /\b(error|exception|failed|invalid)\b/i,
    ],
    keywords: ['error', 'warning', 'failed', 'invalid', 'exception'],
    type: 'system',
    priority: 'low',
    route: 'direct_ai',
    weight: 6
  },
  {
    id: 'system_notification',
    name: 'System Notifications',
    patterns: [
      /^(Game saved|Loading|Please wait|Connecting|Disconnected)/i,
      /^(Achievement unlocked|Trophy earned|Level up)/i,
    ],
    keywords: ['saved', 'loading', 'connecting', 'syncing'],
    type: 'system',
    priority: 'medium',
    route: 'direct_ai',
    weight: 7
  },
  
  // Items
  {
    id: 'item_name',
    name: 'Item Names',
    patterns: [
      /^(Sword|Shield|Armor|Helmet|Potion|Scroll|Ring|Amulet|Staff|Wand|Bow|Arrow)/i,
      /^(Iron|Steel|Silver|Gold|Diamond|Legendary|Epic|Rare|Common|Uncommon)\s+/i,
    ],
    keywords: ['item', 'weapon', 'armor', 'equipment', 'consumable', 'material'],
    type: 'item',
    priority: 'medium',
    route: 'ai_with_context',
    weight: 8
  },
  {
    id: 'item_description',
    name: 'Item Descriptions',
    patterns: [
      /^(A|An|The)\s+(powerful|ancient|magical|cursed|blessed|rare)/i,
      /\+\d+\s+(Strength|Agility|Intelligence|Damage|Defense)/i,
    ],
    keywords: ['grants', 'provides', 'increases', 'decreases', 'bonus', 'effect'],
    type: 'item',
    priority: 'medium',
    route: 'ai_with_context',
    weight: 7
  },
  
  // Tutorial
  {
    id: 'tutorial_instruction',
    name: 'Tutorial Instructions',
    patterns: [
      /^(Press|Click|Tap|Hold|Release|Move|Drag|Drop)\s+/i,
      /^(To|In order to|You can|You must|Try to)\s+/i,
    ],
    keywords: ['tutorial', 'guide', 'tip', 'hint', 'help', 'instruction'],
    type: 'tutorial',
    priority: 'high',
    route: 'direct_ai',
    weight: 8
  },
  
  // Achievements
  {
    id: 'achievement',
    name: 'Achievements',
    patterns: [
      /^(Complete|Defeat|Collect|Find|Discover|Unlock|Reach|Win)\s+/i,
    ],
    keywords: ['achievement', 'trophy', 'badge', 'reward', 'unlock'],
    type: 'achievement',
    priority: 'low',
    route: 'direct_ai',
    weight: 6
  },
  
  // Subtitles
  {
    id: 'subtitle',
    name: 'Subtitles',
    patterns: [
      /^\[.+\]$/,  // [Sound effect]
      /^\(.+\)$/,  // (whispers)
    ],
    keywords: ['subtitle', 'caption', 'audio'],
    type: 'subtitle',
    priority: 'high',
    route: 'ai_with_context',
    weight: 8
  },
];

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classifica un singolo testo
 */
export function classifyContent(
  text: string,
  context?: {
    filename?: string;
    key?: string;
    previousText?: string;
    gameGenre?: string;
  }
): ContentClassification {
  const scores: Map<ContentType, number> = new Map();
  let matchedRules: ClassificationRule[] = [];
  
  // Inizializza scores
  const types: ContentType[] = ['ui', 'dialogue', 'narrative', 'system', 'item', 'tutorial', 'achievement', 'subtitle', 'unknown'];
  types.forEach(t => scores.set(t, 0));
  
  // Applica regole
  for (const rule of CLASSIFICATION_RULES) {
    let matched = false;
    
    // Check patterns
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        matched = true;
        break;
      }
    }
    
    // Check keywords
    if (!matched) {
      const lowerText = text.toLowerCase();
      for (const keyword of rule.keywords) {
        if (lowerText.includes(keyword)) {
          matched = true;
          break;
        }
      }
    }
    
    // Check context (filename, key)
    if (!matched && context) {
      const contextStr = `${context.filename || ''} ${context.key || ''}`.toLowerCase();
      for (const keyword of rule.keywords) {
        if (contextStr.includes(keyword)) {
          matched = true;
          break;
        }
      }
    }
    
    if (matched) {
      const currentScore = scores.get(rule.type) || 0;
      scores.set(rule.type, currentScore + rule.weight);
      matchedRules.push(rule);
    }
  }
  
  // Trova il tipo con score più alto
  let bestType: ContentType = 'unknown';
  let bestScore = 0;
  
  scores.forEach((score, type) => {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  });
  
  // Calcola confidence
  const totalScore = Array.from(scores.values()).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? bestScore / totalScore : 0;
  
  // Determina metadata
  const metadata = analyzeMetadata(text);
  
  // Determina route e priority basati sul tipo
  const { route, priority } = determineRouteAndPriority(bestType, metadata, matchedRules);
  
  // Genera reasoning
  const reasoning = generateReasoning(bestType, matchedRules, metadata);
  
  return {
    type: bestType,
    confidence: Math.round(confidence * 100) / 100,
    priority,
    route,
    metadata,
    reasoning
  };
}

/**
 * Analizza metadata del testo
 */
function analyzeMetadata(text: string): ContentClassification['metadata'] {
  // Check placeholders
  const placeholderPatterns = [
    /\{[^}]+\}/g,
    /%[sd%]/g,
    /\$\{[^}]+\}/g,
    /\[\[[^\]]+\]\]/g,
  ];
  const hasPlaceholders = placeholderPatterns.some(p => p.test(text));
  
  // Stima character limit basato su lunghezza
  const length = text.length;
  let estimatedCharLimit: number | undefined;
  let hasCharacterLimit = false;
  
  if (length <= 20) {
    estimatedCharLimit = 30;
    hasCharacterLimit = true;
  } else if (length <= 50) {
    estimatedCharLimit = 70;
    hasCharacterLimit = true;
  }
  
  // Determina complessità
  let complexity: 'simple' | 'medium' | 'complex' = 'simple';
  if (length > 200 || text.split(/[.!?]/).length > 3) {
    complexity = 'complex';
  } else if (length > 50 || text.split(/[.!?]/).length > 1) {
    complexity = 'medium';
  }
  
  // Check cultural sensitivity
  let culturalSensitivity: 'none' | 'low' | 'medium' | 'high' = 'none';
  const sensitivePatterns = [
    /\b(god|gods|religion|religious|faith|pray|prayer|church|temple|holy|sacred)\b/i,
    /\b(death|die|kill|murder|blood|gore|violence)\b/i,
    /\b(sex|sexual|nude|naked|adult)\b/i,
    /\b(race|racial|ethnic|nationality)\b/i,
  ];
  
  const sensitiveMatches = sensitivePatterns.filter(p => p.test(text)).length;
  if (sensitiveMatches >= 2) culturalSensitivity = 'high';
  else if (sensitiveMatches === 1) culturalSensitivity = 'medium';
  
  // Generate tags
  const tags: string[] = [];
  if (hasPlaceholders) tags.push('has_placeholders');
  if (hasCharacterLimit) tags.push('char_limited');
  if (complexity === 'complex') tags.push('complex');
  if (culturalSensitivity !== 'none') tags.push('culturally_sensitive');
  if (/[!?]{2,}/.test(text)) tags.push('emphatic');
  if (/\b(you|your|player)\b/i.test(text)) tags.push('player_facing');
  
  return {
    hasPlaceholders,
    hasCharacterLimit,
    estimatedCharLimit,
    isRepeated: false, // Will be set by batch processing
    complexity,
    culturalSensitivity,
    tags
  };
}

/**
 * Determina route e priority
 */
function determineRouteAndPriority(
  type: ContentType,
  metadata: ContentClassification['metadata'],
  matchedRules: ClassificationRule[]
): { route: TranslationRoute; priority: ContentPriority } {
  // Default basato sul tipo
  const defaults: Record<ContentType, { route: TranslationRoute; priority: ContentPriority }> = {
    ui: { route: 'direct_ai', priority: 'high' },
    dialogue: { route: 'ai_with_context', priority: 'high' },
    narrative: { route: 'ai_with_review', priority: 'medium' },
    system: { route: 'direct_ai', priority: 'low' },
    item: { route: 'ai_with_context', priority: 'medium' },
    tutorial: { route: 'direct_ai', priority: 'high' },
    achievement: { route: 'direct_ai', priority: 'low' },
    subtitle: { route: 'ai_with_context', priority: 'high' },
    unknown: { route: 'ai_with_review', priority: 'medium' }
  };
  
  let { route, priority } = defaults[type];
  
  // Modifica basata su metadata
  if (metadata.culturalSensitivity === 'high') {
    route = 'ai_with_review';
    priority = 'high';
  }
  
  if (metadata.complexity === 'complex' && route === 'direct_ai') {
    route = 'ai_with_context';
  }
  
  // Usa regole matched se disponibili
  if (matchedRules.length > 0) {
    // Prendi la regola con weight più alto
    const topRule = matchedRules.sort((a, b) => b.weight - a.weight)[0];
    route = topRule.route;
    priority = topRule.priority;
  }
  
  return { route, priority };
}

/**
 * Genera reasoning per la classificazione
 */
function generateReasoning(
  type: ContentType,
  matchedRules: ClassificationRule[],
  metadata: ContentClassification['metadata']
): string {
  const parts: string[] = [];
  
  if (matchedRules.length > 0) {
    const ruleNames = matchedRules.map(r => r.name).join(', ');
    parts.push(`Matched rules: ${ruleNames}`);
  }
  
  if (metadata.tags.length > 0) {
    parts.push(`Tags: ${metadata.tags.join(', ')}`);
  }
  
  parts.push(`Complexity: ${metadata.complexity}`);
  
  if (metadata.culturalSensitivity !== 'none') {
    parts.push(`Cultural sensitivity: ${metadata.culturalSensitivity}`);
  }
  
  return parts.join(' | ') || `Classified as ${type}`;
}

// ============================================================================
// BATCH CLASSIFICATION
// ============================================================================

export interface BatchClassificationResult {
  items: Array<{
    text: string;
    classification: ContentClassification;
  }>;
  summary: {
    byType: Record<ContentType, number>;
    byRoute: Record<TranslationRoute, number>;
    byPriority: Record<ContentPriority, number>;
  };
  recommendations: string[];
}

/**
 * Classifica un batch di testi
 */
export function classifyBatch(
  texts: string[],
  context?: {
    filename?: string;
    gameGenre?: string;
  }
): BatchClassificationResult {
  const items: BatchClassificationResult['items'] = [];
  const byType: Record<ContentType, number> = {} as any;
  const byRoute: Record<TranslationRoute, number> = {} as any;
  const byPriority: Record<ContentPriority, number> = {} as any;
  
  // Track repeated texts
  const textCounts = new Map<string, number>();
  texts.forEach(t => {
    const normalized = t.toLowerCase().trim();
    textCounts.set(normalized, (textCounts.get(normalized) || 0) + 1);
  });
  
  for (const text of texts) {
    const classification = classifyContent(text, context);
    
    // Mark as repeated if appears multiple times
    const normalized = text.toLowerCase().trim();
    if ((textCounts.get(normalized) || 0) > 1) {
      classification.metadata.isRepeated = true;
      classification.metadata.tags.push('repeated');
    }
    
    items.push({ text, classification });
    
    // Update counts
    byType[classification.type] = (byType[classification.type] || 0) + 1;
    byRoute[classification.route] = (byRoute[classification.route] || 0) + 1;
    byPriority[classification.priority] = (byPriority[classification.priority] || 0) + 1;
  }
  
  // Generate recommendations
  const recommendations = generateBatchRecommendations(items, byType, byRoute);
  
  return {
    items,
    summary: { byType, byRoute, byPriority },
    recommendations
  };
}

/**
 * Genera raccomandazioni per il batch
 */
function generateBatchRecommendations(
  items: BatchClassificationResult['items'],
  byType: Record<ContentType, number>,
  byRoute: Record<TranslationRoute, number>
): string[] {
  const recommendations: string[] = [];
  const total = items.length;
  
  // Check for high dialogue content
  const dialoguePercent = ((byType['dialogue'] || 0) / total) * 100;
  if (dialoguePercent > 30) {
    recommendations.push('Alto contenuto di dialoghi - considera di configurare personaggi nel glossario');
  }
  
  // Check for many UI elements
  const uiPercent = ((byType['ui'] || 0) / total) * 100;
  if (uiPercent > 50) {
    recommendations.push('Molti elementi UI - verifica i limiti di caratteri');
  }
  
  // Check for items needing review
  const reviewPercent = ((byRoute['ai_with_review'] || 0) / total) * 100;
  if (reviewPercent > 20) {
    recommendations.push(`${Math.round(reviewPercent)}% del contenuto richiede review umana`);
  }
  
  // Check for repeated content
  const repeatedCount = items.filter(i => i.classification.metadata.isRepeated).length;
  if (repeatedCount > 0) {
    recommendations.push(`${repeatedCount} testi ripetuti - verranno tradotti una sola volta`);
  }
  
  // Check for culturally sensitive content
  const sensitiveCount = items.filter(i => 
    i.classification.metadata.culturalSensitivity !== 'none'
  ).length;
  if (sensitiveCount > 0) {
    recommendations.push(`${sensitiveCount} testi con contenuto culturalmente sensibile`);
  }
  
  return recommendations;
}

// ============================================================================
// ROUTING HELPERS
// ============================================================================

/**
 * Filtra items per route
 */
export function filterByRoute(
  items: BatchClassificationResult['items'],
  route: TranslationRoute
): BatchClassificationResult['items'] {
  return items.filter(i => i.classification.route === route);
}

/**
 * Filtra items per priority
 */
export function filterByPriority(
  items: BatchClassificationResult['items'],
  priority: ContentPriority
): BatchClassificationResult['items'] {
  return items.filter(i => i.classification.priority === priority);
}

/**
 * Ordina items per priority
 */
export function sortByPriority(
  items: BatchClassificationResult['items']
): BatchClassificationResult['items'] {
  const priorityOrder: Record<ContentPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };
  
  return [...items].sort((a, b) => 
    priorityOrder[a.classification.priority] - priorityOrder[b.classification.priority]
  );
}

/**
 * Raggruppa items per tipo
 */
export function groupByType(
  items: BatchClassificationResult['items']
): Record<ContentType, BatchClassificationResult['items']> {
  const groups: Record<ContentType, BatchClassificationResult['items']> = {} as any;
  
  for (const item of items) {
    const type = item.classification.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(item);
  }
  
  return groups;
}
