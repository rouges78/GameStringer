'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Download, Cpu, Loader2 } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import { toast } from 'sonner';

interface UpdateStatus {
  current_build_id: string;
  known_build_id: string;
  update_detected: boolean;
  patch_intact: boolean;
  patch_type: string;
  patch_details: string[];
  message: string;
}

interface GameUpdateBannerProps {
  updateStatus: UpdateStatus;
  installPath?: string;
  targetLang: string;
  isDismissing: boolean;
  isUntracking: boolean;
  isUeAiUpgrading: boolean;
  onDismiss: () => void;
  onUntrack: () => void;
  onUpgradeUEWithAI: () => void;
}

export function GameUpdateBanner({
  updateStatus,
  installPath,
  targetLang,
  isDismissing,
  isUntracking,
  isUeAiUpgrading,
  onDismiss,
  onUntrack,
  onUpgradeUEWithAI,
}: GameUpdateBannerProps) {
  if (!updateStatus.update_detected && (updateStatus.patch_intact || updateStatus.patch_type === 'none')) {
    return null;
  }

  const isPatchDamaged = !updateStatus.patch_intact && updateStatus.patch_type !== 'none';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-3 flex items-start gap-3 ${
        isPatchDamaged
          ? 'bg-red-500/[0.08] border-red-500/25'
          : 'bg-amber-500/[0.08] border-amber-500/25'
      }`}
    >
      <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${isPatchDamaged ? 'text-red-400' : 'text-amber-400'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-semibold ${isPatchDamaged ? 'text-red-300' : 'text-amber-300'}`}>
          {isPatchDamaged
            ? 'Patch di traduzione danneggiata'
            : 'Gioco aggiornato — verifica traduzione'}
        </p>
        <p className="text-[11px] text-[#8f98a0] mt-0.5">{updateStatus.message}</p>
        {updateStatus.patch_details.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {updateStatus.patch_details.map((d, i) => (
              <p key={i} className="text-2xs text-[#8f98a0]/70">{d}</p>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Riapplica patch */}
          {updateStatus.patch_type === 'bepinex' && installPath && (
            <button
              className="h-6 px-2.5 rounded-lg text-2xs font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/20 transition-all flex items-center gap-1"
              onClick={async () => {
                try {
                  let exeName = '';
                  const exeList = await invoke<string[]>('find_executables_in_folder', { folderPath: installPath }).catch(() => [] as string[]);
                  if (exeList?.length) exeName = exeList[0];
                  await invoke('install_unity_autotranslator', { gamePath: installPath, gameExeName: exeName, targetLang: targetLang || 'it', translationMode: 'google' });
                  toast.success('Patch BepInEx riapplicata!');
                } catch (e: unknown) { toast.error(String(e)); }
              }}
            >
              <Download className="h-3 w-3" /> Riapplica BepInEx
            </button>
          )}
          {updateStatus.patch_type === 'unreal_pak' && installPath && (
            <button
              className="h-6 px-2.5 rounded-lg text-2xs font-bold bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/20 transition-all flex items-center gap-1"
              onClick={onUpgradeUEWithAI}
              disabled={isUeAiUpgrading}
            >
              <Cpu className="h-3 w-3" /> Rigenera _P.pak
            </button>
          )}
          {/* Segna come visto */}
          <button
            className="h-6 px-2.5 rounded-lg text-2xs font-semibold bg-white/5 hover:bg-white/10 text-[#8f98a0] hover:text-[#c6d4df] border border-white/10 transition-all"
            onClick={onDismiss}
            disabled={isDismissing}
          >
            {isDismissing ? <Loader2 className="h-3 w-3 animate-spin inline" /> : null} Segna come visto
          </button>
          {/* Smetti di monitorare */}
          <button
            className="h-6 px-2.5 rounded-lg text-2xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300/80 hover:text-red-200 border border-red-500/20 transition-all"
            onClick={onUntrack}
            disabled={isUntracking}
            title="Rimuovi questo gioco dal monitoraggio aggiornamenti/patch"
          >
            {isUntracking ? <Loader2 className="h-3 w-3 animate-spin inline" /> : null} Smetti di monitorare
          </button>
        </div>
      </div>
      <span className="text-micro font-mono text-[#8f98a0]/50 shrink-0">build {updateStatus.current_build_id}</span>
    </motion.div>
  );
}
