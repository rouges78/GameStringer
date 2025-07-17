'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface EpicGameEnhanced {
  app_name: string;
  display_name: string;
  namespace: string;
  catalog_item_id: string;
  install_location?: string;
  is_installed: boolean;
  is_owned: boolean;
  is_dlc: boolean;
  executable_path?: string;
  install_size?: number;
  last_played?: number;
  version?: string;
  build_version?: string;
  launch_parameters?: string;
}

interface EpicScanResult {
  total_games: number;
  installed_games: number;
  owned_games: number;
  dlc_count: number;
  games: EpicGameEnhanced[];
  scan_method: string;
  scan_duration_ms: number;
  errors: string[];
}

export default function EpicEnhancedTestPage() {
  const [scanResult, setScanResult] = useState<EpicScanResult | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [selectedGame, setSelectedGame] = useState<EpicGameEnhanced | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScanEpicGames = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🎮 Avvio scansione Epic Games migliorata...');
      const result = await invoke<EpicScanResult>('scan_epic_games_enhanced');
      console.log('✅ Scansione Epic Games completata:', result);
      setScanResult(result);
    } catch (err) {
      console.error('❌ Errore scansione Epic Games:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleGetStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📊 Recupero statistiche Epic Games...');
      const stats = await invoke<any>('get_epic_statistics_enhanced');
      console.log('✅ Statistiche Epic Games:', stats);
      setStatistics(stats);
    } catch (err) {
      console.error('❌ Errore statistiche Epic Games:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleGetGameDetails = async (appName: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log(`🔍 Recupero dettagli gioco Epic ${appName}...`);
      const game = await invoke<EpicGameEnhanced>('get_epic_game_enhanced', { 
        app_name: appName 
      });
      console.log('✅ Dettagli gioco Epic:', game);
      setSelectedGame(game);
    } catch (err) {
      console.error('❌ Errore dettagli gioco Epic:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Mai giocato';
    return new Date(timestamp * 1000).toLocaleDateString('it-IT');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🚀 Epic Games Enhanced Detection
          </h1>
          <p className="text-gray-300 text-lg">
            Sistema di rilevamento Epic Games migliorato basato su repository ufficiali
          </p>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleScanEpicGames}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              {loading ? '🔄 Scansione...' : '🔍 Scansiona Epic Games'}
            </button>
            
            <button
              onClick={handleGetStatistics}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              {loading ? '📊 Caricamento...' : '📊 Statistiche Epic'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-6 py-4 rounded-lg mb-8">
            <h3 className="font-bold text-lg mb-2">❌ Errore</h3>
            <p className="font-mono text-sm">{error}</p>
          </div>
        )}

        {/* Scan Results */}
        {scanResult && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">📋 Risultati Scansione Epic Games</h2>
            
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-purple-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-300">{scanResult.total_games}</div>
                <div className="text-sm text-gray-300">Giochi Totali</div>
              </div>
              <div className="bg-green-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-300">{scanResult.installed_games}</div>
                <div className="text-sm text-gray-300">Installati</div>
              </div>
              <div className="bg-blue-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-300">{scanResult.owned_games}</div>
                <div className="text-sm text-gray-300">Posseduti</div>
              </div>
              <div className="bg-yellow-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-300">{scanResult.dlc_count}</div>
                <div className="text-sm text-gray-300">DLC</div>
              </div>
            </div>

            {/* Scan Info */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">🔍 Metodi di Scansione</h3>
              <div className="bg-gray-700 p-3 rounded">
                <p className="text-gray-300">
                  <span className="font-semibold">Metodi utilizzati:</span> {scanResult.scan_method}
                </p>
                <p className="text-gray-300">
                  <span className="font-semibold">Durata:</span> {scanResult.scan_duration_ms}ms
                </p>
                {scanResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-yellow-400 font-semibold">⚠️ Errori:</p>
                    <ul className="text-sm text-gray-400 ml-4">
                      {scanResult.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Games List */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">🎮 Giochi Epic Games</h3>
              <div className="grid gap-4">
                {scanResult.games.map((game, index) => (
                  <div key={index} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{game.display_name}</h4>
                        <p className="text-sm text-gray-400">App Name: {game.app_name}</p>
                        {game.namespace && (
                          <p className="text-sm text-gray-400">Namespace: {game.namespace}</p>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        {game.is_installed && (
                          <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">
                            Installato
                          </span>
                        )}
                        {game.is_owned && (
                          <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                            Posseduto
                          </span>
                        )}
                        {game.is_dlc && (
                          <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs">
                            DLC
                          </span>
                        )}
                        <button
                          onClick={() => handleGetGameDetails(game.app_name)}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Dettagli
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      {game.version && (
                        <div>
                          <span className="text-gray-400">Versione:</span>
                          <span className="text-white ml-1">{game.version}</span>
                        </div>
                      )}
                      {game.install_size && (
                        <div>
                          <span className="text-gray-400">Dimensione:</span>
                          <span className="text-white ml-1">{formatBytes(game.install_size)}</span>
                        </div>
                      )}
                      {game.install_location && (
                        <div className="col-span-2">
                          <span className="text-gray-400">Percorso:</span>
                          <span className="text-white ml-1 text-xs">{game.install_location}</span>
                        </div>
                      )}
                    </div>
                    
                    {game.executable_path && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-400">Eseguibile:</span>
                        <span className="text-white ml-1 text-xs">{game.executable_path}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Statistics */}
        {statistics && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">📊 Statistiche Epic Games</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Overview */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">📈 Panoramica</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Giochi Totali:</span>
                    <span className="text-white">{statistics.total_games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Installati:</span>
                    <span className="text-green-400">{statistics.installed_games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Posseduti:</span>
                    <span className="text-blue-400">{statistics.owned_games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">DLC:</span>
                    <span className="text-yellow-400">{statistics.dlc_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Dimensione Totale:</span>
                    <span className="text-purple-400">{formatBytes(statistics.total_install_size)}</span>
                  </div>
                </div>
              </div>

              {/* Technical Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">🔧 Info Tecniche</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Metodo Scansione:</span>
                    <span className="text-white ml-1">{statistics.scan_method}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Durata Scansione:</span>
                    <span className="text-white ml-1">{statistics.scan_duration_ms}ms</span>
                  </div>
                  {statistics.errors && statistics.errors.length > 0 && (
                    <div>
                      <span className="text-gray-400">Errori:</span>
                      <div className="mt-1 space-y-1">
                        {statistics.errors.map((error: string, index: number) => (
                          <div key={index} className="text-red-400 text-xs">• {error}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Game Details */}
        {selectedGame && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              🎮 Dettagli: {selectedGame.display_name}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">📋 Informazioni Base</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">App Name:</span>
                    <span className="text-white ml-1">{selectedGame.app_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Display Name:</span>
                    <span className="text-white ml-1">{selectedGame.display_name}</span>
                  </div>
                  {selectedGame.namespace && (
                    <div>
                      <span className="text-gray-400">Namespace:</span>
                      <span className="text-white ml-1">{selectedGame.namespace}</span>
                    </div>
                  )}
                  {selectedGame.catalog_item_id && (
                    <div>
                      <span className="text-gray-400">Catalog ID:</span>
                      <span className="text-white ml-1">{selectedGame.catalog_item_id}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Stato:</span>
                    <div className="flex gap-2 mt-1">
                      {selectedGame.is_installed && (
                        <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">Installato</span>
                      )}
                      {selectedGame.is_owned && (
                        <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Posseduto</span>
                      )}
                      {selectedGame.is_dlc && (
                        <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs">DLC</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">🔧 Info Tecniche</h3>
                <div className="space-y-2 text-sm">
                  {selectedGame.version && (
                    <div>
                      <span className="text-gray-400">Versione:</span>
                      <span className="text-white ml-1">{selectedGame.version}</span>
                    </div>
                  )}
                  {selectedGame.build_version && (
                    <div>
                      <span className="text-gray-400">Build:</span>
                      <span className="text-white ml-1">{selectedGame.build_version}</span>
                    </div>
                  )}
                  {selectedGame.install_size && (
                    <div>
                      <span className="text-gray-400">Dimensione:</span>
                      <span className="text-white ml-1">{formatBytes(selectedGame.install_size)}</span>
                    </div>
                  )}
                  {selectedGame.last_played && (
                    <div>
                      <span className="text-gray-400">Ultimo Gioco:</span>
                      <span className="text-white ml-1">{formatDate(selectedGame.last_played)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Paths */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-3">📁 Percorsi</h3>
              <div className="space-y-2 text-sm">
                {selectedGame.install_location && (
                  <div>
                    <span className="text-gray-400">Installazione:</span>
                    <div className="text-white ml-1 font-mono text-xs bg-gray-700 p-2 rounded mt-1">
                      {selectedGame.install_location}
                    </div>
                  </div>
                )}
                {selectedGame.executable_path && (
                  <div>
                    <span className="text-gray-400">Eseguibile:</span>
                    <div className="text-white ml-1 font-mono text-xs bg-gray-700 p-2 rounded mt-1">
                      {selectedGame.executable_path}
                    </div>
                  </div>
                )}
                {selectedGame.launch_parameters && (
                  <div>
                    <span className="text-gray-400">Parametri Lancio:</span>
                    <div className="text-white ml-1 font-mono text-xs bg-gray-700 p-2 rounded mt-1">
                      {selectedGame.launch_parameters}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
