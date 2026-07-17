/**
 * First Game — motore di suggerimento del "primo gioco facile".
 *
 * Task ROADMAP `onboarding` ("primo gioco in 5 minuti"): il momento "wow" deve
 * arrivare in fretta. Il modo più affidabile per garantirlo è NON far scegliere
 * l'utente a caso, ma proporgli il titolo più FACILE già presente nella sua
 * libreria — quello con l'engine più semplice/veloce da tradurre e con la
 * probabilità di successo più alta al primo colpo.
 *
 * Questo modulo è puro (nessuna dipendenza): riceve i giochi scansionati e
 * ritorna il candidato migliore con punteggio, stima dei minuti e una chiave
 * i18n per la motivazione. La UI (first-game-flow) lo consuma e localizza.
 */

export type FirstGameEngineId =
  | 'renpy'
  | 'rpgmaker'
  | 'tyranoscript'
  | 'kirikiri'
  | 'wolf'
  | 'gamemaker'
  | 'godot'
  | 'unity'
  | 'unreal'
  | 'unknown';

/** Sottoinsieme del Game della libreria che serve al ranking (disaccoppiato). */
export interface FirstGameInput {
  id: string;
  title: string;
  engine?: string | null;
  isInstalled?: boolean;
  installDir?: string | null;
  supportedLanguages?: string[];
  genres?: string[];
  lastPlayed?: number;
}

export interface FirstGameSuggestion {
  game: FirstGameInput;
  engineId: FirstGameEngineId;
  engineLabel: string;
  /** 0..100: più alto = più facile/veloce al "wow". */
  score: number;
  /** Stima onesta dei minuti al primo risultato tradotto. */
  estimatedMinutes: number;
  /** Suffisso chiave i18n per la motivazione (es. 'renpy' → firstGame.reason.renpy). */
  reasonKey: string;
  /** Vero se il gioco sembra già disponibile nella lingua target. */
  alreadyInTargetLanguage: boolean;
}

interface EngineProfile {
  id: FirstGameEngineId;
  label: string;
  /** Facilità base (0..100). */
  ease: number;
  /** Minuti base stimati al primo risultato. */
  minutes: number;
  /** Parole chiave (lowercase) che identificano l'engine da stringhe libere. */
  keywords: string[];
}

/**
 * Profili engine ordinati per facilità. Gli engine file-based (testo/JSON)
 * sono i più veloci e affidabili → ideali come primo gioco; i binari/AAA
 * (Unreal, IL2CPP) sono più lenti e vanno per ultimi.
 */
const ENGINE_PROFILES: EngineProfile[] = [
  { id: 'renpy', label: "Ren'Py", ease: 95, minutes: 3, keywords: ['renpy', "ren'py", 'ren py'] },
  { id: 'rpgmaker', label: 'RPG Maker', ease: 90, minutes: 4, keywords: ['rpgmaker', 'rpg maker', 'rpg-maker', 'rmmv', 'rmmz', 'mv', 'mz'] },
  { id: 'tyranoscript', label: 'TyranoScript', ease: 82, minutes: 5, keywords: ['tyrano', 'tyranoscript'] },
  { id: 'kirikiri', label: 'KiriKiri', ease: 78, minutes: 6, keywords: ['kirikiri', 'kag', 'krkr'] },
  { id: 'wolf', label: 'Wolf RPG', ease: 70, minutes: 7, keywords: ['wolf', 'wolfrpg', 'wolf rpg'] },
  { id: 'gamemaker', label: 'GameMaker', ease: 60, minutes: 8, keywords: ['gamemaker', 'game maker', 'gms', 'yoyo'] },
  { id: 'godot', label: 'Godot', ease: 62, minutes: 7, keywords: ['godot'] },
  { id: 'unity', label: 'Unity', ease: 55, minutes: 9, keywords: ['unity', 'il2cpp', 'mono'] },
  { id: 'unreal', label: 'Unreal Engine', ease: 40, minutes: 12, keywords: ['unreal', 'ue4', 'ue5', 'unrealengine'] },
];

const UNKNOWN_PROFILE: EngineProfile = {
  // label vuota: per l'engine sconosciuto la UI mostra la motivazione (i18n),
  // non un'etichetta hardcoded in una lingua.
  id: 'unknown', label: '', ease: 30, minutes: 10, keywords: [],
};

/** Normalizza una stringa engine libera (o null) al profilo canonico. */
export function resolveEngineProfile(engine?: string | null): EngineProfile {
  if (!engine) return UNKNOWN_PROFILE;
  const e = engine.toLowerCase();
  for (const p of ENGINE_PROFILES) {
    if (p.keywords.some(k => e.includes(k))) return p;
  }
  return UNKNOWN_PROFILE;
}

/** Mappa alcuni codici/nomi lingua target ai nomi Steam più comuni (lowercase). */
const LANGUAGE_ALIASES: Record<string, string[]> = {
  it: ['it', 'ita', 'italian', 'italiano'],
  en: ['en', 'eng', 'english', 'inglese'],
  es: ['es', 'spa', 'spanish', 'español', 'espanol', 'castellano'],
  fr: ['fr', 'fra', 'french', 'français', 'francais'],
  de: ['de', 'deu', 'ger', 'german', 'deutsch'],
  pt: ['pt', 'por', 'portuguese', 'português', 'portugues', 'pt-br', 'brazilian'],
  ru: ['ru', 'rus', 'russian', 'русский'],
  ja: ['ja', 'jp', 'jpn', 'japanese', '日本語'],
  zh: ['zh', 'chinese', 'schinese', 'tchinese', '中文', '简体', '繁體'],
  ko: ['ko', 'kor', 'korean', '한국어'],
  pl: ['pl', 'pol', 'polish', 'polski'],
  el: ['el', 'ell', 'greek', 'ελληνικά'],
};

/** Vero se la lista di lingue supportate copre (verosimilmente) la lingua target. */
export function supportsLanguage(supported: string[] | undefined, target: string | undefined): boolean {
  if (!supported || supported.length === 0 || !target) return false;
  const aliases = LANGUAGE_ALIASES[target.toLowerCase()] || [target.toLowerCase()];
  return supported.some(s => {
    const v = s.toLowerCase().trim();
    return aliases.some(a => v === a || v.includes(a));
  });
}

export interface RankOptions {
  /** Lingua target (codice o nome). Serve a de-prioritizzare i giochi già tradotti. */
  targetLanguage?: string;
  /** Considera solo i giochi installati (default: true — non si può tradurre ciò che non è installato). */
  installedOnly?: boolean;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Calcola la suggestion (punteggio, minuti, motivazione) per un singolo gioco. */
function evaluate(game: FirstGameInput, opts: RankOptions): FirstGameSuggestion {
  const profile = resolveEngineProfile(game.engine);
  const already = supportsLanguage(game.supportedLanguages, opts.targetLanguage);

  let score = profile.ease;
  // Bonus: gioco installato = traducibile subito.
  if (game.isInstalled) score += 5;
  // Penalità: sembra già disponibile nella lingua target (meno "wow" tradurlo).
  if (already) score -= 25;
  // Nota: la freschezza (lastPlayed) NON entra nel punteggio (verrebbe schiacciata
  // dal clamp per gli engine facili) ma è un tie-breaker nell'ordinamento.

  return {
    game,
    engineId: profile.id,
    engineLabel: profile.label,
    score: clamp(Math.round(score), 0, 100),
    estimatedMinutes: profile.minutes,
    reasonKey: profile.id,
    alreadyInTargetLanguage: already,
  };
}

/**
 * Classifica i giochi come candidati "primo gioco", dal più facile al più difficile.
 * Di default considera solo i giochi installati.
 */
export function rankFirstGameCandidates(
  games: FirstGameInput[],
  opts: RankOptions = {}
): FirstGameSuggestion[] {
  const installedOnly = opts.installedOnly !== false;
  const pool = installedOnly ? games.filter(g => g.isInstalled) : games.slice();

  return pool
    .map(g => evaluate(g, opts))
    .sort((a, b) => {
      // 1) non-già-tradotti prima; 2) punteggio; 3) minuti minori; 4) titolo stabile
      if (a.alreadyInTargetLanguage !== b.alreadyInTargetLanguage) {
        return a.alreadyInTargetLanguage ? 1 : -1;
      }
      if (b.score !== a.score) return b.score - a.score;
      if (a.estimatedMinutes !== b.estimatedMinutes) return a.estimatedMinutes - b.estimatedMinutes;
      // A parità: chi è stato giocato più di recente vince (wow più "sentito").
      const la = a.game.lastPlayed || 0;
      const lb = b.game.lastPlayed || 0;
      if (la !== lb) return lb - la;
      return a.game.title.localeCompare(b.game.title);
    });
}

/**
 * Sceglie il miglior "primo gioco" dalla libreria, o null se non ce n'è uno
 * adatto (nessun gioco installato). La UI, in quel caso, invita a scansionare
 * o installare un gioco.
 */
export function pickFirstGame(
  games: FirstGameInput[],
  opts: RankOptions = {}
): FirstGameSuggestion | null {
  const ranked = rankFirstGameCandidates(games, opts);
  return ranked.length > 0 ? ranked[0] : null;
}
