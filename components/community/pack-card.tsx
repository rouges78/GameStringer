'use client';

import { Package, Star, ShieldCheck, Globe, Download } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { TranslationPack } from '@/lib/social/community-hub-service';

// Card pack condivisa tra Patch Hub e tab Pack del Community Hub.
// Estratta da app/patch-hub/page.tsx il 09/08/2026: due copie sarebbero
// derivate l'una dall'altra e divergerebbero alla prima modifica.

// Solo le classi colore; le etichette di stato arrivano da i18n (patchHubPage.status*).
export const STATUS_CLS: Record<TranslationPack['status'], string> = {
  draft: 'bg-slate-700/40 text-slate-400',
  published: 'bg-amber-500/15 text-amber-300',
  verified: 'bg-emerald-500/15 text-emerald-300',
  featured: 'bg-orange-500/15 text-orange-300',
};
export const STATUS_KEY: Record<TranslationPack['status'], string> = {
  draft: 'statusDraft',
  published: 'statusPublished',
  verified: 'statusVerified',
  featured: 'statusFeatured',
};

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400">
      <Star className="h-3.5 w-3.5 fill-amber-400" />
      <span className="text-xs font-medium text-slate-300">{rating.toFixed(1)}</span>
    </span>
  );
}

export function PackCard({ pack, onOpen }: { pack: TranslationPack; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => onOpen(pack.id)}
      className="group text-left rounded-xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900/70 hover:border-amber-500/30 transition-all p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Package className="h-4.5 w-4.5 text-amber-400" />
        </div>
        <span className="flex items-center gap-1.5">
          {pack.contentSha256 && (
            <span title={t('patchHubPage.integrityDesc')} className="inline-flex items-center text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[pack.status]}`}>
            {t(`patchHubPage.${STATUS_KEY[pack.status]}`)}
          </span>
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-200 truncate group-hover:text-amber-200">{pack.name}</h3>
        <p className="text-xs text-slate-500 truncate">{pack.gameName}</p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <Globe className="h-3 w-3" />
        <span className="uppercase">{pack.sourceLanguage}</span>
        <span>→</span>
        <span className="uppercase font-medium text-slate-300">{pack.targetLanguage}</span>
        <span className="text-slate-600">·</span>
        <span>v{pack.version}</span>
      </div>
      {/* Completion bar */}
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
          style={{ width: `${Math.min(100, pack.completionPercentage)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{pack.completionPercentage}% {t('patchHubPage.translated')}</span>
        <span className="flex items-center gap-2">
          <Stars rating={pack.rating} />
          <span className="flex items-center gap-0.5"><Download className="h-3 w-3" />{pack.downloads.toLocaleString()}</span>
        </span>
      </div>
    </button>
  );
}
