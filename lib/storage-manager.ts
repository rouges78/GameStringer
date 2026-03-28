import { get, set, del, clear } from 'idb-keyval';

/**
 * Storage Manager
 * 
 * Sostituisce l'uso del `localStorage` (limitato a 5MB) per dati pesanti
 * usando IndexedDB (asincrono e con limiti molto più alti, tipicamente > 50MB).
 * Il localStorage deve essere usato solo per piccoli settings (es. temi, API keys).
 */
export const storageManager = {
  // --- TRANSLATION MEMORY E ATTIVITA' ---
  
  async getTranslations(): Promise<unknown[]> {
    try {
      const data = await get('gameTranslations');
      return data || [];
    } catch (e) {
      console.error('[Storage] Errore lettura gameTranslations', e);
      return [];
    }
  },

  async saveTranslations(data: unknown[]): Promise<void> {
    try {
      await set('gameTranslations', data);
    } catch (e) {
      console.error('[Storage] Errore salvataggio gameTranslations', e);
    }
  },

  async getPatches(): Promise<unknown[]> {
    try {
      const data = await get('gamePatches');
      return data || [];
    } catch (e) {
      console.error('[Storage] Errore lettura gamePatches', e);
      return [];
    }
  },

  async savePatches(data: unknown[]): Promise<void> {
    try {
      await set('gamePatches', data);
    } catch (e) {
      console.error('[Storage] Errore salvataggio gamePatches', e);
    }
  },

  // --- EDITOR E TRADUZIONI PARZIALI ---

  async getPartialTranslations(): Promise<any | null> {
    try {
      return await get('gamestringer_partial_translations');
    } catch (e) {
      console.error('[Storage] Errore lettura partial_translations', e);
      return null;
    }
  },

  async savePartialTranslations(data: unknown): Promise<void> {
    try {
      await set('gamestringer_partial_translations', data);
    } catch (e) {
      console.error('[Storage] Errore salvataggio partial_translations', e);
    }
  },

  async clearPartialTranslations(): Promise<void> {
    try {
      await del('gamestringer_partial_translations');
    } catch (e) {
      console.error('[Storage] Errore cancellazione partial_translations', e);
    }
  },

  async getEditorFile(): Promise<any | null> {
    try {
      return await get('editorFile');
    } catch (e) {
      console.error('[Storage] Errore lettura editorFile', e);
      return null;
    }
  },

  async saveEditorFile(data: unknown): Promise<void> {
    try {
      await set('editorFile', data);
    } catch (e) {
      console.error('[Storage] Errore salvataggio editorFile', e);
    }
  },

  async clearEditorFile(): Promise<void> {
    try {
      await del('editorFile');
    } catch (e) {
      console.error('[Storage] Errore cancellazione editorFile', e);
    }
  },

  // --- MIGRAZIONE ---
  
  /**
   * Sposta i vecchi dati dal localStorage a IndexedDB se presenti
   */
  async migrateFromLocalStorage(): Promise<void> {
    try {
      const keysToMigrate = [
        'gameTranslations', 
        'gamePatches', 
        'gamestringer_partial_translations'
      ];
      
      for (const key of keysToMigrate) {
        const localData = localStorage.getItem(key);
        if (localData) {
          try {
            await set(key, JSON.parse(localData));
            localStorage.removeItem(key);
            console.log(`[Storage] Migrato ${key} da localStorage a IndexedDB`);
          } catch (e) {
            console.warn(`[Storage] Impossibile migrare ${key}`, e);
          }
        }
      }

      // editorFile era in sessionStorage
      const sessionEditorFile = sessionStorage.getItem('editorFile');
      if (sessionEditorFile) {
        try {
          await set('editorFile', JSON.parse(sessionEditorFile));
          sessionStorage.removeItem('editorFile');
          console.log(`[Storage] Migrato editorFile da sessionStorage a IndexedDB`);
        } catch (e) {}
      }
    } catch (e) {
      console.error('[Storage] Errore durante la migrazione', e);
    }
  }
};
