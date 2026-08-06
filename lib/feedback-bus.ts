/**
 * Feedback bus — apertura del dialog di feedback da qualunque punto dell'app,
 * anche fuori da React (toast, callback di pipeline, moduli non-componente).
 *
 * Perché esiste: fino al 30/07/2026 il feedback era raggiungibile solo dalla
 * pagina Impostazioni (`app/settings/page.tsx`), unico punto di montaggio del
 * widget. Risultato: zero righe nella tabella `feedback` pur con utenti attivi.
 * Questo bus permette di aprire lo stesso dialog dalla sidebar, dalla pagina
 * dedicata e dall'invito che compare a fine traduzione.
 *
 * Nessuna dipendenza (il progetto non usa zustand): sottoscrizione minimale.
 */

/** Da dove è stato aperto il dialog — finisce in `feedback.context.source`. */
export type FeedbackSource = 'settings' | 'sidebar' | 'page' | 'post-run' | 'other';

type Listener = (source: FeedbackSource) => void;

const listeners = new Set<Listener>();

/** Apre il dialog di feedback. No-op se nessun host è montato. */
export function openFeedback(source: FeedbackSource = 'other'): void {
  for (const l of Array.from(listeners)) {
    try {
      l(source);
    } catch {
      /* fail-open: un listener rotto non deve propagare */
    }
  }
}

/** Registra un host. Ritorna la funzione di cleanup. */
export function subscribeFeedback(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
