'use client';

import { Cpu, Loader2, Zap } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';

interface UeLocStatus {
  has_locres: boolean;
  has_gs_pak: boolean;
  gs_pak_path?: string;
  translated_entries: number;
  paks_dir?: string;
  message: string;
}

interface UnrealLocalizationPanelProps {
  installPath: string;
  ueLocStatus: UeLocStatus | null;
  showPanel: boolean;
  isUeAiUpgrading: boolean;
  ueAiProgress: { current: number; total: number } | null;
  onTogglePanel: () => void;
  onLoadStatus: () => Promise<void>;
  onUpgradeUEWithAI: () => void;
}

export function UnrealLocalizationPanel({
  installPath,
  ueLocStatus,
  showPanel,
  isUeAiUpgrading,
  ueAiProgress,
  onTogglePanel,
  onLoadStatus,
  onUpgradeUEWithAI,
}: UnrealLocalizationPanelProps) {
  return (
    <div className="rounded-xl bg-[#1b2838]/60 border border-[#2a475e]/40 p-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-[#c6d4df] flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-violet-400" /> Unreal Localizzazione (.locres)
        </span>
        <button className="text-2xs font-semibold text-[#8f98a0] hover:text-[#c6d4df] transition-colors"
          onClick={async () => { onTogglePanel(); if (!ueLocStatus) await onLoadStatus(); }}>
          {showPanel ? '▲ Chiudi' : '▼ Espandi'}
        </button>
      </div>
      {showPanel && (
        <div className="space-y-2">
          <div className={`flex items-center justify-between p-2 rounded-lg text-[11px] ${
            ueLocStatus?.has_gs_pak ? 'bg-emerald-500/[0.06] border border-emerald-500/20'
            : ueLocStatus?.has_locres ? 'bg-violet-500/[0.06] border border-violet-500/20'
            : 'bg-[#2a475e]/20 border border-[#2a475e]/30'
          }`}>
            <span className={ueLocStatus?.has_gs_pak ? 'text-emerald-300' : ueLocStatus?.has_locres ? 'text-violet-300' : 'text-[#8f98a0]'}>
              {ueLocStatus === null ? 'Caricamento...' : ueLocStatus.message}
            </span>
            {ueLocStatus?.has_gs_pak && (
              <button
                className="text-micro font-bold px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition-all"
                onClick={async () => {
                  try {
                    await invoke('remove_unreal_translation', { gamePath: installPath });
                    await onLoadStatus();
                    toast.success('Patch rimossa');
                  } catch (e: unknown) { toast.error(String(e)); }
                }}
              >Rimuovi</button>
            )}
          </div>
          {ueLocStatus?.has_locres && !ueLocStatus?.has_gs_pak && (
            <button
              className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 transition-all disabled:opacity-50"
              onClick={onUpgradeUEWithAI}
              disabled={isUeAiUpgrading}
            >
              {isUeAiUpgrading ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />{ueAiProgress ? `${ueAiProgress.current}/${ueAiProgress.total}` : '...'}</>) : (<><Zap className="h-3.5 w-3.5" />Migliora con AI — crea _P.pak</>)}
            </button>
          )}
          {ueLocStatus?.paks_dir && (
            <p className="text-2xs text-[#8f98a0]/60">Paks: {ueLocStatus.paks_dir}</p>
          )}
          <p className="text-2xs text-[#8f98a0]/50">Il _P.pak di override viene caricato automaticamente da UE4/UE5 senza modificare i file originali.</p>
        </div>
      )}
    </div>
  );
}
