'use client';

import { useState, useEffect } from 'react';
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
  FolderOpen,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';

interface SharedAccount {
  steamId: string;
  username?: string;
  avatar?: string;
}

export function SteamFamilySharing() {
  const { t } = useTranslation();
  const [isDetecting, setIsDetecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingSharedGames, setIsLoadingSharedGames] = useState(false);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccount[]>([]);
  const [familySharingConfig, setFamilySharingConfig] = useState<FamilySharingConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [manualSteamId, setManualSteamId] = useState('');
  const [manualAccounts, setManualAccounts] = useState<string[]>([]);

  // Carica Steam ID salvati all'avvio
  useEffect(() => {
    const loadSavedIds = async () => {
      try {
        const savedIds = await invoke<string[]>('load_family_sharing_ids');
        if (savedIds && savedIds.length > 0) {
          setManualAccounts(savedIds);
          setSharedAccounts(savedIds.map(steamId => ({ steamId })));
        }
      } catch {
        clientLogger.debug('Nessun ID salvato o errore nel caricamento');
      }
    };
    loadSavedIds();
  }, []);

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
          toast.info(`Installazione Steam rilevata in: ${result.steam_path}`);
        }
        
        // Automatically load shared games
        await loadFamilySharingGames();
      } else {
        setError("Nessun utente Steam trovato. Assicurati di essere loggato su Steam.");
        toast.warning('Nessun utente Steam trovato.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast.error('Rilevamento automatico fallito', {
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
        toast.info('Nessun gioco condiviso trovato. Verifica che il Family Sharing sia abilitato.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error('Errore nel caricamento dei giochi condivisi', {
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

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast.error('Errore nell\'analisi del file', {
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

  const handleAddManualAccount = async () => {
    if (!manualSteamId.trim()) {
      toast.error('Inserisci uno Steam ID valido');
      return;
    }
    // Valida formato Steam ID (17 cifre)
    if (!/^\d{17}$/.test(manualSteamId.trim())) {
      toast.error('Steam ID non valido. Deve essere un numero di 17 cifre.');
      return;
    }
    if (manualAccounts.includes(manualSteamId.trim())) {
      toast.warning('Questo Steam ID è già stato aggiunto');
      return;
    }
    const newAccounts = [...manualAccounts, manualSteamId.trim()];
    setManualAccounts(newAccounts);
    setSharedAccounts([...sharedAccounts, { steamId: manualSteamId.trim() }]);
    setManualSteamId('');
    
    // Salva in modo persistente
    try {
      await invoke('save_family_sharing_ids', { ids: newAccounts });
      toast.success('Steam ID aggiunto e salvato!');
    } catch {
      toast.success('Steam ID aggiunto!');
    }
  };

  const handleRemoveManualAccount = async (steamId: string) => {
    const newAccounts = manualAccounts.filter(id => id !== steamId);
    setManualAccounts(newAccounts);
    setSharedAccounts(sharedAccounts.filter(acc => acc.steamId !== steamId));
    
    // Salva in modo persistente
    try {
      await invoke('save_family_sharing_ids', { ids: newAccounts });
    } catch {
      // Ignora errori di salvataggio
    }
    toast.info('Steam ID rimosso');
  };

  return (
    <Card className="w-full bg-transparent border-0 shadow-none">
      <CardHeader className="py-2 px-0">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-white text-base">{t('steamFamilySharingComp.gestioneFamilySharing')}</CardTitle>
        </div>
        <CardDescription className="text-slate-400 text-xs">
          Rileva account Steam che condividono la libreria con te
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 py-2">
        <Tabs defaultValue="add" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-900/50 border border-slate-700/50">
            <TabsTrigger value="add" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-400">
              <Users className="h-4 w-4 mr-2" />
              Aggiungi Amici
            </TabsTrigger>
            <TabsTrigger value="auto" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-400">
              <Search className="h-4 w-4 mr-2" />
              Auto-Rileva
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-400">
              <Upload className="h-4 w-4 mr-2" />
              File VDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-2 mt-2">
            <div className="p-2 rounded border border-slate-700/50 bg-slate-800/30">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-purple-400 flex-shrink-0" />
                <p className="text-xs text-slate-400">
                  Inserisci lo Steam ID (17 cifre) degli amici. Trovalo nel profilo Steam.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Steam ID (es. 76561198012345678)"
                value={manualSteamId}
                onChange={(e) => setManualSteamId(e.target.value)}
                className="flex-1 bg-slate-900/50 border-slate-700/50 text-white placeholder:text-slate-500"
              />
              <Button onClick={handleAddManualAccount}>
                Aggiungi
              </Button>
            </div>

            {manualAccounts.length > 0 && (
              <div className="space-y-2">
                <Label>{t('steamFamilySharingComp.steamIdAggiunti')}</Label>
                {manualAccounts.map((steamId) => (
                  <div key={steamId} className="flex items-center justify-between p-2 rounded border border-slate-700/50 bg-slate-900/50">
                    <span className="font-mono text-sm">{steamId}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleRemoveManualAccount(steamId)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="auto" className="space-y-2 mt-2">
            <div className="p-2 rounded border border-slate-700/50 bg-slate-800/30">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-purple-400 flex-shrink-0" />
                <p className="text-xs text-slate-400">
                  Cerca automaticamente la configurazione Steam sul PC.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleAutoDetect} 
                disabled={isDetecting}
                className="w-full"
                size="sm"
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

          <TabsContent value="manual" className="space-y-2 mt-2">
            <div className="p-2 rounded border border-slate-700/50 bg-slate-800/30">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-400 flex-shrink-0" />
                <p className="text-xs text-slate-400">
                  Carica <code className="font-mono bg-slate-900 px-1 rounded text-purple-400">sharedconfig.vdf</code>
                </p>
                <Button variant="ghost" size="sm" onClick={copyPath} className="text-slate-400 hover:text-white h-6 ml-auto">
                  <Copy className="h-3 w-3 mr-1" /> Copia path
                </Button>
              </div>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  id="vdf-file"
                  type="file"
                  accept=".vdf"
                  onChange={handleFileChange}
                  className="cursor-pointer bg-slate-900/50 border-slate-700/50 text-white h-9"
                />
              </div>
              <Button 
                onClick={handleFileUpload} 
                disabled={!selectedFile || isUploading}
                size="sm"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analisi...
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
          <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Shared Accounts Section */}
        {sharedAccounts.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('steamFamilySharingComp.accountCondivisi')}</h3>
              <Badge variant="secondary" className="text-xs">{sharedAccounts.length}</Badge>
            </div>
            
            <div className="grid gap-2">
              {sharedAccounts.map((account, index) => (
                <div
                  key={account.steamId}
                  className="flex items-center justify-between p-2 rounded border border-slate-700/50 bg-slate-900/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Users className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{account.username || `Utente ${index + 1}`}</p>
                      <p className="text-xs text-muted-foreground font-mono">{account.steamId}</p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared Games Section */}
        {familySharingConfig && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('steamFamilySharingComp.giochiCondivisi')}</h3>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-xs">{familySharingConfig.total_shared_games}</Badge>
                <Badge variant="outline" className="text-xs">{familySharingConfig.authorized_users.length} utenti</Badge>
              </div>
            </div>

            {familySharingConfig.total_shared_games > 0 ? (
              <div className="space-y-2">
                <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-700/50 rounded p-2 bg-slate-900/30">
                  {familySharingConfig.shared_games.slice(0, 5).map((game) => (
                    <div key={game.appid} className="flex items-center justify-between py-1 border-b border-slate-700/30 last:border-b-0">
                      <span className="text-xs">{game.name}</span>
                      <span className="text-xs text-muted-foreground">{game.owner_account_name}</span>
                    </div>
                  ))}
                  {familySharingConfig.shared_games.length > 5 && (
                    <div className="text-center text-xs text-muted-foreground">+{familySharingConfig.shared_games.length - 5} altri...</div>
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
                    Aggiorna Lista
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      window.open('/library', '_blank');
                    }}
                    size="sm"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Vai alla Libreria
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                Nessun gioco condiviso trovato.
              </div>
            )}

            <div className="p-2 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
              ✅ Family Sharing configurato!
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



