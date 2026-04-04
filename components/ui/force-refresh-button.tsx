'use client';

import React, { useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';

interface ForceRefreshButtonProps {
  onRefreshComplete?: (games: unknown[]) => void;
  className?: string;
}

export function ForceRefreshButton({ onRefreshComplete, className }: ForceRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleForceRefresh = async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Starting force refresh...');
      
      try {
        // Try prima con Tauri force refresh
        const freshGames = await invoke('force_refresh_all_games');
        console.log('✅ Force refresh completed con Tauri:', freshGames);
        
        if (onRefreshComplete) {
          onRefreshComplete(freshGames as unknown[]);
        }
      } catch (tauriError) {
        console.error('❌ Force refresh Tauri failed:', tauriError);
        // In Tauri non abbiamo API routes come fallback
        // Mostra errore e suggerisci riavvio
        throw new Error('Refresh fallito. Riavvia l\'app e riprova.');
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
      className={`text-2xs px-2 py-1 bg-orange-600/80 hover:bg-orange-500 text-white rounded transition-colors disabled:opacity-50 ${className || ''}`}
    >
      {isRefreshing ? (
        <>
          <RefreshCw className="inline-block mr-1 h-3 w-3 animate-spin" />
          ...
        </>
      ) : (
        <>
          <Zap className="inline-block mr-1 h-3 w-3" />
          Refresh
        </>
      )}
    </button>
  );
}


