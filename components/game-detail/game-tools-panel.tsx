'use client';

import { motion } from 'framer-motion';
import {
  Search, Loader2, Zap, Cpu, ImageIcon, Package, Upload, Globe, FolderOpen,
  FileText, CheckCircle, AlertTriangle, Download, Clock, Image as ImageIconLucide
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoke } from '@/lib/tauri-api';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface GameToolsPanelProps {
  game: {
    id?: string;
    appid?: number;
    title?: string;
    name?: string;
    engine?: string;
    installPath?: string;
    platform?: string;
    detectedFiles?: string[];
    developers?: string[];
    publishers?: string[];
    release_date?: { coming_soon?: boolean; date?: string } | string;
    releaseDate?: string | number;
    metacritic?: { score: number; url?: string } | null;
    playtime_forever?: number;
  };
  gameId: string;
  engineInfo: {
    engine: string;
    can_patch: boolean;
    patch_tool: string | null;
    patch_description: string | null;
  } | null;
  patchStatus: { success: boolean; message: string } | null;
  isScanning: boolean;
  isInstallingPatch: boolean;
  isAiUpgrading: boolean;
  isUeAiUpgrading: boolean;
  aiUpgradeProgress: { current: number; total: number } | null;
  ueAiProgress: { current: number; total: number } | null;
  dlcGames: unknown[];
  onScan: () => void;
  onInstallUnityPatch: () => void;
  onInstallUnrealPatch: () => void;
  onUpgradeWithAI: () => void;
  onUpgradeUEWithAI: () => void;
  onOpenCoverPicker: () => void;
  onOpenGspackExport: () => void;
  onOpenGspackImport: () => void;
}

export function GameToolsPanel({
  game,
  gameId,
  engineInfo,
  patchStatus,
  isScanning,
  isInstallingPatch,
  isAiUpgrading,
  isUeAiUpgrading,
  aiUpgradeProgress,
  ueAiProgress,
  dlcGames,
  onScan,
  onInstallUnityPatch,
  onInstallUnrealPatch,
  onUpgradeWithAI,
  onUpgradeUEWithAI,
  onOpenCoverPicker,
  onOpenGspackExport,
  onOpenGspackImport,
}: GameToolsPanelProps) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const showEngine = engineInfo?.engine && engineInfo.engine !== 'Unknown' && engineInfo.engine !== 'Sconosciuto';
  const engineLabel = engineInfo?.engine || game.engine;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      className="space-y-3"
    >
      {/* Quick tools row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button className="h-8 flex items-center gap-1.5 px-3.5 rounded-lg text-[11px] font-semibold bg-[#1a9fff]/10 hover:bg-[#1a9fff]/20 text-[#67c1f5] border border-[#1a9fff]/20 transition-all" onClick={onScan} disabled={isScanning}>
          {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} {t('gameDetails.scan')}
        </button>
        {(engineInfo?.engine?.toLowerCase().includes('unreal') || game.engine?.toLowerCase().includes('unreal')) && game.installPath && (
          <button
            className="h-8 flex items-center gap-1.5 px-3.5 rounded-lg text-[11px] font-semibold bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 transition-all disabled:opacity-50"
            onClick={onUpgradeUEWithAI}
            disabled={isUeAiUpgrading}
            title="Estrae stringhe .locres, le traduce con Ollama AI e crea un _P.pak di override"
          >
            {isUeAiUpgrading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />{ueAiProgress ? `${ueAiProgress.current}/${ueAiProgress.total}` : '...'}</>
            ) : (
              <><Cpu className="h-3.5 w-3.5" />Migliora con AI UE</>
            )}
          </button>
        )}
        {(engineInfo?.engine?.toLowerCase().includes('unity') || game.engine?.toLowerCase().includes('unity')) && game.installPath && (
          <button
            className="h-8 flex items-center gap-1.5 px-3.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-all disabled:opacity-50"
            onClick={onUpgradeWithAI}
            disabled={isAiUpgrading}
            title="Traduce le stringhe catturate da XUnity con Ollama AI e scrive il file di traduzione statica"
          >
            {isAiUpgrading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {aiUpgradeProgress ? `${aiUpgradeProgress.current}/${aiUpgradeProgress.total}` : '...'}
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Migliora con AI
              </>
            )}
          </button>
        )}
        <button className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-[11px] font-semibold bg-[#2a475e]/20 hover:bg-[#2a475e]/40 text-[#8f98a0] border border-[#2a475e]/30 transition-all" onClick={onOpenCoverPicker}>
          <ImageIconLucide className="h-3.5 w-3.5" /> Cover
        </button>
        <button className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-2xs font-semibold bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 transition-all" onClick={onOpenGspackExport}>
          <Package className="h-3 w-3" /> {t('gspack.exportBtn')}
        </button>
        <button className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-2xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition-all" onClick={onOpenGspackImport}>
          <Upload className="h-3 w-3" /> {t('gspack.importBtn')}
        </button>
        {game.platform === 'Steam' && game.appid && game.appid > 0 && (
          <a href={`https://store.steampowered.com/app/${game.appid}`} target="_blank" rel="noopener noreferrer" className="h-8 flex items-center gap-1 px-2.5 rounded-lg text-2xs font-semibold text-[#8f98a0] hover:text-[#67c1f5] hover:bg-[#2a475e]/30 transition-all">
            <Globe className="h-3 w-3" /> Steam
          </a>
        )}
        {game.installPath && (
          <button className="h-8 flex items-center gap-1 px-2.5 rounded-lg text-2xs font-semibold text-[#8f98a0] hover:text-amber-300 hover:bg-amber-500/10 transition-all"
            onClick={async () => { try { await invoke('open_folder_in_explorer', { folderPath: game.installPath }); } catch { toast.error('Impossibile aprire la cartella'); } }}
          >
            <FolderOpen className="h-3 w-3" /> Cartella
          </button>
        )}
      </div>

      {/* File rilevati + Patch status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* File traducibili */}
        <div className="rounded-xl bg-[#1b2838]/60 border border-[#2a475e]/40 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#c6d4df] flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-[#67c1f5]" /> {t('gameDetails.tabFiles')}</span>
            {(game.detectedFiles?.length || 0) > 0 && (
              <span className="text-2xs font-bold text-[#67c1f5] bg-[#1a9fff]/10 px-2 py-0.5 rounded">{game.detectedFiles!.length} file</span>
            )}
          </div>
          {(game.detectedFiles?.length || 0) > 0 ? (
            <div className="max-h-[140px] overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
              {(game.detectedFiles || []).map((file: string, index: number) => (
                <div key={index} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] hover:bg-[#2a475e]/20 transition-all group cursor-pointer"
                  onClick={() => router.push(`/translator?gameId=${gameId}&file=${encodeURIComponent(file)}`)}>
                  <FileText className="h-3 w-3 text-[#8f98a0]/40 shrink-0" />
                  <span className="truncate flex-1 text-[#8f98a0] group-hover:text-[#c6d4df] transition-colors">{file}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[11px] text-[#8f98a0]/60 mb-2">{t('gameDetails.noFilesDetected')}</p>
              <button className="text-2xs font-semibold text-[#67c1f5] hover:text-[#1a9fff] transition-colors" onClick={onScan} disabled={isScanning}>
                {t('gameDetails.searchTranslatableFiles')}
              </button>
            </div>
          )}
        </div>

        {/* Patch & Engine info */}
        <div className="rounded-xl bg-[#1b2838]/60 border border-[#2a475e]/40 p-3.5">
          <span className="text-[11px] font-bold text-[#c6d4df] flex items-center gap-1.5 mb-2"><Zap className="h-3.5 w-3.5 text-[#67c1f5]" /> {t('gameDetails.tabPatch')}</span>
          <div className="space-y-2">
            {game.engine === 'Unity' && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-500/[0.06] border border-sky-500/15">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-sky-400" />
                  <div><span className="text-[11px] font-bold text-sky-300">XUnity AutoTranslator</span></div>
                </div>
                <Button size="xs" className="text-micro font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 rounded-lg border border-sky-500/20 px-2.5" onClick={onInstallUnityPatch} disabled={isInstallingPatch}>
                  {isInstallingPatch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />} Installa
                </Button>
              </div>
            )}
            {game.engine === 'Unreal Engine' && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-violet-500/[0.06] border border-violet-500/15">
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-violet-400" />
                  <div><span className="text-[11px] font-bold text-violet-300">Unreal Translator</span></div>
                </div>
                <Button size="xs" className="text-micro font-bold bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 rounded-lg border border-violet-500/20 px-2.5" onClick={onInstallUnrealPatch} disabled={isInstallingPatch}>
                  {isInstallingPatch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />} Installa
                </Button>
              </div>
            )}
            {patchStatus && (
              <div className={`flex items-center gap-2 p-2 rounded-lg text-[11px] ${patchStatus.success ? 'bg-emerald-500/[0.06] border border-emerald-500/15 text-emerald-300' : 'bg-red-500/[0.06] border border-red-500/15 text-red-300'}`}>
                {patchStatus.success ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                <span className="font-medium">{patchStatus.message}</span>
              </div>
            )}

            {/* Info compatte */}
            <div className="space-y-1.5 pt-1 border-t border-[#2a475e]/30">
              {game.developers?.[0] && (
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-[#8f98a0]/60">Sviluppatore</span>
                  <span className="text-[#c6d4df] font-medium">{game.developers.join(', ')}</span>
                </div>
              )}
              {(typeof game.release_date === 'object' && game.release_date?.date || game.releaseDate) && (
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-[#8f98a0]/60">Uscita</span>
                  <span className="text-[#c6d4df] font-medium">{typeof game.release_date === 'object' && game.release_date?.date || (typeof game.releaseDate === 'number' ? new Date(game.releaseDate * 1000).toLocaleDateString('it-IT', { year: 'numeric', month: 'short', day: 'numeric' }) : game.releaseDate)}</span>
                </div>
              )}
              {showEngine && (
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-[#8f98a0]/60">Engine</span>
                  <span className="text-sky-400 font-bold flex items-center gap-1"><Cpu className="h-2.5 w-2.5" /> {engineLabel}</span>
                </div>
              )}
              {game.metacritic?.score && (
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-[#8f98a0]/60">Metacritic</span>
                  <a
                    href={game.metacritic.url || `https://www.metacritic.com/search/${encodeURIComponent(game.title || '')}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`font-bold hover:underline ${game.metacritic.score >= 80 ? 'text-emerald-400' : game.metacritic.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}
                  >
                    {game.metacritic.score}
                  </a>
                </div>
              )}
              {game.playtime_forever && game.playtime_forever > 0 && (
                <div className="flex items-center justify-between text-2xs">
                  <span className="text-[#8f98a0]/60">Giocato</span>
                  <span className="text-[#c6d4df] font-medium">{Math.round(game.playtime_forever / 60)}h</span>
                </div>
              )}
            </div>

            {/* DLC compatti */}
            {dlcGames.length > 0 && (
              <div className="pt-1 border-t border-[#2a475e]/30">
                <span className="text-micro text-[#8f98a0]/60">DLC: {dlcGames.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
