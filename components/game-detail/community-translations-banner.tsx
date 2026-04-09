'use client';

import { motion } from 'framer-motion';
import { Globe, ExternalLink, FolderOpen, Loader2 } from 'lucide-react';
import { invoke } from '@/lib/tauri-api';

interface CommunityTranslation {
  id: string;
  title: string;
  author: string;
  state: string;
  revision: string;
  version: string;
  steam_app_id: string | null;
  page_url: string;
  download_url: string;
  updated_at: string;
}

interface CommunityTranslationsBannerProps {
  translations: CommunityTranslation[];
  installPath?: string;
  isInstallingZip: boolean;
  onInstallZip: () => void;
}

export function CommunityTranslationsBanner({
  translations,
  installPath,
  isInstallingZip,
  onInstallZip,
}: CommunityTranslationsBannerProps) {
  if (translations.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3"
    >
      <div className="flex items-start gap-2.5">
        <Globe className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-emerald-300">
            Traduzione italiana disponibile su GameTranslator.it
          </p>
          <div className="mt-1.5 space-y-1.5">
            {translations.slice(0, 3).map((tr) => (
              <div key={tr.id} className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-[#c6d4df] font-medium truncate max-w-[220px]">{tr.title}</span>
                {tr.state && (
                  <span className={`text-micro font-bold px-1.5 py-0.5 rounded-full border ${
                    tr.state === '100%' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                  }`}>{tr.state}</span>
                )}
                {tr.revision && <span className="text-micro text-[#8f98a0]">rev. {tr.revision}</span>}
                {tr.author && <span className="text-micro text-[#8f98a0]">by {tr.author}</span>}
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  <button
                    className="h-5 px-2 rounded text-2xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 transition-all flex items-center gap-1"
                    onClick={() => invoke('open_gamestranslator_page', { url: tr.page_url }).catch(() => window.open(tr.page_url, '_blank'))}
                  >
                    <ExternalLink className="h-2.5 w-2.5" /> Scarica
                  </button>
                </div>
              </div>
            ))}
          </div>
          {installPath && (
            <button
              className="mt-2 h-6 px-2.5 rounded-lg text-2xs font-semibold bg-white/5 hover:bg-white/10 text-[#8f98a0] hover:text-[#c6d4df] border border-white/10 transition-all flex items-center gap-1.5"
              onClick={onInstallZip}
              disabled={isInstallingZip}
            >
              {isInstallingZip ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderOpen className="h-3 w-3" />}
              Installa ZIP scaricato...
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
