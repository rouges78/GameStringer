/**
 * 📝 Prompt Templates System
 * 
 * Sistema di template prompt personalizzabili per progetto/gioco.
 * L'utente può creare, modificare e salvare template di prompt
 * che vengono iniettati nella traduzione AI.
 * 
 * Ogni template contiene:
 * - Istruzioni di stile (tono, formalità, terminologia)
 * - Glossario specifico del gioco
 * - Regole di traduzione (cosa non tradurre, formattazione)
 * - Esempi few-shot personalizzati
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  gameId?: string;        // Associato a un gioco specifico
  gameName?: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  
  // Sezioni del template
  systemInstruction: string;       // Istruzione principale (es. "Sei un traduttore esperto di JRPG")
  styleDirective: string;          // Stile (es. "Usa un tono informale ma rispettoso")
  glossary: GlossaryEntry[];       // Termini da usare/non tradurre
  rules: string[];                 // Regole specifiche (es. "Non tradurre nomi propri")
  fewShotExamples: FewShotExample[]; // Esempi di traduzione
  
  // Configurazione tecnica
  temperature: number;             // 0.0 - 1.0
  maxTokens: number;
  preservePatterns: string[];      // Regex patterns da preservare (es. "{player_name}")
}

export interface GlossaryEntry {
  source: string;       // Termine originale
  target: string;       // Traduzione desiderata
  context?: string;     // Contesto d'uso
  doNotTranslate?: boolean; // Se true, lascia l'originale
}

export interface FewShotExample {
  source: string;
  target: string;
  context?: string;
}

// ============================================================================
// BUILT-IN TEMPLATES
// ============================================================================

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Template generico per la maggior parte dei giochi',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    isDefault: true,
    systemInstruction: 'You are an expert video game translator. Translate accurately while preserving the original tone and meaning.',
    styleDirective: 'Use natural, fluent language appropriate for video games. Maintain consistency in terminology.',
    glossary: [],
    rules: [
      'Preserve all placeholders ({name}, %s, %d, etc.) exactly as they are',
      'Do not translate proper nouns unless they have an official localization',
      'Keep the same punctuation style as the original',
      'Maintain text length similar to the original when possible',
    ],
    fewShotExamples: [],
    temperature: 0.3,
    maxTokens: 8192,
    preservePatterns: ['\\{[^}]+\\}', '%[sd%]', '\\$\\{[^}]+\\}', '\\[\\[[^\\]]+\\]\\]'],
  },
  {
    id: 'jrpg',
    name: 'JRPG / Visual Novel',
    description: 'Per giochi giapponesi con dialoghi e sistemi RPG',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    isDefault: false,
    systemInstruction: 'You are an expert translator specializing in Japanese RPGs and visual novels. Preserve the nuance of Japanese storytelling while making it natural in the target language.',
    styleDirective: 'Maintain character voice consistency. Use appropriate honorifics or adapt them naturally. Keep the emotional tone of dialogue. For item/skill names, prefer creative translations over literal ones.',
    glossary: [
      { source: '-san', target: '', context: 'Honorific', doNotTranslate: false },
      { source: '-sama', target: '', context: 'Honorific (formal)', doNotTranslate: false },
      { source: 'senpai', target: '', context: 'Senior/mentor', doNotTranslate: false },
    ],
    rules: [
      'Preserve all placeholders and formatting tags',
      'Character names should remain in their romanized form unless officially localized',
      'Adapt cultural references for the target audience when the meaning would be lost',
      'Keep attack/skill names consistent throughout the game',
      'Onomatopoeia should be adapted to the target language conventions',
    ],
    fewShotExamples: [
      { source: 'It\'s dangerous to go alone! Take this.', target: 'È pericoloso andare da soli! Prendi questo.', context: 'NPC dialogue' },
      { source: 'You gained 50 EXP!', target: 'Hai ottenuto 50 EXP!', context: 'System message' },
    ],
    temperature: 0.4,
    maxTokens: 8192,
    preservePatterns: ['\\{[^}]+\\}', '%[sd%]', '\\\\n', '\\[.*?\\]'],
  },
  {
    id: 'horror',
    name: 'Horror / Psychological',
    description: 'Per giochi horror con atmosfera tesa e inquietante',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    isDefault: false,
    systemInstruction: 'You are a translator specializing in horror and psychological thriller games. Create tension and unease through careful word choice.',
    styleDirective: 'Use short, punchy sentences for tension. Prefer unsettling vocabulary. Ambiguity is a feature, not a bug — preserve it. Environmental storytelling clues must remain intact.',
    glossary: [],
    rules: [
      'Preserve all placeholders and formatting',
      'Maintain ambiguity in mysterious or cryptic messages',
      'Use visceral, sensory language for descriptions',
      'Do not soften violent or disturbing content',
      'Keep proper nouns and location names consistent',
    ],
    fewShotExamples: [
      { source: 'Something is watching.', target: 'Qualcosa ti sta osservando.', context: 'Environmental text' },
      { source: 'The door won\'t budge.', target: 'La porta non si muove.', context: 'Interaction' },
    ],
    temperature: 0.3,
    maxTokens: 8192,
    preservePatterns: ['\\{[^}]+\\}', '%[sd%]'],
  },
  {
    id: 'casual',
    name: 'Casual / Indie',
    description: 'Per giochi casual, indie, puzzle con tono leggero',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    isDefault: false,
    systemInstruction: 'You are a translator for casual and indie games. Keep the tone fun, light, and accessible.',
    styleDirective: 'Use friendly, conversational language. Humor should be adapted to work in the target language. Keep instructions clear and simple.',
    glossary: [],
    rules: [
      'Preserve placeholders',
      'Keep UI text concise — many casual games have small text areas',
      'Adapt puns and wordplay creatively',
      'Tutorial text must be crystal clear',
    ],
    fewShotExamples: [],
    temperature: 0.5,
    maxTokens: 4096,
    preservePatterns: ['\\{[^}]+\\}', '%[sd%]'],
  },
  {
    id: 'technical',
    name: 'Technical / Simulation',
    description: 'Per giochi di simulazione, strategia, con terminologia tecnica',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    isDefault: false,
    systemInstruction: 'You are a translator specializing in technical and simulation games. Accuracy and clarity are paramount.',
    styleDirective: 'Use precise, technical vocabulary. Prefer established industry terms. UI labels must be concise and unambiguous.',
    glossary: [],
    rules: [
      'Preserve all placeholders, units, and numbers',
      'Use official technical terminology when available',
      'Abbreviations should follow target language conventions',
      'Keep measurement units consistent (metric/imperial as in original)',
    ],
    fewShotExamples: [],
    temperature: 0.2,
    maxTokens: 8192,
    preservePatterns: ['\\{[^}]+\\}', '%[sd%]', '\\d+\\.?\\d*\\s*(km|m|kg|lb|mph|km/h)'],
  },
];

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

const STORAGE_KEY = 'gs_prompt_templates';

function loadAllTemplates(): PromptTemplate[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const custom: PromptTemplate[] = saved ? JSON.parse(saved) : [];
    return [...BUILTIN_TEMPLATES, ...custom];
  } catch {
    return [...BUILTIN_TEMPLATES];
  }
}

function saveCustomTemplates(templates: PromptTemplate[]): void {
  const custom = templates.filter(t => !BUILTIN_TEMPLATES.some(b => b.id === t.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export function getAllTemplates(): PromptTemplate[] {
  return loadAllTemplates();
}

export function getTemplate(id: string): PromptTemplate | undefined {
  return loadAllTemplates().find(t => t.id === id);
}

export function getTemplateForGame(gameId: string): PromptTemplate | undefined {
  return loadAllTemplates().find(t => t.gameId === gameId);
}

export function getDefaultTemplate(): PromptTemplate {
  return BUILTIN_TEMPLATES[0];
}

export function createTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): PromptTemplate {
  const now = new Date().toISOString();
  const newTemplate: PromptTemplate = {
    ...template,
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  
  const all = loadAllTemplates();
  all.push(newTemplate);
  saveCustomTemplates(all);
  return newTemplate;
}

export function updateTemplate(id: string, updates: Partial<PromptTemplate>): PromptTemplate | null {
  const all = loadAllTemplates();
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return null;
  
  // Non modificare builtin templates — crea una copia
  if (BUILTIN_TEMPLATES.some(b => b.id === id)) {
    const copy = { ...all[idx], ...updates, id: `custom_${id}_${Date.now()}`, updatedAt: new Date().toISOString() };
    all.push(copy);
    saveCustomTemplates(all);
    return copy;
  }
  
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  saveCustomTemplates(all);
  return all[idx];
}

export function deleteTemplate(id: string): boolean {
  if (BUILTIN_TEMPLATES.some(b => b.id === id)) return false; // Non eliminare builtin
  const all = loadAllTemplates();
  const filtered = all.filter(t => t.id !== id);
  if (filtered.length === all.length) return false;
  saveCustomTemplates(filtered);
  return true;
}

export function duplicateTemplate(id: string, newName?: string): PromptTemplate | null {
  const template = getTemplate(id);
  if (!template) return null;
  
  return createTemplate({
    ...template,
    name: newName || `${template.name} (Copy)`,
    isDefault: false,
    gameId: undefined,
    gameName: undefined,
  });
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Costruisce il prompt completo da un template.
 * Ritorna una stringa da iniettare prima delle stringhe da tradurre.
 */
export function buildPromptFromTemplate(
  template: PromptTemplate,
  targetLanguage: string,
  sourceLanguage: string = 'en'
): string {
  const parts: string[] = [];
  
  // System instruction
  if (template.systemInstruction) {
    parts.push(template.systemInstruction);
  }
  
  // Style directive
  if (template.styleDirective) {
    parts.push(`\nSTYLE: ${template.styleDirective}`);
  }
  
  // Rules
  if (template.rules.length > 0) {
    parts.push(`\nRULES:\n${template.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
  }
  
  // Glossary
  const activeGlossary = template.glossary.filter(g => g.source);
  if (activeGlossary.length > 0) {
    const glossaryLines = activeGlossary.map(g => {
      if (g.doNotTranslate) return `- "${g.source}" → DO NOT TRANSLATE (keep as-is)`;
      if (g.target) return `- "${g.source}" → "${g.target}"${g.context ? ` (${g.context})` : ''}`;
      return `- "${g.source}"${g.context ? ` (${g.context})` : ''}`;
    });
    parts.push(`\nGLOSSARY:\n${glossaryLines.join('\n')}`);
  }
  
  // Preserve patterns
  if (template.preservePatterns.length > 0) {
    parts.push(`\nPRESERVE these patterns exactly: ${template.preservePatterns.join(', ')}`);
  }
  
  // Few-shot examples
  if (template.fewShotExamples.length > 0) {
    const examples = template.fewShotExamples.map(e => 
      `  ${sourceLanguage}: "${e.source}"\n  ${targetLanguage}: "${e.target}"${e.context ? ` // ${e.context}` : ''}`
    );
    parts.push(`\nEXAMPLES:\n${examples.join('\n')}`);
  }
  
  // Translation instruction
  parts.push(`\nTranslate from ${sourceLanguage} to ${targetLanguage}. Return ONLY a JSON array of translated strings, same order.`);
  
  return parts.join('\n');
}

/**
 * Seleziona automaticamente il template migliore per un gioco.
 * Cerca: template specifico per gameId → template per genere → default.
 */
export function autoSelectTemplate(
  gameId?: string,
  gameGenre?: string
): PromptTemplate {
  // 1. Template specifico per il gioco
  if (gameId) {
    const gameTemplate = getTemplateForGame(gameId);
    if (gameTemplate) return gameTemplate;
  }
  
  // 2. Template per genere
  if (gameGenre) {
    const genreMap: Record<string, string> = {
      'jrpg': 'jrpg',
      'rpg': 'jrpg',
      'visual_novel': 'jrpg',
      'horror': 'horror',
      'psychological_horror': 'horror',
      'survival': 'horror',
      'puzzle': 'casual',
      'comedy': 'casual',
      'simulation': 'technical',
      'strategy': 'technical',
    };
    const templateId = genreMap[gameGenre];
    if (templateId) {
      const template = getTemplate(templateId);
      if (template) return template;
    }
  }
  
  // 3. Default
  return getDefaultTemplate();
}

// ============================================================================
// IMPORT / EXPORT
// ============================================================================

export function exportTemplate(id: string): string | null {
  const template = getTemplate(id);
  if (!template) return null;
  return JSON.stringify(template, null, 2);
}

export function importTemplate(json: string): PromptTemplate | null {
  try {
    const template = JSON.parse(json) as PromptTemplate;
    if (!template.name || !template.systemInstruction) return null;
    return createTemplate({
      ...template,
      name: `${template.name} (Imported)`,
      isDefault: false,
    });
  } catch {
    return null;
  }
}
