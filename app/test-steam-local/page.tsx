"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, GamepadIcon, HardDrive, Users, Download } from 'lucide-react';

// Definisci i tipi per i dati Steam locali
interface LocalGameInfo {
  appid: number;
  name: string;
  status: GameStatus;
  install_dir?: string;
  last_updated?: number;
  size_on_disk?: number;
  buildid?: number;
}

type GameStatus = 
  | 'Owned'
  | { Installed: { path: string } }
  | { Shared: { from_steam_id: string } };

export default function TestSteamLocalPage() {
  const [games, setGames] = useState<LocalGameInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    installed: 0,
    owned: 0,
    shared: 0
  });

  const handleTestLocalGames = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Verifica se siamo in un ambiente Tauri
      if (typeof window !== 'undefined' && window.__TAURI__) {
        const { invoke } = window.__TAURI__;
        const result = await invoke('get_all_local_steam_games');
        
        if (Array.isArray(result)) {
          setGames(result);
          
          // Calcola statistiche
          const installed = result.filter(g => 
            typeof g.status === 'object' && 'Installed' in g.status
          ).length;
          const owned = result.filter(g => g.status === 'Owned').length;
          const shared = result.filter(g => 
            typeof g.status === 'object' && 'Shared' in g.status
          ).length;
          
          setStats({
            total: result.length,
            installed,
            owned,
            shared
          });
        }
      } else {
        // Fallback con dati di esempio se non siamo in Tauri
        const exampleGames: LocalGameInfo[] = [
          {
            appid: 730,
            name: "Counter-Strike 2",
            status: { Installed: { path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive" } },
            install_dir: "Counter-Strike Global Offensive",
            size_on_disk: 26843545600,
            last_updated: 1704067200,
            buildid: 13842302
          },
          {
            appid: 1238840,
            name: "Baldur's Gate 3",
            status: { Installed: { path: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Baldurs Gate 3" } },
            install_dir: "Baldurs Gate 3",
            size_on_disk: 104857600000,
            last_updated: 1703980800,
            buildid: 13756432
          },
          {
            appid: 570,
            name: "Dota 2",
            status: "Owned",
            install_dir: undefined,
            size_on_disk: undefined,
            last_updated: undefined,
            buildid: undefined
          },
          {
            appid: 440,
            name: "Team Fortress 2",
            status: { Shared: { from_steam_id: "76561198000000000" } },
            install_dir: undefined,
            size_on_disk: undefined,
            last_updated: undefined,
            buildid: undefined
          }
        ];
        
        setGames(exampleGames);
        setStats({
          total: 4,
          installed: 2,
          owned: 1,
          shared: 1
        });
        
        setError("⚠️ Demo Mode: Dati di esempio mostrati (avvia app Tauri per test reale)");
      }
    } catch (err) {
      setError(`Errore: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: GameStatus) => {
    if (status === 'Owned') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">
        <GamepadIcon className="w-3 h-3 mr-1" />
        Posseduto
      </Badge>;
    }
    
    if (typeof status === 'object' && 'Installed' in status) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">
        <HardDrive className="w-3 h-3 mr-1" />
        Installato
      </Badge>;
    }
    
    if (typeof status === 'object' && 'Shared' in status) {
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800">
        <Users className="w-3 h-3 mr-1" />
        Condiviso
      </Badge>;
    }
    
    return <Badge variant="outline">Sconosciuto</Badge>;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('it-IT');
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🎮 Test Steam Local Integration</h1>
        <p className="text-gray-600 mb-4">
          Testa la nuova funzionalità di lettura diretta dei file locali di Steam
        </p>
        
        <Button 
          onClick={handleTestLocalGames}
          disabled={loading}
          className="mb-6"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Caricamento...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Carica Giochi Steam Locali
            </>
          )}
        </Button>

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">{error}</p>
          </div>
        )}

        {stats.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Totale Giochi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Installati</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.installed}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Posseduti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.owned}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Condivisi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.shared}</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {games.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Giochi Trovati ({games.length})</h2>
          
          <div className="grid gap-4">
            {games.map((game) => (
              <Card key={game.appid} className="w-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{game.name}</CardTitle>
                      <CardDescription>AppID: {game.appid}</CardDescription>
                    </div>
                    {getStatusBadge(game.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-600">Cartella</p>
                      <p className="truncate">{game.install_dir || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Dimensione</p>
                      <p>{formatBytes(game.size_on_disk)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Ultimo Aggiornamento</p>
                      <p>{formatDate(game.last_updated)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-600">Build ID</p>
                      <p>{game.buildid || 'N/A'}</p>
                    </div>
                  </div>
                  
                  {typeof game.status === 'object' && 'Installed' in game.status && (
                    <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                      <p className="font-medium">Percorso:</p>
                      <p className="text-gray-600 break-all">{game.status.Installed.path}</p>
                    </div>
                  )}
                  
                  {typeof game.status === 'object' && 'Shared' in game.status && (
                    <div className="mt-3 p-2 bg-purple-50 rounded text-xs">
                      <p className="font-medium">Condiviso da Steam ID:</p>
                      <p className="text-gray-600">{game.status.Shared.from_steam_id}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}