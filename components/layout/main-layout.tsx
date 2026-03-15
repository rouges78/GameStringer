
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
  Shield
} from 'lucide-react';
import { invoke } from '@/lib/tauri-api';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { TutorialProvider } from '@/components/tutorial/tutorial-provider';
import { TutorialOverlay } from '@/components/tutorial/tutorial-overlay';
import { TutorialMenu } from '@/components/tutorial/tutorial-menu';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { CommandPalette } from '@/components/ui/command-palette';
import { GlobalSearch } from '@/components/layout/global-search';
import { useTranslation } from '@/lib/i18n';
import { useScreen } from '@/components/providers/screen-provider';

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
      { name: t('nav.editor'), href: '/editor', icon: Edit3 },
    ],
    colorClass: 'text-slate-400 hover:text-slate-200 hover:bg-slate-500/20',
    activeClass: 'bg-slate-500/20 backdrop-blur-md text-slate-200 border border-slate-500/30 shadow-lg shadow-slate-500/20',
    iconClass: 'text-slate-400',
    hoverIconClass: 'group-hover:text-slate-200',
    underlineClass: 'bg-slate-400',
    labelColor: 'text-slate-400/60',
  },
  // TRADUZIONE - Collapsabile con sottocategorie
  {
    label: t('nav.translation'),
    icon: Sparkles,
    collapsible: true,
    items: [
      { 
        name: t('nav.textCategory'),
        href: '/ai-translator',
        icon: Sparkles,
        subItems: [
          { name: t('nav.translationWizard'), href: '/translation-wizard', icon: Wand2 },
          { name: t('nav.autoTranslate'), href: '/auto-translate', icon: Rocket },
          { name: t('nav.translate'), href: '/ai-translator', icon: Sparkles },
          { name: t('nav.neuralTranslatorPro'), href: '/translator/pro', icon: Brain },
          { name: t('nav.mtpeWorkflow'), href: '/translator/mtpe', icon: Edit3 },
          { name: t('nav.multiLlm'), href: '/translator/compare', icon: Brain },
          { name: t('nav.aiReview'), href: '/ai-review', icon: Bot },
          { name: t('nav.offlineTranslator'), href: '/offline-translator', icon: WifiOff },
        ]
      },
      { 
        name: t('nav.visualCategory'),
        href: '/ocr-translator',
        icon: Scan,
        subItems: [
          { name: t('nav.ocrTranslator'), href: '/ocr-translator', icon: Scan },
          { name: t('nav.visionLlm'), href: '/vision-translator', icon: Eye },
          { name: t('nav.liveOcr'), href: '/live-ocr', icon: Monitor },
          { name: t('nav.texture'), href: '/texture-translator', icon: Layers },
          { name: t('nav.manga'), href: '/manga-translator', icon: BookOpen },
          { name: t('nav.visualEditor'), href: '/visual-editor', icon: ImageIcon },
        ]
      },
      { 
        name: t('nav.audioCategory'),
        href: '/voice-translator',
        icon: Mic,
        subItems: [
          { name: t('nav.voice'), href: '/voice-translator', icon: Mic },
          { name: t('nav.voiceClone'), href: '/voice-clone', icon: AudioLines },
          { name: t('nav.characterVoiceAi'), href: '/character-voice', icon: User },
          { name: t('nav.subtitles'), href: '/subtitles', icon: Film },
        ]
      },
      { 
        name: t('nav.utilityCategory'),
        href: '/batch',
        icon: FolderTree,
        subItems: [
          { name: t('nav.batch'), href: '/batch', icon: FolderTree },
          { name: t('nav.translationQueue'), href: '/batch-translation', icon: Layers },
          { name: t('nav.dictionary'), href: '/memory', icon: Database },
          { name: t('nav.glossary'), href: '/glossary', icon: BookOpen },
          { name: t('nav.contextHarvester'), href: '/context-harvester', icon: Wheat },
          { name: t('nav.aiPipeline'), href: '/ai-pipeline', icon: Workflow },
          { name: t('nav.translationBridge'), href: '/translation-bridge', icon: Workflow },
          { name: t('nav.ocrMultiEngine'), href: '/ocr-engines', icon: ScanEye },
          { name: t('nav.ollamaManager'), href: '/ollama-manager', icon: Package },
          { name: t('nav.translatorTools'), href: '/translator/tools', icon: Sparkles },
        ]
      },
    ],
    colorClass: 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20',
    activeClass: 'bg-blue-500/20 backdrop-blur-md text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/20',
    iconClass: 'text-blue-400',
    hoverIconClass: 'group-hover:text-blue-300',
    underlineClass: 'bg-blue-400',
    labelColor: 'text-blue-400/60',
  },
  // STRUMENTI - Collapsabile con sottocategorie
  {
    label: t('nav.tools'),
    icon: Wrench,
    collapsible: true,
    items: [
      { 
        name: t('nav.patcherCategory'),
        href: '/unity-patcher',
        icon: Wand2,
        subItems: [
          { name: t('nav.unityPatcher'), href: '/unity-patcher', icon: Wand2 },
          { name: t('nav.ueTranslator'), href: '/unreal-translator', icon: Cpu },
          { name: t('nav.telltalePatcher'), href: '/telltale-patcher', icon: Gamepad2 },
          { name: t('nav.unityBundle'), href: '/unity-bundle', icon: FileArchive },
          { name: t('nav.unityCsvTranslator'), href: '/unity-csv-translator', icon: Globe },
          { name: t('nav.visualNovel'), href: '/danganronpa-patcher', icon: Package },
          { name: t('nav.rpgMaker'), href: '/rpgmaker-patcher', icon: Gamepad2 },
          { name: t('nav.renpy'), href: '/renpy-patcher', icon: Heart },
          { name: t('nav.wolfRpg'), href: '/wolfrpg-patcher', icon: Database },
          { name: t('nav.nexusMods'), href: '/nexus-mods', icon: Globe },
          { name: t('nav.binaryPatcher'), href: '/binary-patcher', icon: Binary },
        ]
      },
      { 
        name: t('nav.gamesCategory'),
        href: '/retro',
        icon: Gamepad2,
        subItems: [
          { name: t('nav.retro'), href: '/retro', icon: Gamepad2 },
          { name: t('nav.injector'), href: '/injector', icon: Cpu },
          { name: t('nav.fixer'), href: '/fixer', icon: Wrench },
        ]
      },
      { 
        name: t('nav.overlayCategory'),
        href: '/overlay',
        icon: Subtitles,
        subItems: [
          { name: t('nav.overlay'), href: '/overlay', icon: Subtitles },
          { name: t('nav.vrOverlay'), href: '/vr-overlay', icon: Glasses },
        ]
      },
      { 
        name: t('nav.qualityCategory'),
        href: '/qa-check',
        icon: ShieldCheck,
        subItems: [
          { name: t('nav.qaCheck'), href: '/qa-check', icon: ShieldCheck },
          { name: t('nav.qualityScoring'), href: '/quality-scoring', icon: Shield },
          { name: t('nav.playerFeedback'), href: '/player-feedback', icon: MessageSquare },
          { name: t('nav.confidenceHeatmap'), href: '/heatmap', icon: BarChart3 },
        ]
      },
      { 
        name: t('nav.advancedCategory'),
        href: '/advanced-tools',
        icon: Crosshair,
        subItems: [
          { name: t('nav.loreAssistant'), href: '/advanced-tools#lore', icon: BookOpen },
          { name: t('nav.autoHookScanner'), href: '/advanced-tools#hook', icon: Crosshair },
        ]
      },
    ],
    colorClass: 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20',
    activeClass: 'bg-emerald-500/20 backdrop-blur-md text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20',
    iconClass: 'text-emerald-400',
    hoverIconClass: 'group-hover:text-emerald-300',
    underlineClass: 'bg-emerald-400',
    labelColor: 'text-emerald-400/60',
  },
  // RISORSE - Collapsabile con sottocategorie
  {
    label: t('nav.resources'),
    icon: FolderOpen,
    collapsible: true,
    items: [
      { 
        name: t('nav.communityCategory'),
        href: '/community-hub',
        icon: Users,
        subItems: [
          { name: t('nav.community'), href: '/community-hub', icon: Users },
          { name: t('nav.stores'), href: '/stores', icon: ShoppingBag },
          { name: t('nav.steamWorkshop'), href: '/workshop', icon: Globe },
          { name: t('nav.workshopExport'), href: '/workshop-export', icon: Package },
          { name: t('nav.blog'), href: '/blog', icon: Newspaper },
        ]
      },
      { 
        name: t('nav.managementCategory'),
        href: '/guide',
        icon: BookOpen,
        subItems: [
          { name: t('nav.guide'), href: '/guide', icon: BookOpen },
        ]
      },
      { 
        name: t('nav.systemCategory'),
        href: '/settings',
        icon: Settings,
        subItems: [
          { name: t('nav.settings'), href: '/settings', icon: Settings },
          { name: t('nav.systemMonitor'), href: '/system-monitor', icon: Monitor },
          { name: t('nav.info'), href: '/info', icon: Info },
          { name: t('nav.plugins'), href: '/plugins', icon: Puzzle },
          { name: t('nav.activity'), href: '/activity', icon: Clock },
          { name: t('nav.statistics'), href: '/stats', icon: BarChart3 },
        ]
      },
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

## 📅 Marzo 2026

### 🚀 v1.4.2 — Vision LLM, Advanced Tools & Community Fix
\`2026-03-03\`

**Vision LLM Translator**
- Traduzione context-aware con screenshot del gioco
- Provider: Ollama (locale), Gemini, OpenAI GPT-4o
- Upload immagine o cattura schermo per contesto visivo

**Advanced Tools**
- Lore Assistant: chat RAG per lore e dialoghi del gioco
- Auto-Hook Scanner: scansione memoria processo (WinAPI)
- System Monitor: VRAM/RAM in tempo reale
- Ollama Setup Wizard: installazione guidata AI locale

**Community & Fix**
- GitHub Discussions: 12 discussioni create
- Community Hub: fix fetch REST API pubblica
- Sidebar: rinominato Workshop in Steam Workshop
- Update Bell: fix versione corrente nel popup
- CI/CD: Tauri Signing Key per release firmate

**Translation Provider Fix**
- Ollama: cooldown 30s invece di blocco permanente per errori rete
- Lingva: troncamento testi >500 chars (evita URL 404)
- Auto-Translate: pulsante "Traduci tutte le non tradotte" con progress
- Tutorial: fix querySelector SyntaxError con :contains()

---

### 🌍 v1.4.1 — i18n 11 Lingue, Guide Complete & CI Fix
\`2026-03-02\`

**i18n — 11 Lingue UI**
- 4 nuove lingue: Coreano (KO), Portoghese (PT), Russo (RU), Polacco (PL)
- translations.ts: +9.056 righe (da 13.472 a 22.528)
- Lingue totali: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL

**Guide Utente Aggiornate**
- 7 guide esistenti aggiornate con sezioni v1.1-v1.4
- 4 nuove guide: KO, PT, RU, PL
- README aggiornati con 11 lingue

**CI/CD**
- Workflow CI Linux + Windows fixato
- Stub frontend out/ per tauri::generate_context!()

---

## 📅 Febbraio 2026

### 🧹 v1.4.0 — Radix Unificato, Quality Badges & Pulizia Codebase
\`2026-02-13\`

**Migrazione Radix UI**
- 37 file migrati da @radix-ui/react-* a radix-ui
- 27 pacchetti rimossi, bundle più leggero

**Quality Badge nel Traduttore Pro**
- Punteggio qualità per-riga (0-100) con colori
- Live preview durante traduzione batch
- Tabella risultati con tipo contenuto e score

**Nuove Feature**
- Supporto RTL automatico per lingue arabe/ebraiche
- Ollama Generico con chain presets fallback

**Ottimizzazione & Fix**
- Bundle ottimizzato con optimizePackageImports
- 0 errori TypeScript nei sorgenti (da ~15)
- Fix props mancanti in notifiche, tutorial, TM

---

### 🎮 v1.3.0 — Danganronpa WAD Patcher & Export System
\`2026-02-09\`

**Danganronpa WAD Patcher v15**
- All-Ice base + GameStringer override (35.865 stringhe)
- WAD Text Extractor CLI per estrazione testi
- WAD Patcher v15 con override selettivo

**WAD Extractor UI**
- Nuovo tab nel Danganronpa Patcher
- Editor con ricerca, filtri e traduzione batch AI
- Export JSON traduzioni

**Export Patch Distribuibile**
- Backend Rust: zip streaming ~626 MB
- UI con dialog salvataggio nativo
- ZIP: WAD + install.bat + LEGGIMI.txt + translations.json

**Dashboard Stats Reali**
- Translation Memory da backend Rust
- Activity history: traduzioni e patch
- Tempo risparmiato e Entry TM reali

**UI Compattata**
- Tutti i tab Danganronpa Patcher ottimizzati
- Header, spacing e scroll areas ridotti

---

### 🛡️ v1.2.0 — Fallback Provider & Full Tauri Compatibility
\`2026-02-06\`

**Fallback Provider Automatico**
- Traduzione: Gemini → DeepSeek → OpenAI → testo originale
- 10+ componenti aggiornati con fallback automatico
- Zero crash se un provider fallisce

**Audit /api/* Completato al 100%**
- 0 fetch('/api/') attive — tutto compatibile Tauri
- Injection, secrets, logging, import → tutto locale

**Danganronpa Filtro Smart**
- Nuovo modulo danganronpa-filter.ts
- Riduce 18K → ~3K stringhe rilevanti
- Filtro locale + classificazione AI opzionale

**Test E2E Playwright**
- 38 test reali tutti passanti
- Navigation, translation, danganronpa

---

### ✨ v1.1.0 — Danganronpa & Auto-Update
\`2026-02-05\`

**Danganronpa Auto-Translator**
- Supporto nativo file PAK/LIN/STX
- Integrazione con DRAT
- Estrazione e traduzione automatica dialoghi

**Auto-Update In-App**
- Aggiornamento diretto senza browser
- Progress bar download
- Installazione e riavvio automatico

**Test E2E**
- 9 test Playwright per navigation, translation, danganronpa
- Config multi-browser

---

## 📅 Gennaio 2026

### ✨ v1.0.9 — Animated Headers & UI Polish
\`2026-01-31\`

**Header Animati**
- Effetto "Respiro" con gradiente che si espande/contrae
- Animazione shimmer CSS personalizzata (12s)
- Ombreggiature profonde shadow-xl blu
- 16 pagine aggiornate con nuovo stile

**UI Miglioramenti**
- Gradiente uniforme Sky → Blue → Cyan
- Menu Sidebar sub-item verde scuro
- Coerenza visiva su tutte le pagine Traduzione

---

### 🔧 v1.0.8 — Fix Update Download
\`2026-01-29\`

**Bug Fix**
- Pulsante "Scarica" ora apre il browser
- Usato Tauri Shell API per link esterni
- Feedback toast per conferma

---

### �💬 v1.0.7 — Community Forum & License
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

      // Controlla Steam API tramite test_steam_connection (con cache globalThis per evitare doppia chiamata StrictMode)
      let steamApi: { status: 'connected' | 'disconnected' | 'error'; color: string; text: string } = { 
        status: 'disconnected', 
        color: 'bg-red-500', 
        text: 'OFF' 
      };
      
      try {
        const _gc = globalThis as any;
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
                <div className="relative flex items-center justify-center p-1.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] group-hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all">
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
                          
                          {group.items.map((item: any) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            const hasSubItems = item.subItems && item.subItems.length > 0;
                            const isSubActive = hasSubItems && item.subItems.some((sub: any) => pathname === sub.href);
                            
                            return (
                              <div key={item.href} className="relative z-10 pl-4">
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
                                      expandedSubMenus.includes(item.href) ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
                                    )}>
                                      <div className="pl-4 space-y-0.5 py-0.5">
                                        {item.subItems.map((subItem: any) => {
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
                                        "text-[13px] relative",
                                        isActive ? "font-semibold" : "font-medium"
                                      )}>
                                        {item.name}
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
          className="flex-1 flex flex-col min-w-0 transition-all duration-300 relative z-10"
          style={{ marginLeft: sidebarOpen ? `${display.sidebarWidth}px` : '72px' }}
        >
          {/* Header */}
          <header className="h-[72px] bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center px-6 sticky top-0 z-40 shadow-sm">
            {/* Ricerca a sinistra - Campo compilabile */}
            <div className="relative group w-80">
              <div className="absolute inset-0 bg-indigo-500/10 blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-slate-500 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Cerca pagine, strumenti... (Ctrl+K)"
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
                        { id: 'dashboard', title: 'Dashboard', description: 'Panoramica generale', icon: Home, path: '/' },
                        { id: 'library', title: 'Libreria', description: 'I tuoi giochi', icon: Library, path: '/library' },
                        { id: 'translator', title: 'Traduci', description: 'AI Translator', icon: Languages, path: '/ai-translator' },
                        { id: 'dictionary', title: 'Dizionario', description: 'Glossario termini', icon: Database, path: '/memory' },
                        { id: 'multi-llm', title: 'Multi-LLM', description: 'Confronto modelli AI', icon: Brain, path: '/translator/compare' },
                        { id: 'voice', title: 'Voce', description: 'Traduzione vocale', icon: Mic, path: '/voice-translator' },
                        { id: 'patcher', title: 'Patcher', description: 'Unity/Unreal patcher', icon: Wrench, path: '/unity-patcher' },
                        { id: 'injector', title: 'Injector', description: 'Iniezione mod universale', icon: Puzzle, path: '/injector' },
                        { id: 'crawler', title: 'Crawler', description: 'Estrai contesto dai giochi', icon: Scan, path: '/crawler' },
                        { id: 'fixer', title: 'Fixer', description: 'Ripara tag traduzione', icon: Wand2, path: '/fixer' },
                        { id: 'overlay', title: 'Overlay', description: 'Sottotitoli in-game', icon: Subtitles, path: '/overlay' },
                        { id: 'community', title: 'Community', description: 'Hub traduzioni community', icon: Users, path: '/community-hub' },
                        { id: 'settings', title: 'Impostazioni', description: 'Configura GameStringer', icon: Settings, path: '/settings' },
                      ];
                      
                      const filtered = navigationItems.filter(item => 
                        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.description.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      
                      if (filtered.length === 0) {
                        return (
                          <div className="py-6 text-center text-sm text-slate-500">
                            Nessun risultato per "{searchQuery}"
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

          {/* Default Profile Alert */}
          <div className="px-6 pt-4">
            <DefaultProfileAlert />
          </div>

          {/* Content */}
          <main className="flex-1 overflow-auto">
            <div key={pathname} className="page-enter">
              {children}
            </div>
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



