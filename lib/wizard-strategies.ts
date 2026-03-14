/**
 * 🧙 Wizard Translation Strategies
 * 
 * Mappa engine → strategia ottimale di traduzione.
 * Ogni strategia definisce: come estrarre, tradurre, e applicare le traduzioni.
 * Usato dal Translation Wizard per orchestrare automaticamente il flusso.
 */

import { findCommunityTranslation } from './community-translations';

export type StrategyId = 
  | 'text-files'       // CSV, JSON, XML, PO, TXT — traduzione diretta file
  | 'unity-xunity'     // Unity — BepInEx + XUnity Autotranslator
  | 'unity-assets'     // Unity — estrazione asset bundle
  | 'unreal-locres'    // Unreal Engine — file .locres
  | 'rpgmaker-json'    // RPG Maker MV/MZ — JSON data
  | 'rpgmaker-ruby'    // RPG Maker VX/Ace — Ruby data (tool esterno)
  | 'renpy-rpy'        // Ren'Py — file .rpy
  | 'gamemaker-data'   // GameMaker — data.win
  | 'godot-pck'        // Godot — .pck files
  | 'binary-patch'     // Binario custom — estrazione stringhe + patch
  | 'danganronpa-wad'  // Danganronpa — WAD/PAK
  | 'wolfrpg'          // Wolf RPG — .wolf files
  | 'community-patch'  // Traduzione community già pronta (GamesTranslator.it, Nexus, Workshop)
  | 'telltale'         // Telltale — patcher dedicato con traduzioni community
  | 'ocr'              // OCR — traduzione visiva in tempo reale
  | 'manual';          // Sconosciuto — approccio manuale

export interface TranslationStrategy {
  id: StrategyId;
  name: string;
  description: string;
  /** Icona (nome lucide-react) */
  icon: string;
  /** Colore badge */
  color: string;
  /** Difficoltà stimata */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Se la traduzione può avvenire inline nel wizard */
  canDoInline: boolean;
  /** Pagina a cui fare redirect se non inline */
  redirectTo?: string;
  /** Parametri extra per il redirect */
  redirectParams?: (game: GameContext) => Record<string, string>;
  /** Passi da mostrare all'utente */
  steps: string[];
  /** Requisiti (tool esterni, plugin, ecc.) */
  requirements: string[];
  /** Tempo stimato (minuti) */
  estimatedMinutes: number;
  /** File pattern da cercare per confermare la strategia */
  filePatterns: string[];
  /** Tool dedicato nella sidebar (route + nome) */
  dedicatedTool?: { route: string; name: string };
}

export interface GameContext {
  id: string;
  title: string;
  installPath: string;
  engine: string;
  targetLang: string;
  locFiles: Array<{ path: string; name: string; type: string; size: number }>;
}

// ============================================================================
// STRATEGIE
// ============================================================================

const STRATEGIES: Record<StrategyId, TranslationStrategy> = {
  'community-patch': {
    id: 'community-patch',
    name: 'Community Translation',
    description: 'A community translation is available! Human quality, ready to install.',
    icon: 'Users',
    color: 'emerald',
    difficulty: 'easy',
    canDoInline: true,
    steps: [
      'Translation found in community database',
      'Open download page',
      'Download and extract to game folder',
      'Launch the game — already translated!',
    ],
    requirements: [],
    estimatedMinutes: 2,
    filePatterns: [],
  },

  'text-files': {
    id: 'text-files',
    name: 'Traduzione File Testo',
    description: 'Traduce direttamente i file di localizzazione (CSV, JSON, XML, PO). Il metodo più semplice e sicuro.',
    icon: 'FileText',
    color: 'green',
    difficulty: 'easy',
    canDoInline: true,
    steps: [
      'Legge i file di localizzazione trovati',
      'Estrae le stringhe sorgente',
      'Traduce con AI (fallback chain automatica)',
      'Salva i file tradotti nella cartella del gioco',
    ],
    requirements: [],
    estimatedMinutes: 5,
    filePatterns: ['*.csv', '*.json', '*.xml', '*.po', '*.lang', '*.loc', '*.txt', '*.ini', '*.strings'],
    dedicatedTool: { route: '/translator/pro', name: 'Editor Traduzioni' },
  },

  'unity-xunity': {
    id: 'unity-xunity',
    name: 'Unity — XUnity Autotranslator',
    description: 'Installa BepInEx + XUnity che intercetta i testi in tempo reale. Funziona con la maggior parte dei giochi Unity.',
    icon: 'Blocks',
    color: 'emerald',
    difficulty: 'easy',
    canDoInline: true,
    steps: [
      'Verifica/installa BepInEx nel gioco',
      'Installa XUnity Autotranslator',
      'Avvia il gioco per raccogliere stringhe',
      'Traduce le stringhe raccolte con AI',
      'Le traduzioni vengono applicate automaticamente al prossimo avvio',
    ],
    requirements: ['BepInEx (installato automaticamente)', 'XUnity Autotranslator (installato automaticamente)'],
    estimatedMinutes: 15,
    filePatterns: ['UnityPlayer.dll', '*_Data/', 'globalgamemanagers', 'Assembly-CSharp.dll'],
    dedicatedTool: { route: '/unity-patcher', name: 'Unity Patcher' },
  },

  'unity-assets': {
    id: 'unity-assets',
    name: 'Unity — Asset Bundle',
    description: 'Prova XUnity autotranslator, altrimenti cerca file di testo o patcha il binario.',
    icon: 'Package',
    color: 'blue',
    difficulty: 'medium',
    canDoInline: true,
    steps: [
      'Prova installazione XUnity Autotranslator',
      'Se non funziona, cerca file di testo traducibili',
      'Fallback: Binary Patcher sul .exe',
    ],
    requirements: [],
    estimatedMinutes: 20,
    filePatterns: ['*.assets', '*.bundle', 'resources.assets'],
    dedicatedTool: { route: '/unity-bundle', name: 'Unity Bundle' },
  },

  'unreal-locres': {
    id: 'unreal-locres',
    name: 'Unreal Engine — LocRes',
    description: 'Estrae stringhe da .locres/.pak/.utoc, traduce con AI, crea .pak di traduzione automaticamente.',
    icon: 'Gamepad2',
    color: 'sky',
    difficulty: 'medium',
    canDoInline: true,
    steps: [
      'Cerca .locres liberi e in .pak/IoStore',
      'Estrae namespace + chiave + testo sorgente',
      'Traduce con AI (batch)',
      'Genera .pak tradotto con suffisso _P (priorità patch)',
      'Il gioco carica automaticamente la traduzione',
    ],
    requirements: [],
    estimatedMinutes: 10,
    filePatterns: ['*.locres', '*.locmeta', 'Content/Localization/'],
    dedicatedTool: { route: '/unreal-translator', name: 'UE Translator' },
  },

  'rpgmaker-json': {
    id: 'rpgmaker-json',
    name: 'RPG Maker MV/MZ — JSON',
    description: 'Traduce i file JSON dei dati di RPG Maker MV/MZ (dialoghi, oggetti, nemici, skill).',
    icon: 'Swords',
    color: 'orange',
    difficulty: 'easy',
    canDoInline: true,
    steps: [
      'Trova i file JSON in data/ (Map*.json, Actors.json, Items.json, ecc.)',
      'Estrae i testi (dialoghi, nomi, descrizioni)',
      'Traduce con AI preservando i codici RPG Maker (\\V[n], \\N[n], \\C[n])',
      'Salva i file tradotti sovrascrivendo gli originali (backup automatico)',
    ],
    requirements: [],
    estimatedMinutes: 10,
    filePatterns: ['www/data/*.json', 'data/*.json', 'Game.rpgproject', 'game.rmmzproject'],
    dedicatedTool: { route: '/rpgmaker-patcher', name: 'RPG Maker Patcher' },
  },

  'rpgmaker-ruby': {
    id: 'rpgmaker-ruby',
    name: 'RPG Maker VX/Ace — Ruby',
    description: 'Cerca file di testo traducibili o patcha il binario del gioco RPG Maker VX/Ace.',
    icon: 'Gem',
    color: 'red',
    difficulty: 'hard',
    canDoInline: true,
    steps: [
      'Usa RPGMaker Trans per estrarre i testi in formato .txt',
      'Traduce i file di testo estratti',
      'Riapplica con RPGMaker Trans',
    ],
    requirements: ['RPGMaker Trans (link fornito)'],
    estimatedMinutes: 30,
    filePatterns: ['*.rgss3a', '*.rgss2a', '*.rvdata2', '*.rvdata', 'Game.ini'],
    dedicatedTool: { route: '/rpgmaker-patcher', name: 'RPG Maker Patcher' },
  },

  'renpy-rpy': {
    id: 'renpy-rpy',
    name: "Ren'Py — Script .rpy",
    description: "Traduce i file .rpy di Ren'Py. Supporta dialoghi, menu, scelte e variabili.",
    icon: 'BookOpen',
    color: 'pink',
    difficulty: 'easy',
    canDoInline: true,
    steps: [
      'Trova i file .rpy/.rpyc in game/',
      'Estrae dialoghi, menu e stringhe UI',
      'Traduce con AI preservando tag Ren\'Py',
      'Genera file tl/ (translation) per la lingua target',
    ],
    requirements: [],
    estimatedMinutes: 10,
    filePatterns: ['*.rpy', '*.rpyc', '*.rpa', 'renpy/'],
    dedicatedTool: { route: '/renpy-patcher', name: "Ren'Py Patcher" },
  },

  'gamemaker-data': {
    id: 'gamemaker-data',
    name: 'GameMaker — data.win',
    description: 'Estrae stringhe dal data.win di GameMaker e le traduce direttamente.',
    icon: 'Wrench',
    color: 'yellow',
    difficulty: 'hard',
    canDoInline: true,
    steps: [
      'Estrae stringhe dal data.win',
      'Filtra noise (stringhe di engine)',
      'Traduce con AI',
      'Patcha il data.win con le traduzioni',
    ],
    requirements: ['UndertaleModTool (per giochi complessi)'],
    estimatedMinutes: 20,
    filePatterns: ['data.win', 'game.unx', 'game.ios', '*.yydebug'],
  },

  'godot-pck': {
    id: 'godot-pck',
    name: 'Godot — .pck',
    description: 'Cerca file CSV/translation nel gioco Godot, altrimenti patcha il binario.',
    icon: 'Box',
    color: 'cyan',
    difficulty: 'medium',
    canDoInline: true,
    steps: [
      'Estrae il .pck con gdsdecomp',
      'Trova i file di traduzione (CSV, .translation)',
      'Traduce con AI',
      'Ricrea il .pck con i file tradotti',
    ],
    requirements: ['gdsdecomp (link fornito)'],
    estimatedMinutes: 15,
    filePatterns: ['*.pck', '*.import', 'project.godot'],
  },

  'binary-patch': {
    id: 'binary-patch',
    name: 'Binary String Patcher',
    description: 'Estrae stringhe direttamente dal binario (.exe/.dll) e le sostituisce. Per giochi con engine custom.',
    icon: 'Binary',
    color: 'violet',
    difficulty: 'hard',
    canDoInline: true,
    steps: [
      'Scansiona il binario per stringhe ASCII/UTF-8',
      'Filtra noise (stringhe di engine/debug)',
      'Categorizza (dialogo, UI, stats, nemici)',
      'Traduce con AI (rispettando vincolo lunghezza byte)',
      'Crea copia patchata del binario',
    ],
    requirements: [],
    estimatedMinutes: 15,
    filePatterns: ['*.exe', '*.dll'],
    dedicatedTool: { route: '/binary-patcher', name: 'Binary Patcher' },
  },

  'danganronpa-wad': {
    id: 'danganronpa-wad',
    name: 'Danganronpa — WAD/PAK',
    description: 'Estrae dialoghi dai WAD/PAK/LIN di Danganronpa, traduce con AI e salva il progetto.',
    icon: 'Skull',
    color: 'rose',
    difficulty: 'hard',
    canDoInline: true,
    steps: [
      'Rileva tipo Danganronpa (THH, GD, AE, V3)',
      'Estrae dialoghi dai file WAD/PAK/LIN',
      'Filtra garbage binario, preserva tag CLT',
      'Traduce con AI in batch',
      'Salva traduzioni + genera file PO/TSV',
    ],
    requirements: [],
    estimatedMinutes: 30,
    filePatterns: ['*.wad', 'dr1_data*.wad', 'dr2_data*.wad', 'DR1_us.exe', 'DR2_us.exe'],
    dedicatedTool: { route: '/danganronpa-patcher', name: 'Danganronpa Patcher' },
  },

  'wolfrpg': {
    id: 'wolfrpg',
    name: 'Wolf RPG Editor',
    description: 'Cerca file di testo traducibili nei giochi Wolf RPG, altrimenti patcha il binario.',
    icon: 'Wolf',
    color: 'gray',
    difficulty: 'medium',
    canDoInline: true,
    steps: [
      'Estrae testi dai file .wolf',
      'Traduce con AI',
      'Ricrea i file .wolf tradotti',
    ],
    requirements: [],
    estimatedMinutes: 15,
    filePatterns: ['*.wolf', 'Game.dat', 'Data/'],
    dedicatedTool: { route: '/wolfrpg-patcher', name: 'WolfRPG Patcher' },
  },

  'telltale': {
    id: 'telltale',
    name: 'Telltale Patcher',
    description: 'Gioco Telltale rilevato! Usa il Telltale Patcher dedicato per installare le traduzioni italiane della community.',
    icon: 'Gamepad2',
    color: 'emerald',
    difficulty: 'easy',
    canDoInline: true,
    steps: [
      'Apri il Telltale Patcher dalla sidebar o dal bottone qui sotto',
      'Seleziona il gioco e la cartella di installazione',
      'Scarica e installa la traduzione italiana',
      'Avvia il gioco — già tradotto!',
    ],
    requirements: [],
    estimatedMinutes: 2,
    filePatterns: ['*.ttarch', '*.ttarch2', '*.langdb', '*.landb', '*.dlog'],
    dedicatedTool: { route: '/telltale-patcher', name: 'Telltale Patcher' },
  },

  'ocr': {
    id: 'ocr',
    name: 'Traduzione OCR Live',
    description: 'Nessun file di testo estraibile. Avvia il gioco e usa il Traduttore OCR per tradurre il testo dallo schermo in tempo reale.',
    icon: 'ScanEye',
    color: 'amber',
    difficulty: 'easy',
    canDoInline: true,
    steps: [
      'Avvia il gioco normalmente',
      'Apri il Traduttore OCR di GameStringer',
      'Seleziona la regione dello schermo con il testo',
      'La traduzione appare in overlay in tempo reale',
    ],
    requirements: [],
    estimatedMinutes: 1,
    filePatterns: [],
    dedicatedTool: { route: '/ocr-translator', name: 'OCR Translator' },
  },

  'manual': {
    id: 'manual',
    name: 'Analisi Automatica',
    description: 'Engine non riconosciuto. Prova automaticamente: 1) file di testo, 2) Binary Patcher sul .exe/.dll.',
    icon: 'Search',
    color: 'slate',
    difficulty: 'hard',
    canDoInline: true,
    steps: [
      'Esplora la cartella del gioco per file di testo',
      'Se trovi CSV/JSON/XML → usa Traduzione File Testo',
      'Se non trovi nulla → usa Binary Patcher sul .exe/.dll',
      'Verifica il risultato avviando il gioco',
    ],
    requirements: [],
    estimatedMinutes: 30,
    filePatterns: [],
  },
};

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Determina la strategia migliore basandosi su engine e file trovati.
 */
export function detectStrategy(
  engine: string, 
  files: Array<{ path: string; name: string; type: string; size: number }>,
  gameName?: string,
  rustRecommendation?: { primary_method?: string } | null,
  steamAppId?: number | string,
  targetLang?: string
): TranslationStrategy {
  const allPaths = files.map(f => f.path.toLowerCase());
  const allNames = files.map(f => f.name.toLowerCase());

  // 🌟 PRIORITY 1: Community translation already available (human quality > AI)
  if (gameName || steamAppId) {
    const communityTr = findCommunityTranslation(gameName || '', steamAppId, targetLang || 'it');
    if (communityTr) {
      const strat = { ...STRATEGIES['community-patch'] };
      strat.description = `Community translation by ${communityTr.author} (${communityTr.source}) available! Human quality, ready to install.`;
      return strat;
    }
  }

  // Telltale — ha patcher dedicato
  if (engine === 'Telltale Tool' || engine === 'Telltale') {
    return STRATEGIES['telltale'];
  }
  if (gameName) {
    const gn = gameName.toLowerCase();
    if (
      (gn.includes('wolf') && gn.includes('among')) ||
      (gn.includes('walking') && gn.includes('dead')) ||
      (gn.includes('batman') && gn.includes('telltale')) ||
      (gn.includes('tales') && gn.includes('borderlands')) ||
      (gn.includes('game of thrones') && gn.includes('telltale')) ||
      (gn.includes('guardians') && gn.includes('galaxy') && gn.includes('telltale')) ||
      gn.includes('telltale')
    ) {
      return STRATEGIES['telltale'];
    }
  }
  if (allNames.some(n => n.endsWith('.ttarch') || n.endsWith('.ttarch2') || n.endsWith('.langdb'))) {
    return STRATEGIES['telltale'];
  }

  // Danganronpa — ha patcher dedicato
  if (gameName && /danganronpa/i.test(gameName)) {
    return STRATEGIES['danganronpa-wad'];
  }
  if (allNames.some(n => n.includes('.wad') && (n.includes('dr1') || n.includes('dr2')))) {
    return STRATEGIES['danganronpa-wad'];
  }

  // Wolf RPG
  if (allNames.some(n => n.endsWith('.wolf')) || allNames.some(n => n === 'game.dat')) {
    return STRATEGIES['wolfrpg'];
  }

  // RPG Maker MV/MZ (JSON)
  if (engine === 'RPG Maker' || allNames.some(n => n === 'game.rpgproject' || n === 'game.rmmzproject')) {
    return STRATEGIES['rpgmaker-json'];
  }
  // RPG Maker VX/Ace (Ruby)
  if (allNames.some(n => n.endsWith('.rgss3a') || n.endsWith('.rgss2a') || n.endsWith('.rvdata2'))) {
    return STRATEGIES['rpgmaker-ruby'];
  }

  // Ren'Py
  if (engine === "Ren'Py" || allNames.some(n => n.endsWith('.rpy') || n.endsWith('.rpa'))) {
    return STRATEGIES['renpy-rpy'];
  }

  // Godot
  if (engine === 'Godot' || allNames.some(n => n === 'project.godot' || n.endsWith('.pck'))) {
    return STRATEGIES['godot-pck'];
  }

  // GameMaker
  if (engine === 'GameMaker' || allNames.some(n => n === 'data.win' || n === 'game.unx')) {
    return STRATEGIES['gamemaker-data'];
  }

  // Unreal Engine
  if (engine?.includes('Unreal') || allNames.some(n => n.endsWith('.locres') || n.endsWith('.pak'))) {
    return STRATEGIES['unreal-locres'];
  }

  // Unity — controlla se ci sono file di testo accessibili
  if (engine === 'Unity') {
    const hasTextFiles = files.some(f => 
      ['csv', 'json', 'xml', 'txt', 'po'].includes(f.type) && f.size > 1000
    );
    if (hasTextFiles) {
      return STRATEGIES['text-files'];
    }
    return STRATEGIES['unity-xunity'];
  }

  // File di testo trovati (qualsiasi engine)
  const textLocFiles = files.filter(f => 
    ['csv', 'json', 'xml', 'po', 'lang', 'loc', 'txt', 'ini'].includes(f.type) && f.size > 500
  );
  if (textLocFiles.length > 0) {
    return STRATEGIES['text-files'];
  }

  // Fallback: binary patch (se ci sono exe/dll) — estrae menu, UI, settings
  // OCR sarà suggerito come complemento DOPO il binary patch
  if (allNames.some(n => n.endsWith('.exe') || n.endsWith('.dll'))) {
    return STRATEGIES['binary-patch'];
  }

  // Nessun binario, nessun file di testo → OCR è l'unica opzione
  return STRATEGIES['ocr'];
}

/**
 * Restituisce tutte le strategie alternative (per mostrare "Prova anche...")
 */
export function getAlternativeStrategies(
  primary: StrategyId,
  engine: string,
  files: Array<{ path: string; name: string; type: string; size: number }>
): TranslationStrategy[] {
  const alternatives: TranslationStrategy[] = [];

  // Binary patch è sempre un'alternativa
  if (primary !== 'binary-patch' && primary !== 'manual') {
    alternatives.push(STRATEGIES['binary-patch']);
  }

  // Se il primario è Unity XUnity, suggerisci anche asset extraction
  if (primary === 'unity-xunity') {
    alternatives.push(STRATEGIES['unity-assets']);
  }

  // Se ci sono file di testo ma il primario non è text-files
  const hasTextFiles = files.some(f => ['csv', 'json', 'xml', 'po', 'txt'].includes(f.type) && f.size > 500);
  if (hasTextFiles && primary !== 'text-files') {
    alternatives.push(STRATEGIES['text-files']);
  }

  return alternatives.slice(0, 2);
}

export function getStrategy(id: StrategyId): TranslationStrategy {
  return STRATEGIES[id];
}

export function getAllStrategies(): TranslationStrategy[] {
  return Object.values(STRATEGIES);
}
