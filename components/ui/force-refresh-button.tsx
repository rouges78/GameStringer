'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Zap } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { motion } from 'framer-motion';

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
          supported_languages: ['Inglese', 'Italiano'],
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
      alert('Errore durante il refresh dei giochi. Controlla la console per dettagli.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      <Button
        onClick={handleForceRefresh}
        disabled={isRefreshing}
        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        {isRefreshing ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Aggiornamento...
          </>
        ) : (
          <>
            <Zap className="mr-2 h-4 w-4" />
            Force Refresh
          </>
        )}
      </Button>
    </motion.div>
  );
}