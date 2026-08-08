'use client';

import { useEffect, useState } from 'react';
import { hydrateSettingsFromDisk, persistSettingsToDisk } from '@/lib/settings-persistence';
import { hydrateProjectsFromDisk, persistProjectsToDisk } from '@/lib/projects-persistence';
import { installGlobalCrashHandlers } from '@/lib/crash-reporter';

/**
 * Idrata le impostazioni dal disco PRIMA di montare il resto dell'app, così
 * tutti i lettori di `localStorage['gameStringerSettings']` vedono i dati
 * persistiti (API key, lingua, ecc.). Flusha su disco quando la finestra
 * perde il focus o viene chiusa, e quando le impostazioni cambiano.
 *
 * Fallback di sicurezza: se l'hydration non completa entro il timeout, monta
 * comunque l'app per non bloccare l'avvio.
 */
export function SettingsBootGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };

    // Timeout di sicurezza: non bloccare mai l'avvio oltre 1.5s.
    const timer = setTimeout(finish, 1500);

    // Crash reporting (opt-in): gli handler si installano sempre, il gate
    // sulle impostazioni privacy viene ricontrollato a ogni report.
    installGlobalCrashHandlers();

    // Impostazioni e progetti si idratano in parallelo: entrambi per-origine
    // in web-storage, entrambi con la copia su disco come fonte di verità
    // ([storage-per-origine]; i progetti dal 07/08/2026).
    Promise.allSettled([hydrateSettingsFromDisk(), hydrateProjectsFromDisk()]).then(() => {
      clearTimeout(timer);
      finish();
    });

    // Flush su disco quando l'app perde focus / viene chiusa.
    const flush = () => { void persistSettingsToDisk(); void persistProjectsToDisk(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };

    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    // La settings page emette questo evento al salvataggio.
    window.addEventListener('gs-display-changed', flush);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('gs-display-changed', flush);
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
