/**
 * # Global Hotkeys Hook
 * 
 * Hook React per gestire le hotkey globali.
 */

import { useEffect, useCallback, useState } from 'react';
import { invoke } from '@/lib/tauri-api';
import { listen } from '@tauri-apps/api/event';

interface HotkeyEvent {
  action: string;
  timestamp: number;
}

interface HotkeyConfig {
  modifiers: string[];
  key: string;
  action: string;
}

const STORAGE_KEY = 'gamestringer_hotkeys';

// Hotkey predefinite
export const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  { modifiers: ['Ctrl', 'Shift'], key: 'T', action: 'ocr_capture' },
  { modifiers: ['Ctrl', 'Shift'], key: 'Q', action: 'quick_translate' },
  { modifiers: ['Ctrl', 'Alt'], key: 'O', action: 'toggle_overlay' },
];

export function useGlobalHotkeys(handlers: Record<string, () => void>) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [registeredHotkeys, setRegisteredHotkeys] = useState<Map<number, string>>(new Map());

  // Inizializza il sistema di hotkey
  const initialize = useCallback(async () => {
    try {
      await invoke('init_global_hotkeys');
      setIsInitialized(true);
      console.log('[HOTKEY] Sistema inizializzato');
    } catch (e) {
      console.error('[HOTKEY] Errore inizializzazione:', e);
    }
  }, []);

  // Registra una hotkey
  const registerHotkey = useCallback(async (config: HotkeyConfig): Promise<number | null> => {
    try {
      const id = await invoke<number>('register_global_hotkey', {
        modifiers: config.modifiers,
        key: config.key,
        action: config.action,
      });
      
      setRegisteredHotkeys(prev => new Map(prev).set(id, config.action));
      console.log(`[HOTKEY] Registrata: ${config.modifiers.join('+')}+${config.key} -> ${config.action}`);
      return id;
    } catch (e) {
      console.error('[HOTKEY] Errore registrazione:', e);
      return null;
    }
  }, []);

  // Rimuovi una hotkey
  const unregisterHotkey = useCallback(async (id: number): Promise<boolean> => {
    try {
      await invoke('unregister_global_hotkey', { id });
      setRegisteredHotkeys(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      return true;
    } catch (e) {
      console.error('[HOTKEY] Errore rimozione:', e);
      return false;
    }
  }, []);

  // Registra tutte le hotkey predefinite
  const registerDefaultHotkeys = useCallback(async () => {
    // Carica hotkey salvate o usa default
    let hotkeys = DEFAULT_HOTKEYS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        hotkeys = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[HOTKEY] Errore caricamento hotkeys salvate, uso default:', e);
    }

    for (const config of hotkeys) {
      await registerHotkey(config);
    }
  }, [registerHotkey]);

  // Salva configurazione hotkey
  const saveHotkeyConfig = useCallback((hotkeys: HotkeyConfig[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hotkeys));
    } catch (e) {
      console.warn('[HOTKEY] Errore salvataggio configurazione hotkeys:', e);
    }
  }, []);

  // Ascolta eventi hotkey
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<HotkeyEvent>('global-hotkey', (event) => {
        const { action } = event.payload;
        console.log(`[HOTKEY] Evento: ${action}`);
        
        if (handlers[action]) {
          handlers[action]();
        }
      });
    };

    if (isInitialized) {
      setupListener();
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [isInitialized, handlers]);

  // Inizializza al mount
  useEffect(() => {
    initialize().then(() => {
      registerDefaultHotkeys();
    });

    return () => {
      // Cleanup: rimuovi tutte le hotkey
      invoke('clear_global_hotkeys').catch(() => {});
    };
  }, []);

  return {
    isInitialized,
    registeredHotkeys,
    registerHotkey,
    unregisterHotkey,
    saveHotkeyConfig,
  };
}

// Hook semplificato per OCR
export function useOcrHotkey(onCapture: () => void) {
  return useGlobalHotkeys({
    ocr_capture: onCapture,
  });
}

// Hook per quick translate
export function useQuickTranslateHotkey(onTranslate: () => void) {
  return useGlobalHotkeys({
    quick_translate: onTranslate,
  });
}
