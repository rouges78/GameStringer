'use client';

import { useState, useCallback } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';

export interface TauriUpdateState {
  update: Update | null;
  isChecking: boolean;
  isDownloading: boolean;
  isInstalling: boolean;
  downloadProgress: number;
  error: string | null;
}

export const useTauriUpdater = () => {
  const [state, setState] = useState<TauriUpdateState>({
    update: null,
    isChecking: false,
    isDownloading: false,
    isInstalling: false,
    downloadProgress: 0,
    error: null,
  });

  const checkForUpdate = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));
    
    try {
      const update = await check();
      setState(prev => ({ 
        ...prev, 
        update, 
        isChecking: false 
      }));
      return update;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Errore durante il controllo aggiornamenti';
      setState(prev => ({ 
        ...prev, 
        isChecking: false, 
        error: errorMsg 
      }));
      console.warn('Update check failed:', error);
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!state.update) {
      toast.error('Nessun aggiornamento disponibile');
      return;
    }

    setState(prev => ({ ...prev, isDownloading: true, downloadProgress: 0, error: null }));
    
    try {
      let downloaded = 0;
      let contentLength = 0;
      
      await state.update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            toast.info(`Download iniziato... (${(contentLength / 1024 / 1024).toFixed(1)} MB)`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const progress = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
            setState(prev => ({ ...prev, downloadProgress: progress }));
            break;
          case 'Finished':
            setState(prev => ({ ...prev, isDownloading: false, isInstalling: true }));
            toast.success('Download completato! Installazione in corso...');
            break;
        }
      });

      toast.success('Aggiornamento installato! Riavvio in corso...');
      
      // Riavvia l'app
      await relaunch();
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Errore durante l\'aggiornamento';
      setState(prev => ({ 
        ...prev, 
        isDownloading: false, 
        isInstalling: false,
        error: errorMsg 
      }));
      toast.error(`Errore aggiornamento: ${errorMsg}`);
      console.error('Update failed:', error);
    }
  }, [state.update]);

  return {
    ...state,
    hasUpdate: !!state.update?.available,
    version: state.update?.version || null,
    checkForUpdate,
    downloadAndInstall,
  };
};
