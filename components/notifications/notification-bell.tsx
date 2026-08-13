'use client';

/**
 * Campanella delle notifiche in header.
 *
 * ⛔ PERCHÉ ESISTE — cablaggio del 13/08/2026.
 * Il `NotificationCenter` era montato in `main-layout.tsx` da sempre, ma l'unico
 * modo di aprirlo era una SCORCIATOIA DA TASTIERA (`useNotificationShortcuts`):
 * nessun pulsante, nessun contatore, nessun indizio che esistesse. Un centro
 * notifiche che l'utente non può vedere né raggiungere non è una funzione, è
 * codice acceso a vuoto — lo stesso schema di [estrazione-wad-due-lettori] e
 * [gate-orphan-deps], alla nona comparsa in questo progetto.
 *
 * Questa campanella è la strada dell'UTENTE verso quel centro: un pulsante vero
 * (non un div cliccabile: il gate a11y conta quelli), con il numero delle non
 * lette sopra. `useNotifications` fa già polling ogni 30s e ascolta gli eventi
 * `notification-created`, quindi il badge si aggiorna da solo quando una
 * traduzione lunga finisce mentre l'utente sta su un'altra pagina — che è
 * esattamente il caso d'uso per cui il sottosistema era stato scritto.
 */

import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { useTranslation } from '@/lib/i18n';

interface NotificationBellProps {
  /** Apre il NotificationCenter già montato in MainLayout */
  onOpen: () => void;
}

export function NotificationBell({ onOpen }: NotificationBellProps) {
  const { t } = useTranslation();
  // autoRefresh è già il default (30s), ma lo dichiaro: questo componente vive
  // nell'header di OGNI pagina ed è l'unico posto dove il conteggio si vede.
  const { unreadCount, refreshNotifications } = useNotifications({ autoRefresh: true, enableRealTime: true });

  // Il polling è a 30 secondi: abbastanza per non perdersi nulla, troppo per la
  // prova d'effetto. Una traduzione che finisce emette già `bg-translation-event`
  // (lo stesso che accende la notifica di sistema): agganciandolo, il pallino
  // compare NELLO STESSO ISTANTE in cui la traduzione termina, invece che «entro
  // mezzo minuto». È anche l'unico modo di verificare a occhio che il cablaggio
  // funziona senza stare a guardare l'orologio.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const alTermine = () => { refreshNotifications().catch(() => {}); };
    window.addEventListener('bg-translation-event', alTermine);
    return () => window.removeEventListener('bg-translation-event', alTermine);
  }, [refreshNotifications]);

  const hasUnread = unreadCount > 0;
  // Oltre 99 il numero non ci sta nel pallino e smette di essere informativo.
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onOpen}
      className="relative h-9 w-9 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
      title={t('common.notifications')}
      // Il conteggio va nel nome accessibile, altrimenti chi usa uno screen
      // reader sente "Notifiche" e non sa che ce ne sono di non lette.
      aria-label={
        hasUnread
          ? `${t('common.notifications')} (${badgeLabel})`
          : t('common.notifications')
      }
    >
      <Bell className="h-4 w-4" />
      {hasUnread && (
        <span
          // aria-hidden: il numero è già nell'aria-label del pulsante, qui
          // sarebbe letto due volte.
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none shadow-lg shadow-red-500/30"
        >
          {badgeLabel}
        </span>
      )}
    </Button>
  );
}

export default NotificationBell;
