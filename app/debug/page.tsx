'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function DebugPage() {
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileResult, setProfileResult] = useState('');
  const [gameAppId, setGameAppId] = useState('');
  const [gameName, setGameName] = useState('');
  const [addGameResult, setAddGameResult] = useState('');
  const [extendedResult, setExtendedResult] = useState('');

  const testSteamApi = async () => {
    setLoading(true);
    try {
      // Verifica se siamo in ambiente Tauri
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        // Import dinamico per evitare errori durante il build
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('debug_steam_api', { 
          apiKey: apiKey, 
          steamId: steamId 
        });
        setResult(`Risultato API: ${JSON.stringify(result, null, 2)}\n\nControlla la console dell'app per vedere i log dettagliati del backend Rust.`);
      } else {
        setResult('Errore: Questa funzione è disponibile solo nell\'app Tauri desktop. Usa "npm run tauri:dev" per avviare l\'app desktop.');
      }
    } catch (error) {
      setResult(`Errore: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testSteamProfile = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('debug_steam_profile', { 
          apiKey: apiKey, 
          steamId: steamId 
        });
        setProfileResult(`Risultato profilo: ${JSON.stringify(result, null, 2)}\n\nControlla la console per dettagli.`);
      } else {
        setProfileResult('Errore: Questa funzione è disponibile solo nell\'app Tauri desktop.');
      }
    } catch (error) {
      setProfileResult(`Errore: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testSteamApiExtended = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('debug_steam_api_extended', { 
          apiKey: apiKey, 
          steamId: steamId 
        });
        setExtendedResult(`Test esteso API: ${JSON.stringify(result, null, 2)}\n\nControlla la console per dettagli.`);
      } else {
        setExtendedResult('Errore: Questa funzione è disponibile solo nell\'app Tauri desktop.');
      }
    } catch (error) {
      setExtendedResult(`Errore: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const addGameToLibrary = async () => {
    if (!gameAppId || !gameName) {
      setAddGameResult('Errore: Inserisci sia AppID che nome del gioco');
      return;
    }

    setLoading(true);
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke('add_game_to_library', { 
          appid: parseInt(gameAppId),
          name: gameName 
        });
        setAddGameResult(`Risultato: ${JSON.stringify(result, null, 2)}`);
      } else {
        setAddGameResult('Errore: Questa funzione è disponibile solo nell\'app Tauri desktop.');
      }
    } catch (error) {
      setAddGameResult(`Errore: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Debug API Steam</CardTitle>
          <CardDescription>
            Testa direttamente l'API Steam per vedere cosa restituisce
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="apiKey">API Key (lascia vuoto per usare quella salvata)</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Steam API Key"
              />
            </div>
            <div>
              <Label htmlFor="steamId">Steam ID (lascia vuoto per usare quello salvato)</Label>
              <Input
                id="steamId"
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
                placeholder="Steam ID"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={testSteamApi} 
              disabled={loading}
              className="w-full"
            >
              {loading ? '🔄 Testando API...' : '🔍 Testa API Games'}
            </Button>
            
            <Button 
              onClick={testSteamProfile} 
              disabled={loading}
              className="w-full"
              variant="secondary"
            >
              {loading ? '🔄 Testando Profilo...' : '👤 Testa Profilo'}
            </Button>
            
            <Button 
              onClick={testSteamApiExtended} 
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? '🔄 Test Esteso...' : '🔬 Test API Esteso'}
            </Button>
          </div>
          
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">➕ Aggiungi Gioco Manualmente</h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Dato che l'API Steam non restituisce giochi, usa questo sistema per aggiungere manualmente i nuovi acquisti.</strong>
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                Cerca l'AppID del gioco su <a href="https://steamdb.info" target="_blank" className="underline">SteamDB.info</a>
              </p>
              <details className="mt-3">
                <summary className="text-sm font-medium cursor-pointer text-blue-700 dark:text-blue-300">🔧 Soluzioni per l'API Steam</summary>
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <p>⚠️ <strong>DIAGNOSI:</strong> La tua API Steam ha un bug permanente/restrizioni account</p>
                  <p>🔧 <strong>SOLUZIONE:</strong> Usa il sistema manuale qui sotto - è più affidabile!</p>
                  <p>📚 <strong>REFERENCE:</strong> Problema confermato su Stack Overflow e community Steam</p>
                  <p>🎯 <strong>WORKFLOW:</strong> Compra gioco → Cerca AppID su SteamDB → Aggiungi qui</p>
                </div>
              </details>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="gameAppId">Steam App ID</Label>
                <Input
                  id="gameAppId"
                  value={gameAppId}
                  onChange={(e) => setGameAppId(e.target.value)}
                  placeholder="es. 2681110 (RoboCop)"
                />
              </div>
              <div>
                <Label htmlFor="gameName">Nome del Gioco</Label>
                <Input
                  id="gameName"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="es. RoboCop: Rogue City"
                />
              </div>
            </div>
            
            <Button 
              onClick={addGameToLibrary} 
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? '🔄 Aggiungendo...' : '➕ Aggiungi Gioco alla Libreria'}
            </Button>
            
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                💡 <strong>AppID comuni:</strong>
              </p>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-green-600 dark:text-green-400">
                <span>• Cyberpunk 2077: 1091500</span>
                <span>• Baldur's Gate 3: 1086940</span>
                <span>• Elden Ring: 1245620</span>
                <span>• Hogwarts Legacy: 990080</span>
                <span>• Spider-Man Remastered: 1817070</span>
                <span>• God of War: 1593500</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Per altri giochi: <a href="https://steamdb.info" target="_blank" className="underline">steamdb.info</a>
              </p>
            </div>
          </div>
          
          {result && (
            <div>
              <Label htmlFor="result">Risultato API Games:</Label>
              <Textarea
                id="result"
                value={result}
                readOnly
                rows={10}
                className="mt-2 font-mono text-sm"
              />
            </div>
          )}
          
          {profileResult && (
            <div>
              <Label htmlFor="profileResult">Risultato Profilo:</Label>
              <Textarea
                id="profileResult"
                value={profileResult}
                readOnly
                rows={10}
                className="mt-2 font-mono text-sm"
              />
            </div>
          )}
          
          {extendedResult && (
            <div>
              <Label htmlFor="extendedResult">Risultato Test Esteso:</Label>
              <Textarea
                id="extendedResult"
                value={extendedResult}
                readOnly
                rows={15}
                className="mt-2 font-mono text-sm"
              />
            </div>
          )}
          
          {addGameResult && (
            <div>
              <Label htmlFor="addGameResult">Risultato Aggiunta Gioco:</Label>
              <Textarea
                id="addGameResult"
                value={addGameResult}
                readOnly
                rows={5}
                className="mt-2 font-mono text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}