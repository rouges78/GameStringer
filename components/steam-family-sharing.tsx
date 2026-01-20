'use client';

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Type definitions for Rust command returns
interface SteamConfig {
  steam_path: string | null;
  logged_in_users: string[];
}

interface SharedGame {
  appid: number;
  name: string;
  owner_steam_id: string;
  owner_account_name: string;
  is_shared: boolean;
}

interface FamilySharingConfig {
  shared_games: SharedGame[];
  total_shared_games: number;
  authorized_users: string[];
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Upload, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Info, 
  FileText,
  Loader2,
  AlertCircle,
  FolderOpen,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface SharedAccount {
  steamId: string;
  username?: string;
  avatar?: string;
}

export function SteamFamilySharing() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingSharedGames, setIsLoadingSharedGames] = useState(false);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [familySharingConfig, setFamilySharingConfig] = useState<FamilySharingConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectionProgress, setDetectionProgress] = useState(0);

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    setError(null);
    setDetectionProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setDetectionProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      // Chiamata al comando Tauri
      const result = await invoke<SteamConfig>('auto_detect_steam_config');

      clearInterval(progressInterval);
      setDetectionProgress(100);

      if (result.logged_in_users && result.logged_in_users.length > 0) {
        const accounts = result.logged_in_users.map((steamId: string) => ({ steamId }));
        setSharedAccounts(accounts);
        toast.success(`Found ${accounts.length} accounts ready for sharing!`);
        if (result.steam_path) {
          toast.info(`Steam installation detected at: ${result.steam_path}`);
        }
        
        // Automatically load shared games
        await loadFamilySharingGames();
      } else {
        setError("No Steam users found. Make sure you are logged into Steam.");
        toast.warning('No Steam users found.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast.error('Auto-detection failed', {
        description: errorMessage,
      });
    } finally {
      setIsDetecting(false);
      setDetectionProgress(0);
    }
  };

  const loadFamilySharingGames = async () => {
    setIsLoadingSharedGames(true);
    try {
      const config = await invoke<FamilySharingConfig>('get_family_sharing_games');
      setFamilySharingConfig(config);
      
      if (config.total_shared_games > 0) {
        toast.success(`🎮 Found ${config.total_shared_games} shared games from ${config.authorized_users.length} users!`);
      } else {
        toast.info('No shared games found. Verify that Family Sharing is enabled.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error('Error loading shared games', {
        description: errorMessage,
      });
    } finally {
      setIsLoadingSharedGames(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Select a file before proceeding');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const fileContent = await selectedFile.text();
      
      // Usa il comando Tauri invece dell'API
      const config = await invoke<FamilySharingConfig>('parse_shared_config_vdf', {
        fileContent
      });
      
      setFamilySharingConfig(config);
      
      if (config.total_shared_games > 0) {
        toast.success(`✅ File loaded! Found ${config.total_shared_games} shared games`);
      } else {
        toast.warning('File loaded but no shared games found');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast.error('Error analyzing file', {
        description: errorMessage,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setError(null);
    }
  };

  const copyPath = () => {
    navigator.clipboard.writeText('C:\\Program Files (x86)\\Steam\\userdata\\[YOUR_ID]\\7\\remote\\sharedconfig.vdf');
    toast.success('Path copied to clipboard!');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle>Family Sharing Management</CardTitle>
        </div>
        <CardDescription>
          Automatically detect Steam accounts sharing their library with you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="auto" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto">
              <Search className="h-4 w-4 mr-2" />
              Auto Detection
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Upload className="h-4 w-4 mr-2" />
              Manual Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How it works</AlertTitle>
              <AlertDescription>
                The system will automatically search for Steam configuration on your PC to identify
                accounts that share their library with you.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-4">
              <Button 
                onClick={handleAutoDetect} 
                disabled={isDetecting}
                className="w-full"
                size="lg"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Detection in progress...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Start Auto Detection
                  </>
                )}
              </Button>

              {isDetecting && (
                <div className="space-y-2">
                  <Progress value={detectionProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Analyzing Steam configuration... {detectionProgress}%
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>Configuration file</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>Upload the <code className="font-mono bg-muted px-1 py-0.5 rounded">sharedconfig.vdf</code> file located at:</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="font-mono text-xs bg-muted p-2 rounded flex-1">
                    C:\Program Files (x86)\Steam\userdata\[YOUR_ID]\7\remote\sharedconfig.vdf
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyPath}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="grid w-full gap-2">
                <Label htmlFor="vdf-file">Select the sharedconfig.vdf file</Label>
                <Input
                  id="vdf-file"
                  type="file"
                  accept=".vdf"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>

              <Button 
                onClick={handleFileUpload} 
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Analyze File
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Shared Accounts Section */}
        {sharedAccounts.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Shared Accounts Found</h3>
              <Badge variant="secondary">{sharedAccounts.length} account</Badge>
            </div>
            
            <div className="grid gap-3">
              {sharedAccounts.map((account, index) => (
                <div
                  key={account.steamId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{account.username || `User ${index + 1}`}</p>
                      <p className="text-sm text-muted-foreground font-mono">{account.steamId}</p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared Games Section */}
        {familySharingConfig && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Shared Games Found</h3>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {familySharingConfig.total_shared_games} games
                </Badge>
                <Badge variant="outline">
                  {familySharingConfig.authorized_users.length} users
                </Badge>
              </div>
            </div>

            {familySharingConfig.total_shared_games > 0 ? (
              <div className="space-y-4">
                {/* Shared games list */}
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-4">
                  {familySharingConfig.shared_games.slice(0, 10).map((game) => (
                    <div
                      key={game.appid}
                      className="flex items-center justify-between p-2 rounded border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-600">🎮</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{game.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Shared by {game.owner_account_name}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        ID: {game.appid}
                      </Badge>
                    </div>
                  ))}
                  
                  {familySharingConfig.shared_games.length > 10 && (
                    <div className="text-center py-2">
                      <Badge variant="outline">
                        +{familySharingConfig.shared_games.length - 10} more games...
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Button to load into library */}
                <div className="flex gap-2">
                  <Button 
                    onClick={loadFamilySharingGames}
                    disabled={isLoadingSharedGames}
                    variant="outline"
                    size="sm"
                  >
                    {isLoadingSharedGames ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FolderOpen className="mr-2 h-4 w-4" />
                    )}
                    Refresh List
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      window.open('/games', '_blank');
                    }}
                    size="sm"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Go to Library
                  </Button>
                </div>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No shared games</AlertTitle>
                <AlertDescription>
                  No shared games were found. Verify that Family Sharing is configured correctly.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Family Sharing Configured!</AlertTitle>
              <AlertDescription>
                Shared games have been detected. They will be automatically included in the main 
                library when you load Steam games.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



