'use client';

import { useState, useEffect } from 'react';
import { Gamepad2, Star, Clock, Sparkles, Wand2, ChevronRight, Languages } from 'lucide-react';
import { safeInvoke as invoke } from '@/lib/tauri-wrapper';
import { activityHistory } from '@/lib/activity-history';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

interface FeaturedGameWidgetProps {
  collapsed?: boolean;
}

interface GameInfo {
  name: string;
  cover?: string;
  appid?: number;
  reason?: string;
}

export function FeaturedGameWidget({ collapsed = false }: FeaturedGameWidgetProps) {
  const { t, language } = useTranslation();
  const [game, setGame] = useState<GameInfo | null>(null);

  useEffect(() => {
    loadRecommendedGame();
  }, [language]);

  const loadRecommendedGame = async () => {
    try {
      // Carica giochi dalla libreria
      const games = await invoke('get_games') as any[];
      if (!games || games.length === 0) {
        setGame(null);
        return;
      }

      // Lingua target per traduzione (it, es, de, fr, etc.)
      const targetLang = language === 'en' ? 'it' : language;
      
      // Trova giochi che NON hanno la lingua target
      const gamesNeedingTranslation = games.filter((g: any) => {
        let langs = g.supported_languages || g.languages || '';
        // Se è un array, uniscilo in stringa
        if (Array.isArray(langs)) {
          langs = langs.join(' ');
        }
        // Se non è stringa, converti
        if (typeof langs !== 'string') {
          langs = String(langs);
        }
        const langsLower = langs.toLowerCase();
        
        // Controlla se manca la lingua target
        const langPatterns: Record<string, string[]> = {
          'it': ['italian', 'italiano'],
          'es': ['spanish', 'español', 'castellano'],
          'de': ['german', 'deutsch'],
          'fr': ['french', 'français'],
          'ja': ['japanese', '日本語'],
          'zh': ['chinese', '中文'],
        };
        
        const patterns = langPatterns[targetLang] || [targetLang];
        const hasTargetLang = patterns.some(p => langsLower.includes(p));
        
        // Vogliamo giochi che NON hanno la lingua target ma hanno una cover
        return !hasTargetLang && (g.header_image || g.cover);
      });

      if (gamesNeedingTranslation.length > 0) {
        // Scegli un gioco casuale tra quelli che necessitano traduzione
        const randomIndex = Math.floor(Math.random() * Math.min(gamesNeedingTranslation.length, 20));
        const selectedGame = gamesNeedingTranslation[randomIndex];
        
        setGame({
          name: selectedGame.name || selectedGame.title,
          cover: selectedGame.header_image || selectedGame.cover,
          appid: selectedGame.appid || selectedGame.id,
          reason: t('widget.needsTranslation') || 'Da tradurre'
        });
      } else {
        // Fallback: mostra un gioco qualsiasi
        const gameWithCover = games.find((g: any) => g.header_image || g.cover) || games[0];
        setGame({
          name: gameWithCover.name || gameWithCover.title,
          cover: gameWithCover.header_image || gameWithCover.cover,
          appid: gameWithCover.appid || gameWithCover.id,
          reason: t('widget.inLibrary') || 'In libreria'
        });
      }
    } catch (error) {
      console.error('Error loading recommended game:', error);
      setGame(null);
    }
  };

  if (!game) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="px-2 py-3">
        <div 
          className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 flex items-center justify-center cursor-pointer hover:border-violet-400/50 transition-colors"
          title={game.name}
        >
          {game.cover ? (
            <img 
              src={game.cover} 
              alt={game.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <Gamepad2 className="h-5 w-5 text-violet-400" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <Languages className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] text-emerald-300/70 uppercase tracking-wider font-medium">
            {t('widget.recommendedToTranslate') || 'Da Tradurre'}
          </span>
        </div>
        
        <div className="flex gap-3">
          {/* Cover */}
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-violet-600/30 to-purple-600/20 border border-violet-500/30 flex items-center justify-center overflow-hidden shrink-0">
            {game.cover ? (
              <img 
                src={game.cover} 
                alt={game.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Gamepad2 className="h-6 w-6 text-violet-400" />
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-violet-200 truncate">
              {game.name}
            </h4>
            {game.reason && (
              <div className="flex items-center gap-1 mt-1">
                <Languages className="h-3 w-3 text-violet-400/50" />
                <span className="text-[10px] text-violet-400/70">
                  {game.reason}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

export default FeaturedGameWidget;
