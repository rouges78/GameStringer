'use client';

import React, { useState } from 'react';
import { Bell, Loader2, CheckCircle2, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdateCheck } from '@/hooks/use-update-check';
import { useTauriUpdater } from '@/hooks/use-tauri-updater';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Download, X } from 'lucide-react';
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
      const update = await checkTauriUpdate();
      if (update?.available) {
        await downloadAndInstall();
      } else if (updateInfo?.download_url) {
        await open(updateInfo.download_url);
        toast.success('Browser aperto per il download!');
        setIsOpen(false);
      }
    } catch {
      if (updateInfo?.download_url) {
        window.open(updateInfo.download_url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleDismiss = () => {
    dismissUpdate();
    setIsOpen(false);
  };

  const parseReleaseNotes = (notes: string) => {
    return notes
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').replace(/`/g, '').trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('Download') && line.length > 5)
      .map(line => line.length > 60 ? line.substring(0, 57) + '...' : line)
      .slice(0, 6);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 relative transition-all duration-200 ${
            hasUpdate 
              ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={hasUpdate ? 'Aggiornamento disponibile!' : 'Nessun aggiornamento'}
        >
          <Bell className="h-4 w-4" />
          {hasUpdate && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-emerald-400 rounded-full border-2 border-background animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        align="end" 
        className="w-80 p-0 bg-slate-900/98 backdrop-blur-md border-slate-700/60 shadow-2xl shadow-black/40 z-[100] rounded-xl overflow-hidden"
        sideOffset={8}
      >
        {hasUpdate && updateInfo ? (
          <div>
            <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-emerald-500/20 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-white text-[13px] font-semibold">
                    v{updateInfo.latest_version}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    disponibile
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
              {updateInfo.release_notes && (
                <div className="max-h-28 overflow-y-auto mb-3 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider font-medium mb-1.5">Novità</p>
                  <ul className="space-y-1">
                    {parseReleaseNotes(updateInfo.release_notes).map((item, i) => (
                      <li key={i} className="text-slate-300 text-[11px] flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5 text-[8px]">●</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {isDownloading && (
                <div className="mb-3">
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 rounded-full"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-slate-500 text-[10px] mt-1 text-right">{Math.round(downloadProgress)}%</p>
                </div>
              )}
              
              {isInstalling && (
                <div className="mb-3 flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Installazione in corso...</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading || isInstalling}
                  className="inline-flex items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 h-8 text-xs px-4 rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                  {isDownloading || isInstalling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Scarica
                    </>
                  )}
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={isDownloading || isInstalling}
                  className="text-slate-500 hover:text-slate-300 h-8 text-xs px-3 rounded-lg transition-colors hover:bg-slate-800/50"
                >
                  Ignora
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
            <p className="text-slate-300 text-xs font-medium">Tutto aggiornato!</p>
            <p className="text-slate-500 text-[11px] mt-0.5">
              v{updateInfo?.current_version || '1.4.1'}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => checkForUpdates()}
              disabled={isChecking}
              className="mt-3 text-[11px] h-7 text-slate-400 hover:text-white"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                  Controllo...
                </>
              ) : (
                'Controlla ora'
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
