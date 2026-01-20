/**
 * SafeStorage - Wrapper robusto per localStorage con protezione anti-corruzione
 * 
 * Caratteristiche:
 * - Validazione JSON prima della scrittura
 * - Backup automatico prima di modifiche
 * - Gestione quota exceeded
 * - Checksum per rilevare corruzione
 * - Versioning automatico
 */

const BACKUP_SUFFIX = '_backup';
const META_SUFFIX = '_meta';

interface StorageMeta {
  version: number;
  checksum: string;
  timestamp: number;
  size: number;
}

/**
 * Calcola un semplice checksum per rilevare corruzione
 */
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Verifica se siamo nel browser
 */
function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Salva dati in localStorage con protezione anti-corruzione
 */
export function safeSetItem<T>(key: string, value: T, version: number = 1): boolean {
  if (!isClient()) return false;

  try {
    // Serializza e valida
    const serialized = JSON.stringify(value);
    
    // Verifica che sia JSON valido
    JSON.parse(serialized);
    
    // Crea backup del valore precedente
    const existing = localStorage.getItem(key);
    if (existing) {
      try {
        localStorage.setItem(key + BACKUP_SUFFIX, existing);
      } catch {
        // Se non c'è spazio per backup, prova a liberare spazio
        cleanupOldBackups();
      }
    }
    
    // Crea metadata
    const meta: StorageMeta = {
      version,
      checksum: calculateChecksum(serialized),
      timestamp: Date.now(),
      size: serialized.length
    };
    
    // Salva metadata e dati
    localStorage.setItem(key + META_SUFFIX, JSON.stringify(meta));
    localStorage.setItem(key, serialized);
    
    return true;
  } catch (error: any) {
    // Gestione quota exceeded
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn(`[SafeStorage] Quota exceeded per "${key}", tentativo cleanup...`);
      cleanupOldData();
      
      // Riprova una volta
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        console.error(`[SafeStorage] Impossibile salvare "${key}" anche dopo cleanup`);
        return false;
      }
    }
    
    console.error(`[SafeStorage] Errore salvando "${key}":`, error);
    return false;
  }
}

/**
 * Legge dati da localStorage con validazione e recovery
 */
export function safeGetItem<T>(key: string, defaultValue: T | null = null): T | null {
  if (!isClient()) return defaultValue;

  try {
    const data = localStorage.getItem(key);
    if (!data) return defaultValue;
    
    // Verifica metadata
    const metaStr = localStorage.getItem(key + META_SUFFIX);
    if (metaStr) {
      try {
        const meta: StorageMeta = JSON.parse(metaStr);
        const currentChecksum = calculateChecksum(data);
        
        // Verifica integrità
        if (meta.checksum !== currentChecksum) {
          console.warn(`[SafeStorage] Checksum mismatch per "${key}", tentativo recovery...`);
          return recoverFromBackup<T>(key, defaultValue);
        }
      } catch {
        // Metadata corrotti, ma i dati potrebbero essere ok
        console.warn(`[SafeStorage] Metadata corrotti per "${key}"`);
      }
    }
    
    // Parse dati
    const parsed = JSON.parse(data) as T;
    return parsed;
    
  } catch (error) {
    console.error(`[SafeStorage] Errore leggendo "${key}":`, error);
    return recoverFromBackup<T>(key, defaultValue);
  }
}

/**
 * Tenta recovery da backup
 */
function recoverFromBackup<T>(key: string, defaultValue: T | null): T | null {
  try {
    const backup = localStorage.getItem(key + BACKUP_SUFFIX);
    if (backup) {
      const parsed = JSON.parse(backup) as T;
      console.log(`[SafeStorage] Recuperato "${key}" da backup`);
      
      // Ripristina il backup come dato principale
      localStorage.setItem(key, backup);
      
      return parsed;
    }
  } catch {
    console.error(`[SafeStorage] Anche il backup di "${key}" è corrotto`);
  }
  
  // Pulisci dati corrotti
  safeRemoveItem(key);
  return defaultValue;
}

/**
 * Rimuove item e relativi backup/metadata
 */
export function safeRemoveItem(key: string): void {
  if (!isClient()) return;
  
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(key + BACKUP_SUFFIX);
    localStorage.removeItem(key + META_SUFFIX);
  } catch (error) {
    console.error(`[SafeStorage] Errore rimuovendo "${key}":`, error);
  }
}

/**
 * Pulisce backup vecchi (>24h)
 */
function cleanupOldBackups(): void {
  if (!isClient()) return;
  
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 ore
  
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (key.endsWith(META_SUFFIX)) {
        try {
          const meta: StorageMeta = JSON.parse(localStorage.getItem(key) || '{}');
          if (now - meta.timestamp > maxAge) {
            const baseKey = key.replace(META_SUFFIX, '');
            localStorage.removeItem(baseKey + BACKUP_SUFFIX);
          }
        } catch {
          // Ignora errori di parsing
        }
      }
    }
  } catch {
    // Ignora errori durante cleanup
  }
}

/**
 * Pulisce dati vecchi per liberare spazio
 */
function cleanupOldData(): void {
  if (!isClient()) return;
  
  const keysToCheck = [
    'gamestringer_progress_events',
    'gs_activity_log',
    'gs_debug_logs'
  ];
  
  keysToCheck.forEach(key => {
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(key + BACKUP_SUFFIX);
      localStorage.removeItem(key + META_SUFFIX);
    } catch {
      // Ignora
    }
  });
}

/**
 * Ottiene statistiche storage
 */
export function getStorageStats(): {
  used: number;
  items: number;
  corrupted: number;
} {
  if (!isClient()) return { used: 0, items: 0, corrupted: 0 };
  
  let used = 0;
  let items = 0;
  let corrupted = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    const value = localStorage.getItem(key);
    if (value) {
      used += key.length + value.length;
      
      // Non contare metadata e backup come items separati
      if (!key.endsWith(META_SUFFIX) && !key.endsWith(BACKUP_SUFFIX)) {
        items++;
        
        // Verifica se è JSON valido
        try {
          JSON.parse(value);
        } catch {
          corrupted++;
        }
      }
    }
  }
  
  return { used, items, corrupted };
}

/**
 * Ripara tutti i dati corrotti
 */
export function repairCorruptedData(): number {
  if (!isClient()) return 0;
  
  let repaired = 0;
  const keysToCheck: string[] = [];
  
  // Raccogli chiavi
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !key.endsWith(META_SUFFIX) && !key.endsWith(BACKUP_SUFFIX)) {
      keysToCheck.push(key);
    }
  }
  
  // Verifica e ripara
  keysToCheck.forEach(key => {
    const value = localStorage.getItem(key);
    if (!value) return;
    
    try {
      JSON.parse(value);
    } catch {
      // Tenta recovery da backup
      const backup = localStorage.getItem(key + BACKUP_SUFFIX);
      if (backup) {
        try {
          JSON.parse(backup);
          localStorage.setItem(key, backup);
          repaired++;
          console.log(`[SafeStorage] Riparato "${key}" da backup`);
        } catch {
          // Anche backup corrotto, rimuovi tutto
          safeRemoveItem(key);
          console.log(`[SafeStorage] Rimosso "${key}" (irrecuperabile)`);
        }
      } else {
        safeRemoveItem(key);
      }
    }
  });
  
  return repaired;
}
