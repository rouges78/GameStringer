'use client';

import React, { useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';

interface ForceRefreshButtonProps {
  onRefreshComplete?: (games: any[]) => void;
  className?: string;
}

export function ForceRefreshButton({ onRefreshComplete, className }: ForceRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleForceRefresh = async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Starting force refresh...');
      
      try {
        // Prova prima con Tauri force refresh
        const freshGames = await invoke('force_refresh_all_games');
        console.log('✅ Force refresh completed con Tauri:', freshGames);
        
        if (onRefreshComplete) {
          onRefreshComplete(freshGames as any[]);
        }
      } catch (tauriError) {
        console.error('❌ Force refresh Tauri failed, trying API fallback:', tauriError);
        
        // Fallback: usa l'API Next.js
        const response = await fetch('/api/library/games');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response non è JSON');
        }
        
        const data = await response.json();
        console.log('✅ Force refresh completed con API fallback:', data);
        
        // Trasforma i dati dell'API nel formato atteso
        const transformedGames = data.games.map((game: any) => ({
          id: game.id,
          app_id: game.id.replace('steam_', ''),
          title: game.name,
          platform: game.provider,
          header_image: game.imageUrl,
          supported_languages: ['English', 'Italian'],
          is_vr: false,
          engine: null,
          is_installed: false,
          genres: ['Action']
        }));
        
        if (onRefreshComplete) {
          onRefreshComplete(transformedGames);
        }
      }
      
      // Small delay per UI feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('❌ Force refresh failed completamente:', error);
      alert('Error refreshing games. Check console for details.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleForceRefresh}
      disabled={isRefreshing}
      className={`text-[10px] px-2 py-1 bg-orange-600/80 hover:bg-orange-500 text-white rounded transition-colors disabled:opacity-50 ${className || ''}`}
    >
      {isRefreshing ? (
        <>
          <RefreshCw className="inline-block mr-1 h-3 w-3 animate-spin" />
          ...
        </>
      ) : (
        <>
          <Zap className="inline-block mr-1 h-3 w-3" />
          Aggiorna
        </>
      )}
    </button>
  );
}