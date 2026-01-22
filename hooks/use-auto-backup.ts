'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@/lib/tauri-api';
import { useToast } from '@/hooks/use-toast';

export interface AutoBackupConfig {
  enabled: boolean;
  intervalMinutes: number;
  backupTranslationMemory: boolean;
  backupDictionaries: boolean;
  backupSettings: boolean;
  maxBackups: number;
  lastBackup: string | null;
}

export interface AutoBackupResult {
  success: boolean;
  timestamp: string;
  filesBackedUp: string[];
  totalSizeBytes: number;
  error: string | null;
}

export interface AutoBackupInfo {
  path: string;
  filename: string;
  backupType: string;
  sizeBytes: number;
  createdAt: string;
}

const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: true,
  intervalMinutes: 15,
  backupTranslationMemory: true,
  backupDictionaries: true,
  backupSettings: true,
  maxBackups: 20,
  lastBackup: null,
};

export function useAutoBackup() {
  const [config, setConfig] = useState<AutoBackupConfig>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<AutoBackupResult | null>(null);
  const [backups, setBackups] = useState<AutoBackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Carica configurazione
  const loadConfig = useCallback(async () => {
    try {
      const cfg = await invoke<AutoBackupConfig>('load_autobackup_config');
      setConfig(cfg);
    } catch (e) {
      console.error('[AutoBackup] Errore caricamento config:', e);
    }
  }, []);

  // Salva configurazione
  const saveConfig = useCallback(async (newConfig: AutoBackupConfig) => {
    try {
      await invoke('save_autobackup_config', { config: newConfig });
      setConfig(newConfig);
      toast({ title: '✅ Configurazione Auto-Backup salvata' });
    } catch (e) {
      console.error('[AutoBackup] Errore salvataggio config:', e);
      toast({ title: 'Errore', description: String(e), variant: 'destructive' });
    }
  }, [toast]);

  // Carica lista backup
  const loadBackups = useCallback(async () => {
    try {
      const list = await invoke<AutoBackupInfo[]>('list_auto_backups');
      setBackups(list);
    } catch (e) {
      console.error('[AutoBackup] Errore caricamento backups:', e);
    }
  }, []);

  // Esegui backup manuale
  const runBackup = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    try {
      const result = await invoke<AutoBackupResult>('run_auto_backup');
      setLastResult(result);
      
      if (result.success) {
        toast({ 
          title: '💾 Backup completato',
          description: `${result.filesBackedUp.length} file salvati (${formatSize(result.totalSizeBytes)})`
        });
        await loadConfig(); // Aggiorna lastBackup
        await loadBackups();
      } else {
        toast({ 
          title: 'Errore backup', 
          description: result.error || 'Errore sconosciuto',
          variant: 'destructive'
        });
      }
    } catch (e) {
      console.error('[AutoBackup] Errore esecuzione backup:', e);
      toast({ title: 'Errore backup', description: String(e), variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, toast, loadConfig, loadBackups]);

  // Verifica e esegui backup se necessario
  const checkAndRunBackup = useCallback(async () => {
    if (isRunning) return;
    
    try {
      const shouldRun = await invoke<boolean>('should_run_auto_backup');
      if (shouldRun) {
        console.log('[AutoBackup] Avvio backup automatico...');
        await runBackup();
      }
    } catch (e) {
      console.error('[AutoBackup] Errore verifica backup:', e);
    }
  }, [isRunning, runBackup]);

  // Ripristina da backup
  const restoreBackup = useCallback(async (backupPath: string, restoreType: string) => {
    try {
      const restored = await invoke<number>('restore_from_auto_backup', {
        backupPath,
        restoreType
      });
      toast({ 
        title: '✅ Ripristino completato',
        description: `${restored} elementi ripristinati`
      });
      return restored;
    } catch (e) {
      console.error('[AutoBackup] Errore ripristino:', e);
      toast({ title: 'Errore ripristino', description: String(e), variant: 'destructive' });
      throw e;
    }
  }, [toast]);

  // Setup timer auto-backup
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (config.enabled && config.intervalMinutes > 0) {
      // Controlla ogni minuto se è ora di fare backup
      intervalRef.current = setInterval(() => {
        checkAndRunBackup();
      }, 60 * 1000); // Ogni minuto

      // Controlla subito all'avvio
      checkAndRunBackup();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config.enabled, config.intervalMinutes, checkAndRunBackup]);

  // Carica dati iniziali
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadConfig();
      await loadBackups();
      setLoading(false);
    };
    init();
  }, [loadConfig, loadBackups]);

  return {
    config,
    setConfig: saveConfig,
    isRunning,
    lastResult,
    backups,
    loading,
    runBackup,
    restoreBackup,
    loadBackups,
  };
}

// Helper per formattare dimensioni
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
