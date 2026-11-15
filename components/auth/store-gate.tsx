'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Store as StoreIcon, Lock, Plug } from 'lucide-react';
import { hasAnyStoreConnected } from '@/lib/auth/auth';
import { invoke } from '@/lib/tauri-api';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';

interface StoreGateProps {
  children: React.ReactNode;
}

// Cache globale: sopravvive a HMR / doppio mount React 18.
// Evita di rieseguire la detection locale (Xbox/Amazon) a ogni navigazione.
interface StoreGateCache {
  localDetected: boolean | null;
}
const _g = globalThis as unknown as Record<string, unknown>;
if (!_g.__gsStoreGateCache) {
  _g.__gsStoreGateCache = { localDetected: null };
}
const _gateCache = _g.__gsStoreGateCache as StoreGateCache;

/**
 * Blocca le funzioni store-dipendenti finché l'utente non ha collegato
 * almeno uno store (o non ne ha uno rilevato localmente: Xbox / Amazon).
 *
 * Mostra una schermata piena con messaggio e pulsante verso /stores.
 * Regola di progetto: blocco rigido, non bypassabile.
 */
export function StoreGate({ children }: StoreGateProps) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const evaluate = async () => {
      // 1) Store collegati esplicitamente (credenziali nel profilo) — sincrono.
      if (hasAnyStoreConnected()) {
        if (!cancelled) { setHasAccess(true); setChecking(false); }
        return;
      }

      // 2) Detection locale Xbox/Amazon (cache se già fatta).
      if (_gateCache.localDetected === true) {
        if (!cancelled) { setHasAccess(true); setChecking(false); }
        return;
      }
      if (_gateCache.localDetected === null) {
        try {
          const [xbox, amazon] = await Promise.all([
            invoke<boolean>('is_xbox_installed').catch(() => false),
            invoke<boolean>('is_amazon_games_installed').catch(() => false),
          ]);
          _gateCache.localDetected = Boolean(xbox || amazon);
        } catch (e) {
          clientLogger.debug(`[StoreGate] detection locale fallita: ${String(e)}`);
          _gateCache.localDetected = false;
        }
      }

      if (!cancelled) {
        setHasAccess(_gateCache.localDetected === true);
        setChecking(false);
      }
    };

    evaluate();
    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Schermata di blocco a tutto schermo (palette Risorse: orange/amber).
  return (
    <div className="flex items-center justify-center min-h-[70vh] p-6 animate-fade-in">
      <div className="max-w-md w-full text-center space-y-5 rounded-2xl border border-orange-500/30 bg-noir-900/60 p-8">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-600 via-amber-500 to-yellow-500 flex items-center justify-center">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">
            {t('storeGate.title')}
          </h1>
          <p className="text-sm text-noir-300">
            {t('storeGate.description')}
          </p>
        </div>
        <Link
          href="/stores"
          className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-gradient-to-r from-orange-600 to-amber-500 text-white font-semibold hover:from-orange-500 hover:to-amber-400 transition-colors"
        >
          <Plug className="h-4 w-4" />
          {t('storeGate.connectButton')}
        </Link>
        <p className="text-xs text-noir-500 flex items-center justify-center gap-1.5">
          <StoreIcon className="h-3.5 w-3.5" />
          {t('storeGate.hint')}
        </p>
      </div>
    </div>
  );
}

export default StoreGate;
