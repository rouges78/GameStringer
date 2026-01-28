
'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useVersion } from '@/lib/version';
import { Button } from '@/components/ui/button';
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
  MessageSquare
} from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ProfileHeader } from '@/components/profiles/profile-header';
import { AuthStatusSidebar } from '@/components/auth/auth-status-sidebar';
import { ProfileNotifications } from '@/components/profiles/profile-notifications';
import { DefaultProfileAlert } from '@/components/profiles/default-profile-alert';
import { NotificationIndicator } from '@/components/notifications/notification-indicator';
import { SupportButton } from '@/components/support/support-button';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { useNotificationShortcuts } from '@/hooks/use-global-shortcuts';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { CommandPalette } from '@/components/ui/command-palette';
import { GlobalSearch } from '@/components/layout/global-search';
import { useTranslation } from '@/lib/i18n';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Funzione per generare gruppi di navigazione tradotti
const getNavGroups = (t: (key: string) => string) => [
  // CORE
  {
    label: t('nav.core'),
    items: [
      { name: t('nav.dashboard'), href: '/', icon: Home },
      { name: t('nav.library'), href: '/library', icon: Gamepad2 },
    ],
    colorClass: 'text-slate-400 hover:text-slate-200 hover:bg-slate-500/20',
    activeClass: 'bg-slate-500/20 backdrop-blur-md text-slate-200 border border-slate-500/30 shadow-lg shadow-slate-500/20',
    iconClass: 'text-slate-400',
    hoverIconClass: 'group-hover:text-slate-200',
    underlineClass: 'bg-slate-400',
    labelColor: 'text-slate-400/60',
  },
  // TRADUZIONE - Collapsabile
  {
    label: t('nav.translation'),
    icon: Sparkles,
    collapsible: true,
    items: [
      { name: t('nav.translate'), href: '/ai-translator', icon: Sparkles },
      { name: 'AI Review', href: '/ai-review', icon: Bot },
      { name: 'OCR Translator', href: '/ocr-translator', icon: Scan },
      { name: 'Emotion', href: '/emotion-translator', icon: Sparkles },
      { name: t('nav.multiLlm'), href: '/translator/compare', icon: Brain },
      { name: t('nav.voice'), href: '/voice-translator', icon: Mic },
      { name: t('nav.voiceClone'), href: '/voice-clone', icon: AudioLines },
      { name: t('nav.subtitles') || 'Sottotitoli', href: '/subtitles', icon: Film },
      { name: t('nav.batch') || 'Batch', href: '/batch', icon: FolderTree },
      { name: t('nav.dictionary'), href: '/memory', icon: Database },
    ],
    colorClass: 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20',
    activeClass: 'bg-blue-500/20 backdrop-blur-md text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/20',
    iconClass: 'text-blue-400',
    hoverIconClass: 'group-hover:text-blue-300',
    underlineClass: 'bg-blue-400',
    labelColor: 'text-blue-400/60',
  },
  // STRUMENTI - Collapsabile
  {
    label: t('nav.tools'),
    icon: Wrench,
    collapsible: true,
    items: [
      { 
        name: t('nav.patcher'), 
        href: '/unity-patcher', 
        icon: Wand2,
        subItems: [
          { name: t('nav.ueTranslator') || 'UE Translator', href: '/unreal-translator', icon: Cpu },
          { name: t('nav.telltalePatcher') || 'Telltale Patcher', href: '/telltale-patcher', icon: Gamepad2 },
          { name: 'Unity Bundle', href: '/unity-bundle', icon: FileArchive },
          { name: 'Nexus Mode', href: '/nexus-mods', icon: Globe },
        ]
      },
      { name: t('nav.retro') || 'Retro ROM', href: '/retro', icon: Gamepad2 },
      { name: t('nav.injector'), href: '/injector', icon: Cpu },
      { name: t('nav.crawler'), href: '/crawler', icon: Scan },
      { name: t('nav.fixer'), href: '/fixer', icon: Wrench },
      { name: t('nav.overlay'), href: '/overlay', icon: Subtitles },
      { name: t('nav.manga') || 'Manga', href: '/manga-translator', icon: BookOpen },
      { name: t('nav.texture') || 'Texture', href: '/texture-translator', icon: Layers },
      { name: 'QA Check', href: '/qa-check', icon: ShieldCheck },
      { name: t('nav.qualityGates'), href: '/quality-gates', icon: ShieldCheck },
      { name: t('nav.vrOverlay'), href: '/vr-overlay', icon: Glasses },
      { name: t('nav.playerFeedback'), href: '/player-feedback', icon: MessageSquare },
    ],
    colorClass: 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20',
    activeClass: 'bg-emerald-500/20 backdrop-blur-md text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20',
    iconClass: 'text-emerald-400',
    hoverIconClass: 'group-hover:text-emerald-300',
    underlineClass: 'bg-emerald-400',
    labelColor: 'text-emerald-400/60',
  },
  // COMMUNITY & SETTINGS - Collapsabile
  {
    label: t('nav.resources'),
    icon: FolderOpen,
    collapsible: true,
    items: [
      { name: t('nav.community'), href: '/community-hub', icon: Users },
      { name: 'Stores', href: '/stores', icon: ShoppingBag },
      { name: t('nav.guide'), href: '/guide', icon: BookOpen },
      { name: t('nav.projectManager'), href: '/project-manager', icon: FolderTree, dataTutorial: 'nav-project-manager' },
      { name: t('nav.settings'), href: '/settings', icon: Settings },
      { name: 'Info', href: '/info', icon: Info },
    ],
    colorClass: 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/20',
    activeClass: 'bg-orange-500/20 backdrop-blur-md text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-500/20',
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

// Changelog content completo
const CHANGELOG_CONTENT = `
# GameStringer Changelog

## 🎉 Release Pubblica

| Fase | Versione | Stato |
|------|----------|-------|
| Alpha | 0.1.x - 0.4.x | ✅ Completato |
| Beta | 0.5.x - 0.8.x | ✅ Completato |
| Release Candidate | 0.9.x | ✅ Completato |
| **Release Pubblica** | **1.0.x** | ✅ Rilasciato |

---

## 📅 Gennaio 2026

### 💬 v1.0.7 — Community Forum & License
\`2026-01-29\`

**GitHub Discussions**
- Forum integrato nel Community Hub
- Grafica personalizzata GameStringer
- Fetch automatico da GitHub

**Community Hub**
- Rimossi dati mock, ora solo dati reali
- Modal warning rimosso

**Licenza v1.1**
- Source Available License aggiornata
- YouTuber/streamer OK con attribuzione
- Fork non-commerciali permessi

---

### 🎤 v1.0.5 — AI Voice & VR Tools
\`2026-01-26\`

**Voice Clone Studio**
- AI voice cloning con ElevenLabs e OpenAI TTS
- Text-to-speech con voci multiple
- Profili voce personalizzati da campioni audio

**VR Text Overlay**
- Sottotitoli spaziali per giochi VR
- Rilevamento headset: Oculus, SteamVR, WMR
- Preset posizione e stile personalizzabile

**Quality Gates**
- Sistema QA automatico per validazione traduzioni
- Controlli: placeholder, numeri, tag HTML, lunghezza

**Player Feedback**
- Raccolta feedback dai giocatori
- Sistema rating 5 stelle con tracking

---

### 🚀 v1.0.4 — Translation Tools Expansion
\`2026-01-23\`

**Subtitle Translator**
- Parser completo per SRT, VTT, ASS/SSA
- Preview in tempo reale con validazione QA

**Batch Folder Translator**
- Scansione ricorsiva con 10+ formati supportati
- Progress tracking con pausa/stop

**Community Hub**
- Browser pacchetti TM con search/filter
- Top contributori e statistiche

**Retro ROM Tools**
- 8 console supportate (NES, SNES, GB, GBA, Genesis, PSX, N64)
- Table file (.TBL) parser/generator

**API Pubblica v1**
- Endpoint traduzioni singole e batch
- 20 lingue supportate

---

### 🔐 v1.0.3 — Recovery Key & i18n Complete
\`2026-01-22\`

**Recovery Key System**
- Sistema recupero password con 12 parole mnemoniche
- Generazione automatica alla creazione profilo
- UI copia/download per salvare la chiave
- Verifica chiave per reset password

**Traduzioni Complete**
- +537 righe per ES, FR, DE
- 9 nuove sezioni tradotte
- Tutte le lingue ora complete

---

### 🌍 v1.0.2 — Multilingual Support
\`2026-01-22\`

**Nuove Lingue**
- Supporto multilingua: Español, Français, Deutsch, 日本語, 中文
- Selettore lingua attivo per tutte le lingue
- Traduzioni Translation Fixer complete
- Traduzioni AI Context Crawler complete
- Categorie glossario tradotte

---

### 🎨 v1.0.1 — Game Details Layout Overhaul
\`2026-01-21\`

**Layout Redesign**
- Nuovo layout 3:1 per pagina dettaglio gioco
- Screenshot gallery espansa (12 screenshot)
- Raccomandazione traduzione full-width

---

### 🎉 v1.0.0 — Public Release
\`2026-01-20\`

**Nuove Feature**
- Hero Image Fusion per tutte le pagine
- Screenshot Gallery nella pagina dettaglio
- Sistema i18n completo (Italiano/English)
- GitHub Sponsors integrato

**Traduzioni**
- Componente Support tradotto
- Pulsanti Libreria tradotti

---

### 🚀 v0.9.9-beta — Pre-Release Final
\`2026-01-19\`

**Release Preparation**
- Ultima beta prima del release 1.0.0
- Sistema i18n completo
- Integrazione Ko-fi e GitHub Sponsors
- Ottimizzazioni finali e bug fix

---

### 🚀 v0.9.8-beta — Core Features & OCR
\`2026-01-18\`

**Nuove Feature**
- Telltale Patcher per Wolf Among Us, Walking Dead, Batman
- Parser Telltale (.langdb, .landb, .dlog)

**Fix**
- Immagini games nella pagina dettaglio
- Steam API 403 rate limiting gestito gracefully
- Tauri CLI updated a v2.5.0

---

### 🎨 v0.8.1-beta — UI Polish & Fixes
\`2026-01-04\`

**Miglioramenti UI**
- Dizionario righe compatte
- Estensioni layout unificato con Parser
- Campanella notifiche gialla fosforescente
- Placeholder colorati per copertine mancanti

---

### 🎮 v0.8.0-beta — Epic Games Store Integration
\`2026-01-02\`

**Nuove Feature**
- Integrazione Epic Games Store via Legendary CLI
- Badge piattaforma dinamico (Steam/Epic/GOG/Origin)

---

### 🏅 v0.7.9-beta — Badge Traduzione + Tracking
\`2026-01-01\`

**Nuove Feature**
- Badge visivo stato traduzione (🥈 Argento / 🥉 Bronzo)
- Tracking patch installate in "Attività Recenti"

**Fix**
- Layout Unity Patcher tagliato a destra
- Warning dead_code per costanti BepInEx 6.x

---

## 📅 Dicembre 2025

### 🔧 v0.7.8-beta — Unity Patcher Stabilization
\`2025-12-31\`

**Miglioramenti**
- BepInEx 5.4.23.4 come default (compatibile con XUnity 5.5)
- Plugin UIToolkitTranslator sperimentale

**Fix**
- Rimosso BepInEx 6.x (incompatibile con XUnity)

---

### 🔗 v0.7.7-beta — Family Sharing Completo
\`2025-12-31\`

**Nuove Feature**
- Supporto fino a 4 Steam ID condivisori
- Screenshot gallery con lightbox
- UX intelligente Neural Translator

**Miglioramenti**
- Persistenza IDs nel backend (non più persi al riavvio)
- Da 107 a ~276 games Family Sharing visibili

---

### ⚡ v0.7.6-beta — Streaming LLM Translation
\`2025-12-31\`

**Nuove Feature**
- Traduzioni in tempo reale con Server-Sent Events
- Supporto OpenAI, Claude, Gemini, DeepSeek

**Miglioramenti**
- Da 50 a 426+ games Steam rilevati

---

### 📖 v0.7.5-beta — Translation Tools Pro
\`2025-12-30\`

**Nuove Feature**
- Glossario personalizzato con categorie
- Hotkey globali OCR (Ctrl+Shift+T)
- History traduzioni con statistiche
- Auto-detect lingua sorgente

---

### 🐛 v0.7.4-beta — Epic Games Fix + Ottimizzazioni
\`2025-12-30\`

**Nuove Feature**
- Supporto IPA per Unity 5.0-5.5
- Link tool esterni (gdsdecomp, UnrealLocres)
- Sistema notifiche aggiornamenti
- Ricerca fuzzy nella Library
- Plugin system per formati file

**Ottimizzazioni**
- Virtualizzazione liste (50MB → 5MB RAM)
- Lazy loading immagini
- Cache LRU con limite 5000 entries
- Startup time ridotto

**Fix**
- Epic Games Parser: da 1939 a ~31 games reali
- Steam Family Sharing con badge 🔗

---

### 🎯 v0.7.3-beta — Translation Recommendation
\`2025-12-29\`

**Nuove Feature**
- Card raccomandazione metodo traduzione
- Ordinamento "Recenti" nella Library

**Fix**
- OCR Overlay non blocca più i games

---

### 🎨 v0.7.2-beta — Codebase Cleanup
\`2025-12-29\`

- Risolti tutti i 29 warning Rust
- Compilazione pulita senza warning

---

### 🌐 v0.7.1-beta — Editor Multi-lingua
\`2025-12-11\`

**Nuove Feature**
- Vista split IDE-style per traduzioni
- Translation Wizard integrato
- Activity History con filtri
- Bandiere grafiche per lingue

---

## 📅 Agosto 2025

### 🔐 v0.6.x-beta — Sistema Profili
\`2025-08\`

- Sistema profili utente completo
- Fix critico riavvio app durante login
- Sistema notifiche con toast

---

## 📅 Luglio 2025

### 🚀 v0.5.x-beta — Tauri v2 Migration
\`2025-07\`

**Major Changes**
- Migrazione completa a Tauri v2
- Sistema traduzione OCR avanzato
- Backend multipli (Claude, OpenAI, Google)
- Prima esecuzione con successo

**Nuove Feature**
- Game Launch Integration
- Engine Detection automatico
- HowLongToBeat integration
- Supporto 2FA per GOG

---

## 📅 Giugno 2025

### 🏗️ v0.1.x-alpha — Fondamenta
\`2025-06\`

**Core Features**
- Scansione librerie (Steam, Epic, GOG, Origin, Ubisoft, Battle.net, itch.io, Rockstar)
- Traduzione neurale batch (Claude, OpenAI)
- Translation Memory locale in Rust
- Quality Gates per validazione
- Supporto formati: JSON, PO, RESX, CSV
- UI moderna Next.js + TailwindCSS + shadcn/ui
`;

export function MainLayout({ children }: MainLayoutProps) {
  const { t, language, setLanguage } = useTranslation();
  const navGroups = getNavGroups(t);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [expandedSubMenus, setExpandedSubMenus] = useState<string[]>([]);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  
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
  const { version, buildInfo } = useVersion();
  
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
  }, []);

  const updateSystemStatus = async () => {
    try {
      // Controlla Neural Engine (sempre online se l'app funziona)
      const neuralEngine = { 
        status: 'online' as const, 
        color: 'bg-green-500', 
        text: 'ON' 
      };

      // Controlla Steam API tramite test_steam_connection (stesso dello Stores Manager)
      let steamApi: { status: 'connected' | 'disconnected' | 'error'; color: string; text: string } = { 
        status: 'disconnected', 
        color: 'bg-red-500', 
        text: 'OFF' 
      };
      
      try {
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
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside 
          data-tutorial="sidebar"
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-card border-r transform transition-all duration-300 ease-in-out flex flex-col",
            sidebarOpen ? "w-64 translate-x-0" : "w-16 translate-x-0"
          )}
        >
          {/* Header con logo e toggle */}
          <div className="relative flex items-center h-16 px-3 border-b">
            {sidebarOpen && (
              <div className="flex items-center gap-2 flex-1">
                <img 
                  src="/logohires.png" 
                  alt="GameStringer" 
                  className="h-[55px] w-auto animate-logo-glow"
                  style={{
                    filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.3))',
                    animation: 'logoGlow 4s ease-in-out infinite'
                  }}
                />
                <span 
                  className="text-lg font-bold bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #8B5CF6, #6366F1, #38BDF8, #8B5CF6)',
                    backgroundSize: '200% 100%',
                    animation: 'gradientMove 3s ease-in-out infinite'
                  }}
                >
                  GameStringer
                </span>
              </div>
            )}
            
            {/* Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full transition-all duration-300 hover:bg-primary/10 hover:scale-110",
                sidebarOpen ? "ml-auto" : "mx-auto"
              )}
              onClick={toggleSidebar}
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-4 w-4 transition-transform duration-300" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-transform duration-300 animate-pulse" />
              )}
            </Button>
          </div>
          
          <nav className="flex-1 px-2 py-2 overflow-y-auto min-h-0">
            {navGroups.map((group, groupIndex) => {
              const isExpanded = expandedGroups.includes(group.label);
              const toggleGroup = () => {
                setExpandedGroups(prev => 
                  prev.includes(group.label) 
                    ? [] // Chiudi se già aperto
                    : [group.label] // Apri solo questo, chiudi gli altri
                );
              };
              const GroupIcon = group.icon;
              
              return (
                <div key={groupIndex}>
                  {/* Separatore lucido dopo Core (Dashboard/Library) */}
                  {groupIndex === 1 && (
                    <div className="my-2 mx-2 h-px bg-gradient-to-r from-transparent via-slate-500/50 to-transparent" />
                  )}
                  
                  {/* Gruppo collapsabile */}
                  {group.collapsible ? (
                    <>
                      <Button
                        variant="ghost"
                        onClick={toggleGroup}
                        data-tutorial={`nav-${group.label.toLowerCase().includes('traduz') || group.label.toLowerCase().includes('trans') ? 'translator' : 'tools'}`}
                        className={cn(
                          "w-full transition-all duration-200 ease-out group relative",
                          sidebarOpen ? "justify-start space-x-3 px-3" : "justify-center px-0",
                          group.colorClass
                        )}
                        title={!sidebarOpen ? group.label : undefined}
                      >
                        {GroupIcon && (
                          <GroupIcon className={cn(
                            "transition-colors duration-200",
                            sidebarOpen ? "h-4 w-4" : "h-5 w-5",
                            group.iconClass
                          )} />
                        )}
                        {sidebarOpen && (
                          <>
                            <span className="text-sm flex-1 text-left">{group.label}</span>
                            <ChevronDown className={cn(
                              "h-3 w-3 transition-transform duration-200",
                              isExpanded ? "rotate-180" : ""
                            )} />
                          </>
                        )}
                      </Button>
                      
                      {/* Sottomenu espandibile */}
                      <div className={cn(
                        "overflow-hidden transition-all duration-200",
                        isExpanded && sidebarOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                      )}>
                        <div className="pl-4 space-y-0.5 py-1">
                          {group.items.map((item: any) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            const hasSubItems = item.subItems && item.subItems.length > 0;
                            const isSubActive = hasSubItems && item.subItems.some((sub: any) => pathname === sub.href);
                            
                            return (
                              <div key={item.href}>
                                {hasSubItems ? (
                                  <>
                                    {/* Item con subItems - Accordion */}
                                    <Button
                                      variant="ghost"
                                      onClick={() => {
                                        setExpandedSubMenus(prev => 
                                          prev.includes(item.href) 
                                            ? prev.filter(h => h !== item.href)
                                            : [...prev, item.href]
                                        );
                                      }}
                                      className={cn(
                                        "w-full transition-all duration-200 ease-out group relative justify-start space-x-3 px-3 h-8",
                                        (isActive || isSubActive) ? group.activeClass : group.colorClass
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
                                      expandedSubMenus.includes(item.href) ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
                                    )}>
                                      <div className="pl-4 space-y-0.5 py-0.5">
                                        {item.subItems.map((subItem: any) => {
                                          const SubIcon = subItem.icon;
                                          const isSubItemActive = pathname === subItem.href;
                                          return (
                                            <Link key={subItem.href} href={subItem.href}>
                                              <Button
                                                variant="ghost"
                                                className={cn(
                                                  "w-full transition-all duration-200 ease-out group relative justify-start space-x-3 px-3 h-7",
                                                  isSubItemActive ? group.activeClass : "text-emerald-700 hover:text-emerald-400 hover:bg-emerald-500/20"
                                                )}
                                              >
                                                <SubIcon className={cn(
                                                  "h-3 w-3 transition-colors duration-200",
                                                  isSubItemActive ? "" : "text-emerald-700 group-hover:text-emerald-400"
                                                )} />
                                                <span className="text-[10px] relative">
                                                  {subItem.name}
                                                  <span className={cn(
                                                    "absolute left-0 -bottom-0.5 h-[2px] w-0 group-hover:w-full transition-all duration-300 ease-out rounded-full",
                                                    group.underlineClass
                                                  )} />
                                                </span>
                                              </Button>
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <Link href={item.href}>
                                    <Button
                                      variant="ghost"
                                      className={cn(
                                        "w-full transition-all duration-200 ease-out group relative justify-start space-x-3 px-3 h-8",
                                        isActive ? group.activeClass : group.colorClass
                                      )}
                                    >
                                      <Icon className={cn(
                                        "h-3.5 w-3.5 transition-colors duration-200",
                                        isActive ? "" : cn(group.iconClass, group.hoverIconClass)
                                      )} />
                                      <span className="text-xs relative">
                                        {item.name}
                                        <span className={cn(
                                          "absolute left-0 -bottom-0.5 h-[2px] w-0 group-hover:w-full transition-all duration-300 ease-out rounded-full",
                                          group.underlineClass
                                        )} />
                                      </span>
                                    </Button>
                                  </Link>
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
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = pathname === item.href;
                          
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
                                  isActive 
                                    ? group.activeClass 
                                    : group.colorClass
                                )}
                                title={!sidebarOpen ? item.name : undefined}
                              >
                                <Icon className={cn(
                                  "transition-colors duration-200",
                                  sidebarOpen ? "h-4 w-4" : "h-5 w-5",
                                  isActive ? "" : cn(group.iconClass, group.hoverIconClass)
                                )} />
                                {sidebarOpen && (
                                  <span className="text-sm relative">
                                    {item.name}
                                    <span className={cn(
                                      "absolute left-0 -bottom-0.5 h-[2px] w-0 group-hover:w-full transition-all duration-300 ease-out rounded-full",
                                      group.underlineClass
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

          {/* Widget Gioco in Evidenza */}
          <div className="shrink-0 border-t border-border/50 mb-4">
            <FeaturedGameWidget collapsed={!sidebarOpen} />
          </div>
          
        </aside>

        {/* Main Content */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-16"
        )}>
          {/* Header */}
          <header className="h-16 bg-card border-b flex items-center px-6">
            {/* Ricerca a sinistra */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Cerca (Ctrl+K)"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
            
            {/* Language Selector al centro */}
            <div className="flex-1 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-2 px-3">
                    <Globe className="h-4 w-4" />
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
                    <span className="text-xs font-medium">{language.toUpperCase()}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Wifi/Versione/Sito + Supporta, Profilo, Notifica, Tema, Power - a destra */}
            <div className="flex items-center gap-3">
              {/* Link sito + versione */}
              <a 
                href="http://www.gamestringer.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-blue-400 transition-colors"
                title="Visita gamestringer.ai"
              >
                <Globe className="w-3 h-3" />
                <span className="hidden sm:inline">gamestringer.ai</span>
              </a>
              <button 
                onClick={() => setChangelogOpen(true)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-blue-400 transition-colors"
                title="Changelog"
              >
                {isOnline ? (
                  <Wifi className="w-3 h-3 text-green-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-500" />
                )}
                <span className="font-mono hidden sm:inline">v{version}</span>
              </button>
              <div className="w-px h-4 bg-border" />
              <SupportButton />
              <ProfileHeader />
              <NotificationIndicator 
                onClick={() => setNotificationCenterOpen(true)}
              />
              <ThemeToggle />
              <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              onClick={() => setExitDialogOpen(true)}
              title={t('common.closeApp')}
            >
              <Power className="h-4 w-4" />
            </Button>
            </div>
          </header>

          {/* Default Profile Alert */}
          <div className="px-6 pt-4">
            <DefaultProfileAlert />
          </div>

          {/* Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
        
        {/* Profile Notifications */}
        <ProfileNotifications />
        
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
              <div className="space-y-3">
                {CHANGELOG_CONTENT.split('\n').map((line, i) => {
                  // Titoli versione ### 
                  if (line.startsWith('### ')) {
                    const title = line.replace('### ', '').replace(/`[^`]+`/g, '');
                    return (
                      <div key={i} className="flex items-center gap-2 mt-6 mb-3">
                        <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                      </div>
                    );
                  }
                  // Sottotitoli **Bold**
                  if (line.startsWith('**') && line.endsWith('**')) {
                    const text = line.replace(/\*\*/g, '');
                    return (
                      <p key={i} className="text-sm font-semibold text-blue-300 mt-4 mb-1">{text}</p>
                    );
                  }
                  // Lista items
                  if (line.startsWith('- ')) {
                    const content = line.replace('- ', '');
                    return (
                      <div key={i} className="flex items-start gap-2 ml-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span className="text-sm text-gray-300">{content}</span>
                      </div>
                    );
                  }
                  // Sub-lista
                  if (line.startsWith('  - ')) {
                    return (
                      <div key={i} className="flex items-start gap-2 ml-6">
                        <span className="text-gray-500 mt-1">◦</span>
                        <span className="text-xs text-gray-400">{line.replace('  - ', '')}</span>
                      </div>
                    );
                  }
                  // Separatore
                  if (line === '---') {
                    return <div key={i} className="border-t border-gray-700/50 my-4" />;
                  }
                  // Date `2026-01-18`
                  if (line.startsWith('`') && line.endsWith('`')) {
                    return (
                      <span key={i} className="inline-block text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded mb-2">
                        {line.replace(/`/g, '')}
                      </span>
                    );
                  }
                  // Testo normale
                  if (line.trim() && !line.startsWith('#') && !line.startsWith('|')) {
                    return <p key={i} className="text-sm text-gray-400">{line}</p>;
                  }
                  return null;
                })}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Tutorial Interattivo */}
        <InteractiveTutorial />
        
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
  );
}



