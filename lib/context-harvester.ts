/**
 * 🌾 Context Harvester — Estrazione automatica contesto per traduzione
 * 
 * Analizza le stringhe sorgente e i metadati dei file di gioco per generare
 * contesto strutturato che migliora la qualità della traduzione AI.
 * 
 * Estrae automaticamente:
 * - Tipo schermata (menu, dialogo, combattimento, inventario, ecc.)
 * - Speaker (NPC, UI, narratore, sistema, personaggio specifico)
 * - Vincoli UI (lunghezza massima stimata, placeholder, formato)
 * - Tono (formale, informale, urgente, epico, comico)
 * - Priorità traduzione
 */

import { classifyContent, ContentClassification, ContentType } from './content-classifier';

// ============================================================================
// TYPES
// ============================================================================

export type ScreenType =
  | 'main_menu'
  | 'pause_menu'
  | 'settings'
  | 'dialogue'
  | 'cutscene'
  | 'combat'
  | 'inventory'
  | 'shop'
  | 'quest_log'
  | 'map'
  | 'hud'
  | 'tutorial'
  | 'loading'
  | 'credits'
  | 'character_creation'
  | 'crafting'
  | 'skill_tree'
  | 'achievement'
  | 'notification'
  | 'tooltip'
  | 'unknown';

export type SpeakerType =
  | 'player'
  | 'npc'
  | 'narrator'
  | 'system'
  | 'ui'
  | 'enemy'
  | 'companion'
  | 'merchant'
  | 'quest_giver'
  | 'tutorial_guide'
  | 'unknown';

export type ToneType =
  | 'formal'
  | 'informal'
  | 'urgent'
  | 'epic'
  | 'comedic'
  | 'dark'
  | 'neutral'
  | 'mysterious'
  | 'friendly'
  | 'threatening'
  | 'sad';

export interface HarvestedContext {
  /** Tipo di schermata dove appare la stringa */
  screen: ScreenType;
  /** Confidenza schermata (0-1) */
  screenConfidence: number;
  /** Chi "parla" questa stringa */
  speaker: SpeakerType;
  /** Nome specifico dello speaker se rilevato */
  speakerName: string | null;
  /** Confidenza speaker (0-1) */
  speakerConfidence: number;
  /** Tono della stringa */
  tone: ToneType;
  /** Vincoli UI */
  constraints: {
    /** Lunghezza massima stimata in caratteri */
    maxLength: number | null;
    /** Se la stringa contiene placeholder che vanno preservati */
    hasPlaceholders: boolean;
    /** Placeholder trovati */
    placeholders: string[];
    /** Se la stringa è tutta maiuscola (probabile bottone/label) */
    isAllCaps: boolean;
    /** Se il testo deve stare su una riga singola */
    singleLine: boolean;
  };
  /** Classificazione contenuto dal content-classifier */
  contentType: ContentType;
  /** Tag aggiuntivi per il contesto */
  tags: string[];
  /** Prompt hint generato per l'AI */
  promptHint: string;
}

export interface HarvestInput {
  /** Testo sorgente */
  text: string;
  /** Chiave/ID della stringa nel file */
  key?: string;
  /** Nome del file sorgente */
  filename?: string;
  /** Numero riga nel file */
  lineNumber?: number;
  /** Commento/nota dal file sorgente */
  comment?: string;
  /** Lunghezza massima se nota */
  maxLength?: number;
  /** Testo precedente (per contesto sequenziale) */
  previousText?: string;
  /** Testo successivo */
  nextText?: string;
  /** Genere del gioco */
  gameGenre?: string;
  /** Nome del gioco */
  gameName?: string;
}

export interface BatchHarvestResult {
  /** Contesto per ogni stringa (indice → contesto) */
  contexts: HarvestedContext[];
  /** Statistiche aggregate */
  stats: {
    totalStrings: number;
    screens: Record<ScreenType, number>;
    speakers: Record<SpeakerType, number>;
    tones: Record<ToneType, number>;
    avgMaxLength: number | null;
    stringsWithPlaceholders: number;
    stringsWithConstraints: number;
  };
  /** Prompt hint combinato per il batch */
  batchPromptHint: string;
}

// ============================================================================
// SCREEN DETECTION RULES
// ============================================================================

interface ScreenRule {
  screen: ScreenType;
  /** Regex applicati al testo */
  textPatterns: RegExp[];
  /** Regex applicati alla chiave/path del file */
  keyPatterns: RegExp[];
  /** Parole chiave nel filename */
  filenameKeywords: string[];
  weight: number;
}

const SCREEN_RULES: ScreenRule[] = [
  {
    screen: 'main_menu',
    textPatterns: [
      /^(New Game|Continue|Load Game|Options|Settings|Exit|Quit|Credits|Start|Play)$/i,
      /^(Single Player|Multiplayer|Co-op|Online|Offline|Tutorial|Campaign)$/i,
    ],
    keyPatterns: [/main.?menu/i, /title.?screen/i, /start.?screen/i, /^menu\./i],
    filenameKeywords: ['mainmenu', 'title', 'start_screen', 'frontend'],
    weight: 10,
  },
  {
    screen: 'pause_menu',
    textPatterns: [
      /^(Resume|Return to Game|Save|Save Game|Load|Load Game|Restart|Quit to Menu|Quit to Desktop)$/i,
    ],
    keyPatterns: [/pause/i, /ingame.?menu/i],
    filenameKeywords: ['pause', 'ingame_menu'],
    weight: 9,
  },
  {
    screen: 'settings',
    textPatterns: [
      /^(Audio|Video|Graphics|Controls|Gameplay|Language|Display|Resolution|Brightness|Volume|Subtitles|Keybindings)$/i,
      /^(Low|Medium|High|Ultra|Custom|On|Off|Enabled|Disabled|Default)$/i,
    ],
    keyPatterns: [/settings/i, /options/i, /config/i, /preferences/i],
    filenameKeywords: ['settings', 'options', 'config', 'preferences'],
    weight: 9,
  },
  {
    screen: 'dialogue',
    textPatterns: [
      /^[A-Z][a-z]+:\s+.+/,         // "John: Hello there"
      /^\[.+?\]\s*.+/,                // "[Guard] Stop right there"
      /^[""].+[""]$/,                  // Quoted dialogue
      /^[«»].+[«»]$/,                // European quotes
    ],
    keyPatterns: [/dialog/i, /dialogue/i, /conversation/i, /talk/i, /chat/i, /speak/i, /npc/i],
    filenameKeywords: ['dialog', 'dialogue', 'conversation', 'talk', 'npc', 'script'],
    weight: 9,
  },
  {
    screen: 'cutscene',
    textPatterns: [
      /.{100,}/,  // Very long text = narrative/cutscene
    ],
    keyPatterns: [/cutscene/i, /cinematic/i, /narrat/i, /story/i, /intro/i, /outro/i, /ending/i],
    filenameKeywords: ['cutscene', 'cinematic', 'narrative', 'story', 'intro', 'ending'],
    weight: 8,
  },
  {
    screen: 'combat',
    textPatterns: [
      /^(Attack|Defend|Dodge|Block|Parry|Heal|Cast|Use|Flee|Retreat|Critical|Miss|Hit|Evade)$/i,
      /^\d+\s*(damage|hp|mp|xp|exp)/i,
      /^(Victory|Defeat|Game Over|You Win|You Lose|You Died)$/i,
    ],
    keyPatterns: [/combat/i, /battle/i, /fight/i, /attack/i, /skill/i, /ability/i, /spell/i],
    filenameKeywords: ['combat', 'battle', 'fight', 'skills', 'abilities', 'spells'],
    weight: 9,
  },
  {
    screen: 'inventory',
    textPatterns: [
      /^(Equip|Unequip|Drop|Use|Examine|Discard|Sell|Buy|Craft)$/i,
      /\+\d+\s*(Str|Dex|Int|Agi|Vit|Def|Atk|HP|MP)/i,
    ],
    keyPatterns: [/inventory/i, /item/i, /equipment/i, /gear/i, /loot/i, /weapon/i, /armor/i],
    filenameKeywords: ['inventory', 'items', 'equipment', 'gear', 'loot', 'weapons', 'armor'],
    weight: 8,
  },
  {
    screen: 'shop',
    textPatterns: [
      /^(Buy|Sell|Price|Cost|Gold|Coins|Discount|Stock|Sold Out)$/i,
      /^\d+\s*(gold|coins|credits|gems|diamonds)/i,
    ],
    keyPatterns: [/shop/i, /store/i, /merchant/i, /vendor/i, /trade/i, /market/i],
    filenameKeywords: ['shop', 'store', 'merchant', 'vendor', 'trade'],
    weight: 8,
  },
  {
    screen: 'quest_log',
    textPatterns: [
      /^(Quest|Mission|Objective|Task):/i,
      /^(Completed|In Progress|Failed|New Quest|Quest Updated)/i,
      /^(Talk to|Go to|Find|Collect|Deliver|Kill|Defeat|Escort|Protect)\s+/i,
    ],
    keyPatterns: [/quest/i, /mission/i, /objective/i, /journal/i, /task/i],
    filenameKeywords: ['quest', 'mission', 'objective', 'journal'],
    weight: 8,
  },
  {
    screen: 'hud',
    textPatterns: [
      /^(Level|Lv|LV)\s*:?\s*\d*/i,
      /^(HP|MP|SP|XP|EXP|Stamina|Mana|Health)[\s:]/i,
    ],
    keyPatterns: [/hud/i, /ui_game/i, /overlay/i, /status/i, /^ui\./i],
    filenameKeywords: ['hud', 'overlay', 'game_ui', 'status_bar'],
    weight: 7,
  },
  {
    screen: 'tutorial',
    textPatterns: [
      /^(Press|Click|Tap|Hold|Move|Drag|Use)\s+/i,
      /^(Tip|Hint|Remember|Note|Important):\s*/i,
    ],
    keyPatterns: [/tutorial/i, /guide/i, /tip/i, /hint/i, /help/i, /onboarding/i],
    filenameKeywords: ['tutorial', 'guide', 'tips', 'hints', 'help', 'onboarding'],
    weight: 8,
  },
  {
    screen: 'loading',
    textPatterns: [
      /^(Loading|Please wait|Generating|Connecting|Syncing)/i,
      /^(Did you know|Tip:)/i,
    ],
    keyPatterns: [/loading/i, /splash/i, /wait/i],
    filenameKeywords: ['loading', 'splash', 'loadscreen'],
    weight: 7,
  },
  {
    screen: 'achievement',
    textPatterns: [
      /^(Achievement|Trophy|Badge|Milestone|Reward)\s*(Unlocked|Earned|Completed)?/i,
    ],
    keyPatterns: [/achieve/i, /trophy/i, /badge/i, /reward/i, /unlock/i],
    filenameKeywords: ['achievement', 'trophy', 'badges', 'rewards'],
    weight: 7,
  },
  {
    screen: 'tooltip',
    textPatterns: [],
    keyPatterns: [/tooltip/i, /hover/i, /info_popup/i, /desc$/i],
    filenameKeywords: ['tooltip', 'tooltips'],
    weight: 6,
  },
  {
    screen: 'character_creation',
    textPatterns: [
      /^(Race|Class|Gender|Name|Appearance|Hair|Face|Body|Skin|Height|Weight)$/i,
      /^(Warrior|Mage|Rogue|Cleric|Ranger|Paladin|Bard|Monk|Druid)$/i,
    ],
    keyPatterns: [/char.?creat/i, /customiz/i, /character.?select/i],
    filenameKeywords: ['character_creation', 'customization', 'chargen'],
    weight: 8,
  },
  {
    screen: 'crafting',
    textPatterns: [
      /^(Craft|Recipe|Ingredients|Materials|Forge|Brew|Cook|Smelt|Enchant)$/i,
    ],
    keyPatterns: [/craft/i, /recipe/i, /forge/i, /cook/i, /brew/i, /enchant/i],
    filenameKeywords: ['crafting', 'recipes', 'forge', 'cooking'],
    weight: 7,
  },
  {
    screen: 'skill_tree',
    textPatterns: [
      /^(Skill|Perk|Talent|Ability|Passive|Active)\s*:/i,
      /^(Unlock|Upgrade|Level up|Spend)\s+\d+\s+(points?|skill)/i,
    ],
    keyPatterns: [/skill/i, /perk/i, /talent/i, /ability/i, /tree/i, /progression/i],
    filenameKeywords: ['skills', 'perks', 'talents', 'abilities', 'progression'],
    weight: 7,
  },
  {
    screen: 'map',
    textPatterns: [
      /^(Fast Travel|Waypoint|Marker|Discovered|Unexplored)$/i,
    ],
    keyPatterns: [/map/i, /world.?map/i, /minimap/i, /waypoint/i, /location/i],
    filenameKeywords: ['map', 'worldmap', 'minimap', 'locations'],
    weight: 6,
  },
  {
    screen: 'notification',
    textPatterns: [
      /^(Auto.?saved|Saved|Connected|Disconnected|Update available)/i,
    ],
    keyPatterns: [/notif/i, /alert/i, /popup/i, /toast/i, /banner/i],
    filenameKeywords: ['notification', 'alerts', 'popups'],
    weight: 6,
  },
  {
    screen: 'credits',
    textPatterns: [
      /^(Director|Producer|Designer|Programmer|Artist|Writer|Composer|Voice|Tester|QA|Lead|Senior|Junior)$/i,
      /^(Special Thanks|Music by|Written by|Directed by)/i,
    ],
    keyPatterns: [/credits/i, /staff/i, /team/i],
    filenameKeywords: ['credits', 'staff'],
    weight: 7,
  },
];

// ============================================================================
// SPEAKER DETECTION RULES
// ============================================================================

interface SpeakerRule {
  speaker: SpeakerType;
  textPatterns: RegExp[];
  keyPatterns: RegExp[];
  weight: number;
}

const SPEAKER_RULES: SpeakerRule[] = [
  {
    speaker: 'narrator',
    textPatterns: [
      /^(The|A|An|In|Once|Long ago|It was|Years|Centuries|The world)/i,
      /.{150,}/,  // Very long = narrative
      /^\*[^*]+\*$/,  // *italicized action*
    ],
    keyPatterns: [/narrat/i, /story/i, /lore/i, /description/i, /flavor/i, /intro/i],
    weight: 8,
  },
  {
    speaker: 'system',
    textPatterns: [
      /^(Error|Warning|Notice|Info|Debug):/i,
      /^(Saved|Loading|Connected|Disconnected|Syncing)/i,
      /^(Achievement|Trophy|Reward|Unlocked|Level Up)/i,
    ],
    keyPatterns: [/system/i, /error/i, /warn/i, /notif/i, /status/i, /alert/i, /^sys\./i],
    weight: 9,
  },
  {
    speaker: 'ui',
    textPatterns: [
      /^(OK|Cancel|Yes|No|Back|Next|Continue|Start|Exit|Close|Apply|Save|Load|Reset|Confirm)$/i,
      /^[A-Z][A-Z\s]{0,20}$/,  // ALL CAPS short = UI label
    ],
    keyPatterns: [/^ui\./i, /button/i, /label/i, /menu/i, /tab/i, /header/i, /title/i],
    weight: 9,
  },
  {
    speaker: 'player',
    textPatterns: [
      /^\(Choice\)/i,
      /^>\s+.+/,  // > Choice text
    ],
    keyPatterns: [/player/i, /choice/i, /option/i, /response/i, /reply/i, /^pc\./i],
    weight: 8,
  },
  {
    speaker: 'npc',
    textPatterns: [
      /^[A-Z][a-z]+:\s+.+/,       // "Guard: Stop!"
      /^\[.+?\]\s+.+/,             // "[Guard] Stop!"
    ],
    keyPatterns: [/npc/i, /character/i, /^chr\./i, /^char\./i],
    weight: 7,
  },
  {
    speaker: 'merchant',
    textPatterns: [
      /\b(buy|sell|gold|coins|price|discount|trade|wares|goods|stock)\b/i,
    ],
    keyPatterns: [/merchant/i, /vendor/i, /shop.?keeper/i, /trader/i],
    weight: 7,
  },
  {
    speaker: 'enemy',
    textPatterns: [
      /\b(die|perish|foolish|mortal|destroy|crush|surrender|bow|kneel)\b/i,
    ],
    keyPatterns: [/enemy/i, /boss/i, /villain/i, /antagonist/i, /monster/i],
    weight: 6,
  },
  {
    speaker: 'companion',
    textPatterns: [
      /\b(let's|we should|together|follow me|come on|watch out|be careful)\b/i,
    ],
    keyPatterns: [/companion/i, /ally/i, /party/i, /follower/i, /partner/i],
    weight: 6,
  },
  {
    speaker: 'quest_giver',
    textPatterns: [
      /\b(task|mission|quest|favor|help me|need you|please find|bring me|go to)\b/i,
    ],
    keyPatterns: [/quest.?giver/i, /quest.?npc/i, /mission.?giver/i],
    weight: 7,
  },
  {
    speaker: 'tutorial_guide',
    textPatterns: [
      /^(Press|Click|Tap|Hold|Move|Try|Remember|Tip|Hint|Note)[\s:]/i,
      /\b(learn|practice|demonstrate|show you|teach)\b/i,
    ],
    keyPatterns: [/tutorial/i, /guide/i, /help/i, /onboard/i, /tip/i],
    weight: 8,
  },
];

// ============================================================================
// TONE DETECTION
// ============================================================================

interface ToneRule {
  tone: ToneType;
  patterns: RegExp[];
  weight: number;
}

const TONE_RULES: ToneRule[] = [
  { tone: 'urgent', patterns: [/!{2,}/, /\b(hurry|quick|now|run|danger|warning|alert|emergency)\b/i, /^(Watch out|Be careful|Look out|Run)/i], weight: 8 },
  { tone: 'epic', patterns: [/\b(destiny|fate|ancient|prophecy|legendary|chosen|realm|kingdom|darkness|light|heroes?)\b/i, /.{200,}/], weight: 6 },
  { tone: 'comedic', patterns: [/\b(haha|hehe|lol|joke|funny|silly|ridiculous|absurd)\b/i, /[!?]{3,}/, /\.{3,}\s*[!?]/], weight: 7 },
  { tone: 'dark', patterns: [/\b(death|die|kill|blood|murder|shadow|darkness|despair|doom|curse|suffer)\b/i], weight: 6 },
  { tone: 'mysterious', patterns: [/\b(strange|mysterious|unknown|secret|hidden|ancient|whisper|shadow|enigma)\b/i, /\.{3,}$/], weight: 6 },
  { tone: 'formal', patterns: [/\b(hereby|therefore|henceforth|shall|must|decree|proclamation|honor|duty)\b/i, /^(Dear|Greetings|To whom|Esteemed)/i], weight: 7 },
  { tone: 'informal', patterns: [/\b(hey|yo|dude|bro|man|gonna|wanna|gotta|kinda|sorta|y'all|ain't)\b/i], weight: 8 },
  { tone: 'friendly', patterns: [/\b(welcome|friend|glad|happy|nice|wonderful|great|thanks|thank you)\b/i, /[😊🎉👋💪❤️]/], weight: 6 },
  { tone: 'threatening', patterns: [/\b(destroy|crush|annihilate|obey|submit|perish|regret|suffer|consequence)\b/i], weight: 7 },
  { tone: 'sad', patterns: [/\b(sorry|forgive|farewell|goodbye|miss|lost|alone|tears|grief|mourn)\b/i], weight: 6 },
];

// ============================================================================
// PLACEHOLDER DETECTION
// ============================================================================

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\{[^}]+\}/g,            // {player_name}, {0}, {count}
  /%[sdiflu%]/g,            // %s, %d, %f
  /%\d+\$[sdif]/g,         // %1$s, %2$d
  /\$\{[^}]+\}/g,          // ${variable}
  /\[\[[^\]]+\]\]/g,       // [[variable]]
  /<[^>]+\/>/g,            // <icon/>, <br/>
  /\{[A-Z_]+\}/g,          // {PLAYER_NAME}
  /#\{[^}]+\}/g,           // #{variable}
  /\$[A-Za-z_]+/g,         // $variable
  /@[A-Za-z_]+/g,          // @variable (RPG Maker)
  /\\[nNrRtT]/g,           // \n, \N, \r, \t (escape sequences)
  /\\[CVS]\[\d+\]/g,       // \C[1], \V[2], \S[3] (RPG Maker control codes)
];

// ============================================================================
// SPEAKER NAME EXTRACTION
// ============================================================================

function extractSpeakerName(text: string, key?: string): string | null {
  // Pattern: "Name: dialogue"
  const colonMatch = text.match(/^([A-Z][a-zA-Z''\- ]{1,30}):\s+/);
  if (colonMatch) return colonMatch[1].trim();

  // Pattern: "[Name] dialogue"
  const bracketMatch = text.match(/^\[([A-Z][a-zA-Z''\- ]{1,30})\]\s*/);
  if (bracketMatch) return bracketMatch[1].trim();

  // Pattern in key: "chr_guard_01", "npc_merchant", "dialog_john_03"
  if (key) {
    const keyMatch = key.match(/(?:chr|char|npc|dialog|dlg)[_.]([a-zA-Z]+)/i);
    if (keyMatch) {
      const name = keyMatch[1];
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }
  }

  return null;
}

// ============================================================================
// CORE HARVEST FUNCTION
// ============================================================================

/**
 * Estrae il contesto da una singola stringa
 */
export function harvestContext(input: HarvestInput): HarvestedContext {
  const { text, key, filename, comment, maxLength, previousText, nextText, gameGenre } = input;

  // 1. Rileva schermata
  const { screen, confidence: screenConfidence } = detectScreen(text, key, filename);

  // 2. Rileva speaker
  const { speaker, confidence: speakerConfidence } = detectSpeaker(text, key);
  const speakerName = extractSpeakerName(text, key);

  // 3. Rileva tono
  const tone = detectTone(text, gameGenre);

  // 4. Analizza vincoli
  const constraints = analyzeConstraints(text, maxLength);

  // 5. Classifica contenuto
  const classification = classifyContent(text, { filename, key, previousText, gameGenre });

  // 6. Genera tag
  const tags = generateTags(text, key, filename, comment, screen, speaker, classification);

  // 7. Genera prompt hint
  const promptHint = buildPromptHint(
    screen, speaker, speakerName, tone, constraints,
    classification.type, tags, comment, gameGenre
  );

  return {
    screen,
    screenConfidence,
    speaker,
    speakerName,
    speakerConfidence,
    tone,
    constraints,
    contentType: classification.type,
    tags,
    promptHint,
  };
}

/**
 * Harvesta contesto per un batch di stringhe
 */
export function harvestBatch(inputs: HarvestInput[]): BatchHarvestResult {
  const contexts: HarvestedContext[] = [];

  // Passa previousText/nextText automaticamente
  for (let i = 0; i < inputs.length; i++) {
    const input = {
      ...inputs[i],
      previousText: inputs[i].previousText || (i > 0 ? inputs[i - 1].text : undefined),
      nextText: inputs[i].nextText || (i < inputs.length - 1 ? inputs[i + 1].text : undefined),
    };
    contexts.push(harvestContext(input));
  }

  // Statistiche aggregate
  const screens: Record<string, number> = {};
  const speakers: Record<string, number> = {};
  const tones: Record<string, number> = {};
  let totalMaxLen = 0;
  let maxLenCount = 0;
  let placeholderCount = 0;
  let constraintCount = 0;

  for (const ctx of contexts) {
    screens[ctx.screen] = (screens[ctx.screen] || 0) + 1;
    speakers[ctx.speaker] = (speakers[ctx.speaker] || 0) + 1;
    tones[ctx.tone] = (tones[ctx.tone] || 0) + 1;
    if (ctx.constraints.maxLength !== null) {
      totalMaxLen += ctx.constraints.maxLength;
      maxLenCount++;
    }
    if (ctx.constraints.hasPlaceholders) placeholderCount++;
    if (ctx.constraints.maxLength !== null || ctx.constraints.isAllCaps || ctx.constraints.singleLine) {
      constraintCount++;
    }
  }

  // Prompt hint combinato per il batch
  const batchPromptHint = buildBatchPromptHint(contexts, inputs[0]?.gameGenre, inputs[0]?.gameName);

  return {
    contexts,
    stats: {
      totalStrings: inputs.length,
      screens: screens as Record<ScreenType, number>,
      speakers: speakers as Record<SpeakerType, number>,
      tones: tones as Record<ToneType, number>,
      avgMaxLength: maxLenCount > 0 ? Math.round(totalMaxLen / maxLenCount) : null,
      stringsWithPlaceholders: placeholderCount,
      stringsWithConstraints: constraintCount,
    },
    batchPromptHint,
  };
}

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

function detectScreen(text: string, key?: string, filename?: string): { screen: ScreenType; confidence: number } {
  const scores = new Map<ScreenType, number>();

  for (const rule of SCREEN_RULES) {
    let score = 0;

    // Text patterns
    for (const pattern of rule.textPatterns) {
      if (pattern.test(text)) {
        score += rule.weight;
        break;
      }
    }

    // Key patterns
    if (key) {
      for (const pattern of rule.keyPatterns) {
        if (pattern.test(key)) {
          score += rule.weight * 1.5; // Key è molto affidabile
          break;
        }
      }
    }

    // Filename keywords
    if (filename) {
      const lowerFile = filename.toLowerCase();
      for (const kw of rule.filenameKeywords) {
        if (lowerFile.includes(kw)) {
          score += rule.weight * 1.2;
          break;
        }
      }
    }

    if (score > 0) {
      scores.set(rule.screen, (scores.get(rule.screen) || 0) + score);
    }
  }

  let bestScreen: ScreenType = 'unknown';
  let bestScore = 0;
  let totalScore = 0;

  scores.forEach((score, screen) => {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestScreen = screen;
    }
  });

  const confidence = totalScore > 0 ? Math.min(bestScore / totalScore, 1) : 0;
  return { screen: bestScreen, confidence: Math.round(confidence * 100) / 100 };
}

function detectSpeaker(text: string, key?: string): { speaker: SpeakerType; confidence: number } {
  const scores = new Map<SpeakerType, number>();

  for (const rule of SPEAKER_RULES) {
    let score = 0;

    for (const pattern of rule.textPatterns) {
      if (pattern.test(text)) {
        score += rule.weight;
        break;
      }
    }

    if (key) {
      for (const pattern of rule.keyPatterns) {
        if (pattern.test(key)) {
          score += rule.weight * 1.5;
          break;
        }
      }
    }

    if (score > 0) {
      scores.set(rule.speaker, (scores.get(rule.speaker) || 0) + score);
    }
  }

  let bestSpeaker: SpeakerType = 'unknown';
  let bestScore = 0;
  let totalScore = 0;

  scores.forEach((score, speaker) => {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestSpeaker = speaker;
    }
  });

  const confidence = totalScore > 0 ? Math.min(bestScore / totalScore, 1) : 0;
  return { speaker: bestSpeaker, confidence: Math.round(confidence * 100) / 100 };
}

function detectTone(text: string, gameGenre?: string): ToneType {
  const scores = new Map<ToneType, number>();

  for (const rule of TONE_RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        score += rule.weight;
      }
    }
    if (score > 0) {
      scores.set(rule.tone, (scores.get(rule.tone) || 0) + score);
    }
  }

  // Boost basato su genere gioco
  if (gameGenre) {
    const genreLower = gameGenre.toLowerCase();
    if (genreLower.includes('rpg') || genreLower.includes('fantasy')) {
      scores.set('epic', (scores.get('epic') || 0) + 3);
    }
    if (genreLower.includes('horror')) {
      scores.set('dark', (scores.get('dark') || 0) + 3);
    }
    if (genreLower.includes('comedy') || genreLower.includes('casual')) {
      scores.set('comedic', (scores.get('comedic') || 0) + 3);
    }
    if (genreLower.includes('visual novel') || genreLower.includes('vn')) {
      scores.set('informal', (scores.get('informal') || 0) + 2);
    }
    if (genreLower.includes('strategy') || genreLower.includes('simulation')) {
      scores.set('formal', (scores.get('formal') || 0) + 2);
    }
  }

  let bestTone: ToneType = 'neutral';
  let bestScore = 0;

  scores.forEach((score, tone) => {
    if (score > bestScore) {
      bestScore = score;
      bestTone = tone;
    }
  });

  return bestTone;
}

function analyzeConstraints(text: string, maxLength?: number): HarvestedContext['constraints'] {
  // Trova placeholder
  const placeholders: string[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      placeholders.push(...matches);
    }
  }

  const isAllCaps = text.length > 1 && text === text.toUpperCase() && /[A-Z]/.test(text);
  const singleLine = !text.includes('\n') && text.length < 80;

  // Stima maxLength se non fornito
  let estimatedMaxLength: number | null = maxLength || null;
  if (!estimatedMaxLength) {
    if (isAllCaps && text.length <= 20) {
      estimatedMaxLength = Math.max(text.length + 10, 30);
    } else if (singleLine && text.length <= 40) {
      estimatedMaxLength = Math.max(text.length + 15, 50);
    }
    // Non stimiamo per testi lunghi — troppo incerto
  }

  return {
    maxLength: estimatedMaxLength,
    hasPlaceholders: placeholders.length > 0,
    placeholders: [...new Set(placeholders)],
    isAllCaps,
    singleLine,
  };
}

// ============================================================================
// TAG GENERATION
// ============================================================================

function generateTags(
  text: string,
  key?: string,
  filename?: string,
  comment?: string,
  screen?: ScreenType,
  speaker?: SpeakerType,
  classification?: ContentClassification,
): string[] {
  const tags: string[] = [];

  // Screen tag
  if (screen && screen !== 'unknown') tags.push(`screen:${screen}`);

  // Speaker tag
  if (speaker && speaker !== 'unknown') tags.push(`speaker:${speaker}`);

  // Content type tag
  if (classification) tags.push(`type:${classification.type}`);

  // Format tags
  if (/\{[^}]+\}/.test(text)) tags.push('has_variables');
  if (/<[^>]+>/.test(text)) tags.push('has_html');
  if (/\\[nNrR]/.test(text)) tags.push('has_newlines');
  if (/\\[CVS]\[\d+\]/.test(text)) tags.push('rpgmaker_codes');
  if (text === text.toUpperCase() && /[A-Z]/.test(text)) tags.push('all_caps');
  if (text.length <= 15) tags.push('short_text');
  if (text.length >= 200) tags.push('long_text');

  // Source file hints
  if (filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('.po') || lower.includes('gettext')) tags.push('format:po');
    if (lower.includes('.json')) tags.push('format:json');
    if (lower.includes('.xml') || lower.includes('.resx')) tags.push('format:xml');
    if (lower.includes('.csv')) tags.push('format:csv');
    if (lower.includes('.ini')) tags.push('format:ini');
    if (lower.includes('.strings')) tags.push('format:strings');
  }

  // Comment hints
  if (comment) {
    if (/max.?\d+/i.test(comment)) tags.push('has_length_limit');
    if (/placeholder/i.test(comment)) tags.push('has_placeholder_note');
    if (/context/i.test(comment)) tags.push('has_context_note');
  }

  return tags;
}

// ============================================================================
// PROMPT HINT GENERATION
// ============================================================================

function buildPromptHint(
  screen: ScreenType,
  speaker: SpeakerType,
  speakerName: string | null,
  tone: ToneType,
  constraints: HarvestedContext['constraints'],
  contentType: ContentType,
  tags: string[],
  comment?: string,
  gameGenre?: string,
): string {
  const parts: string[] = [];

  // Schermata
  const screenLabels: Record<ScreenType, string> = {
    main_menu: 'Main Menu', pause_menu: 'Pause Menu', settings: 'Settings Screen',
    dialogue: 'In-game Dialogue', cutscene: 'Cutscene/Cinematic', combat: 'Combat Screen',
    inventory: 'Inventory Screen', shop: 'Shop/Store', quest_log: 'Quest Journal',
    map: 'Map Screen', hud: 'HUD Overlay', tutorial: 'Tutorial',
    loading: 'Loading Screen', credits: 'Credits', character_creation: 'Character Creation',
    crafting: 'Crafting Screen', skill_tree: 'Skill Tree', achievement: 'Achievement',
    notification: 'System Notification', tooltip: 'Tooltip', unknown: '',
  };

  if (screen !== 'unknown') {
    parts.push(`[Screen: ${screenLabels[screen]}]`);
  }

  // Speaker
  if (speaker !== 'unknown') {
    const speakerLabel = speakerName
      ? `${speakerName} (${speaker})`
      : speaker.replace('_', ' ');
    parts.push(`[Speaker: ${speakerLabel}]`);
  }

  // Tono
  if (tone !== 'neutral') {
    parts.push(`[Tone: ${tone}]`);
  }

  // Tipo contenuto
  if (contentType !== 'unknown') {
    parts.push(`[Type: ${contentType}]`);
  }

  // Vincoli
  if (constraints.maxLength !== null) {
    parts.push(`[Max ${constraints.maxLength} chars]`);
  }
  if (constraints.hasPlaceholders) {
    parts.push(`[PRESERVE: ${constraints.placeholders.join(', ')}]`);
  }
  if (constraints.isAllCaps) {
    parts.push('[KEEP ALL CAPS]');
  }

  // Genere gioco
  if (gameGenre) {
    parts.push(`[Genre: ${gameGenre}]`);
  }

  // Commento dal file sorgente
  if (comment) {
    parts.push(`[Note: ${comment}]`);
  }

  return parts.join(' ');
}

/**
 * Genera un prompt hint combinato per un intero batch
 */
function buildBatchPromptHint(
  contexts: HarvestedContext[],
  gameGenre?: string,
  gameName?: string,
): string {
  if (contexts.length === 0) return '';

  const parts: string[] = [];

  // Header
  if (gameName) {
    parts.push(`Game: "${gameName}"`);
  }
  if (gameGenre) {
    parts.push(`Genre: ${gameGenre}`);
  }

  // Riassunto schermate dominanti
  const screenCounts = new Map<ScreenType, number>();
  for (const ctx of contexts) {
    if (ctx.screen !== 'unknown') {
      screenCounts.set(ctx.screen, (screenCounts.get(ctx.screen) || 0) + 1);
    }
  }
  if (screenCounts.size > 0) {
    const sorted = [...screenCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topScreens = sorted.slice(0, 3).map(([s, n]) => `${s}(${n})`);
    parts.push(`Screens: ${topScreens.join(', ')}`);
  }

  // Riassunto speaker dominanti
  const speakerCounts = new Map<SpeakerType, number>();
  for (const ctx of contexts) {
    if (ctx.speaker !== 'unknown') {
      speakerCounts.set(ctx.speaker, (speakerCounts.get(ctx.speaker) || 0) + 1);
    }
  }
  if (speakerCounts.size > 0) {
    const sorted = [...speakerCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topSpeakers = sorted.slice(0, 3).map(([s, n]) => `${s}(${n})`);
    parts.push(`Speakers: ${topSpeakers.join(', ')}`);
  }

  // Tono dominante
  const toneCounts = new Map<ToneType, number>();
  for (const ctx of contexts) {
    if (ctx.tone !== 'neutral') {
      toneCounts.set(ctx.tone, (toneCounts.get(ctx.tone) || 0) + 1);
    }
  }
  if (toneCounts.size > 0) {
    const sorted = [...toneCounts.entries()].sort((a, b) => b[1] - a[1]);
    parts.push(`Dominant tone: ${sorted[0][0]}`);
  }

  // Avvisi placeholder
  const placeholderStrings = contexts.filter(c => c.constraints.hasPlaceholders).length;
  if (placeholderStrings > 0) {
    parts.push(`⚠️ ${placeholderStrings} strings contain placeholders — preserve them exactly`);
  }

  // Avvisi char limit
  const charLimitStrings = contexts.filter(c => c.constraints.maxLength !== null).length;
  if (charLimitStrings > 0) {
    parts.push(`⚠️ ${charLimitStrings} strings have character length limits`);
  }

  if (parts.length === 0) return '';
  return `[CONTEXT HARVEST]\n${parts.join('\n')}`;
}

// ============================================================================
// AI-ENHANCED HARVEST (usa LLM per contesto ambiguo)
// ============================================================================

/**
 * Arricchisce il contesto usando un LLM per stringhe ambigue.
 * Invia solo le stringhe dove il contesto rule-based ha bassa confidenza.
 */
export async function aiEnhanceContexts(
  inputs: HarvestInput[],
  contexts: HarvestedContext[],
  translateFn: (prompt: string) => Promise<string>,
  options?: { confidenceThreshold?: number; maxStrings?: number },
): Promise<HarvestedContext[]> {
  const threshold = options?.confidenceThreshold ?? 0.4;
  const maxStrings = options?.maxStrings ?? 30;

  // Filtra stringhe con bassa confidenza
  const ambiguous: { index: number; text: string; key?: string }[] = [];
  for (let i = 0; i < contexts.length; i++) {
    if (
      (contexts[i].screenConfidence < threshold || contexts[i].speakerConfidence < threshold) &&
      ambiguous.length < maxStrings
    ) {
      ambiguous.push({ index: i, text: inputs[i].text, key: inputs[i].key });
    }
  }

  if (ambiguous.length === 0) return contexts;

  // Costruisci prompt per LLM
  const prompt = `You are analyzing video game strings for translation context. For each string, determine:
1. screen: Where this text appears (menu, dialogue, combat, inventory, hud, tutorial, cutscene, shop, settings, quest_log, notification, tooltip, or unknown)
2. speaker: Who "says" this text (player, npc, narrator, system, ui, enemy, companion, merchant, quest_giver, tutorial_guide, or unknown)
3. speaker_name: The specific character name if detectable, or null
4. tone: The tone (formal, informal, urgent, epic, comedic, dark, neutral, mysterious, friendly, threatening, sad)

Return ONLY a JSON array, one object per string. Example:
[{"screen":"dialogue","speaker":"npc","speaker_name":"Guard","tone":"threatening"}]

Strings to analyze:
${ambiguous.map((a, i) => `${i + 1}. ${a.key ? `[${a.key}] ` : ''}${a.text}`).join('\n')}`;

  try {
    const response = await translateFn(prompt);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return contexts;

    const results = JSON.parse(jsonMatch[0]) as Array<{
      screen?: string;
      speaker?: string;
      speaker_name?: string | null;
      tone?: string;
    }>;

    // Aggiorna contesti con risultati AI
    for (let i = 0; i < Math.min(results.length, ambiguous.length); i++) {
      const idx = ambiguous[i].index;
      const r = results[i];

      if (r.screen && r.screen !== 'unknown') {
        contexts[idx].screen = r.screen as ScreenType;
        contexts[idx].screenConfidence = 0.8; // AI confidence
      }
      if (r.speaker && r.speaker !== 'unknown') {
        contexts[idx].speaker = r.speaker as SpeakerType;
        contexts[idx].speakerConfidence = 0.8;
      }
      if (r.speaker_name) {
        contexts[idx].speakerName = r.speaker_name;
      }
      if (r.tone) {
        contexts[idx].tone = r.tone as ToneType;
      }

      // Rigenera prompt hint
      contexts[idx].promptHint = buildPromptHint(
        contexts[idx].screen,
        contexts[idx].speaker,
        contexts[idx].speakerName,
        contexts[idx].tone,
        contexts[idx].constraints,
        contexts[idx].contentType,
        contexts[idx].tags,
        undefined,
        inputs[idx]?.gameGenre,
      );
    }
  } catch (e) {
    console.warn('[ContextHarvester] AI enhancement failed, keeping rule-based contexts:', e);
  }

  return contexts;
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Converte un HarvestedContext in una stringa di contesto per TranslateOptions.context
 */
export function contextToString(ctx: HarvestedContext): string {
  return ctx.promptHint;
}

/**
 * Genera un context hint per un batch, da iniettare nel prompt di traduzione
 */
export function batchContextToPromptHint(result: BatchHarvestResult): string {
  return result.batchPromptHint;
}

/**
 * Combina il batch hint + per-string hints in un blocco unico per il prompt
 */
export function buildContextBlock(
  batchResult: BatchHarvestResult,
  stringIndex: number,
): string {
  const parts: string[] = [];

  // Batch-level context
  if (batchResult.batchPromptHint) {
    parts.push(batchResult.batchPromptHint);
  }

  // Per-string context
  const ctx = batchResult.contexts[stringIndex];
  if (ctx && ctx.promptHint) {
    parts.push(`String ${stringIndex + 1}: ${ctx.promptHint}`);
  }

  return parts.join('\n');
}

// ============================================================================
// STORAGE
// ============================================================================

const HARVEST_STORAGE_KEY = 'gamestringer_context_harvest';

export interface StoredHarvest {
  gameId: string;
  gameName?: string;
  harvestedAt: string;
  totalStrings: number;
  contexts: HarvestedContext[];
}

export function saveHarvest(gameId: string, result: BatchHarvestResult, gameName?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const allHarvests = JSON.parse(localStorage.getItem(HARVEST_STORAGE_KEY) || '{}');
    allHarvests[gameId] = {
      gameId,
      gameName,
      harvestedAt: new Date().toISOString(),
      totalStrings: result.stats.totalStrings,
      contexts: result.contexts,
    } satisfies StoredHarvest;
    localStorage.setItem(HARVEST_STORAGE_KEY, JSON.stringify(allHarvests));
  } catch (e) {
    console.warn('[ContextHarvester] Save failed:', e);
  }
}

export function loadHarvest(gameId: string): StoredHarvest | null {
  if (typeof window === 'undefined') return null;
  try {
    const allHarvests = JSON.parse(localStorage.getItem(HARVEST_STORAGE_KEY) || '{}');
    return allHarvests[gameId] || null;
  } catch {
    return null;
  }
}

export function listHarvests(): StoredHarvest[] {
  if (typeof window === 'undefined') return [];
  try {
    const allHarvests = JSON.parse(localStorage.getItem(HARVEST_STORAGE_KEY) || '{}');
    return Object.values(allHarvests);
  } catch {
    return [];
  }
}

export function deleteHarvest(gameId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const allHarvests = JSON.parse(localStorage.getItem(HARVEST_STORAGE_KEY) || '{}');
    delete allHarvests[gameId];
    localStorage.setItem(HARVEST_STORAGE_KEY, JSON.stringify(allHarvests));
  } catch {}
}
