'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bug, Search, Zap } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';

export function DebugPanel() {
  const [debugResults, setDebugResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addDebugResult = (message: string) => {
    setDebugResults(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`
    ]);
  };

  const clearResults = () => {
    setDebugResults([]);
  };

  const testRawSteamAPI = async () => {
    setIsLoading(true);
    try {
      addDebugResult('🔍 Testing raw Steam API...');
      const result = await invoke('debug_steam_api_raw');
      addDebugResult(`✅ Raw API result: ${result}`);
    } catch (error: unknown) {
      addDebugResult(`❌ Raw API error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testForceRefresh = async () => {
    setIsLoading(true);
    try {
      addDebugResult('🔄 Testing force refresh...');
      const result = await invoke('force_refresh_steam_games');
      const games = result as Record<string, unknown>[];
      addDebugResult(`✅ Force refresh returned ${games.length} games`);

      // Show sample games
      const lastGames = games.slice(-5).map((g: Record<string, unknown>) => g.name);
      addDebugResult(`📋 Last 5 games: ${lastGames.join(', ')}`);
      
    } catch (error: unknown) {
      addDebugResult(`❌ Force refresh error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testGameSearch = async () => {
    setIsLoading(true);
    try {
      addDebugResult('🎮 Getting all games and analyzing library...');
      const result = await invoke('get_games');
      const games = result as Record<string, unknown>[];

      addDebugResult(`📊 Total games loaded: ${games.length}`);

      // Show game statistics
      const platforms = games.reduce((acc: Record<string, number>, game: Record<string, unknown>) => {
        acc[game.platform as string] = (acc[game.platform as string] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      addDebugResult(`🎯 Games by platform: ${JSON.stringify(platforms)}`);

      // Show recent games
      const recentGames = games.slice(-10).map((g: Record<string, unknown>) => g.title);
      addDebugResult(`📋 Last 10 games: ${recentGames.join(', ')}`);
      
    } catch (error: unknown) {
      addDebugResult(`❌ Search error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-red-900/10 to-orange-900/10 border border-red-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-400">
          <Bug className="h-5 w-5" />
          Debug Panel - Game Library Tools
          <Badge variant="outline" className="text-red-300 border-red-400/50">
            Developer Tools
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={testRawSteamAPI}
            disabled={isLoading}
            variant="outline"
            className="border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
          >
            <Search className="mr-2 h-4 w-4" />
            Test Raw Steam API
          </Button>
          
          <Button
            onClick={testForceRefresh}
            disabled={isLoading}
            variant="outline"
            className="border-orange-500/50 text-orange-300 hover:bg-orange-500/10"
          >
            <Zap className="mr-2 h-4 w-4" />
            Test Force Refresh
          </Button>
          
          <Button
            onClick={testGameSearch}
            disabled={isLoading}
            variant="outline"
            className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
          >
            <Search className="mr-2 h-4 w-4" />
            Analyze Library
          </Button>
          
          <Button
            onClick={clearResults}
            variant="outline"
            className="border-gray-500/50 text-gray-300 hover:bg-gray-500/10"
          >
            Clear
          </Button>
        </div>

        {/* Results */}
        <div className="bg-black/30 rounded-lg p-4 max-h-96 overflow-y-auto">
          <div className="text-sm font-mono space-y-1">
            {debugResults.length > 0 ? (
              debugResults.map((result, index) => (
                <div key={index} className="text-gray-300">
                  {result}
                </div>
              ))
            ) : (
              <div className="text-gray-500 italic">
                Click a debug button to start testing...
              </div>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="text-center text-orange-400">
            🔄 Running debug test...
          </div>
        )}
      </CardContent>
    </Card>
  );
}


