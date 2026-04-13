'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Languages, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { invoke } from '@tauri-apps/api/core';
import { clientLogger } from '@/lib/client-logger';

interface FeaturedGameWidgetProps {
  collapsed?: boolean;
}

interface GameInfo {
  name: string;
  cover?: string;
  appid?: number;
  reason?: string;
}

interface UserGame {
  appid: number;
  name: string;
  cover: string;
}

// Mapping lingua UI -> nome Steam
const STEAM_LANG_MAP: Record<string, string[]> = {
  it: ['italian', 'italiano'],
  en: ['english', 'inglese'],
  fr: ['french', 'francese', 'français'],
  de: ['german', 'tedesco', 'deutsch'],
  es: ['spanish', 'spagnolo', 'español'],
};

// Nomi lingue per il messaggio "Manca X"
const LANG_NAMES: Record<string, Record<string, string>> = {
  it: { it: 'italiano', en: 'Italian', es: 'italiano', fr: 'italien', de: 'Italienisch' },
  en: { it: 'inglese', en: 'English', es: 'inglés', fr: 'anglais', de: 'Englisch' },
  fr: { it: 'francese', en: 'French', es: 'francés', fr: 'français', de: 'Französisch' },
  de: { it: 'tedesco', en: 'German', es: 'alemán', fr: 'allemand', de: 'Deutsch' },
  es: { it: 'spagnolo', en: 'Spanish', es: 'español', fr: 'espagnol', de: 'Spanisch' },
};

// Controlla se il gioco ha la lingua target
function gameHasLanguage(supportedLangs: string, targetLang: string): boolean {
  if (!supportedLangs) return true; // Se non abbiamo info, assumiamo che ce l'abbia
  const langsLower = supportedLangs.toLowerCase();
  const steamNames = STEAM_LANG_MAP[targetLang] || [targetLang];
  return steamNames.some(name => langsLower.includes(name));
}

export function FeaturedGameWidget({ collapsed = false }: FeaturedGameWidgetProps) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gamesWithoutLang, setGamesWithoutLang] = useState<UserGame[]>([]);
  const [game, setGame] = useState<GameInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [needsMarquee, setNeedsMarquee] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleGameClick = () => {
    if (game?.appid) {
      router.push(`/library/?id=steam_${game.appid}`);
    }
  };

  // Carica giochi dalla libreria utente - prioritizza giochi recenti
  useEffect(() => {
    const loadUserGames = async () => {
      setIsLoading(true);
      try {
        // Prova più metodi per ottenere i giochi
        let games: unknown[] = [];
        
        try {
          const result = await invoke<unknown>('scan_steam_with_steamlocate');
          games = result?.games || result?.installed_games || result || [];
        } catch {
          // Fallback: prova get_steam_games
          try {
            games = await invoke<unknown[]>('get_steam_games', { apiKey: '', steamId: '', forceRefresh: false }) || [];
          } catch {
            // Fallback: prova get_games
            try {
              games = await invoke<unknown[]>('get_games') || [];
            } catch {
              games = [];
            }
          }
        }
        
        if (!games || games.length === 0) {
          setGamesWithoutLang([]);
          setIsLoading(false);
          return;
        }

        const targetLang = language || 'it';
        const filtered: UserGame[] = [];
        
        // Ordina per: 1) giocati di recente, 2) più ore di gioco, 3) random
        const sorted = [...games].sort((a, b) => {
          const aLastPlayed = a.last_played || a.rtime_last_played || 0;
          const bLastPlayed = b.last_played || b.rtime_last_played || 0;
          const aPlaytime = a.playtime_forever || a.playtime || 0;
          const bPlaytime = b.playtime_forever || b.playtime || 0;
          
          // Prima ordina per data ultimo gioco (più recente = prima)
          if (bLastPlayed !== aLastPlayed) return bLastPlayed - aLastPlayed;
          // Poi per ore di gioco (più ore = prima)
          if (bPlaytime !== aPlaytime) return bPlaytime - aPlaytime;
          // Infine random
          return Math.random() - 0.5;
        }).slice(0, 50); // Controlla top 50 giochi più rilevanti
        
        for (const g of sorted) {
          // Supporta sia formato {id, title} che {appid, name}
          const gameAppId = parseInt(g.id) || g.appid || g.app_id || g.steam_appid;
          const gameName = g.title || g.name;
          if (!gameAppId || gameAppId <= 0) continue;
          
          try {
            const details = await invoke<unknown>('fetch_steam_game_details', { appId: gameAppId });
            if (details && details.supported_languages) {
              const hasLang = gameHasLanguage(details.supported_languages, targetLang);
              if (!hasLang) {
                filtered.push({
                  appid: gameAppId,
                  name: details.name || gameName,
                  cover: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${gameAppId}/header.jpg`,
                });
                if (filtered.length >= 10) break;
              }
            }
          } catch {
            // Ignora errori singoli giochi
          }
        }
        setGamesWithoutLang(filtered);
      } catch (e: unknown) {
        clientLogger.error('[FeaturedGameWidget] Errore:', e);
        setGamesWithoutLang([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserGames();
  }, [language]);

  // Cambia gioco ogni 8 secondi
  useEffect(() => {
    if (gamesWithoutLang.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % gamesWithoutLang.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [gamesWithoutLang]);

  // Aggiorna il gioco visualizzato
  useEffect(() => {
    if (gamesWithoutLang.length === 0) {
      setGame(null);
      return;
    }
    const targetLang = language || 'it';
    const userGame = gamesWithoutLang[currentIndex];
    const langName = LANG_NAMES[targetLang]?.[language] || targetLang;
    
    setImageError(false); // Reset errore immagine quando cambia gioco
    setNeedsMarquee(false); // Reset marquee quando cambia gioco
    setGame({
      name: userGame.name,
      appid: userGame.appid,
      cover: userGame.cover,
      reason: `${t('widget.missing') || 'Manca'} ${langName}`
    });
  }, [currentIndex, gamesWithoutLang, language, t]);

  // Controlla se il titolo è troppo lungo e richiede marquee
  useEffect(() => {
    if (titleRef.current && containerRef.current) {
      const titleWidth = titleRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      setNeedsMarquee(titleWidth > containerWidth);
    }
  }, [game?.name]);

  // Loading state
  if (isLoading) {
    return (
      <div className="px-2 py-2">
        <div className="rounded-lg bg-sky-500/15 border border-sky-500/25 p-2 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 text-sky-400 animate-spin" />
            <span className="text-micro text-sky-300/60">Analisi libreria...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!game || gamesWithoutLang.length === 0) {
    // Mostra widget placeholder se non ci sono giochi da tradurre
    if (collapsed) return null;
    return (
      <div className="px-2 py-3">
        <div className="rounded-2xl bg-slate-900/60 border border-cyan-500/30 p-3 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-cyan-600/80 rounded-lg">
              <Languages className="h-4 w-4 text-white" />
            </div>
            <span className="text-2xs text-white uppercase tracking-wide font-semibold">
              {t('widget.recommendedToTranslate') || 'Da Tradurre'}
            </span>
          </div>
          <p className="text-2xs text-cyan-300/60 text-center py-2">
            {t('widget.allGamesTranslated') || 'Tutti i giochi hanno la lingua!'}
          </p>
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="px-2 py-3">
        <div 
          className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-500/10 border border-sky-500/30 flex items-center justify-center cursor-pointer hover:border-sky-400/50 transition-colors"
          title={game.name}
          onClick={handleGameClick}
        >
          {game.cover && !imageError ? (
            <img 
              src={game.cover} 
              alt={game.name}
              className="w-full h-full object-cover rounded-lg"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-lg font-bold text-cyan-400">
              {game.name?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-3">
      <div className="rounded-2xl bg-slate-900/60 border border-cyan-500/30 p-3 backdrop-blur-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-600/80 rounded-lg">
              <Languages className="h-4 w-4 text-white" />
            </div>
            <span className="text-2xs text-white uppercase tracking-wide font-semibold">
              {t('widget.recommendedToTranslate') || 'Da Tradurre'}
            </span>
          </div>
          {gamesWithoutLang.length > 1 && (
            <span className="text-micro text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded-full font-medium border border-cyan-500/30">
              {currentIndex + 1}/{gamesWithoutLang.length}
            </span>
          )}
        </div>
        
        {/* Game card con frecce navigazione */}
        <div className="flex items-center gap-1">
          {/* Freccia sinistra */}
          {gamesWithoutLang.length > 1 && (
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setCurrentIndex(prev => prev > 0 ? prev - 1 : gamesWithoutLang.length - 1);
              }}
              className="p-0.5 hover:bg-white/10 rounded transition-colors shrink-0"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-white/60" />
            </button>
          )}
          
          {/* Card gioco */}
          <div 
            className="flex-1 flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded-lg p-1 transition-all min-w-0"
            onClick={handleGameClick}
          >
            {/* Cover */}
            <div className="w-10 h-10 rounded-md bg-slate-800 border border-slate-700/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
              {game.cover && !imageError ? (
                <img 
                  src={game.cover} 
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span className="text-lg font-bold text-cyan-400">
                  {game.name?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0 overflow-hidden" ref={containerRef}>
              <div className="overflow-hidden">
                <h4 
                  ref={titleRef}
                  className={`text-[12px] font-semibold text-white leading-tight whitespace-nowrap ${needsMarquee ? 'animate-marquee hover:animate-none' : ''}`}
                >
                  {game.name}
                </h4>
              </div>
              {game.reason && (
                <span className="text-2xs text-cyan-400 font-medium whitespace-nowrap">
                  {game.reason}
                </span>
              )}
            </div>
          </div>
          
          {/* Freccia destra */}
          {gamesWithoutLang.length > 1 && (
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setCurrentIndex(prev => prev < gamesWithoutLang.length - 1 ? prev + 1 : 0);
              }}
              className="p-0.5 hover:bg-white/10 rounded transition-colors shrink-0"
            >
              <ChevronRight className="h-3.5 w-3.5 text-white/60" />
            </button>
          )}
        </div>
        
        {/* Navigazione pallini */}
        {gamesWithoutLang.length > 1 && (
          <div className="flex items-center justify-center gap-1 mt-1.5">
            {gamesWithoutLang.slice(0, 6).map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`w-1 h-1 rounded-full transition-colors ${
                  idx === currentIndex 
                    ? 'bg-cyan-400' 
                    : 'bg-white/20 hover:bg-cyan-400/50'
                }`}
              />
            ))}
            {gamesWithoutLang.length > 6 && (
              <span className="text-2xs text-white/40 ml-0.5">+{gamesWithoutLang.length - 6}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FeaturedGameWidget;
