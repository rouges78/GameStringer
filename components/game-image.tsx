'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Gamepad2 } from 'lucide-react';

interface GameImageProps {
  src: string;
  alt: string;
  fallbackSrc?: string | null;
  className?: string;
}

const GameImage: React.FC<GameImageProps> = ({ src, alt, fallbackSrc, className }) => {
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
