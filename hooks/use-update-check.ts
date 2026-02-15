'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_notes: string | null;
  download_url: string | null;
  published_at: string | null;
}

export const useUpdateCheck = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    
    try {
      const info = await invoke<UpdateInfo>('check_for_updates');
      if (info && info.update_available) {
        setUpdateInfo(info);
        
        // Controlla se è già stato dismissato per questa versione
        const lastDismissed = localStorage.getItem('update_dismissed_version');
        if (lastDismissed === info.latest_version) {
          setIsDismissed(true);
        }
      }
    } catch (error) {
      console.warn('Update check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  const dismissUpdate = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem('update_dismissed_version', updateInfo.latest_version);
    }
    setIsDismissed(true);
  }, [updateInfo]);

  // Check all'avvio (una sola volta, con delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return {
    updateInfo,
    hasUpdate: !!(updateInfo?.update_available && !isDismissed),
    isChecking,
    dismissUpdate,
    checkForUpdates,
  };
};
