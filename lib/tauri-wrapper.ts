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
      // Per i comandi di test connessione, non loggare come errore bloccante
      const isConnectivityTest = /^test_.*_connection$/.test(command);
      const logger = isConnectivityTest ? console.warn : console.error;
      logger(`[TAURI] Errore chiamata ${command}:`, error);
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
    'get_steam_games_with_family_sharing': generateMockGames(),
    'force_refresh_all_games': generateMockGames(),
    'load_steam_games_cache': generateMockGames(),
    'list_profiles': { success: true, data: [] },
    'create_profile': { success: true, data: { id: 'mock-profile-id', name: 'Mock Profile' } },
    'authenticate_profile': { success: true, data: { id: 'mock-profile-id', name: 'Mock Profile' } },
    'get_current_profile': { success: true, data: null },
    'logout_profile': { success: true },
    'delete_profile': { success: true },
    'can_authenticate': { success: true, data: true },
    'test_steam_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_epic_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_gog_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_origin_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_ubisoft_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_battlenet_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'test_itchio_connection': { connected: false, error: 'Non disponibile in ambiente web' },
    'get_system_info': { os: 'web', version: '1.0.0' },
    'get_settings': {},
    'save_settings': { success: true },
    'get_current_profile_settings': { success: true, data: null },
    'load_global_settings': { success: true, data: null },
    'save_current_profile_settings': { success: true },
    'save_global_settings': { success: true }
  };

  const response = mockResponses[command] || null;
  return Promise.resolve(response as T);
}

// Genera giochi mock per test
function generateMockGames() {
  return [
    {
      id: '1',
      name: 'Counter-Strike 2',
      icon: '/api/placeholder/32/32',
      header_image: '/api/placeholder/460/215',
      is_vr: false,
      engine: 'Source 2',
      genres: ['Action', 'FPS'],
      family_sharing: false,
      owned_by: 'self'
    },
    {
      id: '2', 
      name: 'Dota 2',
      icon: '/api/placeholder/32/32',
      header_image: '/api/placeholder/460/215',
      is_vr: false,
      engine: 'Source 2',
      genres: ['MOBA', 'Strategy'],
      family_sharing: true,
      owned_by: 'family_member'
    },
    {
      id: '3',
      name: 'Half-Life: Alyx',
      icon: '/api/placeholder/32/32', 
      header_image: '/api/placeholder/460/215',
      is_vr: true,
      engine: 'Source 2',
      genres: ['Action', 'Adventure', 'VR'],
      family_sharing: false,
      owned_by: 'self'
    }
  ];
}

// Esporta anche la funzione invoke originale per compatibilità
export { safeInvoke as invoke };
