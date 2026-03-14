'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Wand2, Search, FolderOpen, FileText, Languages, CheckCircle2, 
  AlertCircle, Loader2, ChevronRight, Globe, Sparkles, Download,
  ArrowRight, Info, Lightbulb, Zap, FileCode, Database, Play,
  RefreshCw, Eye, Copy, ExternalLink, Settings2, HelpCircle, ScanEye, Gamepad2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { detectStrategy, getAlternativeStrategies, type TranslationStrategy, type GameContext, type StrategyId } from '@/lib/wizard-strategies';
import { findCommunityTranslation, type CommunityTranslation } from '@/lib/community-translations';
import { translateSmart } from '@/lib/ai-translate-direct';
import { extractStringsFromBuffer, fitToByteLength, applyPatch, detectAntiCheat, detectLanguage, type BinaryString } from '@/lib/binary-string-patcher';

// --- Types ---
interface Game {
  id: string;
  title: string;
  steam_app_id?: number;
  install_path?: string;
  engine?: string;
  platform?: string;
  header_image?: string;
}

interface LocalizationFile {
  path: string;
  name: string;
  size: number;
  type: 'csv' | 'json' | 'xml' | 'txt' | 'po' | 'lang' | 'asset' | 'unknown';
  languages: string[];
  stringCount: number;
  hasItalian: boolean;
}

interface AnalysisResult {
  game: Game;
  engine: string;
  localizationFiles: LocalizationFile[];
  recommendedMethod: 'file' | 'bridge' | 'manual';
  recommendation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedStrings: number;
  existingLanguages: string[];
  hasItalian: boolean;
}

type WizardStep = 'select-game' | 'analyzing' | 'results' | 'translate' | 'complete';

// Language display names — native names, language-neutral
const languageNames: Record<string, string> = {
  en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español',
  pt: 'Português', pl: 'Polski', ru: 'Русский', zh: '中文',
  ja: '日本語', ko: '한국어', it: 'Italiano', nl: 'Nederlands',
  tr: 'Türkçe', ar: 'العربية', th: 'ภาษาไทย', vi: 'Tiếng Việt',
  uk: 'Українська', sv: 'Svenska', da: 'Dansk', fi: 'Suomi',
  nb: 'Norsk', cs: 'Čeština', sk: 'Slovenčina', hu: 'Magyar',
  ro: 'Română', hr: 'Hrvatski', bg: 'Български', el: 'Ελληνικά',
};

export default function TranslationWizardPage() {
  const { t } = useTranslation();
  const autoStartRef = useRef(false);
  const autoTranslateRef = useRef(false);
  // --- State ---
  const [step, setStep] = useState<WizardStep>('select-game');
  const [renderError, setRenderError] = useState<string | null>(null);
  
  // Error boundary effect
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[TranslationWizard] Render error:', event.error);
      setRenderError(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('it');
  const [isLoading, setIsLoading] = useState(false);
  
  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('gameStringerSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.translation?.defaultTargetLang) {
          setTargetLanguage(parsed.translation.defaultTargetLang);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
  }, []);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [strategy, setStrategy] = useState<TranslationStrategy | null>(null);
  const [altStrategies, setAltStrategies] = useState<TranslationStrategy[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(0);
  const [translateStatus, setTranslateStatus] = useState('');
  const [translateLog, setTranslateLog] = useState<string[]>([]);
  const { toast } = useToast();

  // --- Effects ---
  useEffect(() => {
    loadGames();
  }, []);

  // Auto-start: se arrivo dalla library con gioco salvato in sessionStorage
  useEffect(() => {
    if (autoStartRef.current) return;
    try {
      const raw = sessionStorage.getItem('wizardAutoGame');
      if (raw) {
        sessionStorage.removeItem('wizardAutoGame');
        autoStartRef.current = true;
        const g = JSON.parse(raw);
        const autoGame: Game = {
          id: String(g.steam_app_id || g.id || g.title),
          title: g.title,
          install_path: g.install_path || undefined,
          steam_app_id: g.steam_app_id ? Number(g.steam_app_id) : undefined,
          header_image: g.header_image || (g.steam_app_id ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.steam_app_id}/header.jpg` : undefined),
        };

        autoTranslateRef.current = true;

        // Se manca install_path, prova a trovarlo dalla scan dei giochi
        if (!autoGame.install_path) {
          (async () => {
            try {
              const allGames = await invoke('scan_all_steam_games_fast') as any[];
              const match = allGames?.find((sg: any) =>
                (sg.steam_app_id && String(sg.steam_app_id) === String(g.steam_app_id)) ||
                (sg.title && sg.title.toLowerCase() === g.title?.toLowerCase())
              );
              if (match?.install_path) {
                autoGame.install_path = match.install_path;
                autoGame.engine = match.engine || undefined;
              }
            } catch (e) {
              console.warn('[Wizard] Fallback scan per install_path fallito:', e);
            }
            console.log('[Wizard] Auto-start da library:', autoGame.title, autoGame.install_path);
            setSelectedGame(autoGame);
            analyzeGame(autoGame);
          })();
        } else {
          console.log('[Wizard] Auto-start da library:', autoGame.title, autoGame.install_path);
          setSelectedGame(autoGame);
          setTimeout(() => analyzeGame(autoGame), 300);
        }
      }
    } catch (e) {
      console.error('[Wizard] Errore auto-start:', e);
    }
  }, []);

  // Auto-translate: quando arrivo dalla library e l'analisi è finita, parto subito (ma NON per OCR)
  useEffect(() => {
    if (step === 'results' && autoTranslateRef.current && analysisResult && strategy) {
      autoTranslateRef.current = false;
      if (strategy.id === 'ocr' || strategy.id === 'telltale' || strategy.id === 'community-patch') {
        console.log(`[Wizard] Auto-translate: strategia ${strategy.id} → mostro risultati (serve azione utente)`);
        return;
      }
      console.log('[Wizard] Auto-translate: analisi completata, avvio traduzione...');
      setTimeout(() => startTranslation(), 500);
    }
  }, [step, analysisResult, strategy]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = games.filter(g => 
        g.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredGames(filtered);
    } else {
      setFilteredGames(games);
    }
  }, [searchTerm, games]);

  // --- Actions ---
  const loadGames = async () => {
    setIsLoading(true);
    try {
      // Usa scan_all_steam_games_fast per avere dati completi su motori e immagini
      const allGames = await invoke('scan_all_steam_games_fast');
      if (Array.isArray(allGames)) {
        const installedGames = allGames
          .filter((g: any) => g.is_installed && g.title && g.install_path)
          .map((g: any) => ({
            id: String(g.steam_app_id || g.id),
            title: g.title,
            steam_app_id: g.steam_app_id,
            install_path: g.install_path,
            engine: g.engine || undefined,
            platform: g.platform || 'steam',
            header_image: g.header_image || (g.steam_app_id ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.steam_app_id}/header.jpg` : undefined)
          }))
          .sort((a: Game, b: Game) => a.title.localeCompare(b.title));
        
        setGames(installedGames);
        setFilteredGames(installedGames);
      }
    } catch (error) {
      console.error('Error loading games:', error);
      toast({ title: 'error', description: 'Impossibile caricare i games', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeGame = async (game: Game) => {
    setSelectedGame(game);
    setStep('analyzing');
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStatus('Ricerca cartella di installazione...');

    try {
      // Step 1: Find installation path
      setAnalysisProgress(5);
      let installPath: string | null = null;
      const searchDir = game.install_path || game.title;
      try {
        installPath = await invoke<string>('find_game_install_path', { installDir: searchDir });
      } catch {
        if (game.install_path && (game.install_path.includes(':') || game.install_path.startsWith('/'))) {
          installPath = game.install_path;
        }
      }
      if (!installPath) throw new Error('Percorso di installazione non trovato.');

      // Step 2: DEEP engine detection via Rust backend (22 engine detectors!)
      setAnalysisProgress(15);
      setAnalysisStatus('Analisi profonda del motore di gioco...');
      let engine = 'Unknown';
      let engineDetails: any = null;
      try {
        engineDetails = await invoke<any>('check_game_engine', { gamePath: installPath });
        engine = engineDetails?.engine_name || 'Unknown';
        console.log('[Wizard] Rust engine detection:', engine, engineDetails);
      } catch (e) {
        console.warn('[Wizard] check_game_engine failed, falling back to JS:', e);
        engine = await detectGameEngine(installPath);
      }

      // Step 3: DEEP localization scan via Rust
      setAnalysisProgress(30);
      setAnalysisStatus('Scansione profonda file di localizzazione...');
      let locInfo: any = null;
      try {
        locInfo = await invoke<any>('detect_localization_files', { gamePath: installPath });
        console.log('[Wizard] Rust loc detection:', locInfo);
      } catch (e) {
        console.warn('[Wizard] detect_localization_files failed:', e);
      }

      // Step 4: Get full recommendation from Rust backend
      setAnalysisProgress(50);
      setAnalysisStatus('Generazione raccomandazione intelligente...');
      let rustRecommendation: any = null;
      try {
        rustRecommendation = await invoke<any>('get_translation_recommendation', { gamePath: installPath, gameName: game.title });
        console.log('[Wizard] Rust recommendation:', rustRecommendation);
      } catch (e) {
        console.warn('[Wizard] get_translation_recommendation failed:', e);
      }

      // Step 5: Also scan with JS for additional file types the Rust backend might miss
      setAnalysisProgress(65);
      setAnalysisStatus('Scansione file aggiuntivi...');
      const jsLocFiles = await scanLocalizationFiles(installPath, engine);
      const analyzedFiles = await analyzeFileContents(jsLocFiles);

      // Merge Rust loc info with JS scan results
      if (locInfo?.files?.length) {
        for (const rustFile of locInfo.files) {
          const already = analyzedFiles.some(f => f.path === rustFile.path);
          if (!already) {
            analyzedFiles.push({
              path: rustFile.path,
              name: rustFile.name || rustFile.path.split(/[\\/]/).pop() || '',
              size: rustFile.size || 0,
              type: (rustFile.extension || 'unknown') as any,
              languages: rustFile.languages || [],
              stringCount: rustFile.string_count || 0,
              hasItalian: rustFile.has_italian || false,
            });
          }
        }
      }

      // Step 6: Build comprehensive result
      setAnalysisProgress(80);
      setAnalysisStatus('Costruzione risultato finale...');
      
      const existingLanguages = [...new Set([
        ...analyzedFiles.flatMap(f => f.languages),
        ...(locInfo?.available_languages || []),
      ])];
      const hasItalian = existingLanguages.includes('it') || existingLanguages.includes('italian') || 
                         (locInfo && !locInfo.missing_italian);
      const totalStrings = Math.max(
        analyzedFiles.reduce((sum, f) => sum + f.stringCount, 0),
        rustRecommendation?.estimated_strings || 0
      );

      // Use Rust recommendation if available, otherwise generate our own
      let recommendedMethod: 'file' | 'bridge' | 'manual' = 'file';
      let recommendation = '';
      let difficulty: 'easy' | 'medium' | 'hard' = 'medium';

      if (rustRecommendation) {
        recommendation = rustRecommendation.summary || rustRecommendation.recommendation || '';
        difficulty = rustRecommendation.difficulty === 'hard' ? 'hard' : 
                     rustRecommendation.difficulty === 'easy' ? 'easy' : 'medium';
        recommendedMethod = rustRecommendation.method || 'file';
        // Append tips from Rust
        if (rustRecommendation.tips?.length) {
          recommendation += '\n' + rustRecommendation.tips.join('\n');
        }
      } else {
        if (analyzedFiles.length > 0 && analyzedFiles.some(f => f.type !== 'asset' && f.type !== 'unknown')) {
          recommendedMethod = 'file';
          recommendation = `Trovati ${analyzedFiles.length} file di localizzazione.`;
          difficulty = 'easy';
        } else if (engine === 'Unity' || engine?.includes('Unreal')) {
          recommendedMethod = 'bridge';
          recommendation = `Gioco ${engine} con asset compilati.`;
          difficulty = 'medium';
        } else {
          recommendedMethod = 'manual';
          recommendation = 'Engine non standard. Prova il Binary Patcher.';
          difficulty = 'hard';
        }
      }

      // Add engine details to recommendation
      if (engineDetails) {
        const extras: string[] = [];
        if (engineDetails.engine_version) extras.push(`Versione: ${engineDetails.engine_version}`);
        if (engineDetails.has_bepinex) extras.push('BepInEx installato');
        if (engineDetails.has_xunity) extras.push('XUnity presente');
        if (engineDetails.anti_cheat) extras.push(`⚠️ Anti-cheat: ${engineDetails.anti_cheat}`);
        if (extras.length > 0) {
          recommendation = `[${engine}] ${extras.join(' | ')}\n${recommendation}`;
        }
      }

      if (hasItalian && !recommendation.includes('italiano')) {
        recommendation = '✅ Italiano già presente!\n' + recommendation;
      }

      setAnalysisProgress(100);
      setAnalysisStatus('Analisi completata!');

      const result: AnalysisResult = {
        game: { ...game, install_path: installPath },
        engine,
        localizationFiles: analyzedFiles,
        recommendedMethod,
        recommendation,
        difficulty,
        estimatedStrings: totalStrings,
        existingLanguages,
        hasItalian
      };

      setAnalysisResult(result);

      // Detect best strategy using our strategy engine
      const locFilesForStrategy = analyzedFiles.map(f => ({
        path: f.path, name: f.name, type: f.type, size: f.size
      }));
      const detected = detectStrategy(engine, locFilesForStrategy, game.title, rustRecommendation, game.steam_app_id, targetLanguage);
      setStrategy(detected);
      setAltStrategies(getAlternativeStrategies(detected.id, engine, locFilesForStrategy));
      
      // If Rust recommended specific tools, consider them as alternatives
      if (rustRecommendation?.tools?.length) {
        const rustToolIds = new Set(rustRecommendation.tools.filter((t: any) => t.available).map((t: any) => t.id));
        console.log(`[Wizard] Rust tools: ${[...rustToolIds].join(', ')}`);
      }

      console.log(`[Wizard] Strategy: ${detected.id} (${detected.name}) | Engine: ${engine}`);
      
      setTimeout(() => {
        setStep('results');
        setIsAnalyzing(false);
      }, 500);

    } catch (error) {
      console.error('Analysis error:', error);
      toast({ 
        title: 'Errore analisi', 
        description: error instanceof Error ? error.message : 'Errore durante l\'analisi',
        variant: 'destructive' 
      });
      setStep('select-game');
      setIsAnalyzing(false);
    }
  };

  const detectGameEngine = async (installPath: string): Promise<string> => {
    try {
      const files = await invoke<string[]>('list_directory_files', { path: installPath });
      const fileList = files.map(f => f.toLowerCase());
      
      // Unity detection
      if (fileList.some(f => f.includes('_data') || f.includes('unityplayer') || f.includes('mono'))) {
        return 'Unity';
      }
      
      // Unreal detection
      if (fileList.some(f => f.includes('engine') || f.includes('unrealceclient') || f.includes('.pak'))) {
        return 'Unreal Engine';
      }
      
      // Godot detection
      if (fileList.some(f => f.includes('.pck') || f.includes('godot'))) {
        return 'Godot';
      }
      
      // RPG Maker detection
      if (fileList.some(f => f.includes('rgss') || f.includes('game.exe') && f.includes('data'))) {
        return 'RPG Maker';
      }
      
      // GameMaker detection
      if (fileList.some(f => f.includes('data.win') || f.includes('game.unx'))) {
        return 'GameMaker';
      }
      
      // Ren'Py detection
      if (fileList.some(f => f.includes('renpy') || f.includes('.rpa'))) {
        return "Ren'Py";
      }

      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  const scanLocalizationFiles = async (installPath: string, engine: string): Promise<LocalizationFile[]> => {
    const locFiles: LocalizationFile[] = [];
    
    try {
      // Use the new scan_localization_files command with deeper search
      const extensions = ['json', 'csv', 'xml', 'txt', 'po', 'lang', 'loc', 'strings', 'ini'];
      
      const results = await invoke<any[]>('scan_localization_files', { 
        path: installPath,
        extensions,
        maxDepth: 10  // Increased depth for Unity _Data subfolders
      });

      console.log('[Wizard] Scan results:', results?.length || 0, 'files');

      if (Array.isArray(results)) {
        for (const file of results) {
          const fileName = (file.name || '').toLowerCase();
          const filePath = (file.path || '').toLowerCase();
          
          // Check filename OR path for localization indicators
          const isLocFile = 
            fileName.includes('local') || 
            fileName.includes('lang') || 
            fileName.includes('text') ||
            fileName.includes('string') ||
            fileName.includes('dialog') ||
            fileName.includes('dialogue') ||
            fileName.includes('translation') ||
            fileName.includes('i18n') ||
            fileName.includes('l10n') ||
            fileName.includes('resource') ||
            // Also check path for Unity extracted assets
            filePath.includes('example') ||
            filePath.includes('localization') ||
            filePath.includes('language');

          // Include if it's a localization file OR if it's large enough (>50KB likely has translations)
          // For txt files, be more generous with size threshold
          const sizeThreshold = file.extension === 'txt' ? 50000 : 5000;
          
          if (isLocFile || file.size > sizeThreshold) {
            locFiles.push({
              path: file.path,
              name: file.name,
              size: file.size,
              type: (file.extension || 'unknown') as any,
              languages: [],
              stringCount: 0,
              hasItalian: false
            });
          }
        }
      }
      
      // Sort by size descending (larger files more likely to be main localization)
      locFiles.sort((a, b) => b.size - a.size);
      
    } catch (error) {
      console.error('[Wizard] Scan error:', error);
    }

    // If no files found, check for Unity/Unreal assets
    if (locFiles.length === 0) {
      if (engine === 'Unity') {
        locFiles.push({
          path: `${installPath}/*_Data/resources.assets`,
          name: 'resources.assets (Unity)',
          size: 0,
          type: 'asset',
          languages: [],
          stringCount: 0,
          hasItalian: false
        });
      } else if (engine === 'Unreal Engine') {
        locFiles.push({
          path: `${installPath}/Content/Localization`,
          name: 'Localization (Unreal)',
          size: 0,
          type: 'asset',
          languages: [],
          stringCount: 0,
          hasItalian: false
        });
      }
    }

    return locFiles;
  };

  const analyzeFileContents = async (files: LocalizationFile[]): Promise<LocalizationFile[]> => {
    const analyzed: LocalizationFile[] = [];

    for (const file of files) {
      try {
        if (file.type === 'asset') {
          analyzed.push({ ...file, stringCount: 1000, languages: ['en'] });
          continue;
        }

        const content = await invoke<string>('read_text_file', { path: file.path, maxBytes: 50000 });
        
        if (content) {
          // Detect languages from CSV headers or structured content
          // Look for language codes in headers, not just mentions in text
          const languages: string[] = [];
          const firstLines = content.split('\n').slice(0, 5).join('\n').toLowerCase();
          
          // For CSV files, check if there's actual content in that language column
          // A language is "supported" only if it has a dedicated column with translations
          const hasLanguageColumn = (langCode: string, langNames: string[]) => {
            // Check for column headers like ",en," or ",English," or "English,,"
            const headerPatterns = [
              `,${langCode},`, `"${langCode}"`, `${langCode}\t`,
              ...langNames.map(n => `,${n},`),
              ...langNames.map(n => `"${n}"`),
            ];
            return headerPatterns.some(p => firstLines.includes(p.toLowerCase()));
          };
          
          if (hasLanguageColumn('en', ['english'])) languages.push('en');
          if (hasLanguageColumn('fr', ['french', 'français', 'francais'])) languages.push('fr');
          if (hasLanguageColumn('de', ['german', 'deutsch'])) languages.push('de');
          if (hasLanguageColumn('es', ['spanish', 'español', 'espanol'])) languages.push('es');
          if (hasLanguageColumn('pt', ['portuguese', 'português', 'portugues'])) languages.push('pt');
          if (hasLanguageColumn('pl', ['polish', 'polski'])) languages.push('pl');
          if (hasLanguageColumn('ru', ['russian', 'русский'])) languages.push('ru');
          if (hasLanguageColumn('zh', ['chinese', '中文', 'simplified chinese'])) languages.push('zh');
          if (hasLanguageColumn('ja', ['japanese', '日本語'])) languages.push('ja');
          
          // Italian - be more strict: only count if there's actual Italian content column
          // NOT just a mention of "italian" in comments
          const hasItalianColumn = hasLanguageColumn('it', ['italian', 'italiano']);
          if (hasItalianColumn) languages.push('it');

          // Estimate string count
          let stringCount = 0;
          if (file.type === 'json') {
            stringCount = (content.match(/": "/g) || []).length;
          } else if (file.type === 'csv') {
            stringCount = content.split('\n').length;
          } else if (file.type === 'xml') {
            stringCount = (content.match(/<[^>]+>[^<]+<\/[^>]+>/g) || []).length;
          } else {
            stringCount = content.split('\n').filter(l => l.trim().length > 0).length;
          }

          analyzed.push({
            ...file,
            languages: languages.length > 0 ? languages : ['en'],
            stringCount,
            hasItalian: hasItalianColumn
          });
        }
      } catch {
        analyzed.push(file);
      }
    }

    return analyzed;
  };

  const startTranslation = (overrideStrategy?: TranslationStrategy) => {
    if (!analysisResult) return;
    const strat = overrideStrategy || strategy;
    if (!strat) return;

    const gameCtx: GameContext = {
      id: analysisResult.game.id,
      title: analysisResult.game.title,
      installPath: analysisResult.game.install_path || '',
      engine: analysisResult.engine,
      targetLang: targetLanguage,
      locFiles: analysisResult.localizationFiles.map(f => ({ path: f.path, name: f.name, type: f.type, size: f.size })),
    };

    // Inline translation for text-files and rpgmaker-json
    if (strat.canDoInline) {
      startInlineTranslation(gameCtx, strat);
      return;
    }

    // Smart routing to the right specialized tool
    const redirectTo = strat.redirectTo || '/translator/pro';
    const extraParams = strat.redirectParams?.(gameCtx) || {};
    const params = new URLSearchParams({
      gameId: gameCtx.id,
      gameName: gameCtx.title,
      installPath: gameCtx.installPath,
      targetLang: targetLanguage,
      ...extraParams,
    });

    window.location.href = `${redirectTo}?${params}`;
  };

  const startInlineTranslation = async (gameCtx: GameContext, strat: TranslationStrategy) => {
    setStep('translate');
    setIsTranslating(true);
    setTranslateProgress(0);
    setTranslateLog([]);
    setTranslateStatus('Avvio...');

    const log = (msg: string) => setTranslateLog(prev => [...prev, msg]);

    try {
      log(`🎮 ${gameCtx.title}`);
      log(`🧠 Strategia: ${strat.name}`);
      log(`🌍 Lingua target: ${targetLanguage}\n`);

      switch (strat.id) {
        case 'text-files':
        case 'rpgmaker-json':
          await inlineTranslateTextFiles(gameCtx, log);
          break;

        case 'binary-patch':
          await inlineBinaryPatch(gameCtx, log);
          break;

        case 'unity-xunity':
        case 'unity-assets':
          await inlineUnityXUnity(gameCtx, log);
          break;

        case 'renpy-rpy':
          await inlineRenPy(gameCtx, log);
          break;

        case 'unreal-locres':
          await inlineUnrealLocres(gameCtx, log);
          break;

        case 'danganronpa-wad':
          await inlineDanganronpa(gameCtx, log);
          break;

        case 'community-patch': {
          const ct = findCommunityTranslation(
            analysisResult?.game.title || '',
            selectedGame?.steam_app_id,
            targetLanguage
          );
          if (ct) {
            log('🌟 Community translation found!');
            log(`👤 Author: ${ct.author}`);
            log(`🌐 Source: ${ct.source}`);
            if (ct.version) log(`📋 Version: ${ct.version}`);
            if (ct.coverage) log(`📊 Coverage: ${ct.coverage}%`);
            log('');
            log(`📦 ${ct.installInstructions}`);
            log('');
            log('👉 Click the button below to download!');
            if (ct.notes) log(`ℹ️ ${ct.notes}`);
          } else {
            log('⚠️ Community translation flagged but not found in database');
          }
          setTranslateProgress(100);
          setTranslateStatus('Community translation available');
          setIsTranslating(false);
          setStep('complete');
          return;
        }

        case 'telltale':
          log('🎮 Gioco Telltale rilevato!');
          log('📦 Usa il Telltale Patcher dedicato per installare');
          log('   le traduzioni italiane della community.');
          log('');
          log('📋 Come fare:');
          log('  1. Clicca "Apri Telltale Patcher" qui sotto');
          log('  2. Seleziona il gioco dalla lista');
          log('  3. Scarica e installa la traduzione');
          log('  4. Avvia il gioco — già in italiano!');
          setTranslateProgress(100);
          setTranslateStatus('Pronto per Telltale Patcher');
          setIsTranslating(false);
          setStep('complete');
          return;

        case 'ocr':
          log('🔍 Questo gioco non ha file di testo estraibili.');
          log('📺 Usa il Traduttore OCR per tradurre il testo dallo schermo in tempo reale.');
          log('');
          log('📋 Come fare:');
          log('  1. Avvia il gioco normalmente');
          log('  2. Apri il Traduttore OCR dalla sidebar di GameStringer');
          log('  3. Seleziona la zona dello schermo con il testo');
          log('  4. La traduzione appare in overlay!');
          setTranslateProgress(100);
          setTranslateStatus('Pronto per OCR');
          setIsTranslating(false);
          setStep('complete');
          return;

        default: {
          // Fallback universale: text files → binary patch
          // Copre: manual, rpgmaker-ruby, gamemaker-data, godot-pck, wolfrpg, e qualsiasi altra
          log('🔄 Modalità automatica: provo strategie in ordine...\n');
          const textFiles = gameCtx.locFiles.filter(f =>
            ['csv', 'json', 'xml', 'po', 'lang', 'txt', 'ini'].includes(f.type) && f.size > 100
          );
          if (textFiles.length > 0) {
            log(`📂 Trovati ${textFiles.length} file di testo → traduzione file`);
            await inlineTranslateTextFiles(gameCtx, log);
          } else {
            log('📂 Nessun file di testo → Binary Patcher automatico');
            await inlineBinaryPatch(gameCtx, log);
          }
          break;
        }
      }

      setTranslateProgress(100);
      setTranslateStatus('Traduzione completata!');
      setIsTranslating(false);
      setStep('complete');

    } catch (error) {
      log(`\n❌ Errore fatale: ${error}`);
      setIsTranslating(false);
    }
  };

  // ============================================================
  // INLINE: Text Files (CSV, JSON, XML, PO, TXT, INI)
  // ============================================================
  const inlineTranslateTextFiles = async (gameCtx: GameContext, log: (m: string) => void) => {
    const textFiles = gameCtx.locFiles.filter(f =>
      ['csv', 'json', 'xml', 'po', 'lang', 'loc', 'txt', 'ini'].includes(f.type) && f.size > 100
    );

    if (textFiles.length === 0) {
      log('❌ Nessun file di testo trovato');
      return;
    }

    log(`📂 ${textFiles.length} file da tradurre`);
    let totalStrings = 0, translatedStrings = 0;

    for (let fi = 0; fi < textFiles.length; fi++) {
      const file = textFiles[fi];
      setTranslateStatus(`File ${fi + 1}/${textFiles.length}: ${file.name}`);
      log(`\n📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

      let content: string;
      try {
        content = await invoke<string>('read_text_file', { path: file.path, maxBytes: 2000000 });
      } catch (e) {
        log(`  ⚠️ Impossibile leggere: ${e}`);
        continue;
      }
      if (!content || content.trim().length < 10) { log(`  ⏭️ File vuoto`); continue; }

      let strings: Array<{ key: string; value: string }> = [];
      if (file.type === 'json') strings = extractJsonStrings(content);
      else if (file.type === 'csv') strings = extractCsvStrings(content, targetLanguage);
      else if (file.type === 'xml') strings = extractXmlStrings(content);
      else if (file.type === 'po') strings = extractPoStrings(content);
      else strings = extractGenericStrings(content);

      if (strings.length === 0) { log(`  ⏭️ Nessuna stringa trovata`); continue; }
      totalStrings += strings.length;
      log(`  📝 ${strings.length} stringhe`);

      const translated = await translateBatch(strings.map(s => ({ key: s.key, text: s.value })), gameCtx, log, fi, textFiles.length);
      translatedStrings += translated.size;

      if (translated.size > 0) {
        try {
          let newContent = content;
          if (file.type === 'json') newContent = applyJsonTranslations(content, translated);
          else if (file.type === 'csv') newContent = applyCsvTranslations(content, translated, targetLanguage);
          else newContent = applyGenericTranslations(content, translated);
          try { await invoke('copy_file', { src: file.path, dest: file.path + '.bak' }); } catch {}
          await invoke('write_text_file', { path: file.path, content: newContent });
          log(`  ✅ ${translated.size} stringhe tradotte e salvate`);
        } catch (e) { log(`  ❌ Errore salvataggio: ${e}`); }
      }
    }
    log(`\n🏁 File di testo: ${translatedStrings}/${totalStrings} stringhe tradotte`);
  };

  // ============================================================
  // INLINE: Binary Patcher
  // ============================================================
  const inlineBinaryPatch = async (gameCtx: GameContext, log: (m: string) => void) => {
    log('🔍 Ricerca file binari...');
    
    // Find exe/dll files
    let binaryFiles: string[] = [];
    try {
      const allFiles = await invoke<any[]>('scan_localization_files', { 
        path: gameCtx.installPath, extensions: ['exe', 'dll'], maxDepth: 3 
      });
      binaryFiles = (allFiles || [])
        .filter((f: any) => f.size > 50000 && f.size < 200000000) // 50KB - 200MB
        .sort((a: any, b: any) => b.size - a.size)
        .map((f: any) => f.path);
    } catch {
      // Fallback: try to find main exe
      try {
        const files = await invoke<string[]>('list_directory_files', { path: gameCtx.installPath });
        binaryFiles = files.filter(f => f.toLowerCase().endsWith('.exe'));
      } catch {}
    }

    if (binaryFiles.length === 0) {
      log('❌ Nessun file binario trovato');
      return;
    }

    log(`📦 ${binaryFiles.length} file binari trovati`);

    // Pick the most likely game exe (largest exe, or one matching game name)
    const gameName = gameCtx.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mainExe = binaryFiles.find(f => {
      const name = f.split(/[\\/]/).pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
      return name.includes(gameName);
    }) || binaryFiles[0];

    const exeName = mainExe.split(/[\\/]/).pop() || mainExe;
    log(`\n🎯 Binario principale: ${exeName}`);

    // Read binary file
    setTranslateStatus(`Lettura ${exeName}...`);
    setTranslateProgress(2);
    await new Promise(r => setTimeout(r, 0));
    let fileBytes: Uint8Array;
    try {
      const b64 = await invoke<string>('read_binary_file_base64', { path: mainExe });
      log(`  📥 Decodifica binario...`);
      setTranslateProgress(3);
      await new Promise(r => setTimeout(r, 0));
      const resp = await fetch(`data:application/octet-stream;base64,${b64}`);
      const buf = await resp.arrayBuffer();
      fileBytes = new Uint8Array(buf);
      log(`  📐 Dimensione: ${(fileBytes.length / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      log(`  ❌ Impossibile leggere: ${e}`);
      return;
    }

    // Anti-cheat check
    const fileList = binaryFiles.map(f => f.split(/[\\/]/).pop()?.toLowerCase() || '');
    const acResult = detectAntiCheat(fileList);
    if (acResult.detected.length > 0) {
      log(`  ⚠️ Anti-cheat rilevato: ${acResult.detected.join(', ')}`);
      log(`  ⚠️ ${acResult.warnings.join('; ')}`);
      log(`  ⚠️ Il patching potrebbe causare problemi!`);
    }

    // Extract strings
    setTranslateStatus('Estrazione stringhe...');
    setTranslateProgress(4);
    await new Promise(r => setTimeout(r, 0));
    log('  🔎 Estrazione stringhe...');
    const extracted = extractStringsFromBuffer(fileBytes, { minLength: 4 });
    
    // Aggressive filter: only keep strings that look like real game text
    const meaningful = extracted.filter(s => {
      const text = s.original.trim();
      if (text.length < 5) return false;

      // Must contain at least one word with 4+ letters (real English/game words)
      if (!/[a-zA-Z]{4,}/.test(text)) return false;
      // Must contain a space (real phrases/sentences) — single words are usually code
      if (text.length > 6 && !text.includes(' ')) return false;
      // Alphabetic ratio must be > 60% (filters binary garbage)
      const alphaCount = (text.match(/[a-zA-Z]/g) || []).length;
      if (alphaCount / text.length < 0.6) return false;
      // Short strings (< 15 chars) need at least 2 words with 3+ letters
      if (text.length < 15) {
        const words = text.split(/\s+/).filter(w => /^[a-zA-Z]{3,}/.test(w));
        if (words.length < 2) return false;
      }

      // --- Blocklist patterns: binary/system noise ---
      const lower = text.toLowerCase();
      // PE headers, DOS stubs
      if (lower.includes('this program cannot be run') || lower.includes('dos mode')) return false;
      // C runtime / compiler artifacts
      if (/^(msvc|gcc|mingw|clang|borland|runtime|assertion|abort|invalid parameter)/i.test(text)) return false;
      if (/^_(crt|matherr|except|security|init|onexit|amsg)/i.test(text)) return false;
      // System API / Windows internals
      if (/^(kernel32|user32|gdi32|advapi32|ntdll|shell32|ole32|comctl)/i.test(text)) return false;
      if (/HKEY_|\\Registry\\|\\Device\\|\\Windows\\|\\System32\\/i.test(text)) return false;
      // File paths, extensions, URLs
      if (/\.(dll|exe|sys|drv|ocx|pdb|lib|obj|exp|res|rc|manifest|crt|pem|p12)$/i.test(text)) return false;
      if (/\.(txt|png|jpg|jpeg|bmp|gif|wav|ogg|mp3|mp4|avi|dat|bin|pak|wad)$/i.test(text)) return false;
      if (/\.(cfg|ini|xml|json|yaml|yml|csv|log|tmp|bak|old|sav)$/i.test(text)) return false;
      if (/^[A-Z]:\\|^\/usr\/|^\/etc\/|^\/home\//i.test(text)) return false;
      if (/^(https?:|www\.|ftp:|file:)/i.test(text)) return false;
      // Programming: format specifiers, escape codes, hex
      if (/^%[dsifcpxXoulFeEgG#0\-+ *]+$/.test(text)) return false;
      if (/(%[dsifcpxX#0\-+].*){3,}/.test(text)) return false; // printf-heavy strings
      if (/\\[xun]|0x[0-9a-f]{2,}/i.test(text)) return false;
      // CONSTANT_NAMES, enum values, macros
      if (/^[A-Z][A-Z0-9_]{3,}$/.test(text)) return false;
      if (/^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/.test(text) && !text.includes(' ')) return false; // camelCase
      // XML/HTML tags
      if (/^<[a-zA-Z\/]/.test(text) && text.includes('>')) return false;
      // Pure symbols, control chars, garbage
      if (/^[\x00-\x1F\x7F-\xFF]+$/.test(text)) return false;
      if (/^[^a-zA-Z]*$/.test(text)) return false;
      // Short technical tokens
      if (text.length <= 8 && /^[A-Z]/.test(text) && !/\s/.test(text)) return false;
      // Version strings, build IDs
      if (/^v?\d+\.\d+(\.\d+)?/.test(text) && text.length < 20) return false;
      // Scripting code (Lua, Python, JS, config)
      if (/^(function |return |local |end$|if |else|elseif |for |while |repeat |until )/i.test(text)) return false;
      if (/^(print|set|get|require|dofile|loadfile|import|export|module)\s*[\(\.]/i.test(text)) return false;
      if (/^--\s/.test(text)) return false; // Lua comments
      if (/\w+\s*[=]\s*[\d"'\[\{(true|false|nil|null)]/.test(text)) return false; // assignments
      if (/\w+\.\w+\s*[=(]/.test(text)) return false; // obj.method( or obj.prop =
      if (/\w+\([^)]*\)\s*$/.test(text) && !/\s{2,}/.test(text)) return false; // function calls like Func(args)
      // Engine/editor metadata labels (common in Telltale, Unity, etc.)
      if (/^[A-Z][a-z]+([ -][A-Z][a-z]+)*:?\s/.test(text) && /[A-Z]/.test(text.slice(-10))) return false; // "NavCam - Target Offset"
      // Common C/C++ runtime noise
      const noisePatterns = [
        'buffer overrun', 'stack cookie', 'security cookie', 'pure virtual',
        'bad allocation', 'out of memory', 'heap corruption', 'access violation',
        'unhandled exception', 'debug assertion', 'invalid argument',
        'not enough memory', 'unknown error', 'fatal error', 'internal error',
        'bad_cast', 'bad_typeid', 'overflow', 'underflow',
        'mutex', 'semaphore', 'critical section', 'thread local',
        'resource', 'assembly', 'animator', 'renderer', 'shader',
      ];
      if (noisePatterns.some(p => lower.includes(p))) return false;

      return true;
    });

    log(`  📊 ${extracted.length} stringhe totali → ${meaningful.length} significative (${((meaningful.length/extracted.length)*100).toFixed(0)}% filtrate)`);

    if (meaningful.length === 0) {
      log('  ℹ️ Nessuna stringa di gioco trovata nel binario.');
      log('');
      log('💡 Per tradurre i dialoghi, usa il Traduttore OCR:');
      log('  1. Avvia il gioco');
      log('  2. Apri OCR Translator dalla sidebar');
      log('  3. Seleziona la zona con il testo → traduzione live!');
      return;
    }

    // Detect source language
    const sampleText = meaningful.slice(0, 50).map(s => s.original).join(' ');
    const sourceLang = detectLanguage(sampleText);
    log(`  🌐 Lingua rilevata: ${sourceLang}`);

    // Translate in batches
    setTranslateStatus('Traduzione stringhe...');
    setTranslateProgress(5);
    log(`\n  🤖 Traduzione ${meaningful.length} stringhe...`);
    
    const BATCH = 15;
    const totalBatches = Math.ceil(meaningful.length / BATCH);
    let translatedCount = 0;

    const TIMEOUT_MS = 30000;
    for (let bi = 0; bi < meaningful.length; bi += BATCH) {
      const batchNum = Math.floor(bi / BATCH) + 1;
      const pct = Math.round(5 + (batchNum / totalBatches) * 85);
      setTranslateProgress(pct);
      setTranslateStatus(`${translatedCount}/${meaningful.length} stringhe — batch ${batchNum}/${totalBatches}`);
      await new Promise(r => setTimeout(r, 10));

      const batch = meaningful.slice(bi, bi + BATCH);
      const texts = batch.map(s => s.original);

      try {
        const result = await Promise.race([
          translateSmart({
            texts,
            targetLanguage,
            sourceLanguage: sourceLang || 'auto',
            gameId: gameCtx.id,
          }),
          new Promise<{ success: false; translations: null }>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout 30s')), TIMEOUT_MS)
          ),
        ]);

        if (result.success && result.translations) {
          for (let i = 0; i < batch.length && i < result.translations.length; i++) {
            const fitted = fitToByteLength(result.translations[i], batch[i].byteLen);
            batch[i].translated = fitted;
            batch[i].isTranslated = true;
            translatedCount++;
          }
        }
      } catch (e) {
        log(`  ⚠️ Batch ${batchNum}: ${e}`);
      }

      if (batchNum % 5 === 0 || batchNum === 1 || batchNum === totalBatches) {
        log(`  📊 ${translatedCount}/${meaningful.length} tradotte (batch ${batchNum}/${totalBatches})`);
      }
    }

    log(`\n  ✅ ${translatedCount}/${meaningful.length} stringhe tradotte`);

    // Apply patch
    if (translatedCount > 0) {
      setTranslateStatus('Applicazione patch...');
      log('\n  🔧 Applicazione patch al binario...');

      const patchResult = applyPatch(fileBytes, meaningful);

      if (patchResult.success && patchResult.patchedBuffer) {
        // Save patched file
        const outputPath = mainExe.replace(/\.exe$/i, `_${targetLanguage.toUpperCase()}.exe`)
                                   .replace(/\.dll$/i, `_${targetLanguage.toUpperCase()}.dll`);
        try {
          await invoke('write_binary_file', { 
            path: outputPath, 
            data: Array.from(patchResult.patchedBuffer) 
          });
          log(`  ✅ Salvato: ${outputPath.split(/[\\/]/).pop()}`);
          log(`  📊 ${patchResult.patchedCount} patch applicate`);
          if (patchResult.errors.length > 0) {
            log(`  ⚠️ ${patchResult.errors.length} errori (vedi console)`);
          }
        } catch (e) {
          log(`  ❌ Errore salvataggio: ${e}`);
        }
      } else {
        log(`  ❌ Patch fallita: ${patchResult.errors.join(', ')}`);
      }
    }

    log(`\n🏁 Binary Patcher completato: ${translatedCount} stringhe tradotte`);
    if (translatedCount > 0 && translatedCount < 200) {
      log('');
      log('💡 Menu e UI tradotti! Per i dialoghi del gioco:');
      log('  → Usa il Traduttore OCR dalla sidebar per traduzione live dallo schermo');
    }
  };

  // ============================================================
  // INLINE: Unity XUnity Autotranslator
  // ============================================================
  const inlineUnityXUnity = async (gameCtx: GameContext, log: (m: string) => void) => {
    log('🔧 Unity — Installazione BepInEx + XUnity...');

    // Find main exe name
    let exeName = '';
    try {
      const files = await invoke<string[]>('list_directory_files', { path: gameCtx.installPath });
      exeName = files.find(f => f.toLowerCase().endsWith('.exe') && !f.toLowerCase().includes('unitycrash'))
        ?.split(/[\\/]/).pop() || '';
    } catch {}

    if (!exeName) {
      log('❌ Exe del gioco non trovato');
      return;
    }

    log(`  🎮 Exe: ${exeName}`);
    setTranslateStatus('Installazione BepInEx + XUnity...');
    setTranslateProgress(20);

    try {
      const result = await invoke<any>('install_unity_autotranslator', {
        gamePath: gameCtx.installPath,
        gameExeName: exeName,
        targetLang: targetLanguage,
        translationMode: 'capture',
      });

      setTranslateProgress(80);

      if (result?.success || result?.status === 'installed') {
        log('  ✅ BepInEx installato');
        log('  ✅ XUnity Autotranslator installato');
        log(`  🌍 Lingua target: ${targetLanguage}`);
        if (result?.steps?.length) {
          for (const step of result.steps) { log(`  → ${step}`); }
        }
        log('\n  📋 Prossimi passi:');
        log('  1. Avvia il gioco normalmente');
        log('  2. Gioca qualche minuto per raccogliere le stringhe');
        log('  3. Chiudi il gioco');
        log('  4. Le stringhe raccolte saranno in BepInEx/Translation/');
        log('  5. Torna qui per tradurre le stringhe raccolte con AI');
      } else {
        log(`  ⚠️ Risultato: ${JSON.stringify(result)}`);
      }
    } catch (e) {
      log(`  ❌ Errore installazione: ${e}`);
      log('  💡 Prova ad installare manualmente BepInEx dal sito ufficiale');
    }

    // Check if there are already captured strings to translate
    setTranslateProgress(90);
    try {
      const translations = await invoke<any[]>('read_xunity_translations', { gamePath: gameCtx.installPath });
      if (translations && translations.length > 0) {
        log(`\n  📝 ${translations.length} stringhe già catturate trovate!`);
        log('  🤖 Traduzione automatica...');

        const untranslated = translations.filter((t: any) => !t.translation || t.translation === t.original);
        if (untranslated.length > 0) {
          const texts = untranslated.slice(0, 200).map((t: any) => t.original);
          try {
            const result = await translateSmart({
              texts,
              targetLanguage,
              sourceLanguage: 'auto',
              gameId: gameCtx.id,
            });
            if (result.success && result.translations) {
              let saved = 0;
              for (let i = 0; i < untranslated.length && i < result.translations.length; i++) {
                try {
                  await invoke('save_xunity_translation', {
                    gamePath: gameCtx.installPath,
                    original: untranslated[i].original,
                    newTranslation: result.translations[i],
                  });
                  saved++;
                } catch {}
              }
              log(`  ✅ ${saved} stringhe tradotte e salvate`);
            }
          } catch (e) { log(`  ⚠️ Errore traduzione: ${e}`); }
        } else {
          log('  ✅ Tutte le stringhe sono già tradotte');
        }
      }
    } catch {
      log('  ℹ️ Nessuna stringa catturata ancora. Avvia il gioco prima.');
    }

    log('\n🏁 Unity XUnity completato');
  };

  // ============================================================
  // INLINE: Ren'Py
  // ============================================================
  const inlineRenPy = async (gameCtx: GameContext, log: (m: string) => void) => {
    log("🔍 Ricerca file Ren'Py...");

    // Find .rpy files
    let rpyFiles: string[] = [];
    try {
      const files = await invoke<any[]>('scan_localization_files', {
        path: gameCtx.installPath, extensions: ['rpy'], maxDepth: 5
      });
      rpyFiles = (files || []).filter((f: any) => f.size > 100).map((f: any) => f.path);
    } catch {}

    if (rpyFiles.length === 0) {
      log("❌ Nessun file .rpy trovato. Il gioco potrebbe usare solo .rpyc compilati.");
      log("💡 Prova: unrpyc per decompilare i .rpyc");
      return;
    }

    log(`📂 ${rpyFiles.length} file .rpy trovati`);
    let totalDialogues = 0, translatedDialogues = 0;

    for (let fi = 0; fi < rpyFiles.length; fi++) {
      const file = rpyFiles[fi];
      const fileName = file.split(/[\\/]/).pop() || '';
      setTranslateStatus(`File ${fi + 1}/${rpyFiles.length}: ${fileName}`);

      let content: string;
      try {
        content = await invoke<string>('read_text_file', { path: file, maxBytes: 2000000 });
      } catch { continue; }

      // Extract dialogue strings: lines with quotes after character names or "narrator"
      const dialogueRegex = /^\s+(?:(\w+)\s+)?["'](.+?)["']\s*$/gm;
      const strings: Array<{ key: string; value: string }> = [];
      let match;
      while ((match = dialogueRegex.exec(content)) !== null) {
        const text = match[2];
        if (text.length > 2 && /[a-zA-Z]/.test(text)) {
          strings.push({ key: `${fi}:${match.index}`, value: text });
        }
      }

      // Also extract menu choices
      const menuRegex = /^\s+"(.+?)":\s*$/gm;
      while ((match = menuRegex.exec(content)) !== null) {
        if (match[1].length > 2) {
          strings.push({ key: `m${fi}:${match.index}`, value: match[1] });
        }
      }

      if (strings.length === 0) continue;
      totalDialogues += strings.length;
      log(`\n📄 ${fileName}: ${strings.length} dialoghi`);

      const translated = await translateBatch(
        strings.map(s => ({ key: s.key, text: s.value })), gameCtx, log, fi, rpyFiles.length
      );
      translatedDialogues += translated.size;

      if (translated.size > 0) {
        // Build Ren'Py translation file
        const tlDir = gameCtx.installPath.replace(/[\\/]$/, '') + `/game/tl/${targetLanguage}`;
        try { await invoke('create_directory', { path: tlDir }); } catch {}

        let tlContent = `# Translation file generated by GameStringer\n`;
        tlContent += `# Game: ${gameCtx.title}\n`;
        tlContent += `# Source: ${fileName}\n\n`;

        for (const [key, value] of translated) {
          const origStr = strings.find(s => s.key === key);
          if (origStr) {
            tlContent += `    old "${origStr.value}"\n`;
            tlContent += `    new "${value}"\n\n`;
          }
        }

        const tlPath = `${tlDir}/${fileName}`;
        try {
          await invoke('write_text_file', { path: tlPath, content: tlContent });
          log(`  ✅ Salvato tl/${targetLanguage}/${fileName}`);
        } catch (e) { log(`  ❌ Errore: ${e}`); }
      }
    }

    log(`\n🏁 Ren'Py: ${translatedDialogues}/${totalDialogues} dialoghi tradotti`);
  };

  // ============================================================
  // INLINE: Unreal Engine (.locres / .pak / IoStore)
  // ============================================================
  const inlineUnrealLocres = async (gameCtx: GameContext, log: (m: string) => void) => {
    log('🔍 Unreal Engine — Ricerca file di localizzazione...');
    setTranslateStatus('Estrazione stringhe Unreal...');

    // Step 1: Try extract_unreal_localization (handles loose .locres + .pak)
    let extraction: any = null;
    try {
      extraction = await invoke<any>('extract_unreal_localization', { gamePath: gameCtx.installPath });
      if (extraction?.success && extraction?.entries?.length > 0) {
        log(`  ✅ Estratte ${extraction.entries.length} stringhe`);
        log(`  📄 Sorgente: ${extraction.message || extraction.source_file}`);
      }
    } catch (e) {
      log(`  ⚠️ extract_unreal_localization: ${e}`);
    }

    // Step 2: If .pak extraction failed, try IoStore (.utoc/.ucas) for UE5 games
    if (!extraction?.success || !extraction?.entries?.length) {
      log('  🔄 Provo estrazione IoStore (UE5)...');
      try {
        extraction = await invoke<any>('extract_iostore_localization', { gamePath: gameCtx.installPath });
        if (extraction?.success && extraction?.entries?.length > 0) {
          log(`  ✅ IoStore: ${extraction.entries.length} stringhe`);
          log(`  📄 ${extraction.message}`);
        }
      } catch (e) {
        log(`  ⚠️ extract_iostore_localization: ${e}`);
      }
    }

    if (!extraction?.success || !extraction?.entries?.length) {
      log('\n  ❌ Nessuna stringa trovata nei file Unreal.');
      log('  💡 Possibili cause:');
      log('  • I .pak sono criptati (richiede chiave AES)');
      log('  • Formato PAK v10+ (UE5 PathHash) non ancora supportato');
      log('  • Il gioco non usa il sistema .locres standard');
      log('  💡 Prova: esporta i .locres con FModel e usa "Importa .locres" nel UE Translator');
      return;
    }

    const entries: Array<{ namespace: string; key: string; source_hash: number; value: string }> = extraction.entries;
    
    // Filter: only translatable strings (skip empty, very short, or code-like strings)
    const translatable = entries.filter(e => {
      if (!e.value || e.value.length < 2) return false;
      if (/^[A-Z_]+$/.test(e.value)) return false; // CONSTANT_NAMES
      if (/^[0-9.,\-+%]+$/.test(e.value)) return false; // numbers
      if (/^\{[0-9]\}$/.test(e.value)) return false; // {0} placeholders only
      return true;
    });

    log(`\n  📊 ${entries.length} totali → ${translatable.length} traducibili`);
    setTranslateProgress(20);

    if (translatable.length === 0) {
      log('  ❌ Nessuna stringa traducibile trovata');
      return;
    }

    // Step 3: Translate in batches
    setTranslateStatus(`Traduzione ${translatable.length} stringhe...`);
    log(`\n  🤖 Traduzione batch...`);

    const BATCH = 20;
    const translations: Array<{ namespace: string; key: string; source_hash: number; original: string; translated: string }> = [];
    let translatedCount = 0;

    for (let bi = 0; bi < translatable.length; bi += BATCH) {
      const batch = translatable.slice(bi, bi + BATCH);
      const texts = batch.map(e => e.value);

      try {
        const result = await translateSmart({
          texts,
          targetLanguage,
          sourceLanguage: 'auto',
          gameId: gameCtx.id,
        });

        if (result.success && result.translations) {
          for (let i = 0; i < batch.length && i < result.translations.length; i++) {
            translations.push({
              namespace: batch[i].namespace,
              key: batch[i].key,
              source_hash: batch[i].source_hash,
              original: batch[i].value,
              translated: result.translations[i],
            });
            translatedCount++;
          }
        }
      } catch (e) {
        log(`  ⚠️ Errore batch ${Math.floor(bi / BATCH) + 1}: ${e}`);
      }

      const progress = 20 + (bi / translatable.length) * 60;
      setTranslateProgress(Math.min(85, progress));

      if ((Math.floor(bi / BATCH)) % 10 === 0 && bi > 0) {
        log(`  📊 ${Math.min(bi + BATCH, translatable.length)}/${translatable.length}`);
      }
    }

    log(`\n  ✅ ${translatedCount}/${translatable.length} stringhe tradotte`);

    if (translatedCount === 0) {
      log('  ❌ Nessuna traduzione riuscita');
      return;
    }

    // Step 4: Create translation .pak
    setTranslateStatus('Creazione .pak di traduzione...');
    setTranslateProgress(88);
    log('\n  📦 Creazione .pak tradotto...');

    try {
      const pakResult = await invoke<any>('apply_unreal_translation', {
        gamePath: gameCtx.installPath,
        translations,
        targetLanguage,
      });

      if (pakResult?.success) {
        const pakName = pakResult.pak_path?.split(/[\\/]/).pop() || 'translation.pak';
        log(`  ✅ ${pakName} creato!`);
        log(`  📊 ${pakResult.entries_count} traduzioni nel .pak`);
        log(`  📁 ${pakResult.pak_path}`);
        log(`\n  📋 Il gioco caricherà automaticamente la traduzione.`);
        log(`  💡 Se non funziona, prova ad aggiungere "-culture=${targetLanguage}" ai parametri di lancio.`);
      } else {
        log(`  ⚠️ Risultato: ${JSON.stringify(pakResult)}`);
      }
    } catch (e) {
      log(`  ❌ Errore creazione .pak: ${e}`);
      log('  💡 Prova ad usare il UE Translator dedicato per più opzioni');
    }

    setTranslateProgress(95);
    log(`\n🏁 Unreal Engine: ${translatedCount} stringhe tradotte e impacchettate`);
  };

  // ============================================================
  // INLINE: Danganronpa (WAD/PAK/LIN)
  // ============================================================
  const inlineDanganronpa = async (gameCtx: GameContext, log: (m: string) => void) => {
    log('🔍 Danganronpa — Estrazione dialoghi...');
    setTranslateStatus('Estrazione dialoghi Danganronpa...');

    // Step 1: Extract dialogues via backend
    let extraction: any = null;
    try {
      extraction = await invoke<any>('extract_danganronpa_dialogues', { gamePath: gameCtx.installPath });
    } catch (e) {
      log(`  ❌ Errore estrazione: ${e}`);
    }

    if (!extraction?.success || !extraction?.dialogues?.length) {
      log('  ❌ Nessun dialogo trovato nei file WAD/PAK/LIN.');
      log('  💡 Provo fallback con Binary Patcher...');
      await inlineBinaryPatch(gameCtx, log);
      return;
    }

    const dialogues: Array<{ id: string; speaker: string; original: string; translated: string; file: string; line_index: number }> = extraction.dialogues;
    log(`  ✅ ${dialogues.length} dialoghi estratti`);
    log(`  📁 Output: ${extraction.output_path}`);
    setTranslateProgress(15);

    // Step 2: Translate in batches
    setTranslateStatus(`Traduzione ${dialogues.length} dialoghi...`);
    log(`\n  🤖 Traduzione batch...`);

    const BATCH = 15;
    let translatedCount = 0;

    for (let bi = 0; bi < dialogues.length; bi += BATCH) {
      const batch = dialogues.slice(bi, bi + BATCH);
      const texts = batch.map(d => d.original);

      try {
        const result = await translateSmart({
          texts,
          targetLanguage,
          sourceLanguage: 'en',
          gameId: gameCtx.id,
          context: 'Danganronpa visual novel game dialogue. Preserve character voice and tone.',
        });

        if (result.success && result.translations) {
          for (let i = 0; i < batch.length && i < result.translations.length; i++) {
            batch[i].translated = result.translations[i];
            translatedCount++;
          }
        }
      } catch (e) {
        log(`  ⚠️ Errore batch ${Math.floor(bi / BATCH) + 1}: ${e}`);
      }

      const progress = 15 + (bi / dialogues.length) * 70;
      setTranslateProgress(Math.min(88, progress));

      if ((Math.floor(bi / BATCH)) % 8 === 0 && bi > 0) {
        log(`  📊 ${Math.min(bi + BATCH, dialogues.length)}/${dialogues.length}`);
      }
    }

    log(`\n  ✅ ${translatedCount}/${dialogues.length} dialoghi tradotti`);

    if (translatedCount === 0) {
      log('  ❌ Nessuna traduzione riuscita');
      return;
    }

    // Step 3: Save translations
    setTranslateStatus('Salvataggio traduzioni...');
    setTranslateProgress(90);

    try {
      const translationsJson = JSON.stringify(dialogues, null, 2);
      await invoke('write_text_file', {
        path: `${extraction.output_path}\\translations.json`,
        content: translationsJson,
      });
      log(`  💾 translations.json salvato`);

      // Generate TSV for easy import
      const tsvLines = ['ID\tSpeaker\tOriginal\tTranslated\tFile'];
      for (const d of dialogues) {
        if (d.translated) {
          tsvLines.push(`${d.id}\t${d.speaker}\t${d.original}\t${d.translated}\t${d.file}`);
        }
      }
      await invoke('write_text_file', {
        path: `${extraction.output_path}\\translations.tsv`,
        content: tsvLines.join('\n'),
      });
      log(`  💾 translations.tsv salvato`);

      // Generate PO file
      const poLines = [
        '# Danganronpa Translation - Generated by GameStringer',
        `# Language: ${targetLanguage}`,
        'msgid ""',
        'msgstr ""',
        `"Language: ${targetLanguage}\\n"`,
        '',
      ];
      for (const d of dialogues) {
        if (d.translated) {
          const escapedId = d.original.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const escapedStr = d.translated.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          poLines.push(`#. ${d.file} [${d.id}]`);
          if (d.speaker) poLines.push(`#. Speaker: ${d.speaker}`);
          poLines.push(`msgid "${escapedId}"`);
          poLines.push(`msgstr "${escapedStr}"`);
          poLines.push('');
        }
      }
      await invoke('write_text_file', {
        path: `${extraction.output_path}\\danganronpa_translation.po`,
        content: poLines.join('\n'),
      });
      log(`  💾 danganronpa_translation.po salvato`);
    } catch (e) {
      log(`  ⚠️ Errore salvataggio: ${e}`);
    }

    setTranslateProgress(95);
    log(`\n  📁 Tutti i file in: ${extraction.output_path}`);
    log(`\n🏁 Danganronpa: ${translatedCount} dialoghi tradotti e salvati`);
  };

  // ============================================================
  // Shared: Batch translation helper
  // ============================================================
  const translateBatch = async (
    items: Array<{ key: string; text: string }>,
    gameCtx: GameContext,
    log: (m: string) => void,
    fileIdx: number,
    totalFiles: number,
  ): Promise<Map<string, string>> => {
    const BATCH_SIZE = 20;
    const translated = new Map<string, string>();
    const translatable = items.filter(s => s.text.length > 1 && /[a-zA-Z]/.test(s.text));

    for (let bi = 0; bi < translatable.length; bi += BATCH_SIZE) {
      const batch = translatable.slice(bi, bi + BATCH_SIZE);
      try {
        const result = await translateSmart({
          texts: batch.map(s => s.text),
          targetLanguage,
          sourceLanguage: 'auto',
          gameId: gameCtx.id,
        });
        if (result.success && result.translations) {
          batch.forEach((s, i) => {
            if (i < result.translations!.length) translated.set(s.key, result.translations![i]);
          });
        }
      } catch (e) {
        log(`  ⚠️ Errore batch: ${e}`);
      }

      const fileProgress = (fileIdx / totalFiles) * 100;
      const batchProgress = ((bi + BATCH_SIZE) / translatable.length) * (100 / totalFiles);
      setTranslateProgress(Math.min(95, fileProgress + batchProgress));
    }
    return translated;
  };

  // ============================================================
  // String extraction helpers
  // ============================================================
  const extractJsonStrings = (content: string): Array<{ key: string; value: string }> => {
    const strings: Array<{ key: string; value: string }> = [];
    try {
      const obj = JSON.parse(content);
      const walk = (o: any, path: string) => {
        if (typeof o === 'string' && o.length > 1 && o.length < 2000) {
          strings.push({ key: path, value: o });
        } else if (Array.isArray(o)) {
          o.forEach((item, i) => walk(item, `${path}[${i}]`));
        } else if (o && typeof o === 'object') {
          for (const [k, v] of Object.entries(o)) {
            walk(v, path ? `${path}.${k}` : k);
          }
        }
      };
      walk(obj, '');
    } catch {}
    return strings;
  };

  const extractCsvStrings = (content: string, _targetLang: string): Array<{ key: string; value: string }> => {
    const strings: Array<{ key: string; value: string }> = [];
    const lines = content.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      for (let j = 1; j < cells.length; j++) {
        const val = cells[j]?.replace(/^"|"$/g, '').trim();
        if (val && val.length > 1 && /[a-zA-Z]/.test(val)) {
          strings.push({ key: `${i}:${j}`, value: val });
        }
      }
    }
    return strings;
  };

  const extractXmlStrings = (content: string): Array<{ key: string; value: string }> => {
    const strings: Array<{ key: string; value: string }> = [];
    const regex = /<([^>]+)>([^<]+)<\/\1>/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const val = match[2].trim();
      if (val.length > 1 && /[a-zA-Z]/.test(val)) {
        strings.push({ key: match[1], value: val });
      }
    }
    return strings;
  };

  const extractPoStrings = (content: string): Array<{ key: string; value: string }> => {
    const strings: Array<{ key: string; value: string }> = [];
    const blocks = content.split(/\n\n+/);
    for (const block of blocks) {
      const msgidMatch = block.match(/msgid\s+"(.+)"/);
      if (msgidMatch && msgidMatch[1]) {
        strings.push({ key: msgidMatch[1], value: msgidMatch[1] });
      }
    }
    return strings;
  };

  const extractGenericStrings = (content: string): Array<{ key: string; value: string }> => {
    const strings: Array<{ key: string; value: string }> = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // key=value or key:value format
      const match = line.match(/^([^=:#]+)[=:](.+)$/);
      if (match) {
        const val = match[2].trim();
        if (val.length > 1 && /[a-zA-Z]/.test(val)) {
          strings.push({ key: match[1].trim(), value: val });
        }
      }
    }
    return strings;
  };

  // ============================================================
  // Translation application helpers
  // ============================================================
  const applyJsonTranslations = (content: string, translations: Map<string, string>): string => {
    try {
      const obj = JSON.parse(content);
      const apply = (o: any, path: string): any => {
        if (typeof o === 'string') {
          const t = translations.get(path);
          return t !== undefined ? t : o;
        } else if (Array.isArray(o)) {
          return o.map((item, i) => apply(item, `${path}[${i}]`));
        } else if (o && typeof o === 'object') {
          const result: any = {};
          for (const [k, v] of Object.entries(o)) {
            result[k] = apply(v, path ? `${path}.${k}` : k);
          }
          return result;
        }
        return o;
      };
      return JSON.stringify(apply(obj, ''), null, 2);
    } catch {
      return content;
    }
  };

  const applyCsvTranslations = (content: string, translations: Map<string, string>, _targetLang: string): string => {
    const lines = content.split('\n');
    for (const [key, value] of translations) {
      const [row, col] = key.split(':').map(Number);
      if (lines[row]) {
        const cells = lines[row].split(',');
        if (cells[col] !== undefined) {
          cells[col] = `"${value.replace(/"/g, '""')}"`;
          lines[row] = cells.join(',');
        }
      }
    }
    return lines.join('\n');
  };

  const applyGenericTranslations = (content: string, translations: Map<string, string>): string => {
    let result = content;
    for (const [key, value] of translations) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`^(${escapedKey}\\s*[=:])\\s*(.+)$`, 'm'), `$1${value}`);
    }
    return result;
  };

  const openInEditor = async (file: LocalizationFile) => {
    try {
      // Read file content before opening editor
      const content = await invoke<string>('read_text_file', { 
        path: file.path, 
        maxBytes: 500000 // 500KB max for editor
      });
      
      sessionStorage.setItem('editorFile', JSON.stringify({
        gameId: analysisResult?.game.id,
        gameName: analysisResult?.game.title,
        filePath: file.path,
        filename: file.name,
        originalContent: content,
        content: content,
        sourceLanguage: 'en',
        targetLanguage: targetLanguage
      }));
      window.location.href = '/editor';
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: 'error',
        description: 'Impossibile leggere il file',
        variant: 'destructive'
      });
    }
  };

  // --- Render ---
  const WIZARD_STEPS: WizardStep[] = ['select-game', 'analyzing', 'results', 'translate', 'complete'];
  const STEP_LABELS = ['Gioco', 'Analisi', 'Strategia', 'Traduzione', 'Fatto'];

  const renderStepIndicator = () => {
    const currentIdx = WIZARD_STEPS.indexOf(step);
    return (
      <div className="flex items-center justify-center gap-1 mb-6">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                step === s ? "bg-purple-500 text-white ring-2 ring-purple-500/30" :
                currentIdx > i 
                  ? "bg-green-500 text-white" 
                  : "bg-slate-700 text-slate-400"
              )}>
                {currentIdx > i ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <span className={cn(
                "text-[9px] mt-1",
                step === s ? "text-purple-300" : currentIdx > i ? "text-green-400" : "text-slate-600"
              )}>
                {STEP_LABELS[i]}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={cn(
                "w-8 h-0.5 mx-0.5 mb-4",
                currentIdx > i ? "bg-green-500" : "bg-slate-700"
              )} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Show error if any
  if (renderError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 font-bold mb-2">error di rendering</h2>
          <p className="text-slate-300 text-sm">{renderError}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Ricarica pagina
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Compatto */}
        <div className="text-center mb-4 shrink-0">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Translation Wizard
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            Analizza automaticamente i games e scopri come tradurli
          </p>
        </div>

        {renderStepIndicator()}

        <AnimatePresence mode="wait">
          {/* Step 1: Select Game */}
          {step === 'select-game' && (
            <motion.div
              key="select-game"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-purple-400" />
                    Select a game
                  </CardTitle>
                  <CardDescription>
                    Scegli il game che vuoi tradurre dalla tua library
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search game..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-900/50 border-slate-600"
                    />
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-2">
                        {filteredGames.map((game) => (
                          <button
                            key={game.id}
                            onClick={() => analyzeGame(game)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/30 hover:bg-slate-900/60 border border-slate-700 hover:border-purple-500/50 transition-all text-left group"
                          >
                            {/* Game cover or fallback icon */}
                            <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                              {game.header_image ? (
                                <img 
                                  src={game.header_image} 
                                  alt={game.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg class="h-4 w-4 text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>';
                                  }}
                                />
                              ) : (
                                <FileText className="h-4 w-4 text-purple-400" />
                              )}
                            </div>
                            {/* Info game */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white text-sm truncate">{game.title}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {game.install_path || 'Percorso non disponibile'}
                              </p>
                            </div>
                            {/* Badge engine */}
                            {game.engine && game.engine !== 'Unknown' && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[10px] shrink-0 h-5",
                                  game.engine === 'Unity' && "border-green-500/50 text-green-400 bg-green-500/10",
                                  game.engine?.includes('Unreal') && "border-blue-500/50 text-blue-400 bg-blue-500/10",
                                  game.engine === 'Godot' && "border-cyan-500/50 text-cyan-400 bg-cyan-500/10",
                                  game.engine === 'RPG Maker' && "border-orange-500/50 text-orange-400 bg-orange-500/10",
                                  game.engine === "Ren'Py" && "border-pink-500/50 text-pink-400 bg-pink-500/10",
                                  game.engine === 'GameMaker' && "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                                )}
                              >
                                {game.engine?.replace(' Engine', '')}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors shrink-0" />
                          </button>
                        ))}
                        
                        {filteredGames.length === 0 && (
                          <div className="text-center py-12 text-slate-500">
                            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No game trovato</p>
                            <p className="text-sm mt-1">Prova a cercare con un altro termine</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Analyzing */}
          {step === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-8 pb-8">
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                      <div 
                        className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"
                        style={{ animationDuration: '1s' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Wand2 className="h-8 w-8 text-purple-400" />
                      </div>
                    </div>
                    
                    <h2 className="text-xl font-semibold text-white mb-2">
                      Analisi in corso...
                    </h2>
                    <p className="text-slate-400 mb-6">{selectedGame?.title}</p>
                    
                    <div className="max-w-md mx-auto">
                      <Progress value={analysisProgress} className="h-2 mb-3" />
                      <p className="text-sm text-slate-500">{analysisStatus}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Results */}
          {step === 'results' && analysisResult && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Game Info Card */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2 pt-5 px-5">
                  <div className="flex justify-between items-start gap-4">
                    {/* Game Cover */}
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center shrink-0 overflow-hidden">
                      {selectedGame?.header_image ? (
                        <img 
                          src={selectedGame.header_image} 
                          alt={analysisResult.game.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <FileText className="h-5 w-5 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl mb-1 truncate">{analysisResult.game.title}</CardTitle>
                      <CardDescription className="font-mono text-[10px] truncate opacity-70" title={analysisResult.game.install_path}>
                        {analysisResult.game.install_path}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs shrink-0 px-2 py-0.5 h-6",
                        analysisResult.difficulty === 'easy' && "border-green-500 text-green-400",
                        analysisResult.difficulty === 'medium' && "border-yellow-500 text-yellow-400",
                        analysisResult.difficulty === 'hard' && "border-red-500 text-red-400"
                      )}
                    >
                      {analysisResult.difficulty === 'easy' && '✨ Facile'}
                      {analysisResult.difficulty === 'medium' && '⚡ Media'}
                      {analysisResult.difficulty === 'hard' && '🔥 Difficile'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
                      <Settings2 className="h-4 w-4 text-blue-400 mx-auto mb-1.5" />
                      <p className="font-bold text-white text-sm">{analysisResult.engine}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Engine</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
                      <FileCode className="h-4 w-4 text-purple-400 mx-auto mb-1.5" />
                      <p className="font-bold text-white text-sm">{analysisResult.localizationFiles.length}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">File</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
                      <Database className="h-4 w-4 text-cyan-400 mx-auto mb-1.5" />
                      <p className="font-bold text-white text-sm">~{analysisResult.estimatedStrings.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Stringhe</p>
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1.5">
                      {analysisResult.existingLanguages.map(lang => (
                        <Badge 
                          key={lang} 
                          variant="secondary"
                          className={cn(
                            "bg-slate-700 text-[10px] px-1.5 h-5",
                            lang === 'it' && "bg-green-500/20 text-green-400 border-green-500/30"
                          )}
                        >
                          {languageNames[lang] || lang.toUpperCase()}
                          {lang === 'it' && ' ✓'}
                        </Badge>
                      ))}
                      {!analysisResult.existingLanguages.includes(targetLanguage) && (
                        <Badge variant="outline" className="border-dashed border-purple-500/50 text-purple-400 text-[10px] px-1.5 h-5">
                          + {languageNames[targetLanguage] || targetLanguage.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Strategy Box */}
                  {strategy && (
                    <div className={cn(
                      "p-3 rounded-lg border",
                      strategy.canDoInline
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-purple-500/10 border-purple-500/30"
                    )}>
                      <div className="flex items-start gap-3">
                        <Zap className={cn(
                          "h-5 w-5 mt-0.5 shrink-0",
                          strategy.canDoInline ? "text-emerald-400" : "text-purple-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-white">{strategy.name}</h4>
                            <Badge variant="outline" className={cn("text-[9px] h-4",
                              strategy.difficulty === 'easy' && "border-green-500/50 text-green-400",
                              strategy.difficulty === 'medium' && "border-yellow-500/50 text-yellow-400",
                              strategy.difficulty === 'hard' && "border-red-500/50 text-red-400"
                            )}>
                              {strategy.difficulty === 'easy' ? 'Facile' : strategy.difficulty === 'medium' ? 'Media' : 'Difficile'}
                            </Badge>
                            {strategy.canDoInline && (
                              <Badge className="text-[9px] h-4 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                Traduzione diretta
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed mb-2">{strategy.description}</p>
                          
                          <div className="space-y-0.5">
                            {strategy.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-500">
                                <span className="text-purple-400 font-bold shrink-0">{i + 1}.</span>
                                <span>{step}</span>
                              </div>
                            ))}
                          </div>

                          {strategy.requirements.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <Info className="h-3 w-3 text-amber-400 shrink-0" />
                              <span className="text-[10px] text-amber-300">
                                Richiede: {strategy.requirements.join(', ')}
                              </span>
                            </div>
                          )}

                          <div className="mt-2 text-[10px] text-slate-500">
                            Tempo stimato: ~{strategy.estimatedMinutes} min
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alternative strategies */}
                  {altStrategies.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] text-slate-500 mb-1.5">Strategie alternative:</p>
                      <div className="flex gap-2">
                        {altStrategies.map(alt => (
                          <button
                            key={alt.id}
                            onClick={() => startTranslation(alt)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 transition-colors text-left"
                          >
                            <span className="text-[10px] font-medium text-slate-300">{alt.name}</span>
                            <ArrowRight className="h-3 w-3 text-slate-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Localization Files */}
              {analysisResult.localizationFiles.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="py-3 px-5 border-b border-slate-700/50">
                    <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
                      <FileText className="h-4 w-4 text-purple-400" />
                      File di Localizzazione ({analysisResult.localizationFiles.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[180px]">
                      <div className="divide-y divide-slate-700/50">
                        {analysisResult.localizationFiles.map((file, i) => (
                          <div 
                            key={i}
                            className="flex items-center justify-between py-2 px-5 hover:bg-slate-700/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                "w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold shrink-0",
                                file.type === 'csv' && "bg-green-500/20 text-green-400",
                                file.type === 'json' && "bg-yellow-500/20 text-yellow-400",
                                file.type === 'xml' && "bg-blue-500/20 text-blue-400",
                                file.type === 'asset' && "bg-purple-500/20 text-purple-400",
                                !['csv', 'json', 'xml', 'asset'].includes(file.type) && "bg-slate-700 text-slate-400"
                              )}>
                                {file.type.toUpperCase().slice(0, 3)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-200 truncate leading-tight">{file.name}</p>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                  {file.stringCount > 0 ? `~${file.stringCount} str.` : 'Compilato'}
                                  {file.size > 0 && ` • ${(file.size / 1024).toFixed(1)} KB`}
                                </p>
                              </div>
                            </div>
                            

                            {file.type !== 'asset' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                                onClick={() => openInEditor(file)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setStep('select-game'); setAnalysisResult(null); }}
                  className="border-slate-600"
                >
                  ← Scegli altro game
                </Button>
                
                <div className="flex items-center gap-3">
                  <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                    <SelectTrigger className="w-[140px] bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                      <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="pt">🇵🇹 Português</SelectItem>
                      <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                      <SelectItem value="pl">🇵🇱 Polski</SelectItem>
                      <SelectItem value="zh">🇨🇳 中文</SelectItem>
                      <SelectItem value="ja">🇯🇵 日本語</SelectItem>
                      <SelectItem value="ko">🇰🇷 한국어</SelectItem>
                      <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
                      <SelectItem value="nl">🇳🇱 Nederlands</SelectItem>
                      <SelectItem value="sv">🇸🇪 Svenska</SelectItem>
                      <SelectItem value="cs">🇨🇿 Čeština</SelectItem>
                      <SelectItem value="hu">🇭🇺 Magyar</SelectItem>
                      <SelectItem value="ro">🇷🇴 Română</SelectItem>
                      <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                      <SelectItem value="th">🇹🇭 ภาษาไทย</SelectItem>
                      <SelectItem value="uk">🇺🇦 Українська</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {strategy?.id !== 'telltale' && strategy?.id !== 'ocr' && strategy?.id !== 'community-patch' && (
                    <Button 
                      onClick={() => startTranslation()}
                      className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Traduci Ora
                    </Button>
                  )}
                  {strategy?.id === 'community-patch' && (() => {
                    const ct = findCommunityTranslation(
                      analysisResult?.game.title || '',
                      selectedGame?.steam_app_id,
                      targetLanguage
                    );
                    return ct ? (
                      <Button 
                        onClick={() => window.open(ct.downloadUrl, '_blank')}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Translation ({ct.source})
                      </Button>
                    ) : null;
                  })()}
                  {strategy?.dedicatedTool && (
                    <Button 
                      variant={strategy.id === 'telltale' || strategy.id === 'ocr' ? 'default' : 'outline'}
                      onClick={() => {
                        if (analysisResult) {
                          sessionStorage.setItem('patcherAutoGame', JSON.stringify({
                            title: analysisResult.game.title,
                            install_path: analysisResult.game.install_path,
                            engine: analysisResult.engine,
                            steam_app_id: selectedGame?.steam_app_id,
                          }));
                        }
                        window.location.href = strategy.dedicatedTool!.route;
                      }}
                      className={strategy.id === 'telltale' || strategy.id === 'ocr' 
                        ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" 
                        : "border-slate-600"}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {strategy.dedicatedTool.name}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
          {/* Step 4: Translating (inline) */}
          {step === 'translate' && (
            <motion.div
              key="translate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="h-5 w-5 text-purple-400 animate-pulse" />
                    Traduzione in corso...
                  </CardTitle>
                  <CardDescription>{selectedGame?.title} → {languageNames[targetLanguage] || targetLanguage}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{translateStatus}</span>
                      <span>{Math.round(translateProgress)}%</span>
                    </div>
                    <Progress value={translateProgress} className="h-2" />
                  </div>

                  <ScrollArea className="h-[250px] rounded-lg bg-slate-900/50 border border-slate-700 p-3">
                    <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {translateLog.join('\n') || 'Avvio traduzione...'}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className={`bg-slate-800/50 ${strategy?.id === 'ocr' ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
                <CardContent className="pt-8 pb-8 text-center">
                  {strategy?.id === 'community-patch' ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                        <Download className="h-8 w-8 text-emerald-400" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">Community Translation Available!</h2>
                      <p className="text-slate-400 text-sm mb-6">
                        {strategy?.description}
                      </p>
                    </>
                  ) : (strategy?.id === 'telltale' || strategy?.id === 'ocr') ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                        <ExternalLink className="h-8 w-8 text-emerald-400" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">
                        {strategy?.dedicatedTool ? `Usa ${strategy.dedicatedTool.name}` : 'Prossimo Passo'}
                      </h2>
                      <p className="text-slate-400 text-sm mb-6">
                        {selectedGame?.title} — {strategy?.description}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-2">Traduzione Completata!</h2>
                      <p className="text-slate-400 text-sm mb-6">
                        {selectedGame?.title} è stato tradotto in {languageNames[targetLanguage] || targetLanguage}.
                        {strategy?.dedicatedTool && ` Per opzioni avanzate usa ${strategy.dedicatedTool.name}.`}
                      </p>
                    </>
                  )}

                  <ScrollArea className="h-[180px] rounded-lg bg-slate-900/50 border border-slate-700 p-3 text-left mb-6">
                    <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {translateLog.join('\n')}
                    </pre>
                  </ScrollArea>

                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => { setStep('select-game'); setAnalysisResult(null); setStrategy(null); }}
                      className="border-slate-600"
                    >
                      ← Traduci altro gioco
                    </Button>
                    {strategy?.id === 'community-patch' && (() => {
                      const ct = findCommunityTranslation(
                        analysisResult?.game.title || '',
                        selectedGame?.steam_app_id,
                        targetLanguage
                      );
                      return ct ? (
                        <Button
                          className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                          onClick={() => window.open(ct.downloadUrl, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Translation
                        </Button>
                      ) : null;
                    })()}
                    {strategy?.id !== 'ocr' && strategy?.id !== 'telltale' && (
                      <Button
                        variant={strategy?.id === 'community-patch' ? 'outline' : 'default'}
                        className={strategy?.id === 'community-patch' ? 'border-slate-600' : 'bg-gradient-to-r from-emerald-500 to-cyan-600'}
                        onClick={() => {
                          if (analysisResult?.game.install_path) {
                            invoke('open_folder', { path: analysisResult.game.install_path }).catch(() => {});
                          }
                        }}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Apri Cartella Gioco
                      </Button>
                    )}
                    {strategy?.dedicatedTool && strategy?.id !== 'community-patch' && (
                      <Button
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                        onClick={() => {
                          if (analysisResult) {
                            sessionStorage.setItem('patcherAutoGame', JSON.stringify({
                              title: analysisResult.game.title,
                              install_path: analysisResult.game.install_path,
                              engine: analysisResult.engine,
                              steam_app_id: selectedGame?.steam_app_id,
                            }));
                          }
                          window.location.href = strategy!.dedicatedTool!.route;
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {strategy.dedicatedTool.name}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}



