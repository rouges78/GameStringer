'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface LaunchResult {
  success: boolean;
  message: string;
  method: string;
  game_id: string;
  store: string;
}

interface LaunchRequest {
  game_id: string;
  store: string;
  game_name: string;
  executable_path?: string;
  launch_options?: string;
}

export default function LauncherTestPage() {
  const [installedLaunchers, setInstalledLaunchers] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<{ [key: string]: LaunchResult }>({});
  const [loading, setLoading] = useState(false);
  const [steamAppId, setSteamAppId] = useState('730'); // Counter-Strike 2
  const [epicAppName, setEpicAppName] = useState('Fortnite');
  const [gogGameId, setGogGameId] = useState('1207658924');
  const [directExePath, setDirectExePath] = useState('');
  const [launchOptions, setLaunchOptions] = useState('');

  useEffect(() => {
    loadInstalledLaunchers();
  }, []);

  const loadInstalledLaunchers = async () => {
    try {
      const launchers = await invoke<string[]>('get_installed_launchers');
      setInstalledLaunchers(launchers);
      console.log('🔍 Launcher installati:', launchers);
    } catch (error) {
      console.error('❌ Errore caricamento launcher:', error);
    }
  };

  const testLauncherFunctionality = async (launcher: string) => {
    setLoading(true);
    try {
      const result = await invoke<LaunchResult>('test_launcher_functionality', { launcher });
      setTestResults(prev => ({ ...prev, [launcher]: result }));
      console.log(`🧪 Test ${launcher}:`, result);
    } catch (error) {
      console.error(`❌ Errore test ${launcher}:`, error);
      setTestResults(prev => ({ 
        ...prev, 
        [launcher]: { 
          success: false, 
          message: `Errore: ${error}`, 
          method: 'test_error',
          game_id: 'test',
          store: launcher
        } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const launchSteamGame = async () => {
    setLoading(true);
    try {
      const result = await invoke<LaunchResult>('launch_steam_game', { appId: steamAppId });
      setTestResults(prev => ({ ...prev, [`steam_${steamAppId}`]: result }));
      console.log('🚀 Avvio Steam:', result);
    } catch (error) {
      console.error('❌ Errore avvio Steam:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [`steam_${steamAppId}`]: { 
          success: false, 
          message: `Errore: ${error}`, 
          method: 'launch_error',
          game_id: steamAppId,
          store: 'Steam'
        } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const launchEpicGame = async () => {
    setLoading(true);
    try {
      const result = await invoke<LaunchResult>('launch_epic_game', { appName: epicAppName });
      setTestResults(prev => ({ ...prev, [`epic_${epicAppName}`]: result }));
      console.log('🚀 Avvio Epic:', result);
    } catch (error) {
      console.error('❌ Errore avvio Epic:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [`epic_${epicAppName}`]: { 
          success: false, 
          message: `Errore: ${error}`, 
          method: 'launch_error',
          game_id: epicAppName,
          store: 'Epic Games'
        } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const launchGogGame = async () => {
    setLoading(true);
    try {
      const result = await invoke<LaunchResult>('launch_gog_game', { gameId: gogGameId });
      setTestResults(prev => ({ ...prev, [`gog_${gogGameId}`]: result }));
      console.log('🚀 Avvio GOG:', result);
    } catch (error) {
      console.error('❌ Errore avvio GOG:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [`gog_${gogGameId}`]: { 
          success: false, 
          message: `Errore: ${error}`, 
          method: 'launch_error',
          game_id: gogGameId,
          store: 'GOG'
        } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const launchDirectGame = async () => {
    if (!directExePath.trim()) {
      alert('Inserisci il percorso dell\'eseguibile');
      return;
    }

    setLoading(true);
    try {
      const result = await invoke<LaunchResult>('launch_game_direct', { 
        executablePath: directExePath,
        launchOptions: launchOptions || null
      });
      setTestResults(prev => ({ ...prev, [`direct_${directExePath}`]: result }));
      console.log('🚀 Avvio diretto:', result);
    } catch (error) {
      console.error('❌ Errore avvio diretto:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [`direct_${directExePath}`]: { 
          success: false, 
          message: `Errore: ${error}`, 
          method: 'launch_error',
          game_id: directExePath,
          store: 'Direct'
        } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const launchUniversalGame = async () => {
    const request: LaunchRequest = {
      game_id: steamAppId,
      store: 'Steam',
      game_name: 'Counter-Strike 2',
      executable_path: directExePath || undefined,
      launch_options: launchOptions || undefined
    };

    setLoading(true);
    try {
      const result = await invoke<LaunchResult>('launch_game_universal', { request });
      setTestResults(prev => ({ ...prev, [`universal_${request.game_id}`]: result }));
      console.log('🚀 Avvio universale:', result);
    } catch (error) {
      console.error('❌ Errore avvio universale:', error);
      setTestResults(prev => ({ 
        ...prev, 
        [`universal_${request.game_id}`]: { 
          success: false, 
          message: `Errore: ${error}`, 
          method: 'launch_error',
          game_id: request.game_id,
          store: request.store
        } 
      }));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (success: boolean) => {
    return success ? '✅' : '❌';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          🚀 GameStringer - Test Sistema Launcher
        </h1>

        {/* Launcher Installati */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🔍 Launcher Installati</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {installedLaunchers.length > 0 ? (
              installedLaunchers.map(launcher => (
                <div key={launcher} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{launcher}</span>
                    <button
                      onClick={() => testLauncherFunctionality(launcher)}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-3 py-1 rounded text-sm"
                    >
                      Test
                    </button>
                  </div>
                  {testResults[launcher] && (
                    <div className={`mt-2 text-sm ${getStatusColor(testResults[launcher].success)}`}>
                      {getStatusIcon(testResults[launcher].success)} {testResults[launcher].message}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center text-gray-400">
                Nessun launcher rilevato
              </div>
            )}
          </div>
        </div>

        {/* Test Avvio Steam */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🎮 Test Avvio Steam</h2>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">App ID:</label>
            <input
              type="text"
              value={steamAppId}
              onChange={(e) => setSteamAppId(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              placeholder="730"
            />
            <button
              onClick={launchSteamGame}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              Avvia Steam Game
            </button>
          </div>
          {testResults[`steam_${steamAppId}`] && (
            <div className={`text-sm ${getStatusColor(testResults[`steam_${steamAppId}`].success)}`}>
              {getStatusIcon(testResults[`steam_${steamAppId}`].success)} {testResults[`steam_${steamAppId}`].message}
              <br />
              <span className="text-gray-400">Metodo: {testResults[`steam_${steamAppId}`].method}</span>
            </div>
          )}
        </div>

        {/* Test Avvio Epic Games */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🎮 Test Avvio Epic Games</h2>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">App Name:</label>
            <input
              type="text"
              value={epicAppName}
              onChange={(e) => setEpicAppName(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              placeholder="Fortnite"
            />
            <button
              onClick={launchEpicGame}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              Avvia Epic Game
            </button>
          </div>
          {testResults[`epic_${epicAppName}`] && (
            <div className={`text-sm ${getStatusColor(testResults[`epic_${epicAppName}`].success)}`}>
              {getStatusIcon(testResults[`epic_${epicAppName}`].success)} {testResults[`epic_${epicAppName}`].message}
              <br />
              <span className="text-gray-400">Metodo: {testResults[`epic_${epicAppName}`].method}</span>
            </div>
          )}
        </div>

        {/* Test Avvio GOG */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🎮 Test Avvio GOG</h2>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">Game ID:</label>
            <input
              type="text"
              value={gogGameId}
              onChange={(e) => setGogGameId(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              placeholder="1207658924"
            />
            <button
              onClick={launchGogGame}
              disabled={loading}
              className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              Avvia GOG Game
            </button>
          </div>
          {testResults[`gog_${gogGameId}`] && (
            <div className={`text-sm ${getStatusColor(testResults[`gog_${gogGameId}`].success)}`}>
              {getStatusIcon(testResults[`gog_${gogGameId}`].success)} {testResults[`gog_${gogGameId}`].message}
              <br />
              <span className="text-gray-400">Metodo: {testResults[`gog_${gogGameId}`].method}</span>
            </div>
          )}
        </div>

        {/* Test Avvio Diretto */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🎮 Test Avvio Diretto</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Percorso Eseguibile:</label>
              <input
                type="text"
                value={directExePath}
                onChange={(e) => setDirectExePath(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white flex-1"
                placeholder="C:\\Program Files\\Game\\game.exe"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Opzioni Lancio:</label>
              <input
                type="text"
                value={launchOptions}
                onChange={(e) => setLaunchOptions(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white flex-1"
                placeholder="-windowed -novid"
              />
            </div>
            <button
              onClick={launchDirectGame}
              disabled={loading || !directExePath.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              Avvia Gioco Diretto
            </button>
          </div>
          {testResults[`direct_${directExePath}`] && (
            <div className={`mt-4 text-sm ${getStatusColor(testResults[`direct_${directExePath}`].success)}`}>
              {getStatusIcon(testResults[`direct_${directExePath}`].success)} {testResults[`direct_${directExePath}`].message}
              <br />
              <span className="text-gray-400">Metodo: {testResults[`direct_${directExePath}`].method}</span>
            </div>
          )}
        </div>

        {/* Test Avvio Universale */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🎮 Test Avvio Universale</h2>
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">
              Il sistema universale determina automaticamente il metodo migliore per avviare il gioco
            </p>
            <button
              onClick={launchUniversalGame}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              Avvia con Sistema Universale
            </button>
          </div>
          {testResults[`universal_${steamAppId}`] && (
            <div className={`text-sm ${getStatusColor(testResults[`universal_${steamAppId}`].success)}`}>
              {getStatusIcon(testResults[`universal_${steamAppId}`].success)} {testResults[`universal_${steamAppId}`].message}
              <br />
              <span className="text-gray-400">Metodo: {testResults[`universal_${steamAppId}`].method}</span>
            </div>
          )}
        </div>

        {/* Stato Loading */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-white">Avvio in corso...</p>
            </div>
          </div>
        )}

        {/* Guida */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">📖 Guida Test</h2>
          <div className="space-y-2 text-sm text-gray-300">
            <p><strong>Steam:</strong> Usa App ID numerici (es. 730 per CS2, 440 per TF2)</p>
            <p><strong>Epic Games:</strong> Usa nomi app Epic (es. Fortnite, WorldWarZ)</p>
            <p><strong>GOG:</strong> Usa Game ID GOG (numerico)</p>
            <p><strong>Diretto:</strong> Percorso completo all'eseguibile del gioco</p>
            <p><strong>Universale:</strong> Sistema intelligente che sceglie il metodo migliore</p>
          </div>
        </div>
      </div>
    </div>
  );
}
