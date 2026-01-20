// Tipi per il sistema Glossario di traduzione

export interface GlossaryEntry {
  id: string;
  original: string;        // Termine originale (es. "Health Points")
  translation: string;     // Traduzione fissa (es. "Punti Vita")
  caseSensitive: boolean;  // Se rispettare maiuscole/minuscole
  context?: string;        // Contesto opzionale (es. "UI", "Dialoghi", "Items")
  notes?: string;          // Note per il traduttore
  createdAt: string;
  updatedAt: string;
}

export interface GameGlossary {
  id: string;
  gameId: string;          // ID del gioco associato
  gameName: string;        // Nome del gioco per riferimento
  sourceLanguage: string;  // Lingua originale (es. "en")
  targetLanguage: string;  // Lingua target (es. "it")
  entries: GlossaryEntry[];
  metadata: GlossaryMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface GlossaryMetadata {
  genre?: string;          // Genere del gioco (RPG, FPS, etc.)
  tone?: string;           // Tono (Serio, Comico, Epico, etc.)
  setting?: string;        // Ambientazione (Fantasy, Sci-Fi, etc.)
  doNotTranslate: string[]; // Nomi/termini da NON tradurre mai
  notes?: string;          // Note generali sul gioco
  characters?: GameCharacter[]; // Personaggi del gioco
  worldContext?: string;   // Contesto del mondo di gioco
}

// Personaggio del gioco per context injection
export interface GameCharacter {
  name: string;            // Nome del personaggio
  description?: string;    // Descrizione breve
  personality?: string;    // Tratti di personalità (es. "sarcastico", "formale")
  speechStyle?: string;    // Stile di parlata (es. "arcaico", "slang", "tecnico")
  gender?: 'male' | 'female' | 'neutral' | 'unknown';
  role?: string;           // Ruolo (es. "protagonista", "antagonista", "NPC")
}

export interface GlossarySearchResult {
  entry: GlossaryEntry;
  matchType: 'exact' | 'partial' | 'fuzzy';
  confidence: number;
}

// Per import/export
export interface GlossaryExport {
  version: string;
  exportedAt: string;
  glossary: GameGlossary;
}

// Contesti predefiniti
export const GLOSSARY_CONTEXTS = [
  'UI',
  'Dialoghi',
  'Items',
  'Abilità',
  'Luoghi',
  'Personaggi',
  'Sistema',
  'Tutorial',
  'Altro'
] as const;

export type GlossaryContext = typeof GLOSSARY_CONTEXTS[number];

// Toni predefiniti
export const GLOSSARY_TONES = [
  'Neutro',
  'Formale',
  'Informale',
  'Epico',
  'Comico',
  'Serio',
  'Poetico'
] as const;

export type GlossaryTone = typeof GLOSSARY_TONES[number];

// Generi predefiniti
export const GAME_GENRES = [
  'RPG',
  'Action',
  'Adventure',
  'Strategy',
  'Simulation',
  'Horror',
  'Puzzle',
  'Sports',
  'Racing',
  'FPS',
  'Platformer',
  'Visual Novel',
  'Altro'
] as const;

export type GameGenre = typeof GAME_GENRES[number];
