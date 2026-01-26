'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  FolderOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Gamepad2,
  Search,
  Play,
  Square,
  Settings,
  Trash2,
  Shield,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';

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
  install_dir?: string;
}

interface UETranslatorState {
  is_injected: boolean;
  is_translating: boolean;
  strings_translated: number;
  cache_hits: number;
  current_game: string | null;
}

interface CompatibilityResult {
  is_unreal: boolean;
  is_compatible: boolean;
  has_anticheat: boolean;
  anticheat_type: string | null;
  message: string;
}

interface CacheStats {
  total_entries: number;
  hit_rate: number;
  total_hits: number;
  total_misses: number;
}

export function UnrealTranslator() {
  const { t } = useTranslation();
  const [gamePath, setGamePath] = useState<string>('');
  const [exeName, setExeName] = useState<string>('');
  const [unrealGames, setUnrealGames] = useState<Game[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  
  const [translatorState, setTranslatorState] = useState<UETranslatorState>({
    is_injected: false,
    is_translating: false,
    strings_translated: 0,
    cache_hits: 0,
    current_game: null
  });
  
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState('it');
  
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
  ];

  useEffect(() => {
    loadUnrealGames();
  }, []);

  const loadUnrealGames = async () => {
    setIsLoadingGames(true);
    try {
      const localGames = await invoke<Array<{
        id: string;
        title: string;
        platform: string;
        install_path: string | null;
        header_image: string | null;
        is_installed: boolean;
        steam_app_id: number | null;
        engine: string | null;
      }>>('scan_all_steam_games_fast');
      
      // Filter only Unreal games
      const unrealOnly = localGames
        .filter(g => g.engine?.toLowerCase().includes('unreal') && g.is_installed)
        .map(g => ({
          id: g.id,
          app_id: g.steam_app_id ? String(g.steam_app_id) : g.id,
          appid: g.steam_app_id || undefined,
          title: g.title,
          name: g.title,
          platform: g.platform,
          header_image: g.header_image,
          engine: g.engine,
          is_installed: g.is_installed,
          install_dir: g.install_path || undefined,
        }));
      
      setUnrealGames(unrealOnly);
    } catch (err) {
      console.error('Error loading games:', err);
      toast.error('Error loading Unreal games');
    } finally {
      setIsLoadingGames(false);
    }
  };

  const handleSelectGame = async (game: Game) => {
    setSelectedGame(game);
    
    if (game.install_dir) {
      setGamePath(game.install_dir);
      
      // Find executable
      try {
        const exes = await invoke<string[]>('find_executables_in_folder', { 
          folderPath: game.install_dir 
        });
        if (exes.length > 0) {
          const mainExe = exes.find(e => 
            e.toLowerCase().includes('shipping') || 
            e.toLowerCase().includes(game.title?.toLowerCase().split(' ')[0] || '')
          ) || exes[0];
          setExeName(mainExe.split('\\').pop() || mainExe.split('/').pop() || mainExe);
        }
      } catch (err) {
        console.error('Error finding executable:', err);
      }
      
      // Check compatibility
      checkCompatibility(game.install_dir);
    }
  };

  const checkCompatibility = async (path: string) => {
    try {
      const result = await invoke<CompatibilityResult>('check_ue_translator_compatibility', {
        gamePath: path
      });
      setCompatibility(result);
    } catch (err) {
      console.error('Compatibility check error:', err);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Unreal game folder'
      });
      
      if (selected && typeof selected === 'string') {
        setGamePath(selected);
        checkCompatibility(selected);
        
        // Find executable
        const exes = await invoke<string[]>('find_executables_in_folder', { 
          folderPath: selected 
        });
        if (exes.length > 0) {
          setExeName(exes[0].split('\\').pop() || exes[0]);
        }
      }
    } catch (err) {
      console.error('Folder selection error:', err);
    }
  };

  const handleStartTranslator = async () => {
    if (!gamePath || !exeName) {
      toast.error('Select a game first');
      return;
    }
    
    try {
      const result = await invoke<{ success: boolean; message: string; state: UETranslatorState }>('start_ue_translator', {
        gamePath,
        executable: exeName,
        config: {
          target_language: targetLanguage,
          auto_translate: autoTranslate,
          use_cache: true,
        }
      });
      
      setTranslatorState(result.state);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }
    } catch (err) {
      console.error('Translator start error:', err);
      toast.error('Error starting translator');
    }
  };

  const handleStopTranslator = async () => {
    try {
      const result = await invoke<{ success: boolean; message: string; state: UETranslatorState }>('stop_ue_translator', {
        gamePath
      });
      
      setTranslatorState(result.state);
      toast.success('Translator stopped');
    } catch (err) {
      console.error('Translator stop error:', err);
    }
  };

  const handleToggleTranslation = async () => {
    try {
      const newState = await invoke<UETranslatorState>('toggle_ue_translation');
      setTranslatorState(newState);
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const handleClearCache = async () => {
    try {
      await invoke('clear_ue_cache');
      toast.success('Cache cleared');
      setCacheStats(null);
    } catch (err) {
      console.error('Cache clear error:', err);
    }
  };

  const loadCacheStats = async () => {
    try {
      const stats = await invoke<CacheStats>('get_ue_cache_stats');
      setCacheStats(stats);
    } catch {
      // Cache not active
    }
  };

  const getGameName = (game: Game) => game.title || game.name || game.id;

  const fuzzyMatch = (text: string, query: string): boolean => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    return lowerText.includes(lowerQuery);
  };

  const filteredGames = unrealGames.filter(game => 
    !searchQuery || fuzzyMatch(getGameName(game), searchQuery)
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-3 overflow-y-auto overflow-x-hidden">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <Cpu className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('ueTranslator.title')}
              </h2>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('ueTranslator.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            {translatorState.is_injected && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-sm font-bold text-white">
                  {translatorState.is_translating ? t('ueTranslator.active') : t('ueTranslator.paused')}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/30 shadow-lg shadow-black/40 border border-white/10">
              <Gamepad2 className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-sm font-bold text-white">{filteredGames.length}</span>
              <span className="text-[10px] text-white/70">{t('ueTranslator.games')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner - Lampeggiante */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 animate-pulse">
        <Shield className="h-5 w-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-400">⚠ {t('ueTranslator.experimentalWarning')}</p>
          <p className="text-xs text-red-500/80">{t('ueTranslator.experimentalDesc')}</p>
        </div>
      </div>

      {/* Layout a 2 colonne */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Games List */}
        <Card className="w-[400px] shrink-0 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex flex-col">
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                {t('ueTranslator.unrealGames')}
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {filteredGames.length}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0 flex-1 flex flex-col min-h-0">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder={t('gamePatcher.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs bg-slate-950/50 border-slate-800/70"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-1">
              {isLoadingGames ? (
                <div className="flex items-center justify-center h-16 text-muted-foreground">
                  <div className="animate-spin w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full" />
                </div>
              ) : filteredGames.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  <Cpu className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>{t('gamePatcher.noResults')}</p>
                </div>
              ) : (
                filteredGames.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handleSelectGame(game)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border ${
                      selectedGame?.id === game.id 
                        ? 'bg-gradient-to-r from-blue-500/20 to-cyan-400/10 border-blue-500/40 text-white shadow-sm' 
                        : 'border-transparent hover:bg-blue-500/10 hover:border-blue-500/20 text-slate-300'
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
                    <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0 bg-blue-500/20 text-blue-400 border-blue-500/40">
                      UE
                    </Badge>
                    {selectedGame?.id === game.id && (
                      <CheckCircle2 className="w-3 h-3 shrink-0 text-blue-400" />
                    )}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <Card className="flex-1 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex flex-col overflow-hidden">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              {selectedGame ? getGameName(selectedGame) : t('ueTranslator.configuration')}
            </CardTitle>
            {!selectedGame && (
              <CardDescription className="text-xs">{t('ueTranslator.selectGame')}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Game Path */}
            <div className="space-y-2">
              <Label>{t('ueTranslator.gameFolder')}</Label>
              <div className="flex gap-2">
                <Input
                  value={gamePath}
                  onChange={(e) => setGamePath(e.target.value)}
                  placeholder="C:\Games\MyUnrealGame"
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={handleBrowseFolder}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Executable */}
            <div className="space-y-2">
              <Label>{t('ueTranslator.executable')}</Label>
              <Input
                value={exeName}
                onChange={(e) => setExeName(e.target.value)}
                placeholder="MyGame-Win64-Shipping.exe"
              />
            </div>

            {/* Compatibility Check */}
            {compatibility && (
              <Alert variant={compatibility.is_compatible ? "default" : "destructive"}>
                {compatibility.is_compatible ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                <AlertDescription>
                  {compatibility.message}
                  {compatibility.anticheat_type && (
                    <span className="block mt-1 text-red-400">
                      Detected: {compatibility.anticheat_type}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Language Selection */}
            <div className="space-y-2">
              <Label>{t('ueTranslator.translationLanguage')}</Label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto Translate Toggle */}
            <div className="flex items-center justify-between">
              <Label>{t('ueTranslator.automaticTranslation')}</Label>
              <Switch
                checked={autoTranslate}
                onCheckedChange={setAutoTranslate}
              />
            </div>

            {/* Cache Stats */}
            {cacheStats && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-sm font-medium">{t('ueTranslator.cacheStats')}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>{t('ueTranslator.translations')}: {cacheStats.total_entries}</span>
                  <span>{t('ueTranslator.hitRate')}: {(cacheStats.hit_rate * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              {!translatorState.is_injected ? (
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                  onClick={handleStartTranslator}
                  disabled={!gamePath || !exeName || (compatibility && !compatibility.is_compatible)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {t('ueTranslator.startTranslator')}
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleToggleTranslation}
                  >
                    {translatorState.is_translating ? t('ueTranslator.pauseTranslator') : t('ueTranslator.resumeTranslator')}
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleStopTranslator}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    {t('ueTranslator.stopTranslator')}
                  </Button>
                </>
              )}
            </div>

            {/* Clear Cache */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-muted-foreground"
              onClick={handleClearCache}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('ueTranslator.clearCache')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



