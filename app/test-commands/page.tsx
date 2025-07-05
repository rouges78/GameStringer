'use client';

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestCommandsPage() {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const testCommand = async (commandName: string, args: any = {}) => {
    setLoading(prev => ({ ...prev, [commandName]: true }));
    try {
      const result = await invoke(commandName, args);
      setResults(prev => ({ ...prev, [commandName]: { success: true, data: result } }));
      console.log(`✅ ${commandName}:`, result);
    } catch (error) {
      setResults(prev => ({ ...prev, [commandName]: { success: false, error: error } }));
      console.error(`❌ ${commandName}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [commandName]: false }));
    }
  };

  const renderResult = (commandName: string) => {
    const result = results[commandName];
    const isLoading = loading[commandName];
    
    if (isLoading) {
      return <span className="text-blue-500">⏳ Caricamento...</span>;
    }
    
    if (!result) {
      return <span className="text-gray-500">Non testato</span>;
    }
    
    if (result.success) {
      return (
        <div>
          <span className="text-green-500">✅ Successo</span>
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs max-h-48 overflow-auto">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      );
    } else {
      return (
        <div>
          <span className="text-red-500">❌ Errore</span>
          <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
            {String(result.error)}
          </pre>
        </div>
      );
    }
  };

  const steamCommands = ['auto_detect_steam_config', 'get_steam_games', 'get_game_details'];
  const libraryCommands = ['get_library_games', 'get_game_path', 'scan_game_files'];
  const gamesCommands = ['get_games', 'get_game_by_id', 'scan_games'];
  const utilitiesCommands = ['get_preferences', 'get_cache_stats'];

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">🧪 Test Commands</h1>
      
      <div className="mb-6">
        <Button 
          onClick={() => console.log('Test tutti i comandi')}
          className="mr-4"
        >
          🚀 Test Tutti i Comandi
        </Button>
        <Button 
          variant="outline" 
          onClick={() => {
            setResults({});
            console.clear();
          }}
        >
          🧹 Pulisci Risultati
        </Button>
      </div>

      <div className="space-y-6">
        {/* Steam Commands */}
        <Card>
          <CardHeader>
            <CardTitle>🎮 Steam Commands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {steamCommands.map(cmd => (
              <div key={cmd}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{cmd}</span>
                  <Button 
                    size="sm" 
                    onClick={() => testCommand(cmd)}
                    disabled={loading[cmd]}
                  >
                    {loading[cmd] ? 'Loading...' : 'Test'}
                  </Button>
                </div>
                {renderResult(cmd)}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Library Commands */}
        <Card>
          <CardHeader>
            <CardTitle>📚 Library Commands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {libraryCommands.map(cmd => (
              <div key={cmd}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{cmd}</span>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      if (cmd === 'get_game_path') {
                        testCommand(cmd, { gameId: 'test_game' });
                      } else if (cmd === 'scan_game_files') {
                        testCommand(cmd, { gamePath: 'C:\\Games\\TestGame' });
                      } else {
                        testCommand(cmd);
                      }
                    }}
                    disabled={loading[cmd]}
                  >
                    {loading[cmd] ? 'Loading...' : 'Test'}
                  </Button>
                </div>
                {renderResult(cmd)}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Games Commands */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 Games Commands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {gamesCommands.map(cmd => (
              <div key={cmd}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{cmd}</span>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      if (cmd === 'get_game_by_id') {
                        testCommand(cmd, { gameId: 'test_game_id' });
                      } else {
                        testCommand(cmd);
                      }
                    }}
                    disabled={loading[cmd]}
                  >
                    {loading[cmd] ? 'Loading...' : 'Test'}
                  </Button>
                </div>
                {renderResult(cmd)}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Utilities Commands */}
        <Card>
          <CardHeader>
            <CardTitle>🔧 Utilities Commands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {utilitiesCommands.map(cmd => (
              <div key={cmd}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{cmd}</span>
                  <Button 
                    size="sm" 
                    onClick={() => testCommand(cmd)}
                    disabled={loading[cmd]}
                  >
                    {loading[cmd] ? 'Loading...' : 'Test'}
                  </Button>
                </div>
                {renderResult(cmd)}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
