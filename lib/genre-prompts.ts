/**
 * Genre-Aware Translation Prompts
 * 
 * Sistema di prompt engineering avanzato per generi specifici.
 * Ogni genere ha istruzioni di tono, stile, vocabolario e regole
 * che guidano l'AI a produrre traduzioni coerenti con l'atmosfera del gioco.
 */

export type GameGenre =
  | 'psychological_horror'
  | 'horror'
  | 'rpg'
  | 'jrpg'
  | 'visual_novel'
  | 'adventure'
  | 'action'
  | 'strategy'
  | 'simulation'
  | 'puzzle'
  | 'comedy'
  | 'noir'
  | 'sci_fi'
  | 'fantasy'
  | 'survival'
  | 'romance'
  | 'mystery'
  | 'generic';

export interface GenrePromptConfig {
  genre: GameGenre;
  label: string;
  description: string;
  /** Istruzioni di stile per il prompt di traduzione */
  styleDirective: string;
  /** Regole specifiche per il genere */
  rules: string[];
  /** Vocabolario preferito (EN → suggerimento stile) */
  vocabularyHints: Record<string, string>;
  /** Temperatura suggerita per LLM */
  suggestedTemperature: number;
  /** Emoji per UI */
  icon: string;
}

// ─── GENRE PROMPT CONFIGS ────────────────────────────────────────

const GENRE_CONFIGS: Record<GameGenre, GenrePromptConfig> = {

  psychological_horror: {
    genre: 'psychological_horror',
    label: 'Horror Psicologico',
    description: 'Giochi con atmosfera opprimente, ambiguità narrativa, disagio interiore (es. Esoteric Ebb, Silent Hill, Soma)',
    icon: '🧠',
    suggestedTemperature: 0.4,
    styleDirective: `You are translating a PSYCHOLOGICAL HORROR game. This genre demands extreme precision in tone.

TONE RULES:
- Maintain pervasive unease and dread — never let translations feel "safe" or neutral
- Preserve ambiguity: if the original is vague or unsettling, the translation MUST stay vague and unsettling. Do NOT clarify what the author left unclear
- Use cold, clinical language for descriptions; fractured, intimate language for internal monologue
- Avoid overly dramatic or "pulp horror" phrasing — psychological horror whispers, it doesn't scream
- Ellipsis (...) and pauses carry weight — preserve them exactly
- Sentence fragments are intentional — do NOT complete them into full sentences
- When characters speak about disturbing things casually, maintain that disturbing casualness

VOCABULARY STYLE:
- Prefer unsettling precision over generic fear words (e.g. "disagio" over "paura", "inquietudine" over "terrore")  
- Medical/clinical terminology when describing mental states
- Poetic but cold imagery — like a clinical report written by a poet
- Internal thoughts should feel raw, fragmented, dissociative`,
    rules: [
      'NEVER soften disturbing content — if the original is uncomfortable, the translation must be equally uncomfortable',
      'Preserve ALL formatting: line breaks, ellipsis, dashes, capitalization quirks',
      'Proper nouns, creature names, and invented terms stay UNTRANSLATED unless they are common English words used symbolically',
      'If a sentence is intentionally grammatically broken, keep it broken in translation',
      'Whispers, muttering, and fragmented speech must retain their fragmented quality',
      'Ambiguous pronouns (it, they, that thing) must remain ambiguous — do not resolve references',
    ],
    vocabularyHints: {
      'dread': 'angoscia / presagio',
      'unease': 'disagio / inquietudine',
      'unsettling': 'perturbante / destabilizzante',
      'eerie': 'sinistro / straniante',
      'hollow': 'vuoto / cavo (emotivo)',
      'numb': 'intorpidito / anestetizzato',
      'crawling': 'strisciante (sensazione)',
      'whisper': 'sussurro / mormorio',
      'flicker': 'guizzo / tremolio',
      'decay': 'disfacimento / decomposizione',
      'wrong': 'sbagliato (nel senso di "qualcosa non va")',
      'it': 'non specificare — mantenere "esso" o "quello" se ambiguo',
      'the thing': 'la cosa (non specificare mai cosa sia)',
      'remember': 'ricordare (peso emotivo, non azione neutra)',
      'forget': 'dimenticare (implicazione di rimozione, non distrazione)',
    },
  },

  horror: {
    genre: 'horror',
    label: 'Horror',
    description: 'Horror classico, survival horror, body horror (es. Resident Evil, Dead Space, Amnesia)',
    icon: '👻',
    suggestedTemperature: 0.3,
    styleDirective: `You are translating a HORROR game. Atmosphere and tension are critical.

TONE RULES:
- Build tension through word choice — short, punchy sentences for action; longer, suffocating ones for atmosphere
- Gore and violence: translate accurately without censoring, but use visceral language, not cartoonish
- Sound descriptions (groans, scraping, dripping) must be evocative and specific
- Item descriptions should feel utilitarian and desperate — survivors don't write poetry
- Environmental descriptions should create claustrophobia and unease`,
    rules: [
      'Keep creature/monster names untranslated if they are proper nouns',
      'Preserve urgency in gameplay prompts — short, imperative',
      'Blood, gore, and violence terms must be precise, not euphemistic',
      'Sound effects and onomatopoeia: adapt to target language conventions',
    ],
    vocabularyHints: {
      'blood': 'sangue',
      'scream': 'urlo / grido',
      'corpse': 'cadavere (mai "corpo morto")',
      'creature': 'creatura',
      'lurking': 'in agguato',
      'flesh': 'carne (tessuto)',
    },
  },

  rpg: {
    genre: 'rpg',
    label: 'RPG / Action RPG',
    description: 'Giochi di ruolo occidentali (es. Skyrim, Divinity, Baldur\'s Gate)',
    icon: '⚔️',
    suggestedTemperature: 0.3,
    styleDirective: `You are translating an RPG game. Consistency and immersion are paramount.

TONE RULES:
- NPCs should have distinct speech patterns reflecting their social class and race
- Nobles speak formally, peasants informally, scholars use elaborate vocabulary
- Quest descriptions should be clear but atmospheric
- Item descriptions should be concise and informative
- Lore entries should feel like in-world documents
- Use "tu" for informal dialogue, "voi" for formal/noble speech`,
    rules: [
      'Keep ALL stat names, skill names, and class names consistent across the entire translation',
      'Proper nouns (character names, place names, faction names) stay UNTRANSLATED',
      'Numbers, stats, and formulas must be preserved exactly',
      'Gameplay terms (HP, MP, XP, DPS, etc.) stay in English or use established Italian gaming conventions',
    ],
    vocabularyHints: {
      'quest': 'missione / incarico',
      'guild': 'gilda',
      'dungeon': 'dungeon (non tradurre)',
      'party': 'gruppo',
      'inventory': 'inventario',
      'spell': 'incantesimo',
      'skill': 'abilità',
      'perk': 'talento / vantaggio',
    },
  },

  jrpg: {
    genre: 'jrpg',
    label: 'JRPG',
    description: 'JRPG giapponesi (es. Final Fantasy, Persona, Tales of)',
    icon: '🗡️',
    suggestedTemperature: 0.35,
    styleDirective: `You are translating a JRPG. Honor the dramatic Japanese storytelling style.

TONE RULES:
- Dialogue should feel alive and expressive — JRPGs are theatrical
- Battle cries and special move names: keep the dramatic flair
- Emotional beats are amplified — tears, rage, determination are expressed fully
- Humor can be slapstick or pun-based — adapt creatively
- Honorifics: use Italian equivalents or drop them naturally, don't transliterate "-san/-kun"
- Internal monologue tends to be melodramatic — keep it that way`,
    rules: [
      'Attack names and skill names: keep Japanese names if established, translate descriptive ones',
      'Character catchphrases must be consistent throughout',
      'Onomatopoeia: adapt to Italian conventions (not literal from Japanese)',
      'Food items: keep Japanese names with brief context if needed',
    ],
    vocabularyHints: {
      'senpai': 'uso contestuale — "senior" o nome proprio',
      'sensei': 'maestro / professore',
      'warrior': 'guerriero',
      'hero': 'eroe',
      'darkness': 'oscurità / tenebre (drammatico)',
      'light': 'luce (con peso simbolico)',
    },
  },

  visual_novel: {
    genre: 'visual_novel',
    label: 'Visual Novel',
    description: 'Visual novel, dating sim (es. Doki Doki, Steins;Gate, Clannad)',
    icon: '📖',
    suggestedTemperature: 0.4,
    styleDirective: `You are translating a VISUAL NOVEL. Prose quality is everything.

TONE RULES:
- Dialogue should feel natural and conversational — these are long conversations
- Internal monologue should feel intimate, like a diary
- Descriptions are literary — they set mood and atmosphere
- Humor is often dry or self-deprecating — keep it natural in translation
- Romantic scenes: warm but not overwrought
- Each character should have a distinct voice and speech pattern`,
    rules: [
      'Preserve line breaks — they control pacing in VNs',
      'Name tags / speaker labels stay untranslated',
      'Choices must be natural and clear — the player needs to understand implications',
      'Cultural references: localize when possible, footnote when not',
    ],
    vocabularyHints: {
      'route': 'percorso / rotta (narrativa)',
      'ending': 'finale',
      'choice': 'scelta',
      'flag': 'flag (tecnico, non tradurre)',
    },
  },

  adventure: {
    genre: 'adventure',
    label: 'Avventura',
    description: 'Avventure grafiche, point & click (es. Monkey Island, Disco Elysium)',
    icon: '🗺️',
    suggestedTemperature: 0.4,
    styleDirective: `You are translating an ADVENTURE game. Wit, charm, and clarity matter.

TONE RULES:
- Object descriptions should be whimsical yet informative — players need to solve puzzles
- Dialogue should be characterful — every NPC has personality
- Humor: preserve wordplay and puns, adapt creatively to target language
- Puzzle hints must remain exactly as cryptic (or clear) as the original
- Internal monologue is often sarcastic or witty`,
    rules: [
      'Do NOT make puzzle hints more obvious or more obscure in translation',
      'Wordplay: if a pun cannot be translated, create an equivalent pun in target language',
      'Item names should be memorable and descriptive',
      'Preserve the rhythm of comedic timing — short quips stay short',
    ],
    vocabularyHints: {
      'look at': 'esamina / osserva',
      'pick up': 'prendi / raccogli',
      'use': 'usa',
      'talk to': 'parla con',
      'combine': 'combina',
    },
  },

  action: {
    genre: 'action',
    label: 'Azione',
    description: 'Sparatutto, azione, FPS (es. DOOM, Call of Duty, Halo)',
    icon: '💥',
    suggestedTemperature: 0.25,
    styleDirective: `You are translating an ACTION game. Keep it punchy, direct, and adrenaline-fueled.

TONE RULES:
- UI text and prompts: ultra-concise, imperative
- Military/tactical jargon: use established Italian equivalents
- Dialogue is brief and utilitarian — soldiers don't philosophize mid-combat
- Weapon and equipment descriptions: technical and precise`,
    rules: [
      'Keep translations SHORT — screen space is limited in action games',
      'Military ranks and callsigns stay in English or use NATO conventions',
      'Weapon names stay untranslated',
      'HUD elements must be extremely concise',
    ],
    vocabularyHints: {
      'reload': 'ricarica',
      'ammo': 'munizioni',
      'cover': 'copertura',
      'hostile': 'ostile',
      'objective': 'obiettivo',
      'squad': 'squadra',
    },
  },

  strategy: {
    genre: 'strategy',
    label: 'Strategia',
    description: 'Strategia, 4X, tattici (es. Civilization, XCOM, Total War)',
    icon: '♟️',
    suggestedTemperature: 0.25,
    styleDirective: `You are translating a STRATEGY game. Precision and clarity are paramount.

TONE RULES:
- Tooltips and descriptions must be unambiguous — players make decisions based on these
- Diplomatic text: formal and measured
- Event descriptions: informative, occasionally dramatic
- Tutorial text: clear and pedagogical`,
    rules: [
      'Numbers, percentages, and formulas must be preserved EXACTLY',
      'Unit names: translate descriptive ones, keep proper nouns',
      'Consistent terminology for game mechanics across all text',
      'Tooltips: accuracy over style',
    ],
    vocabularyHints: {
      'yield': 'rendimento / produzione',
      'tile': 'casella / terreno',
      'research': 'ricerca',
      'diplomacy': 'diplomazia',
      'trade': 'commercio',
      'production': 'produzione',
    },
  },

  simulation: {
    genre: 'simulation',
    label: 'Simulazione',
    description: 'Simulatori, gestione (es. Stardew Valley, Cities Skylines, The Sims)',
    icon: '🏗️',
    suggestedTemperature: 0.3,
    styleDirective: `You are translating a SIMULATION game. Friendly, clear, and informative.

TONE RULES:
- UI text must be crystal clear — this is a game about managing systems
- Dialogue (if any) is warm, casual, community-oriented
- Descriptions are practical and informative
- Tutorial and help text: patient and encouraging`,
    rules: [
      'Currency, measurements, and numbers must be preserved',
      'Menu items and labels must be concise — UI space is precious',
      'Consistent naming for buildings, resources, and game objects',
    ],
    vocabularyHints: {
      'farm': 'fattoria',
      'crop': 'coltura / raccolto',
      'build': 'costruisci',
      'upgrade': 'potenzia / migliora',
      'budget': 'bilancio',
    },
  },

  puzzle: {
    genre: 'puzzle',
    label: 'Puzzle',
    description: 'Puzzle, rompicapo, escape room (es. The Witness, Baba Is You, Return of the Obra Dinn)',
    icon: '🧩',
    suggestedTemperature: 0.3,
    styleDirective: `You are translating a PUZZLE game. Precision is non-negotiable.

TONE RULES:
- Clue text must preserve EXACTLY the same level of ambiguity as the original
- Wordplay-based puzzles: translate the mechanic, not the literal words
- Minimal text — every word counts
- Environmental text may be part of the puzzle — translate with extreme care`,
    rules: [
      'CRITICAL: Do NOT add information that changes puzzle solutions',
      'If a word has double meaning that IS the puzzle, find equivalent double meaning in target language',
      'Letter-count or pattern-based puzzles may need full localization review',
      'Keep text length similar — spatial puzzles depend on text fitting',
    ],
    vocabularyHints: {},
  },

  comedy: {
    genre: 'comedy',
    label: 'Comico',
    description: 'Giochi comici, parodie (es. Undertale, Portal, West of Loathing)',
    icon: '😂',
    suggestedTemperature: 0.5,
    styleDirective: `You are translating a COMEDY game. The humor MUST land in the target language.

TONE RULES:
- Jokes, puns, and wordplay: ADAPT creatively. A literal translation of a joke that doesn't work is worse than no joke
- Timing: short setups, punchy punchlines — preserve rhythm
- Breaking the fourth wall: keep the tone
- Sarcasm and irony must be recognizable
- Pop culture references: localize to equivalent references the target audience knows, or keep original if universally known`,
    rules: [
      'If a pun cannot be translated, create an equivalent pun that fits the context',
      'Running gags must stay consistent throughout',
      'Character voice is crucial — each character\'s humor style must be preserved',
      'Absurdist humor: keep it absurd, don\'t rationalize it',
    ],
    vocabularyHints: {},
  },

  noir: {
    genre: 'noir',
    label: 'Noir / Detective',
    description: 'Noir, detective, thriller (es. L.A. Noire, Disco Elysium, Heavy Rain)',
    icon: '🕵️',
    suggestedTemperature: 0.4,
    styleDirective: `You are translating a NOIR/DETECTIVE game. Atmosphere drips from every line.

TONE RULES:
- Internal monologue: hard-boiled, world-weary, sardonic
- Dialogue: layered with subtext — what characters DON'T say matters
- Descriptions: atmospheric, moody, rain-soaked imagery
- Evidence and clue descriptions: clinical contrast to the poetry of narration
- Every character is hiding something — translations should preserve that tension`,
    rules: [
      'Preserve subtext — if a line has hidden meaning, the translation must support the same reading',
      'Clue descriptions: accurate and factual',
      'Slang and street language: use appropriate Italian equivalents',
      'Time period language: match the era if applicable',
    ],
    vocabularyHints: {
      'dame': 'tipa / signora (con sfumatura)',
      'gumshoe': 'investigatore / segugio',
      'joint': 'locale / bettola',
      'suspect': 'sospettato',
      'evidence': 'prova / indizio',
    },
  },

  sci_fi: {
    genre: 'sci_fi',
    label: 'Fantascienza',
    description: 'Sci-fi, spazio, cyberpunk (es. Mass Effect, Cyberpunk 2077, Outer Wilds)',
    icon: '🚀',
    suggestedTemperature: 0.3,
    styleDirective: `You are translating a SCI-FI game. Technical accuracy meets narrative immersion.

TONE RULES:
- Technical jargon should feel natural and lived-in, not forced
- Alien/future slang: keep it consistent, create Italian equivalents that feel organic
- Ship/station logs: formal, technical, military cadence
- Character dialogue: varies by species/faction/social class
- Worldbuilding text (codex, lore): encyclopedic but engaging`,
    rules: [
      'Technology names: keep in English if universally recognized, translate if descriptive',
      'Alien race names and planet names stay UNTRANSLATED',
      'Measurement units: use whatever the original uses (metric/imperial/fictional)',
      'Codex/database entries: maintain formal, documentary tone',
    ],
    vocabularyHints: {
      'FTL': 'FTL / superluminale',
      'hyperdrive': 'iperguida',
      'AI': 'IA',
      'cryo': 'crio-',
      'hull': 'scafo',
      'airlock': 'camera di decompressione',
    },
  },

  fantasy: {
    genre: 'fantasy',
    label: 'Fantasy',
    description: 'Fantasy epico, dark fantasy (es. Dark Souls, Elden Ring, Dragon Age)',
    icon: '🐉',
    suggestedTemperature: 0.35,
    styleDirective: `You are translating a FANTASY game. Grandeur and mythic weight in every line.

TONE RULES:
- Lore text: archaic, epic, weighty — like ancient chronicles
- Dialogue varies: commoners speak simply, mages speak elaborately, warriors speak bluntly
- Item descriptions: evocative, mysterious, legendary
- Spell incantations: rhythmic, poetic
- Dark fantasy: oppressive, fatalistic tone`,
    rules: [
      'Spell names: translate if descriptive, keep if proper nouns',
      'Place names and character names: NEVER translate',
      'Archaic language is intentional — keep it archaic in translation',
      'Consistent naming for magic systems, races, factions',
    ],
    vocabularyHints: {
      'thou': 'tu / voi (arcaico)',
      'realm': 'reame / regno',
      'arcane': 'arcano',
      'rune': 'runa',
      'undead': 'non-morto',
      'kin': 'stirpe / progenie',
    },
  },

  survival: {
    genre: 'survival',
    label: 'Sopravvivenza',
    description: 'Survival, crafting (es. Subnautica, The Forest, Don\'t Starve)',
    icon: '🏕️',
    suggestedTemperature: 0.25,
    styleDirective: `You are translating a SURVIVAL game. Clarity saves lives (in-game).

TONE RULES:
- Item and recipe descriptions: utilitarian, precise
- Status messages and warnings: urgent, clear
- Lore/story (if any): isolated, desperate tone
- Crafting recipes: structured and unambiguous`,
    rules: [
      'Resource names must be consistent EVERYWHERE',
      'Quantities and recipe ratios must be preserved exactly',
      'Status effect descriptions must be clear — players need to know what affects them',
      'Keep crafting terminology consistent throughout',
    ],
    vocabularyHints: {
      'craft': 'crea / costruisci',
      'gather': 'raccogli',
      'hunger': 'fame',
      'thirst': 'sete',
      'shelter': 'rifugio',
      'blueprint': 'schema / progetto',
    },
  },

  romance: {
    genre: 'romance',
    label: 'Romance',
    description: 'Otome, dating sim, romance (es. Fire Emblem supports, romance routes)',
    icon: '💕',
    suggestedTemperature: 0.45,
    styleDirective: `You are translating a ROMANCE game or romance content. Emotion and intimacy matter.

TONE RULES:
- Dialogue should feel warm, natural, and emotionally resonant
- Flirting: playful, subtle, culturally appropriate for target language
- Confessions: sincere, vulnerable, not melodramatic (unless the game IS melodramatic)
- Internal monologue: butterflies, uncertainty, hope
- Each love interest should have a distinct voice and charm`,
    rules: [
      'Pet names and terms of endearment: use natural Italian equivalents',
      'Maintain the emotional escalation arc — early conversations are lighter',
      'Respect the original intimacy level — don\'t make it more or less explicit',
      'Cultural adaptation for romantic gestures where needed',
    ],
    vocabularyHints: {
      'darling': 'tesoro / caro/a',
      'sweetheart': 'dolcezza / cuore',
      'blush': 'arrossire',
      'confess': 'confessare / dichiararsi',
    },
  },

  mystery: {
    genre: 'mystery',
    label: 'Mistero',
    description: 'Mystery, investigazione, thriller (es. Ace Attorney, Danganronpa, Her Story)',
    icon: '🔍',
    suggestedTemperature: 0.35,
    styleDirective: `You are translating a MYSTERY game. Every word could be a clue.

TONE RULES:
- Testimony and dialogue: precise — contradictions must remain detectable
- Evidence descriptions: clinical, factual
- Dramatic reveals: build to the same crescendo as the original
- Red herrings must remain equally misleading in translation
- Legal/court terminology: use correct Italian legal terms`,
    rules: [
      'CRITICAL: Do NOT change any factual detail that could be a clue or contradiction',
      'Timeline references (dates, times) must be preserved exactly',
      'Character statements must be translateable back to the same meaning — no ambiguity shifts',
      'Legal terminology: use proper Italian equivalents',
    ],
    vocabularyHints: {
      'evidence': 'prova',
      'testimony': 'testimonianza',
      'objection': 'obiezione',
      'verdict': 'verdetto',
      'alibi': 'alibi',
      'witness': 'testimone',
    },
  },

  generic: {
    genre: 'generic',
    label: 'Generico',
    description: 'Nessun genere specifico — traduzione standard',
    icon: '🎮',
    suggestedTemperature: 0.3,
    styleDirective: `You are translating a video game. Maintain natural, engaging language appropriate for gaming context.

TONE RULES:
- Keep translations natural and idiomatic
- UI text: concise and clear
- Dialogue: conversational and character-appropriate
- Descriptions: informative but engaging`,
    rules: [
      'Proper nouns stay untranslated',
      'Preserve formatting, line breaks, and special characters',
      'Keep translations similar in length to originals',
    ],
    vocabularyHints: {},
  },
};

// ─── PUBLIC API ──────────────────────────────────────────────────

/** Ritorna la configurazione prompt per un genere specifico */
export function getGenreConfig(genre: GameGenre): GenrePromptConfig {
  return GENRE_CONFIGS[genre] || GENRE_CONFIGS.generic;
}

/** Ritorna tutti i generi disponibili per la UI */
export function getAllGenres(): { value: GameGenre; label: string; icon: string; description: string }[] {
  return Object.values(GENRE_CONFIGS).map(c => ({
    value: c.genre,
    label: c.label,
    icon: c.icon,
    description: c.description,
  }));
}

/**
 * Costruisce il blocco di prompt per il genere da iniettare nel prompt di traduzione.
 * Usato sia da ai-translate-direct.ts (batch API) che da unity-csv-translator (Ollama singolo).
 */
export function buildGenrePromptBlock(genre: GameGenre, targetLanguage?: string): string {
  const config = getGenreConfig(genre);
  if (genre === 'generic') return '';

  const parts: string[] = [];

  // Direttiva di stile principale
  parts.push(config.styleDirective);

  // Regole specifiche
  if (config.rules.length > 0) {
    parts.push(`\nGENRE-SPECIFIC RULES:\n${config.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
  }

  // Vocabolario suggerito (se ci sono hint)
  const hints = Object.entries(config.vocabularyHints);
  if (hints.length > 0) {
    const lang = targetLanguage || 'it';
    parts.push(`\nPREFERRED VOCABULARY (${lang.toUpperCase()}):\n${hints.map(([en, hint]) => `- "${en}" → ${hint}`).join('\n')}`);
  }

  return parts.join('\n');
}

/**
 * Costruisce un prompt completo per traduzione singola (Ollama/LM Studio).
 * Sostituisce i prompt hardcoded generici nel Unity CSV Translator.
 */
export function buildSingleTranslationPrompt(
  text: string,
  sourceLang: string,
  targetLang: string,
  genre: GameGenre = 'generic',
): string {
  const langMap: Record<string, string> = {
    it: 'Italian', de: 'German', es: 'Spanish', fr: 'French',
    pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ru: 'Russian',
    en: 'English', pl: 'Polish', nl: 'Dutch', sv: 'Swedish', ar: 'Arabic', tr: 'Turkish',
  };
  const srcName = langMap[sourceLang] || sourceLang;
  const tgtName = langMap[targetLang] || targetLang;

  const genreBlock = buildGenrePromptBlock(genre, targetLang);

  if (genreBlock) {
    return `${genreBlock}

Translate the following game text from ${srcName} to ${tgtName}. 
Return ONLY the translated text, nothing else. No explanations, no labels, no quotes.

${srcName}: ${text}

${tgtName}:`;
  }

  // Fallback generico
  return `Translate this game text from ${srcName} to ${tgtName}. Keep proper nouns. Maintain tone.
Return ONLY the translated text, nothing else.

${srcName}: ${text}

${tgtName}:`;
}

/**
 * Tenta di rilevare automaticamente il genere basandosi su indizi testuali.
 * Euristica di supporto — non sostituisce la selezione manuale.
 */
export function detectGenreFromText(texts: string[], gameName?: string): GameGenre {
  const sample = texts.slice(0, 200).join(' ').toLowerCase();
  const scores: Partial<Record<GameGenre, number>> = {};

  const bump = (g: GameGenre, n: number) => { scores[g] = (scores[g] || 0) + n; };

  // Horror psicologico
  if (/\b(sanity|insanity|madness|hallucin|delusion|paranoi|dissociat|psyche|subconscious|distort|nightmare|anxiety|dread|unease|whisper|flicker|wrong.*(feel|sense)|something.*(wrong|off)|can'?t remember|forget.*who|mind.*break|reality.*shift|losing.*mind|what.*am.*i)\b/i.test(sample)) bump('psychological_horror', 8);
  if (/\b(void|abyss|hollow|numb|crawl|seep|rot|fester|beneath.*skin|inside.*head)\b/i.test(sample)) bump('psychological_horror', 5);
  if (/\.{3}/.test(sample) && sample.length > 500) bump('psychological_horror', 2); // heavy ellipsis use

  // Horror generico
  if (/\b(blood|scream|corpse|creature|monster|horror|dead body|dark.*room|zombie|undead|infected|bite|claw|growl)\b/i.test(sample)) bump('horror', 6);
  if (/\b(ammo|weapon|survive|escape|run|hide|door.*locked|key.*card)\b/i.test(sample)) bump('survival', 3);

  // RPG
  if (/\b(hp|mp|xp|level up|quest|guild|dungeon|inventory|equip|potion|armor|shield|sword|spell|mana|skill tree|experience point|critical hit)\b/i.test(sample)) bump('rpg', 8);
  if (/\b(party|companion|npc|dialogue|merchant|inn|tavern)\b/i.test(sample)) bump('rpg', 4);

  // JRPG
  if (/\b(senpai|sensei|chan|kun|sama|baka|kawaii|desu|onii|nee-san)\b/i.test(sample)) bump('jrpg', 10);
  if (/\b(special attack|limit break|summon|materia|persona|arcana)\b/i.test(sample)) bump('jrpg', 6);

  // Visual Novel
  if (/\b(route|ending|choice|chapter|auto|skip|backlog|save slot|load slot)\b/i.test(sample)) bump('visual_novel', 5);

  // Strategia
  if (/\b(tile|yield|research|diplomacy|trade|production|city|build|civilization|empire|conquest|alliance|treaty|turn\s+\d)\b/i.test(sample)) bump('strategy', 6);

  // Azione
  if (/\b(reload|ammo|headshot|kill streak|grenade|cover|objective.*complet|mission.*fail|hostile|extract)\b/i.test(sample)) bump('action', 6);

  // Noir
  if (/\b(detective|suspect|evidence|witness|crime scene|interrogat|alibi|case file|murder|victim)\b/i.test(sample)) bump('noir', 6);
  if (/\b(dame|gumshoe|joint|rain|smoke|bottle|dark.*alley)\b/i.test(sample)) bump('noir', 4);

  // Sci-fi
  if (/\b(ship|station|crew|hyperdrive|FTL|warp|alien|colony|planet|galaxy|AI|android|cyborg|augment|neural|implant)\b/i.test(sample)) bump('sci_fi', 6);

  // Fantasy
  if (/\b(dragon|realm|rune|arcane|wizard|mage|knight|demon|forge|enchant|prophecy|chosen one|ancient.*evil)\b/i.test(sample)) bump('fantasy', 6);

  // Mystery
  if (/\b(clue|testimony|objection|verdict|court|evidence|contradiction|crime|case|investigate)\b/i.test(sample)) bump('mystery', 6);

  // Comedy
  if (/\b(lol|haha|hehe|joke|funny|pun|ridiculous|absurd|silly|dork|nerd)\b/i.test(sample)) bump('comedy', 4);

  // Game name hints
  if (gameName) {
    const gn = gameName.toLowerCase();
    if (/esoteric|ebb|soma|silent.hill|amnesia|layers.of.fear|observer|devotion|madison|visage/i.test(gn)) bump('psychological_horror', 15);
    if (/resident.evil|dead.space|outlast|evil.within|alan.wake/i.test(gn)) bump('horror', 12);
    if (/final.fantasy|persona|tales.of|dragon.quest|xenoblade|octopath/i.test(gn)) bump('jrpg', 12);
    if (/skyrim|witcher|baldur|divinity|dragon.age|elden.ring|dark.souls/i.test(gn)) bump('rpg', 10);
    if (/doki.doki|steins|clannad|danganronpa/i.test(gn)) bump('visual_novel', 12);
    if (/monkey.island|disco.elysium|grim.fandango/i.test(gn)) bump('adventure', 12);
    if (/doom|call.of.duty|halo|battlefield|wolfenstein/i.test(gn)) bump('action', 12);
    if (/civilization|xcom|total.war|stellaris|crusader.kings/i.test(gn)) bump('strategy', 12);
    if (/stardew|cities.skyline|sims|factorio|satisfactory/i.test(gn)) bump('simulation', 12);
    if (/portal|undertale|west.of.loathing/i.test(gn)) bump('comedy', 10);
    if (/ace.attorney|phoenix.wright|her.story|return.of.obra/i.test(gn)) bump('mystery', 12);
    if (/cyberpunk|mass.effect|starfield|outer.wilds|no.man/i.test(gn)) bump('sci_fi', 12);
    if (/subnautica|the.forest|don.t.starve|valheim|rust/i.test(gn)) bump('survival', 12);
  }

  // Trova il genere con punteggio più alto
  let best: GameGenre = 'generic';
  let bestScore = 0;
  for (const [g, s] of Object.entries(scores)) {
    if (s! > bestScore) { bestScore = s!; best = g as GameGenre; }
  }

  // Soglia minima per non assegnare un genere a caso
  if (bestScore < 4) return 'generic';
  return best;
}

/**
 * Compone genre prompt + profilo personaggio in un unico blocco di contesto.
 * Il genere definisce il tono generale, il profilo personaggio aggiunge speech patterns specifici.
 * Se uno dei due è assente, restituisce solo l'altro.
 */
export function composeGenreAndCharacterContext(options: {
  genre?: GameGenre;
  targetLanguage?: string;
  characterContext?: string;
  characterProfile?: {
    name: string;
    archetype?: string;
    traits?: string[];
    mood?: string;
    formality?: string;
    vocabulary?: string;
    catchphrases?: string[];
    avoidWords?: string[];
    preferredWords?: Record<string, string>;
  };
}): string {
  const parts: string[] = [];

  // Genre block
  if (options.genre && options.genre !== 'generic') {
    const config = getGenreConfig(options.genre);
    parts.push(`[GENRE: ${config.label}]`);
    parts.push(config.styleDirective);
    if (config.rules.length > 0) {
      parts.push(`Genre rules: ${config.rules.slice(0, 5).join('; ')}`);
    }
  }

  // Character profile block (structured)
  if (options.characterProfile) {
    const p = options.characterProfile;
    const profileParts: string[] = [`\n[CHARACTER: ${p.name}]`];

    if (p.archetype) profileParts.push(`Archetype: ${p.archetype}`);
    if (p.traits && p.traits.length > 0) profileParts.push(`Traits: ${p.traits.join(', ')}`);
    if (p.mood) profileParts.push(`Mood: ${p.mood}`);
    if (p.formality) profileParts.push(`Formality: ${p.formality}`);
    if (p.vocabulary) profileParts.push(`Vocabulary: ${p.vocabulary}`);
    if (p.catchphrases && p.catchphrases.length > 0) {
      profileParts.push(`Catchphrases to preserve: ${p.catchphrases.join(', ')}`);
    }
    if (p.avoidWords && p.avoidWords.length > 0) {
      profileParts.push(`Words to avoid: ${p.avoidWords.join(', ')}`);
    }
    if (p.preferredWords && Object.keys(p.preferredWords).length > 0) {
      const subs = Object.entries(p.preferredWords).map(([k, v]) => `${k}→${v}`).join(', ');
      profileParts.push(`Preferred substitutions: ${subs}`);
    }

    // Composizione: istruzione che lega genere e personaggio
    if (parts.length > 0) {
      profileParts.push(`\nThe character's voice must fit within the ${options.genre} genre atmosphere while maintaining their unique speech patterns.`);
    }

    parts.push(profileParts.join('\n'));
  }

  // Fallback: raw characterContext string (legacy)
  if (!options.characterProfile && options.characterContext) {
    parts.push(`\n[CHARACTER CONTEXT]\n${options.characterContext}`);
  }

  return parts.join('\n');
}
