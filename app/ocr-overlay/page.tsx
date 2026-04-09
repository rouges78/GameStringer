'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [fadeState, setFadeState] = useState<'in' | 'out' | 'visible'>('in');
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unlistenTranslation = listen<TranslatedText[]>('ocr-translations', (event) => {
      setTexts(event.payload);
      setFadeState('in');

      // Auto-hide after 8s if no new text arrives
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
      if (event.payload.length > 0) {
        autoHideTimer.current = setTimeout(() => {
          setFadeState('out');
        }, 8000);
      }
    });

    const unlistenVisibility = listen<boolean>('overlay-visibility', (event) => {
      setIsVisible(event.payload);
    });

    return () => {
      unlistenTranslation.then(fn => fn());
      unlistenVisibility.then(fn => fn());
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden bg-transparent">
      {texts.map((text, index) => {
        // Adaptive font size based on bounding box height
        const boxHeight = text.height || 24;
        const fontSize = Math.max(11, Math.min(20, Math.round(boxHeight * 0.6)));

        return (
          <div
            key={`${text.x}-${text.y}-${index}`}
            className="absolute pointer-events-auto"
            style={{
              left: text.x,
              top: text.y,
              maxWidth: Math.max(text.width, 200),
              animation: fadeState === 'in'
                ? 'overlayFadeIn 0.3s ease-out forwards'
                : fadeState === 'out'
                ? 'overlayFadeOut 0.5s ease-in forwards'
                : undefined,
            }}
          >
            <div
              className="text-white px-3 py-1.5 rounded-md shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(0,0,0,0.88) 0%, rgba(10,10,30,0.92) 100%)',
                borderLeft: '2px solid rgba(0,200,255,0.7)',
                boxShadow: '0 0 12px rgba(0,200,255,0.15), 0 4px 16px rgba(0,0,0,0.5)',
              }}
            >
              <p
                className="text-cyan-400/60 leading-tight"
                style={{ fontSize: Math.max(9, fontSize - 3) }}
              >
                {text.original}
              </p>
              <p
                className="font-semibold leading-tight mt-0.5"
                style={{
                  fontSize,
                  textShadow: '0 0 8px rgba(0,200,255,0.3)',
                }}
              >
                {text.translated}
              </p>
            </div>
          </div>
        );
      })}

      {/* CSS animations */}
      <style>{`
        @keyframes overlayFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes overlayFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}



