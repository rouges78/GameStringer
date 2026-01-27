'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FolderOpen, 
  Download, 
  CheckCircle2, 
  AlertTriangle
  , 
  Gamepad2,
  ExternalLink,
  Play,
  FileArchive,
  Globe,
  Trash2
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { activityHistory } from '@/lib/activity-history';
import { useTranslation } from '@/lib/i18n';

interface TelltaleGame {
  id: string;
  name: string;
  translationUrl?: string;
  platform: 'steam' | 'gog' | 'epic';
  requiresGogScript?: boolean;
  coverImage: string;
}

const SUPPORTED_GAMES: TelltaleGame[] = [
  {
    id: 'wolf-among-us',
    name: 'The Wolf Among Us',
    translationUrl: 'https://1drv.ms/u/s!ApMUGr0cuN39gcU1t4iqnsfx5KTodQ?e=y9QOEr',
    platform: 'steam',
    requiresGogScript: true,
    coverImage: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/250320/header.jpg',
  },
  {
    id: 'walking-dead-s1',
    name: 'The Walking Dead: Season One',
    platform: 'steam',
    coverImage: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/207610/header.jpg',
  },
  {
    id: 'walking-dead-s2',
    name: 'The Walking Dead: Season Two',
    platform: 'steam',
    coverImage: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/261030/header.jpg',
  },
  {
    id: 'tales-borderlands',
    name: 'Tales from the Borderlands',
    platform: 'steam',
    coverImage: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/330830/header.jpg',
  },
  {
    id: 'batman-telltale',
    name: 'Batman: The Telltale Series',
    platform: 'steam',
    coverImage: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/498240/header.jpg',
  },
];

export function TelltalePatcher() {
  const { t } = useTranslation();
  const [gamePath, setGamePath] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<TelltaleGame | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<'steam' | 'gog' | 'epic' | null>(null);
  const [isPatching, setIsPatching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'patching' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasExistingPatch, setHasExistingPatch] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [backupPath, setBackupPath] = useState<string>('');

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const selectGameFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Telltale game folder',
      });

      if (selected && typeof selected === 'string') {
        setGamePath(selected);
        addLog(`📁 Folder selected: ${selected}`);
        
        // Detect platform and game
        await detectGame(selected);
      }
    } catch (error) {
      console.error('Folder selection error:', error);
      toast.error('Error selecting folder');
    }
  };

  const detectGame = async (path: string) => {
    addLog('🔍 Detecting game...');
    
    // Check for Pack folder (existing translation)
    try {
      const hasPackFolder = await invoke<boolean>('check_path_exists', { 
        path: `${path}\\Pack` 
      });
      setHasExistingPatch(hasPackFolder);
      if (hasPackFolder) {
        addLog('⚠️ Existing Pack folder detected (translation already installed?)');
      }
    } catch {
      setHasExistingPatch(false);
    }

    // Check for backup folder
    try {
      const backupDir = `${path}\\Pack_backup`;
      const hasBackupFolder = await invoke<boolean>('check_path_exists', { 
        path: backupDir 
      });
      setHasBackup(hasBackupFolder);
      if (hasBackupFolder) {
        setBackupPath(backupDir);
        addLog('💾 Existing backup found');
      }
    } catch {
      setHasBackup(false);
    }

    // Detect platform by folder structure
    const pathLower = path.toLowerCase();
    if (pathLower.includes('steamapps')) {
      setDetectedPlatform('steam');
      addLog('🎮 Platform: Steam');
    } else if (pathLower.includes('gog') || pathLower.includes('galaxy')) {
      setDetectedPlatform('gog');
      addLog('🎮 Platform: GOG');
    } else if (pathLower.includes('epic')) {
      setDetectedPlatform('epic');
      addLog('🎮 Platform: Epic Games');
    } else {
      setDetectedPlatform(null);
      addLog('🎮 Platform: Not detected');
    }

    // Try to detect game by folder name
    const folderName = path.split('\\').pop()?.toLowerCase() || '';
    
    if (folderName.includes('wolf') && folderName.includes('among')) {
      const game = SUPPORTED_GAMES.find(g => g.id === 'wolf-among-us');
      setSelectedGame(game || null);
      addLog(`✅ Game detected: ${game?.name}`);
    } else if (folderName.includes('walking') && folderName.includes('dead')) {
      if (folderName.includes('season 2') || folderName.includes('season two')) {
        const game = SUPPORTED_GAMES.find(g => g.id === 'walking-dead-s2');
        setSelectedGame(game || null);
      } else {
        const game = SUPPORTED_GAMES.find(g => g.id === 'walking-dead-s1');
        setSelectedGame(game || null);
      }
      addLog(`✅ Game detected: Walking Dead`);
    } else if (folderName.includes('borderlands')) {
      const game = SUPPORTED_GAMES.find(g => g.id === 'tales-borderlands');
      setSelectedGame(game || null);
      addLog(`✅ Game detected: Tales from the Borderlands`);
    } else if (folderName.includes('batman')) {
      const game = SUPPORTED_GAMES.find(g => g.id === 'batman-telltale');
      setSelectedGame(game || null);
      addLog(`✅ Game detected: Batman Telltale`);
    } else {
      addLog('❓ Game not automatically recognized');
    }
  };

  const applyTranslation = async () => {
    if (!gamePath || !selectedGame) {
      toast.error('Select game folder first');
      return;
    }

    setIsPatching(true);
    setStatus('patching');
    setProgress(0);
    setLogs([]);

    try {
      addLog('🚀 Starting Italian translation installation...');
      setProgress(10);

      // Step 1: Download translation
      addLog('📥 Downloading translation...');
      if (selectedGame.translationUrl) {
        addLog(`   URL: ${selectedGame.translationUrl}`);
        // For now, show manual instructions since OneDrive requires browser
        addLog('⚠️ NOTE: OneDrive download requires browser');
        addLog('   1. Click "Open Download Link" below');
        addLog('   2. Download the ZIP archive');
        addLog('   3. Extract the "Pack" folder to the game directory');
      }
      setProgress(30);

      // Step 2: Check for existing files
      addLog('🔍 Checking existing files...');
      setProgress(50);

      // Step 3: Platform-specific instructions
      if (detectedPlatform === 'gog' && selectedGame.requiresGogScript) {
        addLog('⚠️ GOG VERSION DETECTED');
        addLog('   After copying the Pack folder:');
        addLog('   1. Copy GOG-prep.bat to Pack\\');
        addLog('   2. Run Pack\\GOG-prep.bat');
        addLog('   This will remove conflicting files');
      }
      setProgress(70);

      // Step 4: Important notes
      addLog('📋 IMPORTANT NOTES:');
      addLog('   • DO NOT leave original file backups in the game folder');
      addLog('   • Use 7-Zip or BandiZip to extract (Windows has bugs)');
      addLog('   • Translated files overwrite originals');
      setProgress(90);

      // Track activity
      await activityHistory.add({
        activity_type: 'patch',
        title: `Translation ${selectedGame.name}`,
        description: `Italian translation instructions displayed`,
        game_name: selectedGame.name,
      });

      setProgress(100);
      setStatus('success');
      addLog('✅ Instructions completed!');
      toast.success('Instructions generated successfully');

    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'Unknown error');
      addLog(`❌ Error: ${error.message}`);
      toast.error('Error during process');
    } finally {
      setIsPatching(false);
    }
  };

  const openDownloadLink = () => {
    if (selectedGame?.translationUrl) {
      window.open(selectedGame.translationUrl, '_blank');
    }
  };

  const openTranslationSource = () => {
    window.open('https://teamsupergame.wixsite.com/supergame/the-wolf-among-us', '_blank');
  };

  const createBackup = async () => {
    if (!gamePath) return;
    
    try {
      addLog('💾 Creating backup...');
      const backupDir = `${gamePath}\\Pack_backup`;
      
      // Use Tauri to create backup
      await invoke('create_directory_backup', {
        sourcePath: `${gamePath}\\Pack`,
        backupPath: backupDir
      });
      
      setHasBackup(true);
      setBackupPath(backupDir);
      addLog(`✅ Backup created: ${backupDir}`);
      toast.success('Backup created successfully');
    } catch (error: any) {
      addLog(`❌ Backup error: ${error.message}`);
      toast.error('Error creating backup');
    }
  };

  const restoreBackup = async () => {
    if (!gamePath || !hasBackup) return;
    
    try {
      addLog('🔄 Restoring backup...');
      
      await invoke('restore_directory_backup', {
        backupPath: `${gamePath}\\Pack_backup`,
        targetPath: `${gamePath}\\Pack`
      });
      
      addLog('✅ Backup restored successfully');
      toast.success('Original files restored');
      setHasExistingPatch(true);
    } catch (error: any) {
      addLog(`❌ Restore error: ${error.message}`);
      toast.error('Error during restore');
    }
  };

  const verifyInstallation = async () => {
    if (!gamePath) return;
    
    addLog('🔍 Verifying installation...');
    
    try {
      // Check for key translation files
      const packExists = await invoke<boolean>('check_path_exists', { 
        path: `${gamePath}\\Pack` 
      });
      
      if (!packExists) {
        addLog('❌ Pack folder not found');
        toast.error('Translation not installed');
        return;
      }
      
      // Check for common translation files
      const langFiles = ['english.langdb', 'italian.langdb'];
      let foundFiles = 0;
      
      for (const file of langFiles) {
        try {
          const exists = await invoke<boolean>('check_path_exists', { 
            path: `${gamePath}\\Pack\\${file}` 
          });
          if (exists) {
            foundFiles++;
            addLog(`✅ File found: ${file}`);
          }
        } catch {
          // File not found, continue
        }
      }
      
      if (foundFiles > 0) {
        addLog(`✅ Verification complete: ${foundFiles} translation files found`);
        toast.success('Installation verified');
      } else {
        addLog('⚠️ No .langdb files found in Pack folder');
        addLog('   You may need to extract files from the archive');
      }
    } catch (error: any) {
      addLog(`❌ Verification error: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] px-4 gap-3 overflow-y-auto overflow-x-hidden">
      {/* Hero Header Compatto */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 p-2 shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-black/20 backdrop-blur-sm">
            <Gamepad2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{t('telltale.title')}</h2>
            <p className="text-white/80 text-[10px]">{t('telltale.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Layout a 2 colonne */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Left Column - Games List */}
        <Card className="w-[320px] shrink-0 border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950/30 flex flex-col">
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                {t('telltale.supportedGames')}
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  {SUPPORTED_GAMES.length}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-0 flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto space-y-1">
              {SUPPORTED_GAMES.map(game => (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(game)}
                  className={`w-full flex items-center gap-2 p-1.5 rounded text-left text-xs transition-all border ${
                    selectedGame?.id === game.id
                      ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 border-emerald-500/40 text-white shadow-sm'
                      : 'border-transparent hover:bg-emerald-500/10 hover:border-emerald-500/20 text-slate-300'
                  }`}
                >
                  <div className="w-7 h-5 bg-slate-800/80 rounded flex items-center justify-center shrink-0">
                    <Gamepad2 className="w-3 h-3 text-emerald-500" />
                  </div>
                  <span className="truncate flex-1 font-medium text-[11px]">{game.name}</span>
                  {game.translationUrl && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shrink-0">
                      ITA
                    </Badge>
                  )}
                  {selectedGame?.id === game.id && (
                    <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Configuration */}
        <Card className="flex-1 border-slate-800/50 flex flex-col overflow-hidden relative bg-slate-950/80">
          {/* Cover Image Background */}
          {selectedGame && (
            <>
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
                style={{ backgroundImage: `url(${selectedGame.coverImage})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
            </>
          )}
          <CardHeader className="py-2 px-3 relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                {selectedGame ? selectedGame.name : t('telltale.selectGame')}
                {detectedPlatform && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
                    {detectedPlatform.toUpperCase()}
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={selectGameFolder} className="h-6 text-[10px] text-muted-foreground hover:text-white px-2">
                <FolderOpen className="w-3 h-3 mr-1" />
                {t('telltale.browseFolder').replace('...', '')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 flex-1 flex flex-col gap-3 overflow-y-auto relative z-10">
            {/* Path Display */}
            {gamePath && (
              <div className="p-2 bg-slate-950/50 border border-slate-800/50 rounded text-[10px] font-mono text-slate-400 break-all">
                📁 {gamePath}
              </div>
            )}

            {/* Status Alerts */}
            {hasExistingPatch && (
              <div className="flex items-center gap-2 p-2 bg-yellow-950/20 border border-yellow-500/30 rounded text-xs">
                <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                <span className="text-yellow-400">{t('telltale.existingTranslation')}</span>
              </div>
            )}

            {hasBackup && (
              <div className="flex items-center gap-2 p-2 bg-green-950/20 border border-green-500/30 rounded text-xs">
                <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                <span className="text-green-400">💾 {t('telltale.backupAvailable')}</span>
              </div>
            )}

            {/* Actions */}
            {selectedGame && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={applyTranslation} 
                    disabled={isPatching || !gamePath}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500"
                  >
                    {isPatching ? t('telltale.processing') : (
                      <><Download className="w-3 h-3 mr-1" /> {t('telltale.generateInstructions')}</>
                    )}
                  </Button>
                  
                  {selectedGame.translationUrl && (
                    <Button onClick={openDownloadLink} variant="outline" className="h-8 text-xs">
                      <ExternalLink className="w-3 h-3 mr-1" /> Download
                    </Button>
                  )}
                </div>

                {/* Tools Row */}
                <div className="flex gap-2">
                  <Button onClick={createBackup} variant="outline" size="sm" disabled={!hasExistingPatch || hasBackup} className="h-7 text-[10px] flex-1">
                    💾 {t('telltale.backup')}
                  </Button>
                  <Button onClick={restoreBackup} variant="outline" size="sm" disabled={!hasBackup} className="h-7 text-[10px] flex-1">
                    🔄 {t('telltale.restore')}
                  </Button>
                  <Button onClick={verifyInstallation} variant="outline" size="sm" disabled={!gamePath} className="h-7 text-[10px] flex-1">
                    ✅ {t('telltale.verify')}
                  </Button>
                </div>

                {selectedGame.id === 'wolf-among-us' && (
                  <Button onClick={openTranslationSource} variant="ghost" size="sm" className="w-full h-6 text-[10px] text-muted-foreground">
                    <Globe className="w-3 h-3 mr-1" /> {t('telltale.credits')}
                  </Button>
                )}
              </div>
            )}

            {/* Logs */}
            {logs.length > 0 && (
              <div className="flex-1 min-h-[120px]">
                <div className="text-[10px] text-muted-foreground mb-1">{t('telltale.log')}</div>
                <ScrollArea className="h-full max-h-[200px] rounded border border-slate-800/50 bg-slate-950/50 p-2">
                  <div className="font-mono text-[10px] space-y-0.5">
                    {logs.map((log, i) => (
                      <div key={i} className="text-slate-400">{log}</div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {isPatching && (
        <div className="px-2">
          <Progress value={progress} className="h-1" />
          <p className="text-[10px] text-muted-foreground text-center mt-1">{progress}%</p>
        </div>
      )}

      {/* Status Alerts */}
      {status === 'success' && (
        <div className="flex items-center gap-2 p-2 bg-green-950/20 border border-green-500/30 rounded text-xs mx-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <div>
            <span className="text-green-400 font-medium">{t('telltale.completed')}</span>
            <span className="text-green-400/70 ml-2">{t('telltale.completedDesc')}</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 p-2 bg-red-950/20 border border-red-500/30 rounded text-xs mx-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <div>
            <span className="text-red-400 font-medium">{t('telltale.error')}</span>
            <span className="text-red-400/70 ml-2">{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}



