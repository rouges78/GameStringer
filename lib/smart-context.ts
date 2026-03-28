/**
 * Smart Context Memory - AI che impara lo stile di traduzione
 * Memorizza personaggi, luoghi, termini ricorrenti e stili
 */

export interface CharacterProfile {
  name: string;
  aliases: string[];
  speechStyle: 'formal' | 'informal' | 'archaic' | 'modern' | 'slang' | 'neutral';
  personality: string;
  catchphrases: string[];
  translatedName?: string;
  notes: string;
}

export interface LocationProfile {
  name: string;
  translatedName: string;
  description: string;
  relatedTerms: string[];
}

export interface TermEntry {
  original: string;
  translation: string;
  context: string;
  frequency: number;
  lastUsed: Date;
  approved: boolean;
}

export interface StylePattern {
  pattern: string;
  replacement: string;
  description: string;
  examples: { original: string; translated: string }[];
}

export interface GameContext {
  gameId: string;
  gameName: string;
  genre: string;
  setting: string;
  tone: 'serious' | 'humorous' | 'dark' | 'lighthearted' | 'epic' | 'casual';
  era: 'modern' | 'medieval' | 'futuristic' | 'fantasy' | 'historical';
  characters: CharacterProfile[];
  locations: LocationProfile[];
  terms: TermEntry[];
  stylePatterns: StylePattern[];
  translationNotes: string[];
  createdAt: Date;
  updatedAt: Date;
  stats: {
    totalStrings: number;
    translatedStrings: number;
    approvedStrings: number;
    learnings: number;
  };
}

const STORAGE_KEY = 'gamestringer_smart_context';

class SmartContextManager {
  private contexts: Map<string, GameContext> = new Map();
  private currentGameId: string | null = null;

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        Object.entries(parsed).forEach(([key, value]) => {
          this.contexts.set(key, value as GameContext);
        });
      }
    } catch (e) {
      console.error('Errore caricamento Smart Context:', e);
    }
  }

  private save() {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, GameContext> = {};
      this.contexts.forEach((value, key) => {
        obj[key] = value;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error('Errore salvataggio Smart Context:', e);
    }
  }

  setCurrentGame(gameId: string) {
    this.currentGameId = gameId;
  }

  getCurrentContext(): GameContext | null {
    if (!this.currentGameId) return null;
    return this.contexts.get(this.currentGameId) || null;
  }

  createContext(gameId: string, gameName: string, options?: Partial<GameContext>): GameContext {
    const context: GameContext = {
      gameId,
      gameName,
      genre: options?.genre || 'unknown',
      setting: options?.setting || '',
      tone: options?.tone || 'neutral' as unknown,
      era: options?.era || 'modern',
      characters: [],
      locations: [],
      terms: [],
      stylePatterns: [],
      translationNotes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: {
        totalStrings: 0,
        translatedStrings: 0,
        approvedStrings: 0,
        learnings: 0,
      },
      ...options,
    };
    this.contexts.set(gameId, context);
    this.currentGameId = gameId;
    this.save();
    return context;
  }

  getContext(gameId: string): GameContext | null {
    return this.contexts.get(gameId) || null;
  }

  getAllContexts(): GameContext[] {
    return Array.from(this.contexts.values());
  }

  // === PERSONAGGI ===
  addCharacter(character: CharacterProfile) {
    const ctx = this.getCurrentContext();
    if (!ctx) return;
    
    const existing = ctx.characters.findIndex(c => 
      c.name.toLowerCase() === character.name.toLowerCase()
    );
    
    if (existing >= 0) {
      ctx.characters[existing] = { ...ctx.characters[existing], ...character };
    } else {
      ctx.characters.push(character);
    }
    
    ctx.updatedAt = new Date();
    ctx.stats.learnings++;
    this.save();
  }

  getCharacter(name: string): CharacterProfile | null {
    const ctx = this.getCurrentContext();
    if (!ctx) return null;
    
    return ctx.characters.find(c => 
      c.name.toLowerCase() === name.toLowerCase() ||
      c.aliases.some(a => a.toLowerCase() === name.toLowerCase())
    ) || null;
  }

  // === LUOGHI ===
  addLocation(location: LocationProfile) {
    const ctx = this.getCurrentContext();
    if (!ctx) return;
    
    const existing = ctx.locations.findIndex(l => 
      l.name.toLowerCase() === location.name.toLowerCase()
    );
    
    if (existing >= 0) {
      ctx.locations[existing] = { ...ctx.locations[existing], ...location };
    } else {
      ctx.locations.push(location);
    }
    
    ctx.updatedAt = new Date();
    ctx.stats.learnings++;
    this.save();
  }

  // === TERMINI ===
  addTerm(original: string, translation: string, context: string = '') {
    const ctx = this.getCurrentContext();
    if (!ctx) return;
    
    const existing = ctx.terms.findIndex(t => 
      t.original.toLowerCase() === original.toLowerCase()
    );
    
    if (existing >= 0) {
      ctx.terms[existing].frequency++;
      ctx.terms[existing].lastUsed = new Date();
      if (translation !== ctx.terms[existing].translation) {
        ctx.terms[existing].translation = translation;
        ctx.terms[existing].approved = false;
      }
    } else {
      ctx.terms.push({
        original,
        translation,
        context,
        frequency: 1,
        lastUsed: new Date(),
        approved: false,
      });
    }
    
    ctx.updatedAt = new Date();
    ctx.stats.learnings++;
    this.save();
  }

  getTerm(original: string): TermEntry | null {
    const ctx = this.getCurrentContext();
    if (!ctx) return null;
    
    return ctx.terms.find(t => 
      t.original.toLowerCase() === original.toLowerCase()
    ) || null;
  }

  approveTerm(original: string) {
    const ctx = this.getCurrentContext();
    if (!ctx) return;
    
    const term = ctx.terms.find(t => 
      t.original.toLowerCase() === original.toLowerCase()
    );
    
    if (term) {
      term.approved = true;
      ctx.stats.approvedStrings++;
      this.save();
    }
  }

  // === PATTERN DI STILE ===
  addStylePattern(pattern: StylePattern) {
    const ctx = this.getCurrentContext();
    if (!ctx) return;
    
    ctx.stylePatterns.push(pattern);
    ctx.updatedAt = new Date();
    ctx.stats.learnings++;
    this.save();
  }

  // === APPRENDIMENTO AUTOMATICO ===
  learnFromTranslation(original: string, translation: string, metadata?: {
    speaker?: string;
    location?: string;
    context?: string;
  }) {
    const ctx = this.getCurrentContext();
    if (!ctx) return;

    // Estrai nomi propri (parole che iniziano con maiuscola)
    const properNouns = original.match(/\b[A-Z][a-z]+\b/g) || [];
    const translatedProperNouns = translation.match(/\b[A-Z][a-zàèìòùáéíóú]+\b/g) || [];
    
    // Se troviamo corrispondenze, le memorizziamo
    properNouns.forEach((noun, i) => {
      if (translatedProperNouns[i]) {
        this.addTerm(noun, translatedProperNouns[i], metadata?.context || '');
      }
    });

    // Se c'è un speaker, aggiorna il profilo del personaggio
    if (metadata?.speaker) {
      const char = this.getCharacter(metadata.speaker);
      if (!char) {
        // Prova a dedurre lo stile dal testo
        const isInformal = /\b(hey|yo|dude|man|bro|gonna|wanna|gotta)\b/i.test(original);
        const isFormal = /\b(sir|madam|indeed|perhaps|rather|quite)\b/i.test(original);
        const isArchaic = /\b(thee|thou|thy|hath|doth|whilst|wherefore)\b/i.test(original);
        
        let style: CharacterProfile['speechStyle'] = 'neutral';
        if (isArchaic) style = 'archaic';
        else if (isFormal) style = 'formal';
        else if (isInformal) style = 'informal';
        
        this.addCharacter({
          name: metadata.speaker,
          aliases: [],
          speechStyle: style,
          personality: '',
          catchphrases: [],
          notes: `Auto-detected from dialogue`,
        });
      }
    }

    ctx.stats.translatedStrings++;
    ctx.updatedAt = new Date();
    this.save();
  }

  // === SUGGERIMENTI CONTESTUALI ===
  getSuggestions(text: string): {
    terms: TermEntry[];
    characters: CharacterProfile[];
    styleNotes: string[];
  } {
    const ctx = this.getCurrentContext();
    if (!ctx) return { terms: [], characters: [], styleNotes: [] };

    const textLower = text.toLowerCase();
    
    // Trova termini rilevanti
    const terms = ctx.terms.filter(t => 
      textLower.includes(t.original.toLowerCase())
    ).sort((a, b) => b.frequency - a.frequency);

    // Trova personaggi menzionati
    const characters = ctx.characters.filter(c =>
      textLower.includes(c.name.toLowerCase()) ||
      c.aliases.some(a => textLower.includes(a.toLowerCase()))
    );

    // Genera note di stile
    const styleNotes: string[] = [];
    
    characters.forEach(char => {
      if (char.speechStyle === 'formal') {
        styleNotes.push(`${char.name} parla in modo formale - usa "Lei" e toni rispettosi`);
      } else if (char.speechStyle === 'informal') {
        styleNotes.push(`${char.name} parla in modo informale - usa "tu" e slang`);
      } else if (char.speechStyle === 'archaic') {
        styleNotes.push(`${char.name} usa linguaggio arcaico - considera "voi" e forme desuete`);
      }
    });

    return { terms, characters, styleNotes };
  }

  // === GENERA PROMPT CONTESTUALE PER AI ===
  generateContextPrompt(): string {
    const ctx = this.getCurrentContext();
    if (!ctx) return '';

    let prompt = `## Contesto del gioco: ${ctx.gameName}\n`;
    prompt += `Genere: ${ctx.genre} | Ambientazione: ${ctx.era} | Tono: ${ctx.tone}\n\n`;

    if (ctx.characters.length > 0) {
      prompt += `### Personaggi:\n`;
      ctx.characters.slice(0, 10).forEach(c => {
        prompt += `- **${c.name}**: stile ${c.speechStyle}`;
        if (c.translatedName) prompt += ` (tradotto: ${c.translatedName})`;
        if (c.personality) prompt += ` - ${c.personality}`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    if (ctx.terms.length > 0) {
      const approvedTerms = ctx.terms.filter(t => t.approved || t.frequency >= 3);
      if (approvedTerms.length > 0) {
        prompt += `### Glossario stabilito:\n`;
        approvedTerms.slice(0, 20).forEach(t => {
          prompt += `- "${t.original}" → "${t.translation}"\n`;
        });
        prompt += '\n';
      }
    }

    if (ctx.translationNotes.length > 0) {
      prompt += `### Note di traduzione:\n`;
      ctx.translationNotes.forEach(n => {
        prompt += `- ${n}\n`;
      });
    }

    return prompt;
  }

  // === ESPORTA/IMPORTA ===
  exportContext(gameId: string): string {
    const ctx = this.contexts.get(gameId);
    if (!ctx) return '';
    return JSON.stringify(ctx, null, 2);
  }

  importContext(json: string): boolean {
    try {
      const ctx = JSON.parse(json) as GameContext;
      if (ctx.gameId && ctx.gameName) {
        this.contexts.set(ctx.gameId, ctx);
        this.save();
        return true;
      }
    } catch (e) {
      console.error('Errore import context:', e);
    }
    return false;
  }

  deleteContext(gameId: string) {
    this.contexts.delete(gameId);
    if (this.currentGameId === gameId) {
      this.currentGameId = null;
    }
    this.save();
  }
}

export const smartContext = new SmartContextManager();
