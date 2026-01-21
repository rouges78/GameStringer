'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FolderOpen, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Terminal, 
  Gamepad2,
  Search,
  Sparkles,
  Info,
  ExternalLink,
  Play
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import { activityHistory } from '@/lib/activity-history';
import { useTranslation } from '@/lib/i18n';

interface PatchStatus {
  success: boolean;
  message: string;
  steps_completed: string[];
}

interface Game {
  id: string;
  app_id: string;
  appid?: number;
  title?: string;
  name?: string;
  platform: string;
  header_image: string | null;
  engine?: string | null;
  is_installed?: boolean;
  supported_languages?: string[] | string;
  install_dir?: string;
}

export function UnityPatcher() {
  const { t } = useTranslation();
  // URL params per preselezionare il game (da Neural Translator Pro)
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get('gameId');
  const urlGameName = searchParams.get('gameName');
  
  const [gamePath, setGamePath] = useState<string>('');
  const [exeName, setExeName] = useState<string>('');
  const [isPatching, setIsPatching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'patching' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [unityGames, setUnityGames] = useState<Game[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [hasSteamCredentials, setHasSteamCredentials] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [urlGameApplied, setUrlGameApplied] = useState(false); // Per evitare loop
  const [gameLanguages, setGameLanguages] = useState<string[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [engineCheck, setEngineCheck] = useState<{ is_unity: boolean; is_unreal: boolean; engine_name: string; can_patch: boolean; message: string; has_bepinex?: boolean; has_xunity?: boolean } | null>(null);
  const [patchInfo, setPatchInfo] = useState<{ bepinex: string; xunity: string } | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('it'); // Lingua di destinazione per la traduzione
  const [translationMode, setTranslationMode] = useState<'google' | 'deepl' | 'capture'>('capture'); // Modalità traduzione
  
  // Modalità di traduzione XUnity
  const translationModes = [
    { id: 'capture', name: '📝 Capture only', description: 'Capture text, translate with Neural Translator Pro (best quality)' },
    { id: 'google', name: '🌐 Google Translate', description: 'Free automatic translation (medium quality)' },
    { id: 'deepl', name: '🔷 DeepL', description: 'Premium automatic translation (requires API key)' },
  ];
  
  // Lingue supportate da XUnity.AutoTranslator
  const supportedLanguages = [
    { code: 'it', name: 'Italiano' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'pt', name: 'Português' },
    { code: 'ru', name: 'Русский' },
    { code: 'ja', name: '日本語' },
    { code: 'zh', name: '中文' },
    { code: 'ko', name: '한국어' },
    { code: 'pl', name: 'Polski' },
    { code: 'tr', name: 'Türkçe' },
  ];

  // Helper functions (definite prima degli useEffect che le usano)
  const getGameName = (g: Game) => g.name || g.title || 'Unknown game';
  
  const guessExeName = (gameName: string): string => {
    const clean = gameName
      .replace(/[:\-–—]/g, '')
      .replace(/['']/g, '')
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9]/g, '');
    return clean + '.exe';
  };

  useEffect(() => {
    loadUnityGames();
  }, []);

  // Preseleziona game da URL params (quando arriva da Neural Translator Pro)
  useEffect(() => {
    if (urlGameApplied || isLoadingGames || unityGames.length === 0) return;
    if (!urlGameId && !urlGameName) return;
    
    // Search game by ID or name
    let matchedGame: Game | null = null;
    
    if (urlGameId) {
      // Search by app_id or id
      const cleanId = urlGameId.replace('steam_', '');
      matchedGame = unityGames.find(g => 
        g.app_id === cleanId || 
        g.app_id === urlGameId ||
        String(g.appid) === cleanId
      ) || null;
    }
    
    if (!matchedGame && urlGameName) {
      // Search by name (case insensitive)
      const searchName = urlGameName.toLowerCase();
      matchedGame = unityGames.find(g => 
        getGameName(g).toLowerCase() === searchName ||
        getGameName(g).toLowerCase().includes(searchName)
      ) || null;
    }
    
    if (matchedGame) {
      console.log('[UnityPatcher] Game preselected from URL:', getGameName(matchedGame));
      // Seleziona il game direttamente
      setSelectedGame(matchedGame);
      setStatus('idle');
      setLogs([]);
      setProgress(0);
      if (matchedGame.install_dir) {
        setGamePath(matchedGame.install_dir);
        // Search for real executables in game folder
        invoke<string[]>('find_executables_in_folder', { folderPath: matchedGame.install_dir })
          .then(exes => {
            if (exes && exes.length > 0) {
              const mainExe = exes.find(e => !e.toLowerCase().includes('launcher')) || exes[0];
              setExeName(mainExe);
              console.log('[UnityPatcher] Executable found:', mainExe);
            } else {
              setExeName(guessExeName(getGameName(matchedGame)));
            }
          })
          .catch(() => {
            setExeName(guessExeName(getGameName(matchedGame)));
          });
        // Verifica motore
        invoke<{ is_unity: boolean; is_unreal: boolean; engine_name: string; can_patch: boolean; message: string; has_bepinex?: boolean; has_xunity?: boolean }>('check_game_engine', { gamePath: matchedGame.install_dir })
          .then(check => setEngineCheck(check))
          .catch(err => console.error('Engine verification error:', err));
      }
      toast.success(`🎮 Game "${getGameName(matchedGame)}" selected automatically`);
    } else {
      console.log('[UnityPatcher] Game not found in Unity list:', urlGameId, urlGameName);
      toast.info(`Game "${urlGameName}" not found among Unity games. Select it manually.`);
    }
    
    setUrlGameApplied(true);
  }, [unityGames, urlGameId, urlGameName, isLoadingGames, urlGameApplied]);

  const loadUnityGames = async () => {
    setIsLoadingGames(true);
    try {
      // Usa scan_all_steam_games_fast come la library Raipal
      const localGames = await invoke<Array<{
        id: string;
        title: string;
        platform: string;
        install_path: string | null;
        header_image: string | null;
        is_installed: boolean;
        steam_app_id: number | null;
        is_shared: boolean;
        engine?: string | null;
      }>>('scan_all_steam_games_fast');
      
      // Filtra solo games INSTALLATI (hanno install_path)
      const installedGames = localGames.filter(g => g.is_installed && g.install_path);
      // Debug: console.log(`[UNITY PATCHER] games installati: ${installedGames.length}`);
      
      // Debug: mostra i motori rilevati
      const engines = installedGames.reduce((acc, g) => {
        const eng = g.engine || 'Unknown';
        acc[eng] = (acc[eng] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      // Debug: console.log(`[UNITY PATCHER] Motori rilevati:`, engines);
      
      // Mostra tutti i games con engine noto, ordinati per engine
      const allGamesWithEngine = installedGames
        .filter(g => g.engine) // Solo games con engine rilevato
        .map(g => ({
          appid: g.steam_app_id || undefined,
          app_id: g.steam_app_id ? String(g.steam_app_id) : g.id,
          name: g.title,
          title: g.title,
          engine: g.engine,
          install_dir: g.install_path,
          header_image: g.header_image,
          is_installed: g.is_installed
        } as Game))
        .sort((a, b) => {
          // Unity prima, poi Unreal, poi altri
          const order = { 'unity': 0, 'unreal': 1 };
          const aOrder = order[a.engine?.toLowerCase() as keyof typeof order] ?? 2;
          const bOrder = order[b.engine?.toLowerCase() as keyof typeof order] ?? 2;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return getGameName(a).localeCompare(getGameName(b));
        });
      
      // Debug: console.log(`[PATCHER] games con engine: ${allGamesWithEngine.length}`);
      setUnityGames(allGamesWithEngine);
      setHasSteamCredentials(true); // Non serve più, ma manteniamo per UI
    } catch (err) {
      console.error('Games loading error:', err);
      setHasSteamCredentials(false);
      setUnityGames([]);
    } finally {
      setIsLoadingGames(false);
    }
  };

  // Fuzzy search: calculate similarity between two strings
  const fuzzyMatch = (text: string, query: string): number => {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    
    // Match esatto o contiene
    if (t.includes(q)) return 1;
    
    // Match parole che iniziano con la query
    const words = t.split(/\s+/);
    if (words.some(w => w.startsWith(q))) return 0.9;
    
    // Match fuzzy: conta caratteri in comune nella giusta sequenza
    let score = 0;
    let lastIndex = -1;
    for (const char of q) {
      const idx = t.indexOf(char, lastIndex + 1);
      if (idx > lastIndex) {
        score++;
        lastIndex = idx;
      }
    }
    const similarity = score / q.length;
    
    // Bonus se le prime lettere coincidono
    if (t[0] === q[0]) return Math.min(similarity + 0.2, 0.85);
    
    return similarity > 0.6 ? similarity * 0.7 : 0;
  };
  
  const filteredGames = (searchQuery 
    ? unityGames
        .map(g => ({ game: g, score: fuzzyMatch(getGameName(g), searchQuery) }))
        .filter(({ score }) => score > 0.4)
        .sort((a, b) => b.score - a.score)
        .map(({ game }) => game)
    : unityGames.sort((a, b) => getGameName(a).localeCompare(getGameName(b)))
  );

  const handleSelectGame = async (game: Game) => {
    setSelectedGame(game);
    setStatus('idle');
    setLogs([]);
    setProgress(0);
    setGameLanguages([]);
    setEngineCheck(null);
    setPatchInfo(null);
    
    // Se il game ha install_dir, usalo automaticamente
    if (game.install_dir) {
      setGamePath(game.install_dir);
      // Verify engine and search for executable
      try {
        const check = await invoke<{ is_unity: boolean; is_unreal: boolean; engine_name: string; can_patch: boolean; message: string }>('check_game_engine', { gamePath: game.install_dir });
        setEngineCheck(check);
      } catch (err) {
        console.error('Engine check error:', err);
      }
      
      try {
        const exes = await invoke<string[]>('find_executables_in_folder', { folderPath: game.install_dir });
        if (exes && exes.length > 0) {
          const mainExe = exes.find(e => !e.toLowerCase().includes('launcher')) || exes[0];
          setExeName(mainExe);
        } else {
          setExeName(guessExeName(getGameName(game)));
        }
      } catch (err) {
        setExeName(guessExeName(getGameName(game)));
      }
    } else {
      // No path, user will need to select manually
      setGamePath('');
      setExeName(guessExeName(getGameName(game)));
    }
    
    // Carica le lingue REALI da Steam API (silenzioso se rate limited)
    const appId = game.appid || game.app_id;
    if (appId) {
      setIsLoadingLanguages(true);
      try {
        const details = await invoke<{ supported_languages?: string[] }>('get_game_details', { appid: String(appId) });
        if (details?.supported_languages && Array.isArray(details.supported_languages)) {
          setGameLanguages(details.supported_languages);
        }
      } catch (err: any) {
        // Ignora rate limit silenziosamente - non è critico
        if (!String(err).includes('Rate limit')) {
          console.error('Languages loading error:', err);
        }
      } finally {
        setIsLoadingLanguages(false);
      }
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Unity game folder',
      });

      if (selected && typeof selected === 'string') {
        setGamePath(selected);
        setStatus('idle');
        setLogs([]);
        setProgress(0);
        setEngineCheck(null);
        
        // Verifica il motore di game
        try {
          const check = await invoke<{ is_unity: boolean; is_unreal: boolean; engine_name: string; can_patch: boolean; message: string }>('check_game_engine', { gamePath: selected });
          setEngineCheck(check);
          
          if (check.is_unity) {
            toast.success(`✓ ${check.engine_name} detected`);
          } else if (check.is_unreal) {
            toast.error(`✗ ${check.engine_name} - Not compatible with BepInEx!`);
          } else {
            toast.warning(`⚠ Engine not recognized`);
          }
        } catch (err) {
          console.error('Engine check error:', err);
        }
        
        // Search for executables in selected folder
        try {
          const exes = await invoke<string[]>('find_executables_in_folder', { folderPath: selected });
          if (exes && exes.length > 0) {
            // Usa il primo eseguibile trovato (o il più probabile)
            const mainExe = exes.find(e => !e.toLowerCase().includes('launcher')) || exes[0];
            setExeName(mainExe);
          } else {
            toast.warning('No executable found in folder');
          }
        } catch (err) {
          console.error('Executable search error:', err);
        }
      }
    } catch (err) {
      console.error('Folder selection error:', err);
      toast.error('Cannot open folder selector');
    }
  };

  const handlePatch = async () => {
    // If we have a selected game but no manual path, ask to select folder
    if (selectedGame && !gamePath) {
      toast.error('Select the game folder with the "Folder" button');
      return;
    }
    
    if (!gamePath && !selectedGame) {
      toast.error('Select a game or folder');
      return;
    }
    if (!exeName) {
      toast.error('Enter the game executable name (e.g. Game.exe)');
      return;
    }

    setIsPatching(true);
    setStatus('patching');
    setLogs(['Starting patching process...']);
    setProgress(10);
    setErrorMessage('');

    try {
      const cleanExeName = exeName.endsWith('.exe') ? exeName : `${exeName}.exe`;
      const finalPath = gamePath;

      setLogs(prev => [...prev, `Target: ${finalPath}`]);
      setLogs(prev => [...prev, `Executable: ${cleanExeName}`]);
      setProgress(30);

      const result = await invoke<PatchStatus>('install_unity_autotranslator', {
        gamePath: finalPath,
        gameExeName: cleanExeName,
        targetLang: targetLanguage,
        translationMode: translationMode // 'capture', 'google', 'deepl'
      });

      if (result.success) {
        setStatus('success');
        setProgress(100);
        setLogs(prev => [...prev, ...result.steps_completed, '✅ ' + result.message]);
        
        // Estrai versioni dai log
        const usesIPA = result.steps_completed.some(s => s.includes('IPA'));
        const bepinexMatch = result.steps_completed.find(s => s.includes('BepInEx'))?.match(/BepInEx ([\d.]+)/);
        const xunityMatch = result.steps_completed.find(s => s.includes('XUnity'))?.match(/XUnity/) ? '5.5.0' : null;
        setPatchInfo({
          bepinex: usesIPA ? 'IPA 3.4.1' : (bepinexMatch?.[1] || '5.4.23'),
          xunity: xunityMatch || '5.5.0'
        });
        
        // Traccia attività patch
        const gameName = selectedGame ? getGameName(selectedGame) : 'Unknown game';
        const modeLabel = translationMode === 'google' ? 'Google Translate' : translationMode === 'deepl' ? 'DeepL' : 'Capture only';
        await activityHistory.add({
          activity_type: 'patch',
          title: `Patch installed: ${gameName}`,
          description: `BepInEx + XUnity (${modeLabel}) - Lingua: ${targetLanguage.toUpperCase()}`,
          game_name: gameName,
          game_id: selectedGame?.app_id || selectedGame?.id,
        });
        
        toast.success('Patch installed successfully!');
      } else {
        throw new Error(result.message);
      }

    } catch (err: any) {
      console.error('Patching error:', err);
      setStatus('error');
      setErrorMessage(err.toString());
      setLogs(prev => [...prev, `❌ Error: ${err}`]);
      toast.error('Error during patch installation');
    } finally {
      setIsPatching(false);
    }
  };

  const handleLaunchGame = async () => {
    const appId = selectedGame?.app_id || selectedGame?.appid;
    
    // Metodo 1: Steam via Tauri command
    if (appId) {
      try {
        // console.log('[LAUNCH] Avvio via Steam:', appId);
        await invoke('launch_steam_game', { appId: String(appId) });
        toast.success('Game launched from Steam!');
        return;
      } catch (err) {
        console.error('Steam launch error:', err);
        // Continua con fallback
      }
    }
    
    // Metodo 2: Eseguibile diretto (fallback)
    if (gamePath && exeName) {
      const fullPath = `${gamePath}\\${exeName}`;
      // console.log('[LAUNCH] Avvio eseguibile diretto:', fullPath);
      try {
        await invoke('launch_executable', { path: fullPath });
        toast.success('Game launched!');
        return;
      } catch (err) {
        console.error('Direct launch error:', err);
      }
    }
    
    toast.error('Cannot launch game');
  };

  const handleRemovePatch = async () => {
    if (!gamePath) {
      toast.error('Select game folder first');
      return;
    }
    
    try {
      const result = await invoke<PatchStatus>('remove_unity_patch', { gamePath });
      if (result.success) {
        setStatus('idle');
        setLogs(result.steps_completed);
        toast.success(result.message);
      }
    } catch (err: any) {
      console.error('Patch removal error:', err);
      toast.error('Error during patch removal');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-3 overflow-y-auto overflow-x-hidden">
      {/* Layout a 2 colonne - flex per riempire */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Games List */}
        <Card className="w-[400px] shrink-0 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex flex-col">
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                {t('gamePatcher.games')}
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  {unityGames.filter(g => g.engine?.toLowerCase() === 'unity').length} Unity
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {unityGames.filter(g => g.engine?.toLowerCase().includes('unreal')).length} Unreal
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleSelectFolder} className="h-6 text-[10px] text-muted-foreground hover:text-white px-2">
                <FolderOpen className="w-3 h-3 mr-1" />
                {t('gamePatcher.folder')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0 flex-1 flex flex-col min-h-0">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input 
                placeholder={t('gamePatcher.search')} 
                className="pl-7 h-7 text-xs bg-slate-950/50 border-slate-800/70"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1">
              {isLoadingGames ? (
                <div className="flex items-center justify-center h-16 text-muted-foreground">
                  <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
                </div>
              ) : filteredGames.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  {searchQuery ? 'No results' : (
                    hasSteamCredentials ? 'No Unity games' : 'Configure Steam in Store Manager'
                  )}
                </div>
              ) : (
                filteredGames.map((game, index) => {
                  const isUnity = game.engine?.toLowerCase() === 'unity';
                  const isUnreal = game.engine?.toLowerCase().includes('unreal');
                  const engineColor = isUnity ? 'emerald' : isUnreal ? 'blue' : 'slate';
                  
                  return (
                    <button
                      key={game.id || `game-${index}`}
                      onClick={() => handleSelectGame(game)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border ${
                        selectedGame?.id === game.id 
                          ? `bg-gradient-to-r from-${engineColor}-500/20 to-${engineColor}-400/10 border-${engineColor}-500/40 text-white shadow-sm` 
                          : `border-transparent hover:bg-${engineColor}-500/10 hover:border-${engineColor}-500/20 text-slate-300`
                      }`}
                    >
                      {game.header_image ? (
                        <Image src={game.header_image} alt="" width={44} height={20} className="rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-11 h-[20px] bg-slate-800/80 rounded flex items-center justify-center shrink-0">
                          <Gamepad2 className="w-3 h-3 text-slate-500" />
                        </div>
                      )}
                      <span className="truncate flex-1 font-medium text-[11px]">{getGameName(game)}</span>
                      {/* Badge Engine */}
                      <Badge 
                        variant="outline" 
                        className={`text-[8px] px-1 py-0 shrink-0 ${
                          isUnity ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                          isUnreal ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                          'bg-slate-500/20 text-slate-400 border-slate-500/40'
                        }`}
                      >
                        {isUnity ? 'Unity' : isUnreal ? 'Unreal' : game.engine || '?'}
                      </Badge>
                      {selectedGame?.id === game.id && (
                        <CheckCircle2 className={`w-3 h-3 shrink-0 ${isUnity ? 'text-emerald-400' : isUnreal ? 'text-blue-400' : 'text-slate-400'}`} />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patch Configuration */}
        <Card className="flex-1 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex flex-col overflow-hidden">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              {selectedGame ? getGameName(selectedGame) : gamePath ? t('gamePatcher.folder') : t('gamePatcher.patchConfiguration')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 overflow-hidden">
            {(selectedGame || gamePath) ? (
              <div className="space-y-1.5">
                {selectedGame && (
                  <div className="space-y-2">
                    {/* Game Card con Engine Badge colorato */}
                    {(() => {
                      const isUnity = selectedGame.engine?.toLowerCase() === 'unity';
                      const isUnreal = selectedGame.engine?.toLowerCase().includes('unreal');
                      const engineColor = isUnity ? 'emerald' : isUnreal ? 'blue' : 'slate';
                      const canPatch = isUnity; // Solo Unity supporta BepInEx
                      
                      return (
                        <div className={`flex items-center gap-1.5 p-1.5 rounded border text-[10px] ${
                          isUnity ? 'bg-emerald-500/5 border-emerald-500/30' :
                          isUnreal ? 'bg-blue-500/5 border-blue-500/30' :
                          'bg-slate-800/30 border-slate-700/50'
                        }`}>
                          <Badge className={`px-1 py-0 ${
                            isUnity ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                            isUnreal ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                            'bg-slate-500/20 text-slate-400 border-slate-500/40'
                          }`}>
                            {selectedGame.engine || '?'}
                          </Badge>
                          {canPatch ? (
                            <span className="text-emerald-400">✓ BepInEx Compatible</span>
                          ) : isUnreal ? (
                            <a href="https://github.com/akintos/UnrealLocres/releases" target="_blank" rel="noopener" className="text-amber-400 hover:text-amber-300 underline">⚠ UnrealLocres</a>
                          ) : selectedGame.engine?.toLowerCase() === 'godot' ? (
                            <a href="https://github.com/bruvzg/gdsdecomp/releases" target="_blank" rel="noopener" className="text-amber-400 hover:text-amber-300 underline">⚠ gdsdecomp</a>
                          ) : (
                            <span className="text-amber-400">⚠ External tools</span>
                          )}
                        </div>
                      );
                    })()}
                    
                  </div>
                )}

                {/* Lingua + Pulsante AVVIA sulla stessa riga */}
                <div className="flex items-center gap-2">
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="h-7 px-2 text-[10px] w-24 bg-slate-950/50 border border-slate-800/70 rounded text-slate-200"
                  >
                    {supportedLanguages.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                  <Button 
                    className="flex-1 h-7 text-xs bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                    onClick={handleLaunchGame}
                    disabled={!selectedGame?.app_id && !gamePath}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    LAUNCH GAME
                  </Button>
                </div>

                {/* Sezione Patch - Collassabile */}
                <details className="group">
                  <summary className="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer hover:text-slate-300">
                    <span>▶</span>
                    <span>First time? Install patch</span>
                  </summary>
                  <div className="mt-1 p-1.5 rounded bg-slate-900/50 border border-slate-800/50 space-y-1">
                    <div className="flex items-center gap-1">
                      <select
                        value={translationMode}
                        onChange={(e) => setTranslationMode(e.target.value as 'google' | 'deepl' | 'capture')}
                        className="h-6 px-1 text-[9px] w-28 bg-slate-950/50 border border-slate-800/70 rounded text-slate-200"
                      >
                        {translationModes.map(mode => (
                          <option key={mode.id} value={mode.id}>{mode.name}</option>
                        ))}
                      </select>
                      <Input 
                        value={exeName} 
                        onChange={(e) => setExeName(e.target.value)} 
                        placeholder="Game.exe"
                        className="h-6 text-[10px] flex-1 bg-slate-950/50 border-slate-800/70 px-1"
                      />
                      <Button 
                        className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-500" 
                        onClick={handlePatch} 
                        disabled={isPatching || !exeName || !gamePath || (engineCheck && !engineCheck.can_patch)}
                      >
                        {isPatching ? '...' : 'Install'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 truncate flex-1">{translationModes.find(m => m.id === translationMode)?.description}</span>
                      <Button 
                        variant="ghost"
                        className="h-5 px-1 text-[9px] text-red-400 hover:text-red-300" 
                        onClick={handleRemovePatch}
                        disabled={!gamePath}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </details>

                {status === 'error' && (
                  <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                    {errorMessage}
                  </div>
                )}
                {(status === 'success' || engineCheck?.has_bepinex) && (
                  <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] flex items-center gap-2">
                    <span className="text-emerald-400 shrink-0">✅ Patch OK</span>
                    <span className="text-emerald-300/70 truncate flex-1">
                      {engineCheck?.has_bepinex ? 'already installed' : ''}
                    </span>
                    {/* Badge Traduzione */}
                    {translationMode === 'google' || translationMode === 'deepl' ? (
                      <Badge className="shrink-0 bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900 font-bold px-1.5 py-0 text-[9px] shadow-sm">
                        🥈
                      </Badge>
                    ) : engineCheck?.has_xunity ? (
                      <Badge className="shrink-0 bg-gradient-to-r from-slate-500 to-slate-400 text-white font-bold px-1.5 py-0 text-[9px]">
                        🥈
                      </Badge>
                    ) : (
                      <Badge className="shrink-0 bg-gradient-to-r from-orange-800 to-orange-700 text-orange-200 font-bold px-1.5 py-0 text-[9px]">
                        🥉
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[100px] text-center">
                <Download className="w-6 h-6 text-slate-600 mb-1" />
                <p className="text-[10px] text-slate-400">{t('gamePatcher.selectGame')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Istruzioni - inline compatte */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 px-2 py-1">
        <Info className="w-3 h-3 text-blue-400 shrink-0" />
        <span>After patch: launch game → <kbd className="bg-slate-800 px-1 rounded">ALT+T</kbd> for translation</span>
      </div>
    </div>
  );
}



