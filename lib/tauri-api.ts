// Wrapper per l'API Tauri v2
// In Tauri v2, l'API viene esposta diversamente

let tauriInvoke: any = null;
let initPromise: Promise<any> | null = null;

// Funzione per inizializzare l'API Tauri v2
const initTauri = async () => {
  if (tauriInvoke) return tauriInvoke;
  
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      // In Tauri v2, l'invoke è in @tauri-apps/api/core
      const tauriModule = await import('@tauri-apps/api/core');
      tauriInvoke = tauriModule.invoke;
      console.log('Tauri v2 API caricata con successo');
      return tauriInvoke;
    } catch (error) {
      console.error('Errore caricamento Tauri API:', error);
      
      // Fallback: prova con window.__TAURI_INTERNALS__
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        console.log('Usando fallback __TAURI_INTERNALS__');
        tauriInvoke = (window as any).__TAURI_INTERNALS__.invoke;
        return tauriInvoke;
      }
      
      throw new Error('Tauri API non disponibile');
    }
  })();
  
  return initPromise;
};

// Funzione per invocare comandi Tauri
export const invoke = async <T = any>(cmd: string, args?: any): Promise<T> => {
  try {
    const invokeFunc = await initTauri();
    console.log(`Invocando comando Tauri: ${cmd}`, args);
    const result = await invokeFunc(cmd, args);
    console.log(`Risultato comando ${cmd}:`, result);
    return result;
  } catch (error) {
    console.error('Errore invocazione Tauri:', error);
    throw error;
  }
};

// Funzione per verificare se siamo in ambiente Tauri
export const isTauri = (): boolean => {
  try {
    return typeof window !== 'undefined' && 
           ((window as any).__TAURI_INTERNALS__ !== undefined);
  } catch {
    return false;
  }
};
