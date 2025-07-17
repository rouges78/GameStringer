'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface DLCInfo {
  id: string;
  name: string;
  parent_game_id: string;
  parent_game_name: string;
  store: string;
  is_installed: boolean;
  is_owned: boolean;
  release_date?: string;
  price?: string;
  description?: string;
  cover_url?: string;
  size_bytes?: number;
  last_updated?: number;
}

interface GameDLCStats {
  game_id: string;
  game_name: string;
  store: string;
  total_dlc_count: number;
  owned_dlc_count: number;
  installed_dlc_count: number;
  total_dlc_size_bytes: number;
  completion_percentage: number;
  dlc_list: DLCInfo[];
}

interface DLCScanResult {
  total_games_with_dlc: number;
  total_dlc_found: number;
  total_dlc_owned: number;
  total_dlc_installed: number;
  games_stats: GameDLCStats[];
  scan_duration_ms: number;
  stores_scanned: string[];
}

export default function DLCTestPage() {
  const [scanResult, setScanResult] = useState<DLCScanResult | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [selectedGame, setSelectedGame] = useState<GameDLCStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScanAllDLC = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🎮 Avvio scansione completa DLC...');
      const result = await invoke<DLCScanResult>('scan_all_dlc');
      console.log('✅ Scansione DLC completata:', result);
      setScanResult(result);
    } catch (err) {
      console.error('❌ Errore scansione DLC:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleGetStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📊 Recupero statistiche DLC...');
      const stats = await invoke<any>('get_dlc_statistics');
      console.log('✅ Statistiche DLC:', stats);
      setStatistics(stats);
    } catch (err) {
      console.error('❌ Errore statistiche DLC:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleGetGameDLC = async (gameId: string, store: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log(`🔍 Recupero DLC per gioco ${gameId} (${store})...`);
      const gameStats = await invoke<GameDLCStats>('get_game_dlc', { 
        game_id: gameId, 
        store: store 
      });
      console.log('✅ DLC gioco:', gameStats);
      setSelectedGame(gameStats);
    } catch (err) {
      console.error('❌ Errore DLC gioco:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('it-IT');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎮 DLC Management Test
          </h1>
          <p className="text-gray-300 text-lg">
            Sistema di gestione DLC cross-store per GameStringer
          </p>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleScanAllDLC}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              {loading ? '🔄 Scansione...' : '🔍 Scansiona Tutti i DLC'}
            </button>
            
            <button
              onClick={handleGetStatistics}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              {loading ? '📊 Caricamento...' : '📊 Statistiche DLC'}
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
            <h2 className="text-2xl font-bold text-white mb-4">📋 Risultati Scansione</h2>
            
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-300">{scanResult.total_games_with_dlc}</div>
                <div className="text-sm text-gray-300">Giochi con DLC</div>
              </div>
              <div className="bg-green-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-300">{scanResult.total_dlc_found}</div>
                <div className="text-sm text-gray-300">DLC Totali</div>
              </div>
              <div className="bg-yellow-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-300">{scanResult.total_dlc_owned}</div>
                <div className="text-sm text-gray-300">DLC Posseduti</div>
              </div>
              <div className="bg-purple-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-300">{scanResult.total_dlc_installed}</div>
                <div className="text-sm text-gray-300">DLC Installati</div>
              </div>
            </div>

            {/* Store Info */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">🏪 Store Scansionati</h3>
              <div className="flex flex-wrap gap-2">
                {scanResult.stores_scanned.map((store, index) => (
                  <span key={index} className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                    {store}
                  </span>
                ))}
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Scansione completata in {scanResult.scan_duration_ms}ms
              </p>
            </div>

            {/* Games List */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">🎮 Giochi con DLC</h3>
              <div className="grid gap-4">
                {scanResult.games_stats.map((game, index) => (
                  <div key={index} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-white">{game.game_name}</h4>
                        <p className="text-sm text-gray-400">{game.store} • ID: {game.game_id}</p>
                      </div>
                      <button
                        onClick={() => handleGetGameDLC(game.game_id, game.store)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Dettagli
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Totali:</span>
                        <span className="text-white ml-1">{game.total_dlc_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Posseduti:</span>
                        <span className="text-green-400 ml-1">{game.owned_dlc_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Installati:</span>
                        <span className="text-blue-400 ml-1">{game.installed_dlc_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Completamento:</span>
                        <span className="text-yellow-400 ml-1">{game.completion_percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    {game.total_dlc_size_bytes > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-400">Dimensione totale:</span>
                        <span className="text-white ml-1">{formatBytes(game.total_dlc_size_bytes)}</span>
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
            <h2 className="text-2xl font-bold text-white mb-4">📊 Statistiche DLC</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Overview */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">📈 Panoramica Generale</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Giochi con DLC:</span>
                    <span className="text-white">{statistics.overview.total_games_with_dlc}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">DLC Totali:</span>
                    <span className="text-white">{statistics.overview.total_dlc_found}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">DLC Posseduti:</span>
                    <span className="text-green-400">{statistics.overview.total_dlc_owned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">DLC Installati:</span>
                    <span className="text-blue-400">{statistics.overview.total_dlc_installed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Completamento:</span>
                    <span className="text-yellow-400">{statistics.overview.overall_completion_rate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* By Store */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">🏪 Per Store</h3>
                <div className="space-y-3">
                  {Object.entries(statistics.by_store).map(([store, data]: [string, any]) => (
                    <div key={store} className="bg-gray-700 p-3 rounded">
                      <h4 className="font-semibold text-white mb-2">{store}</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Giochi:</span>
                          <span className="text-white ml-1">{data.games_with_dlc}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">DLC:</span>
                          <span className="text-white ml-1">{data.total_dlc}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Posseduti:</span>
                          <span className="text-green-400 ml-1">{data.owned_dlc}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Completamento:</span>
                          <span className="text-yellow-400 ml-1">{data.completion_rate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Game DLC Details */}
        {selectedGame && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              🎮 DLC per {selectedGame.game_name}
            </h2>
            
            <div className="grid gap-4">
              {selectedGame.dlc_list.map((dlc, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{dlc.name}</h4>
                      <p className="text-sm text-gray-400">ID: {dlc.id}</p>
                    </div>
                    <div className="flex gap-2">
                      {dlc.is_owned && (
                        <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">
                          Posseduto
                        </span>
                      )}
                      {dlc.is_installed && (
                        <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                          Installato
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {dlc.description && (
                    <p className="text-sm text-gray-300 mb-2">{dlc.description}</p>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {dlc.release_date && (
                      <div>
                        <span className="text-gray-400">Rilascio:</span>
                        <span className="text-white ml-1">{dlc.release_date}</span>
                      </div>
                    )}
                    {dlc.price && (
                      <div>
                        <span className="text-gray-400">Prezzo:</span>
                        <span className="text-green-400 ml-1">{dlc.price}</span>
                      </div>
                    )}
                    {dlc.size_bytes && (
                      <div>
                        <span className="text-gray-400">Dimensione:</span>
                        <span className="text-white ml-1">{formatBytes(dlc.size_bytes)}</span>
                      </div>
                    )}
                    {dlc.last_updated && (
                      <div>
                        <span className="text-gray-400">Aggiornato:</span>
                        <span className="text-white ml-1">{formatDate(dlc.last_updated)}</span>
                      </div>
                    )}
                  </div>
                  
                  {dlc.cover_url && (
                    <div className="mt-3">
                      <img 
                        src={dlc.cover_url} 
                        alt={dlc.name}
                        className="w-32 h-16 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
