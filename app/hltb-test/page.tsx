'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface GameTimeInfo {
  game_title: string;
  hltb_title: string;
  image_url: string;
  main_story: string;
  main_extra: string;
  completionist: string;
  main_story_hours: number;
  main_extra_hours: number;
  completionist_hours: number;
  similarity_score: number;
  cached_at: number;
}

interface HLTBSearchResult {
  query: string;
  games_found: GameTimeInfo[];
  best_match?: GameTimeInfo;
  search_duration_ms: number;
  cached: boolean;
}

interface HLTBStatistics {
  total_searches: number;
  cached_searches: number;
  successful_searches: number;
  average_search_time_ms: number;
  cache_hit_rate: number;
  total_games_in_cache: number;
  longest_game_title: string;
  longest_game_hours: number;
  shortest_game_title: string;
  shortest_game_hours: number;
}

export default function HLTBTestPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<HLTBSearchResult | null>(null);
  const [statistics, setStatistics] = useState<HLTBStatistics | null>(null);
  const [batchResults, setBatchResults] = useState<HLTBSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Giochi di esempio per test batch
  const exampleGames = [
    'Elden Ring',
    'The Witcher 3',
    'Cyberpunk 2077',
    'Red Dead Redemption 2',
    'God of War'
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Ricerca HowLongToBeat per:', searchQuery);
      const result = await invoke<HLTBSearchResult>('search_game_hltb', { 
        game_title: searchQuery 
      });
      console.log('✅ Risultato ricerca HLTB:', result);
      setSearchResult(result);
    } catch (err) {
      console.error('❌ Errore ricerca HLTB:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleGetStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📊 Recupero statistiche HLTB...');
      const stats = await invoke<HLTBStatistics>('get_hltb_statistics');
      console.log('✅ Statistiche HLTB:', stats);
      setStatistics(stats);
    } catch (err) {
      console.error('❌ Errore statistiche HLTB:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Ricerca batch HLTB per:', exampleGames);
      const results = await invoke<HLTBSearchResult[]>('search_games_batch_hltb', { 
        game_titles: exampleGames 
      });
      console.log('✅ Risultati batch HLTB:', results);
      setBatchResults(results);
    } catch (err) {
      console.error('❌ Errore ricerca batch HLTB:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupCache = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🧹 Pulizia cache HLTB...');
      const message = await invoke<string>('cleanup_hltb_cache');
      console.log('✅ Cache pulita:', message);
      alert(message);
    } catch (err) {
      console.error('❌ Errore pulizia cache HLTB:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours: number): string => {
    if (hours === 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getSimilarityColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    if (score >= 0.4) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSimilarityBadge = (score: number): string => {
    if (score >= 0.8) return 'Ottima';
    if (score >= 0.6) return 'Buona';
    if (score >= 0.4) return 'Media';
    return 'Bassa';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            ⏱️ HowLongToBeat Integration
          </h1>
          <p className="text-gray-300 text-lg">
            Sistema di statistiche tempi di completamento giochi
          </p>
        </div>

        {/* Search Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Inserisci nome del gioco..."
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                disabled={loading || !searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                {loading ? '🔄 Ricerca...' : '🔍 Cerca'}
              </button>
              <button
                onClick={handleGetStatistics}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                📊 Statistiche
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleBatchSearch}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              🔍 Test Batch
            </button>
            <button
              onClick={handleCleanupCache}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              🧹 Pulisci Cache
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

        {/* Search Result */}
        {searchResult && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">
                🎮 Risultati per: "{searchResult.query}"
              </h2>
              <div className="flex gap-2 items-center text-sm">
                <span className={`px-2 py-1 rounded ${searchResult.cached ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
                  {searchResult.cached ? '💾 Cache' : '🌐 Live'}
                </span>
                <span className="text-gray-400">
                  {searchResult.search_duration_ms}ms
                </span>
              </div>
            </div>

            {/* Best Match */}
            {searchResult.best_match && (
              <div className="bg-gradient-to-r from-blue-900 to-purple-900 p-4 rounded-lg mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">🏆 Migliore Corrispondenza</h3>
                <div className="flex gap-4">
                  {searchResult.best_match.image_url && (
                    <img 
                      src={searchResult.best_match.image_url} 
                      alt={searchResult.best_match.hltb_title}
                      className="w-20 h-20 object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-white text-lg">{searchResult.best_match.hltb_title}</h4>
                    <div className="flex gap-2 items-center mb-2">
                      <span className="text-gray-400">Similarità:</span>
                      <span className={`font-semibold ${getSimilarityColor(searchResult.best_match.similarity_score)}`}>
                        {(searchResult.best_match.similarity_score * 100).toFixed(1)}% ({getSimilarityBadge(searchResult.best_match.similarity_score)})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="bg-gray-700 p-3 rounded">
                        <div className="text-gray-400">Storia Principale</div>
                        <div className="text-white font-bold">{searchResult.best_match.main_story}</div>
                        <div className="text-gray-400 text-xs">{formatHours(searchResult.best_match.main_story_hours)}</div>
                      </div>
                      <div className="bg-gray-700 p-3 rounded">
                        <div className="text-gray-400">Main + Extra</div>
                        <div className="text-white font-bold">{searchResult.best_match.main_extra}</div>
                        <div className="text-gray-400 text-xs">{formatHours(searchResult.best_match.main_extra_hours)}</div>
                      </div>
                      <div className="bg-gray-700 p-3 rounded">
                        <div className="text-gray-400">Completionist</div>
                        <div className="text-white font-bold">{searchResult.best_match.completionist}</div>
                        <div className="text-gray-400 text-xs">{formatHours(searchResult.best_match.completionist_hours)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* All Results */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                📋 Tutti i Risultati ({searchResult.games_found.length})
              </h3>
              <div className="grid gap-4">
                {searchResult.games_found.map((game, index) => (
                  <div key={index} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex gap-4">
                      {game.image_url && (
                        <img 
                          src={game.image_url} 
                          alt={game.hltb_title}
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-white">{game.hltb_title}</h4>
                          <span className={`text-sm font-semibold ${getSimilarityColor(game.similarity_score)}`}>
                            {(game.similarity_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-gray-400">Main:</span>
                            <span className="text-white ml-1">{game.main_story}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Extra:</span>
                            <span className="text-white ml-1">{game.main_extra}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">100%:</span>
                            <span className="text-white ml-1">{game.completionist}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Statistics */}
        {statistics && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">📊 Statistiche HowLongToBeat</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Search Stats */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">🔍 Ricerche</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Totali:</span>
                    <span className="text-white">{statistics.total_searches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Da Cache:</span>
                    <span className="text-green-400">{statistics.cached_searches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Riuscite:</span>
                    <span className="text-blue-400">{statistics.successful_searches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Hit Rate:</span>
                    <span className="text-purple-400">{statistics.cache_hit_rate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Performance Stats */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">⚡ Performance</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tempo Medio:</span>
                    <span className="text-white">{statistics.average_search_time_ms.toFixed(0)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cache Size:</span>
                    <span className="text-yellow-400">{statistics.total_games_in_cache}</span>
                  </div>
                </div>
              </div>

              {/* Game Records */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">🏆 Record</h3>
                <div className="space-y-2 text-sm">
                  {statistics.longest_game_title && (
                    <div>
                      <span className="text-gray-400">Più Lungo:</span>
                      <div className="text-white font-semibold">{statistics.longest_game_title}</div>
                      <div className="text-green-400">{formatHours(statistics.longest_game_hours)}</div>
                    </div>
                  )}
                  {statistics.shortest_game_title && statistics.shortest_game_hours < 1000 && (
                    <div>
                      <span className="text-gray-400">Più Corto:</span>
                      <div className="text-white font-semibold">{statistics.shortest_game_title}</div>
                      <div className="text-blue-400">{formatHours(statistics.shortest_game_hours)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Batch Results */}
        {batchResults.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              🔍 Risultati Ricerca Batch ({batchResults.length})
            </h2>
            
            <div className="grid gap-4">
              {batchResults.map((result, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-white">{result.query}</h3>
                    <div className="flex gap-2 items-center text-sm">
                      <span className={`px-2 py-1 rounded ${result.cached ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
                        {result.cached ? '💾' : '🌐'}
                      </span>
                      <span className="text-gray-400">{result.search_duration_ms}ms</span>
                    </div>
                  </div>
                  
                  {result.best_match ? (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Trovato:</span>
                        <div className="text-white font-semibold">{result.best_match.hltb_title}</div>
                        <div className={`text-xs ${getSimilarityColor(result.best_match.similarity_score)}`}>
                          {(result.best_match.similarity_score * 100).toFixed(1)}% match
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400">Main Story:</span>
                        <div className="text-white">{result.best_match.main_story}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Completionist:</span>
                        <div className="text-white">{result.best_match.completionist}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">Nessun risultato trovato</div>
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
