'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface TranslatedText {
  original: string;
  translated: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function OcrOverlayPage() {
  const [texts, setTexts] = useState<TranslatedText[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Ascolta eventi di traduzione dalla finestra principale
    const unlistenTranslation = listen<TranslatedText[]>('ocr-translations', (event) => {
      setTexts(event.payload);
    });

    const unlistenVisibility = listen<boolean>('overlay-visibility', (event) => {
      setIsVisible(event.payload);
    });

    return () => {
      unlistenTranslation.then(fn => fn());
      unlistenVisibility.then(fn => fn());
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden bg-transparent">
      {texts.map((text, index) => (
        <div
          key={index}
          className="absolute pointer-events-auto"
          style={{
            left: text.x,
            top: text.y,
            maxWidth: text.width || 300,
          }}
        >
          <div className="bg-black/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg border border-cyan-500/50">
            <p className="text-xs text-cyan-400 mb-1 opacity-70">{text.original}</p>
            <p className="text-sm font-medium">{text.translated}</p>
          </div>
        </div>
      ))}
    </div>
  );
}



