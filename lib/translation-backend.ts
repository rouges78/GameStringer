'use client';

/**
 * Scelta del motore AI per i traduttori file-based — cloud o Ollama locale.
 *
 * NATO 08/08/2026 dalla notte Ren'Py. Il ramo cloud di lib/renpy-translate.ts
 * era completo, testato e pilotabile SOLO da `localStorage.setItem` nei
 * devtools: nessuna riga di UI in tutto il repo, e l'unico chiamante non
 * passava `backend`. Risultato misurato: la run notturna su Scarlet Hollow è
 * finita su Ollama e i log dicevano [OFFLINE-CTX] mentre noi credevamo di
 * stare usando il cloud. È il terzo caso in due settimane di codice completo e
 * IRRAGGIUNGIBILE (gs-hook mai spedita, extract_renpy_rpa mai cablato): il
 * gate sui comandi Tauri conta gli invoke, non i pulsanti.
 *
 * PERCHÉ QUI E NON DENTRO renpy-translate.ts: la stessa manopola serve agli
 * altri quattro traduttori file-based, che oggi sono tutti cablati su Ollama
 * senza modo di scegliere — gs_hendrix_model, gs_rpgmaker_model e gs_renpy_chunk
 * sono knob solo-devtools esattamente come lo era questo. Oggi il selettore si
 * monta solo su Ren'Py (decisione presa con Davide: sbloccare Scarlet Hollow
 * prima), ma la chiave è già per-motore con fallback condiviso, così estenderlo
 * è meccanico e non richiede una migrazione.
 *
 * DEFAULT: 'ollama'. Chi aggiorna non deve trovarsi una spesa API a sorpresa —
 * su un gioco come Scarlet Hollow (83.489 stringhe, ~4M token) la differenza
 * tra i due rami non è un dettaglio di configurazione.
 */

export type TranslationBackend = 'cloud' | 'ollama';

/** Motori file-based che leggono questa impostazione. */
export type BackendEngine = 'renpy' | 'rpgmaker' | 'tyrano' | 'visionaire' | 'hendrix' | 'danganronpa';

/**
 * Chiave per-motore. `gs_renpy_backend` è la chiave che il flusso Ren'Py già
 * leggeva prima che esistesse questo modulo: NON va rinominata, chi l'ha
 * impostata a mano nei devtools deve ritrovare la sua scelta.
 */
export function backendKey(engine: BackendEngine): string {
  return `gs_${engine}_backend`;
}

/** Fallback condiviso, per quando l'impostazione diventerà globale. */
const SHARED_KEY = 'gs_translation_backend';

function lsGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Solo 'cloud' e 'ollama' sono validi: qualsiasi altra cosa è 'ollama'. */
function parse(raw: string | null): TranslationBackend | null {
  if (raw === 'cloud' || raw === 'ollama') return raw;
  return null;
}

/**
 * Backend effettivo per un motore: impostazione del motore, poi quella
 * condivisa, poi 'ollama'. Sicura in SSR e con localStorage negato.
 */
export function getTranslationBackend(engine: BackendEngine): TranslationBackend {
  return parse(lsGet(backendKey(engine))) ?? parse(lsGet(SHARED_KEY)) ?? 'ollama';
}

export function setTranslationBackend(engine: BackendEngine, value: TranslationBackend): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(backendKey(engine), value);
  } catch {
    // localStorage negato (webview con storage bloccato): la scelta vale per
    // la sessione tramite lo stato React, non si perde nulla di irrecuperabile.
  }
}

/**
 * ── SCELTA GLOBALE (Impostazioni) ────────────────────────────────────────
 * Richiesta di Davide, 10/08: «io metterei SEMPRE a scelta utente
 * (LOCALE/ONLINE)». La chiave condivisa esisteva dall'08/08 ma non la
 * scriveva nessuno: era una preferenza che nessuno poteva esprimere.
 *
 * Precedenza: impostazione del singolo motore → questa → 'ollama'. Cioè il
 * globale è il DEFAULT, non un ordine: chi ha già scelto per Ren'Py o
 * Danganronpa si tiene la sua scelta. Il contrario (globale che sovrascrive)
 * farebbe sparire in silenzio una preferenza già data — e una scelta che
 * cambia da sola è peggio di una scelta assente.
 */
export function getGlobalTranslationBackend(): TranslationBackend | null {
  return parse(lsGet(SHARED_KEY));
}

export function setGlobalTranslationBackend(value: TranslationBackend): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SHARED_KEY, value);
  } catch { /* storage negato: vale per la sessione */ }
}

/**
 * Dimentica la scelta di un motore, così tornerà a seguire il globale.
 * Serve al pulsante «usa l'impostazione generale»: senza, l'utente che ha
 * toccato una volta il picker di un gioco resterebbe legato a quella scelta
 * per sempre, senza capire perché il globale non ha effetto.
 */
export function clearTranslationBackend(engine: BackendEngine): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(backendKey(engine));
  } catch { /* storage negato */ }
}

/** Motori che oggi leggono davvero questa impostazione (per la UI). */
export const BACKEND_ENGINES: BackendEngine[] = ['renpy', 'danganronpa', 'visionaire', 'tyrano', 'rpgmaker', 'hendrix'];
