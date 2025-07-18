'use client';

// Wrapper per gestire le chiamate Tauri in ambiente web e desktop

// Funzione per rilevare se siamo in ambiente Tauri
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).__TAURI__;
}

// Wrapper per le chiamate invoke che gestisce ambiente web/desktop
export async function safeInvoke<T>(command: string, args?: any): Promise<T> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(command, args);
    } catch (error) {
      console.error(`[TAURI] Errore chiamata ${command}:`, error);
      throw error;
    }
  } else {
    // Ambiente web - usa fallback o mock
    console.warn(`[WEB] Chiamata Tauri ${command} non disponibile in ambiente web`);
    return getMockResponse<T>(command, args);
  }
}

// Risposte mock per ambiente web
function getMockResponse<T>(command: string, args?: any): Promise<T> {
  const mockResponses: Record<string, any> = {
    'get_games': [],
    'test_steam_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_epic_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_gog_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_origin_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_ubisoft_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_battlenet_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_itchio_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'get_system_info': { os: 'web', version: '1.0.0' },
    'get_settings': {},
    'save_settings': { success: true }
  };

  const response = mockResponses[command] || null;
  return Promise.resolve(response as T);
}

// Esporta anche la funzione invoke originale per compatibilità
export { safeInvoke as invoke };
