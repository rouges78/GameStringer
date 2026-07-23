'use client';

// Showcase / Vetrina della community — 2026-07
// Due colonne: classifica traduttori (reputazione, download, pack, rating,
// badge) + pack in vetrina (più scaricati / meglio valutati). La reputazione è
// la valuta che spinge a pubblicare: qui la rendiamo visibile e navigabile.
// Backend Supabase via communityHubService (fail-open: liste vuote se offline).

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy,
  Download,
  Star,
  Package,
  Award,
  BadgeCheck,
  Users,
  Loader2,
  TrendingUp,
  Crown,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  communityHubService,
  type TranslationPack,
} from '@/lib/social/community-hub-service';
import type { LeaderboardEntry } from '@/lib/social/community-hub-service';
import { pickAmbassador } from '@/lib/social/ambassador';

interface ShowcaseProps {
  /** Apre il profilo pubblico del traduttore (per username). */
  onOpenProfile?: (username: string) => void;
}

type PackSort = 'downloads' | 'rating';

function nf(n: number): string {
  return (Number(n) || 0).toLocaleString();
}

// Medaglia per i primi tre; numero per gli altri.
function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',
    2: 'bg-slate-300/15 text-slate-200 ring-1 ring-slate-300/30',
    3: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30',
  };
  return (
    <div
      className={cn(
        'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
        styles[rank] || 'bg-slate-800 text-slate-500'
      )}
    >
      {rank}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  const r = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('h-3 w-3', i <= r ? 'fill-current' : 'text-slate-700')} />
      ))}
    </span>
  );
}

// ─── Ambassador in evidenza (traduttore del mese) ──────────────────────────
// Scelto in automatico dalla leaderboard (download × qualità); nessuna curatela
// manuale → niente favoritismi. Vedi lib/social/ambassador.ts per i criteri.
function AmbassadorSpotlight({
  ambassador,
  onOpenProfile,
}: {
  ambassador: LeaderboardEntry;
  onOpenProfile?: (username: string) => void;
}) {
  const { t } = useTranslation();
  const clickable = !!onOpenProfile;
  return (
    <section className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-slate-900/40 overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-amber-400/20">
        <Crown className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-amber-200">
          {t('showcase.ambassadorTitle') || 'Ambassador in evidenza'}
        </h2>
      </header>
      <button
        type="button"
        disabled={!clickable}
        onClick={() => onOpenProfile?.(ambassador.username)}
        className={cn(
          'w-full flex items-center gap-4 px-4 py-4 text-left',
          clickable && 'hover:bg-amber-500/5 transition-colors'
        )}
      >
        <div className="relative flex-shrink-0">
          <Avatar className="h-14 w-14 ring-2 ring-amber-400/40">
            {ambassador.avatar ? <AvatarImage src={ambassador.avatar} alt={ambassador.username} /> : null}
            <AvatarFallback className="bg-slate-800 text-amber-200 text-sm font-bold">
              {ambassador.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 p-1 shadow-lg">
            <Crown className="h-3 w-3 text-slate-900" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold text-slate-100 truncate">{ambassador.username}</span>
            {ambassador.verifiedTranslator && <BadgeCheck className="h-4 w-4 text-sky-400 flex-shrink-0" />}
            <span className="ml-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
              {t('showcase.ambassadorBadge') || 'Ambassador'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1.5">
            <span className="inline-flex items-center gap-1">
              <Download className="h-3 w-3 text-emerald-400" />
              {nf(ambassador.totalDownloads)}
            </span>
            {ambassador.avgRating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {ambassador.avgRating.toFixed(1)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3 text-indigo-400" />
              {nf(ambassador.publishedPacks)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Award className="h-3 w-3 text-violet-400" />
              {nf(ambassador.reputation)}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {t('showcase.ambassadorCriteria') ||
              'Selezionato automaticamente per download e valutazione media'}
          </p>
        </div>
      </button>
    </section>
  );
}

export function Showcase({ onOpenProfile }: ShowcaseProps) {
  const { t } = useTranslation();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [packs, setPacks] = useState<TranslationPack[]>([]);
  const [packSort, setPackSort] = useState<PackSort>('downloads');
  const [loadingLeaders, setLoadingLeaders] = useState(true);
  const [loadingPacks, setLoadingPacks] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoadingLeaders(true);
    communityHubService
      .getLeaderboard(25)
      .then((rows) => alive && setLeaders(rows))
      .catch(() => alive && setLeaders([]))
      .finally(() => alive && setLoadingLeaders(false));
    return () => {
      alive = false;
    };
  }, []);

  const loadPacks = useCallback((sort: PackSort) => {
    let alive = true;
    setLoadingPacks(true);
    communityHubService
      .getTopPacks(sort, 12)
      .then((rows) => alive && setPacks(rows))
      .catch(() => alive && setPacks([]))
      .finally(() => alive && setLoadingPacks(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => loadPacks(packSort), [packSort, loadPacks]);

  // Ambassador in evidenza: calcolato dai leader già caricati, nessuna chiamata extra.
  const ambassador = useMemo(() => pickAmbassador(leaders), [leaders]);

  return (
    <div className="space-y-6">
      {ambassador && <AmbassadorSpotlight ambassador={ambassador} onOpenProfile={onOpenProfile} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ─── Classifica traduttori ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            {t('showcase.topTranslators') || 'Classifica traduttori'}
          </h2>
        </header>

        {loadingLeaders ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : leaders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Users className="h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">
              {t('showcase.emptyTranslators') || 'Nessun traduttore in classifica per ora.'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {t('showcase.emptyTranslatorsHint') || 'Pubblica un pack per apparire qui.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/40">
            {leaders.map((u, i) => {
              const clickable = !!onOpenProfile;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => onOpenProfile?.(u.username)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                      clickable && 'hover:bg-slate-800/40 transition-colors'
                    )}
                  >
                    <RankBadge rank={i + 1} />
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {u.avatar ? <AvatarImage src={u.avatar} alt={u.username} /> : null}
                      <AvatarFallback className="bg-slate-800 text-slate-300 text-xs">
                        {u.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {u.username}
                        </span>
                        {u.verifiedTranslator && (
                          <BadgeCheck className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Award className="h-3 w-3 text-violet-400" />
                          {nf(u.reputation)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Download className="h-3 w-3 text-emerald-400" />
                          {nf(u.totalDownloads)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3 text-indigo-400" />
                          {nf(u.publishedPacks)}
                        </span>
                        {u.avgRating > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {u.avgRating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ─── Pack in vetrina ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              {t('showcase.topPacks') || 'Pack in vetrina'}
            </h2>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-800/50 p-0.5">
            {(['downloads', 'rating'] as PackSort[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPackSort(s)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  packSort === s
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {s === 'downloads'
                  ? t('showcase.sortDownloads') || 'Più scaricati'
                  : t('showcase.sortRating') || 'Meglio valutati'}
              </button>
            ))}
          </div>
        </header>

        {loadingPacks ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Package className="h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">
              {t('showcase.emptyPacks') || 'Ancora nessun pack pubblicato.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/40">
            {packs.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-shrink-0 w-6 text-center text-xs font-semibold text-slate-600">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{p.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
                    <span className="truncate">{p.gameName}</span>
                    <span className="text-slate-700">·</span>
                    <button
                      type="button"
                      disabled={!onOpenProfile}
                      onClick={() => onOpenProfile?.(p.author.username)}
                      className={cn(
                        'truncate',
                        onOpenProfile && 'hover:text-violet-300 transition-colors'
                      )}
                    >
                      {p.author.username}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                    <Download className="h-3 w-3" />
                    {nf(p.downloads)}
                  </span>
                  {p.rating > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Stars rating={p.rating} />
                      <span>{p.rating.toFixed(1)}</span>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

export default Showcase;
