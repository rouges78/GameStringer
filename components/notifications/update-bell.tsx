'use client';

import React, { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
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
      .map(line => line.length > 55 ? line.substring(0, 52) + '...' : line)
      .slice(0, 5);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 relative transition-colors ${
            hasUpdate 
              ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={hasUpdate ? 'Aggiornamento disponibile' : 'Nessun aggiornamento'}
        >
          <Bell className="h-4 w-4" />
          {hasUpdate && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-blue-400 rounded-full border border-background" />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        align="end" 
        className="w-72 p-0 bg-slate-900/95 backdrop-blur-sm border-slate-700/50 shadow-xl z-[100]"
        sideOffset={8}
      >
        {hasUpdate && updateInfo ? (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-300 text-xs font-medium">
                v{updateInfo.latest_version} disponibile
                <span className="text-slate-500 font-normal"> (hai {updateInfo.current_version})</span>
              </p>
              <button
                onClick={handleDismiss}
                className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {updateInfo.release_notes && (
              <div className="max-h-24 overflow-y-auto mb-3 pr-1">
                <ul className="space-y-0.5">
                  {parseReleaseNotes(updateInfo.release_notes).map((item, i) => (
                    <li key={i} className="text-slate-400 text-[11px] flex items-start gap-1.5">
                      <span className="text-slate-600 mt-px">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {isDownloading && (
              <div className="mb-2">
                <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="text-slate-500 text-[10px] mt-1">{Math.round(downloadProgress)}%</p>
              </div>
            )}
            
            {isInstalling && (
              <div className="mb-2 flex items-center gap-1.5 text-[11px] text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Installazione...</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading || isInstalling}
                className="inline-flex items-center bg-blue-600 text-white hover:bg-blue-500 h-7 text-[11px] px-3 rounded-md font-medium transition-colors disabled:opacity-50"
              >
                {isDownloading || isInstalling ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Download className="w-3 h-3 mr-1.5" />
                    Scarica
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                disabled={isDownloading || isInstalling}
                className="text-slate-500 hover:text-slate-300 h-7 text-[11px] px-2 rounded-md transition-colors"
              >
                Ignora
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 text-center">
            <p className="text-slate-400 text-xs">Nessun aggiornamento</p>
            <p className="text-slate-500 text-[11px] mt-0.5">Versione corrente aggiornata</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => checkForUpdates()}
              disabled={isChecking}
              className="mt-2 text-[11px] h-7"
            >
              {isChecking ? 'Controllo...' : 'Controlla ora'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
