'use client';

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface EnhancedSteamInfo {
  steam_path: string;
  libraries_count: number;
  total_apps: number;
  installed_apps: number;
}

interface GameInfo {
  id: string;
  app_id: string;
  title: string;
  platform: string;
  header_image?: string;
  supported_languages?: string[];
  is_vr?: boolean;
  engine?: string;
  is_installed?: boolean;
  genres?: string[];
  last_played?: string;
  install_path?: string;
  library_path?: string;
}

export default function SteamTestPage() {
  const [loading, setLoading] = useState(false);
  const [steamInfo, setSteamInfo] = useState<EnhancedSteamInfo | null>(null);
  const [games, setGames] = useState<GameInfo[]>([]);
  const [testResult, setTestResult] = useState<string>('');
  const [searchId, setSearchId] = useState<string>('');
  const [foundGame, setFoundGame] = useState<GameInfo | null>(null);
  const [error, setError] = useState<string>('');

  const handleGetSteamInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const info = await invoke<EnhancedSteamInfo>('get_enhanced_steam_info');
      setSteamInfo(info);
    } catch (err) {
      setError(`Errore: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScanGames = async () => {
    setLoading(true);
    setError('');
    try {
      const gamesList = await invoke<GameInfo[]>('scan_steam_with_steamlocate');
      setGames(gamesList);
    } catch (err) {
      setError(`Errore: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestIntegration = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await invoke<string>('test_steamlocate_integration');
      setTestResult(result);
    } catch (err) {
      setError(`Errore: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchGame = async () => {
    if (!searchId.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      const game = await invoke<GameInfo | null>('find_steam_game_by_id', { 
        appId: parseInt(searchId) 
      });
      setFoundGame(game);
    } catch (err) {
      setError(`Errore: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          🚀 Test Integrazione SteamLocate-rs
        </h1>

        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Sezione Info Steam */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">📊 Informazioni Steam</h2>
          <button
            onClick={handleGetSteamInfo}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Caricamento...' : 'Ottieni Info Steam'}
          </button>

          {steamInfo && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold">Percorso Steam</h3>
                <p className="text-sm text-gray-300 break-all">{steamInfo.steam_path}</p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold">Librerie</h3>
                <p className="text-2xl font-bold text-blue-400">{steamInfo.libraries_count}</p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold">App Totali</h3>
                <p className="text-2xl font-bold text-green-400">{steamInfo.total_apps}</p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold">App Installate</h3>
                <p className="text-2xl font-bold text-yellow-400">{steamInfo.installed_apps}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sezione Test Integrazione */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">🧪 Test Integrazione</h2>
          <button
            onClick={handleTestIntegration}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Testando...' : 'Esegui Test Completo'}
          </button>

          {testResult && (
            <div className="mt-4 bg-gray-700 p-4 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
            </div>
          )}
        </div>

        {/* Sezione Ricerca Gioco */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">🔍 Ricerca Gioco per ID</h2>
          <div className="flex gap-4 mb-4">
            <input
              type="number"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Inserisci Steam App ID (es. 730 per CS:GO)"
              className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg"
            />
            <button
              onClick={handleSearchGame}
              disabled={loading || !searchId.trim()}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Cercando...' : 'Cerca'}
            </button>
          </div>

          {foundGame && (
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">{foundGame.title}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="font-semibold">ID:</span> {foundGame.app_id}</p>
                <p><span className="font-semibold">Piattaforma:</span> {foundGame.platform}</p>
                <p><span className="font-semibold">VR:</span> {foundGame.is_vr ? '🥽 Sì' : '❌ No'}</p>
                <p><span className="font-semibold">Installato:</span> {foundGame.is_installed ? '✅ Sì' : '❌ No'}</p>
                {foundGame.engine && <p><span className="font-semibold">Engine:</span> {foundGame.engine}</p>}
                {foundGame.install_path && <p className="col-span-2"><span className="font-semibold">Percorso:</span> {foundGame.install_path}</p>}
              </div>
            </div>
          )}

          {foundGame === null && searchId && !loading && (
            <div className="bg-red-600 p-4 rounded-lg">
              Gioco con ID {searchId} non trovato
            </div>
          )}
        </div>

        {/* Sezione Scansione Completa */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">🎮 Scansione Completa Giochi</h2>
          <button
            onClick={handleScanGames}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg disabled:opacity-50 mb-4"
          >
            {loading ? 'Scansionando...' : 'Scansiona Tutti i Giochi'}
          </button>

          {games.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-4">
                Trovati {games.length} giochi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {games.slice(0, 50).map((game) => (
                  <div key={game.id} className="bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-semibold truncate">{game.title}</h4>
                    <div className="text-sm text-gray-300 mt-2">
                      <p>ID: {game.app_id}</p>
                      {game.is_vr && <span className="bg-purple-600 px-2 py-1 rounded text-xs">🥽 VR</span>}
                      {game.is_installed && <span className="bg-green-600 px-2 py-1 rounded text-xs ml-1">✅ Installato</span>}
                      {game.engine && <p className="mt-1">Engine: {game.engine}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {games.length > 50 && (
                <p className="text-center text-gray-400 mt-4">
                  Mostrati i primi 50 di {games.length} giochi
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
