'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { getNetworkStatus, onNetworkStatusChange, getOfflineQueueLength } from '@/lib/network-resilience';

/**
 * Stato della connessione come voce della barra di stato in basso.
 *
 * Prima era una barra rossa fissa sopra l'header ogni volta che mancava la
 * rete: in un'app che traduce anche offline, l'allarme a tutta larghezza
 * diceva il contrario del vero. Ora è un LED con etichetta; i dettagli
 * (coda, latenza del server) stanno nel tooltip.
 */
export function NetworkStatusChip() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(getNetworkStatus());
  const [queueLength, setQueueLength] = useState(getOfflineQueueLength());

  useEffect(() => {
    const unsub = onNetworkStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    const handleQueueUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.queueLength !== undefined) {
        setQueueLength(detail.queueLength);
      }
    };
    window.addEventListener('gs-offline-queue-update', handleQueueUpdate);

    return () => {
      unsub();
      window.removeEventListener('gs-offline-queue-update', handleQueueUpdate);
    };
  }, []);

  const isOffline = !status.isOnline;
  const isServerDown = status.isOnline && !status.isSupabaseOnline;

  const label = isOffline ? t('statusLine.offline') : isServerDown ? t('statusLine.serverDown') : t('statusLine.online');
  const hint = isOffline
    ? t('statusLine.offlineHint')
    : isServerDown && status.latencyMs !== null
      ? t('statusLine.latency').replace('{ms}', String(status.latencyMs))
      : undefined;

  return (
    <span className="flex items-center gap-1.5 border-r border-border px-3" title={hint}>
      <span
        aria-hidden
        className={cn('h-1.5 w-1.5', isOffline ? 'bg-muted-foreground' : isServerDown ? 'bg-warning' : 'bg-success')}
      />
      <span className={cn(isServerDown && 'text-warning')}>{label}</span>
      {queueLength > 0 && (
        <span className="text-muted-foreground">· {t('statusLine.queued').replace('{n}', String(queueLength))}</span>
      )}
    </span>
  );
}
