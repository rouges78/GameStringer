'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Heart, ExternalLink, Gift, Sparkles, Timer } from 'lucide-react';
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
import { useTranslation } from '@/lib/i18n';

interface DonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
  /**
   * 'gate'   — versione storica: si è raggiunto il limite gratuito e si offre
   *            lo sblocco. Parla di limiti perché un limite c'è davvero.
   * 'thanks' — dopo una traduzione RIUSCITA: si ringrazia e si chiede un
   *            contributo, senza bloccare niente.
   *
   * ⚠️ La distinzione non è estetica. In 'thanks' non esiste nulla da
   * sbloccare, quindi il testo del gate («il limite free è di N stringhe»,
   * «Ho donato — Sblocca traduzioni illimitate») sarebbe una bugia:
   * prometterebbe di rimuovere un ostacolo che non c'è, e chi paga per quello
   * ha pagato per niente. Default 'gate' per non cambiare da solo il
   * comportamento dei chiamanti esistenti.
   */
  mode?: 'gate' | 'thanks';
  /** Stringhe scritte nel gioco dalla patch appena conclusa (solo 'thanks'). */
  stringsJustWritten?: number;
}

const TIMER_SECONDS = 180; // 3 minuti

export function DonationDialog({
  open: isOpen,
  onOpenChange,
  onUnlocked,
  mode = 'gate',
  stringsJustWritten,
}: DonationDialogProps) {
  const { t } = useTranslation();
  const [showThanks, setShowThanks] = useState(false);
  const [linkClicked, setLinkClicked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = getTranslationCount();
  const isThanks = mode === 'thanks';

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
            <h2 className="text-2xl font-bold">{t('donationDialogComp.grazieThankYou')}</h2>
            <p className="text-muted-foreground">
              {t('donationDialogComp.unlimitedTranslationsUnlocked')}
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
            {t('donationDialogComp.supportGameStringer')}
          </DialogTitle>
          <DialogDescription>
            {/* In 'thanks' si dice UN numero vero e nient'altro: le stringhe
                appena entrate nel gioco se il patcher le ha contate, altrimenti
                il totale storico. Nessun accenno a limiti, perché non ce ne
                sono in questo percorso. */}
            {isThanks ? (
              <>
                {t('donationDialogComp.youHaveTranslated')}{' '}
                <strong className="text-foreground">
                  {(stringsJustWritten && stringsJustWritten > 0 ? stringsJustWritten : count).toLocaleString()}
                </strong>{' '}
                {t('donationDialogComp.stringsSuffix')}
              </>
            ) : (
              <>
                {t('donationDialogComp.youHaveTranslated')} <strong className="text-foreground">{count.toLocaleString()}</strong>{' '}
                {t('donationDialogComp.freeStringsLimitIntro')} <strong className="text-foreground">{FREE_LIMIT}</strong>{' '}
                {t('donationDialogComp.stringsSuffix')}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="mb-2">
              {/* Il pitch del gate promette di «sbloccare traduzioni
                  illimitate»: in 'thanks' non c'è nessun lucchetto, quindi
                  quella frase venderebbe qualcosa che l'utente ha già. */}
              {isThanks ? t('donationDialogComp.thanksPitch') : (
                <>
                  {t('donationDialogComp.pitchPart1')} <strong>{t('donationDialogComp.pitchHighlight')}</strong>{' '}
                  {t('donationDialogComp.pitchPart2')}
                </>
              )}
            </p>
            <p className="text-muted-foreground">
              {t('donationDialogComp.evenOneEuroHelps')}
            </p>
          </div>

          <div className="grid gap-2">
            {/* 07/08/2026: rimosso il pulsante Buy Me a Coffee — la pagina
                buymeacoffee.com/gamestringer NON ESISTE (404 verificato):
                un pulsante di donazione che punta nel nulla brucia fiducia.
                Ko-fi (vivo e verificato) promosso a canale primario. */}
            <Button
              variant="default"
              className="w-full bg-[#FF5E5B] hover:bg-[#E54D4A] text-white font-semibold h-11"
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
            {/* In 'thanks' l'intero apparato «clicca, aspetta 3 minuti, dichiara
                di aver donato» non ha senso: serviva a sbloccare il limite, e
                qui non c'è limite. Chi vuole contribuire ha già i due pulsanti
                sopra; a chi non vuole si offre la porta, senza timer. */}
            {isThanks ? (
              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                {t('common.chiudi')}
              </Button>
            ) : !linkClicked ? (
              <p className="text-xs text-center text-muted-foreground py-2">
                {t('donationDialogComp.clickLinkThenUnlock')}
              </p>
            ) : secondsLeft > 0 ? (
              <div className="flex flex-col items-center gap-1 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Timer className="w-4 h-4 animate-pulse" />
                  <span>{t('donationDialogComp.completaLaDonazione')}</span>
                </div>
                <span className="text-xs text-muted-foreground/60">
                  {t('donationDialogComp.unlockAvailableIn')} {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
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
                  {t('donationDialogComp.iDonatedUnlock')}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  {t('donationDialogComp.trustBasedThanks')}
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

