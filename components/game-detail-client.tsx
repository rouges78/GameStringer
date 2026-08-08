
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { invoke } from '@/lib/tauri-api';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Gamepad2, Settings, Search, Play, Loader2, Database,
  ArrowLeft, Languages, Sparkles, Image as ImageIcon, Cpu, Globe, Clock, Brain, ChevronDown, Film, Wrench, ShieldCheck
} from 'lucide-react';
import { matchWhitelist, type PublisherWhitelist } from '@/lib/social/publisher-whitelist';
import publisherWhitelistData from '@/data/publisher-whitelist.json';
import Link from 'next/link';
import { motion } from 'framer-motion';
import InlineTranslator from '@/components/inline-translator';
import { LanguageFlags, getCountryCode } from '@/components/ui/language-flags';
import { activityHistory } from '@/lib/activity-history';
import { TranslationRecommendation } from '@/components/translation-recommendation';
import { useTranslation } from '@/lib/i18n';
import { useProgress } from '@/components/progress/progress-provider';
import { CoverPicker } from '@/components/cover-picker';
import { HltbStats } from '@/components/hltb-stats';
import { toast } from 'sonner';
import { GspackExportDialog, GspackImportDialog } from '@/components/gspack-dialog';

// AudioPatcher import removed — not currently used
import { GameMakerTranslator } from '@/components/gamemaker-translator';
import { clientLogger } from '@/lib/client-logger';
import { translateWithFallback } from '@/lib/ai/ai-translate-direct';
import { projectService } from '@/lib/services/translation-projects';
import { gamePathKey } from '@/lib/game-path';
import { runHendrixTranslation } from '@/lib/hendrix-translate';
import { runRenpyTranslation } from '@/lib/renpy-translate';
import { BackendPicker } from '@/components/translation/backend-picker';
import { getTranslationBackend, setTranslationBackend, type TranslationBackend } from '@/lib/translation-backend';
import { runRpgmakerTranslation } from '@/lib/rpgmaker-translate';
import { startHeroTracking } from '@/lib/hero-job-tracking';
import {
  reportCompatStep, newCompatRunId, compatGameKey, setPendingBootCheck,
  classifyCompatError, maybeOfferCompatOptIn, type CompatGameRef,
} from '@/lib/compat-telemetry';
import { reportCrash } from '@/lib/crash-reporter';
import { TARGET_LANGUAGES as CANONICAL_TARGET_LANGUAGES } from '@/lib/translation/target-languages';
import { LANG_TO_CODE } from '@/lib/translation/language-mappings';
import { useWarmIndex } from '@/hooks/use-warm-index';
import {
  ScreenshotGallery,
  ScreenshotLightbox,
  AutoTranslateStepper,
  CommunityTranslationsBanner,
  GameUpdateBanner,
  GameToolsPanel,
  UnrealLocalizationPanel,
  UnityAssetsPanel,
  CompatCard,
  FontCheckCard,
  GmGlyphCard,
} from '@/components/game-detail';

// Game interface based on mock data structure
interface Game {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  platform: string;
  storeId?: string | number;
  engine?: string;
  installPath?: string;
  executablePath?: string;
  isInstalled?: boolean;
  is_installed?: boolean; // Alternative naming
  detectedFiles?: string[];
  lastScanned?: Date | string;
  createdAt?: Date;
  updatedAt?: Date;
  appid?: number;
  name?: string;
  shortDescription?: string;
  headerImage?: string;
  headerUrl?: string; // Alternative naming
  heroUrl?: string;
  coverImage?: string; // Alternative naming
  screenshots?: { id?: number; path_thumbnail: string; path_full: string }[];
  movies?: string[];
  metacritic?: { score: number; url?: string } | null;
  achievements?: { total: number; highlighted?: { name: string; path: string }[] } | null;
  background?: string;
  website?: string;
  legalNotice?: string;
  legal_notice?: string; // Alternative naming
  recommendations?: number | { total: number } | null;
  developers?: string[];
  publishers?: string[];
  releaseDate?: string | { coming_soon: boolean; date: string };
  release_date?: string | { coming_soon: boolean; date: string } | null; // Alternative naming
  genres?: (string | {id?: string; description: string})[];
  categories?: string[];
  supportedLanguages?: string;
  supported_languages?: string; // Alternative naming
  pcRequirements?: { minimum?: string; recommended?: string } | null;
  pc_requirements?: { minimum?: string; recommended?: string } | null; // Alternative naming
  isFree?: boolean;
  is_free?: boolean; // Alternative naming
  dlc?: number[] | null;
  executableName?: string;
  install_dir?: string; // Alternative naming
  source?: string;
  detailedDescription?: string;
  aboutGame?: string;
  playtime_forever?: number;
}

/** Riferimento cross-utente del gioco per la telemetria di compatibilità. */
function compatRefFor(game: Game): CompatGameRef {
  const name = game.title || game.name || 'Unknown Game';
  return {
    key: compatGameKey(game.appid ?? game.id, name),
    appId: typeof game.appid === 'number' && game.appid > 0 ? game.appid : null,
    name,
    store: typeof game.source === 'string' ? game.source : null,
  };
}

/** Separatore fra le stringhe concatenate in una sola richiesta di traduzione. */
const SEP_TRADUZIONE = '\n||||\n';

/**
 * Traduce un gruppo di stringhe in una sola chiamata, dimezzando il gruppo e
 * ritentando quando la richiesta è troppo grande.
 *
 * `translate_text_simple` è una **GET**: il testo viaggia nella query string,
 * quindi il limite è sulla LUNGHEZZA COMPLESSIVA, non sul numero di stringhe.
 * Con dialoghi lunghi un batch da 15 sfonda il limite e il server risponde 414.
 * Prima il backend si limitava a dire «batch troppo grande, riducilo» e nessuno
 * riduceva niente: l'intero gruppo finiva fra i falliti.
 *
 * Ritorna un array **della stessa lunghezza dell'input**, con `null` dove la
 * traduzione non è arrivata. Il `null` è deliberato: restituire l'originale
 * renderebbe di nuovo un fallimento indistinguibile da un successo, ed è
 * esattamente il difetto che ha prodotto un .pak di 811 stringhe inglesi
 * annunciato come «Patch installata».
 */
async function traduciConSplit(testi: string[], lang: string): Promise<(string | null)[]> {
  if (testi.length === 0) return [];
  try {
    const res = await invoke<{ translated_text?: string }>('translate_text_simple', {
      text: testi.join(SEP_TRADUZIONE),
      targetLang: lang,
    });
    const parts = res?.translated_text ? res.translated_text.split(SEP_TRADUZIONE) : [];
    // Meno pezzi del previsto = il servizio ha troncato: trattalo come "troppo
    // grande" e lascia che il ramo di sotto dimezzi, invece di buttare via metà
    // gruppo silenziosamente.
    if (parts.length < testi.length && testi.length > 1) {
      throw new Error(`risposta incompleta: ${parts.length}/${testi.length} pezzi`);
    }
    return testi.map((_, i) => parts[i]?.trim() || null);
  } catch (err) {
    const msg = String(err);
    const troppoGrande = msg.includes('414') || /too long|incompleta/i.test(msg);
    if (troppoGrande && testi.length > 1) {
      const meta = Math.ceil(testi.length / 2);
      const a = await traduciConSplit(testi.slice(0, meta), lang);
      const b = await traduciConSplit(testi.slice(meta), lang);
      return [...a, ...b];
    }
    clientLogger.error(`[traduzione] gruppo di ${testi.length} non tradotto:`, msg);
    return testi.map(() => null);
  }
}

export default function GameDetailPage() {
  const { t, language } = useTranslation();
  const progress = useProgress();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Read gameId from path params (dev) or query params (Tauri static export)
  const [gameId, setGameId] = useState<string>(() => {
    const pathId = params.id as string;
    if (pathId) return pathId;
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('id') || '';
    }
    return '';
  });

  // Sync gameId when searchParams change (client-side navigation)
  useEffect(() => {
    const newId = searchParams.get('id') || (params.id as string) || '';
    if (newId && newId !== gameId) {
      setGameId(newId);
      setGame(null);
      setIsLoading(true);
      setImageError(false);
      gameDataLoadedRef.current = null; // allow re-fetch
    }
  }, [searchParams, params.id]);

  const [game, setGame] = useState<Game | null>(null);
  const [_translations, setTranslations] = useState<{id: string; gameId: string; filePath: string; status: string; confidence: number; timestamp: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [dlcGames, setDlcGames] = useState<Record<string, unknown>[]>([]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [_steamDetails, setSteamDetails] = useState<unknown>(null);
  const [imageError, setImageError] = useState(false);

  const [isInstallingPatch, setIsInstallingPatch] = useState(false);
  const [patchStatus, setPatchStatus] = useState<{success: boolean, message: string} | null>(null);
  const [engineInfo, setEngineInfo] = useState<{
    engine: string;
    can_patch: boolean;
    patch_tool: string | null;
    patch_description: string | null;
    source?: string | null;
    tips?: string[] | null;
  } | null>(null);
  const [isDetectingEngine, setIsDetectingEngine] = useState(false);
  
  // Editor traduzioni XUnity
  const [xunityTranslations, setXunityTranslations] = useState<{original: string, translated: string, line_number: number}[]>([]);
  const [_isLoadingTranslations, setIsLoadingTranslations] = useState(false);
  const [_showTranslationEditor, setShowTranslationEditor] = useState(false);
  const [_translationSearch, _setTranslationSearch] = useState('');
  const [_editingEntry, setEditingEntry] = useState<{original: string, translated: string} | null>(null);

  // Lightbox screenshot (indice per navigazione)
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState<number | null>(null);

  // GsPack export/import dialogs
  const [showGspackExport, setShowGspackExport] = useState(false);
  const [showGspackImport, setShowGspackImport] = useState(false);

  // Descrizione tradotta in italiano
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);

  // HowLongToBeat
  const [_hltbData, setHltbData] = useState<{found: boolean; main?: number; main_extra?: number; completionist?: number; url?: string} | null>(null);
  const [_isLoadingHltb, setIsLoadingHltb] = useState(false);
  
  // SteamGridDB fallback image
  const [fallbackImage, setFallbackImage] = useState<string | null>(null);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);

  // FMV detection (rileva automaticamente se il gioco contiene file video FMV)
  const [fmvInfo, setFmvInfo] = useState<{ isFmvGame: boolean; totalFiles: number; totalSizeMB: number; formats: string[] } | null>(null);

  // Lingue rilevate dai file di localizzazione del gioco (offline, qualsiasi store/engine).
  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);

  // ═══ TARGET LANGUAGE (lingua traduzione, indipendente dalla lingua UI) ═══
  const TARGET_LANGUAGES = CANONICAL_TARGET_LANGUAGES.map(l => ({
    code: l.code,
    label: l.name,
    flag: l.flag,
  }));
  const [targetLang, setTargetLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gs_target_lang') || language || 'it';
    }
    return language || 'it';
  });
  // Strumenti avanzati: chiusi di default. String it! basta per il caso normale.
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const langPickerRef = useRef<HTMLDivElement>(null);
  // Onboarding "primo gioco": all'arrivo da ?firstGame=1 evidenzia e porta in vista
  // il CTA "String it!" per accorciare il time-to-wow (highlight guidato, non avvio auto).
  const stringItBtnRef = useRef<HTMLButtonElement>(null);
  const [highlightStringIt, setHighlightStringIt] = useState(false);
  const firstGameHandledRef = useRef(false);

  // Gate anti-pirateria: conferma una-tantum di possedere una copia legale del
  // gioco, richiesta prima della PRIMA traduzione. Persistita in localStorage.
  const [legalGateOpen, setLegalGateOpen] = useState(false);
  const isLegalCopyAcked = () => {
    try {
      return localStorage.getItem('gamestringer_legal_copy_ack') === '1';
    } catch {
      return false;
    }
  };

  // Onboarding: quando si arriva dal flusso "primo gioco" (?firstGame=1), evidenzia
  // e porta in vista il pulsante "String it!". Guidato, non avvia da solo la traduzione.
  useEffect(() => {
    if (firstGameHandledRef.current) return;
    if (searchParams.get('firstGame') !== '1') return;
    if (!game || !game.isInstalled) return; // aspetta che il gioco sia caricato
    firstGameHandledRef.current = true;
    setHighlightStringIt(true);
    const scrollT = setTimeout(() => {
      stringItBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    const clearT = setTimeout(() => setHighlightStringIt(false), 6000);
    // Ripulisce il parametro così un refresh non ri-attiva l'evidenza (senza navigazione).
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('firstGame');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch { /* no-op */ }
    return () => { clearTimeout(scrollT); clearTimeout(clearT); };
  }, [game, searchParams]);

  // Arrivo da "String it!" premuto nella libreria (?stringit=1): stessa destinazione
  // e stessa azione dell'hero, invece del vecchio salto al /translation-wizard —
  // erano tre entry point con lo stesso nome e comportamenti diversi.
  // Evidenzia e porta in vista SENZA avviare da solo: la traduzione passa dal gate
  // legale e da quello P.T., e farli comparire a sorpresa sarebbe peggio di un clic.
  useEffect(() => {
    if (firstGameHandledRef.current) return;
    if (searchParams.get('stringit') !== '1') return;
    if (!game) return;
    firstGameHandledRef.current = true;
    setHighlightStringIt(true);
    const scrollT = setTimeout(() => {
      stringItBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    const clearT = setTimeout(() => setHighlightStringIt(false), 6000);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('stringit');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch { /* no-op */ }
    return () => { clearTimeout(scrollT); clearTimeout(clearT); };
  }, [game, searchParams]);

  // ═══ Pre-indicizzazione semantica del gioco aperto ═══
  const { run: runWarmIndex, indexing: warmIndexing, progress: warmProgress } = useWarmIndex();
  const runGameWarmIndex = useCallback(async () => {
    const gameKey = game?.id || (game?.appid ? String(game.appid) : null) || gameId;
    // detect_languages_from_files restituisce NOMI inglesi ("English", "Czech"),
    // ordinati alfabeticamente: vanno ricondotti a codici ISO. Se il gioco ha
    // l'inglese si parte da li' (sorgente quasi sempre corretta), altrimenti si
    // prende la prima lingua rilevata che sappiamo mappare.
    const sourceLang = detectedLanguages.includes('English')
      ? 'en'
      : (detectedLanguages.map(n => LANG_TO_CODE[n]).find(Boolean) ?? 'en');
    const res = await runWarmIndex({ sourceLang, targetLang, gameId: gameKey });

    if (!res.ok) {
      toast.error(t('semanticIndex.unavailable'));
      return;
    }
    if (res.empty) {
      toast.info(t('semanticIndex.emptyTm'));
      return;
    }
    const glPart = res.glTotal > 0 ? ` · ${t('semanticIndex.glossaryLabel')}: ${res.glIndexed}/${res.glTotal}` : '';
    const lorePart = (res.loreTotal > 0 || res.loreIndexed > 0)
      ? ` · ${t('semanticIndex.loreLabel')}: ${res.loreIndexed}/${res.loreTotal}`
      : '';
    toast.success(
      `${t('semanticIndex.doneLabel')}: ${res.tmIndexed}/${res.tmTotal} ${t('semanticIndex.vectors')}${glPart}${lorePart}`
    );
  }, [runWarmIndex, game, gameId, detectedLanguages, targetLang, t]);
  const currentFlag = TARGET_LANGUAGES.find(l => l.code === targetLang) || TARGET_LANGUAGES[0];

  // Persist targetLang
  useEffect(() => {
    localStorage.setItem('gs_target_lang', targetLang);
  }, [targetLang]);

  // Close lang picker on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false);
      }
    };
    if (showLangPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLangPicker]);

  // Auto-Translate one-click flow
  const [autoTranslateActive, setAutoTranslateActive] = useState(false);
  // "busy" = una traduzione è in corso (feedback pulsante + guard anti-doppio-click su TUTTI i motori).
  // "active" = mostra il pannello stepper (Ren'Py + path generico). Separati per non mostrare pannelli vuoti.
  const [autoTranslateBusy, setAutoTranslateBusy] = useState(false);
  const [autoTranslateProgress, setAutoTranslateProgress] = useState<string>('');
  const [_autoTranslateStep, setAutoTranslateStep] = useState(0);
  const [autoTranslateSteps, setAutoTranslateSteps] = useState<{label: string, status: 'pending' | 'running' | 'done' | 'error', detail?: string}[]>([]);
  const [autoTranslateError, setAutoTranslateError] = useState<string | null>(null);
  const [autoTranslateResult, setAutoTranslateResult] = useState<{
    successRate: number;
    duration: number;
    deliverables: number;
    errors: number;
    engine: string;
    targetLang: string;
    stringsTranslated: number;
    stringsTotal: number;
    /**
     * Verifica dell'EFFETTO (post-translation-truth): il gioco è stato
     * cambiato davvero? La prova è il contatore del patcher (`stringsWritten`),
     * non l'esistenza dei file — vedi la correzione del 29/07/2026 nel punto
     * in cui questo oggetto viene costruito. Il verde si dichiara solo se
     * verified > 0; altrimenti il wizard mostra un avviso.
     */
    verification?: {
      checked: number;      // deliverable che pretendono di aver cambiato il gioco
      verified: number;     // quanti reggono alla controprova
      missing: string[];    // percorsi dichiarati ma assenti
      verifiedNames: string[]; // nomi confermati (da mostrare all'utente)
      stringsWritten: number;  // stringhe realmente scritte nei file del gioco
      runtimeOnly: boolean;    // traduzione a runtime (BepInEx): niente da scrivere
    };
  } | null>(null);

  // Pre-computed translation strategy (populated on page load)
  const [translationStrategy, setTranslationStrategy] = useState<{
    engine: string;
    method: 'unity' | 'unreal' | 'gamemaker' | 'visionaire' | 'tyranoscript' | 'rpgmaker' | 'wolfrpg' | 'renpy' | 'godot' | 'hendrix' | 'generic';
    detail: string;
    fileCount: number;
    stringCount: number;
    ready: boolean;
  } | null>(null);
  const strategyComputedRef = useRef<string | null>(null);

  // Motore AI per la pipeline Ren'Py: cloud (chiavi API delle Impostazioni)
  // oppure Ollama locale. Fino all'08/08/2026 questa scelta esisteva SOLO come
  // chiave localStorage senza UI, e infatti la run notturna su Scarlet Hollow è
  // finita sul locale mentre credevamo di usare il cloud. Si legge dopo il
  // mount (localStorage non esiste in SSR) e si passa SEMPRE esplicita a
  // runRenpyTranslation, così il pulsante e il codice non possono divergere.
  const [renpyBackend, setRenpyBackend] = useState<TranslationBackend>('ollama');
  useEffect(() => { setRenpyBackend(getTranslationBackend('renpy')); }, []);
  const changeRenpyBackend = (v: TranslationBackend) => {
    setRenpyBackend(v);
    setTranslationBackend('renpy', v);
  };

  // Lotto di prova: traduce poche stringhe ma genera comunque i file tl/, così
  // si VEDE il risultato in gioco prima di impegnare un copione intero (su
  // Scarlet Hollow: 83.489 stringhe, ~4M token). Volutamente NON persistito —
  // se restasse acceso tra un avvio e l'altro, qualcuno crederebbe di aver
  // tradotto tutto il gioco avendone tradotto duecento righe.
  const RENPY_TEST_BATCH_SIZE = 200;
  const [renpyTestBatch, setRenpyTestBatch] = useState(false);

  // Migliora con AI — traduce le stringhe catturate da XUnity con Ollama
  const [isAiUpgrading, setIsAiUpgrading] = useState(false);
  const [aiUpgradeProgress, setAiUpgradeProgress] = useState<{current: number, total: number} | null>(null);

  // UABEA — Unity Assets panel
  const [uabeaStatus, setUabeaStatus] = useState<{installed: boolean; path?: string} | null>(null);
  const [assetsFiles, setAssetsFiles] = useState<{file_name: string; path: string; size_bytes: number}[]>([]);
  const [isDownloadingUabea, setIsDownloadingUabea] = useState(false);
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);

  // Game Update Tracker
  const [updateStatus, setUpdateStatus] = useState<{
    current_build_id: string;
    known_build_id: string;
    update_detected: boolean;
    patch_intact: boolean;
    patch_type: string;
    patch_details: string[];
    message: string;
  } | null>(null);
  const [isDismissingUpdate, setIsDismissingUpdate] = useState(false);
  const [isUntrackingGame, setIsUntrackingGame] = useState(false);
  
  // P.T. confirmation dialog
  const [ptConfirmDialog, setPtConfirmDialog] = useState<{
    open: boolean;
    expired: boolean;
    ageHours: number;
    ptUrl: string;
  }>({ open: false, expired: false, ageHours: 0, ptUrl: '' });
  
  // Ref guards per StrictMode — traccia quale gameId è stato caricato
  const gameDataLoadedRef = useRef<string | null>(null);
  const sideEffectsRunRef = useRef<string | null>(null);

  // Unreal Engine Patcher
  const [_unrealPatchStatus, setUnrealPatchStatus] = useState<{
    installed: boolean;
    version: string;
    target_language: string;
    translations_count: number;
    last_used: string | null;
  } | null>(null);

  // Client-side engine detection fallback (nome gioco → engine)
  const detectEngineByName = (name: string): string | null => {
    const n = name.toLowerCase();
    const db: [string[], string][] = [
      // FromSoftware (prima per evitare falsi positivi)
      [['elden ring','dark souls','sekiro','bloodborne','armored core vi','armored core 6',"demon's souls"], 'FromSoftware Engine'],
      [['nier automata','nier replicant','bayonetta','metal gear rising','astral chain','vanquish'], 'Platinum Engine'],
      [['grand theft auto','gta v','gta iv','red dead redemption','max payne 3'], 'RAGE Engine'],
      [['call of duty','warzone','modern warfare','black ops','vanguard'], 'IW Engine'],
      [['hitman','world of assassination'], 'Glacier Engine'],
      [['dying light','dead island','call of juarez'], 'C-Engine (Techland)'],
      [['final fantasy xv','forspoken'], 'Luminous Engine'],
      [['dishonored 2','deathloop'], 'Void Engine'],
      [['resident evil village','resident evil 4 remake','resident evil 2 remake','devil may cry 5','monster hunter rise','monster hunter wilds','street fighter 6'], 'RE Engine'],
      [['resident evil 5','resident evil 6',"dragon's dogma",'monster hunter world','devil may cry 4'], 'MT Framework'],
      [["assassin's creed",'watch dogs','for honor','prince of persia'], 'Anvil Engine'],
      [['horizon zero dawn','horizon forbidden west','death stranding'], 'Decima'],
      [['metal gear solid v','pro evolution soccer'], 'FOX Engine'],
      [['the division','mario + rabbids','star wars outlaws'], 'Snowdrop'],
      // Grandi engine
      [['hollow knight','cuphead','subnautica','valheim','among us','fall guys','phasmophobia','lethal company','rimworld','slay the spire','cult of the lamb','vampire survivors','beat saber','escape from tarkov','cities skylines','kerbal space program','ori and','7 days to die','outer wilds','inscryption','balatro','ultrakill','ghostrunner','dredge','dave the diver','tarkov','genshin impact','dead cells','enter the gungeon','risk of rain','spiritfarer','tunic','unpacking'], 'Unity'],
      [['fortnite','borderlands','bioshock','rocket league','dead by daylight','ark survival','pubg','deep rock galactic','hogwarts legacy','black myth wukong','lies of p','satisfactory','stray','sifu','valorant','ready or not','the finals','palworld','tekken','guilty gear strive','final fantasy vii remake','tales of arise','kingdom hearts 3','outlast','sons of the forest'], 'Unreal Engine'],
      [['half-life: alyx','dota 2','counter-strike 2','deadlock'], 'Source 2'],
      [['half-life 2','counter-strike','portal','team fortress 2','left 4 dead',"garry's mod",'the stanley parable','apex legends'], 'Source Engine'],
      [['fallout 4','fallout 76','skyrim','starfield'], 'Creation Engine'],
      [['battlefield','need for speed','fifa','ea sports fc','star wars battlefront','dead space remake','dragon age'], 'Frostbite'],
      [['crysis','hunt showdown','kingdom come deliverance','star citizen'], 'CryEngine'],
      [['cyberpunk 2077','witcher 3'], 'REDengine'],
      [['doom','quake','wolfenstein','evil within'], 'id Tech'],
      [['celeste','stardew valley','terraria','hades','bastion','transistor','fez'], 'MonoGame/FNA'],
      [['undertale','deltarune','hyper light drifter','hotline miami','katana zero','decarnation'], 'GameMaker'],
      [['omori','to the moon','oneshot','corpse party','yume nikki','lisa the painful'], 'RPG Maker'],
      [['doki doki literature club','ddlc','va-11 hall-a','katawa shoujo'], "Ren'Py"],
      [['cassette beasts','brotato','dome keeper'], 'Godot'],
      [['metro exodus','metro last light','metro 2033'], '4A Engine'],
    ];
    for (const [names, engine] of db) {
      if (names.some(g => n.includes(g))) return engine;
    }
    return null;
  };

  // Rileva motore quando il gioco è caricato
  const detectEngine = async () => {
    if (!game) return;
    
    setIsDetectingEngine(true);
    try {
      const result = await invoke<{
        engine: string;
        can_patch: boolean;
        patch_tool: string | null;
        patch_description: string | null;
      }>('detect_engine_for_game', {
        gameName: game.name || game.title,
        installPath: game.installPath || null
      });
      setEngineInfo(result);
      setGame(prev => prev ? { ...prev, engine: result.engine } : null);
    } catch {
      // Fallback client-side: detection per nome
      const gameName = game.name || game.title;
      const fallbackEngine = detectEngineByName(gameName);
      if (fallbackEngine) {
        setEngineInfo({
          engine: fallbackEngine,
          can_patch: false,
          patch_tool: null,
          patch_description: null,
        });
        setGame(prev => prev ? { ...prev, engine: fallbackEngine } : null);
      }
    } finally {
      setIsDetectingEngine(false);
    }
  };

  // Rileva le lingue supportate dal gioco analizzandone i file di localizzazione.
  useEffect(() => {
    const path = game?.installPath;
    if (!path) { setDetectedLanguages([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const langs = await invoke<string[]>('detect_languages_from_files', { gamePath: path });
        if (!cancelled) setDetectedLanguages(Array.isArray(langs) ? langs : []);
      } catch (e: unknown) {
        if (!cancelled) clientLogger.debug('[LangScan] rilevamento lingue da file fallito:', String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [game?.installPath]);

  // Pre-compute translation strategy on page load (engine + files + method)
  const computeTranslationStrategy = async () => {
    if (!game?.installPath) return;
    const gameKey = game.id || game.appid?.toString() || gameId;
    if (strategyComputedRef.current === gameKey) return;
    strategyComputedRef.current = gameKey;

    const detectedEngine = game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '';
    const eng = detectedEngine.toLowerCase();

    try {
      if (eng.includes('hendrix')) {
        // Hendrix_Localization: RPG Maker MV/MZ con game_messages.csv (colonna lingua)
        try {
          const h = await invoke<{ languages?: string[]; unique_strings?: number; plugin_enabled?: boolean }>('detect_hendrix_game', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'Hendrix Localization',
            method: 'hendrix',
            detail: `game_messages.csv — ${h?.unique_strings ?? 0} stringhe uniche${h?.plugin_enabled ? '' : ' (plugin da abilitare)'}`,
            fileCount: 1,
            stringCount: h?.unique_strings || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Hendrix Localization', method: 'hendrix', detail: 'Hendrix Localization rilevato', fileCount: 1, stringCount: 0, ready: true });
        }
      } else if (eng.includes('gamemaker') || eng.includes('game maker')) {
        // GameMaker: check for .jn files or data.win
        try {
          const gmInfo = await invoke<{has_language_files?: boolean; language_file_count?: number; translatable_strings?: number; is_yyc?: boolean; string_source?: string}>('gm_scan_data_win', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'GameMaker',
            method: 'gamemaker',
            // "coppie lang/*.json" per la fonte JSON (Deltarune-style), ".jn" per Undertale-style
            detail: gmInfo?.has_language_files
              ? `${gmInfo.language_file_count} ${gmInfo.string_source === 'language_json' ? 'coppie lang/*.json' : 'file .jn'} — ${gmInfo.translatable_strings} stringhe`
              : gmInfo?.is_yyc
                ? `YYC EXE — ${gmInfo.translatable_strings} stringhe`
                : `data.win — ${gmInfo.translatable_strings} stringhe`,
            fileCount: gmInfo?.language_file_count || 1,
            stringCount: gmInfo?.translatable_strings || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'GameMaker', method: 'gamemaker', detail: 'GameMaker rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('unity')) {
        setTranslationStrategy({ engine: detectedEngine, method: 'unity', detail: 'BepInEx + XUnity AutoTranslator', fileCount: 0, stringCount: 0, ready: true });
      } else if (eng.includes('unreal')) {
        try {
          const locStatus = await invoke<{has_gs_pak?: boolean; translated_entries?: number; has_locres?: boolean; locres_count?: number; total_entries?: number}>('get_unreal_localization_status', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine,
            method: 'unreal',
            detail: locStatus?.has_gs_pak ? `Patch attiva — ${locStatus.translated_entries} stringhe` : locStatus?.has_locres ? `.locres trovati — traduzione AI disponibile` : 'Unreal Engine rilevato',
            fileCount: locStatus?.locres_count || 0,
            stringCount: locStatus?.total_entries || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine, method: 'unreal', detail: 'Unreal Engine rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('visionaire')) {
        try {
          const visInfo = await invoke<{total_strings?: number; version?: string; file_count?: number}>('scan_vis_strings', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'Visionaire Studio',
            method: 'visionaire',
            detail: (visInfo?.total_strings ?? 0) > 0
              ? `${visInfo?.version} — ${visInfo?.total_strings} stringhe in game.veb`
              : `${visInfo?.version || 'VIS5'} — scansione al click`,
            fileCount: visInfo?.file_count || 0,
            stringCount: visInfo?.total_strings || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Visionaire Studio', method: 'visionaire', detail: 'Visionaire rilevato — scansione al click', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('tyrano') || eng.includes('nw.js') || eng.includes('electron')) {
        // TyranoScript / NW.js / Electron: detect app.asar or app/ folder
        try {
          const tyranoInfo = await invoke<{ total_strings?: number; script_files?: string[]; engine_variant?: string }>('detect_tyrano_game', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'TyranoScript',
            method: 'tyranoscript',
            detail: (tyranoInfo?.total_strings ?? 0) > 0
              ? `${tyranoInfo.script_files?.length || 0} file .ks — ${tyranoInfo.total_strings} stringhe`
              : `${tyranoInfo?.engine_variant || 'TyranoScript'} — ${tyranoInfo?.script_files?.length || 0} file .ks`,
            fileCount: tyranoInfo?.script_files?.length || 0,
            stringCount: tyranoInfo?.total_strings || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'TyranoScript', method: 'tyranoscript', detail: 'TyranoScript/NW.js rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('rpg maker') || eng.includes('rpgmaker')) {
        // RPG Maker MV/MZ: JSON-based data files
        try {
          const rpgInfo = await invoke<{ version?: string; data_files?: string[] }>('detect_rpgmaker_game', { gamePath: game.installPath });
          const extraction = await invoke<{ total_count?: number }>('extract_all_rpgmaker_strings', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || `RPG Maker ${rpgInfo?.version || ''}`.trim(),
            method: 'rpgmaker',
            detail: `${rpgInfo?.version || 'MV/MZ'} — ${rpgInfo?.data_files?.length || 0} file, ${extraction?.total_count || 0} stringhe`,
            fileCount: rpgInfo?.data_files?.length || 0,
            stringCount: extraction?.total_count || 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'RPG Maker', method: 'rpgmaker', detail: 'RPG Maker rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('wolf') && eng.includes('rpg')) {
        // Wolf RPG Editor
        try {
          const wolfInfo = await invoke<{ encrypted?: boolean; data_files?: string[] }>('detect_wolfrpg_game', { gamePath: game.installPath });
          setTranslationStrategy({
            engine: detectedEngine || 'Wolf RPG',
            method: 'wolfrpg',
            detail: wolfInfo?.encrypted
              ? `Wolf RPG — criptato (${wolfInfo?.data_files?.length || 0} file)`
              : `Wolf RPG — ${wolfInfo?.data_files?.length || 0} file dati`,
            fileCount: wolfInfo?.data_files?.length || 0,
            stringCount: 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Wolf RPG', method: 'wolfrpg', detail: 'Wolf RPG rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('ren\'py') || eng.includes('renpy')) {
        // Ren'Py: .rpy script files
        try {
          const scannedFiles = await invoke<string[]>('scan_game_files', { gamePath: game.installPath });
          const rpyFiles = (scannedFiles || []).filter(f => f.toLowerCase().endsWith('.rpy'));
          setTranslationStrategy({
            engine: detectedEngine || "Ren'Py",
            method: 'renpy',
            detail: rpyFiles.length > 0 ? `${rpyFiles.length} file .rpy traducibili` : "Ren'Py rilevato",
            fileCount: rpyFiles.length,
            stringCount: 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || "Ren'Py", method: 'renpy', detail: "Ren'Py rilevato", fileCount: 0, stringCount: 0, ready: true });
        }
      } else if (eng.includes('godot')) {
        // Godot: .tres/.tscn/.translation files
        try {
          const scannedFiles = await invoke<string[]>('scan_game_files', { gamePath: game.installPath });
          const godotFiles = (scannedFiles || []).filter(f => {
            const l = f.toLowerCase();
            return l.endsWith('.tres') || l.endsWith('.tscn') || l.endsWith('.translation') || l.endsWith('.csv');
          });
          setTranslationStrategy({
            engine: detectedEngine || 'Godot',
            method: 'godot',
            detail: godotFiles.length > 0 ? `${godotFiles.length} file traducibili` : 'Godot rilevato',
            fileCount: godotFiles.length,
            stringCount: 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Godot', method: 'godot', detail: 'Godot rilevato', fileCount: 0, stringCount: 0, ready: true });
        }
      } else {
        // Generic: scan for text files
        try {
          const scannedFiles = await invoke<string[]>('scan_game_files', { gamePath: game.installPath });
          const textExts = ['.json', '.csv', '.txt', '.xml', '.po', '.yaml', '.yml', '.ini', '.cfg', '.lang', '.loc', '.strings', '.jn'];
          const textFiles = (scannedFiles || []).filter(f => textExts.some(ext => f.toLowerCase().endsWith(ext)));
          setTranslationStrategy({
            engine: detectedEngine || 'Sconosciuto',
            method: 'generic',
            detail: textFiles.length > 0 ? `${textFiles.length} file di testo traducibili` : 'Scansione file al click',
            fileCount: textFiles.length,
            stringCount: 0,
            ready: true,
          });
        } catch {
          setTranslationStrategy({ engine: detectedEngine || 'Sconosciuto', method: 'generic', detail: 'Traduzione diretta AI', fileCount: 0, stringCount: 0, ready: true });
        }
      }
    } catch {
      setTranslationStrategy({ engine: detectedEngine || 'Sconosciuto', method: 'generic', detail: 'Pronto per traduzione', fileCount: 0, stringCount: 0, ready: true });
    }
  };

  const handleInstallUnityPatch = async (useLocalOllama = false) => {
    if (!game) return;
    
    setIsInstallingPatch(true);
    setPatchStatus(null);
    
    try {
      
      // Trova il path di installazione se non presente
      let installPath = game.installPath;
      if (!installPath) {
        try {
          installPath = await invoke<string>('find_game_install_path', {
            installDir: game.install_dir || game.name || game.title
          });
        } catch (e: unknown) {
          clientLogger.error('Impossibile trovare cartella gioco:', String(e));
          setPatchStatus({ success: false, message: 'Cartella del gioco non trovata' });
          setIsInstallingPatch(false);
          return false;
        }
      }
      
      // Cerca l'eseguibile principale nella cartella
      let exeName = game.detectedFiles?.find((f: string) => f.endsWith('.exe'));
      clientLogger.debug('[Patch] detectedFiles exe:', String(exeName));
      if (!exeName) {
        try {
          const exeList = await invoke<string[]>('find_executables_in_folder', { folderPath: installPath });
          clientLogger.debug('[Patch] exeList trovati:', String(exeList));
          if (exeList && exeList.length > 0) {
            exeName = exeList[0];
          }
        } catch (e: unknown) {
          clientLogger.warn('[Patch] Impossibile trovare eseguibili, uso nome gioco:', String(e));
        }
      }
      // Fallback al nome del gioco
      if (!exeName) {
        exeName = `${(game.name || game.title || 'Game').replace(/[^a-zA-Z0-9]/g, '')}.exe`;
      }
      
      clientLogger.debug('[Patch] Installazione con:', `gamePath=${installPath}, gameExeName=${exeName}`);

      // Opzione: motore di traduzione locale via Ollama (bridge HTTP ↔ XUnity CustomTranslate)
      let bridgeUrl: string | null = null;
      if (useLocalOllama) {
        try {
          const bridge = await invoke<{ url: string; port: number }>('start_xunity_bridge', {
            port: null,
            model: 'huihui_ai/hy-mt1.5-abliterated:1.8b',
          });
          bridgeUrl = bridge.url;
          clientLogger.debug('[Patch] bridge Ollama avviato:', bridge.url);
        } catch (e: unknown) {
          clientLogger.warn('[Patch] bridge Ollama non avviato, uso Google:', String(e));
        }
      }

      clientLogger.debug('[Patch] Chiamata install_unity_autotranslator...');

      const result = await invoke<{success: boolean; message: string}>('install_unity_autotranslator', {
        gamePath: installPath,
        gameExeName: exeName,
        // Fix issue #47: usa la lingua scelta dall'utente, non 'it' hardcoded
        targetLang: targetLang || language || 'it',
        translationMode: 'google' // seed valido; se Ollama locale ripuntiamo l'endpoint dopo
      });

      clientLogger.debug('[Patch] Risultato:', String(result));

      setPatchStatus({
        success: result.success,
        message: result.message
      });

      if (result.success) {
        clientLogger.debug('[Patch] Installazione completata con successo!');
        // Se richiesto, ripunta XUnity sul bridge Ollama locale (Endpoint=CustomTranslate)
        if (useLocalOllama && bridgeUrl) {
          try {
            await invoke('set_xunity_custom_endpoint', { gamePath: installPath, url: bridgeUrl });
            clientLogger.debug('[Patch] XUnity puntato sul bridge Ollama locale');
          } catch (e: unknown) {
            clientLogger.warn('[Patch] set_xunity_custom_endpoint fallito:', String(e));
          }
        }
        // Traccia attività
        await activityHistory.trackPatch(
          game.name || game.title,
          game.appid?.toString(),
          'Unity AutoTranslator (BepInEx)'
        );
        // Refresh game detected files to see new BepInEx files
        scanGameFiles();
      }
      return result.success;
    } catch (error: unknown) {
      clientLogger.error('Errore installazione patch:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore sconosciuto durante l\'installazione'
      });
      return false;
    } finally {
      setIsInstallingPatch(false);
    }
  };

  const _handleUninstallUnityPatch = async () => {
    if (!game?.installPath) return;

    if (!confirm(t('gameDetail.confirmRemoveUnity'))) return;
    
    setIsInstallingPatch(true);
    try {
      const result = await invoke<{success: boolean, message: string}>('remove_unity_patch', {
        gamePath: game.installPath
      });
      
      setPatchStatus(result);
    } catch (error: unknown) {
      clientLogger.error('Errore rimozione patch Unity:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante la rimozione'
      });
    } finally {
      setIsInstallingPatch(false);
    }
  };

  // === COMMUNITY TRANSLATIONS (gamestranslator.it) ===
  const [communityTranslations, setCommunityTranslations] = useState<Array<{
    id: string; title: string; author: string; state: string; revision: string;
    version: string; steam_app_id: string | null; page_url: string; download_url: string; updated_at: string;
  }>>([]);
  const [communitySearchDone, setCommunitySearchDone] = useState(false);
  const [isInstallingCommunityZip, setIsInstallingCommunityZip] = useState(false);

  const searchCommunityTranslations = async () => {
    if (!game?.title || communitySearchDone) return;
    setCommunitySearchDone(true);
    try {
      const results = await invoke<Array<{
        id: string; title: string; author: string; state: string; revision: string;
        version: string; steam_app_id: string | null; page_url: string; download_url: string; updated_at: string;
      }>>('search_gamestranslator', {
        gameName: game.title,
        steamAppId: game.appid && game.appid > 0 ? String(game.appid) : null,
      });
      if (results?.length) setCommunityTranslations(results);
    } catch (e: unknown) { clientLogger.warn('[GT.it]', String(e)); }
  };

  const installCommunityZip = async () => {
    setIsInstallingCommunityZip(true);
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        title: 'Seleziona il file ZIP della traduzione',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        multiple: false,
      }) as string | null;
      if (!selected) return;

      const engine = game?.engine?.toLowerCase().includes('unreal') ? 'unreal'
        : game?.engine?.toLowerCase().includes('unity') ? 'unity' : 'auto';

      const result = await invoke<{message: string; installed?: string[]}>('install_translation_from_zip', {
        zipPath: selected,
        gamePath: game?.installPath || '',
        engine,
      });
      toast.success(`${result.message} (${result.installed?.length || 0} file)`);
      // Ricarica stato patch dopo installazione
      await loadUpdateStatus();
    } catch (e: unknown) {
      toast.error(typeof e === 'string' ? e : 'Installazione fallita');
    } finally { setIsInstallingCommunityZip(false); }
  };

  // === GAME UPDATE TRACKER ===
  const loadUpdateStatus = async () => {
    if (!game?.installPath || !game?.appid || game.appid <= 0) return;
    try {
      const result = await invoke<{
        current_build_id: string; known_build_id: string; update_detected: boolean;
        patch_intact: boolean; patch_type: string; patch_details: string[]; message: string;
      }>('check_game_update', {
        appId: String(game.appid),
        gamePath: game.installPath,
      });
      setUpdateStatus(result);
      // Prima visita: salva subito il buildid senza mostrare alert
      if (result && !result.known_build_id && result.current_build_id !== 'unknown') {
        await invoke('acknowledge_game_update', {
          appId: String(game.appid),
          buildId: result.current_build_id,
          patchIntact: result.patch_intact,
        });
        setUpdateStatus(prev => prev ? { ...prev, update_detected: false } : prev);
      }
    } catch (e: unknown) { clientLogger.warn('[UpdateTracker]', String(e)); }
  };

  const dismissUpdate = async () => {
    if (!game?.appid || !updateStatus) return;
    setIsDismissingUpdate(true);
    try {
      await invoke('acknowledge_game_update', {
        appId: String(game.appid),
        buildId: updateStatus.current_build_id,
        patchIntact: updateStatus.patch_intact,
      });
      setUpdateStatus(prev => prev ? { ...prev, update_detected: false, known_build_id: prev.current_build_id } : prev);
    } catch (e: unknown) { clientLogger.warn('[UpdateTracker] dismiss:', String(e)); }
    finally { setIsDismissingUpdate(false); }
  };

  const untrackGame = async () => {
    if (!game?.appid) return;
    setIsUntrackingGame(true);
    try {
      await invoke<boolean>('remove_tracked_game', { appId: String(game.appid) });
      setUpdateStatus(null);
      toast.success(t('common.monitoraggioDisattivatoPerQuestoGioco'));
    } catch (e: unknown) {
      clientLogger.warn('[UpdateTracker] untrack:', String(e));
      toast.error(t('common.impossibileDisattivareIlMonitoraggio'));
    } finally {
      setIsUntrackingGame(false);
    }
  };

  // === UNREAL ENGINE LOCALIZATION STATE ===
  const [ueLocStatus, setUeLocStatus] = useState<{
    has_locres: boolean;
    has_gs_pak: boolean;
    gs_pak_path?: string;
    translated_entries: number;
    paks_dir?: string;
    message: string;
  } | null>(null);
  const [isUeAiUpgrading, setIsUeAiUpgrading] = useState(false);
  const [ueAiProgress, setUeAiProgress] = useState<{current: number; total: number} | null>(null);
  const [showUeLocPanel, setShowUeLocPanel] = useState(false);

  const loadUeLocStatus = async () => {
    if (!game?.installPath) return;
    try {
      const s = await invoke<{
        has_locres: boolean; has_gs_pak: boolean; gs_pak_path?: string;
        translated_entries: number; paks_dir?: string; message: string;
      }>('get_unreal_localization_status', { gamePath: game.installPath });
      setUeLocStatus(s);
    } catch (e: unknown) { clientLogger.warn('[UE] localization status:', String(e)); }
  };

  // Migliora con AI per giochi Unreal: extract → Ollama batch → _P.pak
  const upgradeUEWithAI = async () => {
    if (!game?.installPath || isUeAiUpgrading) return;
    setIsUeAiUpgrading(true);
    setUeAiProgress(null);

    try {
      // targetLang PRIMA di language: `language` è la lingua della UI, non quella
      // scelta col selettore bandierina accanto a String it!. Usando `language`
      // il picker non aveva effetto sulla traduzione Unreal — il gioco veniva
      // tradotto nella lingua dell'interfaccia qualunque cosa scegliesse l'utente.
      const lang = targetLang || language || 'it';
      const _gameName = game.title || game.name || 'Game';

      // 1. Estrai stringhe di localizzazione dal gioco.
      // PRIMA dal container IoStore (.utoc/.ucas, decompressione Oodle): è lì che
      // i giochi UE5 moderni tengono il Game.locres. SOLO se è vuoto/assente si
      // ripiega sui .locres sciolti su disco (extract_unreal_localization), che
      // per un gioco IoStore trova al più qualche .locres di sistema (12 sul gioco di collaudo).
      toast.info(t('common.estrazioneStringheDiLocalizzazioneUnreal'));
      interface UeEntry { namespace: string; key: string; source_hash: string; value: string; }
      let extracted = await invoke<{entries?: UeEntry[]}>('extract_iostore_localization', { gamePath: game.installPath })
        .catch((err) => { clientLogger.warn('[UE AI] IoStore non disponibile, fallback su disco:', String(err)); return null; });

      if (!extracted?.entries?.length) {
        extracted = await invoke<{entries?: UeEntry[]}>('extract_unreal_localization', { gamePath: game.installPath })
          .catch((err) => { clientLogger.error('[UE AI] estrazione da disco fallita:', String(err)); return null; });
      }

      if (!extracted?.entries?.length) {
        toast.error(t('gameDetail.errNoLocStrings'));
        return;
      }

      const entries = extracted.entries;
      const toTranslate = entries.filter(e => e.value && e.value.trim().length > 0);
      const total = toTranslate.length;
      setUeAiProgress({ current: 0, total });

      toast.info(`Trovate ${total} stringhe — traduzione AI in corso...`);

      // 2. Traduci in batch da 15 con la CATENA COMPLETA (translateWithFallback).
      //
      // ⚠️ Prima del 04/08/2026 sera qui girava `traduciConSplit`, che chiama
      // `translate_text_simple`: un solo provider, testi uniti da un separatore
      // e rispezzati. Tre difetti, tutti silenziosi:
      //  1. NIENTE placeholder guard — {variabili}, tag e soprattutto gli A CAPO
      //     reali si perdevano (è il difetto misurato su Greed: 169 → 45), e il
      //     testo usciva dallo schermo;
      //  2. niente catena di fallback: se il provider inciampa, stringa persa;
      //  3. il join/split è fragile proprio sui testi multiriga, cioè i dialoghi.
      // translateWithFallback passa da reflection + autoFixPlaceholders, quindi
      // String it! su Unreal ha ora la stessa qualità del percorso "Traduci Tutto".
      const BATCH = 15;
      const translated: {namespace: string; key: string; source_hash: string; original: string; translated: string}[] = [];
      let falliti = 0;

      for (let i = 0; i < toTranslate.length; i += BATCH) {
        const batch = toTranslate.slice(i, i + BATCH);
        let parts: (string | null)[] = [];
        try {
          const res = await translateWithFallback({
            texts: batch.map(e => e.value),
            targetLanguage: lang,
            sourceLanguage: 'en',
            gameId: game.id || game.appid?.toString() || gameId,
          });
          parts = res?.translations || [];
        } catch (err: unknown) {
          clientLogger.error(`[UE AI] batch ${i}: ${String(err)}`);
        }
        batch.forEach((e, idx) => {
          const tr = parts[idx];
          // Una traduzione identica all'originale NON è una traduzione: contala
          // come fallita, così il conteggio finale resta onesto.
          if (!tr || tr === e.value) falliti++;
          translated.push({
            namespace: e.namespace,
            key: e.key,
            source_hash: e.source_hash,
            original: e.value,
            translated: tr || e.value,
          });
        });
        setUeAiProgress({ current: Math.min(i + BATCH, total), total });
      }

      // ═══ PROVA DI EFFETTO — prima di impacchettare ═══
      // Una patch identica all'originale si installa benissimo e lascia il gioco
      // in lingua originale, senza un errore: è il fallimento muto. Qui si conta
      // quante stringhe sono DAVVERO cambiate e, se sono troppo poche, si rifiuta
      // di creare il .pak invece di dichiarare un successo che non c'è.
      const cambiate = translated.filter(e => e.translated !== e.original).length;
      if (cambiate === 0) {
        const msg = t('gameDetail.errNoTranslationEffect');
        clientLogger.error(`[UE AI] 0 stringhe cambiate su ${translated.length} (${falliti} fallite): pak NON creato`);
        toast.error(msg, { description: `0/${translated.length} — ${falliti} ${t('common.failed')}` });
        return;
      }
      if (falliti > 0) {
        toast.warning(`${cambiate}/${translated.length} ${t('gameDetail.stringsTranslated')} — ${falliti} ${t('common.failed')}`);
      }

      // 3. Crea _P.pak con traduzioni
      const result = await invoke<{message?: string}>('auto_translate_unreal', {
        gamePath: game.installPath,
        translations: translated,
        targetLanguage: lang,
      });

      // 4. La patch non deve nascere e morire nella cartella del gioco
      //    (patch-lifecycle, 04/08/2026): sessione su disco per i re-apply e il
      //    backfill, progetto registrato, stringhe persistite per l'export.
      //    Stesso corredo del percorso "Traduci Tutto". Fail-open: la patch
      //    esiste già, un intoppo qui si logga e basta.
      try {
        const cambiateList = translated.filter(e => e.translated !== e.original);
        await invoke('ensure_directory', { path: `${game.installPath}/GameStringer` });
        await invoke('write_text_file', {
          path: `${game.installPath}/GameStringer/translation_session.json`,
          content: JSON.stringify({
            gameName: game.title || game.name || '',
            gameId: game.id || game.appid?.toString() || gameId || '',
            gamePath: game.installPath,
            sourceLanguage: 'en',
            targetLanguage: lang,
            provider: 'string-it',
            createdAt: new Date().toISOString(),
            totalStrings: translated.length,
            entries: translated.map(e => ({
              namespace: e.namespace,
              key: e.key,
              source_hash: e.source_hash,
              original: e.original,
              translated: e.translated,
            })),
          }, null, 2),
        });

        const pathKey = gamePathKey(game.installPath);
        const proj = await projectService.createOrGetProject({
          gameId: game.id || game.appid?.toString() || gameId || pathKey,
          gameName: game.title || game.name || pathKey,
          gameImage: game.headerImage || game.coverUrl,
          engine: 'Unreal Engine',
          sourceLanguage: 'en',
          targetLanguage: lang,
          gamePathKey: pathKey,
          files: [{ path: game.installPath, name: 'translation_session', type: 'unreal', strings: translated.length }],
        });
        proj.totalStrings = Math.max(proj.totalStrings || 0, translated.length);
        proj.translatedStrings = Math.max(proj.translatedStrings || 0, cambiateList.length);
        proj.progress = proj.totalStrings > 0
          ? Math.min(100, Math.round((proj.translatedStrings / proj.totalStrings) * 100))
          : proj.progress;
        await projectService.saveProject(proj);

        await invoke('save_translation_strings', {
          strings: {
            gameId: proj.gameId,
            sourceLanguage: 'en',
            targetLanguage: lang,
            exportedAt: new Date().toISOString(),
            entries: translated.map(e => ({
              key: e.namespace ? `${e.namespace}::${e.key}` : e.key,
              source: e.original,
              target: e.translated,
              filePath: null,
              context: e.namespace || null,
              status: e.translated !== e.original ? 'translated' : 'pending',
            })),
          },
        });
      } catch (regErr: unknown) {
        clientLogger.warn(`[UE AI] registrazione progetto/sessione fallita: ${String(regErr)}`);
      }

      await loadUeLocStatus();
      toast.success(`✅ ${result?.message || `PAK creato con ${translated.filter(e => e.translated !== e.original).length} stringhe`}`);

    } catch (e: unknown) {
      clientLogger.error('[UE AI]', String(e));
      toast.error(`Errore traduzione UE: ${String(e) || 'sconosciuto'}`);
    } finally {
      setIsUeAiUpgrading(false);
      setUeAiProgress(null);
    }
  };

  // === UNREAL ENGINE PATCHER FUNCTIONS ===
  
  const loadUnrealPatchStatus = async () => {
    if (!game?.installPath) return;
    try {
      const status = await invoke<{
        installed: boolean;
        version: string;
        target_language: string;
        translations_count: number;
        last_used: string | null;
      }>('get_unreal_patch_status', { gamePath: game.installPath });
      setUnrealPatchStatus(status);
    } catch (error: unknown) {
      clientLogger.error('Errore caricamento stato patch Unreal:', String(error));
    }
  };

  const handleInstallUnrealPatch = async () => {
    if (!game?.installPath) return;
    
    setIsInstallingPatch(true);
    setPatchStatus(null);
    
    try {
      const result = await invoke<string>('install_unreal_patch', {
        gamePath: game.installPath,
        config: {
          target_language: 'it',
          source_language: 'en',
          translation_service: 'google',
          cache_enabled: true,
          auto_translate: true
        }
      });
      
      setPatchStatus({ success: true, message: result });
      // Traccia attività
      await activityHistory.trackPatch(
        game.name || game.title,
        game.appid?.toString(),
        'Unreal Engine Translator'
      );
      await loadUnrealPatchStatus();
    } catch (error: unknown) {
      clientLogger.error('Errore installazione patch Unreal:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante l\'installazione'
      });
    } finally {
      setIsInstallingPatch(false);
    }
  };

  const _handleUninstallUnrealPatch = async () => {
    if (!game?.installPath) return;
    
    if (!confirm(t('gameDetail.confirmRemoveTranslation'))) return;
    
    try {
      const result = await invoke<string>('uninstall_unreal_patch', {
        gamePath: game.installPath
      });
      
      setPatchStatus({ success: true, message: result });
      setUnrealPatchStatus(null);
    } catch (error: unknown) {
      clientLogger.error('Errore rimozione patch Unreal:', String(error));
      setPatchStatus({
        success: false,
        message: typeof error === 'string' ? error : 'Errore durante la rimozione'
      });
    }
  };

  const _handleLaunchWithTranslator = async () => {
    if (!game?.installPath) return;
    
    try {
      
      // Trova l'eseguibile
      const gameInfo = await invoke<{ executable: string }>('detect_unreal_game', {
        gamePath: game.installPath
      });
      
      const esito = await invoke<string>('launch_with_translator', {
        gamePath: game.installPath,
        executable: gameInfo.executable
      });

      // Traccia avvio gioco
      await activityHistory.trackGameLaunch(
        game.name || game.title,
        game.appid?.toString()
      );

      // Il backend distingue i casi: l'injection per Unreal non è implementata,
      // quindi il gioco parte in lingua originale. Dire «avviato con
      // traduttore!» era falso (corretto il 29/07/2026).
      const senzaTraduttore = String(esito).includes('TRANSLATOR_NON_ATTIVO');
      setPatchStatus({
        success: !senzaTraduttore,
        message: senzaTraduttore
          ? t('unrealWizard.translatorNotActive')
          : t('unrealWizard.launchedWithTranslator'),
      });
    } catch (error: unknown) {
      clientLogger.error('Errore avvio gioco:', String(error));
      const msg = typeof error === 'string' ? error : String(error);
      setPatchStatus({
        success: false,
        // L'anti-cheat non è un errore qualunque: è un rifiuto deliberato, e
        // va spiegato perché altrimenti sembra un difetto nostro.
        message: msg.includes('ANTICHEAT_RILEVATO')
          ? t('unrealWizard.anticheatBlocked')
          : (typeof error === 'string' ? error : 'Errore avvio gioco')
      });
    }
  };

  // Carica traduzioni XUnity
  const _loadXunityTranslations = async () => {
    if (!game?.installPath) return;
    
    setIsLoadingTranslations(true);
    try {
      const entries = await invoke<{original: string, translated: string, line_number: number}[]>(
        'read_xunity_translations', 
        { gamePath: game.installPath }
      );
      setXunityTranslations(entries);
      setShowTranslationEditor(true);
    } catch (error: unknown) {
      clientLogger.error('Errore caricamento traduzioni:', String(error));
      alert(typeof error === 'string' ? error : 'Errore caricamento traduzioni');
    } finally {
      setIsLoadingTranslations(false);
    }
  };

  // Salva traduzione modificata
  const _saveTranslation = async (original: string, newTranslation: string) => {
    if (!game?.installPath) return;
    
    try {
      await invoke('save_xunity_translation', {
        gamePath: game.installPath,
        original,
        newTranslation
      });
      
      // Aggiorna lista locale
      setXunityTranslations(prev => 
        prev.map(e => e.original === original ? { ...e, translated: newTranslation } : e)
      );
      setEditingEntry(null);
    } catch (error: unknown) {
      clientLogger.error('Errore salvataggio:', String(error));
      alert(t('gameDetail.alertSaveError'));
    }
  };

  // Filtra traduzioni per ricerca
  const _filteredTranslations = xunityTranslations.filter(t =>
    t.original.toLowerCase().includes(_translationSearch.toLowerCase()) ||
    t.translated.toLowerCase().includes(_translationSearch.toLowerCase())
  );

  useEffect(() => {
    clientLogger.debug(`[GameDetail] useEffect triggered — gameId: ${gameId}, ref: ${gameDataLoadedRef.current}, url: ${window.location.search}`);
    if (!gameId) {
      clientLogger.warn('[GameDetail] gameId è vuoto — stop loading');
      setIsLoading(false);
      return;
    }
    if (gameDataLoadedRef.current === gameId) {
      clientLogger.debug('[GameDetail] Skipping fetch — already loaded for gameId:', gameId);
      return;
    }
    gameDataLoadedRef.current = gameId;

    // Safety timeout: se dopo 25s isLoading è ancora true, forza false
    const safetyTimer = setTimeout(() => {
      clientLogger.warn('[GameDetail] Safety timeout raggiunto — forzo isLoading=false');
      setIsLoading(false);
    }, 25000);

    {
      // Timeout wrapper: evita che una singola invoke blocchi tutto
      const safeInvoke = async <T = unknown>(cmd: string, args?: Record<string, unknown>, timeoutMs = 8000): Promise<T | null> => {
        try {
          return await Promise.race([
            invoke<T>(cmd, args),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${cmd} (${timeoutMs}ms)`)), timeoutMs))
          ]);
        } catch (e: unknown) {
          clientLogger.warn(`[GameDetail] ${cmd}: ${String(e)}`);
          return null;
        }
      };

      const fetchGameData = async () => {
        setIsLoading(true);
        try {
          // Leggi parametri dalla URL (passati dalla libreria)
          const urlParams = new URLSearchParams(window.location.search);
          const urlName = urlParams.get('name') ? decodeURIComponent(urlParams.get('name')!) : null;
          const urlInstallDir = urlParams.get('installDir');
          const urlInstalled = urlParams.get('installed') === 'true';
          const urlAppId = urlParams.get('appId');
          
          // Rileva piattaforma dal gameId
          const isEpicGame = gameId.startsWith('epic_');
          const isGogGame = gameId.startsWith('gog_');
          const isOriginGame = gameId.startsWith('origin_');
          const isNonSteamGame = isEpicGame || isGogGame || isOriginGame;
          
          // Leggi parametri aggiuntivi dalla URL
          const urlPlatform = urlParams.get('platform');
          const urlHeaderImage = urlParams.get('headerImage');
          
          // Estrai appId
          let appId: number | null = null;
          if (!isNonSteamGame) {
            if (urlAppId && !isNaN(parseInt(urlAppId))) {
              appId = parseInt(urlAppId);
            } else if (gameId.startsWith('steam_shared_')) {
              appId = parseInt(gameId.replace('steam_shared_', ''));
            } else if (gameId.startsWith('steam_family_')) {
              appId = parseInt(gameId.replace('steam_family_', ''));
            } else if (gameId.startsWith('steam_')) {
              appId = parseInt(gameId.replace('steam_', ''));
            } else {
              const parsed = parseInt(gameId);
              if (!isNaN(parsed)) appId = parsed;
            }
            
            // Fallback: cerca appId dal manifest Steam
            if (!appId && urlInstallDir) {
              const foundAppId = await safeInvoke<number | null>('get_appid_from_install_path', { installPath: urlInstallDir }, 3000);
              if (foundAppId && foundAppId > 0) appId = foundAppId;
            }
          }
          clientLogger.debug(`[GameDetail] appId: ${appId}, gameId: ${gameId}`);
          
          // === FASE 1: Carica Steam API + install path IN PARALLELO (max 8s) ===
          interface SteamApiData {
            name?: string;
            short_description?: string;
            detailed_description?: string;
            about_the_game?: string;
            header_image?: string;
            screenshots?: {id: number; path_thumbnail: string; path_full: string}[];
            movies?: string[];
            metacritic?: {score: number; url?: string} | null;
            achievements?: {total: number; highlighted?: {name: string; path: string}[]} | null;
            background?: string;
            website?: string;
            legal_notice?: string;
            recommendations?: {total: number} | null;
            developers?: string[];
            publishers?: string[];
            release_date?: {coming_soon: boolean; date: string} | null;
            genres?: {id: string; description: string}[];
            categories?: string[];
            supported_languages?: string;
            pc_requirements?: {minimum?: string; recommended?: string} | null;
            is_free?: boolean;
            dlc?: number[];
          }
          const [steamApiData, installPathResult] = await Promise.all([
            // Steam API details
            (!isNonSteamGame && appId && appId > 0)
              ? safeInvoke<SteamApiData>('fetch_steam_game_details', { appId }, 8000)
              : Promise.resolve(null),
            // Install path (prova installDir, poi appId)
            (async () => {
              if (urlInstallDir || urlInstalled) {
                const path = await safeInvoke<string>('find_game_install_path', { installDir: urlInstallDir || urlName || '' }, 5000);
                if (path) return path;
              }
              if (appId && appId > 0) {
                return await safeInvoke<string>('find_game_path_by_appid', { appId }, 5000);
              }
              return null;
            })(),
          ]);
          
          const realInstallPath = installPathResult;
          
          // Determina la piattaforma
          let platform = 'Steam';
          if (isEpicGame) platform = 'Epic Games';
          else if (isGogGame) platform = 'GOG';
          else if (isOriginGame) platform = 'Origin';
          else if (urlPlatform) platform = urlPlatform;
          
          const data = {
            id: gameId,
            appid: appId || 0,
            name: urlName || steamApiData?.name || decodeURIComponent(gameId),
            install_dir: urlInstallDir || undefined,
            // Se il path reale è stato risolto, il gioco è di fatto installato
            is_installed: urlInstalled || !!realInstallPath,
            isInstalled: urlInstalled || !!realInstallPath,
          };

          // Engine detection (non-bloccante, con timeout breve)
          let detectedEngine: string | null = null;
          if (realInstallPath) {
            const engineResult = await safeInvoke<{engine?: string}>('detect_engine_for_game', {
              gameName: data.name || 'Unknown', installPath: realInstallPath
            }, 5000);
            if (engineResult?.engine) detectedEngine = engineResult.engine;
          }
          // Fallback client-side se non rilevato via Tauri
          if (!detectedEngine) detectedEngine = detectEngineByName(data.name);
          
          // Combina dati base con dettagli Steam API
          const enhancedGame = {
            ...data,
            ...(steamApiData || {}),
            lastScanned: new Date().toISOString(),
            detectedFiles: [],
            installPath: realInstallPath || undefined,
            platform: platform,
            storeId: data.appid || gameId,
            engine: detectedEngine || undefined,
            title: steamApiData?.name || data.name,
            description: steamApiData?.short_description?.replace(/<[^>]*>?/gm, '') || (isNonSteamGame ? null : 'Nessuna descrizione disponibile.'),
            detailedDescription: steamApiData?.detailed_description?.replace(/<[^>]*>?/gm, '') || null,
            aboutGame: steamApiData?.about_the_game?.replace(/<[^>]*>?/gm, '') || null,
            coverUrl: isNonSteamGame 
              ? (urlHeaderImage || undefined)
              : (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/library_600x900.jpg` : undefined),
            heroUrl: isNonSteamGame 
              ? (urlHeaderImage || undefined)
              : (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/library_hero.jpg` : undefined),
            headerUrl: isNonSteamGame 
              ? (urlHeaderImage || undefined)
              : (steamApiData?.header_image || (data.appid > 0 ? `https://cdn.akamai.steamstatic.com/steam/apps/${data.appid}/header.jpg` : undefined)),
            shortDescription: steamApiData?.short_description || null,
            screenshots: steamApiData?.screenshots || [],
            movies: steamApiData?.movies || [],
            metacritic: steamApiData?.metacritic || null,
            achievements: steamApiData?.achievements || null,
            background: steamApiData?.background || null,
            website: steamApiData?.website || null,
            legal_notice: steamApiData?.legal_notice || null,
            recommendations: steamApiData?.recommendations || null,
            developers: steamApiData?.developers || [],
            publishers: steamApiData?.publishers || [],
            release_date: steamApiData?.release_date || null,
            genres: steamApiData?.genres || [],
            categories: steamApiData?.categories || [],
            supported_languages: steamApiData?.supported_languages || null,
            pc_requirements: steamApiData?.pc_requirements || null,
            is_free: steamApiData?.is_free || false,
          };

          clientLogger.debug('[GameDetail] ===== GAME LOADED =====', enhancedGame.title);
          setGame(enhancedGame as Game);
          setSteamDetails(steamApiData);
          setIsLoading(false); // UI visibile SUBITO

          // === FASE 2: Dati secondari in background (non bloccano la UI) ===
          // Activity history
          activityHistory.getRecent(100).then(allActivities => {
            const gameTranslations = (allActivities as Array<{activity_type: string; game_id: string; game_name: string; id: string; description?: string; title: string; timestamp: string}>)
              .filter(a => a.activity_type === 'translation' && (a.game_id === gameId || a.game_name === enhancedGame.title))
              .map(a => ({ id: a.id, gameId: a.game_id, filePath: a.description || a.title, status: 'completed', confidence: 0.95, timestamp: a.timestamp }));
            setTranslations(gameTranslations);
          }).catch(() => setTranslations([]));
          
          // HLTB (in background)
          setIsLoadingHltb(true);
          safeInvoke<{found: boolean; main?: number; main_extra?: number; completionist?: number; url?: string}>('get_howlongtobeat_info', { gameName: enhancedGame.title }, 10000)
            .then(r => { if (r) setHltbData(r); })
            .finally(() => setIsLoadingHltb(false));
          
          // Traccia visualizzazione
          activityHistory.add({ activity_type: 'game_launched', title: `Visualizzato: ${enhancedGame.title}`, game_name: enhancedGame.title, game_id: gameId });
          
          // Salva ultimo gioco visitato
          try {
            localStorage.setItem('gs_last_visited_game', JSON.stringify({
              id: gameId, title: enhancedGame.title || enhancedGame.name,
              image: enhancedGame.headerUrl || enhancedGame.coverUrl || null,
              platform: enhancedGame.platform || 'Steam', appId: String(enhancedGame.appid || ''),
              installPath: enhancedGame.installPath || null, visitedAt: Date.now(),
            }));
          } catch {}

          // DLC in background
          if (steamApiData?.dlc && steamApiData.dlc.length > 0) {
            Promise.all(steamApiData.dlc.slice(0, 5).map((dlcId: number) =>
              safeInvoke<Record<string, unknown>>('fetch_steam_game_details', { appId: dlcId }, 8000)
            )).then(results => setDlcGames(results.filter((r): r is Record<string, unknown> => r != null)));
          }
          return; // isLoading già settato a false sopra
        } catch (error: unknown) {
          clientLogger.error('Errore:', String(error));
        } finally {
          clearTimeout(safetyTimer);
          setIsLoading(false);
        }
      };
      
      fetchGameData();
    }

    return () => clearTimeout(safetyTimer);
  }, [gameId]);

  // Rileva motore automaticamente quando il gioco è caricato
  useEffect(() => {
    if (!game) return;
    // Guard per side effects pesanti (fetch API) - esegui solo una volta per game ID
    const gameKey = game.id || (game.appid ? String(game.appid) : null) || gameId;
    const isFirstRun = sideEffectsRunRef.current !== gameKey;
    
    if (isFirstRun) {
      sideEffectsRunRef.current = gameKey;
      
      if (!engineInfo && !isDetectingEngine) {
        detectEngine();
      }
      // Pre-compute translation strategy
      computeTranslationStrategy();
      if (game.engine === 'Unreal Engine' && game.installPath) {
        loadUnrealPatchStatus();
        loadUeLocStatus();
      }
      // Update tracker: controlla buildid per tutti i giochi Steam installati
      if (game.installPath && game.appid && game.appid > 0 && game.platform !== 'GOG') {
        loadUpdateStatus();
      }
      // Cerca traduzioni comunitarie su gamestranslator.it
      if (game.title) {
        searchCommunityTranslations();
      }
      // Cerca descrizione da Steam API se mancante
      if (!game.shortDescription && !game.description && game.appid && game.appid > 0) {
        fetchDescriptionFromSteam();
      }
      // Cerca descrizione da GOG API se mancante e gioco è GOG
      if (!game.shortDescription && !game.description && (game.platform === 'GOG' || game.source === 'GOG' || game.storeId?.toString().startsWith('gog_') || gameId.startsWith('gog_'))) {
        fetchDescriptionFromGog();
      }
      // Rileva automaticamente se è un gioco FMV (contiene video VMD/BIK/SMK/USM/ROQ)
      // Nota: il backend popola is_installed (snake_case), ma alcune parti del codice usano isInstalled
      if ((game.isInstalled || game.is_installed) && game.installPath && !fmvInfo) {
        detectFmvGame();
      }
      // Cerca immagine su SteamGridDB solo se non c'è proprio nessuna headerUrl.
      // Per giochi Steam con library_600x900.jpg inesistente (es. The Beast Within),
      // il fallback scatta automaticamente via img.onError senza richieste cross-origin
      // che verrebbero bloccate da CORS.
      if (!fallbackImage && !game.headerUrl) {
        fetchFallbackImage();
      }
    }
    // Traduci descrizione nella lingua utente (ritraduce quando cambia lingua)
    if (game.shortDescription) {
      setTranslatedDescription(null);
      translateDescription(game.shortDescription);
    }
  }, [game, language]);

  // Cerca descrizione da Steam Store API
  const fetchDescriptionFromSteam = async () => {
    if (!game?.appid) return;
    try {
      const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appid}&l=english`);
      const data = await response.json();
      if (data[game.appid]?.success && data[game.appid]?.data?.short_description) {
        const desc = data[game.appid].data.short_description.replace(/<[^>]*>?/gm, '');
        setGame(prev => prev ? { ...prev, shortDescription: desc, description: desc } : null);
        setTranslatedDescription(desc);
      }
    } catch (e: unknown) {
      clientLogger.warn('[GameDetail] Steam description fetch failed:', String(e));
    }
  };

  // Cerca descrizione da GOG API
  const fetchDescriptionFromGog = async () => {
    if (!game) return;
    try {
      // Estrai ID numerico GOG dal gameId URL (es: "gog_1803553877" -> "1803553877")
      // NON usare game.appid perché è 0 per giochi GOG
      const gogId = gameId.startsWith('gog_') ? gameId.replace('gog_', '') 
        : (game.storeId?.toString().replace('gog_', '') || game.id?.replace('gog_', '') || '');
      clientLogger.debug(`[GameDetail] GOG fetch: gameId=${gameId}, gogId=${gogId}, title=${game.title || game.name}`);
      if (!gogId || gogId === '0') return;
      
      const details = await invoke<{description?: string}>('get_gog_game_details', { gameId: gogId, gameName: game.title || game.name || null });
      clientLogger.debug(`[GameDetail] GOG details response: ${JSON.stringify(details)}`);
      if (details?.description) {
        const desc = details.description.replace(/<[^>]*>?/gm, '');
        setGame(prev => prev ? { ...prev, shortDescription: desc, description: desc } : null);
        translateDescription(desc);
        clientLogger.debug(`[GameDetail] GOG description loaded for ${game.title || game.name}`);
      } else {
        clientLogger.warn(`[GameDetail] GOG details found but no description field: ${Object.keys(details || {}).join(',')}`);
      }
    } catch (e: unknown) {
      clientLogger.warn('[GameDetail] GOG description fetch failed:', String(e));
    }
  };

  // Rileva automaticamente se il gioco è un FMV (contiene video proprietari)
  const detectFmvGame = async () => {
    if (!game?.installPath) return;
    try {
      interface VideoScanResult {
        total_files: number;
        total_size_bytes: number;
        format_summary: { format: string; count: number; total_bytes: number }[];
      }
      const result = await invoke<VideoScanResult>('scan_game_video_files', {
        gamePath: game.installPath,
      });
      if (result && result.total_files > 0) {
        // Formati FMV "proprietari" (non standard come mp4/webm)
        const fmvFormats = ['VMD', 'Bink', 'Smacker', 'CRI', 'ROQ', 'THP', 'RBT', 'DUK'];
        const foundFmvFormats = result.format_summary
          .filter(fs => fmvFormats.some(fmt => fs.format.includes(fmt)))
          .map(fs => fs.format);
        // È un gioco FMV se ha formati proprietari o se i video totali > 100 MB
        const totalMB = result.total_size_bytes / (1024 * 1024);
        const isFmv = foundFmvFormats.length > 0 || totalMB > 100;
        setFmvInfo({
          isFmvGame: isFmv,
          totalFiles: result.total_files,
          totalSizeMB: totalMB,
          formats: result.format_summary.map(fs => fs.format),
        });
        if (isFmv) {
          clientLogger.debug(`[GameDetail] 🎬 FMV game detected: ${result.total_files} video files (${totalMB.toFixed(0)} MB), formats: ${foundFmvFormats.join(', ')}`);
        }
      } else {
        setFmvInfo({ isFmvGame: false, totalFiles: 0, totalSizeMB: 0, formats: [] });
      }
    } catch (e: unknown) {
      clientLogger.debug('[GameDetail] FMV detection skipped:', String(e));
    }
  };

  // Cerca immagine alternativa su SteamGridDB
  const fetchFallbackImage = async () => {
    if (!game) return;
    try {
      // Leggi API key da localStorage (salvata dalle impostazioni)
      const savedSettings = localStorage.getItem('gameStringerSettings');
      let apiKey: string | null = null;
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          apiKey = settings?.integrations?.steamGridDbApiKey || null;
        } catch (e: unknown) {
          clientLogger.warn('[GameDetail] Errore parsing impostazioni:', String(e));
        }
      }
      
      const result = await invoke<string | null>('fetch_steamgriddb_image', {
        appId: game.appid || 0,
        gameName: game.title || game.name || '',
        apiKey: apiKey
      });
      let coverFound = false;
      if (result) {
        setFallbackImage(result);
        coverFound = true;
        clientLogger.debug('[GameDetail] SteamGridDB fallback:', result);
        // Salva in cache per la libreria
        const cacheId = game.appid ? String(game.appid) : (game.id || game.title);
        await invoke('save_cover_cache', { gameId: cacheId, imageUrl: result });
        clientLogger.debug('[GameDetail] Cover salvata in cache:', cacheId);
      } else if (game.appid && game.appid > 0) {
        // Fallback: scraping pagina Steam Store per og:image
        try {
          const storeImage = await invoke<string | null>('fetch_steam_store_image', { appId: game.appid });
          if (storeImage) {
            setFallbackImage(storeImage);
            coverFound = true;
            clientLogger.debug('[GameDetail] Steam Store scraping fallback:', storeImage);
            const cacheId = String(game.appid);
            await invoke('save_cover_cache', { gameId: cacheId, imageUrl: storeImage });
          }
        } catch (e2) {
          clientLogger.warn('[GameDetail] Steam Store scraping failed:', String(e2));
        }
      }
      // Fallback GOG: usa API pubblica GOG per copertina
      if (!coverFound && (game.platform === 'GOG' || gameId.startsWith('gog_'))) {
        try {
          const gogId = gameId.replace('gog_', '') || game.storeId?.toString().replace('gog_', '') || '';
          if (gogId) {
            const gogCover = await invoke<string | null>('get_gog_game_cover', { gameId: gogId, gameName: game.title || game.name || null });
            if (gogCover) {
              setFallbackImage(gogCover);
              clientLogger.debug('[GameDetail] ✅ GOG API cover:', gogCover);
              const cacheId = game.id || gameId;
              await invoke('save_cover_cache', { gameId: cacheId, imageUrl: gogCover });
            }
          }
        } catch (e3) {
          clientLogger.warn('[GameDetail] GOG API cover failed:', String(e3));
        }
      }
    } catch (e: unknown) {
      clientLogger.warn('[GameDetail] SteamGridDB fallback failed:', String(e));
    }
  };

  // Traduce la descrizione nella lingua dell'utente
  const translateDescription = async (text: string) => {
    try {
      const result = await invoke<{ translated_text: string }>('translate_text_simple', {
        text,
        targetLang: language
      });
      // Ignora risposte di errore da MyMemory (limite raggiunto)
      if (result?.translated_text && !result.translated_text.includes('MYMEMORY WARNING')) {
        setTranslatedDescription(result.translated_text);
      }
    } catch (error: unknown) {
      clientLogger.warn('Traduzione descrizione non disponibile:', String(error));
      // Fallback: mostra originale
    }
  };

  const scanGameFiles = async () => {
    if (!game?.installPath) {
      toast.error(t('common.percorsoDiInstallazioneNonDisponibile'));
      return;
    }
    setIsScanning(true);
    setScanProgress(0);
    
    // Animate progress while waiting for real scan
    const progressInterval = setInterval(() => {
      setScanProgress(prev => Math.min(prev + 5, 90));
    }, 300);
    
    try {
      const files = await invoke<string[]>('scan_game_files', { gamePath: game.installPath });
      clearInterval(progressInterval);
      setScanProgress(100);
      
      if (files && files.length > 0) {
        setGame({ ...game, detectedFiles: files });
        toast.success(`Trovati ${files.length} file traducibili`);
      } else {
        toast.info(t('common.nessunFileTraducibileTrovato'));
      }
    } catch (error: unknown) {
      clearInterval(progressInterval);
      clientLogger.error('[GameDetail] Errore scansione:', String(error));
      toast.error(`Errore scansione: ${error}`);
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(0);
      }, 500);
    }
  };

  // ═══ STRING IT! — smart entry point con gate P.T. ═══
  // Se il gioco non è stato ancora analizzato da P.T. (o la cache è scaduta),
  // chiediamo all'utente se vuole eseguire prima l'analisi. Altrimenti parte diretto.
  const handleStringIt = async () => {
    if (!game?.installPath) {
      toast.error(t('common.percorsoDiInstallazioneNonDisponibile'));
      return;
    }
    // Gate copia legale: alla prima traduzione chiedi conferma di possesso legale.
    if (!isLegalCopyAcked()) {
      setLegalGateOpen(true);
      return;
    }
    // Whitelist relazioni-publisher: blocco (richiesta publisher) o avviso
    // (localizzazione ufficiale già esistente) prima del flusso. Fail-open.
    try {
      const verdict = matchWhitelist(
        { appId: game.appid, title: game.title || game.name },
        targetLang,
        publisherWhitelistData as PublisherWhitelist
      );
      if (verdict?.blocked) {
        toast.error(t('gameDetail.whitelistBlocked'));
        return;
      }
      if (verdict?.notice) {
        toast.info(t('gameDetail.whitelistOfficialNotice'));
        // non bloccante: il flusso prosegue
      }
    } catch { /* fail-open: la whitelist non deve mai rompere la traduzione */ }
    if (autoTranslateRunningRef.current || autoTranslateActive) return;

    // Motori con percorso DIRETTO (branch dedicato in startAutoTranslate: hero
    // file-based o instradamento esplicito). Il gate P.T. serve solo al workflow
    // generico (execute_complete_workflow) → per questi niente dialog, si parte.
    {
      const engDirect = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
      const DIRECT_ENGINES = ['hendrix', "ren'py", 'renpy', 'visionaire', 'tyrano', 'nw.js', 'electron', 'rpg maker', 'rpgmaker', 'unity', 'unreal', 'godot'];
      if (DIRECT_ENGINES.some(k => engDirect.includes(k))) {
        startAutoTranslate();
        return;
      }
    }

    try {
      const info = await invoke<{ cached: boolean; expired: boolean; age_minutes: number; difficulty_score: number | null }>(
        'has_cached_prediction',
        { installPath: game.installPath, gameTitle: game.title || game.name || '' }
      );

      if (info.cached && !info.expired) {
        // Già analizzato di recente → parti diretto
        startAutoTranslate();
        return;
      }

      // Nessuna cache valida → mostra dialog conferma
      const ptUrl = `/prediction-tool?name=${encodeURIComponent(game.title || game.name || '')}&installDir=${encodeURIComponent(game.installPath)}&engine=${encodeURIComponent(engineInfo?.engine || '')}&headerImage=${encodeURIComponent(game.headerImage || game.coverImage || '')}`;
      setPtConfirmDialog({
        open: true,
        expired: info.expired,
        ageHours: Math.floor(info.age_minutes / 60),
        ptUrl,
      });
    } catch (e: unknown) {
      clientLogger.warn('[StringIt] cache check failed:', String(e));
      // Fallback: parti diretto se il check fallisce
      startAutoTranslate();
    }
  };

  // ═══ AUTO-TRANSLATE ONE-CLICK FLOW ═══
  const autoTranslateRunningRef = useRef(false);
  const startAutoTranslate = async () => {
    if (!game?.installPath) {
      toast.error(t('common.percorsoDiInstallazioneNonDisponibile'));
      return;
    }
    // Guard anti-doppio-click + feedback pulsante valido per OGNI motore (anche i rami
    // con return anticipato: Hendrix/Ren'Py/RPG). Reset garantito nei rispettivi finally.
    if (autoTranslateBusy || autoTranslateRunningRef.current) return;
    autoTranslateRunningRef.current = true;
    setAutoTranslateBusy(true);
    setAutoTranslateProgress('');

    // ── Hendrix_Localization (RPG Maker MV/MZ con game_messages.csv) ──
    // Via CSV nativa del gioco: riempiamo la colonna lingua, abilitiamo il plugin
    // e registriamo la lingua. Non invasivo (nessun .json toccato).
    {
      const engH = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
      if (engH.includes('hendrix')) {
        const tgt = (targetLang || language || 'it').toLowerCase();
        const tgtName: Record<string, string> = { it: 'Italiano', en: 'English', fr: 'Français', es: 'Español', sp: 'Español', de: 'Deutsch', pt: 'Português', ja: '日本語', cn: '中文', zh: '中文', ru: 'Русский' };
        // Tracking trasversale: guardia + progress globale + tray + Progetti
        const hTracker = startHeroTracking(progress, {
          engineId: 'hendrix', engineLabel: 'Hendrix', gamePath: game.installPath,
          gameId: game.id || game.appid?.toString() || gameId, gameName: game.name || game.title,
          gameImage: game.headerImage || game.coverUrl, sourceLang: 'en', targetLang: tgt,
          opTitle: t('heroJob.jobTitle').replace('{name}', game.name || game.title || 'Hendrix'),
          opDesc: t('heroJob.jobDescBg').replace('{engine}', 'Hendrix'),
        });
        if (!hTracker) {
          toast.info(t('heroJob.alreadyRunning'));
          setAutoTranslateBusy(false); autoTranslateRunningRef.current = false;
          return;
        }
        const toastId = toast.loading(t('gameDetail.loadingHendrixExtract'));
        try {
          const r = await runHendrixTranslation({
            gamePath: game.installPath,
            targetLang: tgt,
            targetName: tgtName[tgt] || tgt.toUpperCase(),
            onProgress: (p) => {
              if (p.phase === 'translate') { toast.loading(`Hendrix: traduzione ${p.done}/${p.total}... (ripresa salvata)`, { id: toastId }); hTracker.onProgress(p.done, p.total); }
              else if (p.phase === 'apply') toast.loading(t('gameDetail.loadingHendrixApply'), { id: toastId });
              else if (p.phase === 'enable') toast.loading(t('gameDetail.loadingHendrixEnable'), { id: toastId });
            },
          });
          await hTracker.done(r.applied, r.total);
          toast.success(`Tradotto: ${r.applied}/${r.total} stringhe in ${tgtName[tgt] || tgt}. Rilancia il gioco.`, { id: toastId });
        } catch (e) {
          await hTracker.fail(e);
          toast.error(t('gameDetail.errHendrix'), { id: toastId, description: String(e) });
        } finally {
          setAutoTranslateBusy(false);
          setAutoTranslateProgress('');
          autoTranslateRunningRef.current = false;
        }
        return;
      }
    }

    // ── Ren'Py (visual novel) → pipeline file-based nativa ───────────
    // Estrae le .rpy, traduce via LLM offline e genera la cartella game/tl/<lang>/:
    // blocco `strings` per la UI + filtro runtime say_menu_text_filter per i
    // dialoghi (vedi generate_renpy_translation). Non invasivo: Ren'Py carica la
    // traduzione nativamente quando il giocatore seleziona la lingua.
    {
      const engR = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
      if (engR.includes("ren'py") || engR.includes('renpy')) {
        const tgt = (targetLang || language || 'it').toLowerCase();
        const t0 = Date.now();
        // Esperienza "hero": stati chiari nel pannello stepper (non solo toast).
        const rpSteps = [
          { label: "📂 Estrazione stringhe (.rpy)", status: 'pending' as const },
          { label: "📖 Glossario & voci personaggio", status: 'pending' as const },
          { label: "✨ Traduzione AI", status: 'pending' as const },
          { label: "🩹 Generazione file tl/", status: 'pending' as const },
        ];
        const rpStep = (idx: number, status: 'running' | 'done' | 'error', detail?: string) =>
          setAutoTranslateSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, detail } : i < idx ? { ...s, status: 'done' } : s));
        // Tracking trasversale: guardia + progress globale + tray + Progetti
        const rpTracker = startHeroTracking(progress, {
          engineId: 'renpy', engineLabel: "Ren'Py", gamePath: game.installPath,
          gameId: game.id || game.appid?.toString() || gameId, gameName: game.name || game.title,
          gameImage: game.headerImage || game.coverUrl, sourceLang: 'en', targetLang: tgt,
          opTitle: t('heroJob.jobTitle').replace('{name}', game.name || game.title || "Ren'Py"),
          opDesc: t('heroJob.jobDescBg').replace('{engine}', "Ren'Py"),
        });
        if (!rpTracker) {
          toast.info(t('heroJob.alreadyRunning'));
          setAutoTranslateBusy(false); autoTranslateRunningRef.current = false;
          return;
        }
        setAutoTranslateError(null);
        setAutoTranslateResult(null);
        setAutoTranslateSteps([...rpSteps]);
        setAutoTranslateActive(true);
        try {
          const r = await runRenpyTranslation({
            gamePath: game.installPath,
            targetLang: tgt,
            sourceLang: 'en',
            gameId: game.id || (game.appid ? String(game.appid) : undefined),
            // Esplicito, mai implicito: prima dell'08/08/2026 questo chiamante
            // non passava `backend` e la scelta restava sepolta in localStorage.
            backend: renpyBackend,
            limit: renpyTestBatch ? RENPY_TEST_BATCH_SIZE : undefined,
            onProgress: (p) => {
              if (p.phase === 'extract') rpStep(0, 'running');
              else if (p.phase === 'glossary') { rpStep(0, 'done'); rpStep(1, 'running'); }
              else if (p.phase === 'translate') {
                rpStep(1, 'done');
                rpStep(2, 'running', `${p.done}/${p.total}`);
                setAutoTranslateProgress(p.total ? `${p.done}/${p.total}` : '');
                rpTracker.onProgress(p.done, p.total);
              } else if (p.phase === 'generate') { rpStep(2, 'done'); rpStep(3, 'running'); }
              else if (p.phase === 'done') rpStep(3, 'done');
            },
          });
          rpStep(3, 'done', `${r.translated}/${r.total} stringhe${r.glossaryTerms ? ` · glossario ${r.glossaryTerms}` : ''}${r.voiceProfiles ? ` · voci ${r.voiceProfiles}` : ''}`);
          setAutoTranslateResult({
            successRate: r.total ? Math.round((100 * r.translated) / r.total) : 0,
            duration: Math.round((Date.now() - t0) / 60000), // MINUTI: il banner scrive "min" (il 03/08 mostrava 11731 "min" che erano secondi)
            deliverables: 1,
            errors: Math.max(0, r.total - r.translated),
            engine: "Ren'Py",
            targetLang: tgt,
            stringsTranslated: r.translated,
            stringsTotal: r.total,
            // Questo percorso ha già scritto i file di traduzione: senza
            // `verification` il wizard lo tratterebbe come "non verificato" e
            // direbbe che il gioco è rimasto com'era, che è falso.
            verification: {
              checked: 1, verified: r.translated > 0 ? 1 : 0, missing: [],
              verifiedNames: r.translated > 0 ? ["Ren'Py"] : [],
              stringsWritten: r.translated, runtimeOnly: false,
            },
          });
          await rpTracker.done(r.translated, r.total);
          toast.success(`Ren'Py: ${r.translated}/${r.total} stringhe tradotte. Avvia il gioco e seleziona ${tgt.toUpperCase()}.`);
        } catch (e) {
          rpStep(2, 'error', String(e));
          // Il suggerimento deve seguire il backend scelto: dire "Ollama è
          // avviato?" a chi sta usando il cloud manda a cercare nel posto
          // sbagliato (e viceversa).
          setAutoTranslateError(
            `Ren'Py: ${String(e)} — ${renpyBackend === 'cloud'
              ? 'chiave API e credito sono a posto nelle Impostazioni?'
              : 'Ollama è avviato?'}`
          );
          await rpTracker.fail(e);
          toast.error(t('gameDetail.errRenpy'), { description: String(e) });
        } finally {
          setAutoTranslateBusy(false);
          setAutoTranslateProgress('');
          autoTranslateRunningRef.current = false;
        }
        return;
      }
    }

    // ── Visionaire Studio (.vis / game.veb) → pipeline file-based nativa ──
    // Estrae le stringhe dal binario, traduce via Ollama e applica con
    // patch_vis_strings (backup .gs_bak automatico). Checkpoint/resume su idb.
    {
      const engV = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
      if (engV.includes('visionaire')) {
        const tgt = (targetLang || language || 'it').toLowerCase();
        const t0 = Date.now();
        // Guardia anti-duplicato GLOBALE (sopravvive a navigazione/smontaggio): se la
        // traduzione di questo gioco è già in corso in background, non rilanciarla.
        const _vg = globalThis as unknown as { __gsVisRunning?: Set<string> };
        if (!_vg.__gsVisRunning) _vg.__gsVisRunning = new Set<string>();
        const VIS_RUNNING = _vg.__gsVisRunning;
        if (VIS_RUNNING.has(game.installPath)) {
          toast.info(t('heroJob.alreadyRunning'));
          setAutoTranslateBusy(false);
          autoTranslateRunningRef.current = false;
          return;
        }
        VIS_RUNNING.add(game.installPath);
        const visOpId = `visionaire-${game.installPath}`;
        // Backend automatico: cloud (Gemini→fallback) se è configurata una API key,
        // altrimenti Ollama offline. Il cloud è molto più veloce su grandi volumi.
        let useCloud = false;
        try {
          const s = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
          const tr = s.translation || {};
          useCloud = !!(tr.apiKey || tr.openaiApiKey || tr.deepseekApiKey || tr.anthropicApiKey || tr.groqApiKey || tr.mistralApiKey || tr.openrouterApiKey);
        } catch { /* nessuna key → Ollama */ }
        const visBackend: 'cloud' | 'ollama' = useCloud ? 'cloud' : 'ollama';
        const vSteps = [
          { label: `📂 ${t('heroJob.stepScan')}`, status: 'pending' as const },
          { label: `📜 ${t('heroJob.stepExtract')}`, status: 'pending' as const },
          { label: `✨ ${visBackend === 'cloud' ? t('heroJob.stepTranslateCloud') : t('heroJob.stepTranslateOllama')}`, status: 'pending' as const },
          { label: `🩹 ${t('heroJob.stepApplyPatch')}`, status: 'pending' as const },
        ];
        const vStep = (idx: number, status: 'running' | 'done' | 'error', detail?: string) =>
          setAutoTranslateSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, detail } : i < idx ? { ...s, status: 'done' } : s));
        setAutoTranslateError(null);
        setAutoTranslateResult(null);
        setAutoTranslateSteps([...vSteps]);
        setAutoTranslateActive(true);
        // Operazione GLOBALE: gli aggiornamenti vanno al ProgressProvider montato nel
        // layout, quindi restano visibili e continuano anche cambiando pagina.
        progress.startOperation(visOpId, {
          title: t('heroJob.jobTitle').replace('{name}', game.name || game.title || 'Visionaire'),
          description: t('heroJob.jobDescBg').replace('{engine}', `Visionaire Studio · ${visBackend === 'cloud' ? 'Cloud' : 'Ollama'}`),
          isBackground: true,
          canMinimize: true,
          // Il pulsante Annulla del widget ferma il job TRA un blocco e
          // l'altro: checkpoint salvato (disco+idb) e patch parziale
          // applicata. Fino al 03/08/2026 l'unico stop era chiudere la app.
          canCancel: true,
          onCancel: () => {
            // installPath è string|undefined e il narrowing non entra nelle
            // closure: si rilegge e si controlla QUI, al momento del click.
            const p = game.installPath;
            if (!p) return;
            import('@/lib/visionaire-translate')
              .then(m => m.requestVisionaireStop(p))
              .catch(() => {});
          },
        });
        // Badge tray: +1 traduzione in corso
        import('@/lib/notifications/tray-notifications').then(m => m.incrementActiveTranslations()).catch(() => {});
        try {
          const { runVisionaireTranslation } = await import('@/lib/visionaire-translate');
          const r = await runVisionaireTranslation({
            gamePath: game.installPath,
            targetLang: tgt,
            backend: visBackend,
            gameId: game.id || game.appid?.toString() || gameId,
            gameName: game.name || game.title,
            gameImage: game.headerImage || game.coverUrl,
            onProgress: (p) => {
              if (p.phase === 'scan') vStep(0, 'running');
              else if (p.phase === 'extract') { vStep(0, 'done'); vStep(1, 'running'); }
              else if (p.phase === 'translate') {
                vStep(1, 'done');
                vStep(2, 'running', `${p.done}/${p.total}`);
                setAutoTranslateProgress(p.total ? `${p.done}/${p.total}` : '');
                progress.updateProgress(visOpId, p.total ? (p.done / p.total) * 100 : 0, `${p.done}/${p.total}`);
              } else if (p.phase === 'apply') { vStep(2, 'done'); vStep(3, 'running'); progress.updateProgress(visOpId, 99, 'Applicazione patch...'); }
              else if (p.phase === 'done') vStep(3, 'done');
            },
          });
          if (r.stopped) {
            // Interrotto dall'utente col pulsante Annulla: NON è né un
            // successo da wizard né un errore — il lavoro è nel checkpoint
            // e la patch parziale è applicata. Si chiude sobri.
            vStep(2, 'done', `${r.translated}/${r.total} — ${t('heroJob.stoppedByUser')}`);
            progress.completeOperation(visOpId, { translated: r.translated, total: r.total, stopped: true });
            try {
              const tray = await import('@/lib/notifications/tray-notifications');
              await tray.decrementActiveTranslations();
            } catch { /* tray non disponibile */ }
            toast.info(t('heroJob.stoppedToast').replace('{n}', String(r.translated)).replace('{total}', String(r.total)));
            return;
          }
          vStep(3, 'done', `${r.translated}/${r.total} stringhe`);
          setAutoTranslateResult({
            successRate: r.total ? Math.round((100 * r.translated) / r.total) : 0,
            duration: Math.round((Date.now() - t0) / 60000), // MINUTI: il banner scrive "min" (il 03/08 mostrava 11731 "min" che erano secondi)
            deliverables: 1,
            errors: Math.max(0, r.total - r.translated),
            engine: 'Visionaire Studio',
            targetLang: tgt,
            stringsTranslated: r.translated,
            stringsTotal: r.total,
            verification: {
              checked: 1, verified: r.translated > 0 ? 1 : 0, missing: [],
              verifiedNames: r.translated > 0 ? ['Visionaire Studio'] : [],
              stringsWritten: r.translated, runtimeOnly: false,
            },
          });
          progress.completeOperation(visOpId, { translated: r.translated, total: r.total });
          // Notifica tray (anche con finestra ridotta a icona) + aggiorna badge attivi
          try {
            const tray = await import('@/lib/notifications/tray-notifications');
            await tray.decrementActiveTranslations();
            await tray.notifyTranslationCompleted(game.name || game.title || 'Gioco', r.translated);
          } catch { /* tray non disponibile */ }
          toast.success(t('heroJob.visDone').replace('{n}', String(r.translated)).replace('{total}', String(r.total)));
        } catch (e) {
          vStep(2, 'error', String(e));
          const hint = visBackend === 'cloud' ? t('heroJob.hintApiKey') : t('heroJob.hintOllama');
          const _detail = (e instanceof Error ? e.message : String(e)) || '';
          const _full = `${t('heroJob.visError').replace('{hint}', hint)}${_detail ? ' — ' + _detail : ''}`;
          clientLogger.error('[Visionaire] traduzione fallita:', e);
          setAutoTranslateError(_full);
          progress.failOperation(visOpId, new Error(_full));
          try {
            const tray = await import('@/lib/notifications/tray-notifications');
            await tray.decrementActiveTranslations();
            await tray.notifyTranslationFailed(game.name || game.title || 'Gioco', String(e));
          } catch { /* tray non disponibile */ }
          toast.error(t('heroJob.visError').replace('{hint}', hint), { description: String(e) });
        } finally {
          VIS_RUNNING.delete(game.installPath);
          setAutoTranslateBusy(false);
          setAutoTranslateProgress('');
          autoTranslateRunningRef.current = false;
        }
        return;
      }
    }

    // ── TyranoScript / Electron VN → pipeline hero file-based (.ks in app.asar) ──
    // Estrae le stringhe dai file .ks con extract_tyrano_strings, traduce via
    // cloud/Ollama e applica con apply_tyrano_patch (backup app.asar.bak
    // automatico). Stesso trigger della strategia (riga detection): tyrano/nw.js/electron.
    {
      const engT = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
      if (engT.includes('tyrano') || engT.includes('nw.js') || engT.includes('electron')) {
        const tgt = (targetLang || language || 'it').toLowerCase();
        const t0 = Date.now();
        // Backend automatico: cloud se è configurata una API key, altrimenti Ollama.
        let useCloud = false;
        try {
          const s = JSON.parse(localStorage.getItem('gameStringerSettings') || '{}');
          const tr = s.translation || {};
          useCloud = !!(tr.apiKey || tr.openaiApiKey || tr.deepseekApiKey || tr.anthropicApiKey || tr.groqApiKey || tr.mistralApiKey || tr.openrouterApiKey);
        } catch { /* nessuna key → Ollama */ }
        const tyBackend: 'cloud' | 'ollama' = useCloud ? 'cloud' : 'ollama';
        const tySteps = [
          { label: `🔍 ${t('heroJob.tyranoStepDetect')}`, status: 'pending' as const },
          { label: `📂 ${t('heroJob.tyranoStepExtract')}`, status: 'pending' as const },
          { label: `✨ ${tyBackend === 'cloud' ? t('heroJob.stepTranslateCloud') : t('heroJob.stepTranslateOllama')}`, status: 'pending' as const },
          { label: `🩹 ${t('heroJob.tyranoStepApply')}`, status: 'pending' as const },
        ];
        const tyStep = (idx: number, status: 'running' | 'done' | 'error', detail?: string) =>
          setAutoTranslateSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, detail } : i < idx ? { ...s, status: 'done' } : s));
        // Tracking trasversale: guardia + progress globale + tray + Progetti
        const tyTracker = startHeroTracking(progress, {
          engineId: 'tyranoscript', engineLabel: 'TyranoScript', gamePath: game.installPath,
          gameId: game.id || game.appid?.toString() || gameId, gameName: game.name || game.title,
          gameImage: game.headerImage || game.coverUrl, sourceLang: 'ja', targetLang: tgt,
          opTitle: t('heroJob.jobTitle').replace('{name}', game.name || game.title || 'TyranoScript'),
          opDesc: t('heroJob.jobDescBg').replace('{engine}', `TyranoScript · ${tyBackend === 'cloud' ? 'Cloud' : 'Ollama'}`),
        });
        if (!tyTracker) {
          toast.info(t('heroJob.alreadyRunning'));
          setAutoTranslateBusy(false); autoTranslateRunningRef.current = false;
          return;
        }
        setAutoTranslateError(null);
        setAutoTranslateResult(null);
        setAutoTranslateSteps([...tySteps]);
        setAutoTranslateActive(true);
        // Import fuori dal try: le costanti d'errore servono anche nel catch.
        const tyMod = await import('@/lib/tyrano-translate');
        const { TYRANO_ERR_NO_ASAR, TYRANO_ERR_NO_STRINGS } = tyMod;
        try {
          const r = await tyMod.runTyranoTranslation({
            gamePath: game.installPath,
            targetLang: tgt,
            backend: tyBackend,
            onProgress: (p) => {
              if (p.phase === 'detect') tyStep(0, 'running');
              else if (p.phase === 'extract') { tyStep(0, 'done'); tyStep(1, 'running'); }
              else if (p.phase === 'translate') {
                tyStep(1, 'done');
                tyStep(2, 'running', `${p.done}/${p.total}`);
                setAutoTranslateProgress(p.total ? `${p.done}/${p.total}` : '');
                tyTracker.onProgress(p.done, p.total);
              } else if (p.phase === 'apply') { tyStep(2, 'done'); tyStep(3, 'running'); }
              else if (p.phase === 'done') tyStep(3, 'done');
            },
          });
          tyStep(3, 'done', `${r.applied}/${r.total}`);
          setAutoTranslateResult({
            successRate: r.total ? Math.round((100 * r.translated) / r.total) : 0,
            duration: Math.round((Date.now() - t0) / 60000), // MINUTI: il banner scrive "min" (il 03/08 mostrava 11731 "min" che erano secondi)
            deliverables: 1,
            errors: Math.max(0, r.total - r.translated),
            engine: 'TyranoScript',
            targetLang: tgt,
            stringsTranslated: r.translated,
            stringsTotal: r.total,
            // `r.applied` (non `r.translated`): qui l'orchestratore distingue
            // già fra tradotte e realmente applicate ai file.
            verification: {
              checked: 1, verified: r.applied > 0 ? 1 : 0, missing: [],
              verifiedNames: r.applied > 0 ? ['TyranoScript'] : [],
              stringsWritten: r.applied, runtimeOnly: false,
            },
          });
          await tyTracker.done(r.translated, r.total);
          toast.success(t('heroJob.tyranoDone').replace('{n}', String(r.translated)).replace('{total}', String(r.total)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Errori "parlanti" dell'orchestratore → messaggi onesti e specifici.
          const friendly = msg.includes(TYRANO_ERR_NO_ASAR)
            ? t('heroJob.tyranoNoAsar')
            : msg.includes(TYRANO_ERR_NO_STRINGS)
              ? t('heroJob.tyranoNoStrings')
              : t('heroJob.tyranoError').replace('{hint}', tyBackend === 'cloud' ? t('heroJob.hintApiKey') : t('heroJob.hintOllama'));
          tyStep(msg.includes(TYRANO_ERR_NO_ASAR) || msg.includes(TYRANO_ERR_NO_STRINGS) ? 1 : 2, 'error', friendly);
          clientLogger.error(`[Tyrano] traduzione fallita:`, e);
          setAutoTranslateError(friendly);
          await tyTracker.fail(new Error(friendly));
          toast.error(friendly, { description: msg.startsWith('TYRANO_') ? undefined : msg });
        } finally {
          setAutoTranslateBusy(false);
          setAutoTranslateProgress('');
          autoTranslateRunningRef.current = false;
        }
        return;
      }
    }

    // ── Unity → XUnity AutoTranslator (runtime, non file-based) ─────────
    // Unity non ha una pipeline hero sui file: XUnity traduce a runtime.
    // String it! instrada quindi all'installazione BepInEx+XUnity (stesso flusso
    // del bottone patch), con messaggio onesto: "100% installato" ≠ tradotto,
    // serve avviare il gioco per catturare e tradurre le stringhe.
    {
      const engUn = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
      if (engUn.includes('unity')) {
        setAutoTranslateError(null);
        setAutoTranslateResult(null);
        setAutoTranslateActive(true);
        setAutoTranslateSteps([{ label: `🩹 ${t('heroJob.unityRouteStep')}`, status: 'running' }]);
        try {
          const ok = await handleInstallUnityPatch();
          if (ok) {
            setAutoTranslateSteps([{ label: `🩹 ${t('heroJob.unityRouteStep')}`, status: 'done', detail: t('heroJob.unityRouteDone') }]);
            toast.success(t('heroJob.unityRouteDone'));
          } else {
            setAutoTranslateSteps([{ label: `🩹 ${t('heroJob.unityRouteStep')}`, status: 'error', detail: t('heroJob.unityRouteFail') }]);
            setAutoTranslateError(t('heroJob.unityRouteFail'));
          }
        } finally {
          setAutoTranslateBusy(false);
          setAutoTranslateProgress('');
          autoTranslateRunningRef.current = false;
        }
        return;
      }
    }

    // ── Unreal Engine → traduzione AI .locres → pak override (_P.pak) ───
    // Se il gioco espone .locres, String it! usa direttamente il flusso
    // "Migliora con AI" del pannello Unreal (upgradeUEWithAI, con toast e
    // progress propri). Senza .locres: messaggio onesto, niente workflow generico.
    {
      const engUe = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
      if (engUe.includes('unreal')) {
        setAutoTranslateError(null);
        setAutoTranslateResult(null);
        setAutoTranslateActive(true);
        const ueSteps = [
          { label: `🔍 ${t('heroJob.unrealStepDetect')}`, status: 'running' as const },
          { label: `✨ ${t('heroJob.unrealStepTranslate')}`, status: 'pending' as const },
        ];
        setAutoTranslateSteps([...ueSteps]);
        try {
          const st = await invoke<{ has_locres?: boolean; locres_count?: number }>(
            'get_unreal_localization_status', { gamePath: game.installPath }
          ).catch(() => null);
          // Serve locres_count > 0: has_locres può essere true con count 0 (es. pak
          // criptati/formato custom) → l'estrazione scansionerebbe GB di pak per
          // minuti prima di fallire. Con 0 stringhe diamo subito il messaggio onesto.
          let quanti = (st?.has_locres && (st?.locres_count ?? 0) > 0) ? (st?.locres_count ?? 0) : 0;
          let dove = '.locres';

          // Su disco niente: i giochi UE5 moderni tengono i .locres DENTRO i
          // container (IoStore .utoc/.ucas) o dentro il .pak, compressi Oodle.
          // I giochi IoStore sono così: 0 file sciolti, tutte le stringhe nel pak. Prima ci si
          // fermava qui dichiarando "nessuna localizzazione estraibile" — falso.
          if (quanti === 0) {
            const daContainer = await invoke<{ entries?: unknown[] }>(
              'extract_iostore_localization', { gamePath: game.installPath }
            ).catch(() => null);
            const n = daContainer?.entries?.length ?? 0;
            if (n > 0) { quanti = n; dove = `${n} stringhe nel pak`; }
          }

          if (quanti > 0) {
            setAutoTranslateSteps([
              { ...ueSteps[0], status: 'done', detail: dove === '.locres' ? `${quanti} .locres` : dove },
              { ...ueSteps[1], status: 'running' },
            ]);
            await upgradeUEWithAI(); // gestisce da sé toast/progress/errori
            setAutoTranslateSteps([
              { ...ueSteps[0], status: 'done', detail: dove === '.locres' ? `${quanti} .locres` : dove },
              { ...ueSteps[1], status: 'done' },
            ]);
          } else {
            // Il gioco non espone testi estraibili (misurato: succede sui giochi
            // UE che tengono tutto in .uasset compressi). Il messaggio resta
            // onesto, ma NON si rimanda l'utente a cercare strumenti: si offre
            // UNA azione cliccabile (principio UN PULSANTE, 04/08/2026 sera).
            // Il toast duplicava parola per parola il pannello: tolto.
            setAutoTranslateSteps([{ ...ueSteps[0], status: 'error', detail: t('heroJob.unrealNoLocres') }]);
            setAutoTranslateError(t('heroJob.unrealNoLocres'));
            toast.error(t('heroJob.unrealNoLocresShort'), {
              action: {
                label: t('heroJob.tryLiveOcr'),
                onClick: () => router.push(`/ocr-translator?gamePath=${encodeURIComponent(game.installPath || '')}`),
              },
              duration: 10000,
            });
          }
        } finally {
          setAutoTranslateBusy(false);
          setAutoTranslateProgress('');
          autoTranslateRunningRef.current = false;
        }
        return;
      }
    }

    // ── Godot → pagina dedicata (niente dirottamento silenzioso) ────────
    // Come per RPG Maker classico: messaggio onesto + azione esplicita verso
    // il Godot Translator (che ora si precompila via ?gamePath=).
    {
      const engG = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
      if (engG.includes('godot')) {
        const godotUrl = `/godot-translator?gamePath=${encodeURIComponent(game.installPath)}&gameName=${encodeURIComponent(game.title || game.name || '')}`;
        setAutoTranslateActive(true);
        setAutoTranslateError(t('heroJob.godotRouteMsg'));
        setAutoTranslateSteps([{ label: t('gameDetail.godotDetected'), status: 'error', detail: t('heroJob.godotRouteMsg') }]);
        toast(t('heroJob.godotRouteToast'), {
          description: t('gameDetail.godotBridgeDesc'),
          action: { label: t('gameDetail.openGodotTranslator'), onClick: () => router.push(godotUrl) },
        });
        setAutoTranslateBusy(false);
        setAutoTranslateProgress('');
        autoTranslateRunningRef.current = false;
        return;
      }
    }

    // ── Auto-routing RPG Maker classico → traduzione live OCR ──
    // RPG Maker MV/MZ ha dati JSON estraibili (path file-based, sotto). Ma RPG_RT
    // classico (2000/2003, e in genere ogni RPG Maker senza stringhe estraibili)
    // NON è patchabile sui file e la cattura GDI è inaffidabile per la cache glifi
    // del font. Per questi instradiamo alla traduzione live OCR (immune alla cache
    // glifi), pre-targettando la finestra del gioco.
    const engLc = (game.engine || engineInfo?.engine || detectEngineByName(game.name || game.title || '') || '').toLowerCase();
    if (engLc.includes('rpg maker') || engLc.includes('rpgmaker')) {
      try {
        const rpgInfo = await invoke<{ version?: string }>('detect_rpgmaker_game', { gamePath: game.installPath });
        const v = (rpgInfo?.version || '').toLowerCase();
        const isMvMz = v === 'mv' || v === 'mz';
        let strings = translationStrategy?.stringCount ?? -1;
        if (!isMvMz && strings < 0) {
          const extraction = await invoke<{ total_count?: number }>('extract_all_rpgmaker_strings', { gamePath: game.installPath }).catch(() => ({ total_count: 0 }));
          strings = extraction?.total_count || 0;
        }
        if (!isMvMz && strings <= 0) {
          // RPG Maker classico (RPG_RT 2000/2003): nessuna stringa estraibile dai file →
          // la traduzione automatica file-based NON è supportata. Niente dirottamento
          // silenzioso: messaggio onesto + scelta esplicita di aprire la traduzione live OCR.
          const params = new URLSearchParams({
            game: game.title || game.name || '',
            // Classico ≈ quasi sempre giapponese (Yume Nikki, Ib, The Witch's House…) → OCR src 'ja'.
            src: 'ja',
            tgt: targetLang || language || 'it',
            autostart: '1',
          });
          setAutoTranslateActive(true);
          setAutoTranslateError("RPG Maker classico (RPG_RT 2000/2003): questo motore non espone stringhe estraibili dai file, quindi la traduzione automatica file-based non è supportata. Per questi giochi usa la traduzione live OCR (cattura a schermo).");
          setAutoTranslateSteps([{ label: 'RPG Maker classico rilevato', status: 'error', detail: 'Traduzione file-based non disponibile — usa OCR live' }]);
          toast('RPG Maker classico: usa la traduzione live OCR', {
            description: 'Niente stringhe estraibili dai file per questo motore.',
            action: { label: 'Apri OCR', onClick: () => router.push(`/ocr-translator?${params.toString()}`) },
          });
          setAutoTranslateBusy(false);
          setAutoTranslateProgress('');
          autoTranslateRunningRef.current = false;
          return;
        }

        // ── RPG Maker MV/MZ → pipeline hero file-based dedicata (col pannello) ──
        if (isMvMz) {
          const tgt = (targetLang || language || 'it').toLowerCase();
          const t0 = Date.now();
          const rmSteps = [
            { label: '🔍 Rilevamento RPG Maker MV/MZ', status: 'pending' as const },
            { label: '📂 Estrazione stringhe (data/*.json)', status: 'pending' as const },
            { label: '📖 Glossario', status: 'pending' as const },
            { label: '✨ Traduzione AI', status: 'pending' as const },
            { label: '💾 Backup + applica ai file', status: 'pending' as const },
          ];
          const rmStep = (idx: number, status: 'running' | 'done' | 'error', detail?: string) =>
            setAutoTranslateSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, detail } : i < idx ? { ...s, status: 'done' } : s));
          // Tracking trasversale: guardia + progress globale + tray + Progetti
          const rmTracker = startHeroTracking(progress, {
            engineId: 'rpgmaker', engineLabel: 'RPG Maker', gamePath: game.installPath,
            gameId: game.id || game.appid?.toString() || gameId, gameName: game.name || game.title,
            gameImage: game.headerImage || game.coverUrl, sourceLang: 'en', targetLang: tgt,
            opTitle: t('heroJob.jobTitle').replace('{name}', game.name || game.title || 'RPG Maker'),
            opDesc: t('heroJob.jobDescBg').replace('{engine}', 'RPG Maker'),
          });
          if (!rmTracker) {
            toast.info(t('heroJob.alreadyRunning'));
            setAutoTranslateBusy(false); autoTranslateRunningRef.current = false;
            return;
          }
          setAutoTranslateError(null);
          setAutoTranslateResult(null);
          setAutoTranslateSteps([...rmSteps]);
          setAutoTranslateActive(true);
          try {
            const r = await runRpgmakerTranslation({
              gamePath: game.installPath,
              targetLang: tgt,
              sourceLang: 'en',
              gameId: game.id || (game.appid ? String(game.appid) : undefined),
              onProgress: (p) => {
                if (p.phase === 'detect') rmStep(0, 'running');
                else if (p.phase === 'extract') { rmStep(0, 'done'); rmStep(1, 'running'); }
                else if (p.phase === 'glossary') { rmStep(1, 'done'); rmStep(2, 'running'); }
                else if (p.phase === 'translate') {
                  rmStep(2, 'done');
                  rmStep(3, 'running', `${p.done}/${p.total}`);
                  setAutoTranslateProgress(p.total ? `${p.done}/${p.total}` : '');
                  rmTracker.onProgress(p.done, p.total);
                } else if (p.phase === 'apply') { rmStep(3, 'done'); rmStep(4, 'running', `${p.done}/${p.total} file`); }
                else if (p.phase === 'done') rmStep(4, 'done');
              },
            });
            rmStep(4, 'done', `${r.translated}/${r.total} stringhe · ${r.files} file${r.glossaryTerms ? ` · glossario ${r.glossaryTerms}` : ''}`);
            setAutoTranslateResult({
              successRate: r.total ? Math.round((100 * r.translated) / r.total) : 0,
              duration: Math.round((Date.now() - t0) / 60000), // MINUTI: il banner scrive "min" (il 03/08 mostrava 11731 "min" che erano secondi)
              deliverables: r.files,
              errors: Math.max(0, r.total - r.translated),
              engine: `RPG Maker ${r.version.toUpperCase()}`,
              targetLang: tgt,
              stringsTranslated: r.translated,
              stringsTotal: r.total,
              verification: {
                checked: 1, verified: r.translated > 0 ? 1 : 0, missing: [],
                verifiedNames: r.translated > 0 ? [`RPG Maker ${r.version.toUpperCase()}`] : [],
                stringsWritten: r.translated, runtimeOnly: false,
              },
            });
            await rmTracker.done(r.translated, r.total);
            toast.success(`RPG Maker ${r.version.toUpperCase()}: ${r.translated}/${r.total} stringhe applicate a ${r.files} file. Rilancia il gioco.`);
          } catch (e) {
            rmStep(3, 'error', String(e));
            setAutoTranslateError(`RPG Maker: ${String(e)} — Ollama è avviato?`);
            await rmTracker.fail(e);
            toast.error(t('gameDetail.errRpgMaker'), { description: String(e) });
          } finally {
            setAutoTranslateBusy(false);
            setAutoTranslateProgress('');
            autoTranslateRunningRef.current = false;
          }
          return;
        }
      } catch { /* detect fallito → prosegui col workflow file-based normale */ }
    }

    setAutoTranslateActive(true);
    setAutoTranslateError(null);
    setAutoTranslateStep(0);

    // Use the new complete workflow system
    const workflowSteps = [
      { label: '🔍 Analisi completa del gioco', status: 'pending' as const },
      { label: '🛠️ Selezione tool ottimali', status: 'pending' as const },
      { label: '🤖 Configurazione LLM chains', status: 'pending' as const },
      { label: '🎵 Analisi file multimediali', status: 'pending' as const },
      { label: '💾 Creazione backup intelligente', status: 'pending' as const },
      { label: '⚡ Orchestrazione workflow', status: 'pending' as const },
      { label: '🚀 Esecuzione traduzione completa', status: 'pending' as const },
      { label: '✅ Test e validazione finale', status: 'pending' as const },
    ];
    setAutoTranslateSteps([...workflowSteps]);

    // ── Telemetria di compatibilità (opt-in, fail-open) ──
    // Un run_id per l'intero fast path; lo stage avanza con il flusso e viene
    // riportato solo se l'utente ha attivato l'opzione nelle impostazioni.
    const compatRunId = newCompatRunId();
    const compatGame = compatRefFor(game);
    let compatStage: 'scan' | 'detect' | 'extract' | 'translate' | 'patch' = 'scan';
    const compatLang = targetLang || language || 'it';

    const updateStep = (idx: number, status: 'running' | 'done' | 'error', detail?: string) => {
      setAutoTranslateStep(idx);
      setAutoTranslateSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, detail } : i < idx ? { ...s, status: 'done' } : s));
    };

    let unlistenWorkflow: (() => void) | null = null;

    try {
      // ── STEP 1: Complete Analysis ──
      updateStep(0, 'running', 'Analisi predittiva avanzata...');
      
      interface PredictionResult {
        engine?: string;
        selectedTools?: {primary_text_tool?: {name?: string}};
        llmChains?: unknown[];
        multimediaAnalysis?: {audioStats?: {totalAudioFiles?: number}; graphicsStats?: {totalGraphicsFiles?: number}};
        backupStrategy?: {estimatedBackupSizeMb?: number; recommendedBackupType?: string};
        workflowPlan?: {recommendedApproach?: string; workflowStages?: unknown[]};
      }
      const predictionResult = await invoke<PredictionResult>('analyze_game_translation', {
        installPath: game.installPath,
        gameTitle: game.title || game.name || 'Unknown Game',
        engine: game.engine || undefined,
        sourceLang: 'en',
        targetLang: targetLang || language || 'it',
      });
      
      updateStep(0, 'done', `Analisi completata: ${predictionResult?.engine || 'Engine rilevato'}`);
      compatStage = 'extract';
      await new Promise(r => setTimeout(r, 800));

      // ── STEP 2: Tool Selection ──
      updateStep(1, 'running', 'Selezione tool ottimali...');
      await new Promise(r => setTimeout(r, 600));
      updateStep(1, 'done', `${predictionResult?.selectedTools?.primary_text_tool?.name || 'Tool automatici'} selezionati`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 3: LLM Chains ──
      updateStep(2, 'running', 'Configurazione LLM chains...');
      await new Promise(r => setTimeout(r, 600));
      updateStep(2, 'done', `${predictionResult?.llmChains?.length || 0} LLM chains configurate`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 4: Multimedia Analysis ──
      updateStep(3, 'running', 'Analisi file multimediali...');
      await new Promise(r => setTimeout(r, 600));
      const multimediaData = predictionResult?.multimediaAnalysis;
      const audioFiles = multimediaData?.audioStats?.totalAudioFiles || 0;
      const graphicsFiles = multimediaData?.graphicsStats?.totalGraphicsFiles || 0;
      updateStep(3, 'done', `${audioFiles} audio, ${graphicsFiles} grafiche analizzate`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 5: Backup Strategy ──
      updateStep(4, 'running', 'Creazione backup intelligente...');
      await new Promise(r => setTimeout(r, 600));
      const backupData = predictionResult?.backupStrategy;
      const backupSize = backupData?.estimatedBackupSizeMb || 0;
      updateStep(4, 'done', `Backup ${backupData?.recommendedBackupType || 'Smart'}: ${backupSize.toFixed(1)}MB`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 6: Workflow Planning ──
      updateStep(5, 'running', 'Orchestrazione workflow...');
      await new Promise(r => setTimeout(r, 600));
      const workflowData = predictionResult?.workflowPlan;
      const approach = workflowData?.recommendedApproach || 'SemiAutomated';
      const stages = workflowData?.workflowStages?.length || 0;
      updateStep(5, 'done', `Workflow ${approach}: ${stages} stadi`);
      await new Promise(r => setTimeout(r, 400));

      // ── STEP 7: Complete Execution with real-time progress ──
      updateStep(6, 'running', 'Esecuzione traduzione completa...');
      compatStage = 'translate';
      
      // Listen for real-time progress events from backend
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenWorkflow = await listen<{stage: string, step: number, message: string, progress: number}>('workflow-progress', (event) => {
          const { message, progress } = event.payload;
          updateStep(6, 'running', `${message} (${progress}%)`);
        });
      } catch { /* non-Tauri env */ }

      const executionResult = await invoke<{
        successRate?: number; totalDurationMinutes?: number; finalStatus?: string;
        deliverables?: unknown[]; errors?: unknown[]; nextSteps?: string[];
        translatedStrings?: number; totalStrings?: number;
      }>('execute_complete_workflow', {
        installPath: game.installPath,
        gameTitle: game.title || game.name || 'Unknown Game',
        engine: game.engine || undefined,
        sourceLang: 'en',
        targetLang: targetLang || language || 'it',
      });

      // Cleanup listener
      if (unlistenWorkflow) unlistenWorkflow();

      const success = executionResult?.successRate || 0;
      const duration = executionResult?.totalDurationMinutes || 0;
      const finalStatus = executionResult?.finalStatus;
      const workflowFailed = finalStatus === 'Failed';

      if (!workflowFailed && success >= 0.8) {
        updateStep(6, 'done', `Traduzione completata: ${(success * 100).toFixed(0)}% successo in ${duration.toFixed(1)}min`);
      } else if (workflowFailed) {
        // Fix issue #46: niente verde se il gioco non è stato modificato davvero
        const hint = executionResult?.nextSteps?.[0] || 'Prova il patcher engine-specific dalla pagina del gioco';
        updateStep(6, 'error', `Il gioco NON è stato tradotto — ${hint}`);
      } else {
        updateStep(6, 'error', `Parzialmente completata: ${(success * 100).toFixed(0)}% successo`);
      }
      await new Promise(r => setTimeout(r, 800));

      // ── STEP 8: Final Validation ──
      updateStep(7, 'running', 'Test e validazione finale...');
      await new Promise(r => setTimeout(r, 600));
      
      const deliverables = executionResult?.deliverables || [];
      const errors = executionResult?.errors || [];
      const totalStr = executionResult?.totalStrings || 0;

      // Messaggio onesto: nessun deliverable e nessuna stringa estraibile = motore non
      // supportato (file-based) o niente da tradurre. Niente falso "successo".
      if (deliverables.length === 0 && totalStr === 0) {
        void reportCompatStep({
          runId: compatRunId, game: compatGame,
          engine: predictionResult?.engine || game.engine,
          step: workflowFailed ? 'patch' : 'extract', result: 'failure',
          targetLang: compatLang,
          errorCategory: workflowFailed ? 'patch_write' : 'no_strings',
        });
        updateStep(7, 'error', 'Nessuna stringa estraibile da questo gioco');
        setAutoTranslateError(
          `Il motore "${predictionResult?.engine || game.engine || 'sconosciuto'}" non è ancora supportato per la traduzione automatica sui file, oppure non sono state trovate stringhe estraibili. Opzioni: prova l'OCR overlay (per giochi che mostrano testo a runtime) o la traduzione manuale dal patcher dedicato.`
        );
        toast.error(t('gameDetail.errUnsupported'));
        return; // → finally resetta lo stato; nessun result di "successo"
      }

      if (errors.length === 0) {
        updateStep(7, 'done', `✅ ${deliverables.length} deliverables creati, 0 errori`);
      } else {
        updateStep(7, 'done', `⚠️ ${deliverables.length} deliverables creati, ${errors.length} errori`);
      }

      // Telemetria: esito finale della run (patch riuscita/parziale/fallita).
      if (workflowFailed) {
        void reportCompatStep({
          runId: compatRunId, game: compatGame,
          engine: predictionResult?.engine || game.engine,
          step: 'patch', result: 'failure',
          stringsTotal: totalStr,
          targetLang: compatLang, errorCategory: 'patch_write',
        });
      } else {
        void reportCompatStep({
          runId: compatRunId, game: compatGame,
          engine: predictionResult?.engine || game.engine,
          step: 'patch', result: success >= 0.8 ? 'success' : 'partial',
          stringsTotal: totalStr,
          stringsTranslated: executionResult?.translatedStrings || 0,
          targetLang: compatLang,
        });
        setPendingBootCheck({
          runId: compatRunId, gameKey: compatGame.key, gameName: compatGame.name,
          targetLang: compatLang, engine: predictionResult?.engine || game.engine,
        });
        // Telemetria OFF? Propone l'opt-in una sola volta (report retroattivo se accetta).
        maybeOfferCompatOptIn({
          runId: compatRunId, game: compatGame,
          engine: predictionResult?.engine || game.engine,
          result: success >= 0.8 ? 'success' : 'partial',
          stringsTotal: totalStr,
          stringsTranslated: executionResult?.translatedStrings || 0,
          targetLang: compatLang,
        });
      }

      // ── VERIFICA DELL'EFFETTO (post-translation-truth) ──
      // "Completata al 100% con 0 errori" col gioco ancora in inglese è la
      // segnalazione più dettagliata del triage 26/07.
      //
      // Prima versione (28/07): si controllava che i file dichiarati dal
      // motore esistessero su disco. CORREZIONE 29/07 — quella verifica
      // passava sempre, quindi non verificava niente: cinque motori su sette
      // dichiarano come filePath la CARTELLA DEL GIOCO, e report, backup e
      // cartella delle traduzioni li scriviamo noi durante il run. Tutta
      // roba che esiste anche a patch completamente inefficace.
      //
      // Ora la prova la porta il backend: `proof` dice se il deliverable
      // dimostra qualcosa ('patched' = scritture nel gioco, 'runtime' =
      // loader installato che tradurrà giocando, 'none' = sottoprodotto) e
      // `stringsWritten` porta il contatore vero del patcher. L'esistenza su
      // disco resta come controprova per i deliverable probanti, ma da sola
      // non basta più a fare il verde.
      type Deliv = {
        filePath?: string | null;
        deliverableName?: string;
        proof?: 'patched' | 'runtime' | 'none';
        stringsWritten?: number;
      };
      const declared = deliverables as Deliv[];
      // Solo i deliverable che pretendono di aver cambiato il gioco.
      const proving = declared.filter(d => d?.proof === 'patched' || d?.proof === 'runtime');
      // Un 'patched' che dichiara 0 stringhe non ha scritto niente: non prova.
      const effective = proving.filter(d => d?.proof === 'runtime' || (d?.stringsWritten ?? 0) > 0);
      const stringsWritten = declared.reduce(
        (n, d) => n + (d?.proof === 'patched' ? (d?.stringsWritten ?? 0) : 0), 0,
      );
      const runtimeOnly = effective.length > 0 && effective.every(d => d?.proof === 'runtime');

      const missingPaths: string[] = [];
      const verifiedNames: string[] = [];
      for (const d of effective) {
        const name = d?.deliverableName || d?.filePath || '';
        if (!d?.filePath) {
          // Nessun percorso da controllare: la prova resta il contatore.
          verifiedNames.push(name);
          continue;
        }
        try {
          const exists = await invoke<boolean>('check_path_exists', { path: d.filePath });
          if (exists) verifiedNames.push(name); else missingPaths.push(d.filePath);
        } catch {
          // Check non eseguibile (comando assente, permessi): fail-open sul
          // contatore del patcher, che è comunque la prova principale. Si
          // conta come verificato — se invece lo si scartasse, un ambiente in
          // cui check_path_exists fallisce sempre trasformerebbe ogni patch
          // riuscita in un falso allarme.
          verifiedNames.push(name);
        }
      }

      // Save result for completion wizard
      setAutoTranslateResult({
        // `success` qui è in scala 0-1 (dal success_rate Rust), ma il campo
        // successRate del wizard viaggia in PERCENTO come negli altri 4
        // percorsi: convertiamo QUI, alla frontiera — non nel componente.
        successRate: Math.round(success * 100),
        duration,
        deliverables: deliverables.length,
        errors: errors.length,
        engine: game.engine || 'Unknown',
        targetLang: targetLang || language || 'it',
        stringsTranslated: executionResult?.translatedStrings || executionResult?.totalStrings || 0,
        stringsTotal: executionResult?.totalStrings || 0,
        verification: {
          checked: proving.length,
          verified: verifiedNames.length,
          missing: missingPaths,
          verifiedNames,
          stringsWritten,
          runtimeOnly,
        },
      });

    } catch (error: unknown) {
      clientLogger.error('[AutoTranslate] Workflow execution failed:', String(error));
      void reportCompatStep({
        runId: compatRunId, game: compatGame, engine: game.engine,
        step: compatStage, result: 'failure',
        targetLang: compatLang, errorCategory: classifyCompatError(error),
      });
      void reportCrash({ error, area: 'pipeline', engine: game.engine, gameKey: compatGame.key });
      setAutoTranslateError(String(error) || 'Errore durante l\'esecuzione del workflow');
      toast.error(t('common.erroreDuranteLaTraduzioneAutomatica'));
      // Cleanup workflow listener on error too
      if (unlistenWorkflow) unlistenWorkflow();
    } finally {
      autoTranslateRunningRef.current = false;
      setAutoTranslateBusy(false);
      setAutoTranslateProgress('');
    }
  };

  // ═══ MIGLIORA CON AI ═══
  const upgradeWithAI = async () => {
    if (!game?.installPath || isAiUpgrading) return;
    setIsAiUpgrading(true);
    setAiUpgradeProgress(null);

    try {
      const gameName = game.title || game.name || 'Game';
      const lang = language || 'it';

      // 1. Leggi stringhe catturate
      interface CapturedEntry { original: string; translated: string; line_number: number; }
      const captured = await invoke<CapturedEntry[]>('read_captured_translations', {
        gamePath: game.installPath,
        lang,
      });

      if (!captured || captured.length === 0) {
        toast.error(t('gameDetail.errNoStringsCaptured'));
        return;
      }

      // 2. Filtra stringhe non ancora tradotte (tradotto = originale, oppure vuoto)
      const toTranslate = captured.filter(e => !e.translated || e.translated === e.original);
      const alreadyTranslated = captured.filter(e => e.translated && e.translated !== e.original);
      const total = toTranslate.length;
      setAiUpgradeProgress({ current: 0, total });

      toast.info(`Traduco ${total} stringhe con AI (${alreadyTranslated.length} già tradotte)...`);

      // 3. Traduci in batch da 15 stringhe alla volta
      const BATCH = 15;
      const translated: CapturedEntry[] = [...alreadyTranslated];

      // Contatori di QUESTA sessione: `translated` parte da `alreadyTranslated`,
      // quindi contare su di lui direbbe "tradotte" anche stringhe già presenti
      // da prima. È la stessa aritmetica compiacente del toast GameMaker.
      let cambiateOra = 0;
      let fallitiOra = 0;

      for (let i = 0; i < toTranslate.length; i += BATCH) {
        const batch = toTranslate.slice(i, i + BATCH);

        // Stesso difetto del path Unreal: il comando ritorna { translated_text },
        // non una stringa. Con `invoke<string>` ogni batch andava in eccezione.
        const parts = await traduciConSplit(batch.map(e => e.original), lang);
        batch.forEach((e, idx) => {
          const tr = parts[idx];
          if (tr && tr !== e.original) cambiateOra++; else fallitiOra++;
          translated.push({
            original: e.original,
            translated: tr || e.original,
            line_number: e.line_number,
          });
        });

        setAiUpgradeProgress({ current: Math.min(i + BATCH, total), total });
      }

      // Nessuna stringa cambiata = file di traduzione identico all'originale:
      // si scriverebbe senza errori e il gioco resterebbe in lingua originale.
      if (cambiateOra === 0) {
        clientLogger.error(`[AiUpgrade] 0 stringhe cambiate su ${toTranslate.length} (${fallitiOra} fallite): file NON scritto`);
        toast.error(t('gameDetail.errNoTranslationEffect'), {
          description: `0/${toTranslate.length} — ${fallitiOra} ${t('common.failed')}`,
        });
        return;
      }

      // 4. Scrivi file di traduzione statica
      const resultPath = await invoke<string>('write_translation_file', {
        gamePath: game.installPath,
        lang,
        gameName,
        entries: translated,
      });

      if (fallitiOra > 0) {
        toast.warning(`${cambiateOra}/${toTranslate.length} ${t('gameDetail.stringsTranslated')} — ${fallitiOra} ${t('common.failed')}`);
      } else {
        toast.success(`✅ ${cambiateOra} ${t('gameDetail.stringsTranslated')}`);
      }
      clientLogger.debug('[AiUpgrade] File scritto:', resultPath);

    } catch (e: unknown) {
      clientLogger.error('[AiUpgrade] Errore:', String(e));
      toast.error(`Errore traduzione AI: ${String(e) || 'sconosciuto'}`);
    } finally {
      setIsAiUpgrading(false);
      setAiUpgradeProgress(null);
    }
  };

  const _getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'steam': return 'bg-blue-500/10 text-blue-500';
      case 'epic games': return 'bg-gray-500/10 text-gray-500';
      case 'gog': return 'bg-purple-500/10 text-purple-500';
      case 'ea app': return 'bg-orange-500/10 text-orange-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-transparent overflow-hidden">
        {/* Header skeleton */}
        <div className="h-14 border-b border-slate-800/40 bg-slate-950/90 backdrop-blur-2xl flex items-center gap-3 px-5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-slate-800/40 animate-pulse" />
          <div className="h-px w-px bg-slate-800/60" />
          <div className="w-7 h-7 rounded-lg bg-slate-800/40 animate-pulse" />
          <div className="w-40 h-4 rounded-md bg-slate-800/40 animate-pulse" />
          <div className="ml-auto w-9 h-9 rounded-xl bg-slate-800/30 animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[1400px] mx-auto space-y-4">
            {/* Hero card skeleton */}
            <div className="rounded-2xl border border-slate-800/20 bg-slate-900/20 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-800/5 to-transparent animate-[shimmer_2s_infinite] pointer-events-none" style={{backgroundSize: '200% 100%'}} />
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-[250px] shrink-0 p-5">
                  <div className="aspect-[2/3] w-full rounded-xl bg-slate-800/30 animate-pulse" />
                </div>
                <div className="flex-1 p-6 space-y-4">
                  <div className="w-3/4 h-8 rounded-lg bg-slate-800/30 animate-pulse" />
                  <div className="w-1/3 h-3 rounded bg-slate-800/20 animate-pulse" />
                  <div className="space-y-2 mt-4">
                    <div className="w-full h-3.5 rounded bg-slate-800/20 animate-pulse" />
                    <div className="w-5/6 h-3.5 rounded bg-slate-800/20 animate-pulse" />
                    <div className="w-2/3 h-3.5 rounded bg-slate-800/20 animate-pulse" />
                  </div>
                  <div className="flex gap-2 mt-5">
                    {[1,2,3,4].map(i => <div key={i} className="w-20 h-7 rounded-lg bg-slate-800/20 animate-pulse" />)}
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800/20">
                    {[1,2,3].map(i => <div key={i} className="w-24 h-8 rounded-lg bg-slate-800/20 animate-pulse" />)}
                  </div>
                </div>
              </div>
            </div>
            {/* CTA skeleton */}
            <div className="w-full h-14 rounded-xl bg-indigo-500/5 border border-indigo-500/10 animate-pulse" />
            {/* Screenshot skeleton */}
            <div className="rounded-2xl border border-slate-800/20 bg-slate-900/15 p-4 space-y-2">
              <div className="w-full aspect-video rounded-xl bg-slate-800/20 animate-pulse" />
              <div className="grid grid-cols-5 gap-1.5">
                {[1,2,3,4,5].map(i => <div key={i} className="aspect-video rounded-lg bg-slate-800/15 animate-pulse" />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center bg-transparent">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-slate-900/60 border border-slate-800/50 flex items-center justify-center">
            <Gamepad2 className="h-8 w-8 text-slate-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-300">{t('common.giocoNonTrovato')}</h1>
          <p className="text-sm text-slate-500 max-w-sm">{t('gameDetail.notInLibrary')}</p>
          <Link href="/library">
            <Button variant="outline" className="mt-2 h-10 px-5 bg-slate-900/50 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-2" /> {t('gameDetail.backToLibrary')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Determina colore gradiente in base al genere
  const getGenreGradient = () => {
    const firstGenre = game?.genres?.[0];
    const genre = (typeof firstGenre === 'string' ? firstGenre : firstGenre?.description)?.toLowerCase() || '';
    if (genre.includes('horror') || genre.includes('survival')) {
      return {
        border: 'border-red-500/20',
        bg: 'bg-gradient-to-r from-red-950/80 via-rose-950/60 to-orange-950/80',
        blur1: 'bg-red-500/10',
        blur2: 'bg-orange-500/10',
        text: 'from-red-300 via-rose-300 to-orange-300',
        accent: 'text-red-400',
        accent2: 'text-orange-400',
        borderLine: 'border-red-500/20'
      };
    } else if (genre.includes('action') || genre.includes('shooter')) {
      return {
        border: 'border-amber-500/20',
        bg: 'bg-gradient-to-r from-amber-950/80 via-orange-950/60 to-red-950/80',
        blur1: 'bg-amber-500/10',
        blur2: 'bg-red-500/10',
        text: 'from-amber-300 via-orange-300 to-red-300',
        accent: 'text-amber-400',
        accent2: 'text-orange-400',
        borderLine: 'border-amber-500/20'
      };
    } else if (genre.includes('rpg') || genre.includes('role')) {
      return {
        border: 'border-purple-500/20',
        bg: 'bg-gradient-to-r from-purple-950/80 via-violet-950/60 to-indigo-950/80',
        blur1: 'bg-purple-500/10',
        blur2: 'bg-indigo-500/10',
        text: 'from-purple-300 via-violet-300 to-indigo-300',
        accent: 'text-purple-400',
        accent2: 'text-violet-400',
        borderLine: 'border-purple-500/20'
      };
    } else if (genre.includes('strategy') || genre.includes('simulation')) {
      return {
        border: 'border-emerald-500/20',
        bg: 'bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-cyan-950/80',
        blur1: 'bg-emerald-500/10',
        blur2: 'bg-cyan-500/10',
        text: 'from-emerald-300 via-teal-300 to-cyan-300',
        accent: 'text-emerald-400',
        accent2: 'text-teal-400',
        borderLine: 'border-emerald-500/20'
      };
    } else if (genre.includes('adventure') || genre.includes('indie')) {
      return {
        border: 'border-sky-500/20',
        bg: 'bg-gradient-to-r from-sky-950/80 via-blue-950/60 to-indigo-950/80',
        blur1: 'bg-sky-500/10',
        blur2: 'bg-indigo-500/10',
        text: 'from-sky-300 via-blue-300 to-indigo-300',
        accent: 'text-sky-400',
        accent2: 'text-blue-400',
        borderLine: 'border-sky-500/20'
      };
    } else if (genre.includes('sport') || genre.includes('racing')) {
      return {
        border: 'border-green-500/20',
        bg: 'bg-gradient-to-r from-green-950/80 via-lime-950/60 to-emerald-950/80',
        blur1: 'bg-green-500/10',
        blur2: 'bg-lime-500/10',
        text: 'from-green-300 via-lime-300 to-emerald-300',
        accent: 'text-green-400',
        accent2: 'text-lime-400',
        borderLine: 'border-green-500/20'
      };
    }
    // Default scuro elegante
    return {
      border: 'border-slate-500/20',
      bg: 'bg-gradient-to-br from-slate-900/80 via-slate-950/40 to-slate-900/80',
      blur1: 'bg-slate-500/5',
      blur2: 'bg-gray-500/5',
      text: 'from-slate-300 via-gray-300 to-slate-400',
      accent: 'text-slate-400',
      accent2: 'text-gray-400',
      borderLine: 'border-slate-500/20',
      button: 'from-slate-700 to-slate-600 shadow-slate-500/20'
    };
  };

  const theme = getGenreGradient();

  const heroImg = game.heroUrl || game.headerUrl || fallbackImage || '';
  const engineLabel = engineInfo?.engine || game.engine;
  const showEngine = engineLabel && engineLabel !== 'Unknown' && engineLabel !== 'Sconosciuto';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#0a0e14] overflow-hidden">

      {/* ═══ IMMERSIVE HERO — fullwidth ═══ */}
      <div className="relative shrink-0 overflow-hidden" style={{ minHeight: 340 }}>
        {/* BG image */}
        {heroImg && (
          <div className="absolute inset-0">
            <img
              src={heroImg}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                // Fallback chain: library_hero -> page_bg_generated -> capsule_616x353 -> SteamGridDB
                if (game.appid && game.appid > 0) {
                  if (img.src.includes('library_hero')) {
                    img.src = `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/page_bg_generated_v6b.jpg`;
                    return;
                  }
                  if (img.src.includes('page_bg_generated')) {
                    img.src = `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/capsule_616x353.jpg`;
                    return;
                  }
                }
                if (!fallbackImage) {
                  fetchFallbackImage();
                  img.style.display = 'none';
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e14] via-[#0a0e14]/70 to-[#0a0e14]/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e14]/90 via-transparent to-[#0a0e14]/60" />
          </div>
        )}
        {!heroImg && <div className={`absolute inset-0 ${theme.bg}`} />}
        <div className={`absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-[120px] ${theme.blur1} opacity-20 pointer-events-none`} />

        {/* Back button (floating) */}
        <Link href="/library" className="absolute top-4 left-4 z-20">
          <button className="h-9 w-9 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>

        {/* Metacritic score (floating top-right) — cliccabile se URL disponibile */}
        {game?.metacritic && game.metacritic.score > 0 && (
          <a
            href={game.metacritic.url || `https://www.metacritic.com/search/${encodeURIComponent(game.title || '')}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-6 z-20 flex flex-col items-center gap-1 group cursor-pointer"
            title={t('gameDetail.openMetacritic')}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shadow-lg transition-transform group-hover:scale-110 ${
              game.metacritic.score >= 75 ? 'bg-[#66cc33]' : game.metacritic.score >= 50 ? 'bg-[#ffcc33]' : 'bg-[#ff0000]'
            }`}>
              {game.metacritic.score}
            </div>
            <span className="text-2xs font-bold uppercase tracking-widest text-white/50 group-hover:text-white/80 transition-colors">Metacritic</span>
          </a>
        )}

        {/* Hero content overlay */}
        <div className="relative z-10 flex items-end gap-6 px-6 pb-6 pt-16 max-w-[1400px] mx-auto">
          {/* Cover */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="shrink-0 hidden lg:block"
          >
            <div className="relative w-[180px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10 group">
              {(() => {
                // Priorità: fallbackImage (SteamGridDB) > coverUrl (library_600x900) > heroImg
                const coverSrc = fallbackImage || game.coverUrl || heroImg;
                return coverSrc && !imageError ? (
                  <img
                    src={coverSrc}
                    alt={t('gameDetail.cover')}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={() => {
                      // Se library_600x900 fallisce, triggera fetch SteamGridDB; altrimenti mostra placeholder
                      if (!fallbackImage) {
                        fetchFallbackImage();
                      } else {
                        setImageError(true);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center"><Gamepad2 className="h-10 w-10 text-slate-600" /></div>
                );
              })()}
              <button className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-all text-2xs font-bold uppercase tracking-wider flex items-center gap-1" onClick={() => setIsCoverPickerOpen(true)}>
                <ImageIcon className="h-2.5 w-2.5" /> {t('gameDetail.cover')}</button>
            </div>
          </motion.div>

          {/* Title + meta */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="flex-1 min-w-0 space-y-3"
          >
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-2xs font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                game.platform === 'Steam' ? 'text-blue-300 bg-blue-500/15 border-blue-500/25' :
                game.platform === 'GOG' ? 'text-violet-300 bg-violet-500/15 border-violet-500/25' :
                'text-slate-300 bg-white/10 border-white/15'
              }`}>{game.platform || 'Steam'}</span>
              {showEngine && (
                <span className="text-2xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-md text-sky-300 bg-sky-500/15 border border-sky-500/25 flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> {engineLabel}
                </span>
              )}
              {game.isInstalled && (
                <span className="text-2xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-md text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" /> {t('gameDetails.installed')}</span>
              )}
              {isDetectingEngine && <Settings className="h-3.5 w-3.5 text-slate-500 animate-spin" />}
            </div>

            {/* Title */}
            <h1 className={`text-2xl lg:text-4xl font-black tracking-tight bg-gradient-to-r ${theme.text} bg-clip-text text-transparent leading-[1.05] drop-shadow-lg`}>
              {game.title || game.name}
            </h1>

            {/* Developer + release */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {game.developers?.[0] && <span className="font-semibold text-slate-300">{game.developers[0]}</span>}
              {game.developers?.[0] && game.publishers?.[0] && game.developers[0] !== game.publishers[0] && <><span className="text-slate-600">|</span><span>{game.publishers[0]}</span></>}
              {((typeof game.release_date === 'object' && game.release_date?.date) || game.releaseDate) && <><span className="text-slate-600">|</span><span>{(typeof game.release_date === 'object' ? game.release_date?.date : game.release_date) || (typeof game.releaseDate === 'string' ? game.releaseDate : game.releaseDate ? new Date(Number(game.releaseDate) * 1000).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { year: 'numeric', month: 'short' }) : '')}</span></>}
            </div>

            {/* Genre pills + scores inline */}
            <div className="flex items-center gap-2 flex-wrap">
              {game.genres?.filter(g => typeof g === 'object' && g?.description).slice(0, 4).map((genre, i) => (
                <span key={i} className="text-2xs font-semibold px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-slate-300">{typeof genre === 'object' ? genre.description : genre}</span>
              ))}
              {typeof game.recommendations === 'object' && game.recommendations != null && (game.recommendations.total ?? 0) > 0 && (
                <span className="text-2xs font-bold px-2.5 py-1 rounded-md text-sky-300 bg-sky-500/10 border border-sky-500/15">👍 {(game.recommendations.total ?? 0).toLocaleString()}</span>
              ) || typeof game.recommendations === 'number' && game.recommendations > 0 && (
                <span className="text-2xs font-bold px-2.5 py-1 rounded-md text-sky-300 bg-sky-500/10 border border-sky-500/15">👍 {game.recommendations.toLocaleString()}</span>
              )}
              {(game.playtime_forever ?? 0) > 0 && (
                <span className="text-2xs font-bold px-2.5 py-1 rounded-md text-violet-300 bg-violet-500/10 border border-violet-500/15 flex items-center gap-1"><Clock className="h-3 w-3" /> {Math.round((game.playtime_forever ?? 0) / 60)}h</span>
              )}
            </div>

            {/* Lingue del gioco — rilevate dai file di localizzazione (+ Steam se presenti) */}
            {(() => {
              const fromSteam = typeof game.supported_languages === 'string'
                ? game.supported_languages.split(',').map(s => s.replace(/<[^>]*>/g, '').replace(/\*/g, '').trim()).filter(Boolean)
                : [];
              const seen = new Set<string>();
              const merged: string[] = [];
              for (const l of [...detectedLanguages, ...fromSteam]) {
                const key = getCountryCode(l) ?? l.trim().toLowerCase();
                if (key && !seen.has(key)) { seen.add(key); merged.push(l.trim()); }
              }
              if (merged.length === 0) return null;
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Languages className="h-3 w-3" /> {t('gameDetails.gameLanguages') || 'Lingue'}
                  </span>
                  <LanguageFlags supportedLanguages={merged} maxFlags={12} />
                  <span className="text-2xs text-slate-500">({merged.length})</span>
                </div>
              );
            })()}
          </motion.div>

          {/* Action buttons (right side — desktop) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="shrink-0 hidden lg:flex flex-col gap-2 items-stretch w-[200px]"
          >
            {highlightStringIt && (
              <style>{`
                @keyframes firstGamePulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(129,140,248,0.55), 0 10px 30px rgba(99,102,241,0.45); }
                  50% { box-shadow: 0 0 0 8px rgba(129,140,248,0), 0 10px 30px rgba(99,102,241,0.65); }
                }
                .first-game-pulse { animation: firstGamePulse 1.2s ease-out infinite; }
              `}</style>
            )}
            {game.isInstalled && (
              <button className="h-12 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all border border-emerald-400/20 group"
                onClick={async () => { if ((game.appid ?? 0) > 0) { const u = `steam://rungameid/${game.appid}`; try { const { open: shellOpen } = await import('@tauri-apps/plugin-shell'); await shellOpen(u); } catch { window.location.href = u; } } }}
              >
                <Play className="h-4 w-4 fill-current group-hover:scale-110 transition-transform" /> {t('gameDetail.play')}</button>
            )}
            <div className="flex flex-col items-stretch">
              <div className="flex items-stretch gap-0">
                {/* ── Bottone STRING IT! (HERO — azione principale) ── */}
                <button ref={stringItBtnRef} className={`h-12 flex-1 flex items-center justify-center gap-2 rounded-l-xl bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-white font-extrabold text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/40 hover:shadow-indigo-500/60 transition-all border border-indigo-400/30 border-r-0 relative overflow-hidden group${highlightStringIt ? ' first-game-pulse ring-2 ring-indigo-300/70' : ''}`}
                  onClick={() => { setHighlightStringIt(false); handleStringIt(); }}
                  disabled={autoTranslateBusy}
                  title={t('common.avviaLaTraduzioneCompletaDelGioco')}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-[200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                  {autoTranslateBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" fill="currentColor" />} {autoTranslateBusy ? (autoTranslateProgress ? `Traduzione ${autoTranslateProgress}` : (t('gameDetails.translating') || 'Translating...')) : 'String it!'}
                </button>
                {/* ── Bandierina lingua target ── */}
                <div className="relative" ref={langPickerRef}>
                  <button
                    className="h-12 px-2.5 flex items-center gap-1 rounded-r-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white text-2xs font-bold uppercase tracking-wider shadow-xl shadow-purple-500/30 transition-all border border-purple-400/30 border-l-0"
                    onClick={() => setShowLangPicker(!showLangPicker)}
                    title={`Lingua: ${currentFlag.label}`}
                  >
                    <span className="text-base leading-none">{currentFlag.flag}</span>
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </button>
                  {showLangPicker && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#0f1318] border border-white/10 rounded-xl shadow-2xl shadow-black/60 py-1.5 w-48 max-h-72 overflow-y-auto custom-scrollbar">
                      {TARGET_LANGUAGES.map(lang => {
                        return (
                          <button
                            key={lang.code}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11px] transition-colors ${targetLang === lang.code ? 'bg-indigo-600/30 text-indigo-300 font-bold' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                            onClick={() => { setTargetLang(lang.code); setShowLangPicker(false); }}
                          >
                            <span className="text-sm">{lang.flag}</span>
                            <span>{lang.label}</span>
                            <span className="ml-auto text-micro text-slate-500 uppercase">{lang.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {translationStrategy?.ready && (
                <div className="text-2xs text-center mt-1 text-slate-500 tracking-wide">
                  {translationStrategy.engine} · {translationStrategy.detail}
                </div>
              )}
              {/* ── Motore AI (solo Ren'Py, per ora) ──────────────────────────
                  Il ramo cloud della pipeline Ren'Py esisteva dal 07/08 ma era
                  pilotabile SOLO da localStorage: nessun pulsante, quindi per
                  l'utente non esisteva. Gli altri quattro traduttori
                  file-based hanno lo stesso problema e useranno questo stesso
                  componente — vedi lib/translation-backend.ts. */}
              {translationStrategy?.method === 'renpy' && (
                <>
                  <BackendPicker
                    value={renpyBackend}
                    onChange={changeRenpyBackend}
                    disabled={autoTranslateBusy}
                  />
                  <label
                    className="mt-1 flex items-center gap-1.5 text-micro font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    title={t('translationBackend.testBatchHint').replace('{n}', String(RENPY_TEST_BATCH_SIZE))}
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-indigo-500"
                      checked={renpyTestBatch}
                      disabled={autoTranslateBusy}
                      onChange={(e) => setRenpyTestBatch(e.target.checked)}
                    />
                    {t('translationBackend.testBatch').replace('{n}', String(RENPY_TEST_BATCH_SIZE))}
                  </label>
                </>
              )}
              {/* ── Indicizza ora: qui il gioco e' gia' il contesto attivo, quindi
                  TM + glossario + lore si scaldano senza passare da Impostazioni. ── */}
              <button
                className="h-7 mt-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-micro font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                onClick={runGameWarmIndex}
                disabled={warmIndexing}
                title={t('semanticIndex.hint')}
              >
                {warmIndexing
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> {warmProgress && warmProgress.total > 0
                      ? `${warmProgress.done}/${warmProgress.total}`
                      : t('semanticIndex.indexing')}</>
                  : <><Database className="h-3 w-3" /> {t('semanticIndex.button')}</>}
              </button>
            </div>
            {game.platform === 'Steam' && (game.appid ?? 0) > 0 && (
              <a
                href={`https://store.steampowered.com/app/${game.appid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 flex items-center justify-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-micro font-bold uppercase tracking-wider transition-all no-underline"
              >
                <Globe className="h-3 w-3" /> Steam Store
              </a>
            )}
            {game.isInstalled && game.installPath && (
              <Link href={`/prediction-tool?name=${encodeURIComponent(game.title || game.name || '')}&installDir=${encodeURIComponent(game.installPath)}&engine=${encodeURIComponent(engineInfo?.engine || '')}&headerImage=${encodeURIComponent(game.headerImage || game.coverImage || '')}`}
                className="h-8 flex items-center justify-center gap-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 hover:text-purple-300 text-micro font-bold uppercase tracking-wider transition-all no-underline"
              >
                <Brain className="h-3 w-3" /> P.T.
              </Link>
            )}
            {game.isInstalled && game.installPath && (
              <Link href={`/video-extractor?gamePath=${encodeURIComponent(game.installPath)}&gameName=${encodeURIComponent(game.title || game.name || '')}&gameId=${encodeURIComponent(game.appid?.toString() || game.id || '')}`}
                className="h-8 flex items-center justify-center gap-1.5 rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 text-fuchsia-400 hover:text-fuchsia-300 text-micro font-bold uppercase tracking-wider transition-all no-underline"
              >
                <Film className="h-3 w-3" /> {t('gameDetail.video')}</Link>
            )}
          </motion.div>
        </div>
      </div>

      {/* ═══ MOBILE ACTION BAR (visible only on small screens) ═══ */}
      <div className="flex lg:hidden gap-2 px-4 py-2.5 bg-[#0a0e14]/95 border-t border-white/[0.04] shrink-0">
        {game.isInstalled && (
          <button className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 text-white font-bold text-2xs uppercase tracking-wider"
            onClick={async () => { if ((game.appid ?? 0) > 0) { const u = `steam://rungameid/${game.appid}`; try { const { open: shellOpen } = await import('@tauri-apps/plugin-shell'); await shellOpen(u); } catch { window.location.href = u; } } }}
          >
            <Play className="h-3.5 w-3.5 fill-current" /> {t('gameDetail.play')}</button>
        )}
        <button className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-l-lg bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-bold text-2xs uppercase tracking-wider shadow-lg shadow-indigo-500/30${highlightStringIt ? ' first-game-pulse ring-2 ring-indigo-300/70' : ''}`}
          onClick={() => { setHighlightStringIt(false); handleStringIt(); }}
          disabled={autoTranslateBusy}
        >
          {autoTranslateBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" fill="currentColor" />} {autoTranslateBusy ? (autoTranslateProgress || '...') : 'String it!'}
        </button>
        <button className="h-9 px-2 flex items-center gap-0.5 rounded-r-lg bg-violet-600/90 text-white text-xs font-bold"
          onClick={() => setShowLangPicker(!showLangPicker)}
        >
          {currentFlag.flag}
          <ChevronDown className="h-2.5 w-2.5 opacity-70" />
        </button>
        <button className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400"
          onClick={scanGameFiles}
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        {game.isInstalled && game.installPath && (
          <Link href={`/prediction-tool?name=${encodeURIComponent(game.title || game.name || '')}&installDir=${encodeURIComponent(game.installPath)}&engine=${encodeURIComponent(engineInfo?.engine || '')}&headerImage=${encodeURIComponent(game.headerImage || game.coverImage || '')}`}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 hover:text-purple-300 transition-all no-underline"
          >
            <Brain className="h-3.5 w-3.5" />
          </Link>
        )}
        {game.isInstalled && game.installPath && (
          <Link href={`/video-extractor?gamePath=${encodeURIComponent(game.installPath)}&gameName=${encodeURIComponent(game.title || game.name || '')}&gameId=${encodeURIComponent(game.appid?.toString() || game.id || '')}`}
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 text-fuchsia-400 hover:text-fuchsia-300 transition-all no-underline"
          >
            <Film className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-5 space-y-5">

          {/* ═══ AUTO-TRANSLATE STEPPER PANEL ═══ */}
          {autoTranslateActive && (
            <AutoTranslateStepper
              steps={autoTranslateSteps}
              error={autoTranslateError}
              result={autoTranslateResult}
              currentFlagLabel={currentFlag.label}
              onClose={() => setAutoTranslateActive(false)}
              onClearResult={() => setAutoTranslateResult(null)}
              game={{ title: game.title, name: game.name, installPath: game.installPath, appid: game.appid }}
            />
          )}

          {/* Descrizione */}
          {(translatedDescription || game.shortDescription || game.description) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
              <p className="text-[13px] text-slate-300/90 leading-relaxed line-clamp-3">{translatedDescription || game.shortDescription || game.detailedDescription || game.aboutGame || game.description}</p>
              {game.description && !translatedDescription && language !== 'en' && (
                <button className="text-2xs text-indigo-400 hover:text-indigo-300 mt-1.5 flex items-center gap-1 font-semibold" onClick={() => translateDescription(game.description)}>
                  <Languages className="h-3 w-3" /> {t('gameDetail.translateIn')}{language.toUpperCase()}
                </button>
              )}
            </motion.div>
          )}

          {/* ═══ FMV GAME BANNER — rilevato automaticamente ═══ */}
          {fmvInfo?.isFmvGame && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-950/60 via-purple-950/40 to-violet-950/60 p-4"
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl bg-fuchsia-500/20 pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="shrink-0 h-12 w-12 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
                  <Film className="h-6 w-6 text-fuchsia-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-fuchsia-200">🎬 {t('gameDetails.fmvGameDetected') || 'Gioco FMV rilevato'}</h3>
                    <span className="text-2xs px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 font-semibold uppercase tracking-wider">
                      {fmvInfo.totalFiles} {t('common.fileVideo') || 'file video'}
                    </span>
                  </div>
                  <p className="text-xs text-fuchsia-300/70">
                    {fmvInfo.totalSizeMB.toFixed(0)}  {t('gameDetails.mbUnit')} {fmvInfo.formats.slice(0, 3).join(', ')}
                    {fmvInfo.formats.length > 3 ? ` +${fmvInfo.formats.length - 3}` : ''}
                    {' — '}{t('gameDetails.fmvExtractHint') || 'estrai, converti e traduci i video del gioco'}
                  </p>
                </div>
                <Link
                  href={`/video-extractor?gamePath=${encodeURIComponent(game.installPath || '')}&gameName=${encodeURIComponent(game.title || game.name || '')}&gameId=${encodeURIComponent(game.appid?.toString() || game.id || '')}`}
                  className="shrink-0 h-9 px-4 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 hover:from-fuchsia-400 hover:to-purple-400 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-fuchsia-500/30 transition-all no-underline"
                >
                  <Play className="h-3.5 w-3.5" />
                  {t('gameDetails.extractVideos') || 'Estrai Video'}
                </Link>
              </div>
            </motion.div>
          )}

          {/* HowLongToBeat Stats */}
          <HltbStats gameName={game.title || game.name || ''} />

          {/* ═══ SCREENSHOT GALLERY — horizontal scroll ═══ */}
          <ScreenshotGallery
            screenshots={game.screenshots || []}
            onScreenshotClick={setSelectedScreenshotIndex}
          />

          {/* Scan progress */}
          {isScanning && (
            <div className="flex items-center gap-3 bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
              <Progress value={scanProgress} className="h-2 flex-1 bg-slate-800" />
              <span className="text-xs font-bold text-indigo-400 tabular-nums">{scanProgress}%</span>
            </div>
          )}

          {/* ═══ AVANZATE — tutto ciò che non serve al primo clic ═══
              String it! da solo copre il caso normale (rileva → estrai → traduci
              → applica). Gli strumenti qui sotto restano raggiungibili ma chiusi:
              una schermata che offre sette strade diverse per la stessa cosa
              costa fiducia quanto una funzione che non parte (lezione dei 64
              feedback: la gente non trovava funzioni che c'erano già). */}
          <button
            type="button"
            onClick={() => setShowAdvancedTools((v) => !v)}
            aria-expanded={showAdvancedTools}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-[#1b2838]/40 border border-white/5 hover:border-white/10 text-[#8f98a0] hover:text-[#c7d5e0] text-xs font-semibold transition-all"
          >
            <span className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5" />
              {t('gameDetail.advancedTools')}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedTools ? 'rotate-180' : ''}`} />
          </button>

          {showAdvancedTools && (
          <>
          {/* ═══ TRANSLATION RECOMMENDATION — compact banner ═══ */}
          {(game.is_installed || game.installPath) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <TranslationRecommendation
                gamePath={game.installPath || ''}
                gameName={game.title || game.name || ''}
                onActionClick={async (route) => {
                  if (route === 'action:launch_game') {
                    if (game.appid && game.appid > 0) {
                      const steamUrl = `steam://rungameid/${game.appid}`;
                      try {
                        const { open: shellOpen } = await import('@tauri-apps/plugin-shell');
                        await shellOpen(steamUrl);
                      } catch { window.location.href = steamUrl; }
                    } else if (game.installPath) {
                      try {
                        const exeList = await invoke<string[]>('find_executables_in_folder', { folderPath: game.installPath });
                        if (exeList?.length > 0) await invoke('launch_game_direct', { executablePath: `${game.installPath}\\${exeList[0]}` });
                      } catch (e: unknown) { clientLogger.error('[GameDetail] Errore avvio:', String(e)); }
                    }
                  } else if (route === '/unity-patcher') { handleInstallUnityPatch(); }
                  else { router.push(route); }
                }}
              />
            </motion.div>
          )}

          {/* ═══ BANNER TRADUZIONE COMUNITARIA (gamestranslator.it) ═══ */}
          <CommunityTranslationsBanner
            translations={communityTranslations}
            installPath={game.installPath}
            isInstallingZip={isInstallingCommunityZip}
            onInstallZip={installCommunityZip}
          />

          {/* ═══ BANNER AGGIORNAMENTO GIOCO ═══ */}
          {updateStatus && (updateStatus.update_detected || (!updateStatus.patch_intact && updateStatus.patch_type !== 'none')) && (
            <GameUpdateBanner
              updateStatus={updateStatus}
              installPath={game.installPath}
              targetLang={targetLang}
              isDismissing={isDismissingUpdate}
              isUntracking={isUntrackingGame}
              isUeAiUpgrading={isUeAiUpgrading}
              onDismiss={dismissUpdate}
              onUntrack={untrackGame}
              onUpgradeUEWithAI={upgradeUEWithAI}
            />
          )}

          {/* ═══ COMPATIBILITÀ COMMUNITY + CONFERMA BOOT (telemetria opt-in) ═══ */}
          <CompatCard game={compatRefFor(game)} targetLang={targetLang || language} />

          {/* ═══ VERIFICA FONT (glifi mancanti → □□□) ═══ */}
          <FontCheckCard
            installPath={game.installPath}
            engine={game.engine || engineInfo?.engine}
            targetLang={targetLang || language}
          />

          {/* ═══ INIEZIONE GLIFI GAMEMAKER (ADR-005: accenti/cirillico nel data.win) ═══ */}
          <GmGlyphCard
            installPath={game.installPath}
            engine={game.engine || engineInfo?.engine}
            targetLang={targetLang || language}
          />

          {/* ═══ DETTAGLI & STRUMENTI ═══ */}
          <GameToolsPanel
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            game={game as any}
            gameId={gameId}
            engineInfo={engineInfo}
            patchStatus={patchStatus}
            isScanning={isScanning}
            isInstallingPatch={isInstallingPatch}
            isAiUpgrading={isAiUpgrading}
            isUeAiUpgrading={isUeAiUpgrading}
            aiUpgradeProgress={aiUpgradeProgress}
            ueAiProgress={ueAiProgress}
            dlcGames={dlcGames}
            onScan={scanGameFiles}
            onInstallUnityPatch={handleInstallUnityPatch}
            onInstallUnrealPatch={handleInstallUnrealPatch}
            onUpgradeWithAI={upgradeWithAI}
            onUpgradeUEWithAI={upgradeUEWithAI}
            onOpenCoverPicker={() => setIsCoverPickerOpen(true)}
            onOpenGspackExport={() => setShowGspackExport(true)}
            onOpenGspackImport={() => setShowGspackImport(true)}
          />

          {/* ── Unreal Localization Panel ── */}
          {(game.engine === 'Unreal Engine' || engineInfo?.engine?.toLowerCase().includes('unreal')) && game.installPath && (
            <UnrealLocalizationPanel
              installPath={game.installPath}
              ueLocStatus={ueLocStatus}
              showPanel={showUeLocPanel}
              isUeAiUpgrading={isUeAiUpgrading}
              ueAiProgress={ueAiProgress}
              onTogglePanel={() => setShowUeLocPanel(v => !v)}
              onLoadStatus={loadUeLocStatus}
              onUpgradeUEWithAI={upgradeUEWithAI}
            />
          )}

          {/* ── Unity Assets Panel ── */}
          {(game.engine === 'Unity' || engineInfo?.engine?.toLowerCase().includes('unity')) && game.installPath && (
            <UnityAssetsPanel
              installPath={game.installPath}
              uabeaStatus={uabeaStatus}
              assetsFiles={assetsFiles}
              showPanel={showAssetsPanel}
              isDownloadingUabea={isDownloadingUabea}
              onTogglePanel={() => setShowAssetsPanel(v => !v)}
              onStatusLoaded={setUabeaStatus}
              onAssetsLoaded={setAssetsFiles}
              onDownloadingChange={setIsDownloadingUabea}
            />
          )}

          {/* ── Godot Translator (ponte alla pagina dedicata) ── */}
          {(game.engine?.toLowerCase().includes('godot') || engineInfo?.engine?.toLowerCase().includes('godot')) && game.installPath && (
            <div className="rounded-xl border border-sky-500/20 bg-gradient-to-r from-sky-950/50 to-blue-950/40 p-4 flex items-center gap-4">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
                <Languages className="h-5 w-5 text-sky-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-sky-200">{t('gameDetail.godotDetected')}</h3>
                <p className="text-xs text-sky-300/70">{t('gameDetail.godotBridgeDesc')}</p>
              </div>
              <Link
                href={`/godot-translator?gamePath=${encodeURIComponent(game.installPath)}&gameName=${encodeURIComponent(game.title || game.name || '')}`}
                className="shrink-0 h-9 px-4 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-400 hover:to-blue-400 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-sky-500/25 transition-all no-underline"
              >
                <Languages className="h-3.5 w-3.5" />
                {t('gameDetail.openGodotTranslator')}
              </Link>
            </div>
          )}

          {/* ── Wolf RPG Patcher (ponte alla pagina dedicata) ── */}
          {(game.engine?.toLowerCase().includes('wolf') || engineInfo?.engine?.toLowerCase().includes('wolf')) && game.installPath && (
            <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/50 to-teal-950/40 p-4 flex items-center gap-4">
              <div className="shrink-0 h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-emerald-200">{t('gameDetail.wolfDetected')}</h3>
                <p className="text-xs text-emerald-300/70">{t('gameDetail.wolfBridgeDesc')}</p>
              </div>
              <Link
                href={`/wolfrpg-patcher?gamePath=${encodeURIComponent(game.installPath)}&gameName=${encodeURIComponent(game.title || game.name || '')}`}
                className="shrink-0 h-9 px-4 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all no-underline"
              >
                <Wrench className="h-3.5 w-3.5" />
                {t('gameDetail.openWolfPatcher')}
              </Link>
            </div>
          )}

          {/* ── GameMaker Translator ── */}
          {(game.engine?.toLowerCase().includes('gamemaker') || game.engine?.toLowerCase().includes('game maker') || engineInfo?.engine?.toLowerCase().includes('gamemaker')) && game.installPath && (
            <div className="rounded-xl bg-[#1b2838]/60 border border-amber-500/20 p-3.5">
              <GameMakerTranslator gamePath={game.installPath} gameName={game.title || game.name || ''} targetLang={targetLang || language} />
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {/* ═══ MODALS & DIALOGS (outside scroll container) ═══ */}
      {showTranslation && game && (
        <InlineTranslator gameId={(game.appid ?? 0).toString()} gameName={game.name || game.title} gamePath={game.installPath} onClose={() => setShowTranslation(false)} />
      )}

      {game && (
        <>
          {/* gameId: DEVE essere lo stesso identificatore con cui l'apply ha
              persistito le stringhe (riga ~1150/1168: game.id || appid), perché
              load_translation_strings cerca strings_<gameId>_<lang>.json. Con il
              solo appid («3200460» invece di «steam_3200460») il dialog non
              trovava nulla e rifiutava l'export ANCHE su un gioco tradotto —
              falso negativo trovato il 05/08 guardando il file su disco prima
              della prova in-app. */}
          <GspackExportDialog open={showGspackExport} onOpenChange={setShowGspackExport} gameName={game.title || game.name || ''} gameAppId={game.appid} platform={game.platform || 'Steam'} engine={engineInfo?.engine || game.engine} gameId={game.id || game.appid?.toString() || gameId || ''} targetLanguage={targetLang} />
          <GspackImportDialog open={showGspackImport} onOpenChange={setShowGspackImport} />
        </>
      )}

      {/* Screenshot Lightbox */}
      {selectedScreenshotIndex !== null && game?.screenshots && (
        <ScreenshotLightbox
          screenshots={game.screenshots}
          selectedIndex={selectedScreenshotIndex}
          onClose={() => setSelectedScreenshotIndex(null)}
          onNavigate={setSelectedScreenshotIndex}
        />
      )}

      {/* Cover Picker (Supporta giochi Steam e non-Steam) */}
      {isCoverPickerOpen && game && (
        <CoverPicker
          isOpen={isCoverPickerOpen}
          onClose={() => setIsCoverPickerOpen(false)}
          appId={game.appid || 0}
          gameName={game.title || game.name || ''}
          onCoverSelected={(url) => {
            // Salva la nuova cover
            import('@tauri-apps/api/core').then(({ invoke }) => {
              const gameIdentifier = game.appid ? game.appid.toString() : (game.id || game.title || 'unknown');
              invoke('save_cover_cache', { gameId: gameIdentifier, imageUrl: url })
                .then(() => {
                  setGame({ ...game, headerUrl: url, heroUrl: url, coverUrl: url });
                  setFallbackImage(url);
                  setIsCoverPickerOpen(false);
                  import('sonner').then(({ toast }) => {
                    toast.success(t('common.copertinaAggiornataConSuccesso'));
                  });
                })
                .catch(err => clientLogger.error('Errore salvataggio cover:', err));
            });
          }}
        />
      )}
      
      {/* P.T. Confirmation Dialog */}
      {ptConfirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/20 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('gameDetail.predictiveAnalysis')}</h3>
                  <p className="text-xs text-amber-200/70">{t('gameDetail.predictionTool')}</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-5">
              <p className="text-sm text-slate-300 mb-4">
                {ptConfirmDialog.expired
                  ? `L'analisi precedente è scaduta (${ptConfirmDialog.ageHours}h fa). Rianalizzare migliora le stime di tempo e qualità.`
                  : 'Eseguire prima P.T. permette di scegliere la chain LLM migliore e stimare tempi/costi con precisione.'}
              </p>
              
              <div className="bg-slate-800/50 rounded-xl p-3 mb-4 border border-slate-700/30">
                <p className="text-xs text-slate-400">
                  <span className="text-amber-400 font-semibold">{t('gameDetail.recommended')}</span> {t('gameDetail.ptDesc')}</p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 p-4 pt-0">
              <button
                onClick={() => {
                  setPtConfirmDialog({ ...ptConfirmDialog, open: false });
                  startAutoTranslate();
                }}
                className="flex-1 h-10 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600/50 transition-all"
              >
                {t('gameDetail.translateAnyway')}</button>
              <button
                onClick={() => {
                  setPtConfirmDialog({ ...ptConfirmDialog, open: false });
                  router.push(ptConfirmDialog.ptUrl);
                }}
                className="flex-1 h-10 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/25 transition-all"
              >
                {t('gameDetail.runPtFirst')}</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Gate anti-pirateria: conferma possesso copia legale (una-tantum) */}
      {legalGateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-b border-emerald-500/20 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {t('gameDetail.legalGateTitle') || 'Possiedi una copia legale?'}
                </h3>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-300">
                {t('gameDetail.legalGateBody') ||
                  'GameStringer applica patch solo a giochi che possiedi legalmente. Confermando, dichiari di avere una copia legittima di questo gioco.'}
              </p>
              <a
                href="https://github.com/rouges78/GameStringer/blob/main/docs/LEGAL.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-xs text-emerald-400 hover:text-emerald-300 underline"
              >
                {t('gameDetail.legalGateLink') || 'Leggi le note legali'}
              </a>
            </div>
            <div className="flex gap-3 p-4 pt-0">
              <button
                onClick={() => setLegalGateOpen(false)}
                className="flex-1 h-10 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600/50 transition-all"
              >
                {t('gameDetail.legalGateCancel') || 'Annulla'}
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem('gamestringer_legal_copy_ack', '1');
                  } catch {
                    /* no-op */
                  }
                  setLegalGateOpen(false);
                  handleStringIt();
                }}
                className="flex-1 h-10 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 transition-all"
              >
                {t('gameDetail.legalGateConfirm') || 'Confermo, possiedo il gioco'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

