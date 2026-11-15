
'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { useVersion } from '@/lib/version';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Home,
  Gamepad2,
  Settings,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Brain,
  Wand2,
  Database,
  Power,
  Cpu,
  Scan,
  Radio,
  Puzzle,
  Sparkles,
  Package,
  PackageOpen,
  WifiOff,
  Search,
  Globe,
  Mic,
  Users,
  Wrench,
  BookOpen,
  Check,
  Film,
  Smile,
  FolderOpen,
  Heart,
  Rocket,
  Edit3,
  Library,
  Languages,
  Shield,
  Disc,
  Store,
  MessageSquarePlus
} from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
// Image import removed — not currently used
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ProfileHeader } from '@/components/profiles/profile-header';
// AuthStatusSidebar import removed — not currently used
import { ProfileNotifications } from '@/components/profiles/profile-notifications';
import { DefaultProfileAlert } from '@/components/profiles/default-profile-alert';
import { SupportButton } from '@/components/support/support-button';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { useNotificationShortcuts } from '@/hooks/use-global-shortcuts';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { UpdateBell } from '@/components/notifications/update-bell';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { AutoUpdater } from '@/components/notifications/auto-updater';
import { FeaturedGameWidget } from '@/components/ui/featured-game-widget';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TutorialProvider } from '@/components/tutorial/tutorial-provider';
import { TutorialOverlay } from '@/components/tutorial/tutorial-overlay';
import { TutorialMenu } from '@/components/tutorial/tutorial-menu';
import { useTranslation } from '@/lib/i18n';
import { useScreen } from '@/components/providers/screen-provider';
import { isCommunityEnabled, autoSyncGSToSupabase } from '@/lib/social/auth-bridge';
import { clientLogger } from '@/lib/client-logger';
import { getGameDetailUrl } from '@/lib/game-detail-url';

// Lazy-loaded components for code splitting
const InteractiveTutorial = lazy(() => import('@/components/onboarding/interactive-tutorial').then(m => ({ default: m.InteractiveTutorial })));
const FirstGameFlow = lazy(() => import('@/components/onboarding/first-game-flow').then(m => ({ default: m.FirstGameFlow })));
const TermsOfUse = lazy(() => import('@/components/onboarding/terms-of-use').then(m => ({ default: m.TermsOfUse })));
const CommandPalette = lazy(() => import('@/components/ui/command-palette').then(m => ({ default: m.CommandPalette })));
const SystemOverlay = lazy(() => import('@/components/system-overlay').then(m => ({ default: m.SystemOverlay })));
const BackgroundJobsIndicator = lazy(() => import('@/components/translator/background-jobs-widget').then(m => ({ default: m.BackgroundJobsIndicator })));
const BackgroundJobsWidget = lazy(() => import('@/components/translator/background-jobs-widget').then(m => ({ default: m.BackgroundJobsWidget })));

// Minimal Suspense fallback
const LazyFallback = () => null;
import { initPresence, goOffline } from '@/lib/social/presence';
import { clearTrayNotifications, updateTrayTooltip } from '@/lib/notifications/tray-notifications';
import { WidgetErrorBoundary } from '@/components/error-boundary';
import { initNetworkMonitor, stopNetworkMonitor } from '@/lib/network-resilience';
import { StatusLine } from '@/components/layout/status-line';
import { ollamaArgs } from '@/lib/ai/ollama-endpoint';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  ollamaIndicator?: boolean;
}

interface NavGroup {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  collapsible?: boolean;
  items: NavItem[];
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR — menu di pausa (identità B + C)
// Un solo colore per tutti i gruppi e un solo livello: niente sottomenu
// (regola del progetto). I motori, che erano un sottomenu dentro "Patcher",
// sono ora un gruppo piatto. Le destinazioni sono le stesse di prima: più di
// una pagina era stata aggiunta qui proprio perché altrimenti irraggiungibile.
// ═══════════════════════════════════════════════════════════════════
const getNavGroups = (t: (key: string) => string): NavGroup[] => [
  // ── CORE ────────────────────────────────────────────────────────
  {
    label: t('nav.core'),
    items: [
      { name: t('nav.dashboard'), href: '/', icon: Home },
      { name: t('nav.library'), href: '/library', icon: Gamepad2 },
      { name: t('nav.projects'), href: '/projects', icon: Rocket },
    ],
  },
  // ── TRADUZIONE ──────────────────────────────────────────────────
  {
    label: t('nav.translation'),
    icon: Sparkles,
    collapsible: true,
    items: [
      { name: t('nav.translate'), href: '/ai-translator', icon: Sparkles },
      { name: t('nav.ocrTranslator'), href: '/ocr-translator', icon: Scan },
      // La pagina esisteva da tempo e non era raggiungibile: nessun link in
      // tutta l'applicazione, nessuna voce di menu. Ci si arrivava solo
      // scrivendo l'URL a mano, cosa che in una finestra Tauri non si puo' fare.
      { name: t('nav.liveTranslate'), href: '/live-translate', icon: Radio },
      { name: t('nav.voice'), href: '/voice-translator', icon: Mic },
      // '/batch' tolta finché la traduzione batch non esiste: la pagina dichiara
      // "non implementato" e tiene disabilitato Avvia. Era un vicolo cieco.
      { name: t('nav.offlineTranslator'), href: '/offline-translator', icon: WifiOff },
      { name: t('nav.editor'), href: '/editor', icon: Edit3 },
    ],
  },
  // ── MOTORI ──────────────────────────────────────────────────────
  {
    label: t('nav.engines'),
    icon: Cpu,
    collapsible: true,
    items: [
      { name: 'Unity', href: '/unity-patcher', icon: Wand2 },
      { name: 'Unity Localization', href: '/unity-localization', icon: Globe },
      { name: 'Unreal Engine', href: '/unreal-translator', icon: Cpu },
      { name: 'Godot', href: '/godot-translator', icon: Globe },
      { name: 'RPG Maker', href: '/rpgmaker-patcher', icon: Gamepad2 },
      { name: "Ren'Py", href: '/renpy-patcher', icon: Heart },
      { name: 'Bethesda', href: '/bethesda-patcher', icon: Shield },
      { name: 'CRI Middleware', href: '/cri-patcher', icon: Disc },
      // ⚠️ Aggiunta il 12/08/2026: la pagina esisteva dalla v1.6.0 con tre
      // comandi Tauri registrati (read_pak_archive, extract_pak_file,
      // extract_all_pak) e NON era in nessun menu. Compariva solo nella
      // pagina Guida, che legge da lib/tools-registry.ts — l'unico
      // consumatore di quel registro. Per l'utente non esisteva.
      { name: 'Danganronpa', href: '/danganronpa-patcher', icon: Package },
    ],
  },
  // ── STRUMENTI ───────────────────────────────────────────────────
  {
    label: t('nav.tools'),
    icon: Wrench,
    collapsible: true,
    items: [
      { name: 'Universal Injector', href: '/injector', icon: Wand2 },
      { name: 'Video Extractor', href: '/video-extractor', icon: Film },
      { name: 'Lip Sync', href: '/lip-sync', icon: Smile },
      // '/overlay' tolta: "Avvia Cattura" genera sottotitoli casuali di esempio
      // (subtitle-overlay.tsx), non cattura niente. Torna quando è collegata.
    ],
  },
  // ── RISORSE ─────────────────────────────────────────────────────
  {
    label: t('nav.resources'),
    icon: FolderOpen,
    collapsible: true,
    items: [
      { name: t('nav.community'), href: '/community-hub', icon: Users },
      // Prima del 09/08/2026 il Patch Hub NON era in nessuna navigazione:
      // ci si arrivava solo da bottoni dentro il Community Hub, quasi tutti
      // visibili solo a community vuota. "patchHubPage.title" = nome proprio.
      { name: t('patchHubPage.title'), href: '/patch-hub', icon: PackageOpen },
      { name: t('nav.stores'), href: '/stores', icon: Store },
      { name: 'Ollama / AI', href: '/ollama-manager', icon: Package, ollamaIndicator: true },
      { name: t('nav.settings'), href: '/settings', icon: Settings },
      { name: t('nav.guide'), href: '/guide', icon: BookOpen },
      { name: t('nav.feedback'), href: '/feedback', icon: MessageSquarePlus },
    ],
  },
];

interface SystemStatus {
  neuralEngine: { status: 'online' | 'offline' | 'error'; color: string; text: string };
  steamApi: { status: 'connected' | 'disconnected' | 'error'; color: string; text: string };
  cache: { percentage: number; color: string; text: string };
}

export function MainLayout({ children }: MainLayoutProps) {
  const { t, language, setLanguage } = useTranslation();
  const navGroups = getNavGroups(t);
  const { display } = useScreen();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [libraryGames, setLibraryGames] = useState<Array<{ id: string; title: string; header_image?: string; platform?: string }>>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  
  // Global keyboard shortcuts for notifications
  useNotificationShortcuts(
    () => setNotificationCenterOpen(true),
    () => setNotificationCenterOpen(prev => !prev)
  );
  
  // Keyboard shortcuts globali
  useKeyboardShortcuts();
  
  const [_systemStatus, setSystemStatus] = useState<SystemStatus>({
    neuralEngine: { status: 'online', color: 'bg-green-500', text: 'ON' },
    steamApi: { status: 'connected', color: 'bg-blue-500', text: 'OK' },
    cache: { percentage: 0, color: 'bg-cyan-500', text: '0%' }
  });
  const pathname = usePathname();
  const router = useRouter();
  const { version, buildInfo: _buildInfo, allVersions } = useVersion();

  // Tray icon navigation events — riceve percorsi dal backend Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    
    const setupTrayListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('navigate', (event) => {
          if (event.payload && typeof event.payload === 'string') {
            router.push(event.payload);
          }
        });
      } catch {
        // Non in ambiente Tauri (browser dev)
      }
    };
    
    setupTrayListener();
    return () => { unlisten?.(); };
  }, [router]);
  
  useEffect(() => {
    setIsMounted(true);
    // Carica preferenza sidebar dal localStorage
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (savedSidebarState !== null) {
      setSidebarOpen(JSON.parse(savedSidebarState));
    }
    
    // Aggiorna status del sistema solo all'avvio (no polling continuo)
    updateSystemStatus();

    // Initialize network resilience monitor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    initNetworkMonitor(supabaseUrl);

    // Auto-sync account Supabase appena loggato (in background, non blocca l'UI).
    // Serve al forum/pack/glossari community: senza, ogni scrittura sul backend fallisce.
    if (isCommunityEnabled()) {
      autoSyncGSToSupabase().then((uid) => {
        if (uid) {
          clientLogger.debug('[MainLayout] Backend community pronto, userId:', uid);
          // Initialize unified presence system (Realtime + heartbeat)
          initPresence(uid).then(() => {
            clientLogger.debug('[MainLayout] Presence inizializzato');
          }).catch(() => {});
        }
      }).catch((err) => {
        clientLogger.warn('[MainLayout] autoSyncGSToSupabase failed:', err);
      });
    }

    // Update tray tooltip on init
    updateTrayTooltip().catch(() => {});

    // Cleanup presence on unmount
    return () => {
      goOffline().catch(() => {});
      stopNetworkMonitor();
      clearTrayNotifications().catch(() => {});
    };
  }, []);

  // Load library games at app startup for global search
  useEffect(() => {
    const loadGames = async () => {
      try {
        const { get, set } = await import('idb-keyval');
        const cached = await get<Array<{ id: string; title: string; header_image?: string; platform?: string }>>('gs_library_games');
        
        if (cached && Array.isArray(cached) && cached.length > 0) {
          // Cache found - use it immediately
          const valid = cached.filter(g => g && g.title && typeof g.title === 'string');
          setLibraryGames(valid.slice(0, 500));
          clientLogger.debug(`[MainLayout] ⚡ Libreria caricata da cache: ${valid.length} giochi`);
        } else {
          // No cache - scan library in background at startup
          clientLogger.debug('[MainLayout] 🔄 Nessuna cache libreria, avvio scan in background...');
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const games = await invoke('scan_all_steam_games_fast') as Array<{ id: string; title: string; header_image?: string; platform?: string }>;
            if (games && Array.isArray(games) && games.length > 0) {
              const valid = games.filter(g => g && g.title && typeof g.title === 'string');
              setLibraryGames(valid.slice(0, 500));
              // Save to cache for next time
              await set('gs_library_games', games);
              await set('lastSteamScan', new Date().toISOString());
              clientLogger.debug(`[MainLayout] ✅ Libreria scansionata e salvata: ${valid.length} giochi`);
              // Notify other components
              window.dispatchEvent(new CustomEvent('gs-library-updated'));
            }
          } catch (e) {
            clientLogger.warn('[MainLayout] Scan libreria fallito:', e);
          }
        }
      } catch {}
    };
    
    // Load immediately at startup
    loadGames();
    
    // Re-check when library updates
    const handleUpdate = () => loadGames();
    window.addEventListener('gs-library-updated', handleUpdate);
    
    return () => {
      window.removeEventListener('gs-library-updated', handleUpdate);
    };
  }, []);

  // Auto-expand gruppo sidebar in base alla pagina corrente
  useEffect(() => {
    if (!pathname) return;
    for (const group of navGroups) {
      if (!group.collapsible) continue;
      if (group.items.some((item) => pathname === item.href)) {
        setExpandedGroups(prev => prev.includes(group.label) ? prev : [group.label]);
        break;
      }
    }
  }, [pathname]);

  // Ollama status polling per indicatore sidebar
  useEffect(() => {
    const checkOllama = async () => {
      // In Tauri il fetch diretto dal webview è bloccato da CORS (origine tauri.localhost non
      // ammessa da OLLAMA_ORIGINS): instradiamo via comando Rust, che usa reqwest/TCP senza CORS.
      const isTauriEnv = typeof window !== 'undefined' && ((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ || (window as unknown as Record<string, unknown>).__TAURI_IPC__);
      if (isTauriEnv) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const s = await invoke<{ running: boolean }>('check_ollama_status', ollamaArgs());
          setOllamaOnline(!!s.running);
          return;
        } catch {
          // fallback al fetch diretto qui sotto
        }
      }
      try {
        const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        setOllamaOnline(res.ok);
      } catch {
        setOllamaOnline(false);
      }
    };
    checkOllama();
    const interval = setInterval(checkOllama, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateSystemStatus = async () => {
    try {
      // Controlla Neural Engine (sempre online se l'app funziona)
      const neuralEngine = { 
        status: 'online' as const, 
        color: 'bg-green-500', 
        text: 'ON' 
      };

      // Controlla Steam API tramite test_steam_connection (con cache globalThis per evitare doppia chiamata StrictMode)
      let steamApi: { status: 'connected' | 'disconnected' | 'error'; color: string; text: string } = { 
        status: 'disconnected', 
        color: 'bg-red-500', 
        text: 'OFF' 
      };
      
      try {
        const _gc = globalThis as unknown as Record<string, unknown>;
        const cached = _gc.__gsSteamConnCache as { ts: number; data: typeof steamApi } | undefined;
        // Cache 30s per evitare doppia chiamata StrictMode e navigazioni ravvicinate
        if (cached && Date.now() - cached.ts < 30000) {
          steamApi = cached.data;
        } else {
          const { invoke } = await import('@/lib/tauri-api');
          const result = await invoke('test_steam_connection');
          // Se non lancia error, Steam è connected
          if (result) {
            steamApi = { 
              status: 'connected', 
              color: 'bg-green-500', 
              text: 'ON' 
            };
          }
          _gc.__gsSteamConnCache = { data: steamApi, ts: Date.now() };
        }
      } catch {
        // Steam non connected - resta OFF
      }

      // Calcola uso cache
      const cacheData = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) cacheData.push(value);
        }
      }
      
      const cacheSize = JSON.stringify(cacheData).length;
      const maxCache = 5 * 1024 * 1024; // 5MB max
      const cachePercentage = Math.min(Math.round((cacheSize / maxCache) * 100), 100);
      
      const cache = {
        percentage: cachePercentage,
        color: cachePercentage > 80 ? 'bg-red-500' : cachePercentage > 60 ? 'bg-yellow-500' : 'bg-cyan-500',
        text: `${cachePercentage}%`
      };

      setSystemStatus({ neuralEngine, steamApi, cache });
    } catch (error: unknown) {
      clientLogger.error('Error updating system status:', String(error));
    }
  };

  // Salva preferenza sidebar
  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', JSON.stringify(newState));
  };

  if (!isMounted) {
    return null;
  }

  return (
    <TutorialProvider>
      <div className="flex h-full bg-background">
        {/* Skip to content — a11y */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
        >
          {t('mainLayout.skipToContent')}</a>

        {/* Sidebar: menu di pausa. Un colore solo; la voce attiva ha il cursore ▶ oro. */}
        <aside
          data-tutorial="sidebar"
          className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-[hsl(var(--sidebar-bg))] transition-[width] duration-200 ease-out"
          style={{ width: sidebarOpen ? `${display.sidebarWidth}px` : '72px' }}
        >
          {/* Logo e toggle. Compressa (72px) non ci stanno affiancati: il logo
              resta in alto e la freccia scende in una riga sua. Il pulsante è
              uno solo e cambia solo posto: se fossero due, quello premuto
              sparirebbe e il focus da tastiera finirebbe sul body. */}
          <div className="relative flex shrink-0 flex-col">
            <div className={cn('flex h-14 items-center border-b border-border px-3', sidebarOpen ? 'pr-14' : 'justify-center')}>
              <Link href="/" className={cn('flex min-w-0 items-center gap-2.5', sidebarOpen && 'flex-1')} title={!sidebarOpen ? 'GameStringer' : undefined}>
                <img src="/favicon.svg" alt={sidebarOpen ? '' : 'GameStringer'} className="h-8 w-8 shrink-0" />
                {sidebarOpen && <span className="truncate font-pixel text-lg leading-none text-foreground">GameStringer</span>}
              </Link>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn('text-muted-foreground hover:text-foreground', sidebarOpen ? 'absolute right-3 top-3' : 'mx-auto mt-2')}
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? t('mainLayout.collapseSidebar') : t('mainLayout.expandSidebar')}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label={t('mainLayout.mainNavigation')}>
            {navGroups.map((group, groupIndex) => {
              const isExpanded = expandedGroups.includes(group.label);
              const hasActive = group.items.some((item) => pathname === item.href);
              const toggleGroup = () => {
                const wasOpen = expandedGroups.includes(group.label);
                // Sidebar compressa: la lista del gruppo non si vede, quindi aprire
                // il gruppo e basta era un click a vuoto. Prima si allarga la sidebar.
                if (!sidebarOpen) {
                  toggleSidebar();
                  setExpandedGroups([group.label]);
                  return;
                }
                setExpandedGroups(wasOpen ? [] : [group.label]);
              };
              const GroupIcon = group.icon;

              const renderItem = (item: NavItem) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!sidebarOpen ? item.name : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    data-tutorial={`nav-${item.href === '/' ? 'dashboard' : item.href.replace('/', '')}`}
                    className={cn(
                      'relative flex items-center gap-3 rounded-sm text-sm',
                      sidebarOpen ? 'h-8 pl-7 pr-2' : 'h-10 justify-center',
                      isActive
                        ? 'bg-accent font-semibold text-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    {isActive && sidebarOpen && (
                      <span aria-hidden className="absolute left-2.5 text-[9px] leading-none text-gold">▶</span>
                    )}
                    <Icon className={cn('shrink-0', sidebarOpen ? 'h-4 w-4' : 'h-5 w-5', isActive && 'text-primary')} />
                    {sidebarOpen && <span className="truncate">{item.name}</span>}
                    {item.ollamaIndicator && ollamaOnline !== null && sidebarOpen && (
                      <span
                        className={cn('ml-auto h-1.5 w-1.5 shrink-0', ollamaOnline ? 'bg-success' : 'bg-muted-foreground/60')}
                        title={ollamaOnline ? 'Ollama online' : 'Ollama offline'}
                      />
                    )}
                  </Link>
                );
              };

              return (
                <div key={group.label} className={cn(groupIndex > 0 && 'mt-1')}>
                  {groupIndex === 1 && <div className="mx-2 mb-2 mt-1 h-px bg-border" />}

                  {group.collapsible ? (
                    <>
                      <button
                        type="button"
                        onClick={toggleGroup}
                        aria-expanded={isExpanded && sidebarOpen}
                        data-tutorial={`nav-${group.label.toLowerCase().includes('traduz') || group.label.toLowerCase().includes('trans') ? 'translator' : 'tools'}`}
                        title={!sidebarOpen ? group.label : undefined}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-sm',
                          sidebarOpen ? 'h-8 px-2.5 text-xs font-semibold uppercase tracking-wider' : 'h-10 justify-center',
                          isExpanded || hasActive ? 'text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                        )}
                      >
                        {GroupIcon && <GroupIcon className={cn('shrink-0', sidebarOpen ? 'h-4 w-4' : 'h-5 w-5', hasActive && !sidebarOpen && 'text-primary')} />}
                        {sidebarOpen && (
                          <>
                            <span className="flex-1 truncate text-left">{group.label}</span>
                            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200', isExpanded && 'rotate-180')} />
                          </>
                        )}
                      </button>
                      {isExpanded && sidebarOpen && (
                        <div className="mb-1 mt-0.5 space-y-px">{group.items.map(renderItem)}</div>
                      )}
                    </>
                  ) : (
                    <>
                      {sidebarOpen && (
                        <div className="px-2.5 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </div>
                      )}
                      <div className="space-y-px">{group.items.map(renderItem)}</div>
                    </>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Tutorial Help */}
          <div className="flex shrink-0 items-center justify-center border-t border-border px-2 py-2">
            {sidebarOpen ? <TutorialMenu fullWidth /> : <TutorialMenu />}
          </div>

          {/* Widget Gioco in Evidenza */}
          <div className="shrink-0 border-t border-border px-2 py-2">
            <FeaturedGameWidget collapsed={!sidebarOpen} />
          </div>
        </aside>

        {/* Main Content */}
        <div 
          className="flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300 relative z-10 h-full"
          style={{ marginLeft: sidebarOpen ? `${display.sidebarWidth}px` : '72px' }}
        >
          {/* Header */}
          <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-[hsl(var(--header-bg))] px-4">
            {/* Ricerca a sinistra - Campo compilabile */}
            <div className="relative group w-80">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder={`${t('commandPalette.placeholder')} (Ctrl+K)`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                      setSearchFocused(false);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="h-9 rounded-md border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              
              {/* Dropdown risultati ricerca inline */}
              {searchFocused && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-md shadow-[0_10px_30px_rgb(0_0_0/0.4)] overflow-hidden z-50 w-[400px]">
                  <ScrollArea className="max-h-[400px]">
                    {(() => {
                      const q = searchQuery.toLowerCase();
                      
                      // Navigation items
                      const navigationItems = [
                        { id: 'dashboard', title: t('nav.dashboard'), description: t('commandPalette.dashboardDesc'), icon: Home, path: '/' },
                        { id: 'library', title: t('nav.library'), description: t('commandPalette.libraryDesc'), icon: Library, path: '/library' },
                        { id: 'translator', title: t('nav.translate'), description: t('commandPalette.translateDesc'), icon: Languages, path: '/ai-translator' },
                        { id: 'dictionary', title: t('nav.dictionary'), description: t('commandPalette.dictionaryDesc'), icon: Database, path: '/memory' },
                        { id: 'multi-llm', title: t('nav.multiLlm'), description: t('commandPalette.multiLlmDesc'), icon: Brain, path: '/translator/compare' },
                        { id: 'voice', title: t('nav.voice'), description: t('commandPalette.voiceDesc'), icon: Mic, path: '/voice-translator' },
                        { id: 'patcher', title: t('nav.patcher'), description: t('commandPalette.patcherDesc'), icon: Wrench, path: '/unity-patcher' },
                        { id: 'injector', title: t('nav.injector'), description: t('commandPalette.patcherDesc'), icon: Puzzle, path: '/injector' },
                        { id: 'crawler', title: t('nav.contextHarvester'), description: t('commandPalette.scanGamesDesc'), icon: Scan, path: '/context-harvester' },
                        { id: 'fixer', title: t('nav.fixer'), description: t('commandPalette.patcherDesc'), icon: Wand2, path: '/fixer' },
                        { id: 'rom-patcher', title: 'ROM Patcher', description: 'Applica e crea patch IPS/BPS per traduzioni retro', icon: Disc, path: '/rom-patcher' },
                        { id: 'community', title: t('nav.community'), description: t('commandPalette.communityDesc'), icon: Users, path: '/community-hub' },
                        { id: 'settings', title: t('nav.settings'), description: t('commandPalette.settingsDesc'), icon: Settings, path: '/settings' },
                      ];
                      
                      const filteredNav = navigationItems.filter(item => 
                        item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
                      ).slice(0, 5);
                      
                      // Games from library (search with 2+ chars)
                      const filteredGames = q.length >= 2 
                        ? libraryGames.filter(g => g.title && g.title.toLowerCase().includes(q)).slice(0, 8)
                        : [];
                      
                      const hasResults = filteredNav.length > 0 || filteredGames.length > 0;
                      
                      if (!hasResults) {
                        return (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            {t('commandPalette.noResults')} {'"'}{searchQuery}{'"'}
                          </div>
                        );
                      }
                      
                      return (
                        <div className="p-2">
                          {/* Pages section */}
                          {filteredNav.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('mainLayout.pages')}</div>
                              {filteredNav.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <Link
                                    key={item.id}
                                    href={item.path}
                                    onClick={() => { setSearchQuery(''); setSearchFocused(false); }}
                                    className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-accent transition-colors group"
                                  >
                                    <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-accent group-hover:bg-primary/15">
                                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                    </div>
                                  </Link>
                                );
                              })}
                            </>
                          )}
                          
                          {/* Games section */}
                          {filteredGames.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2 flex items-center gap-1.5">
                                <Gamepad2 className="h-3 w-3" /> {t('mainLayout.games')} ({filteredGames.length})
                              </div>
                              {filteredGames.map((game) => (
                                <Link
                                  key={game.id}
                                  href={getGameDetailUrl(game)}
                                  onClick={() => { setSearchQuery(''); setSearchFocused(false); }}
                                  className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-accent transition-colors group"
                                >
                                  {game.header_image ? (
                                    <img 
                                      src={game.header_image} 
                                      alt={game.title}
                                      className="w-10 h-10 rounded-sm object-cover border border-border"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center w-10 h-10 rounded-sm bg-accent">
                                      <Gamepad2 className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{game.title}</p>
                                    {game.platform && <p className="text-xs text-muted-foreground">{game.platform}</p>}
                                  </div>
                                </Link>
                              ))}
                            </>
                          )}
                          
                          {/* Hint for short queries */}
                          {q.length < 2 && libraryGames.length > 0 && (
                            <div className="px-3 py-2 text-xs text-muted-foreground italic border-t border-border mt-2">
                              {t('mainLayout.searchHint')} {libraryGames.length}  {t('mainLayout.gamesUnit')}</div>
                          )}
                        </div>
                      );
                    })()}
                  </ScrollArea>
                </div>
              )}
            </div>
            
            {/* Language Selector al centro */}
            <div className="flex-1 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="group h-9 gap-2.5 rounded-sm border-border border-b-[3px] bg-secondary px-3 text-foreground hover:bg-accent hover:text-foreground">
                    <Globe className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    {/* Mini bandiera lingua corrente */}
                    {language === 'it' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                        <span className="w-1/3 bg-green-500" />
                        <span className="w-1/3 bg-white" />
                        <span className="w-1/3 bg-red-500" />
                      </span>
                    )}
                    {language === 'en' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm">
                        <span className="w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2060%2030%22%3E%3CclipPath%20id%3D%22a%22%3E%3Cpath%20d%3D%22M0%200v30h60V0z%22%2F%3E%3C%2FclipPath%3E%3CclipPath%20id%3D%22b%22%3E%3Cpath%20d%3D%22M30%2015h30v15zv15H0zH0V0zV0h30z%22%2F%3E%3C%2FclipPath%3E%3Cg%20clip-path%3D%22url(%23a)%22%3E%3Cpath%20d%3D%22M0%200v30h60V0z%22%20fill%3D%22%23012169%22%2F%3E%3Cpath%20d%3D%22M0%200l60%2030m0-30L0%2030%22%20stroke%3D%22%23fff%22%20stroke-width%3D%226%22%2F%3E%3Cpath%20d%3D%22M0%200l60%2030m0-30L0%2030%22%20clip-path%3D%22url(%23b)%22%20stroke%3D%22%23C8102E%22%20stroke-width%3D%224%22%2F%3E%3Cpath%20d%3D%22M30%200v30M0%2015h60%22%20stroke%3D%22%23fff%22%20stroke-width%3D%2210%22%2F%3E%3Cpath%20d%3D%22M30%200v30M0%2015h60%22%20stroke%3D%22%23C8102E%22%20stroke-width%3D%226%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] bg-cover bg-center block w-full h-full" />
                      </span>
                    )}
                    {language === 'es' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                        <span className="h-1/4 bg-red-600" />
                        <span className="h-2/4 bg-yellow-400" />
                        <span className="h-1/4 bg-red-600" />
                      </span>
                    )}
                    {language === 'fr' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                        <span className="w-1/3 bg-blue-600" />
                        <span className="w-1/3 bg-white" />
                        <span className="w-1/3 bg-red-500" />
                      </span>
                    )}
                    {language === 'de' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                        <span className="h-1/3 bg-black" />
                        <span className="h-1/3 bg-red-500" />
                        <span className="h-1/3 bg-yellow-400" />
                      </span>
                    )}
                    {language === 'ja' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-white flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                      </span>
                    )}
                    {language === 'zh' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-red-500 flex items-center justify-center">
                        <span className="text-2xs text-yellow-400">★</span>
                      </span>
                    )}
                    {language === 'ko' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-white flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-red-600 border border-blue-800" />
                      </span>
                    )}
                    {language === 'pt' && (
                      <span className="w-5 h-3.5 rounded-sm overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                        <span className="w-2/5 bg-green-600" />
                        <span className="w-3/5 bg-yellow-400" />
                      </span>
                    )}
                    {language === 'ru' && (
                      <span className="w-5 h-3.5 rounded-[2px] overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                        <span className="h-1/3 bg-white" />
                        <span className="h-1/3 bg-blue-600" />
                        <span className="h-1/3 bg-red-500" />
                      </span>
                    )}
                    {language === 'pl' && (
                      <span className="w-5 h-3.5 rounded-[2px] overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                        <span className="h-1/2 bg-white" />
                        <span className="h-1/2 bg-red-500" />
                      </span>
                    )}
                    {language === 'el' && (
                      <span className="w-5 h-3.5 rounded-[2px] overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                        <span className="h-1/5 bg-blue-700" />
                        <span className="h-1/5 bg-white" />
                        <span className="h-1/5 bg-blue-700" />
                        <span className="h-1/5 bg-white" />
                        <span className="h-1/5 bg-blue-700" />
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold tracking-widest">{language.toUpperCase()}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-40">
                  <DropdownMenuItem onClick={() => setLanguage('en')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm">
                      <span className="w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2060%2030%22%3E%3CclipPath%20id%3D%22a%22%3E%3Cpath%20d%3D%22M0%200v30h60V0z%22%2F%3E%3C%2FclipPath%3E%3CclipPath%20id%3D%22b%22%3E%3Cpath%20d%3D%22M30%2015h30v15zv15H0zH0V0zV0h30z%22%2F%3E%3C%2FclipPath%3E%3Cg%20clip-path%3D%22url(%23a)%22%3E%3Cpath%20d%3D%22M0%200v30h60V0z%22%20fill%3D%22%23012169%22%2F%3E%3Cpath%20d%3D%22M0%200l60%2030m0-30L0%2030%22%20stroke%3D%22%23fff%22%20stroke-width%3D%226%22%2F%3E%3Cpath%20d%3D%22M0%200l60%2030m0-30L0%2030%22%20clip-path%3D%22url(%23b)%22%20stroke%3D%22%23C8102E%22%20stroke-width%3D%224%22%2F%3E%3Cpath%20d%3D%22M30%200v30M0%2015h60%22%20stroke%3D%22%23fff%22%20stroke-width%3D%2210%22%2F%3E%3Cpath%20d%3D%22M30%200v30M0%2015h60%22%20stroke%3D%22%23C8102E%22%20stroke-width%3D%226%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] bg-cover bg-center block w-full h-full" />
                    </span>
                    <span className="flex-1">{t('languages.en')}</span>
                    {language === 'en' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('it')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                      <span className="w-1/3 bg-green-500" />
                      <span className="w-1/3 bg-white" />
                      <span className="w-1/3 bg-red-500" />
                    </span>
                    <span className="flex-1">{t('languages.it')}</span>
                    {language === 'it' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLanguage('es')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/4 bg-red-600" />
                      <span className="h-2/4 bg-yellow-400" />
                      <span className="h-1/4 bg-red-600" />
                    </span>
                    <span className="flex-1">{t('languages.es')}</span>
                    {language === 'es' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('fr')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                      <span className="w-1/3 bg-blue-600" />
                      <span className="w-1/3 bg-white" />
                      <span className="w-1/3 bg-red-500" />
                    </span>
                    <span className="flex-1">{t('languages.fr')}</span>
                    {language === 'fr' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('de')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/3 bg-black" />
                      <span className="h-1/3 bg-red-500" />
                      <span className="h-1/3 bg-yellow-400" />
                    </span>
                    <span className="flex-1">{t('languages.de')}</span>
                    {language === 'de' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('ja')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-white flex items-center justify-center">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                    </span>
                    <span className="flex-1">日本語</span>
                    {language === 'ja' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('zh')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-red-500 flex items-center justify-center">
                      <span className="text-2xs text-yellow-400">★</span>
                    </span>
                    <span className="flex-1">中文</span>
                    {language === 'zh' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('ko')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-white flex items-center justify-center">
                      <span className="w-3 h-3 rounded-full bg-red-600 border border-blue-800" />
                    </span>
                    <span className="flex-1">한국어</span>
                    {language === 'ko' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLanguage('pt')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                      <span className="w-2/5 bg-green-600" />
                      <span className="w-3/5 bg-yellow-400" />
                    </span>
                    <span className="flex-1">{t('languages.pt')}</span>
                    {language === 'pt' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('ru')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/3 bg-white" />
                      <span className="h-1/3 bg-blue-600" />
                      <span className="h-1/3 bg-red-500" />
                    </span>
                    <span className="flex-1">Русский</span>
                    {language === 'ru' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('pl')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/2 bg-white" />
                      <span className="h-1/2 bg-red-500" />
                    </span>
                    <span className="flex-1">{t('languages.pl')}</span>
                    {language === 'pl' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('el')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/5 bg-blue-700" />
                      <span className="h-1/5 bg-white" />
                      <span className="h-1/5 bg-blue-700" />
                      <span className="h-1/5 bg-white" />
                      <span className="h-1/5 bg-blue-700" />
                    </span>
                    <span className="flex-1">Ελληνικά</span>
                    {language === 'el' && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Supporta, lavori in corso, profilo, notifiche, uscita */}
            <div className="flex items-center gap-2.5">
              <SupportButton />
              
              <Suspense fallback={<LazyFallback />}><BackgroundJobsIndicator /></Suspense>
              
              <div className="h-6 w-px bg-border mx-1" />
              
              <ProfileHeader />
              <UpdateBell />
              {/* Fino al 13/08/2026 il NotificationCenter qui sotto si apriva SOLO
                  da scorciatoia da tastiera: nessuno poteva sapere che esistesse. */}
              <NotificationBell onOpen={() => setNotificationCenterOpen(true)} />
              
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setExitDialogOpen(true)}
                title={t('common.closeApp')}
                aria-label={t('common.closeApp')}
              >
                <Power className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Content */}
          <main id="main-content" role="main" className="flex-1 overflow-hidden flex flex-col min-h-0">
            <DefaultProfileAlert />
            <div key={pathname} className="flex-1 overflow-auto min-h-0">
              {children}
            </div>
          </main>

          <StatusLine ollamaOnline={ollamaOnline} version={version} onOpenChangelog={() => setChangelogOpen(true)} />
        </div>
        
        {/* Profile Notifications */}
        <ProfileNotifications />
        
        {/* Background Translation Jobs Widget */}
        <WidgetErrorBoundary name="Traduzioni Background">
          <Suspense fallback={<LazyFallback />}><BackgroundJobsWidget /></Suspense>
        </WidgetErrorBoundary>
        
        {/* System Monitor Overlay */}
        <Suspense fallback={<LazyFallback />}><SystemOverlay position="bottom-right" compact /></Suspense>
        
        {/* Auto Updater Notification */}
        <AutoUpdater />
        
        {/* Notification Center */}
        <NotificationCenter 
          isOpen={notificationCenterOpen}
          onClose={() => setNotificationCenterOpen(false)}
        />
        
        {/* Changelog Dialog */}
        <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b border-border">
              <DialogTitle className="flex flex-col items-start gap-1.5">
                <span className="font-pixel text-xl leading-none text-foreground">{t('common.changelog')}</span>
                <span className="rounded-sm border border-border bg-secondary px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
                  {t('changelog.currentVersion')} v{version}
                </span>
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] px-6 py-4">
              <div className="space-y-8 relative pb-6">
                {/* Linea verticale della timeline */}
                <div className="absolute top-2 bottom-0 left-0 w-px bg-border" />

                {allVersions.map((versionEntry, idx) => (
                  <div key={versionEntry.version} className="relative z-10">
                    {/* Nodo della timeline: pieno e oro sull'ultima versione, come il cursore ▶ */}
                    <div className={cn(
                      'absolute -left-1 top-2 h-2 w-2 ring-4 ring-popover',
                      idx === 0 ? 'bg-gold' : 'bg-border'
                    )} />

                    {/* Version Header */}
                    <div className="pl-10 mb-4">
                      <div className="flex items-baseline gap-3 mb-1">
                        <h3 className="flex items-center gap-2 font-mono text-lg font-bold text-foreground">
                          v{versionEntry.version}
                          {idx === 0 && (
                            <Badge variant="success" className="px-1.5 py-0 text-[10px] uppercase">
                              {t('changelog.latest')}
                            </Badge>
                          )}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground">
                          {versionEntry.date}
                        </span>
                        <span className="h-1 w-1 bg-border" />
                        <span className={`font-medium ${
                          versionEntry.type === 'feature' ? 'text-primary' :
                          versionEntry.type === 'major' ? 'text-gold' :
                          'text-info'
                        }`}>
                          {versionEntry.type === 'feature' ? t('changelog.featureUpdate') :
                           versionEntry.type === 'major' ? t('changelog.majorRelease') :
                           t('changelog.patchNotes')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Changes List */}
                    <div className="pl-10 space-y-2.5">
                      {versionEntry.changes.map((change, changeIdx) => {
                        const translationKey = `changelog.v${versionEntry.version.replace(/\./g, '_')}.${changeIdx}`;
                        const translatedChange = t(translationKey as string);
                        const displayChange = translatedChange !== translationKey ? translatedChange : change;
                        
                        return (
                          <div key={changeIdx} className="flex items-start gap-3 group">
                            <div className="mt-2 h-1.5 w-1.5 shrink-0 bg-muted-foreground/60 transition-colors group-hover:bg-primary" />
                            <span className="text-sm leading-relaxed text-foreground/90">{displayChange}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Terms of Use (DEVE apparire PRIMA del tutorial) */}
        <Suspense fallback={<LazyFallback />}><TermsOfUse /></Suspense>

        {/* Tutorial Interattivo (onboarding prima visita) */}
        <Suspense fallback={<LazyFallback />}><InteractiveTutorial /></Suspense>

        {/* Primo gioco in 5 minuti (dopo il tutorial) */}
        <Suspense fallback={<LazyFallback />}><FirstGameFlow /></Suspense>

        {/* Tutorial per-pagina (provider context) */}
        <TutorialOverlay />
        
        {/* Command Palette (Ctrl+K) — l'unica: GlobalSearch rispondeva allo stesso
            Ctrl+K e i due dialog si aprivano insieme */}
        <Suspense fallback={<LazyFallback />}><CommandPalette /></Suspense>

        {/* Exit Confirmation Dialog */}
        <AlertDialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common.closeApp')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('common.closeAppDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: 'destructive' })}
                onClick={async () => {
                  try {
                    await invoke('close_app');
                  } catch (e: unknown) {
                    clientLogger.error('Error closing app:', String(e));
                  }
                }}
              >
                {t('common.close')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TutorialProvider>
  );
}




