
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useVersion } from '@/lib/version';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Home, 
  Gamepad2,
  Bot, 
  FileText, 
  Store, 
  Settings,
  Menu,
  X,
  Bug,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Brain,
  Wand2,
  Database,
  Power,
  Cpu,
  Scan,
  Puzzle,
  Sparkles,
  HelpCircle,
  Package,
  Wifi,
  WifiOff,
  Search,
  Globe,
  Image as ImageIcon,
  Download,
  Mic,
  Users,
  Wrench,
  Subtitles,
  BookOpen,
  Check,
  Layers,
  ShieldCheck,
  Film,
  FileArchive,
  FolderTree,
  Info,
  ShoppingBag,
  FolderOpen,
  AudioLines,
  Glasses,
  MessageSquare,
  Monitor,
  User,
  Heart,
  Wheat,
  Workflow,
  ScanEye,
  Rocket,
  Crosshair,
  Eye,
  BarChart3,
  Newspaper,
  Clock,
  Edit3,
  Binary,
  ArrowRight,
  Library,
  Languages,
  Shield,
  Disc
} from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ProfileHeader } from '@/components/profiles/profile-header';
import { AuthStatusSidebar } from '@/components/auth/auth-status-sidebar';
import { ProfileNotifications } from '@/components/profiles/profile-notifications';
import { DefaultProfileAlert } from '@/components/profiles/default-profile-alert';
import { SupportButton } from '@/components/support/support-button';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { useNotificationShortcuts } from '@/hooks/use-global-shortcuts';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { UpdateBell } from '@/components/notifications/update-bell';
import { FeaturedGameWidget } from '@/components/ui/featured-game-widget';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { InteractiveTutorial } from '@/components/onboarding/interactive-tutorial';
import { TermsOfUse } from '@/components/onboarding/terms-of-use';
import { TutorialProvider } from '@/components/tutorial/tutorial-provider';
import { TutorialOverlay } from '@/components/tutorial/tutorial-overlay';
import { TutorialMenu } from '@/components/tutorial/tutorial-menu';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { CommandPalette } from '@/components/ui/command-palette';
import { GlobalSearch } from '@/components/layout/global-search';
import { SystemOverlay } from '@/components/system-overlay';
import { useTranslation } from '@/lib/i18n';
import { useScreen } from '@/components/providers/screen-provider';
import { isChatEnabled, autoSyncGSToSupabase } from '@/lib/community-chat';
import { PersistentChat } from '@/components/layout/persistent-chat';

interface MainLayoutProps {
  children: React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR NAVIGATION — Pulita e minimale
// Solo voci essenziali. Tutto il resto via Ctrl+K (Global Search).
// ═══════════════════════════════════════════════════════════════════
const getNavGroups = (t: (key: string) => string) => [
  // ── CORE ────────────────────────────────────────────────────────
  {
    label: t('nav.core'),
    items: [
      { name: t('nav.dashboard'), href: '/', icon: Home },
      { name: t('nav.library'), href: '/library', icon: Gamepad2 },
      { name: 'Traduci Gioco', href: '/auto-translate', icon: Rocket, highlight: true },
    ],
    colorClass: 'text-slate-400 hover:text-slate-200 hover:bg-slate-500/20',
    activeClass: 'bg-slate-500/20 backdrop-blur-md text-slate-200 border border-slate-500/30 shadow-lg shadow-slate-500/20',
    iconClass: 'text-slate-400',
    hoverIconClass: 'group-hover:text-slate-200',
    underlineClass: 'bg-slate-400',
    labelColor: 'text-slate-400/60',
  },
  // ── TRADUZIONE ──────────────────────────────────────────────────
  {
    label: t('nav.translation'),
    icon: Sparkles,
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { name: t('nav.translate'), href: '/ai-translator', icon: Sparkles },
      { name: t('nav.ocrTranslator'), href: '/ocr-translator', icon: Scan },
      { name: t('nav.voice'), href: '/voice-translator', icon: Mic },
      { name: t('nav.batch'), href: '/batch', icon: FolderTree },
      { name: t('nav.offlineTranslator'), href: '/offline-translator', icon: WifiOff },
      { name: t('nav.editor'), href: '/editor', icon: Edit3 },
    ],
    colorClass: 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20',
    activeClass: 'bg-blue-500/20 backdrop-blur-md text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/20',
    iconClass: 'text-blue-400',
    hoverIconClass: 'group-hover:text-blue-300',
    underlineClass: 'bg-blue-400',
    labelColor: 'text-blue-400/60',
  },
  // ── PATCHER ─────────────────────────────────────────────────────
  {
    label: 'Patcher',
    icon: Wand2,
    collapsible: true,
    items: [
      { 
        name: 'Patcher Engine', 
        href: '/unity-patcher', 
        icon: Wand2,
        subItems: [
          { name: 'Unity', href: '/unity-patcher', icon: Wand2 },
          { name: 'Unity Localization', href: '/unity-localization', icon: Globe },
          { name: 'Unreal Engine', href: '/unreal-translator', icon: Cpu },
          { name: 'Godot', href: '/godot-translator', icon: Globe },
          { name: 'RPG Maker', href: '/rpgmaker-patcher', icon: Gamepad2 },
          { name: "Ren'Py", href: '/renpy-patcher', icon: Heart },
          { name: 'Bethesda', href: '/bethesda-patcher', icon: Shield },
          { name: 'CRI Middleware', href: '/cri-patcher', icon: Disc },
        ],
      },
      { name: t('nav.overlay'), href: '/overlay', icon: Subtitles },
    ],
    colorClass: 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20',
    activeClass: 'bg-emerald-500/20 backdrop-blur-md text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20',
    iconClass: 'text-emerald-400',
    hoverIconClass: 'group-hover:text-emerald-300',
    underlineClass: 'bg-emerald-400',
    labelColor: 'text-emerald-400/60',
  },
  // ── RISORSE ─────────────────────────────────────────────────────
  {
    label: t('nav.resources'),
    icon: FolderOpen,
    collapsible: true,
    items: [
      { name: t('nav.community'), href: '/community-hub', icon: Users },
      { name: 'Ollama / AI', href: '/ollama-manager', icon: Package, ollamaIndicator: true },
      { name: t('nav.settings'), href: '/settings', icon: Settings },
      { name: t('nav.guide'), href: '/guide', icon: BookOpen },
    ],
    colorClass: 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/20',
    activeClass: 'bg-orange-400/20 backdrop-blur-md text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-500/20',
    iconClass: 'text-orange-400',
    hoverIconClass: 'group-hover:text-orange-300',
    underlineClass: 'bg-orange-400',
    labelColor: 'text-orange-400/60',
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [expandedSubMenus, setExpandedSubMenus] = useState<string[]>([]);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  
  // Global keyboard shortcuts for notifications
  useNotificationShortcuts(
    () => setNotificationCenterOpen(true),
    () => setNotificationCenterOpen(prev => !prev)
  );
  
  // Keyboard shortcuts globali
  useKeyboardShortcuts();
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    neuralEngine: { status: 'online', color: 'bg-green-500', text: 'ON' },
    steamApi: { status: 'connected', color: 'bg-blue-500', text: 'OK' },
    cache: { percentage: 0, color: 'bg-cyan-500', text: '0%' }
  });
  const [isOnline, setIsOnline] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { version, buildInfo, allVersions } = useVersion();

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
  
  // Check internet connection
  useEffect(() => {
    const checkConnection = () => {
      setIsOnline(navigator.onLine);
    };
    
    checkConnection();
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    
    // Periodic check every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    
    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
    // Carica preferenza sidebar dal localStorage
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (savedSidebarState !== null) {
      setSidebarOpen(JSON.parse(savedSidebarState));
    }
    
    // Aggiorna status del sistema solo all'avvio (no polling continuo)
    updateSystemStatus();

    // Auto-sync chat Supabase appena loggato (in background, non blocca l'UI)
    if (isChatEnabled()) {
      autoSyncGSToSupabase().then((uid) => {
        if (uid) console.log('[MainLayout] Chat Supabase pronta, userId:', uid);
      }).catch(() => {});
    }
  }, []);

  // Auto-expand gruppo sidebar in base alla pagina corrente
  useEffect(() => {
    if (!pathname) return;
    for (const group of navGroups) {
      if (!group.collapsible) continue;
      const match = group.items.some((item: unknown) => {
        if (pathname === item.href) return true;
        if (item.subItems) return item.subItems.some((sub: unknown) => pathname === sub.href);
        return false;
      });
      if (match) {
        setExpandedGroups(prev => prev.includes(group.label) ? prev : [group.label]);
        // Auto-expand subItems se è un patcher engine
        const subMatch = group.items.find((item: unknown) => 
          item.subItems?.some((sub: unknown) => pathname === sub.href)
        );
        if (subMatch) {
          setExpandedSubMenus(prev => prev.includes(subMatch.href) ? prev : [subMatch.href]);
        }
        break;
      }
    }
  }, [pathname]);

  // Ollama status polling per indicatore sidebar
  useEffect(() => {
    const checkOllama = async () => {
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
        const cached = _gc.__gsSteamConnCache;
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
    } catch (error) {
      console.error('Error updating system status:', error);
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
        {/* Sidebar */}
        <aside 
          data-tutorial="sidebar"
          className="fixed inset-y-0 left-0 z-50 bg-slate-950/95 border-r border-slate-800/50 transform transition-all duration-300 ease-in-out flex flex-col shadow-xl backdrop-blur-xl"
          style={{ width: sidebarOpen ? `${display.sidebarWidth}px` : '72px' }}
        >
          {/* Header con logo e toggle */}
          <div className="relative flex items-center h-[72px] px-4 border-b border-slate-800/50 bg-slate-900/20">
            {sidebarOpen && (
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex items-center justify-center">
                  <img 
                    src="/logohires.png" 
                    alt="GameStringer" 
                    className="h-[38px] w-auto animate-logo-glow"
                    style={{
                      filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.4))',
                      animation: 'logoGlow 4s ease-in-out infinite'
                    }}
                  />
                </div>
                <div className="flex flex-col">
                  <span 
                    className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, #a78bfa, #818cf8, #38bdf8, #a78bfa)',
                      backgroundSize: '200% 100%',
                      animation: 'gradientMove 4s linear infinite'
                    }}
                  >
                    GameStringer
                  </span>
                  <span className="text-[9px] font-medium text-slate-500 uppercase tracking-[0.2em] -mt-0.5">Studio</span>
                </div>
              </div>
            )}
            
            {/* Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-lg transition-all duration-300 border border-transparent hover:bg-slate-800 hover:border-slate-700/50 hover:shadow-md",
                sidebarOpen ? "ml-auto" : "mx-auto w-10 h-10 bg-slate-900/50 border-slate-800/50 shadow-inner"
              )}
              onClick={toggleSidebar}
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-4 w-4 text-slate-400 hover:text-slate-200 transition-colors" />
              ) : (
                <div className="relative">
                  <ChevronRight className="h-5 w-5 text-indigo-400 transition-transform duration-300 group-hover:translate-x-0.5" />
                  <div className="absolute inset-0 bg-indigo-400/20 rounded-full blur-md animate-pulse" />
                </div>
              )}
            </Button>
          </div>
          
          <nav className="flex-1 px-3 py-4 overflow-y-auto min-h-0 custom-scrollbar space-y-1">
            {navGroups.map((group, groupIndex) => {
              const isExpanded = expandedGroups.includes(group.label);
              const toggleGroup = () => {
                const wasOpen = expandedGroups.includes(group.label);
                setExpandedGroups(wasOpen ? [] : [group.label]);
                // Reset sottomenu quando cambi gruppo
                if (!wasOpen) setExpandedSubMenus([]);
              };
              const GroupIcon = group.icon;
              
              return (
                <div key={groupIndex}>
                  {/* Separatore lucido dopo Core (Dashboard/Library) */}
                  {groupIndex === 1 && (
                    <div className="my-3 mx-4 h-px bg-gradient-to-r from-transparent via-slate-600/30 to-transparent" />
                  )}
                  
                  {/* Gruppo collapsabile */}
                  {group.collapsible ? (
                    <>
                      <Button
                        variant="ghost"
                        onClick={toggleGroup}
                        data-tutorial={`nav-${group.label.toLowerCase().includes('traduz') || group.label.toLowerCase().includes('trans') ? 'translator' : 'tools'}`}
                        className={cn(
                          "w-full transition-all duration-300 ease-out group relative",
                          sidebarOpen ? "justify-start space-x-3 px-3 py-6 hover:bg-slate-800/40 rounded-xl" : "justify-center px-0 py-6 hover:bg-slate-800/40 rounded-xl",
                          group.colorClass
                        )}
                        title={!sidebarOpen ? group.label : undefined}
                      >
                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 rounded-xl" />
                        
                        {GroupIcon && (
                          <GroupIcon className={cn(
                            "transition-all duration-300",
                            sidebarOpen ? "h-[18px] w-[18px]" : "h-5 w-5",
                            isExpanded ? group.iconClass.replace('/70', '') : group.iconClass
                          )} />
                        )}
                        {sidebarOpen && (
                          <>
                            <span className={cn(
                              "text-sm flex-1 text-left font-semibold tracking-wide transition-colors",
                              isExpanded ? "text-slate-200" : "text-slate-400"
                            )}>{group.label}</span>
                            <ChevronDown className={cn(
                              "h-3.5 w-3.5 transition-transform duration-300 text-slate-500",
                              isExpanded ? "rotate-180 text-slate-300" : ""
                            )} />
                          </>
                        )}
                      </Button>
                      
                      {/* Sottomenu espandibile */}
                      <div className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        isExpanded && sidebarOpen ? "max-h-[800px] opacity-100 mt-1 mb-2" : "max-h-0 opacity-0"
                      )}>
                        <div className="pl-3.5 relative space-y-0.5 py-1">
                          {/* Linea verticale indicatore sottomenu */}
                          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-700/50 via-slate-700/20 to-transparent" />
                          
                          {group.items.map((item: unknown, itemIdx: number) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            const hasSubItems = item.subItems && item.subItems.length > 0;
                            const isSubActive = hasSubItems && item.subItems.some((sub: unknown) => pathname === sub.href);
                            
                            return (
                              <div key={`${item.href}-${itemIdx}`} className="relative z-10 pl-4">
                                {hasSubItems ? (
                                  <>
                                    {/* Item con subItems - Accordion */}
                                    <Button
                                      variant="ghost"
                                      onClick={() => {
                                        setExpandedSubMenus(prev => 
                                          prev.includes(item.href) 
                                            ? []
                                            : [item.href]
                                        );
                                      }}
                                      className={cn(
                                        "w-full transition-all duration-200 ease-out group relative justify-start space-x-3 px-3 h-8 rounded-lg",
                                        (isActive || isSubActive) 
                                          ? cn(group.activeClass, "shadow-sm") 
                                          : cn(group.colorClass, "hover:bg-slate-800/40")
                                      )}
                                    >
                                      <Icon className={cn(
                                        "h-3.5 w-3.5 transition-colors duration-200",
                                        (isActive || isSubActive) ? "" : cn(group.iconClass, group.hoverIconClass)
                                      )} />
                                      <span className="text-xs relative flex-1 text-left">
                                        {item.name}
                                      </span>
                                      <ChevronRight className={cn(
                                        "h-3.5 w-3.5 transition-transform duration-200",
                                        expandedSubMenus.includes(item.href) ? "rotate-90" : ""
                                      )} />
                                    </Button>
                                    {/* Sub-items accordion */}
                                    <div className={cn(
                                      "overflow-hidden transition-all duration-200",
                                      expandedSubMenus.includes(item.href) ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                                    )}>
                                      <div className="pl-4 space-y-0.5 py-0.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                                        {item.subItems.map((subItem: unknown) => {
                                          const SubIcon = subItem.icon;
                                          const isSubItemActive = pathname === subItem.href;
                                          
                                          return (
                                            <Button
                                              key={subItem.href}
                                              variant="ghost"
                                              asChild
                                              className={cn(
                                                "w-full transition-all duration-200 ease-out justify-start space-x-3 px-3 h-7",
                                                isSubItemActive ? group.activeClass : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                                              )}
                                            >
                                              <Link href={subItem.href}>
                                                {SubIcon && <SubIcon className="h-3 w-3 opacity-80" />}
                                                <span className="text-[11px] font-medium">{subItem.label || subItem.name}</span>
                                              </Link>
                                            </Button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    asChild
                                    className={cn(
                                      "w-full transition-all duration-200 ease-out group relative justify-start space-x-3 px-3 h-8 rounded-lg",
                                      isActive 
                                        ? cn(group.activeClass, "shadow-sm") 
                                        : cn(group.colorClass, "hover:bg-slate-800/40")
                                    )}
                                  >
                                    <Link href={item.href}>
                                      {/* Indicatore attivo laterale */}
                                      {isActive && (
                                        <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-current opacity-70" />
                                      )}
                                      {Icon && (
                                        <Icon className={cn(
                                          "h-3.5 w-3.5 transition-transform duration-200",
                                          isActive ? "scale-110" : ""
                                        )} />
                                      )}
                                      <span className={cn(
                                        "text-[13px] relative flex items-center gap-1.5",
                                        isActive ? "font-semibold" : "font-medium"
                                      )}>
                                        {item.name}
                                        {item.ollamaIndicator && ollamaOnline !== null && (
                                          <span className={cn(
                                            "h-1.5 w-1.5 rounded-full shrink-0 transition-colors",
                                            ollamaOnline ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" : "bg-red-400"
                                          )} title={ollamaOnline ? 'Ollama online' : 'Ollama offline'} />
                                        )}
                                        <span className={cn(
                                          "absolute left-0 -bottom-0.5 h-[2px] w-0 group-hover:w-full transition-all duration-300 ease-out rounded-full",
                                          group.underlineClass
                                        )} />
                                      </span>
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Label gruppo normale */}
                      {group.label && sidebarOpen && (
                        <div className="px-3 pt-2 pb-0.5">
                          <span className={cn("text-[9px] font-semibold uppercase tracking-wider", group.labelColor)}>
                            {group.label}
                          </span>
                        </div>
                      )}
                      
                      <div className="space-y-0.5">
                        {group.items.map((item: unknown) => {
                          const Icon = item.icon;
                          const isActive = pathname === item.href;
                          const isHighlight = item.highlight === true;
                          
                          return (
                            <Link key={item.href} href={item.href}>
                              <Button
                                variant="ghost"
                                data-tutorial={`nav-${item.href === '/' ? 'dashboard' : item.href.replace('/', '')}`}
                                className={cn(
                                  "w-full transition-all duration-200 ease-out group relative",
                                  sidebarOpen 
                                    ? "justify-start space-x-3 px-3" 
                                    : "justify-center px-0",
                                  isHighlight && !isActive
                                    ? "bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-violet-300 hover:from-violet-600/30 hover:to-indigo-600/30 hover:text-violet-200 border border-violet-500/30 rounded-lg shadow-[0_0_12px_rgba(139,92,246,0.15)] hover:shadow-[0_0_18px_rgba(139,92,246,0.25)]"
                                    : isActive 
                                      ? group.activeClass 
                                      : group.colorClass
                                )}
                                title={!sidebarOpen ? item.name : undefined}
                              >
                                <Icon className={cn(
                                  "transition-colors duration-200",
                                  sidebarOpen ? "h-4 w-4" : "h-5 w-5",
                                  isHighlight && !isActive ? "text-violet-400" : isActive ? "" : cn(group.iconClass, group.hoverIconClass)
                                )} />
                                {sidebarOpen && (
                                  <span className={cn(
                                    "text-sm relative",
                                    isHighlight ? "font-semibold" : ""
                                  )}>
                                    {item.name}
                                    <span className={cn(
                                      "absolute left-0 -bottom-0.5 h-[2px] w-0 group-hover:w-full transition-all duration-300 ease-out rounded-full",
                                      isHighlight ? "bg-violet-400" : group.underlineClass
                                    )} />
                                  </span>
                                )}
                              </Button>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Tutorial Help */}
          <div className="shrink-0 px-3 py-2 flex items-center justify-center bg-slate-900/30 border-t border-slate-800/50">
            {sidebarOpen ? (
              <div className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer group">
                <TutorialMenu />
                <span className="text-[10px] font-medium text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-widest">Tutorial & Guide</span>
              </div>
            ) : (
              <TutorialMenu />
            )}
          </div>

          {/* Widget Gioco in Evidenza */}
          <div className="shrink-0 border-t border-slate-800/50 bg-black/20 pb-2 pt-2">
            <div className="px-2">
              <FeaturedGameWidget collapsed={!sidebarOpen} />
            </div>
          </div>
          
        </aside>

        {/* Main Content */}
        <div 
          className="flex-1 flex flex-col min-w-0 min-h-0 transition-all duration-300 relative z-10 h-full"
          style={{ marginLeft: sidebarOpen ? `${display.sidebarWidth}px` : '72px' }}
        >
          {/* Header */}
          <header className="h-[72px] shrink-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center px-6 z-40 shadow-sm">
            {/* Ricerca a sinistra - Campo compilabile */}
            <div className="relative group w-80">
              <div className="absolute inset-0 bg-indigo-500/10 blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-slate-500 pointer-events-none" />
                <Input
                  type="text"
                  placeholder={`${t('commandPalette.placeholder')} (Ctrl+K)`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      setSearchOpen(true);
                    }
                  }}
                  className="h-10 pl-9 pr-3 bg-slate-900/50 border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600/80 focus:bg-slate-800/50 focus:border-indigo-500/50 rounded-xl text-sm text-slate-300 placeholder:text-slate-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              
              {/* Dropdown risultati ricerca */}
              {searchFocused && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden z-50">
                  <ScrollArea className="max-h-[300px]">
                    {(() => {
                      const navigationItems = [
                        { id: 'dashboard', title: t('nav.dashboard'), description: t('commandPalette.dashboardDesc'), icon: Home, path: '/' },
                        { id: 'library', title: t('nav.library'), description: t('commandPalette.libraryDesc'), icon: Library, path: '/library' },
                        { id: 'translator', title: t('nav.translate'), description: t('commandPalette.translateDesc'), icon: Languages, path: '/ai-translator' },
                        { id: 'dictionary', title: t('nav.dictionary'), description: t('commandPalette.dictionaryDesc'), icon: Database, path: '/memory' },
                        { id: 'multi-llm', title: t('nav.multiLlm'), description: t('commandPalette.multiLlmDesc'), icon: Brain, path: '/translator/compare' },
                        { id: 'voice', title: t('nav.voice'), description: t('commandPalette.voiceDesc'), icon: Mic, path: '/voice-translator' },
                        { id: 'patcher', title: t('nav.patcher'), description: t('commandPalette.patcherDesc'), icon: Wrench, path: '/unity-patcher' },
                        { id: 'injector', title: t('nav.injector'), description: t('commandPalette.patcherDesc'), icon: Puzzle, path: '/injector' },
                        { id: 'crawler', title: t('nav.contextHarvester'), description: t('commandPalette.scanGamesDesc'), icon: Scan, path: '/crawler' },
                        { id: 'fixer', title: t('nav.fixer'), description: t('commandPalette.patcherDesc'), icon: Wand2, path: '/fixer' },
                        { id: 'overlay', title: t('nav.overlay'), description: t('commandPalette.patcherDesc'), icon: Subtitles, path: '/overlay' },
                        { id: 'rom-patcher', title: 'ROM Patcher', description: 'Applica e crea patch IPS/BPS per traduzioni retro', icon: Disc, path: '/rom-patcher' },
                        { id: 'community', title: t('nav.community'), description: t('commandPalette.communityDesc'), icon: Users, path: '/community-hub' },
                        { id: 'settings', title: t('nav.settings'), description: t('commandPalette.settingsDesc'), icon: Settings, path: '/settings' },
                      ];
                      
                      const filtered = navigationItems.filter(item => 
                        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.description.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      
                      if (filtered.length === 0) {
                        return (
                          <div className="py-6 text-center text-sm text-slate-500">
                            {t('commandPalette.noResults')} "{searchQuery}"
                          </div>
                        );
                      }
                      
                      return (
                        <div className="p-2">
                          {filtered.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.id}
                                href={item.path}
                                onClick={() => {
                                  setSearchQuery('');
                                  setSearchFocused(false);
                                }}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group"
                              >
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800/50 group-hover:bg-indigo-500/20">
                                  <Icon className="h-4 w-4 text-slate-400 group-hover:text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-200 truncate">{item.title}</p>
                                  <p className="text-xs text-slate-500 truncate">{item.description}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            );
                          })}
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
                  <Button variant="outline" size="sm" className="h-9 gap-2.5 px-3.5 bg-slate-900/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600/80 hover:text-slate-100 text-slate-300 rounded-xl shadow-inner transition-all group">
                    <Globe className="h-4 w-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
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
                        <span className="text-[6px] text-yellow-400">★</span>
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
                    <span className="text-[11px] font-bold tracking-widest">{language.toUpperCase()}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-40">
                  <DropdownMenuItem onClick={() => setLanguage('en')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm">
                      <span className="w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2060%2030%22%3E%3CclipPath%20id%3D%22a%22%3E%3Cpath%20d%3D%22M0%200v30h60V0z%22%2F%3E%3C%2FclipPath%3E%3CclipPath%20id%3D%22b%22%3E%3Cpath%20d%3D%22M30%2015h30v15zv15H0zH0V0zV0h30z%22%2F%3E%3C%2FclipPath%3E%3Cg%20clip-path%3D%22url(%23a)%22%3E%3Cpath%20d%3D%22M0%200v30h60V0z%22%20fill%3D%22%23012169%22%2F%3E%3Cpath%20d%3D%22M0%200l60%2030m0-30L0%2030%22%20stroke%3D%22%23fff%22%20stroke-width%3D%226%22%2F%3E%3Cpath%20d%3D%22M0%200l60%2030m0-30L0%2030%22%20clip-path%3D%22url(%23b)%22%20stroke%3D%22%23C8102E%22%20stroke-width%3D%224%22%2F%3E%3Cpath%20d%3D%22M30%200v30M0%2015h60%22%20stroke%3D%22%23fff%22%20stroke-width%3D%2210%22%2F%3E%3Cpath%20d%3D%22M30%200v30M0%2015h60%22%20stroke%3D%22%23C8102E%22%20stroke-width%3D%226%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] bg-cover bg-center block w-full h-full" />
                    </span>
                    <span className="flex-1">English</span>
                    {language === 'en' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('it')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                      <span className="w-1/3 bg-green-500" />
                      <span className="w-1/3 bg-white" />
                      <span className="w-1/3 bg-red-500" />
                    </span>
                    <span className="flex-1">Italiano</span>
                    {language === 'it' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLanguage('es')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/4 bg-red-600" />
                      <span className="h-2/4 bg-yellow-400" />
                      <span className="h-1/4 bg-red-600" />
                    </span>
                    <span className="flex-1">Español</span>
                    {language === 'es' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('fr')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                      <span className="w-1/3 bg-blue-600" />
                      <span className="w-1/3 bg-white" />
                      <span className="w-1/3 bg-red-500" />
                    </span>
                    <span className="flex-1">Français</span>
                    {language === 'fr' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('de')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/3 bg-black" />
                      <span className="h-1/3 bg-red-500" />
                      <span className="h-1/3 bg-yellow-400" />
                    </span>
                    <span className="flex-1">Deutsch</span>
                    {language === 'de' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('ja')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-white flex items-center justify-center">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                    </span>
                    <span className="flex-1">日本語</span>
                    {language === 'ja' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('zh')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-red-500 flex items-center justify-center">
                      <span className="text-[8px] text-yellow-400">★</span>
                    </span>
                    <span className="flex-1">中文</span>
                    {language === 'zh' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('ko')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm bg-white flex items-center justify-center">
                      <span className="w-3 h-3 rounded-full bg-red-600 border border-blue-800" />
                    </span>
                    <span className="flex-1">한국어</span>
                    {language === 'ko' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLanguage('pt')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex">
                      <span className="w-2/5 bg-green-600" />
                      <span className="w-3/5 bg-yellow-400" />
                    </span>
                    <span className="flex-1">Português</span>
                    {language === 'pt' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('ru')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/3 bg-white" />
                      <span className="h-1/3 bg-blue-600" />
                      <span className="h-1/3 bg-red-500" />
                    </span>
                    <span className="flex-1">Русский</span>
                    {language === 'ru' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLanguage('pl')} className="gap-3">
                    <span className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/20 shadow-sm flex flex-col">
                      <span className="h-1/2 bg-white" />
                      <span className="h-1/2 bg-red-500" />
                    </span>
                    <span className="flex-1">Polski</span>
                    {language === 'pl' && <Check className="h-4 w-4 text-blue-400" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Wifi/Versione/Sito + Supporta, Profilo, Notifica, Tema, Power - a destra */}
            <div className="flex items-center gap-2.5">
              {/* Box Info (Versione + Sito) */}
              <div className="flex items-center bg-slate-900/40 border border-slate-800/60 rounded-lg p-1 mr-2 hidden md:flex">
                <a 
                  href="http://www.gamestringer.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 rounded-md transition-all"
                  title="Visita gamestringer.ai"
                >
                  <Globe className="w-3 h-3" />
                  <span>gamestringer.ai</span>
                </a>
                <div className="w-px h-3 bg-slate-800 mx-1" />
                <button 
                  onClick={() => setChangelogOpen(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50 rounded-md transition-all"
                  title="Changelog"
                >
                  {isOnline ? (
                    <Wifi className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-red-500" />
                  )}
                  <span className="font-mono">v{version}</span>
                </button>
              </div>

              <SupportButton />
              
              <div className="h-6 w-px bg-slate-800/60 mx-1" />
              
              <ProfileHeader />
              <UpdateBell />
              
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                onClick={() => setExitDialogOpen(true)}
                title={t('common.closeApp')}
              >
                <Power className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-hidden flex flex-col min-h-0">
            <DefaultProfileAlert />
            <div key={pathname} className="flex-1 overflow-auto min-h-0">
              {children}
            </div>
          </main>
        </div>
        
        {/* Persistent Chat Widget — visibile su tutte le pagine */}
        <PersistentChat />

        {/* Profile Notifications */}
        <ProfileNotifications />
        
        {/* System Monitor Overlay */}
        <SystemOverlay position="bottom-right" compact />
        
        {/* Notification Center */}
        <NotificationCenter 
          isOpen={notificationCenterOpen}
          onClose={() => setNotificationCenterOpen(false)}
        />
        
        {/* Changelog Dialog */}
        <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Changelog - v{version}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {allVersions.map((versionEntry, idx) => (
                  <div key={versionEntry.version} className="space-y-2">
                    {/* Version Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {versionEntry.version === '1.5.0' && '💬 '}
                          {versionEntry.version === '1.4.2' && '🚀 '}
                          {versionEntry.version === '1.4.1' && '🌍 '}
                          {versionEntry.version === '1.4.0' && '🧹 '}
                          {versionEntry.version === '1.3.0' && '🎮 '}
                          {versionEntry.version === '1.2.0' && '🛡️ '}
                          {versionEntry.version === '1.1.0' && '🌐 '}
                          {versionEntry.version === '1.0.0' && '🎉 '}
                          v{versionEntry.version}
                        </h3>
                        <span className="inline-block text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded mt-1">
                          {versionEntry.date}
                        </span>
                      </div>
                    </div>
                    
                    {/* Changes List */}
                    <div className="space-y-1 ml-4">
                      {versionEntry.changes.map((change, changeIdx) => (
                        <div key={changeIdx} className="flex items-start gap-2">
                          <span className="text-blue-400 mt-1">•</span>
                          <span className="text-sm text-gray-300">{change}</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Separator between versions */}
                    {idx < allVersions.length - 1 && (
                      <div className="border-t border-gray-700/50 mt-4" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Terms of Use (DEVE apparire PRIMA del tutorial) */}
        <TermsOfUse />

        {/* Tutorial Interattivo (onboarding prima visita) */}
        <InteractiveTutorial />
        
        {/* Tutorial per-pagina (provider context) */}
        <TutorialOverlay />
        
        {/* Command Palette (Ctrl+K) */}
        <CommandPalette />
        
        {/* Global Search */}
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        
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
                className="bg-red-500 hover:bg-red-600"
                onClick={async () => {
                  try {
                    await invoke('close_app');
                  } catch (e) {
                    console.error('Error closing app:', e);
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



