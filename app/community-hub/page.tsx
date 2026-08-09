'use client';

// Community Hub — redesign 2026-07:
// - Tab persistenti (Panoramica / Discussioni / Pack) invece del layout monolitico
// - Panoramica "viva": attività recente, ultimi pack, news traduzioni, categorie
// - Visual alleggerito: niente gradienti/glow, gerarchia da bordi + accenti
// - Esperienza guidata quando la community è vuota (in CommunityOverview)

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  Package,
  Download,
  Flame,
  LayoutDashboard,
  Trophy,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { ForumHome, CommunityOverview, ThreadView, NewThread } from '@/components/forum';
import { PacksTab } from '@/components/community/packs-tab';
import { NotificationsPanel, OnlineIndicator, Showcase, UserProfileView } from '@/components/social';
import { useProfiles } from '@/hooks/use-profiles';
import { updatePresence } from '@/lib/social/social';
import { getForumStats, type ForumStats } from '@/lib/social/forum';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ForumThread } from '@/lib/social/forum';

type View = 'home' | 'thread' | 'new' | 'profile';
type HomeTab = 'overview' | 'threads' | 'packs' | 'showcase';

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: typeof MessageSquare;
  label: string;
  value: number | string;
  accent: 'violet' | 'indigo' | 'emerald' | 'amber' | 'rose';
}

const ACCENT_CLASSES: Record<KpiCardProps['accent'], { icon: string; iconBg: string }> = {
  violet: { icon: 'text-violet-400', iconBg: 'bg-violet-500/10' },
  indigo: { icon: 'text-indigo-400', iconBg: 'bg-indigo-500/10' },
  emerald: { icon: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
  amber: { icon: 'text-amber-400', iconBg: 'bg-amber-500/10' },
  rose: { icon: 'text-rose-400', iconBg: 'bg-rose-500/10' },
};

function KpiCard({ icon: Icon, label, value, accent }: KpiCardProps) {
  const cls = ACCENT_CLASSES[accent];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2.5">
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', cls.iconBg)}>
        <Icon className={cn('h-4 w-4', cls.icon)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-lg font-semibold text-slate-200 leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function CommunityHubPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentProfile } = useProfiles();

  const initialCategory = searchParams.get('category') || undefined;
  const initialSearch = searchParams.get('query') || undefined;
  // ?profile=<username>: unico deep-link ai profili compatibile con
  // l'export statico — /u/[username] con dynamicParams=false emette solo
  // /u/_, quindi i link diretti 404ano in build. Chi vuole linkare un
  // profilo (es. autore di un pack) passa da qui.
  const initialProfile = searchParams.get('profile') || undefined;

  const [view, setView] = useState<View>(initialProfile ? 'profile' : 'home');
  // Se arrivo con ?category o ?query vado dritto alle discussioni
  const [homeTab, setHomeTab] = useState<HomeTab>(initialCategory || initialSearch ? 'threads' : 'overview');
  const [threadsCategory, setThreadsCategory] = useState<string | undefined>(initialCategory);
  const [threadsKey, setThreadsKey] = useState(0); // forza remount di ForumHome quando cambio categoria dalla Panoramica
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [newThreadCategory, setNewThreadCategory] = useState<string | undefined>(initialCategory);
  const [stats, setStats] = useState<ForumStats | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(initialProfile ?? null);

  const userId = currentProfile?.id || '';
  const userName = currentProfile?.name || '';
  const userAvatar = currentProfile?.avatar_path || undefined;

  // Update presence
  useEffect(() => {
    if (userId) {
      updatePresence(userId, 'online', t('social.inCommunityHub'));
      const interval = setInterval(() => {
        updatePresence(userId, 'online', t('social.inCommunityHub'));
      }, 120000);
      return () => clearInterval(interval);
    }
  }, [userId, t]);

  // Forum stats per la riga KPI
  useEffect(() => {
    getForumStats().then(setStats).catch(() => { /* silenzioso */ });
    const interval = setInterval(() => {
      getForumStats().then(setStats).catch(() => { /* silenzioso */ });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenThread = (thread: ForumThread) => {
    setSelectedThread(thread);
    setView('thread');
  };

  const handleNewThread = (categorySlug?: string) => {
    setNewThreadCategory(categorySlug);
    setView('new');
  };

  const handleBack = () => {
    setView('home');
    setSelectedThread(null);
    setProfileUsername(null);
  };

  const handleOpenProfile = (username: string) => {
    setProfileUsername(username);
    setView('profile');
  };

  const handleThreadCreated = (thread: ForumThread) => {
    setSelectedThread(thread);
    setView('thread');
  };

  const goDiscussions = (categorySlug?: string) => {
    setThreadsCategory(categorySlug);
    setThreadsKey((k) => k + 1);
    setHomeTab('threads');
  };

  const TABS: { id: HomeTab; label: string; icon: typeof MessageSquare }[] = [
    { id: 'overview', label: t('communityHub.tabOverview') || 'Panoramica', icon: LayoutDashboard },
    { id: 'threads', label: t('communityHub.tabThreads') || 'Discussioni', icon: MessageSquare },
    { id: 'packs', label: t('communityHub.tabPacks') || 'Pack', icon: Package },
    { id: 'showcase', label: t('communityHub.tabShowcase') || 'Classifiche', icon: Trophy },
  ];

  const kpiVisible =
    !!stats && (stats.total_threads + stats.total_packs + stats.total_downloads + stats.active_users) > 0;

  return (
    <TooltipProvider>
      <div className="h-full flex relative overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* HEADER — solo in vista home                                      */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {view === 'home' && (
            <div className="px-6 pt-5 pb-0 border-b border-slate-800/70 bg-slate-950/40 sticky top-0 z-10 backdrop-blur-sm">
              {/* Riga titolo + azioni */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-slate-100 leading-tight">
                      {t('communityHub.title')}
                    </h1>
                    <p className="text-slate-500 text-xs">
                      {t('communityHub.subtitle')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <OnlineIndicator />
                  {userId && <NotificationsPanel userId={userId} />}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/patch-hub')}
                    className="text-slate-400 hover:text-amber-300 hover:bg-amber-500/10"
                    title={t('patchHub.title') || 'Patch Hub'}
                    aria-label="Patch Hub"
                  >
                    <Package className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* KPI compatti (solo con attività reale) */}
              {kpiVisible && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
                  <KpiCard icon={MessageSquare} label={t('forum.threadsLabel') || 'Discussioni'} value={stats!.total_threads} accent="violet" />
                  <KpiCard icon={Package} label={t('communityHub.translationPacks') || 'Translation Pack'} value={stats!.total_packs} accent="indigo" />
                  <KpiCard icon={Download} label={t('forum.downloads') || 'Download'} value={stats!.total_downloads} accent="emerald" />
                  <KpiCard icon={Flame} label={t('communityHub.activeUsers') || 'Utenti Attivi'} value={stats!.active_users} accent="rose" />
                </div>
              )}

              {/* Tab */}
              <nav className="flex items-center gap-1" role="tablist">
                {TABS.map(({ id, label, icon: Icon }) => {
                  const active = homeTab === id;
                  return (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setHomeTab(id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                        active
                          ? 'border-violet-500 text-slate-100'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* CONTENT                                                          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div className="px-6 py-5">
            {view === 'home' && homeTab === 'overview' && (
              <CommunityOverview
                onOpenThread={handleOpenThread}
                onNewThread={handleNewThread}
                onGoDiscussions={goDiscussions}
                onGoPacks={() => setHomeTab('packs')}
              />
            )}

            {view === 'home' && homeTab === 'threads' && (
              <ForumHome
                key={`threads-${threadsKey}`}
                initialCategory={threadsCategory}
                initialSearch={initialSearch}
                onOpenThread={handleOpenThread}
                onNewThread={handleNewThread}
              />
            )}

            {/* Pack VERI da translation_packs (stessa fonte del Patch Hub).
                Prima qui c'era ForumHome packsOnly, che mostrava i THREAD del
                forum marcati is_translation_pack: dataset scollegato dai pack
                pubblicati — la tab restava vuota anche a Hub popolato. */}
            {view === 'home' && homeTab === 'packs' && <PacksTab />}

            {view === 'home' && homeTab === 'showcase' && (
              <Showcase onOpenProfile={handleOpenProfile} />
            )}

            {view === 'profile' && profileUsername && (
              <UserProfileView
                username={profileUsername}
                currentUserId={userId || undefined}
                onClose={handleBack}
              />
            )}

            {view === 'thread' && selectedThread && (
              <ThreadView
                threadId={selectedThread.id}
                userId={userId}
                userName={userName}
                userAvatar={userAvatar}
                onBack={handleBack}
              />
            )}

            {view === 'new' && (
              <NewThread
                initialCategory={newThreadCategory}
                userId={userId}
                userName={userName}
                userAvatar={userAvatar}
                onBack={handleBack}
                onSuccess={handleThreadCreated}
              />
            )}
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}
