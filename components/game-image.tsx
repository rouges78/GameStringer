'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Gamepad2 } from 'lucide-react';
import IntelligentPlaceholder from './intelligent-placeholder';

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
}

const GameImage: React.FC<GameImageProps> = ({ src, alt, fallbackSrc, className, gameName, store, genre, engine, priority = false }) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(priority); // Se priority, carica subito
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [src]);

  const handleError = () => {
    if (currentSrc === fallbackSrc || !fallbackSrc) {
      setHasError(true);
    } else {
      setCurrentSrc(fallbackSrc);
    }
  };

  // Placeholder mentre non visibile
  if (!isVisible) {
    return (
      <div ref={containerRef} className="w-full h-full bg-muted/50 animate-pulse" />
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
    <Image
      src={currentSrc}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className={className || "object-cover group-hover:scale-105 transition-transform duration-300"}
      onError={handleError}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
    />
  );
};

export default GameImage;



