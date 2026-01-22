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
  AlertTriangle, 
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

interface TelltaleGame {
  id: string;
  name: string;
  translationUrl?: string;
  platform: 'steam' | 'gog' | 'epic';
  requiresGogScript?: boolean;
}

const SUPPORTED_GAMES: TelltaleGame[] = [
  {
    id: 'wolf-among-us',
    name: 'The Wolf Among Us',
    translationUrl: 'https://1drv.ms/u/s!ApMUGr0cuN39gcU1t4iqnsfx5KTodQ?e=y9QOEr',
    platform: 'steam',
    requiresGogScript: true,
  },
  {
    id: 'walking-dead-s1',
    name: 'The Walking Dead: Season One',
    platform: 'steam',
  },
  {
    id: 'walking-dead-s2',
    name: 'The Walking Dead: Season Two',
    platform: 'steam',
  },
  {
    id: 'tales-borderlands',
    name: 'Tales from the Borderlands',
    platform: 'steam',
  },
  {
    id: 'batman-telltale',
    name: 'Batman: The Telltale Series',
    platform: 'steam',
  },
];

export function TelltalePatcher() {
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
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-black/20 backdrop-blur-sm shadow-lg">
            <Gamepad2 className="h-4 w-4 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Telltale Patcher</h2>
            <p className="text-white/90 text-[10px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">Italian translations for Wolf Among Us, Walking Dead, etc.</p>
          </div>
        </div>
      </div>

      {/* Game Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Select Game
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={selectGameFolder} variant="outline" className="w-full">
            <FolderOpen className="h-4 w-4 mr-2" />
            Browse game folder...
          </Button>

          {gamePath && (
            <div className="p-2 bg-slate-800/50 rounded text-xs font-mono break-all">
              {gamePath}
            </div>
          )}

          {selectedGame && (
            <div className="flex items-center gap-2 p-2 bg-green-950/30 border border-green-500/30 rounded">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-400">{selectedGame.name}</span>
              {detectedPlatform && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {detectedPlatform.toUpperCase()}
                </Badge>
              )}
            </div>
          )}

          {hasExistingPatch && (
            <Alert className="border-yellow-500/50 bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-400">Existing translation</AlertTitle>
              <AlertDescription className="text-xs">
                A Pack folder already exists. Translation may already be installed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Supported Games */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Supported Games
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_GAMES.map(game => (
              <div
                key={game.id}
                className={`p-2 rounded border text-xs cursor-pointer transition-all ${
                  selectedGame?.id === game.id
                    ? 'border-orange-500 bg-orange-950/30 text-orange-300'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
                onClick={() => setSelectedGame(game)}
              >
                <div className="font-medium truncate">{game.name}</div>
                {game.translationUrl && (
                  <Badge variant="outline" className="text-[9px] mt-1 text-green-400 border-green-500/50">
                    ITA available
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {selectedGame && gamePath && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Button 
              onClick={applyTranslation} 
              disabled={isPatching}
              className="w-full bg-orange-600 hover:bg-orange-500"
            >
              {isPatching ? (
                <>Processing...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Translation Instructions
                </>
              )}
            </Button>

            {selectedGame.translationUrl && (
              <Button 
                onClick={openDownloadLink}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Download Link (OneDrive)
              </Button>
            )}

            {selectedGame.id === 'wolf-among-us' && (
              <Button 
                onClick={openTranslationSource}
                variant="ghost"
                size="sm"
                className="w-full text-xs"
              >
                <Globe className="h-3 w-3 mr-1" />
                Crediti: Team Crybiolab / SuperGame
              </Button>
            )}

            {/* Backup & Verify Section */}
            <div className="border-t border-slate-700 pt-3 mt-3">
              <p className="text-xs text-muted-foreground mb-2">Advanced tools</p>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  onClick={createBackup}
                  variant="outline"
                  size="sm"
                  disabled={!hasExistingPatch || hasBackup}
                  className="text-xs"
                >
                  💾 Backup
                </Button>
                <Button 
                  onClick={restoreBackup}
                  variant="outline"
                  size="sm"
                  disabled={!hasBackup}
                  className="text-xs"
                >
                  🔄 Restore
                </Button>
                <Button 
                  onClick={verifyInstallation}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  ✅ Verify
                </Button>
              </div>
              {hasBackup && (
                <p className="text-[10px] text-green-400 mt-1">💾 Backup available</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {isPatching && (
        <Card>
          <CardContent className="pt-4">
            <Progress value={progress} className="mb-2" />
            <p className="text-xs text-muted-foreground text-center">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full rounded border border-slate-700 bg-slate-950 p-2">
              <div className="font-mono text-xs space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="text-slate-300">{log}</div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {status === 'success' && (
        <Alert className="border-green-500/50 bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-400">Completed!</AlertTitle>
          <AlertDescription className="text-xs">
            Follow the instructions in the log to complete the translation installation.
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert className="border-red-500/50 bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-400">Error</AlertTitle>
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}



