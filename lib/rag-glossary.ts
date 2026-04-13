/**
 * Micro-RAG (Retrieval-Augmented Generation) per Glossario e Lore
 * 
 * Questo modulo analizza un batch di testi da tradurre e recupera dinamicamente
 * SOLO le voci del glossario o del Lore rilevanti, per evitare di saturare
 * il context window del LLM e garantire coerenza.
 */

export interface GlossaryEntry {
  term: string;         // Termine originale (es. "Potion")
  translation: string;  // Traduzione obbligatoria (es. "Pozione")
  context?: string;     // Contesto/Lore (es. "Oggetto curativo base creato dagli Alchimisti di Xur")
  isRegex?: boolean;    // Se true, term viene trattato come regex
}

export class RagGlossary {
  private entries: GlossaryEntry[] = [];
  
  constructor(entries?: GlossaryEntry[]) {
    if (entries) {
      this.entries = entries;
    }
  }

  /** Carica il glossario dal LocalStorage (creato dal modulo dizionari) */
  public loadFromStorage(gameId: string) {
    try {
      // Formato standard del dizionario in GameStringer
      const savedDicts = JSON.parse(localStorage.getItem(`dict_${gameId}`) || '[]');
      if (Array.isArray(savedDicts)) {
        this.entries = savedDicts.map(d => ({
          term: d.original,
          translation: d.translated,
          context: d.context || '',
          isRegex: d.isRegex || false
        }));
      }
    } catch (e: unknown) {
      clientLogger.warn('[RAG] Errore caricamento glossario dal local storage:', e);
    }
  }

  /**
   * Cerca i termini rilevanti per un blocco di testo
   * @param texts Array di stringhe da tradurre
   * @param maxEntries Massimo numero di voci da restituire (per non saturare il LLM)
   */
  public getRelevantContext(texts: string[], maxEntries: number = 15): string {
    if (this.entries.length === 0) return '';

    const combinedText = texts.join(' ').toLowerCase();
    const matchedEntries = new Set<GlossaryEntry>();

    // Ricerca Keyword-based rapida
    for (const entry of this.entries) {
      if (entry.isRegex) {
        try {
          const regex = new RegExp(entry.term, 'i');
          if (regex.test(combinedText)) {
            matchedEntries.add(entry);
          }
        } catch {
          // Ignora regex malformate
        }
      } else {
        // Ricerca esatta del termine (case-insensitive) con confini di parola
        const termLower = entry.term.toLowerCase();
        // Controllo veloce prima del regex pesante
        if (combinedText.includes(termLower)) {
          // Verifica boundary per evitare falsi positivi (es. "cat" dentro "concatenate")
          const boundaryRegex = new RegExp(`\\b${this.escapeRegExp(termLower)}\\b`, 'i');
          if (boundaryRegex.test(combinedText)) {
            matchedEntries.add(entry);
          }
        }
      }

      if (matchedEntries.size >= maxEntries) break;
    }

    if (matchedEntries.size === 0) return '';

    // Costruisci il prompt aggiuntivo
    let ragPrompt = `\n--- MANDATORY GLOSSARY & LORE ---\nYou MUST translate the following terms exactly as specified:\n`;
    
    for (const entry of matchedEntries) {
      ragPrompt += `- "${entry.term}" -> "${entry.translation}"`;
      if (entry.context) {
        ragPrompt += ` (Context: ${entry.context})`;
      }
      ragPrompt += `\n`;
    }
    ragPrompt += `---------------------------------\n`;

    return ragPrompt;
  }

  private escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
