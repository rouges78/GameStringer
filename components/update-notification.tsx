'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@/lib/tauri-api';
import { X, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { open } from '@tauri-apps/plugin-shell';
import { toast } from 'sonner';

interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_notes: string | null;
  download_url: string | null;
  published_at: string | null;
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Check per aggiornamenti all'avvio (con delay per non rallentare startup)
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const checkForUpdates = async () => {
    if (checking) return;
    setChecking(true);
    
    try {
      const info = await invoke<UpdateInfo>('check_for_updates');
      console.log('Update info received:', info);
      if (info && info.update_available) {
        setUpdateInfo(info);
        // Salva in localStorage per non mostrare troppo spesso
        const lastDismissed = localStorage.getItem('update_dismissed_version');
        if (lastDismissed === info.latest_version) {
          setDismissed(true);
        }
      }
    } catch (error) {
      console.warn('Update check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (updateInfo) {
      localStorage.setItem('update_dismissed_version', updateInfo.latest_version);
    }
  };

  const handleDownload = async () => {
    if (updateInfo?.download_url) {
      toast.info(`Apertura: ${updateInfo.download_url}`);
      try {
        await open(updateInfo.download_url);
        toast.success('Browser aperto!');
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        toast.error(`Errore Tauri: ${errorMsg}`);
        // Fallback per browser
        window.open(updateInfo.download_url, '_blank', 'noopener,noreferrer');
      }
    } else {
      toast.error('URL download non disponibile');
    }
  };

  // Do not show se non c'è update o è stato dismissato
  if (!updateInfo || !updateInfo.update_available || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-2xl p-4 max-w-sm border border-purple-400/30">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">
                Aggiornamento disponibile!
              </h3>
              <button
                onClick={handleDismiss}
                className="text-white/70 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-white/80 text-xs mt-1">
              Versione <span className="font-mono">{updateInfo.latest_version}</span> disponibile
              <span className="text-white/60"> (attuale: {updateInfo.current_version})</span>
            </p>
            
            {updateInfo.release_notes && (
              <p className="text-white/70 text-xs mt-2 line-clamp-2">
                {updateInfo.release_notes
                  .replace(/^##\s*/gm, '')
                  .replace(/\*\*/g, '')
                  .replace(/\*/g, '')
                  .slice(0, 100)}...
              </p>
            )}
            
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  toast.info('Click rilevato!');
                  handleDownload();
                }}
                className="inline-flex items-center bg-white text-purple-700 hover:bg-white/90 h-7 text-xs px-3 rounded-md font-medium"
              >
                <Download className="w-3 h-3 mr-1" />
                Scarica
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-white/80 hover:text-white hover:bg-white/10 h-7 text-xs"
              >
                Dopo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



