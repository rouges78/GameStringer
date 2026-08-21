'use client';

import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { translateWithFallback } from '@/lib/ai/ai-translate-direct';
import { translationBridge } from '@/lib/translation-bridge';
import { useTranslationBridgeDrain } from '@/hooks/use-translation-bridge-drain';

// Riga estratta inoltrata dalla DLL via overlay_ipc (evento "gs-overlay-text").
interface OverlayText {
  type: string;
  original: string;
  translated: string;
}

interface OverlayLine {
  original: string;
  translated: string;
  pending: boolean; // traduzione vera ancora in corso
}

export default function GsOverlayPage() {
  const [line, setLine] = useState<OverlayLine | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0); // guardia contro risposte di traduzione stantie

  // Drena i cache miss che la DLL chiede via pipe e non trova nel dizionario:
  // li traduce e li reinserisce, così dal secondo avvistamento sono hit. Gira
  // finché l'overlay è aperto, cioè finché la traduzione in tempo reale è attiva.
  useTranslationBridgeDrain({ enabled: true, targetLanguage: 'it' });

  useEffect(() => {
    const unlisten = listen<OverlayText>('gs-overlay-text', async (event) => {
      const msg = event.payload;
      const myReq = ++reqId.current;

      // La DLL traduce solo da cache: se ha già una traduzione (≠ originale)
      // usala subito; altrimenti mostra l'originale e traduci con lo stack app.
      const dllTranslated = msg.translated && msg.translated !== msg.original;
      setLine({
        original: msg.original,
        translated: dllTranslated ? msg.translated : msg.original,
        pending: !dllTranslated,
      });
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), 8000);

      if (dllTranslated) return; // niente da tradurre, già pronto

      // Traduzione vera (provider configurati + fallback gratuiti senza chiave).
      try {
        const res = await translateWithFallback(
          {
            texts: [msg.original],
            targetLanguage: 'it',
            sourceLanguage: 'auto',
          },
          true, // preferWebApis: provider gratuiti senza chiave (overlay affidabile)
        );
        if (myReq !== reqId.current) return; // arrivata una riga più recente
        const t = res.success && res.translations[0] ? res.translations[0] : msg.original;
        setLine({ original: msg.original, translated: t, pending: false });

        // Restituisci la traduzione al dizionario del bridge: senza questo
        // ritradurremmo la stessa riga a ogni sua comparsa, e la DLL non
        // imparerebbe mai. Dal prossimo avvistamento è un hit via IPC.
        if (t !== msg.original) {
          void translationBridge.addTranslation(msg.original, t);
        }
      } catch {
        if (myReq !== reqId.current) return;
        setLine({ original: msg.original, translated: msg.original, pending: false });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible || !line) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden bg-transparent flex items-end justify-center pb-16">
      <div
        className="pointer-events-auto max-w-3xl mx-4 px-5 py-3 rounded-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(8,12,24,0.92) 0%, rgba(12,20,40,0.94) 100%)',
          borderLeft: '3px solid rgba(56,189,248,0.8)', // sky-400
          boxShadow: '0 0 16px rgba(56,189,248,0.18), 0 6px 24px rgba(0,0,0,0.55)',
          animation: 'gsOverlayIn 0.25s ease-out forwards',
        }}
      >
        <p className="text-sky-400/60 text-sm leading-snug">{line.original}</p>
        <p
          className={`font-semibold text-xl leading-snug mt-1 ${
            line.pending ? 'text-white/50 italic' : 'text-white'
          }`}
          style={{ textShadow: line.pending ? undefined : '0 0 10px rgba(56,189,248,0.35)' }}
        >
          {line.translated}
        </p>
      </div>

      <style>{`
        @keyframes gsOverlayIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
