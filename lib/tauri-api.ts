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
    console.log(`Invocando comando Tauri: ${cmd}`, args);
    const result = await tauriInvoke(cmd, args);
    console.log(`Risultato comando ${cmd}:`, result);
    return result as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Gestisci silenziosamente gli errori di credenziali mancanti (sono normali)
    if (errorMessage.includes('Nessuna credenziale') || errorMessage.includes('salvata')) {
      console.debug(`Credenziali non trovate per comando '${cmd}' (normale al primo avvio):`, errorMessage);
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
