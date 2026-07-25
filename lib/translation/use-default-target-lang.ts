'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';

/**
 * Imposta la lingua di DESTINAZIONE predefinita di una schermata di traduzione.
 *
 * Regola del prodotto: **origine inglese, destinazione = la lingua scelta
 * dall'utente**. Prima ogni schermata partiva da `'it'` hardcoded, quindi un
 * utente russo o cinese si trovava l'italiano preselezionato e, se non se ne
 * accorgeva, traduceva i giochi nella lingua sbagliata — è una delle cose che
 * gli utenti hanno segnalato ("prova a tradurre tutto in spagnolo/italiano").
 *
 * Precedenza:
 *   1. `settings.translation.defaultTargetLang`, se l'utente l'ha scelto a mano;
 *   2. altrimenti la lingua dell'interfaccia.
 *
 * Perché un effetto e non `useState(language)`: il provider i18n parte da `en` e
 * legge la lingua vera in un effetto, quindi al primo render `language` non è
 * ancora quella definitiva. Qui reagiamo al momento in cui lo diventa.
 *
 * `smart` si ferma appena l'utente tocca il selettore: `markTouched()` va
 * chiamato dal `onValueChange` se la schermata vuole quella protezione, ma anche
 * senza, l'hook non sovrascrive mai dopo il primo assestamento della lingua.
 */
export function useDefaultTargetLang(setTarget: (lang: string) => void) {
  const { language } = useTranslation();
  const applied = useRef<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    // già applicato per questa lingua: non ricalcolare a ogni render
    if (applied.current === language) return;

    let chosen = language;
    try {
      const raw = localStorage.getItem('gameStringerSettings');
      const saved = raw ? JSON.parse(raw)?.translation?.defaultTargetLang : null;
      if (saved) chosen = saved;
    } catch {
      /* impostazioni illeggibili: resta la lingua dell'interfaccia */
    }
    applied.current = language;
    setTarget(chosen);
  }, [language, setTarget]);

  return {
    /** Da chiamare quando l'utente sceglie a mano: blocca ogni auto-impostazione. */
    markTouched: () => { touched.current = true; },
  };
}
