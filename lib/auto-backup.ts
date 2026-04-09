/**
 * Auto Backup System for GameStringer
 * Automatically saves project state at regular intervals
 */

import { invoke } from '@tauri-apps/api/core';
import { clientLogger } from '@/lib/client-logger';

export interface BackupConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxBackups: number;
  backupOnClose: boolean;
  backupPath?: string;
}

export interface BackupEntry {
  id: string;
  timestamp: number;
  projectId: string;
  projectName: string;
  size: number;
  type: 'auto' | 'manual' | 'pre-operation';
  description?: string;
}

export interface BackupData {
  version: string;
  timestamp: number;
  projectId: string;
  projectName: string;
  translations: Record<string, string>;
  glossary: Record<string, string>;
  settings: Record<string, unknown>;
  metadata: {
    totalStrings: number;
    translatedStrings: number;
    sourceLanguage: string;
    targetLanguage: string;
  };
}

const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  intervalMinutes: 5,
  maxBackups: 20,
  backupOnClose: true,
};

const BACKUP_STORAGE_KEY = 'gamestringer_backups';
const CONFIG_STORAGE_KEY = 'gamestringer_backup_config';

class AutoBackupService {
  private config: BackupConfig = DEFAULT_CONFIG;
  private intervalId: NodeJS.Timeout | null = null;
  private backups: BackupEntry[] = [];
  private currentProjectId: string | null = null;
  private getProjectDataFn: (() => BackupData | null) | null = null;

  constructor() {
    this.loadConfig();
    this.loadBackupList();
  }

  /**
   * Initialize backup service with project data getter
   */
  init(projectId: string, getProjectData: () => BackupData | null): void {
    this.currentProjectId = projectId;
    this.getProjectDataFn = getProjectData;
    
    if (this.config.enabled) {
      this.startAutoBackup();
    }
  }

  /**
   * Start auto backup interval
   */
  startAutoBackup(): void {
    this.stopAutoBackup();
    
    if (!this.config.enabled || this.config.intervalMinutes <= 0) return;

    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.createBackup('auto');
    }, intervalMs);

    clientLogger.debug(`[AutoBackup] Started with interval: ${this.config.intervalMinutes} min`);
  }

  /**
   * Stop auto backup interval
   */
  stopAutoBackup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Create a backup
   */
  async createBackup(
    type: BackupEntry['type'] = 'manual',
    description?: string
  ): Promise<BackupEntry | null> {
    if (!this.getProjectDataFn || !this.currentProjectId) {
      clientLogger.warn('[AutoBackup] No project data getter configured');
      return null;
    }

    const data = this.getProjectDataFn();
    if (!data) {
      clientLogger.warn('[AutoBackup] No project data to backup');
      return null;
    }

    try {
      const backupJson = JSON.stringify(data);
      const entry: BackupEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        projectId: this.currentProjectId,
        projectName: data.projectName,
        size: new Blob([backupJson]).size,
        type,
        description,
      };

      // Save to localStorage (for now, could be file system via Tauri)
      this.saveBackupData(entry.id, backupJson);
      this.backups.unshift(entry);
      
      // Cleanup old backups
      await this.cleanupOldBackups();
      
      this.saveBackupList();
      
      clientLogger.debug(`[AutoBackup] Created ${type} backup: ${entry.id}`);
      return entry;
    } catch (error: unknown) {
      clientLogger.error('[AutoBackup] Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupId: string): Promise<BackupData | null> {
    try {
      const backupJson = localStorage.getItem(`backup_${backupId}`);
      if (!backupJson) {
        clientLogger.error('[AutoBackup] Backup not found:', backupId);
        return null;
      }

      const data = JSON.parse(backupJson) as BackupData;
      clientLogger.debug(`[AutoBackup] Restored backup: ${backupId}`);
      return data;
    } catch (error: unknown) {
      clientLogger.error('[AutoBackup] Failed to restore backup:', error);
      return null;
    }
  }

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): boolean {
    const index = this.backups.findIndex(b => b.id === backupId);
    if (index === -1) return false;

    localStorage.removeItem(`backup_${backupId}`);
    this.backups.splice(index, 1);
    this.saveBackupList();
    
    return true;
  }

  /**
   * Get all backups for current project
   */
  getBackups(projectId?: string): BackupEntry[] {
    if (projectId) {
      return this.backups.filter(b => b.projectId === projectId);
    }
    return [...this.backups];
  }

  /**
   * Get backup statistics
   */
  getStats(): { totalBackups: number; totalSize: number; oldestBackup: number | null } {
    const totalSize = this.backups.reduce((sum, b) => sum + b.size, 0);
    const oldest = this.backups.length > 0 
      ? Math.min(...this.backups.map(b => b.timestamp))
      : null;

    return {
      totalBackups: this.backups.length,
      totalSize,
      oldestBackup: oldest,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();

    // Restart auto backup with new config
    if (this.currentProjectId) {
      this.startAutoBackup();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  /**
   * Cleanup old backups beyond max limit
   */
  private async cleanupOldBackups(): Promise<void> {
    if (this.backups.length <= this.config.maxBackups) return;

    // Sort by timestamp (newest first)
    this.backups.sort((a, b) => b.timestamp - a.timestamp);

    // Remove oldest backups
    const toRemove = this.backups.slice(this.config.maxBackups);
    for (const backup of toRemove) {
      localStorage.removeItem(`backup_${backup.id}`);
    }

    this.backups = this.backups.slice(0, this.config.maxBackups);
  }

  /**
   * Save backup data to storage
   */
  private saveBackupData(id: string, data: string): void {
    localStorage.setItem(`backup_${id}`, data);
  }

  /**
   * Save backup list
   */
  private saveBackupList(): void {
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(this.backups));
  }

  /**
   * Load backup list
   */
  private loadBackupList(): void {
    try {
      const stored = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (stored) {
        this.backups = JSON.parse(stored);
      }
    } catch (error: unknown) {
      clientLogger.error('[AutoBackup] Failed to load backup list:', error);
    }
  }

  /**
   * Save configuration
   */
  private saveConfig(): void {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
  }

  /**
   * Load configuration
   */
  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error: unknown) {
      clientLogger.error('[AutoBackup] Failed to load config:', error);
    }
  }

  /**
   * Export all backups to file
   */
  async exportBackups(): Promise<Blob> {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      backups: this.backups.map(entry => ({
        ...entry,
        data: localStorage.getItem(`backup_${entry.id}`),
      })),
    };

    return new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  }

  /**
   * Cleanup on app close
   */
  async onAppClose(): Promise<void> {
    if (this.config.backupOnClose && this.currentProjectId) {
      await this.createBackup('auto', 'Backup before close');
    }
    this.stopAutoBackup();
  }
}

// Singleton instance
export const autoBackupService = new AutoBackupService();

// React hook
import { useState, useEffect, useCallback } from 'react';

export function useAutoBackup(projectId: string, getProjectData: () => BackupData | null) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [config, setConfig] = useState<BackupConfig>(autoBackupService.getConfig());

  useEffect(() => {
    autoBackupService.init(projectId, getProjectData);
    setBackups(autoBackupService.getBackups(projectId));

    return () => {
      autoBackupService.stopAutoBackup();
    };
  }, [projectId, getProjectData]);

  const createBackup = useCallback(async (description?: string) => {
    const entry = await autoBackupService.createBackup('manual', description);
    if (entry) {
      setBackups(autoBackupService.getBackups(projectId));
    }
    return entry;
  }, [projectId]);

  const restoreBackup = useCallback(async (backupId: string) => {
    return autoBackupService.restoreBackup(backupId);
  }, []);

  const deleteBackup = useCallback((backupId: string) => {
    const success = autoBackupService.deleteBackup(backupId);
    if (success) {
      setBackups(autoBackupService.getBackups(projectId));
    }
    return success;
  }, [projectId]);

  const updateConfig = useCallback((newConfig: Partial<BackupConfig>) => {
    autoBackupService.updateConfig(newConfig);
    setConfig(autoBackupService.getConfig());
  }, []);

  return {
    backups,
    config,
    createBackup,
    restoreBackup,
    deleteBackup,
    updateConfig,
    getStats: () => autoBackupService.getStats(),
  };
}

export default autoBackupService;
