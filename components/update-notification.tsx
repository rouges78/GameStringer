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
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-slate-900 rounded-xl shadow-2xl shadow-black/50 p-4 w-80 border border-slate-700/50">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">
                Aggiornamento disponibile!
              </h3>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-slate-300 text-xs mt-1">
              Versione <span className="font-mono text-emerald-400">{updateInfo.latest_version}</span>
              <span className="text-slate-500"> (attuale: {updateInfo.current_version})</span>
            </p>
            
            {releaseItems.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1.5">Novità:</p>
                <ul className="space-y-1">
                  {releaseItems.slice(0, 8).map((item, i) => (
                    <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  handleDownload();
                }}
                className="inline-flex items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 h-8 text-xs px-4 rounded-lg font-medium shadow-lg shadow-emerald-500/25 transition-all"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Scarica
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 text-xs"
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



