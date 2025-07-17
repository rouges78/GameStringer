'use client';

import React, { useState } from 'react';
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
}

const GameImage: React.FC<GameImageProps> = ({ src, alt, fallbackSrc, className, gameName, store, genre, engine }) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    // If we already tried the fallback and it also failed, or if there's no fallback
    if (currentSrc === fallbackSrc || !fallbackSrc) {
      setHasError(true);
    } else {
      // Switch to fallback source
      setCurrentSrc(fallbackSrc);
    }
  };

  if (hasError || !currentSrc) {
    // Se abbiamo informazioni sul gioco, usa il placeholder intelligente
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
    />
  );
};

export default GameImage;
