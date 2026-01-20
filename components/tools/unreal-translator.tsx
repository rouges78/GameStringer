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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Cpu className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-red-400">UE Translator</h2>
            <p className="text-sm text-muted-foreground">
              Runtime translation for Unreal Engine 4/5
            </p>
          </div>
        </div>
        
        {translatorState.is_injected && (
          <Badge variant={translatorState.is_translating ? "default" : "secondary"}>
            {translatorState.is_translating ? "Translation Active" : "Paused"}
          </Badge>
        )}
      </div>

      {/* Warning Banner */}
      <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/50">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-500">Experimental Feature</AlertTitle>
        <AlertDescription className="text-yellow-500/80">
          This feature requires the injection DLL which must be compiled separately.
          Do not use on games with active anti-cheat.
        </AlertDescription>
      </Alert>

      <div className="flex gap-4">
        {/* Games List */}
        <Card className="w-[400px] flex-shrink-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Unreal Games ({filteredGames.length})
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search game..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[400px]">
              {isLoadingGames ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredGames.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Cpu className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No Unreal games found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredGames.map((game) => (
                    <div
                      key={game.id}
                      onClick={() => handleSelectGame(game)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedGame?.id === game.id 
                          ? 'bg-orange-500/20 border border-orange-500/50' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      {game.header_image ? (
                        <Image
                          src={game.header_image}
                          alt={getGameName(game)}
                          width={60}
                          height={28}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-[60px] h-[28px] bg-muted rounded flex items-center justify-center">
                          <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getGameName(game)}</p>
                        <p className="text-xs text-muted-foreground">{game.engine}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              {selectedGame ? getGameName(selectedGame) : 'Select a game from the list'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Game Path */}
            <div className="space-y-2">
              <Label>Game Folder</Label>
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
              <Label>Executable</Label>
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
              <Label>Translation Language</Label>
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
              <Label>Automatic Translation</Label>
              <Switch
                checked={autoTranslate}
                onCheckedChange={setAutoTranslate}
              />
            </div>

            {/* Cache Stats */}
            {cacheStats && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-sm font-medium">Cache Statistics</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Translations: {cacheStats.total_entries}</span>
                  <span>Hit Rate: {(cacheStats.hit_rate * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              {!translatorState.is_injected ? (
                <Button 
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={handleStartTranslator}
                  disabled={!gamePath || !exeName || (compatibility && !compatibility.is_compatible)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Translator
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleToggleTranslation}
                  >
                    {translatorState.is_translating ? 'Pause' : 'Resume'}
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleStopTranslator}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop
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
              Clear Cache
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
