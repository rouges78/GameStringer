'use client';

// Panoramica del Community Hub — vista "viva" con attività recente, pack
// recenti, categorie e novità dal mondo traduzioni. Con community vuota
// mostra un'esperienza guidata invece dell'impalcatura a zero.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  MessageSquarePlus,
  Package,
  Download,
  Eye,
  Flame,
  Clock,
  ChevronRight,
  Plus,
  Globe,
  ExternalLink,
  HelpCircle,
  Trophy,
  Megaphone,
  BookOpen,
  Coffee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslation } from '@/lib/i18n';
import {
  getCategories,
  getThreads,
  type ForumCategory,
  type ForumThread,
} from '@/lib/social/forum';
import { newsFeedService, type NewsFeedItem } from '@/lib/news-feeds';
import { communityHubService, type TranslationPack } from '@/lib/social/community-hub-service';
import { formatDistanceToNow } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// `t()` ritorna la CHIAVE quando la traduzione manca (vedi lib/i18n/index.tsx),
// quindi il vecchio `t(k) || cat.name` non ricadeva mai sul nome dal DB: una
// categoria senza traduzione mostrava "forum.categoryNames.<slug>" a schermo.
// Qui confrontiamo col valore della chiave per capire se la traduzione esiste.
function useCategoryLabel(t: (k: string) => string) {
  return (slug: string, fallbackName: string) => {
    const key = `forum.categoryNames.${slug}`;
    const value = t(key);
    return value === key ? fallbackName : value;
  };
}


type Locale = typeof it;

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'announcements': Megaphone,
  'translation-packs': Package,
  'help': HelpCircle,
  'tutorials': BookOpen,
  'requests': MessageSquarePlus,
  'showcase': Trophy,
  'off-topic': Coffee,
};

const CATEGORY_ACCENTS: Record<string, string> = {
  'announcements': 'text-rose-400',
  'translation-packs': 'text-amber-400',
  'help': 'text-cyan-400',
  'tutorials': 'text-violet-400',
  'requests': 'text-emerald-400',
  'showcase': 'text-yellow-400',
  'off-topic': 'text-slate-400',
};

interface CommunityOverviewProps {
  onOpenThread: (thread: ForumThread) => void;
  onNewThread: (categorySlug?: string) => void;
  onGoDiscussions: (categorySlug?: string) => void;
  onGoPacks: () => void;
}

export function CommunityOverview({
  onOpenThread,
  onNewThread,
  onGoDiscussions,
  onGoPacks,
}: CommunityOverviewProps) {
  const { t, language } = useTranslation();
  const categoryLabel = useCategoryLabel(t);
  const router = useRouter();
  const locale = language === 'it' ? it : enUS;

  const [loading, setLoading] = useState(true);
  const [trending, setTrending] = useState<ForumThread[]>([]);
  const [recent, setRecent] = useState<ForumThread[]>([]);
  const [packs, setPacks] = useState<TranslationPack[]>([]);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [news, setNews] = useState<NewsFeedItem[]>([]);
  const [totalThreads, setTotalThreads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [trendingRes, recentRes, packsRes, catsRes] = await Promise.allSettled([
        getThreads({ sort: 'popular', limit: 4, page: 1 }),
        getThreads({ sort: 'newest', limit: 6, page: 1 }),
        // Pack VERI da translation_packs (stessa fonte del Patch Hub e della
        // tab Pack). Prima: getThreads(is_translation_pack) → thread del
        // forum, dataset scollegato dai pack pubblicati.
        communityHubService.searchPacks({ sortBy: 'updated', sortOrder: 'desc', limit: 3 }),
        getCategories(),
      ]);
      if (cancelled) return;
      if (trendingRes.status === 'fulfilled') setTrending(trendingRes.value.threads);
      if (recentRes.status === 'fulfilled') {
        setRecent(recentRes.value.threads);
        setTotalThreads(recentRes.value.total);
      }
      if (packsRes.status === 'fulfilled') setPacks(packsRes.value.packs);
      if (catsRes.status === 'fulfilled') setCategories(catsRes.value);
      setLoading(false);
    })();

    // Novità traduzioni (feed RSS categoria translations) — non blocca il resto
    newsFeedService
      .fetchNews()
      .then((items) => {
        if (!cancelled) {
          setNews(items.filter((i) => i.category === 'translations').slice(0, 5));
        }
      })
      .catch(() => { /* silenzioso */ });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <OverviewSkeleton />;
  }

  const isEmpty = totalThreads === 0;

  return (
    <div className="space-y-8">
      {/* ── Esperienza guidata a community vuota ─────────────────────────── */}
      {isEmpty && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">
            {t('communityHub.welcomeTitle') || 'Benvenuto nella community! 👋'}
          </h2>
          <p className="text-sm text-slate-400 mb-5 max-w-2xl">
            {t('communityHub.welcomeSubtitle') ||
              'Qui si condividono traduzioni, si chiede aiuto e si mostrano i propri progetti. La community è appena nata: ogni contributo conta doppio.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StarterCard
              icon={MessageSquarePlus}
              accent="text-violet-400"
              title={t('communityHub.starterThread') || 'Apri la prima discussione'}
              description={t('communityHub.starterThreadDesc') || 'Presentati o racconta a cosa stai lavorando.'}
              onClick={() => onNewThread()}
            />
            <StarterCard
              icon={Package}
              accent="text-amber-400"
              title={t('communityHub.starterPack') || 'Pubblica un Translation Pack'}
              description={t('communityHub.starterPackDesc') || 'Condividi una traduzione completata con altri giocatori.'}
              onClick={() => router.push('/patch-hub')}
            />
            <StarterCard
              icon={HelpCircle}
              accent="text-cyan-400"
              title={t('communityHub.starterHelp') || 'Chiedi aiuto'}
              description={t('communityHub.starterHelpDesc') || 'Bloccato su un engine o un formato? Qualcuno ci è già passato.'}
              onClick={() => onNewThread('help')}
            />
          </div>
        </section>
      )}

      {/* ── In evidenza ──────────────────────────────────────────────────── */}
      {trending.length > 0 && (
        <section>
          <SectionHeader
            icon={Flame}
            iconClass="text-rose-400"
            title={t('forum.trendingNow') || 'In evidenza'}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {trending.map((thread) => (
              <FeaturedCard key={thread.id} thread={thread} locale={locale} onClick={() => onOpenThread(thread)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Attività recente + Ultimi pack (due colonne) ─────────────────── */}
      {!isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2">
            <SectionHeader
              icon={Clock}
              iconClass="text-violet-400"
              title={t('communityHub.recentActivity') || 'Attività recente'}
              action={
                <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white" onClick={() => onGoDiscussions()}>
                  {t('communityHub.seeAll') || 'Vedi tutte'} <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              }
            />
            <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/70 overflow-hidden">
              {recent.map((thread) => (
                <ActivityRow key={thread.id} thread={thread} locale={locale} onClick={() => onOpenThread(thread)} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader
              icon={Package}
              iconClass="text-amber-400"
              title={t('communityHub.latestPacks') || 'Ultimi pack'}
              action={
                <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white" onClick={onGoPacks}>
                  {t('communityHub.seeAll') || 'Vedi tutti'} <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              }
            />
            {packs.length > 0 ? (
              <div className="space-y-2">
                {packs.map((pack) => (
                  <PackRow
                    key={pack.id}
                    pack={pack}
                    onClick={() => router.push(`/patch-hub?id=${encodeURIComponent(pack.id)}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 p-5 text-center">
                <Package className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 mb-3">
                  {t('communityHub.noPacksYet') || 'Nessun pack pubblicato ancora.'}
                </p>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => router.push('/patch-hub')}>
                  {t('communityHub.publishFirst') || 'Pubblica il primo'}
                </Button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Categorie (griglia compatta) ─────────────────────────────────── */}
      {categories.length > 0 && (
        <section>
          <SectionHeader
            icon={MessageSquare}
            iconClass="text-indigo-400"
            title={t('forum.categories') || 'Categorie'}
            action={
              <Button
                onClick={() => onNewThread()}
                size="sm"
                className="bg-violet-600 hover:bg-violet-500 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('forum.newThread') || 'Nuova discussione'}
              </Button>
            }
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.slug] || MessageSquare;
              const accent = CATEGORY_ACCENTS[cat.slug] || 'text-indigo-400';
              return (
                <button
                  key={cat.id}
                  onClick={() => onGoDiscussions(cat.slug)}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-left transition-colors hover:border-slate-700 hover:bg-slate-900/70"
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', accent)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {categoryLabel(cat.slug, cat.name)}
                    </div>
                    <div className="text-2xs text-slate-500">
                      {cat.thread_count || 0} {t('forum.discussions') || 'discussioni'}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Dal mondo traduzioni (feed RSS) ──────────────────────────────── */}
      {news.length > 0 && (
        <section>
          <SectionHeader
            icon={Globe}
            iconClass="text-emerald-400"
            title={t('communityHub.translationNews') || 'Dal mondo traduzioni'}
            action={
              <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white" onClick={() => router.push('/info')}>
                {t('communityHub.allNews') || 'Tutte le news'} <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            }
          />
          <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/70 overflow-hidden">
            {news.map((item) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-900/70 group"
              >
                <span className="text-base flex-shrink-0" aria-hidden>{item.sourceIcon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-200 truncate group-hover:text-white">{item.title}</div>
                  <div className="text-2xs text-slate-500">
                    {item.sourceName} · {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale })}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Sotto-componenti ────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconClass,
  title,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Icon className={cn('h-4 w-4', iconClass)} />
        {title}
      </h2>
      {action}
    </div>
  );
}

function StarterCard({
  icon: Icon,
  accent,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-left transition-colors hover:border-slate-700 hover:bg-slate-900/70"
    >
      <Icon className={cn('h-5 w-5 mb-2.5', accent)} />
      <div className="text-sm font-medium text-slate-200 mb-1">{title}</div>
      <div className="text-xs text-slate-500 leading-relaxed">{description}</div>
    </button>
  );
}

function FeaturedCard({ thread, locale, onClick }: { thread: ForumThread; locale: Locale; onClick: () => void }) {
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel(t);
  const category = thread.category as ForumCategory | undefined;
  const accent = category ? (CATEGORY_ACCENTS[category.slug] || 'text-indigo-400') : 'text-indigo-400';

  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left transition-colors hover:border-slate-700 hover:bg-slate-900/70 flex flex-col"
    >
      <div className="flex items-center gap-2 mb-2 text-2xs">
        {category && (
          <span className={cn('font-medium', accent)}>
            {categoryLabel(category.slug, category.name)}
          </span>
        )}
        {thread.is_translation_pack && (
          <span className="flex items-center gap-1 text-amber-400 font-medium">
            <Package className="h-2.5 w-2.5" /> PACK
          </span>
        )}
      </div>
      <h4 className="text-sm font-medium text-slate-100 line-clamp-2 mb-3 flex-1">{thread.title}</h4>
      <div className="flex items-center justify-between text-2xs text-slate-500">
        <span className="truncate mr-2">{thread.author_name}</span>
        <span className="flex items-center gap-2.5 flex-shrink-0">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{thread.view_count}</span>
          {thread.is_translation_pack ? (
            <span className="flex items-center gap-1 text-amber-400"><Download className="h-3 w-3" />{thread.download_count}</span>
          ) : (
            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{thread.reply_count}</span>
          )}
        </span>
      </div>
      <div className="text-2xs text-slate-600 mt-1.5">
        {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale })}
      </div>
    </button>
  );
}

function ActivityRow({ thread, locale, onClick }: { thread: ForumThread; locale: Locale; onClick: () => void }) {
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel(t);
  const category = thread.category as ForumCategory | undefined;
  const accent = category ? (CATEGORY_ACCENTS[category.slug] || 'text-indigo-400') : 'text-indigo-400';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left bg-slate-900/40 transition-colors hover:bg-slate-900/80"
    >
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarImage src={thread.author_avatar || undefined} />
        <AvatarFallback className="bg-slate-800 text-2xs text-slate-300 font-semibold">
          {thread.author_name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-200 truncate">{thread.title}</div>
        <div className="text-2xs text-slate-500 truncate">
          {thread.author_name}
          {category && (
            <> · <span className={accent}>{categoryLabel(category.slug, category.name)}</span></>
          )}
          {' · '}
          {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale })}
        </div>
      </div>
      <span className="flex items-center gap-1 text-2xs text-slate-500 flex-shrink-0">
        <MessageSquare className="h-3 w-3" />{thread.reply_count}
      </span>
    </button>
  );
}

// Riga compatta per un pack vero (translation_packs). Fino al 09/08/2026 qui
// c'era una card basata su ForumThread.pack_data.
function PackRow({ pack, onClick }: { pack: TranslationPack; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-slate-800 bg-slate-900/40 px-3.5 py-3 text-left transition-colors hover:border-amber-500/30 hover:bg-slate-900/70"
    >
      <div className="flex items-center gap-2 mb-1">
        <Package className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-xs font-medium text-slate-200 truncate">{pack.name}</span>
      </div>
      <div className="flex items-center gap-2 text-2xs text-slate-500 pl-[1.375rem]">
        <span className="truncate">{pack.gameName}</span>
        <span className="font-mono flex-shrink-0 uppercase">{pack.sourceLanguage}→{pack.targetLanguage}</span>
        <span className="flex items-center gap-1 text-amber-400/80 flex-shrink-0">
          <Download className="h-3 w-3" />{pack.downloads}
        </span>
      </div>
    </button>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-900/60 border border-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 rounded-xl bg-slate-900/60 border border-slate-800" />
        <div className="h-64 rounded-xl bg-slate-900/60 border border-slate-800" />
      </div>
    </div>
  );
}
