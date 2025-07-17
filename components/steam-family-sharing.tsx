'use client';

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Definizione dei tipi restituiti dai comandi Rust
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
        toast.success(`Trovati ${accounts.length} account pronti per la condivisione!`);
        if (result.steam_path) {
          toast.info(`Rilevata installazione di Steam in: ${result.steam_path}`);
        }
        
        // Carica automaticamente i giochi condivisi
        await loadFamilySharingGames();
      } else {
        setError("Nessun utente Steam trovato. Assicurati di aver effettuato l'accesso a Steam.");
        toast.warning('Nessun utente Steam trovato.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast.error('Rilevamento automatico non riuscito', {
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
        toast.success(`🎮 Trovati ${config.total_shared_games} giochi condivisi da ${config.authorized_users.length} utenti!`);
      } else {
        toast.info('Nessun gioco condiviso trovato. Verifica che Family Sharing sia attivo.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error('Errore caricamento giochi condivisi', {
        description: errorMessage,
      });
    } finally {
      setIsLoadingSharedGames(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Seleziona un file prima di procedere');
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
        toast.success(`✅ File caricato! Trovati ${config.total_shared_games} giochi condivisi`);
      } else {
        toast.warning('File caricato ma nessun gioco condiviso trovato');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast.error('Errore durante l\'analisi del file', {
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
    toast.success('Percorso copiato negli appunti!');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle>Gestione Condivisione Familiare</CardTitle>
        </div>
        <CardDescription>
          Rileva automaticamente gli account Steam che condividono la loro libreria con te
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="auto" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto">
              <Search className="h-4 w-4 mr-2" />
              Rilevamento Automatico
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Upload className="h-4 w-4 mr-2" />
              Caricamento Manuale
            </TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Come funziona</AlertTitle>
              <AlertDescription>
                Il sistema cercherà automaticamente la configurazione di Steam sul tuo PC per identificare
                gli account che condividono la loro libreria con te.
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
                    Rilevamento in corso...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Avvia Rilevamento Automatico
                  </>
                )}
              </Button>

              {isDetecting && (
                <div className="space-y-2">
                  <Progress value={detectionProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Analisi configurazione Steam... {detectionProgress}%
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>File di configurazione</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>Carica il file <code className="font-mono bg-muted px-1 py-0.5 rounded">sharedconfig.vdf</code> che si trova in:</p>
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
                <Label htmlFor="vdf-file">Seleziona il file sharedconfig.vdf</Label>
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
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Analizza File
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Errore</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Sezione Account Condivisi */}
        {sharedAccounts.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Account Condivisi Trovati</h3>
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
                      <p className="font-medium">{account.username || `Utente ${index + 1}`}</p>
                      <p className="text-sm text-muted-foreground font-mono">{account.steamId}</p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sezione Giochi Condivisi */}
        {familySharingConfig && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Giochi Condivisi Trovati</h3>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {familySharingConfig.total_shared_games} giochi
                </Badge>
                <Badge variant="outline">
                  {familySharingConfig.authorized_users.length} utenti
                </Badge>
              </div>
            </div>

            {familySharingConfig.total_shared_games > 0 ? (
              <div className="space-y-4">
                {/* Lista giochi condivisi */}
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
                            Condiviso da {game.owner_account_name}
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
                        +{familySharingConfig.shared_games.length - 10} altri giochi...
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Pulsante per caricare nella libreria */}
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
                    Aggiorna Lista
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      window.open('/games', '_blank');
                    }}
                    size="sm"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Vai alla Libreria
                  </Button>
                </div>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Nessun gioco condiviso</AlertTitle>
                <AlertDescription>
                  Non sono stati trovati giochi condivisi. Verifica che il Family Sharing sia configurato correttamente.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Family Sharing Configurato!</AlertTitle>
              <AlertDescription>
                I giochi condivisi sono stati rilevati. Saranno automaticamente inclusi nella libreria 
                principale quando carichi i giochi Steam.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
