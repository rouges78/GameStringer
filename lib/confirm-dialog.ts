'use client';

import { clientLogger } from '@/lib/client-logger';

/**
 * Conferma ASINCRONA che funziona nel webview Tauri.
 *
 * PERCHÉ ESISTE. Nel webview Tauri `window.confirm()` NON è la funzione
 * sincrona del browser: è intercettata e resa asincrona (ritorna una Promise),
 * e per giunta richiede la permission `dialog:allow-confirm`. Il codice storico
 * la usava sincrona — `if (!confirm(msg)) return;` — con due conseguenze:
 *  1. `!Promise` è sempre `false` ⇒ la guardia non scattava MAI, l'azione
 *     (es. eliminazione) proseguiva senza aspettare la risposta;
 *  2. la Promise veniva rifiutata («dialog.confirm not allowed») come
 *     unhandled rejection.
 *
 * Qui usiamo `ask` del plugin-dialog (permission `dialog:allow-ask`, presente
 * da sempre nelle capabilities) e lo AWAITIAMO. Fuori da Tauri (dev browser)
 * ricadiamo sul `window.confirm` nativo, che lì è davvero sincrono.
 */
export async function confirmDialog(message: string, title?: string): Promise<boolean> {
  const isTauri =
    typeof window !== 'undefined' &&
    !!(
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ ||
      (window as unknown as Record<string, unknown>).__TAURI_IPC__
    );

  if (isTauri) {
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      return await ask(message, { title: title || 'GameStringer', kind: 'warning' });
    } catch (e: unknown) {
      // Se anche `ask` non è disponibile, meglio NON procedere con un'azione
      // distruttiva: ritorniamo false e lo diciamo nei log.
      clientLogger.error('confirmDialog: ask non disponibile, azione annullata:', String(e));
      return false;
    }
  }

  // Browser/dev: il confirm nativo è sincrono, ma qui ne prendiamo il valore
  // in una Promise per un'unica firma await-abile ai call-site.
  return typeof window !== 'undefined' && typeof window.confirm === 'function'
    ? window.confirm(message)
    : true;
}
