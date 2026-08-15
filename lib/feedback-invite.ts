/**
 * Invito one-time a lasciare un feedback dopo la prima traduzione conclusa.
 *
 * Contesto (30/07/2026): la tabella `feedback` era a zero righe non perché il
 * canale fosse rotto — grant e policy RLS sono corretti — ma perché il widget
 * esisteva solo dentro le Impostazioni. Chi finisce una traduzione è nel
 * momento in cui ha qualcosa da dire: questo è il secondo punto d'ingresso,
 * accanto alla voce di sidebar.
 *
 * Regole: una sola volta nella vita dell'utente, e mai insieme al toast di
 * opt-in della telemetria di compatibilità (che occupa già lo stesso momento).
 */

import { tStatic } from '@/lib/i18n/t-static';
import { openFeedback } from '@/lib/feedback-bus';

const INVITE_KEY = 'gs-feedback-invite-prompted';

/**
 * Propone il feedback una sola volta, dopo una traduzione conclusa.
 *
 * A differenza dell'opt-in telemetria, il flag viene scritto SOLO quando il
 * toast è stato realmente creato: se `sonner` non si carica, l'occasione non
 * viene bruciata in silenzio e l'invito potrà ripresentarsi al run successivo.
 */
export function maybeInviteFeedbackAfterRun(): void {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(INVITE_KEY)) return;

    void import('sonner')
      .then(({ toast }) => {
        // Il flag si scrive qui: prima di questo punto nulla è stato mostrato.
        localStorage.setItem(INVITE_KEY, String(Date.now()));
        toast(tStatic('feedback.inviteTitle'), {
          description: tStatic('feedback.inviteDesc'),
          duration: 20_000,
          action: {
            label: tStatic('feedback.inviteAccept'),
            onClick: () => openFeedback('post-run'),
          },
          cancel: {
            label: tStatic('feedback.inviteDecline'),
            onClick: () => {
              /* mai più riproposto */
            },
          },
        });
      })
      .catch(() => {
        /* fail-open: nessun flag scritto, si riproverà al prossimo run */
      });
  } catch {
    /* fail-open: il feedback non deve mai disturbare una traduzione */
  }
}
