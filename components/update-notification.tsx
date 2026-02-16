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

  // Parse release notes in lista
  const parseReleaseNotes = (notes: string) => {
    return notes
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim())
      .filter(line => line && !line.startsWith('#'));
  };

  const releaseItems = updateInfo.release_notes ? parseReleaseNotes(updateInfo.release_notes) : [];

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-slate-900/98 backdrop-blur-md rounded-xl shadow-2xl shadow-black/50 w-80 border border-slate-700/50 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-emerald-500/20 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-white text-[13px] font-semibold">
                v{updateInfo.latest_version} disponibile
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-slate-800/50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-500 text-[10px] mt-0.5">
            Versione attuale: {updateInfo.current_version}
          </p>
        </div>
        
        <div className="px-4 py-3">
          {releaseItems.length > 0 && (
            <div className="max-h-28 overflow-y-auto mb-3 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1.5">Novità</p>
              <ul className="space-y-1">
                {releaseItems.slice(0, 6).map((item, i) => (
                  <li key={i} className="text-slate-300 text-[11px] flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5 text-[8px]">●</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { handleDownload(); }}
              className="inline-flex items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 h-8 text-xs px-4 rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Scarica
            </button>
            <button
              onClick={handleDismiss}
              className="text-slate-500 hover:text-slate-300 h-8 text-xs px-3 rounded-lg transition-colors hover:bg-slate-800/50"
            >
              Ignora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



