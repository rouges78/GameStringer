'use client';

import { HardDrive, Download, Loader2 } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';
import { clientLogger } from '@/lib/client-logger';

interface UabeaStatus {
  installed: boolean;
  path?: string;
}

interface AssetsFile {
  file_name: string;
  path: string;
  size_bytes: number;
}

interface UnityAssetsPanelProps {
  installPath: string;
  uabeaStatus: UabeaStatus | null;
  assetsFiles: AssetsFile[];
  showPanel: boolean;
  isDownloadingUabea: boolean;
  onTogglePanel: () => void;
  onStatusLoaded: (status: UabeaStatus) => void;
  onAssetsLoaded: (files: AssetsFile[]) => void;
  onDownloadingChange: (downloading: boolean) => void;
}

export function UnityAssetsPanel({
  installPath,
  uabeaStatus,
  assetsFiles,
  showPanel,
  isDownloadingUabea,
  onTogglePanel,
  onStatusLoaded,
  onAssetsLoaded,
  onDownloadingChange,
}: UnityAssetsPanelProps) {
  const handleToggle = async () => {
    const wasHidden = !showPanel;
    onTogglePanel();
    if (wasHidden && !uabeaStatus) {
      try {
        const [status, files] = await Promise.all([
          invoke<UabeaStatus>('check_uabea_installed'),
          invoke<AssetsFile[]>('find_unity_assets_files', { gamePath: installPath }),
        ]);
        onStatusLoaded(status);
        onAssetsLoaded(files || []);
      } catch (e: unknown) { clientLogger.error('[UABEA]', e); }
    }
  };

  return (
    <div className="rounded-xl bg-[#1b2838]/60 border border-[#2a475e]/40 p-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-[#c6d4df] flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5 text-amber-400" /> Unity Assets (.assets)
        </span>
        <button
          className="text-2xs font-semibold text-[#8f98a0] hover:text-[#c6d4df] transition-colors"
          onClick={handleToggle}
        >
          {showPanel ? '▲ Chiudi' : '▼ Espandi'}
        </button>
      </div>

      {showPanel && (
        <div className="space-y-2">
          {/* UABEA status */}
          <div className={`flex items-center justify-between p-2 rounded-lg text-[11px] ${uabeaStatus?.installed ? 'bg-emerald-500/[0.06] border border-emerald-500/20' : 'bg-amber-500/[0.06] border border-amber-500/20'}`}>
            <span className={uabeaStatus?.installed ? 'text-emerald-300' : 'text-amber-300'}>
              {uabeaStatus === null ? 'Verifica...' : uabeaStatus.installed ? '✓ UABEA installato' : '⚠ UABEA non installato'}
            </span>
            {!uabeaStatus?.installed && (
              <button
                className="text-2xs font-bold px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/20 transition-all disabled:opacity-50"
                disabled={isDownloadingUabea}
                onClick={async () => {
                  onDownloadingChange(true);
                  try {
                    await invoke('download_uabea');
                    const status = await invoke<UabeaStatus>('check_uabea_installed');
                    onStatusLoaded(status);
                    toast.success('UABEA installato!');
                  } catch (e: unknown) {
                    toast.error(`Errore: ${e?.toString?.()}`);
                  } finally { onDownloadingChange(false); }
                }}
              >
                {isDownloadingUabea ? <Loader2 className="h-3 w-3 animate-spin inline" /> : <Download className="h-3 w-3 inline mr-1" />}
                Installa UABEA
              </button>
            )}
          </div>

          {/* File .assets trovati */}
          {assetsFiles.length > 0 ? (
            <div className="space-y-1">
              <span className="text-2xs text-[#8f98a0]/60">{assetsFiles.length} file .assets trovati</span>
              <div className="max-h-[120px] overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
                {assetsFiles.map((af, idx) => (
                  <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#2a475e]/20 hover:bg-[#2a475e]/30 transition-all">
                    <span className="text-[11px] text-[#c6d4df] truncate flex-1">{af.file_name}</span>
                    <span className="text-2xs text-[#8f98a0]/60 ml-2 shrink-0">{(af.size_bytes / 1048576).toFixed(1)} MB</span>
                    {uabeaStatus?.installed && (
                      <button
                        className="ml-2 text-micro font-bold px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition-all shrink-0"
                        onClick={() => invoke('open_assets_with_uabea', { assetsFile: af.path }).catch(e => toast.error(String(e)))}
                      >
                        Apri
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[#8f98a0]/60 text-center py-2">Nessun file .assets trovato nella cartella del gioco</p>
          )}

          <p className="text-2xs text-[#8f98a0]/50">
            UABEA permette di tradurre testi e texture incorporati nei file .assets Unity (come il pacchetto immagini di Blue Prince).
          </p>
        </div>
      )}
    </div>
  );
}
