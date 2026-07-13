'use client';

/**
 * Settings persistence bridge.
 *
 * Il blob `gameStringerSettings` (API key + preferenze) vive in localStorage
 * come cache sincrona, letta da ~30 componenti. localStorage nel webview Tauri
 * però non persiste in modo affidabile tra i riavvii: questo modulo usa il
 * disco come fonte di verità, tramite i comandi Rust GIÀ esistenti
 * `save_app_settings` / `load_app_settings` (commands/utilities.rs), che
 * scrivono in data_dir()/GameStringer/settings.json.
 *
 * - hydrateSettingsFromDisk(): all'avvio copia il blob da disco a localStorage.
 * - persistSettingsToDisk(): copia il blob corrente da localStorage al disco.
 *
 * In ambiente non-Tauri (dev browser) invoke() lancia: gli errori sono
 * silenziati e l'app continua col solo localStorage.
 */

import { invoke } from '@/lib/tauri-api';
import { clientLogger } from '@/lib/client-logger';

const LS_KEY = 'gameStringerSettings';

let hydrated = false;

/**
 * Idrata localStorage dal file su disco. Da chiamare il prima possibile
 * all'avvio, PRIMA che i componenti leggano le impostazioni.
 * Il disco è la fonte di verità; se il disco è vuoto ma localStorage ha già
 * dati (es. primo avvio dopo l'aggiornamento), li promuove su disco.
 */
export async function hydrateSettingsFromDisk(): Promise<void> {
  if (typeof window === 'undefined' || hydrated) return;
  hydrated = true;
  try {
    // load_app_settings ritorna {} se non esiste ancora alcun file.
    const disk = await invoke<Record<string, unknown>>('load_app_settings');
    const hasDisk = !!disk && typeof disk === 'object' && Object.keys(disk).length > 0;

    let local: Record<string, unknown> = {};
    try { local = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { /* corrotto → {} */ }

    if (hasDisk) {
      // Deep-merge: il disco è la fonte di verità, MA non cancella chiavi presenti
      // solo in localStorage e non ancora persistite (evita di perdere API key
      // inserite ma non ancora salvate su disco da una versione precedente).
      const d = disk as Record<string, Record<string, unknown> | unknown>;
      const merged: Record<string, unknown> = { ...local, ...d };
      for (const cat of ['translation', 'system', 'performance', 'display', 'privacy']) {
        const lc = (local as Record<string, unknown>)[cat] as Record<string, unknown> | undefined;
        const dc = (d as Record<string, unknown>)[cat] as Record<string, unknown> | undefined;
        if (lc || dc) merged[cat] = { ...(lc || {}), ...(dc || {}) };
      }
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
      // Riallinea il disco al blob completo (così la prossima hydration è coerente).
      await invoke('save_app_settings', { settings: merged }).catch(() => {});
    } else if (Object.keys(local).length > 0) {
      // Migrazione una-tantum: localStorage esistente → disco
      await invoke('save_app_settings', { settings: local });
    }
  } catch (e: unknown) {
    // Non-Tauri o errore disco: si prosegue col solo localStorage.
    clientLogger.debug('hydrateSettingsFromDisk skipped:', String(e));
  }
}

/**
 * Persiste il blob corrente di localStorage su disco.
 * Sicuro da chiamare spesso; no-op se non c'è nulla da salvare.
 */
export async function persistSettingsToDisk(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const json = localStorage.getItem(LS_KEY);
    if (json) {
      await invoke('save_app_settings', { settings: JSON.parse(json) });
    }
  } catch (e: unknown) {
    clientLogger.debug('persistSettingsToDisk skipped:', String(e));
  }
}
