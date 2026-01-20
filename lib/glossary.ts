/**
 * # Glossary System
 * 
 * Sistema di glossario personalizzato per traduzioni.
 * Permette di definire termini che devono essere tradotti in modo specifico
 * o che non devono essere tradotti affatto (es. nomi propri).
 */

export interface GlossaryEntry {
  id: string;
  source: string;           // Termine originale
  target: string;           // Traduzione (vuoto = non tradurre)
  caseSensitive: boolean;   // Rispetta maiuscole/minuscole
  wholeWord: boolean;       // Solo parola intera
  category?: string;        // Categoria (nomi, items, UI, etc.)
  gameId?: string;          // Specifico per un gioco (null = globale)
  createdAt: number;
  updatedAt: number;
}

export interface Glossary {
  id: string;
  name: string;
  description?: string;
  gameId?: string;          // null = glossario globale
  entries: GlossaryEntry[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'gamestringer_glossaries';

class GlossaryManager {
  private glossaries: Map<string, Glossary> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as Glossary[];
        data.forEach(g => this.glossaries.set(g.id, g));
      }
      
      // Crea glossario globale di default se non esiste
      if (!this.getGlobalGlossary()) {
        this.createGlossary({
          name: 'Glossario Globale',
          description: 'Termini comuni a tutti i giochi',
          isActive: true,
        });
      }
      
      this.initialized = true;
    } catch (e) {
      console.error('[GLOSSARY] Errore init:', e);
    }
  }

  private save(): void {
    try {
      const data = Array.from(this.glossaries.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[GLOSSARY] Errore save:', e);
    }
  }

  private generateId(): string {
    return `gl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // === GLOSSARY CRUD ===

  createGlossary(data: Partial<Glossary>): Glossary {
    const now = Date.now();
    const glossary: Glossary = {
      id: this.generateId(),
      name: data.name || 'Nuovo Glossario',
      description: data.description,
      gameId: data.gameId,
      entries: [],
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    
    this.glossaries.set(glossary.id, glossary);
    this.save();
    return glossary;
  }

  getGlossary(id: string): Glossary | undefined {
    return this.glossaries.get(id);
  }

  getGlobalGlossary(): Glossary | undefined {
    return Array.from(this.glossaries.values()).find(g => !g.gameId);
  }

  getGlossariesForGame(gameId: string): Glossary[] {
    const global = this.getGlobalGlossary();
    const gameSpecific = Array.from(this.glossaries.values()).filter(
      g => g.gameId === gameId && g.isActive
    );
    
    return global ? [global, ...gameSpecific] : gameSpecific;
  }

  getAllGlossaries(): Glossary[] {
    return Array.from(this.glossaries.values());
  }

  updateGlossary(id: string, data: Partial<Glossary>): Glossary | null {
    const glossary = this.glossaries.get(id);
    if (!glossary) return null;
    
    Object.assign(glossary, data, { updatedAt: Date.now() });
    this.save();
    return glossary;
  }

  deleteGlossary(id: string): boolean {
    const deleted = this.glossaries.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  // === ENTRY CRUD ===

  addEntry(glossaryId: string, entry: Partial<GlossaryEntry>): GlossaryEntry | null {
    const glossary = this.glossaries.get(glossaryId);
    if (!glossary) return null;
    
    const now = Date.now();
    const newEntry: GlossaryEntry = {
      id: this.generateId(),
      source: entry.source || '',
      target: entry.target || '',
      caseSensitive: entry.caseSensitive ?? false,
      wholeWord: entry.wholeWord ?? true,
      category: entry.category,
      gameId: glossary.gameId,
      createdAt: now,
      updatedAt: now,
    };
    
    glossary.entries.push(newEntry);
    glossary.updatedAt = now;
    this.save();
    return newEntry;
  }

  updateEntry(glossaryId: string, entryId: string, data: Partial<GlossaryEntry>): GlossaryEntry | null {
    const glossary = this.glossaries.get(glossaryId);
    if (!glossary) return null;
    
    const entry = glossary.entries.find(e => e.id === entryId);
    if (!entry) return null;
    
    Object.assign(entry, data, { updatedAt: Date.now() });
    glossary.updatedAt = Date.now();
    this.save();
    return entry;
  }

  deleteEntry(glossaryId: string, entryId: string): boolean {
    const glossary = this.glossaries.get(glossaryId);
    if (!glossary) return false;
    
    const index = glossary.entries.findIndex(e => e.id === entryId);
    if (index === -1) return false;
    
    glossary.entries.splice(index, 1);
    glossary.updatedAt = Date.now();
    this.save();
    return true;
  }

  // === TRANSLATION HELPERS ===

  /**
   * Applica il glossario a un testo prima della traduzione.
   * Sostituisce i termini con placeholder per proteggerli.
   */
  applyGlossary(text: string, gameId?: string): { 
    processedText: string; 
    replacements: Map<string, string>;
  } {
    const glossaries = gameId 
      ? this.getGlossariesForGame(gameId) 
      : [this.getGlobalGlossary()].filter(Boolean) as Glossary[];
    
    const replacements = new Map<string, string>();
    let processedText = text;
    let placeholderIndex = 0;
    
    for (const glossary of glossaries) {
      if (!glossary.isActive) continue;
      
      for (const entry of glossary.entries) {
        if (!entry.source) continue;
        
        const flags = entry.caseSensitive ? 'g' : 'gi';
        const pattern = entry.wholeWord 
          ? `\\b${this.escapeRegex(entry.source)}\\b`
          : this.escapeRegex(entry.source);
        
        const regex = new RegExp(pattern, flags);
        
        if (regex.test(processedText)) {
          const placeholder = `[[GL${placeholderIndex}]]`;
          replacements.set(placeholder, entry.target || entry.source);
          processedText = processedText.replace(regex, placeholder);
          placeholderIndex++;
        }
      }
    }
    
    return { processedText, replacements };
  }

  /**
   * Ripristina i termini del glossario dopo la traduzione.
   */
  restoreGlossary(text: string, replacements: Map<string, string>): string {
    let restoredText = text;
    
    replacements.forEach((target, placeholder) => {
      restoredText = restoredText.replace(new RegExp(this.escapeRegex(placeholder), 'g'), target);
    });
    
    return restoredText;
  }

  /**
   * Traduce un testo applicando automaticamente il glossario.
   */
  async translateWithGlossary(
    text: string, 
    translateFn: (text: string) => Promise<string>,
    gameId?: string
  ): Promise<string> {
    const { processedText, replacements } = this.applyGlossary(text, gameId);
    const translated = await translateFn(processedText);
    return this.restoreGlossary(translated, replacements);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // === IMPORT/EXPORT ===

  exportGlossary(glossaryId: string): string | null {
    const glossary = this.glossaries.get(glossaryId);
    if (!glossary) return null;
    return JSON.stringify(glossary, null, 2);
  }

  exportAllGlossaries(): string {
    return JSON.stringify(Array.from(this.glossaries.values()), null, 2);
  }

  importGlossary(jsonData: string): Glossary | null {
    try {
      const data = JSON.parse(jsonData) as Glossary;
      data.id = this.generateId(); // Nuovo ID per evitare conflitti
      data.createdAt = Date.now();
      data.updatedAt = Date.now();
      
      this.glossaries.set(data.id, data);
      this.save();
      return data;
    } catch (e) {
      console.error('[GLOSSARY] Errore import:', e);
      return null;
    }
  }

  // === STATS ===

  getStats(): { 
    totalGlossaries: number; 
    totalEntries: number; 
    activeGlossaries: number;
  } {
    const glossaries = Array.from(this.glossaries.values());
    return {
      totalGlossaries: glossaries.length,
      totalEntries: glossaries.reduce((sum, g) => sum + g.entries.length, 0),
      activeGlossaries: glossaries.filter(g => g.isActive).length,
    };
  }
}

// Singleton
export const glossaryManager = new GlossaryManager();

// Categories predefinite
export const GLOSSARY_CATEGORIES = [
  { id: 'names', name: 'Nomi Propri', icon: '👤' },
  { id: 'items', name: 'Oggetti', icon: '🎒' },
  { id: 'skills', name: 'Abilità', icon: '⚔️' },
  { id: 'locations', name: 'Luoghi', icon: '🗺️' },
  { id: 'ui', name: 'Interfaccia', icon: '🖥️' },
  { id: 'lore', name: 'Lore/Storia', icon: '📜' },
  { id: 'other', name: 'Altro', icon: '📝' },
];
