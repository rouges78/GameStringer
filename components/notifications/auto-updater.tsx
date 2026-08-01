'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, RefreshCw, X, Sparkles } from 'lucide-react';
import { useTauriUpdater } from '@/hooks/use-tauri-updater';
import { useUpdateCheck } from '@/hooks/use-update-check';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';

/**
 * AutoUpdater - Notifica aggiornamento stile Claude Code
 * 
 * Appare automaticamente quando c'è un update disponibile.
 * Un click su "Aggiorna" → download → install → relaunch.
 * Nessun popup, nessun dialog, nessuna segatura.
 */
export function AutoUpdater() {
  const { t } = useTranslation();
  const { updateInfo, hasUpdate, dismissUpdate } = useUpdateCheck();
  const {
    isDownloading,
    isInstalling,
    downloadProgress,
    downloadAndInstall,
    checkForUpdate: checkTauriUpdate,
    error,
  } = useTauriUpdater();
  
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Reset dismissed quando cambia versione
  useEffect(() => {
    if (updateInfo?.latest_version) {
      const dismissedVersion = localStorage.getItem('gs_dismissed_update');
      if (dismissedVersion !== updateInfo.latest_version) {
        setDismissed(false);
      }
    }
  }, [updateInfo?.latest_version]);
  
  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      // Prima verifica con Tauri updater
      const update = await checkTauriUpdate();
      if (update?.available) {
        // Passa l'update appena ottenuto: NON affidarsi allo stato del hook,
        // che nello stesso tick è ancora stantio (causa blocco "Preparazione...").
        await downloadAndInstall(update);
      } else {
        // Fallback: apri URL download
        if (updateInfo?.download_url) {
          window.open(updateInfo.download_url, '_blank');
        }
      }
    } catch (err) {
      console.error('[AutoUpdater] Error:', err);
      // Fallback su errore
      if (updateInfo?.download_url) {
        window.open(updateInfo.download_url, '_blank');
      }
    } finally {
      // Sblocca sempre il bottone, anche su return silenzioso o errore.
      setUpdating(false);
    }
  }, [checkTauriUpdate, downloadAndInstall, updateInfo?.download_url]);
  
  const handleDismiss = () => {
    setDismissed(true);
    if (updateInfo?.latest_version) {
      localStorage.setItem('gs_dismissed_update', updateInfo.latest_version);
    }
    dismissUpdate();
  };
  
  // Non mostrare se non c'è update o è stato dismissato
  if (!hasUpdate || dismissed || !updateInfo) return null;
  
  const isWorking = isDownloading || isInstalling || updating;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-20 right-4 z-[100] max-w-xs"
      >
        <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 rounded-xl shadow-2xl shadow-emerald-500/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/10">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg">
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {t('autoUpdaterComp.updateAvailable')}
              </p>
              <p className="text-xs text-slate-400">
                v{updateInfo.current_version} → v{updateInfo.latest_version}
              </p>
            </div>
            {!isWorking && (
              <button
                onClick={handleDismiss}
                className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Progress bar durante download */}
          {isDownloading && (
            <div className="px-4 py-2 bg-slate-800/50">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>{t('autoUpdaterComp.downloadInProgress')}</span>
                <span>{Math.round(downloadProgress)}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${downloadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
          
          {/* Installing message */}
          {isInstalling && (
            <div className="px-4 py-3 bg-slate-800/50 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
              <span className="text-sm text-emerald-400">{t('autoUpdaterComp.installingRestartSoon')}</span>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="px-4 py-2 bg-red-500/10 text-xs text-red-400">
              {error}
            </div>
          )}
          
          {/* Action button */}
          {!isInstalling && (
            <div className="px-4 py-3">
              <button
                onClick={handleUpdate}
                disabled={isWorking}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('autoUpdaterComp.downloading')}
                  </>
                ) : updating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('autoUpdaterComp.preparing')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {t('autoUpdaterComp.updateNow')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

