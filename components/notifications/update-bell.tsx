'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdateCheck } from '@/hooks/use-update-check';
import { useTauriUpdater } from '@/hooks/use-tauri-updater';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Download, Sparkles, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { toast } from 'sonner';

export function UpdateBell() {
  const { updateInfo, hasUpdate, isChecking, checkForUpdates, dismissUpdate } = useUpdateCheck();
  const { 
    isDownloading, 
    isInstalling, 
    downloadProgress, 
    downloadAndInstall,
    checkForUpdate: checkTauriUpdate 
  } = useTauriUpdater();
  const [isOpen, setIsOpen] = useState(false);

  const handleDownload = async () => {
    try {
      // Prova prima l'aggiornamento diretto in-app
      const update = await checkTauriUpdate();
      if (update?.available) {
        await downloadAndInstall();
      } else if (updateInfo?.download_url) {
        // Fallback al browser se l'updater non è disponibile
        await open(updateInfo.download_url);
        toast.success('Browser aperto per il download!');
        setIsOpen(false);
      }
    } catch (e) {
      // Fallback al browser
      if (updateInfo?.download_url) {
        window.open(updateInfo.download_url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const parseReleaseNotes = (notes: string) => {
    return notes
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').trim())
      .filter(line => line && !line.startsWith('#'))
      .slice(0, 6);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 relative transition-all duration-300 ${
            hasUpdate 
              ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={hasUpdate ? 'Aggiornamento disponibile!' : 'Nessun aggiornamento'}
        >
          <Bell className={`h-4 w-4 ${hasUpdate ? 'animate-pulse' : ''}`} />
          {hasUpdate && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-yellow-400 rounded-full border-2 border-background animate-pulse shadow-lg shadow-yellow-400/50" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        align="end" 
        className="w-80 p-0 bg-slate-900/95 backdrop-blur-xl border-slate-700/50 shadow-2xl shadow-black/50 z-[100]"
        sideOffset={8}
      >
        {hasUpdate && updateInfo ? (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">
                    Aggiornamento disponibile!
                  </h3>
                </div>
                
                <p className="text-slate-300 text-xs mt-1">
                  Versione <span className="font-mono text-yellow-400">{updateInfo.latest_version}</span>
                  <span className="text-slate-500"> (attuale: {updateInfo.current_version})</span>
                </p>
                
                {updateInfo.release_notes && (
                  <div className="mt-3 max-h-32 overflow-y-auto pr-1">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1.5">Novità:</p>
                    <ul className="space-y-1">
                      {parseReleaseNotes(updateInfo.release_notes).map((item, i) => (
                        <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5">
                          <span className="text-yellow-500 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {isDownloading && (
                  <div className="mt-3 mb-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Scaricamento...</span>
                      <span>{Math.round(downloadProgress)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {isInstalling && (
                  <div className="mt-3 mb-2 flex items-center gap-2 text-xs text-yellow-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Installazione in corso...</span>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading || isInstalling}
                    className="inline-flex items-center bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:from-yellow-600 hover:to-amber-700 h-8 text-xs px-4 rounded-lg font-medium shadow-lg shadow-yellow-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloading || isInstalling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        {isInstalling ? 'Installazione...' : 'Scaricamento...'}
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Aggiorna Ora
                      </>
                    )}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      dismissUpdate();
                      setIsOpen(false);
                    }}
                    disabled={isDownloading || isInstalling}
                    className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 text-xs"
                  >
                    Dopo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center">
            <Bell className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Nessun aggiornamento</p>
            <p className="text-slate-500 text-xs mt-1">
              Stai usando l'ultima versione
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => checkForUpdates()}
              disabled={isChecking}
              className="mt-3 text-xs"
            >
              {isChecking ? 'Controllo...' : 'Controlla ora'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
