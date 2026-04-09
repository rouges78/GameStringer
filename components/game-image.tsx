'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';
import IntelligentPlaceholder from './intelligent-placeholder';
import { clientLogger } from '@/lib/client-logger';

interface GameImageProps {
  src: string;
  alt: string;
  fallbackSrc?: string | null;
  className?: string;
  gameName?: string;
  store?: string;
  genre?: string;
  engine?: string;
  priority?: boolean; // Per immagini above-the-fold
  appId?: string; // Per cercare su SteamGridDB
}

const GameImage: React.FC<GameImageProps> = ({ src, alt, fallbackSrc, className, gameName, store, genre, engine, priority = false, appId }) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(priority); // Se priority, carica subito
  const [triedSteamGridDb, setTriedSteamGridDb] = useState(false);
  const [isLoadingSteamGridDb, setIsLoadingSteamGridDb] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debug: log quando src è vuoto o mancante
  useEffect(() => {
    if (!src || src === '') {
      clientLogger.debug(`[GameImage] ⚠️ Empty src for ${gameName} (appId: ${appId}), fallback: ${fallbackSrc?.substring(0, 40) || 'none'}`);
    }
  }, [src, gameName, appId, fallbackSrc]);

  // Lazy loading con IntersectionObserver
  useEffect(() => {
    if (priority || isVisible) return; // Skip se già visibile o priority
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Preload 100px prima che entri in viewport
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isVisible]);

  // Reset quando cambia src
  useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
    setTriedSteamGridDb(false);
  }, [src]);

  // Pre-check: verifica se l'immagine Steam esiste, altrimenti cerca su SteamGridDB
  useEffect(() => {
    if (!isVisible || triedSteamGridDb || !appId || !gameName) return;
    if (!currentSrc || currentSrc === '') {
      clientLogger.debug(`[GameImage] 🔍 No src, fetching SteamGridDB for ${gameName}`);
      fetchSteamGridDbImage();
      return;
    }
    
    // Pre-check immagine Steam con un Image object
    const img = new Image();
    img.onload = () => {
      // Immagine caricata correttamente, niente da fare
    };
    img.onerror = () => {
      clientLogger.debug(`[GameImage] 🔍 Image failed to load for ${gameName}, trying SteamGridDB`);
      if (!triedSteamGridDb) {
        fetchSteamGridDbImage();
      }
    };
    img.src = currentSrc;
  }, [currentSrc, triedSteamGridDb, appId, gameName, isVisible]);

  const fetchSteamGridDbImage = async () => {
    if (triedSteamGridDb) return;
    setTriedSteamGridDb(true);
    setIsLoadingSteamGridDb(true);
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Prova prima dalla cache
      const cached = await invoke<string | null>('get_cover_cache', { gameId: appId });
      if (cached) {
        setCurrentSrc(cached);
        setIsLoadingSteamGridDb(false);
        return;
      }
      
      // Cerca API key in gamestringer_utility_prefs (dove viene salvata dalla pagina stores)
      let apiKey = null;
      const utilityPrefs = localStorage.getItem('gamestringer_utility_prefs');
      if (utilityPrefs) {
        try {
          const prefs = JSON.parse(utilityPrefs);
          apiKey = prefs?.steamgriddb?.apiKey || null;
        } catch (e: unknown) {}
      }
      
      const result = await invoke<string | null>('fetch_steamgriddb_image', {
        appId: parseInt(appId!) || 0,
        gameName: gameName,
        apiKey: apiKey
      });
      
      if (result) {
        setCurrentSrc(result);
        // Salva in cache
        await invoke('save_cover_cache', { gameId: appId, imageUrl: result });
      } else {
        setHasError(true);
      }
    } catch (e: unknown) {
      clientLogger.warn('[GameImage] SteamGridDB fallback failed:', e);
      setHasError(true);
    } finally {
      setIsLoadingSteamGridDb(false);
    }
  };

  const handleError = async () => {
    clientLogger.debug(`[GameImage] onError triggered for ${gameName} (appId: ${appId}), currentSrc: ${currentSrc?.substring(0, 50)}...`);
    
    // Prima prova il fallback locale
    if (currentSrc !== fallbackSrc && fallbackSrc) {
      clientLogger.debug(`[GameImage] Trying fallback for ${gameName}: ${fallbackSrc?.substring(0, 50)}...`);
      setCurrentSrc(fallbackSrc);
      return;
    }
    
    // Poi prova SteamGridDB
    if (!triedSteamGridDb && appId && gameName) {
      clientLogger.debug(`[GameImage] Trying SteamGridDB for ${gameName} (appId: ${appId})`);
      await fetchSteamGridDbImage();
    } else {
      clientLogger.debug(`[GameImage] No more fallbacks for ${gameName}, showing placeholder`);
      setHasError(true);
    }
  };

  // Placeholder mentre non visibile
  if (!isVisible) {
    return (
      <div ref={containerRef} className="w-full h-full bg-muted/50 animate-pulse" />
    );
  }

  // Mostra loading mentre cerca su SteamGridDB
  if (isLoadingSteamGridDb || (!currentSrc && !triedSteamGridDb && appId && gameName)) {
    return (
      <div className="w-full h-full bg-muted/50 animate-pulse flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (hasError || !currentSrc) {
    // Se abbiamo informazioni sul game, usa il placeholder intelligente
    if (gameName) {
      return (
        <IntelligentPlaceholder
          gameName={gameName}
          store={store}
          genre={genre}
          engine={engine}
          className={className}
        />
      );
    }
    
    // Fallback al placeholder semplice
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Gamepad2 className="w-12 h-12 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={`absolute inset-0 w-full h-full ${className || "object-cover group-hover:scale-105 transition-transform duration-300"}`}
      onError={handleError}
      loading={priority ? "eager" : "lazy"}
    />
  );
};

export default GameImage;



