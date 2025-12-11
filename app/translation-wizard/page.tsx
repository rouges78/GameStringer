'use client';

import { useState, useEffect } from 'react';
import { 
  Wand2, Search, FolderOpen, FileText, Languages, CheckCircle2, 
  AlertCircle, Loader2, ChevronRight, Globe, Sparkles, Download,
  ArrowRight, Info, Lightbulb, Zap, FileCode, Database, Play,
  RefreshCw, Eye, Copy, ExternalLink, Settings2, HelpCircle
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

// --- Types ---
interface Game {
  id: string;
  title: string;
  steam_app_id?: number;
  install_path?: string;
  engine?: string;
  platform?: string;
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

// Language display names
const languageNames: Record<string, string> = {
  en: 'Inglese', fr: 'Francese', de: 'Tedesco', es: 'Spagnolo',
  pt: 'Portoghese', pl: 'Polacco', ru: 'Russo', zh: 'Cinese',
  ja: 'Giapponese', ko: 'Coreano', it: 'Italiano', nl: 'Olandese',
  tr: 'Turco', ar: 'Arabo', th: 'Tailandese', vi: 'Vietnamita'
};

export default function TranslationWizardPage() {
  // --- State ---
  const [step, setStep] = useState<WizardStep>('select-game');
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('it');
  const { toast } = useToast();

  // --- Effects ---
  useEffect(() => {
    loadGames();
  }, []);

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
      const cachedGames = await invoke('load_steam_games_cache');
      if (Array.isArray(cachedGames)) {
        const installedGames = cachedGames
          .filter((g: any) => g.is_installed && g.title && g.install_path)
          .map((g: any) => ({
            id: String(g.steam_app_id || g.id),
            title: g.title,
            steam_app_id: g.steam_app_id,
            install_path: g.install_path,
            engine: g.engine || 'Unknown',
            platform: g.platform || 'steam'
          }))
          .sort((a: Game, b: Game) => a.title.localeCompare(b.title));
        
        setGames(installedGames);
        setFilteredGames(installedGames);
      }
    } catch (error) {
      console.error('Error loading games:', error);
      toast({ title: 'Errore', description: 'Impossibile caricare i giochi', variant: 'destructive' });
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
      // Step 1: Find installation path - always use find_game_install_path for full path
      setAnalysisProgress(10);
      let installPath: string | null = null;
      
      // install_path from cache is usually just the folder name, not full path
      // Use find_game_install_path to get the complete path
      const searchDir = game.install_path || game.title;
      try {
        installPath = await invoke<string>('find_game_install_path', { installDir: searchDir });
        console.log('[Wizard] Found install path:', installPath);
      } catch (e) {
        console.warn('[Wizard] find_game_install_path failed:', e);
        // If install_path looks like a full path (contains : or starts with /), use it directly
        if (game.install_path && (game.install_path.includes(':') || game.install_path.startsWith('/'))) {
          installPath = game.install_path;
        }
      }

      if (!installPath) {
        throw new Error('Percorso di installazione non trovato. Assicurati che il gioco sia installato.');
      }

      // Step 2: Detect game engine
      setAnalysisProgress(25);
      setAnalysisStatus('Rilevamento engine di gioco...');
      const engine = await detectGameEngine(installPath);

      // Step 3: Scan for localization files
      setAnalysisProgress(40);
      setAnalysisStatus('Scansione file di localizzazione...');
      const locFiles = await scanLocalizationFiles(installPath, engine);

      // Step 4: Analyze file contents
      setAnalysisProgress(60);
      setAnalysisStatus('Analisi contenuti...');
      const analyzedFiles = await analyzeFileContents(locFiles);

      // Step 5: Generate recommendation
      setAnalysisProgress(80);
      setAnalysisStatus('Generazione raccomandazioni...');
      
      const existingLanguages = [...new Set(analyzedFiles.flatMap(f => f.languages))];
      const hasItalian = existingLanguages.includes('it') || existingLanguages.includes('italian');
      const totalStrings = analyzedFiles.reduce((sum, f) => sum + f.stringCount, 0);

      let recommendedMethod: 'file' | 'bridge' | 'manual' = 'file';
      let recommendation = '';
      let difficulty: 'easy' | 'medium' | 'hard' = 'medium';

      if (analyzedFiles.length > 0 && analyzedFiles.some(f => f.type !== 'asset' && f.type !== 'unknown')) {
        recommendedMethod = 'file';
        recommendation = `Trovati ${analyzedFiles.length} file di localizzazione accessibili. Puoi tradurre direttamente i file e sostituirli nel gioco.`;
        difficulty = 'easy';
      } else if (engine === 'Unity' || engine === 'Unreal') {
        recommendedMethod = 'bridge';
        recommendation = `Gioco ${engine} con asset compilati. Usa Translation Bridge per tradurre i testi in tempo reale senza modificare i file.`;
        difficulty = 'medium';
      } else {
        recommendedMethod = 'manual';
        recommendation = 'File di localizzazione non standard. Potrebbe richiedere analisi manuale o strumenti specifici.';
        difficulty = 'hard';
      }

      if (hasItalian) {
        recommendation = '✅ Il gioco supporta già l\'italiano! Puoi comunque migliorare la traduzione esistente.';
        difficulty = 'easy';
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
        max_depth: 10  // Increased depth for Unity _Data subfolders
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

  const startTranslation = () => {
    if (!analysisResult) return;
    
    // Navigate to Neural Translator with game pre-selected
    const params = new URLSearchParams({
      gameId: analysisResult.game.id,
      gameName: analysisResult.game.title,
      installPath: analysisResult.game.install_path || '',
      method: analysisResult.recommendedMethod,
      targetLang: targetLanguage
    });
    
    window.location.href = `/translator/pro?${params}`;
  };

  const openInEditor = (file: LocalizationFile) => {
    sessionStorage.setItem('editorFile', JSON.stringify({
      gameId: analysisResult?.game.id,
      gameName: analysisResult?.game.title,
      filePath: file.path,
      filename: file.name
    }));
    window.location.href = '/editor';
  };

  // --- Render ---
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {['select-game', 'analyzing', 'results'].map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
            step === s ? "bg-purple-500 text-white" :
            ['analyzing', 'results', 'translate', 'complete'].indexOf(step) > i 
              ? "bg-green-500 text-white" 
              : "bg-slate-700 text-slate-400"
          )}>
            {['analyzing', 'results', 'translate', 'complete'].indexOf(step) > i ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              i + 1
            )}
          </div>
          {i < 2 && (
            <div className={cn(
              "w-12 h-0.5 mx-1",
              ['analyzing', 'results', 'translate', 'complete'].indexOf(step) > i 
                ? "bg-green-500" 
                : "bg-slate-700"
            )} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 mb-4">
            <Wand2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Translation Wizard
          </h1>
          <p className="text-slate-400">
            Analizza automaticamente i giochi e scopri come tradurli
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
                    Seleziona un Gioco
                  </CardTitle>
                  <CardDescription>
                    Scegli il gioco che vuoi tradurre dalla tua libreria
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Cerca gioco..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-900/50 border-slate-600"
                    />
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {filteredGames.map((game) => (
                          <button
                            key={game.id}
                            onClick={() => analyzeGame(game)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-900/30 hover:bg-slate-900/60 border border-slate-700 hover:border-purple-500/50 transition-all text-left group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{game.title}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {game.install_path || 'Percorso non disponibile'}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                          </button>
                        ))}
                        
                        {filteredGames.length === 0 && (
                          <div className="text-center py-12 text-slate-500">
                            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>Nessun gioco trovato</p>
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
              className="space-y-6"
            >
              {/* Game Info Card */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{analysisResult.game.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {analysisResult.game.install_path}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-sm",
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
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
                      <Settings2 className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                      <p className="text-lg font-bold text-white">{analysisResult.engine}</p>
                      <p className="text-xs text-slate-500">Engine</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
                      <FileCode className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                      <p className="text-lg font-bold text-white">{analysisResult.localizationFiles.length}</p>
                      <p className="text-xs text-slate-500">File trovati</p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
                      <Database className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
                      <p className="text-lg font-bold text-white">~{analysisResult.estimatedStrings.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Stringhe stimate</p>
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Lingue disponibili
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.existingLanguages.map(lang => (
                        <Badge 
                          key={lang} 
                          variant="secondary"
                          className={cn(
                            "bg-slate-700",
                            lang === 'it' && "bg-green-500/20 text-green-400 border-green-500/30"
                          )}
                        >
                          {languageNames[lang] || lang.toUpperCase()}
                          {lang === 'it' && ' ✓'}
                        </Badge>
                      ))}
                      {!analysisResult.hasItalian && (
                        <Badge variant="outline" className="border-dashed border-purple-500/50 text-purple-400">
                          + Italiano (da aggiungere)
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className={cn(
                    "p-4 rounded-lg border",
                    analysisResult.hasItalian 
                      ? "bg-green-500/10 border-green-500/30" 
                      : "bg-purple-500/10 border-purple-500/30"
                  )}>
                    <div className="flex items-start gap-3">
                      <Lightbulb className={cn(
                        "h-5 w-5 mt-0.5",
                        analysisResult.hasItalian ? "text-green-400" : "text-purple-400"
                      )} />
                      <div>
                        <h3 className="font-medium text-white mb-1">Raccomandazione</h3>
                        <p className="text-sm text-slate-300">{analysisResult.recommendation}</p>
                        
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="outline" className="border-slate-600">
                            {analysisResult.recommendedMethod === 'file' && '📁 Modifica File'}
                            {analysisResult.recommendedMethod === 'bridge' && '🔌 Translation Bridge'}
                            {analysisResult.recommendedMethod === 'manual' && '🔧 Manuale'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Localization Files */}
              {analysisResult.localizationFiles.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-400" />
                      File di Localizzazione
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisResult.localizationFiles.map((file, i) => (
                        <div 
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "w-8 h-8 rounded flex items-center justify-center text-xs font-bold",
                              file.type === 'csv' && "bg-green-500/20 text-green-400",
                              file.type === 'json' && "bg-yellow-500/20 text-yellow-400",
                              file.type === 'xml' && "bg-blue-500/20 text-blue-400",
                              file.type === 'asset' && "bg-purple-500/20 text-purple-400",
                              !['csv', 'json', 'xml', 'asset'].includes(file.type) && "bg-slate-700 text-slate-400"
                            )}>
                              {file.type.toUpperCase().slice(0, 3)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate">{file.name}</p>
                              <p className="text-xs text-slate-500">
                                {file.stringCount > 0 ? `~${file.stringCount} stringhe` : 'Asset compilato'}
                                {file.size > 0 && ` • ${(file.size / 1024).toFixed(1)} KB`}
                              </p>
                            </div>
                          </div>
                          
                          {file.type !== 'asset' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => openInEditor(file)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Apri nell'Editor</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => { setStep('select-game'); setAnalysisResult(null); }}
                  className="border-slate-600"
                >
                  ← Scegli altro gioco
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
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={startTranslation}
                    className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Inizia Traduzione
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
