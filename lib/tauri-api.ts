// Wrapper per l'API Tauri v2, reso più robusto per l'uso in ambienti ibridi (browser/Tauri)

// Controlla una sola volta se l'app è in esecuzione all'interno di Tauri.
const IS_TAURI = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

/**
 * Invoca un comando del backend Rust in modo sicuro.
 * Se l'app non è in esecuzione in un ambiente Tauri, lancia un errore controllato
 * invece di causare un crash.
 * @param cmd Il comando da invocare.
 * @param args Gli argomenti per il comando.
 * @returns Una Promise che si risolve con il risultato del comando.
 */
export const invoke = async <T = any>(cmd: string, args?: any): Promise<T> => {
  if (!IS_TAURI) {
    const errorMsg = `Comando Tauri '${cmd}' bloccato: l'app non è in esecuzione in ambiente Tauri.`;
    console.warn(errorMsg, args);
    throw new Error(errorMsg);
  }

  // Inizializzazione lazy dell'API di Tauri per evitare import non necessari.
  if (!tauriInvoke) {
    try {
      const { invoke: coreInvoke } = await import('@tauri-apps/api/core');
      tauriInvoke = coreInvoke;
    } catch (e) {
      console.error("Impossibile caricare il modulo @tauri-apps/api/core:", e);
      throw new Error("Impossibile caricare il modulo API di Tauri.");
    }
  }

  try {
    // Tauri converte automaticamente camelCase JS → snake_case Rust
    // Non serve normalizzazione manuale
    const safeArgs = args;

    console.log(`Invocando comando Tauri: ${cmd}`, safeArgs);
    const result = await tauriInvoke(cmd, safeArgs);
    
    // Maschera password nei log per sicurezza
    const sanitizeForLog = (obj: unknown): unknown => {
      if (!obj || typeof obj !== 'object') return obj;
      const sanitized = { ...obj as Record<string, unknown> };
      const sensitiveKeys = ['password', 'api_key', 'api_key_encrypted', 'secret', 'token'];
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k)) && sanitized[key]) {
          sanitized[key] = '***';
        }
      }
      return sanitized;
    };
    console.log(`Risultato comando ${cmd}:`, sanitizeForLog(result));
    return result as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Gestisci con messaggi carini gli errori di credenziali mancanti (sono normali)
    if (errorMessage.includes('Nessuna credenziale') || errorMessage.includes('salvata')) {
      console.info(`💡 ${cmd}: Credenziali non configurate (normale al primo avvio). Vai su Settings per configurarle! 🎮`);
      
      // Crea un errore più carino per l'utente
      const friendlyError = new Error(`💡 Credenziali non configurate. Vai su Settings per configurare Steam! 🎮`);
      friendlyError.name = 'CredentialsNotConfigured';
      throw friendlyError;
    } else if (errorMessage.includes('Command') && errorMessage.includes('not found')) {
      // Gestisci comandi mancanti come warning (es. moduli disabilitati)
      console.warn(`⚠️ Comando Tauri non disponibile: '${cmd}' (backend feature potrebbe essere disabilitata). Uso fallback locale.`);
    } else if (errorMessage.includes('non trovato') || errorMessage.includes('not found')) {
      // Errori di ricerca "non trovato" sono normali, non loggare
    } else if (cmd === 'check_for_updates' && (errorMessage.includes('timeout') || errorMessage.includes('connection'))) {
      // Errori di rete per check aggiornamenti sono normali, non loggare
    } else if (errorMessage.includes('Rate limit')) {
      // Rate limit Steam è normale, non loggare
    } else if (errorMessage.includes('Credenziali corrotte') || errorMessage.includes('Riconnettiti a Steam')) {
      // Credenziali corrotte - messaggio già gestito, non loggare come errore
      console.info('ℹ️ Credenziali Steam rimosse. Riconnettiti nelle Impostazioni.');
    } else {
      console.error(`Errore durante l'invocazione del comando Tauri '${cmd}':`, error);
    }
    
    throw error; // Rilancia l'errore originale per essere gestito dal chiamante.
  }
};

/**
 * Verifica se l'applicazione è in esecuzione all'interno di un ambiente Tauri.
 * @returns `true` se in ambiente Tauri, altrimenti `false`.
 */
export const isTauri = (): boolean => {
  return IS_TAURI;
};
