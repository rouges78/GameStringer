'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heart, Coffee, ExternalLink, Gift, Sparkles, Timer } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { unlockSupporter, getTranslationCount, FREE_LIMIT } from '@/lib/donation-gate';

interface DonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
}

const TIMER_SECONDS = 180; // 3 minuti

export function DonationDialog({ open: isOpen, onOpenChange, onUnlocked }: DonationDialogProps) {
  const [showThanks, setShowThanks] = useState(false);
  const [linkClicked, setLinkClicked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = getTranslationCount();

  // Countdown timer
  useEffect(() => {
    if (linkClicked && secondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [linkClicked, secondsLeft > 0]);

  const openUrl = useCallback(async (url: string) => {
    try {
      await open(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    if (!linkClicked) {
      setLinkClicked(true);
      setSecondsLeft(TIMER_SECONDS);
    }
  }, [linkClicked]);

  const handleDonated = () => {
    unlockSupporter();
    setShowThanks(true);
    setTimeout(() => {
      setShowThanks(false);
      onOpenChange(false);
      onUnlocked?.();
    }, 2000);
  };

  if (showThanks) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="flex flex-col items-center gap-4 py-6">
            <Sparkles className="w-16 h-16 text-yellow-400 animate-pulse" />
            <h2 className="text-2xl font-bold">Grazie! / Thank you!</h2>
            <p className="text-muted-foreground">
              Traduzioni illimitate sbloccate!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Heart className="w-6 h-6 text-red-500 fill-red-500" />
            Supporta GameStringer
          </DialogTitle>
          <DialogDescription>
            Hai tradotto <strong className="text-foreground">{count.toLocaleString()}</strong> stringhe gratis!
            Il limite free è di <strong className="text-foreground">{FREE_LIMIT}</strong> stringhe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="mb-2">
              GameStringer è sviluppato da una sola persona con passione.
              Una donazione di qualsiasi importo sblocca <strong>traduzioni illimitate</strong> e
              aiuta a mantenere il progetto vivo.
            </p>
            <p className="text-muted-foreground">
              Anche solo 1€ fa la differenza!
            </p>
          </div>

          <div className="grid gap-2">
            <Button
              variant="default"
              className="w-full bg-[#FFDD00] hover:bg-[#FFCC00] text-black font-semibold h-11"
              onClick={() => openUrl('https://buymeacoffee.com/gamestringer')}
            >
              <Coffee className="w-5 h-5 mr-2" />
              Buy Me a Coffee
              <ExternalLink className="w-4 h-4 ml-auto opacity-50" />
            </Button>

            <Button
              variant="outline"
              className="w-full h-11 border-[#FF5E5B] text-[#FF5E5B] hover:bg-[#FF5E5B]/10"
              onClick={() => openUrl('https://ko-fi.com/gamestringer')}
            >
              <Heart className="w-5 h-5 mr-2" />
              Ko-fi
              <ExternalLink className="w-4 h-4 ml-auto opacity-50" />
            </Button>

            <Button
              variant="outline"
              className="w-full h-11 border-[#EA4AAA] text-[#EA4AAA] hover:bg-[#EA4AAA]/10"
              onClick={() => openUrl('https://github.com/sponsors/rouges78')}
            >
              <Gift className="w-5 h-5 mr-2" />
              GitHub Sponsors
              <ExternalLink className="w-4 h-4 ml-auto opacity-50" />
            </Button>
          </div>

          <div className="border-t pt-4">
            {!linkClicked ? (
              <p className="text-xs text-center text-muted-foreground py-2">
                Clicca uno dei link sopra per donare, poi potrai sbloccare.
              </p>
            ) : secondsLeft > 0 ? (
              <div className="flex flex-col items-center gap-1 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Timer className="w-4 h-4 animate-pulse" />
                  <span>Completa la donazione...</span>
                </div>
                <span className="text-xs text-muted-foreground/60">
                  Sblocco disponibile tra {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </span>
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="w-full text-primary hover:text-primary"
                  onClick={handleDonated}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Ho donato — Sblocca traduzioni illimitate
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  Basato su fiducia. Grazie per il supporto!
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
