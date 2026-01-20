/**
 * AI Context Crawler
 * Agente che cattura screenshot durante il gameplay, estrae testo con OCR,
 * analizza il contesto visivo e costruisce automaticamente un glossario
 */

export interface CrawlerConfig {
  captureInterval: number; // ms tra screenshot
  ocrLanguage: string;
  targetLanguage: string;
  minConfidence: number; // 0-1
  deduplicateThreshold: number; // similarità per considerare duplicato
  contextWindowSize: number; // numero di frame per contesto
  autoClassify: boolean; // classifica automaticamente i termini
}

export interface CapturedText {
  id: string;
  text: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  timestamp: number;
  frameIndex: number;
  context: TextContext;
}

export interface TextContext {
  screenRegion: 'dialog' | 'menu' | 'hud' | 'title' | 'subtitle' | 'unknown';
  nearbyTexts: string[];
  dominantColors: string[];
  estimatedFontSize: 'small' | 'medium' | 'large';
  isRepeated: boolean;
}

export interface GlossaryEntry {
  id: string;
  term: string;
  translation?: string;
  category: TermCategory;
  frequency: number;
  contexts: string[];
  firstSeen: number;
  lastSeen: number;
  confidence: number;
  status: 'pending' | 'confirmed' | 'translated' | 'ignored';
}

export type TermCategory = 
  | 'character_name'
  | 'location'
  | 'item'
  | 'skill'
  | 'enemy'
  | 'ui_element'
  | 'dialog'
  | 'system'
  | 'unknown';

export interface CrawlerSession {
  id: string;
  gameId: string;
  gameName: string;
  startTime: number;
  endTime?: number;
  totalFrames: number;
  uniqueTexts: number;
  glossaryEntries: number;
  status: 'running' | 'paused' | 'stopped' | 'completed';
}

export interface CrawlerStats {
  framesProcessed: number;
  textsExtracted: number;
  uniqueTerms: number;
  categorizedTerms: number;
  translatedTerms: number;
  avgConfidence: number;
  processingSpeed: number; // frames/sec
}

const DEFAULT_CONFIG: CrawlerConfig = {
  captureInterval: 2000, // 2 secondi
  ocrLanguage: 'en',
  targetLanguage: 'it',
  minConfidence: 0.6,
  deduplicateThreshold: 0.85,
  contextWindowSize: 5,
  autoClassify: true,
};

// Storage keys
const SESSIONS_KEY = 'gamestringer_crawler_sessions';
const GLOSSARY_KEY = 'gamestringer_crawler_glossary';

/**
 * Salva sessione crawler
 */
export function saveCrawlerSession(session: CrawlerSession): void {
  const sessions = getCrawlerSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

/**
 * Recupera tutte le sessioni
 */
export function getCrawlerSessions(): CrawlerSession[] {
  const stored = localStorage.getItem(SESSIONS_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Salva glossario
 */
export function saveGlossary(gameId: string, entries: GlossaryEntry[]): void {
  const key = `${GLOSSARY_KEY}_${gameId}`;
  localStorage.setItem(key, JSON.stringify(entries));
}

/**
 * Recupera glossario per gioco
 */
export function getGlossary(gameId: string): GlossaryEntry[] {
  const key = `${GLOSSARY_KEY}_${gameId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Classifica automaticamente un termine in base al contesto
 */
export function classifyTerm(
  text: string, 
  context: TextContext,
  existingTerms: GlossaryEntry[]
): TermCategory {
  const lowerText = text.toLowerCase();
  
  // Regole euristiche per classificazione
  
  // UI Elements - testi brevi in menu/hud
  if (context.screenRegion === 'menu' || context.screenRegion === 'hud') {
    const uiPatterns = [
      /^(start|begin|play|quit|exit|save|load|options|settings|continue|new game)$/i,
      /^(hp|mp|exp|lv|lvl|level|gold|gil|coins?)$/i,
      /^(attack|defend|magic|item|skill|run|escape|flee)$/i,
      /^(yes|no|ok|cancel|back|next|confirm)$/i,
    ];
    if (uiPatterns.some(p => p.test(lowerText))) {
      return 'ui_element';
    }
  }

  // Character names - spesso in maiuscolo o con : dopo
  if (context.screenRegion === 'dialog') {
    if (/^[A-Z][a-z]+$/.test(text) || /^[A-Z]+$/.test(text)) {
      // Verifica se è già classificato come nome
      const existing = existingTerms.find(t => 
        t.term.toLowerCase() === lowerText && t.category === 'character_name'
      );
      if (existing) return 'character_name';
      
      // Pattern comuni per nomi
      if (text.length <= 15 && !text.includes(' ')) {
        return 'character_name';
      }
    }
  }

  // Locations - spesso in title screens o con pattern specifici
  if (context.screenRegion === 'title' || context.estimatedFontSize === 'large') {
    const locationPatterns = [
      /castle|town|village|forest|mountain|cave|dungeon|temple|tower|palace/i,
      /kingdom|empire|land|realm|world/i,
      /north|south|east|west|central/i,
    ];
    if (locationPatterns.some(p => p.test(lowerText))) {
      return 'location';
    }
  }

  // Items - pattern comuni per oggetti
  const itemPatterns = [
    /potion|elixir|herb|antidote|remedy|phoenix/i,
    /sword|shield|armor|helmet|boots|gloves|ring|amulet/i,
    /key|gem|crystal|stone|orb|scroll|book|map/i,
  ];
  if (itemPatterns.some(p => p.test(lowerText))) {
    return 'item';
  }

  // Skills/Magic
  const skillPatterns = [
    /fire|ice|thunder|lightning|water|earth|wind|holy|dark/i,
    /heal|cure|protect|shell|haste|slow|poison|blind/i,
    /slash|strike|thrust|combo|ultimate|special/i,
  ];
  if (skillPatterns.some(p => p.test(lowerText))) {
    return 'skill';
  }

  // Enemies
  const enemyPatterns = [
    /goblin|orc|troll|dragon|demon|undead|zombie|skeleton/i,
    /boss|king|lord|queen|dark|shadow|evil/i,
    /slime|bat|wolf|bear|spider|snake/i,
  ];
  if (enemyPatterns.some(p => p.test(lowerText))) {
    return 'enemy';
  }

  // Dialog - frasi lunghe
  if (text.length > 30 || text.includes('.') || text.includes('!') || text.includes('?')) {
    return 'dialog';
  }

  // System messages
  if (context.screenRegion === 'hud' || /saved|loaded|obtained|learned|received/i.test(lowerText)) {
    return 'system';
  }

  return 'unknown';
}

/**
 * Calcola similarità tra due stringhe (Levenshtein-based)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[s1.length][s2.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

/**
 * Deduplica testi estratti
 */
export function deduplicateTexts(
  texts: CapturedText[],
  threshold: number
): CapturedText[] {
  const unique: CapturedText[] = [];
  
  for (const text of texts) {
    const isDuplicate = unique.some(
      u => calculateSimilarity(u.text, text.text) >= threshold
    );
    if (!isDuplicate) {
      unique.push(text);
    }
  }
  
  return unique;
}

/**
 * Rileva la regione dello schermo basandosi sulla posizione
 */
export function detectScreenRegion(
  boundingBox: { x: number; y: number; width: number; height: number },
  screenWidth: number,
  screenHeight: number
): TextContext['screenRegion'] {
  const centerX = boundingBox.x + boundingBox.width / 2;
  const centerY = boundingBox.y + boundingBox.height / 2;
  
  const relativeX = centerX / screenWidth;
  const relativeY = centerY / screenHeight;
  
  // Dialog box - tipicamente nella parte bassa dello schermo
  if (relativeY > 0.7 && relativeX > 0.1 && relativeX < 0.9) {
    return 'dialog';
  }
  
  // HUD - angoli dello schermo
  if ((relativeX < 0.2 || relativeX > 0.8) && (relativeY < 0.15 || relativeY > 0.85)) {
    return 'hud';
  }
  
  // Menu - centro dello schermo
  if (relativeX > 0.2 && relativeX < 0.8 && relativeY > 0.2 && relativeY < 0.8) {
    return 'menu';
  }
  
  // Title - parte alta centrale
  if (relativeY < 0.3 && relativeX > 0.2 && relativeX < 0.8) {
    return 'title';
  }
  
  // Subtitle - parte bassa centrale
  if (relativeY > 0.8 && relativeX > 0.2 && relativeX < 0.8) {
    return 'subtitle';
  }
  
  return 'unknown';
}

/**
 * Stima la dimensione del font basandosi sull'altezza del bounding box
 */
export function estimateFontSize(
  boxHeight: number,
  screenHeight: number
): TextContext['estimatedFontSize'] {
  const ratio = boxHeight / screenHeight;
  
  if (ratio < 0.02) return 'small';
  if (ratio < 0.05) return 'medium';
  return 'large';
}

/**
 * Genera un ID univoco
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Esporta glossario in formato CSV
 */
export function exportGlossaryToCSV(entries: GlossaryEntry[]): string {
  const headers = ['term', 'translation', 'category', 'frequency', 'confidence', 'status'];
  const rows = entries.map(e => [
    `"${e.term.replace(/"/g, '""')}"`,
    `"${(e.translation || '').replace(/"/g, '""')}"`,
    e.category,
    e.frequency.toString(),
    e.confidence.toFixed(2),
    e.status
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Importa glossario da CSV
 */
export function importGlossaryFromCSV(csv: string): GlossaryEntry[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  // Skip header
  const entries: GlossaryEntry[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.replace(/^"|"$/g, '').replace(/""/g, '"'));
    if (parts.length >= 6) {
      entries.push({
        id: generateId(),
        term: parts[0],
        translation: parts[1] || undefined,
        category: parts[2] as TermCategory,
        frequency: parseInt(parts[3]) || 1,
        contexts: [],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        confidence: parseFloat(parts[4]) || 0.5,
        status: parts[5] as GlossaryEntry['status'] || 'pending'
      });
    }
  }
  
  return entries;
}

/**
 * Merge due glossari evitando duplicati
 */
export function mergeGlossaries(
  base: GlossaryEntry[],
  incoming: GlossaryEntry[],
  threshold: number = 0.9
): GlossaryEntry[] {
  const merged = [...base];
  
  for (const entry of incoming) {
    const existingIndex = merged.findIndex(
      m => calculateSimilarity(m.term, entry.term) >= threshold
    );
    
    if (existingIndex >= 0) {
      // Aggiorna entry esistente
      const existing = merged[existingIndex];
      existing.frequency += entry.frequency;
      existing.lastSeen = Math.max(existing.lastSeen, entry.lastSeen);
      existing.confidence = Math.max(existing.confidence, entry.confidence);
      if (entry.translation && !existing.translation) {
        existing.translation = entry.translation;
        existing.status = 'translated';
      }
      existing.contexts = [...new Set([...existing.contexts, ...entry.contexts])].slice(0, 10);
    } else {
      // Aggiungi nuova entry
      merged.push(entry);
    }
  }
  
  return merged;
}

/**
 * Ottieni statistiche sul glossario
 */
export function getGlossaryStats(entries: GlossaryEntry[]): {
  total: number;
  byCategory: Record<TermCategory, number>;
  byStatus: Record<GlossaryEntry['status'], number>;
  avgConfidence: number;
  translationProgress: number;
} {
  const byCategory: Record<TermCategory, number> = {
    character_name: 0,
    location: 0,
    item: 0,
    skill: 0,
    enemy: 0,
    ui_element: 0,
    dialog: 0,
    system: 0,
    unknown: 0,
  };
  
  const byStatus: Record<GlossaryEntry['status'], number> = {
    pending: 0,
    confirmed: 0,
    translated: 0,
    ignored: 0,
  };
  
  let totalConfidence = 0;
  let translatedCount = 0;
  
  for (const entry of entries) {
    byCategory[entry.category]++;
    byStatus[entry.status]++;
    totalConfidence += entry.confidence;
    if (entry.translation) translatedCount++;
  }
  
  return {
    total: entries.length,
    byCategory,
    byStatus,
    avgConfidence: entries.length > 0 ? totalConfidence / entries.length : 0,
    translationProgress: entries.length > 0 ? translatedCount / entries.length : 0,
  };
}
