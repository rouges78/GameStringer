'use client';

// Lista discussioni del forum (tab "Discussioni" e "Pack" del Community Hub).
// Trending e griglia categorie vivono in community-overview.tsx (tab Panoramica).
// Redesign 2026-07: visual più leggero — niente gradienti/glow/scale, gerarchia
// data da bordi, accenti di categoria e tipografia.

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import {
  MessageSquare,
  Download,
  Search,
  TrendingUp,
  Clock,
  Pin,
  Lock,
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  Package,
  Gamepad2,
  HelpCircle,
  Trophy,
  Megaphone,
  BookOpen,
  MessageSquarePlus,
  Coffee,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getCategories,
  getThreads,
  type ForumCategory,
  type ForumThread,
  type ThreadsFilter,
} from '@/lib/social/forum';
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


// ─── CATEGORY ICONS & ACCENTS ───────────────────────────────────────────────

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

const DEFAULT_ACCENT = 'text-indigo-400';

// ─── FORUM HOME ─────────────────────────────────────────────────────────────

interface ForumHomeProps {
  initialCategory?: string;
  initialSearch?: string;
  /** Vista "Pack": mostra solo translation pack, ordina per download */
  packsOnly?: boolean;
  onOpenThread?: (thread: ForumThread) => void;
  onNewThread?: (categorySlug?: string) => void;
}

export function ForumHome({ initialCategory, initialSearch, packsOnly = false, onOpenThread, onNewThread }: ForumHomeProps) {
  const { t, language } = useTranslation();
  const categoryLabel = useCategoryLabel(t);
  const router = useRouter();
  const locale = language === 'it' ? it : enUS;

  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalThreads, setTotalThreads] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [searchQuery, setSearchQuery] = useState(initialSearch || '');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'most_replies' | 'most_downloads'>(
    packsOnly ? 'most_downloads' : 'newest'
  );
  const [page, setPage] = useState(1);

  // ─── LOAD DATA ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await getCategories();
      setCategories(cats);

      const filter: ThreadsFilter = {
        category_slug: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchQuery || undefined,
        sort: sortBy,
        is_translation_pack: packsOnly ? true : undefined,
        page,
        limit: 20,
      };

      const { threads: threadData, total } = await getThreads(filter);
      setThreads(threadData);
      setTotalThreads(total);
    } catch (error) {
      console.error('[Forum] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, sortBy, packsOnly, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset pagina quando cambiano i filtri
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchQuery, sortBy]);

  // ─── HANDLERS ─────────────────────────────────────────────────────────────

  const handleThreadClick = (thread: ForumThread) => {
    if (onOpenThread) {
      onOpenThread(thread);
    } else {
      router.push(`/community-hub/thread/${thread.id}`);
    }
  };

  const handleNewThread = (categorySlug?: string) => {
    if (onNewThread) {
      onNewThread(categorySlug);
    } else {
      router.push(`/community-hub/new${categorySlug ? `?category=${categorySlug}` : ''}`);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Chips categorie (sempre visibili, non in vista Pack) ──────────── */}
      {!packsOnly && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <CategoryChip
            active={selectedCategory === 'all'}
            label={t('forum.allCategories') || 'Tutte'}
            onClick={() => setSelectedCategory('all')}
          />
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.slug] || MessageSquare;
            const accent = CATEGORY_ACCENTS[cat.slug] || DEFAULT_ACCENT;
            return (
              <CategoryChip
                key={cat.id}
                active={selectedCategory === cat.slug}
                label={categoryLabel(cat.slug, cat.name)}
                icon={<Icon className={cn('h-3.5 w-3.5', accent)} />}
                onClick={() => setSelectedCategory(cat.slug)}
              />
            );
          })}
        </div>
      )}

      {/* ── Barra filtri ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder={packsOnly ? (t('forum.searchPacks') || 'Cerca pack o giochi…') : t('forum.searchThreads')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-slate-900/50 border-slate-800 focus:border-violet-500/50 focus:ring-violet-500/20"
          />
        </div>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[170px] h-9 bg-slate-900/50 border-slate-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">
              <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {t('forum.mostRecent')}</span>
            </SelectItem>
            <SelectItem value="popular">
              <span className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> {t('forum.mostViewed')}</span>
            </SelectItem>
            <SelectItem value="most_replies">
              <span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> {t('forum.mostReplies')}</span>
            </SelectItem>
            <SelectItem value="most_downloads">
              <span className="flex items-center gap-2"><Download className="h-3.5 w-3.5" /> {t('forum.mostDownloads')}</span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>

        <div className="flex-1" />

        <Button
          onClick={() => handleNewThread(selectedCategory !== 'all' ? selectedCategory : undefined)}
          size="sm"
          className="bg-violet-600 hover:bg-violet-500 h-9"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('forum.newThread')}
        </Button>
      </div>

      {/* ── Lista thread ──────────────────────────────────────────────────── */}
      <section>
        {totalThreads > 0 && (
          <div className="flex items-center gap-2 mb-2 text-xs text-slate-500">
            <Badge variant="outline" className="text-2xs border-slate-800 text-slate-400">
              {totalThreads}
            </Badge>
            {packsOnly
              ? (t('communityHub.packsAvailable') || 'pack disponibili')
              : (t('forum.discussions') || 'discussioni')}
          </div>
        )}

        <div className="space-y-1.5">
          {loading ? (
            <ThreadListSkeleton />
          ) : threads.length === 0 ? (
            <EmptyState
              packsOnly={packsOnly}
              hasFilters={!!searchQuery || selectedCategory !== 'all'}
              onNewThread={() => handleNewThread(selectedCategory !== 'all' ? selectedCategory : undefined)}
            />
          ) : (
            threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                locale={locale}
                onClick={() => handleThreadClick(thread)}
              />
            ))
          )}
        </div>
      </section>

      {/* ── Paginazione ───────────────────────────────────────────────────── */}
      {totalThreads > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            {t('forum.previous')}
          </Button>
          <span className="text-sm text-slate-400">
            {t('forum.page')} {page} {t('forum.of')} {Math.ceil(totalThreads / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(totalThreads / 20)}
            onClick={() => setPage(p => p + 1)}
          >
            {t('forum.next')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── CATEGORY CHIP ──────────────────────────────────────────────────────────

function CategoryChip({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
        active
          ? 'bg-violet-500/15 border-violet-500/40 text-violet-200'
          : 'bg-transparent border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── THREAD ROW ─────────────────────────────────────────────────────────────

interface ThreadRowProps {
  thread: ForumThread;
  locale: Locale;
  onClick: () => void;
}

function ThreadRow({ thread, locale, onClick }: ThreadRowProps) {
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel(t);
  const category = thread.category as ForumCategory | undefined;
  const accent = category ? (CATEGORY_ACCENTS[category.slug] || DEFAULT_ACCENT) : DEFAULT_ACCENT;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 rounded-lg border border-slate-800/80 bg-slate-900/40 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900/70 group"
    >
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={thread.author_avatar || undefined} />
        <AvatarFallback className="bg-slate-800 text-xs text-slate-300 font-semibold">
          {thread.author_name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Titolo + stato (icone sobrie invece di badge multipli) */}
        <div className="flex items-center gap-1.5 mb-0.5">
          {thread.is_pinned && <Pin className="h-3 w-3 text-amber-400 flex-shrink-0" aria-label={t('forum.pinned') || 'Pinned'} />}
          {thread.is_locked && <Lock className="h-3 w-3 text-slate-500 flex-shrink-0" aria-label={t('forum.locked') || 'Locked'} />}
          {thread.is_solved && <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" aria-label={t('forum.solved') || 'Risolto'} />}
          <h3 className="text-sm font-medium text-slate-100 truncate group-hover:text-white">
            {thread.title}
          </h3>
          {thread.is_translation_pack && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-2xs font-semibold flex-shrink-0">
              <Package className="h-2.5 w-2.5" /> PACK
            </span>
          )}
        </div>

        {/* Info pack (solo se presente) */}
        {thread.is_translation_pack && thread.pack_data && (
          <div className="flex items-center gap-2 mb-0.5 text-2xs text-slate-500">
            <span className="flex items-center gap-1 text-slate-400">
              <Gamepad2 className="h-3 w-3" />
              {thread.pack_data.game_name}
            </span>
            <span className="font-mono">{thread.pack_data.source_lang}→{thread.pack_data.target_lang}</span>
            {thread.pack_data.string_count > 0 && (
              <span>{thread.pack_data.string_count.toLocaleString()} {t('forum.strings') || 'stringhe'}</span>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-1.5 text-2xs text-slate-500 truncate">
          <span className="text-slate-400">{thread.author_name}</span>
          {category && (
            <>
              <span className="text-slate-700">·</span>
              <span className={accent}>{categoryLabel(category.slug, category.name)}</span>
            </>
          )}
          <span className="text-slate-700">·</span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale })}</span>
        </div>
      </div>

      {/* Statistiche compatte */}
      <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-xs text-slate-500">
        <span className="flex items-center gap-1" title={t('forum.replies') || 'Risposte'}>
          <MessageSquare className="h-3.5 w-3.5" />{thread.reply_count}
        </span>
        <span className="flex items-center gap-1" title={t('forum.visits') || 'Visite'}>
          <Eye className="h-3.5 w-3.5" />{thread.view_count}
        </span>
        {thread.is_translation_pack && (
          <span className="flex items-center gap-1 text-amber-400" title={t('forum.downloads') || 'Download'}>
            <Download className="h-3.5 w-3.5" />{thread.download_count}
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
    </button>
  );
}

// ─── EMPTY STATE ────────────────────────────────────────────────────────────

function EmptyState({
  packsOnly,
  hasFilters,
  onNewThread,
}: {
  packsOnly: boolean;
  hasFilters: boolean;
  onNewThread: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
      <div className="w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center mb-4">
        {hasFilters ? (
          <Search className="h-5 w-5 text-slate-400" />
        ) : packsOnly ? (
          <Package className="h-5 w-5 text-amber-400" />
        ) : (
          <MessageSquarePlus className="h-5 w-5 text-violet-400" />
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-1">
        {hasFilters
          ? (t('forum.noThreads') || 'Nessun risultato')
          : packsOnly
            ? (t('communityHub.noPacksYet') || 'Nessun pack pubblicato ancora')
            : (t('forum.beTheFirst') || 'Sii il primo!')}
      </h3>
      <p className="text-xs text-slate-500 max-w-sm mb-4">
        {hasFilters
          ? (t('forum.tryFilters') || 'Prova a modificare i filtri o la ricerca.')
          : packsOnly
            ? (t('communityHub.noPacksDesc') || 'Completa una traduzione e condividila come Translation Pack dal Patch Hub.')
            : (t('forum.emptyDescription') || 'Nessuna discussione qui. Apri il primo thread e avvia la conversazione!')}
      </p>
      {packsOnly && !hasFilters ? (
        <Button size="sm" variant="outline" onClick={() => router.push('/patch-hub')}>
          <Package className="h-4 w-4 mr-1" />
          {t('communityHub.openPatchHub') || 'Apri il Patch Hub'}
        </Button>
      ) : (
        <Button size="sm" onClick={onNewThread} className="bg-violet-600 hover:bg-violet-500">
          <Plus className="h-4 w-4 mr-1" />
          {t('forum.newThread')}
        </Button>
      )}
    </div>
  );
}

// ─── THREAD LIST SKELETON ───────────────────────────────────────────────────

function ThreadListSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800 animate-pulse"
        >
          <div className="w-9 h-9 rounded-full bg-slate-800 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-800 rounded w-3/4" />
            <div className="h-2 bg-slate-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

type Locale = typeof it;
