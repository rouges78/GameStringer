'use client';

import { useTranslation } from '@/lib/i18n';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
} from "@/components/ui/card";
import { CheckCircle, Plug, Unplug, XCircle, Loader2, AlertCircle, CheckCircle2, Clock, Trophy, Gamepad2, BarChart3, Store as StoreIcon, ChevronDown, ExternalLink, Globe, Search } from 'lucide-react';

import React, { useState, useEffect } from 'react';
import Image, { StaticImageData } from 'next/image';
import { useSession, signIn, signOut, isProviderConnected } from '@/lib/auth/auth';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri-api';
import { ItchioModal } from '@/components/modals/itchio-modal';
import { GenericCredentialsModal } from '@/components/modals/generic-credentials-modal';
import { SteamModal } from '@/components/modals/steam-modal';
import { SteamFamilySharing } from '@/components/steam-family-sharing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { clientLogger } from '@/lib/client-logger';

// Define a type for the store object for better type safety
type _Store = {
  id: string;
  name: string;
  description: string;
  logoUrl?: string | StaticImageData;
  icon?: React.ReactNode;
};

// appUrl: pagina ufficiale di download/info dell'app desktop dello store
const storesConfig = [
  { id: 'steam', name: 'Steam', logoUrl: '/logos/steam.png', descKey: 'steamDesc', appUrl: 'https://store.steampowered.com/about/' },
  { id: 'epic', name: 'Epic Games', logoUrl: '/logos/epic-games.png', descKey: 'epicDesc', appUrl: 'https://store.epicgames.com/download' },
  { id: 'ubisoft', name: 'Ubisoft Connect', logoUrl: '/logos/ubisoft-connect.png', descKey: 'ubisoftDesc', appUrl: 'https://ubisoftconnect.com/' },
  { id: 'itchio', name: 'itch.io', logoUrl: '/logos/itch-io.png', descKey: 'itchioDesc', appUrl: 'https://itch.io/app' },
  { id: 'gog', name: 'GOG', logoUrl: '/logos/gog.png', descKey: 'gogDesc', appUrl: 'https://www.gog.com/galaxy' },
  { id: 'origin', name: 'EA App / Origin', logoUrl: '/logos/ea-app.png', descKey: 'originDesc', appUrl: 'https://www.ea.com/ea-app' },
  { id: 'battlenet', name: 'Battle.net', logoUrl: '/logos/battlenet.png', descKey: 'battlenetDesc', appUrl: 'https://download.battle.net/' },
  { id: 'rockstar', name: 'Rockstar', logoUrl: '/logos/rockstar.png', descKey: 'rockstarDesc', appUrl: 'https://socialclub.rockstargames.com/rockstar-games-launcher' },
  { id: 'xbox', name: 'Xbox Game Pass', logoUrl: '/logos/xbox.png', descKey: 'xboxDesc', appUrl: 'https://www.xbox.com/apps/xbox-app-on-pc' },
  { id: 'amazon', name: 'Amazon Games', logoUrl: '/logos/amazon.png', descKey: 'amazonDesc', appUrl: 'https://gaming.amazon.com/amazon-games-app' },
  // ── Store extra a rilevamento locale (2026-07-04): indie/casual spesso non localizzati ──
  { id: 'humble', name: 'Humble App', logoUrl: '/logos/humble.png', descKey: 'humbleDesc', appUrl: 'https://www.humblebundle.com/app' },
  { id: 'gamejolt', name: 'Game Jolt', logoUrl: '/logos/gamejolt.png', descKey: 'gamejoltDesc', appUrl: 'https://gamejolt.com/app' },
  { id: 'bigfish', name: 'Big Fish Games', logoUrl: '/logos/bigfish.png', descKey: 'bigfishDesc', appUrl: 'https://www.bigfishgames.com/download-games/gamemanager/' },
];

const utilityServicesConfig = [
  { id: 'howlongtobeat', name: 'HowLongToBeat', iconType: 'clock', descKey: 'howlongtobeatDesc' },
  { id: 'steamgriddb', name: 'SteamGridDB', iconType: 'gamepad', descKey: 'steamgriddbDesc' },
  { id: 'achievements', name: 'Achievements', iconType: 'trophy', descKey: 'achievementsDesc' },
  { id: 'playtime', name: 'Playtime Stats', iconType: 'chart', descKey: 'playtimeDesc' },
  { id: 'pcgw', name: 'PCGamingWiki', iconType: 'globe', descKey: 'pcgwDesc' },
  { id: 'itapatches', name: 'Patch ITA Finder', iconType: 'search', descKey: 'itaPatchesDesc' },
];

const connectableProviders = ['steam', 'epic', 'ubisoft', 'itchio', 'gog', 'origin', 'battlenet', 'rockstar', 'amazon'];
// Store a solo rilevamento locale (nessuna credenziale)
const EXTRA_DETECT_IDS = ['humble', 'gamejolt', 'bigfish'];
const autoDetectProviders = ['xbox', ...EXTRA_DETECT_IDS];
const connectableUtilities = ['howlongtobeat', 'steamgriddb', 'achievements', 'playtime', 'pcgw', 'itapatches'];

// Cache globale in-memory per evitare ri-detection ad ogni mount
interface StoresCache {
  xboxDetected: boolean | null;
  amazonDetected: boolean | null;
  extraDetected: Record<string, boolean | null>;
  ubisoftConnected: boolean;
  detectionDone: boolean;
}
const _g = globalThis as unknown as Record<string, unknown>;
if (!_g.__gsStoresCache) {
  _g.__gsStoresCache = {
    xboxDetected: null as boolean | null,
    amazonDetected: null as boolean | null,
    extraDetected: { humble: null, gamejolt: null, bigfish: null } as Record<string, boolean | null>,
    ubisoftConnected: false,
    detectionDone: false,
  };
}
const _storesCache = _g.__gsStoresCache as StoresCache;
// Retrocompat: cache creata da una versione precedente della pagina senza extraDetected
if (!_storesCache.extraDetected) {
  _storesCache.extraDetected = { humble: null, gamejolt: null, bigfish: null };
}

export default function StoresPage() {
  const { t } = useTranslation();
  // Gestione auth locale con persistenza
  const { data: session, status, update } = useSession();
  const isLoading = status === 'loading';
  
  // Aggiorna la sessione quando cambia la pagina
  useEffect(() => {
    update();
  }, []);

  // Ripristina stato connessione store dal backend Tauri all'avvio
  useEffect(() => {
    const restoreStoreConnections = async () => {
      const existingAccounts = JSON.parse(localStorage.getItem('gameStringer_connectedAccounts') || '[]');
      let changed = false;
      const hasProvider = (p: string) => existingAccounts.some((a: Record<string, unknown>) => a.provider === p);

      // Steam — credenziali salvate nel profilo attivo
      if (!hasProvider('steam-credentials')) {
        try {
          const creds = await invoke<{ steam_id?: string }>('load_steam_credentials');
          if (creds && creds.steam_id && creds.steam_id.length > 0) {
            existingAccounts.push({ provider: 'steam-credentials', userId: creds.steam_id, steamId: creds.steam_id });
            changed = true;
            clientLogger.debug(`[STORES] Steam credentials restored from backend: ${creds.steam_id}`);
          }
        } catch { clientLogger.debug('[STORES] Steam: nessuna credenziale salvata'); }
      }

      // Epic — credenziali in file standalone
      if (!hasProvider('epicgames')) {
        try {
          const creds = await invoke<{ username_encrypted?: string }>('load_epic_credentials');
          if (creds && creds.username_encrypted) {
            existingAccounts.push({ provider: 'epicgames', userId: 'epic-user' });
            changed = true;
            clientLogger.debug('[STORES] ✅ Epic credentials restored from backend');
          }
        } catch { clientLogger.debug('[STORES] Epic: nessuna credenziale salvata'); }
      }

      // GOG — credenziali in file standalone
      if (!hasProvider('gog-credentials')) {
        try {
          const creds = await invoke<{ email?: string; username?: string }>('load_gog_credentials');
          if (creds && (creds.email || creds.username)) {
            existingAccounts.push({ provider: 'gog-credentials', userId: creds.username || 'gog-user' });
            changed = true;
            clientLogger.debug(`[STORES] GOG credentials restored from backend: ${creds.username}`);
          }
        } catch { clientLogger.debug('[STORES] GOG: nessuna credenziale salvata'); }
      }

      // Ubisoft
      if (!hasProvider('ubisoft-credentials')) {
        try {
          const creds = await invoke<{ email?: string }>('load_ubisoft_credentials');
          if (creds && creds.email) {
            existingAccounts.push({ provider: 'ubisoft-credentials', userId: creds.email });
            setUbisoftConnected(true);
            _storesCache.ubisoftConnected = true;
            changed = true;
            clientLogger.debug(`[STORES] Ubisoft credentials restored from backend: ${creds.email}`);
          }
        } catch {
          clientLogger.debug('[STORES] Ubisoft: nessuna credenziale salvata');
          setUbisoftConnected(false);
        }
      } else {
        // Controlla anche Ubisoft se già nel localStorage
        setUbisoftConnected(true);
        _storesCache.ubisoftConnected = true;
      }

      // Origin/EA — credenziali dal profilo Tauri
      if (!hasProvider('origin-credentials')) {
        try {
          const res = await invoke<{ success?: boolean; data?: { username?: string } }>('load_store_credentials', { store: 'origin' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'origin-credentials', userId: res.data!.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ Origin credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] Origin: nessuna credenziale salvata'); }
      }

      // Battle.net — credenziali dal profilo Tauri
      if (!hasProvider('battlenet-credentials')) {
        try {
          const res = await invoke<{ success?: boolean; data?: { username?: string } }>('load_store_credentials', { store: 'battlenet' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'battlenet-credentials', userId: res.data!.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ Battle.net credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] Battle.net: nessuna credenziale salvata'); }
      }

      // Rockstar — credenziali dal profilo Tauri
      if (!hasProvider('rockstar-credentials')) {
        try {
          const res = await invoke<{ success?: boolean; data?: { username?: string } }>('load_store_credentials', { store: 'rockstar' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'rockstar-credentials', userId: res.data!.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ Rockstar credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] Rockstar: nessuna credenziale salvata'); }
      }

      // Amazon — credenziali dal profilo Tauri
      if (!hasProvider('amazon-credentials')) {
        try {
          const res = await invoke<{ success?: boolean; data?: { username?: string } }>('load_store_credentials', { store: 'amazon' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'amazon-credentials', userId: res.data!.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ Amazon credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] Amazon: nessuna credenziale salvata'); }
      }

      // itch.io — credenziali dal profilo Tauri
      if (!hasProvider('itchio-credentials')) {
        try {
          const res = await invoke<{ success?: boolean; data?: { username?: string } }>('load_store_credentials', { store: 'itchio' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'itchio-credentials', userId: res.data!.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ itch.io credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] itch.io: nessuna credenziale salvata'); }
      }

      if (changed) {
        localStorage.setItem('gameStringer_connectedAccounts', JSON.stringify(existingAccounts));
        clientLogger.debug(`[STORES] connectedAccounts aggiornati: ${existingAccounts.length} provider`);
        // Aggiorna la sessione auth per riflettere i nuovi account
        await update();
      }
    };
    restoreStoreConnections();
  }, []);

  // State for UI elements and forms
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [ubisoftConnected, setUbisoftConnected] = useState(_storesCache.ubisoftConnected);
  
  // State for Steam ID modal
  const [isSteamModalOpen, setIsSteamModalOpen] = useState(false);

  const [_ubisoftCredentials, setUbisoftCredentials] = useState({ email: '', password: '' });
  const [isUbisoftModalOpen, setIsUbisoftModalOpen] = useState(false);

  // State for itch.io modal
  const [isItchioModalOpen, setIsItchioModalOpen] = useState(false);

  // Generic credentials state for new providers
  const [_genericCredentials, setGenericCredentials] = useState({ email: '', password: '' });
  const [genericModalProvider, setGenericModalProvider] = useState<string | null>(null);
  
  // Test connection state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { connected?: boolean; error?: string; message?: string }>>({});
  const [xboxDetected, setXboxDetected] = useState<boolean | null>(_storesCache.xboxDetected);
  const [amazonDetected, setAmazonDetected] = useState<boolean | null>(_storesCache.amazonDetected);
  const [extraDetected, setExtraDetected] = useState<Record<string, boolean | null>>(_storesCache.extraDetected);

  // Store auto-rilevati (Xbox/Amazon) che l'utente ha disconnesso manualmente.
  // La rilevazione di sistema li riproporrebbe sempre: questo elenco li nasconde
  // finché non vengono riattivati. Persistito in localStorage.
  const IGNORED_STORES_KEY = 'gs_ignored_detected_stores';
  const [ignoredStores, setIgnoredStores] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(IGNORED_STORES_KEY);
      if (raw) setIgnoredStores(JSON.parse(raw));
    } catch { /* ignora */ }
  }, []);
  const persistIgnored = (list: string[]) => {
    setIgnoredStores(list);
    try { localStorage.setItem(IGNORED_STORES_KEY, JSON.stringify(list)); } catch { /* ignora */ }
  };
  const ignoreDetectedStore = (id: string) => {
    setIgnoredStores(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try { localStorage.setItem(IGNORED_STORES_KEY, JSON.stringify(next)); } catch { /* ignora */ }
      return next;
    });
  };
  const reenableDetectedStore = (id: string) => persistIgnored(ignoredStores.filter(s => s !== id));

  // Conteggio giochi per store dalla cache libreria (idb-keyval, zero chiamate backend).
  // I valori `platform` sono display-name ('Steam', 'Epic Games', 'itch.io'…) → match via regex.
  const [libraryCounts, setLibraryCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    const PLATFORM_MATCHERS: Record<string, RegExp> = {
      steam: /steam/,
      gog: /gog/,
      epic: /epic/,
      ubisoft: /ubisoft|uplay/,
      itchio: /itch/,
      origin: /origin|ea app|electronic arts/,
      battlenet: /battle\.?net|blizzard/,
      rockstar: /rockstar/,
      xbox: /xbox|game pass|microsoft/,
      amazon: /amazon/,
      humble: /humble/,
      gamejolt: /jolt/,
      bigfish: /big ?fish/,
    };
    const compute = async () => {
      try {
        const { get } = await import('idb-keyval');
        const games = await get<Array<{ platform?: string }>>('gs_library_games');
        if (cancelled || !Array.isArray(games)) return;
        const counts: Record<string, number> = {};
        for (const g of games) {
          const p = (g?.platform || '').toLowerCase();
          if (!p) continue;
          for (const [storeId, re] of Object.entries(PLATFORM_MATCHERS)) {
            if (re.test(p)) {
              counts[storeId] = (counts[storeId] || 0) + 1;
              break;
            }
          }
        }
        if (!cancelled) setLibraryCounts(counts);
      } catch { /* silenzioso — la card ricade sulla descrizione */ }
    };
    compute();
    window.addEventListener('gs-library-updated', compute);
    return () => {
      cancelled = true;
      window.removeEventListener('gs-library-updated', compute);
    };
  }, []);

  useEffect(() => {
    if (_storesCache.detectionDone) return;
    _storesCache.detectionDone = true;
    invoke<boolean>('is_xbox_installed').then(detected => {
      setXboxDetected(detected);
      _storesCache.xboxDetected = detected;
    }).catch(() => { setXboxDetected(false); _storesCache.xboxDetected = false; });
    invoke<boolean>('is_amazon_games_installed').then(detected => {
      setAmazonDetected(detected);
      _storesCache.amazonDetected = detected;
    }).catch(() => { setAmazonDetected(false); _storesCache.amazonDetected = false; });
    // Store extra a rilevamento locale
    const extraChecks: Array<[string, string]> = [
      ['humble', 'is_humble_installed'],
      ['gamejolt', 'is_gamejolt_installed'],
      ['bigfish', 'is_bigfish_installed'],
    ];
    for (const [id, cmd] of extraChecks) {
      invoke<boolean>(cmd)
        .then(detected => {
          setExtraDetected(prev => {
            const next = { ...prev, [id]: detected };
            _storesCache.extraDetected = next;
            return next;
          });
        })
        .catch(() => {
          setExtraDetected(prev => {
            const next = { ...prev, [id]: false };
            _storesCache.extraDetected = next;
            return next;
          });
        });
    }
  }, []);
  
  // Utility services state
  const [utilityPreferences, setUtilityPreferences] = useState<Record<string, { enabled?: boolean; apiKey?: string }>>({});
  const [utilityExpanded, setUtilityExpanded] = useState(true);
  
  // SteamGridDB modal state
  const [isSteamGridDBModalOpen, setIsSteamGridDBModalOpen] = useState(false);
  const [steamGridDBApiKey, setSteamGridDBApiKey] = useState('');
  
  // Family Sharing modal state
  const [isFamilySharingOpen, setIsFamilySharingOpen] = useState(false);

  const providerMap: { [key: string]: string } = {
    steam: 'steam-credentials',
    itchio: 'itchio-credentials',
    epic: 'epicgames',
    ubisoft: 'ubisoft-credentials',
    gog: 'gog-credentials',
    origin: 'origin-credentials',
    battlenet: 'battlenet-credentials',
    rockstar: 'rockstar-credentials',
    amazon: 'amazon-credentials',
  };

  const isConnected = (providerId: string): boolean => {
    // Check for utility services
    if (['howlongtobeat', 'steamgriddb', 'achievements', 'playtime', 'pcgw', 'itapatches'].includes(providerId)) {
      return utilityPreferences[providerId]?.enabled || false;
    }
    
    // Check Steam connection con auth locale
    if (providerId === 'steam') {
      return isProviderConnected('steam-credentials');
    }
    
    // Check Ubisoft connection con stato locale
    if (providerId === 'ubisoft') {
      return ubisoftConnected || isProviderConnected('ubisoft-credentials');
    }

    // Amazon: auto-detect O credenziali (rispetta la disconnessione manuale)
    if (providerId === 'amazon') {
      return (amazonDetected === true && !ignoredStores.includes('amazon')) || isProviderConnected('amazon-credentials');
    }

    // Store extra a solo rilevamento locale (Humble, Game Jolt, Big Fish)
    if (EXTRA_DETECT_IDS.includes(providerId)) {
      return extraDetected[providerId] === true && !ignoredStores.includes(providerId);
    }
    
    // Check for other store providers
    if (!session?.user?.accounts) return false;
    const backendProviderId = providerMap[providerId] || providerId;
    return session.user.accounts.some((acc: Record<string, unknown>) => acc.provider === backendProviderId);
  };

  const getBackendProviderId = (frontendId: string) => {
    return providerMap[frontendId] || frontendId;
  };


  // Load utility preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('gamestringer_utility_prefs');
      if (stored) {
        setUtilityPreferences(JSON.parse(stored));
      }
    } catch (error: unknown) {
      clientLogger.error(`Error loading utility preferences: ${String(error)}`);
    }
  }, []);

  const handleConnectUtility = async (utilityId: string) => {
    setLoadingProvider(utilityId);
    
    try {
      if (utilityId === 'howlongtobeat') {
        // HowLongToBeat doesn't require authentication, just enable it locally
        const newPrefs = { ...utilityPreferences, [utilityId]: { enabled: true } };
        localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
        setUtilityPreferences(newPrefs);
        toast.success(t('storesPage.hltbActivated'));
      } else if (utilityId === 'achievements') {
        const newPrefs = { ...utilityPreferences, [utilityId]: { enabled: true } };
        localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
        setUtilityPreferences(newPrefs);
        toast.success(t('storesPage.achievementsActivated'));
      } else if (utilityId === 'playtime') {
        const newPrefs = { ...utilityPreferences, [utilityId]: { enabled: true } };
        localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
        setUtilityPreferences(newPrefs);
        toast.success(t('storesPage.playtimeActivated'));
      } else if (utilityId === 'pcgw') {
        const newPrefs = { ...utilityPreferences, [utilityId]: { enabled: true } };
        localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
        setUtilityPreferences(newPrefs);
        toast.success(t('stores.pcgwActivated'));
      } else if (utilityId === 'itapatches') {
        const newPrefs = { ...utilityPreferences, [utilityId]: { enabled: true } };
        localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
        setUtilityPreferences(newPrefs);
        toast.success(t('stores.itaPatchesActivated'));
      } else if (utilityId === 'steamgriddb') {
        setIsSteamGridDBModalOpen(true);
        setLoadingProvider(null);
        return;
      }
    } catch {
      toast.error(t('storesPage.activationError').replace('{name}', utilityId));
    }

    setLoadingProvider(null);
  };

  const handleDisconnectUtility = async (utilityId: string) => {
    setLoadingProvider(utilityId);

    try {
      const newPrefs = { ...utilityPreferences };
      delete newPrefs[utilityId];
      localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
      setUtilityPreferences(newPrefs);
      toast.success(t('storesPage.utilityDeactivated').replace('{name}', utilityId));
    } catch {
      toast.error(t('storesPage.deactivationError').replace('{name}', utilityId));
    }
    
    setLoadingProvider(null);
  };

  const handleConnect = async (providerId: string) => {
    setLoadingProvider(providerId);
    const _userId = session?.user?.id;

    // Handle credential-based providers with modals
    if (providerId === 'ubisoft') {
      setIsUbisoftModalOpen(true);
      setLoadingProvider(null);
      return;
    }

    if (providerId === 'steam') {
      setIsSteamModalOpen(true);
      setLoadingProvider(null);
      return;
    }

    if (['epic', 'gog', 'origin', 'battlenet', 'rockstar', 'amazon'].includes(providerId)) {
      setGenericModalProvider(providerId);
      setLoadingProvider(null);
      return;
    }

    // Handle itch.io with dedicated modal
    if (providerId === 'itchio') {
      setIsItchioModalOpen(true);
      setLoadingProvider(null);
      return;
    }
    
    setLoadingProvider(null);
  };

  const handleDisconnect = async (providerId: string) => {
    setLoadingProvider(providerId);
    const backendProviderId = getBackendProviderId(providerId);
    
    try {
      // Store auto-rilevati (Xbox/Amazon): nascondili manualmente, altrimenti la
      // rilevazione di sistema li riproporrebbe subito come connessi.
      if (autoDetectProviders.includes(providerId)) {
        ignoreDetectedStore(providerId);
      }

      // Cancella Credentials dal backend Tauri per Ubisoft
      if (providerId === 'ubisoft') {
        await invoke('clear_ubisoft_credentials');
        setUbisoftConnected(false);
        clientLogger.debug('[UBISOFT] Credentials cancellate dal backend');
      }

      // Cancella credenziali Epic dal backend
      if (providerId === 'epic') {
        try {
          await invoke('clear_epic_credentials');
          clientLogger.debug('[EPIC] Credentials cancellate dal backend');
        } catch (e: unknown) {
          clientLogger.warn(`[STORES] Impossibile cancellare epic da Tauri: ${String(e)}`);
        }
      }

      // Cancella credenziali Steam dal backend
      if (providerId === 'steam') {
        try {
          await invoke('save_store_credentials', { store: 'steam', username: '', password: '' });
          clientLogger.debug('[STEAM] Credentials cancellate dal profilo Tauri');
        } catch (e: unknown) {
          clientLogger.warn(`[STORES] Impossibile cancellare steam da Tauri: ${String(e)}`);
        }
      }

      // Cancella credenziali dal profilo Tauri per store generici
      const tauriStores = ['epic', 'origin', 'battlenet', 'rockstar', 'amazon', 'itchio', 'gog'];
      if (tauriStores.includes(providerId)) {
        try {
          await invoke('save_store_credentials', { store: providerId, username: '', password: '' });
          clientLogger.debug(`[STORES] 🗑️ Credenziali ${providerId} cancellate dal profilo Tauri`);
        } catch (e: unknown) {
          clientLogger.warn(`[STORES] Impossibile cancellare ${providerId} da Tauri: ${String(e)}`);
        }
      }
      
      // Disconnessione gestita localmente: l'auth vive in localStorage e le
      // credenziali sono già state cancellate via Tauri sopra. Nessuna chiamata
      // a /api/auth/disconnect (route inesistente → ritornava 501).
      await signOut(backendProviderId);
      if (providerId === 'ubisoft') setUbisoftConnected(false);

      toast.success(t('storesPage.accountDisconnected').replace('{name}', providerId));
      await update();
    } catch (error: unknown) {
      clientLogger.error(`Disconnect error: ${String(error)}`);
      toast.error(error instanceof Error ? error.message : t('storesPage.disconnectError'));
    }
    setLoadingProvider(null);
  };

  const handleUbisoftLogin = async (email: string, password: string, twoFactorCode?: string) => {
    if (!email || !password) {
      toast.error(t('common.perFavoreInserisciSiaEmailChePassword'));
      return;
    }
    setLoadingProvider('ubisoft');
    try {
      // Chiama il backend Tauri per autenticare e salvare le Credentials criptate
      const backendResult = await invoke<string>('connect_ubisoft', { email, password });
      clientLogger.debug('[UBISOFT] Backend result:', backendResult);
      
      // Salva anche in localStorage per la sessione frontend
      const result = await signIn('ubisoft-credentials', {
        redirect: false,
        email,
        password,
        twoFactorCode,
        userId: session?.user?.id,
      });

      if (result?.error) {
        toast.error(result.error || t('storesPage.ubisoftConnectError'));
      } else {
        setUbisoftConnected(true);
        toast.success(backendResult || t('storesPage.ubisoftConnected'));
        setIsUbisoftModalOpen(false);
        setUbisoftCredentials({ email: '', password: '' });
        await update();
      }
    } catch (error: unknown) {
      clientLogger.error(`Ubisoft auth error: ${String(error)}`);
      toast.error(error instanceof Error ? error.message : t('storesPage.ubisoftConnectErrorCheckCredentials'));
    }
    setLoadingProvider(null);
  };

  const handleGenericLogin = async (email: string, password: string, twoFactorCode?: string) => {
    if (!email || !password) {
      toast.error(t('common.perFavoreInserisciSiaEmailChePassword'));
      return;
    }
    if (!genericModalProvider) return;

    setLoadingProvider(genericModalProvider);
    try {
      // 1. Salva credenziali nel backend Tauri (persistenza criptata nel profilo)
      try {
        await invoke('save_store_credentials', {
          store: genericModalProvider,
          username: email,
          password: password,
        });
        clientLogger.debug(`[STORES] ✅ Credenziali ${genericModalProvider} salvate nel profilo Tauri`);
      } catch (tauriErr) {
        clientLogger.warn(`[STORES] Fallback: impossibile salvare ${genericModalProvider} in Tauri: ${String(tauriErr)}`);
      }

      // 2. Salva anche in session/localStorage per il frontend
      const backendProviderId = providerMap[genericModalProvider] || `${genericModalProvider}-credentials`;
      const result = await signIn(backendProviderId, {
        redirect: false,
        email,
        password,
        twoFactorCode,
        userId: session?.user?.id,
      });

      if (result?.error) {
        // Se GOG richiede 2FA, l'error dovrebbe indicarlo
        if (genericModalProvider === 'gog' && result.error.includes('2FA')) {
          toast.error(t('common.perFavoreInserisciIlCodice2fa'));
          // La modale gestirà la richiesta del codice 2FA
        } else {
          toast.error(result.error || t('storesPage.providerConnectError').replace('{name}', genericModalProvider));
        }
      } else {
        toast.success(t('storesPage.accountConnected').replace('{name}', genericModalProvider));
        setGenericModalProvider(null);
        setGenericCredentials({ email: '', password: '' });
        await update();
      }
    } catch (error: unknown) {
      clientLogger.error(`${genericModalProvider} auth error: ${String(error)}`);
      toast.error(t('storesPage.providerConnectError').replace('{name}', String(genericModalProvider)));
    }
    setLoadingProvider(null);
  };

  const handleSteamLogin = async (steamId: string) => {
    setLoadingProvider('steam');
    const result = await signIn('steam-credentials', {
      redirect: false,
      steamid: steamId,
      userId: session?.user?.id || steamId, // Fallback a steamId se session è null
    });

    if (result?.error) {
      toast.error(result.error || t('storesPage.steamConnectError'));
      throw new Error(result.error);
    } else {
      toast.success(t('common.accountSteamCollegatoConSuccesso'));
      setIsSteamModalOpen(false);
      await update();
    }
    setLoadingProvider(null);
  };

  const handleItchioLogin = async (apiKey: string) => {
    setLoadingProvider('itchio');
    try {
      // Salva credenziali nel backend Tauri (persistenza criptata)
      try {
        await invoke('save_store_credentials', {
          store: 'itchio',
          username: 'itchio-api-key',
          password: apiKey,
        });
        clientLogger.debug('[STORES] ✅ itch.io API key salvata nel profilo Tauri');
      } catch (tauriErr) {
        clientLogger.warn(`[STORES] Fallback: impossibile salvare itch.io in Tauri: ${String(tauriErr)}`);
      }

      const result = await signIn('itchio-credentials', {
        accessToken: apiKey,
        userId: session?.user?.id,
        redirect: false,
      });
      
      if (result?.error) {
        throw new Error(result.error);
      } else if (result?.ok) {
        toast.success(t('common.accountItchioCollegatoConSuccesso'));
        await update();
      }
    } catch (error: unknown) {
      toast.error(t('storesPage.itchioConnectError'));
      throw error;
    } finally {
      setLoadingProvider(null);
    }
  };

  const _steamAccount = session?.user?.accounts?.find(acc => acc.provider === 'steam-credentials');

  const testConnectionUtility = async (utilityId: string) => {
    setTestingProvider(utilityId);
    
    try {
      if (utilityId === 'howlongtobeat') {
        // Test HowLongToBeat via comando Rust (niente fetch diretto: CORS nel webview).
        // Il comando NON lancia più su timeout/rete (HLTB è opzionale, non deve
        // produrre errori rossi): l'esito va letto dal campo `available`.
        const hltb = await invoke<{ available?: boolean; message?: string }>(
          'get_howlongtobeat_info', { gameName: 'The Witcher 3' }
        );
        if (hltb?.available) {
          setTestResults(prev => ({ ...prev, [utilityId]: { connected: true } }));
          toast.success(t('common.howlongtobeatRaggiungibile'));
        } else {
          throw new Error(hltb?.message || t('storesPage.hltbUnreachable'));
        }
      } else if (utilityId === 'steamgriddb') {
        // Test SteamGridDB API via Tauri command (no CORS)
        const apiKey = utilityPreferences[utilityId]?.apiKey;
        if (!apiKey) {
          throw new Error(t('storesPage.apiKeyMissing'));
        }
        
        const _result = await invoke<string | null>('fetch_steamgriddb_image', {
          appId: 292030,
          gameName: 'The Witcher 3',
          apiKey: apiKey,
        });
        // If no error thrown, the API key works
        setTestResults(prev => ({ ...prev, [utilityId]: { connected: true } }));
        toast.success(t('storesPage.steamgriddbWorks'));
      } else if (utilityId === 'pcgw') {
        const result = await invoke<string>('test_pcgw_connection');
        setTestResults(prev => ({ ...prev, [utilityId]: { connected: true, message: result } }));
        toast.success(result);
      } else if (utilityId === 'itapatches') {
        const result = await invoke<string>('test_ita_patch_search');
        setTestResults(prev => ({ ...prev, [utilityId]: { connected: true, message: result } }));
        toast.success(result);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message
        : typeof error === 'string' && error ? error
        : t('common.testFallito');
      if (error instanceof DOMException && error.name === 'AbortError') {
        setTestResults(prev => ({ ...prev, [utilityId]: { error: t('storesPage.timeoutUnreachable') } }));
        toast.error(t('storesPage.timeoutConnection').replace('{name}', utilityId));
      } else {
        setTestResults(prev => ({ ...prev, [utilityId]: { error: msg } }));
        toast.error(t('storesPage.problemWith').replace('{name}', utilityId).replace('{msg}', msg));
      }
    }
    
    setTestingProvider(null);
  };

  const testConnection = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      // Mappa providerId al comando Tauri di test
      const testCommandMap: Record<string, string> = {
        steam: 'test_steam_connection',
        epic: 'test_epic_connection',
        ubisoft: 'test_ubisoft_connection',
        gog: 'test_gog_connection',
        origin: 'test_origin_connection',
        battlenet: 'test_battlenet_connection',
        itchio: 'test_itchio_connection',
        rockstar: 'test_rockstar_connection',
        amazon: 'test_amazon_connection',
        xbox: 'test_xbox_connection',
      };
      const command = testCommandMap[providerId];
      if (!command) {
        // Nessun comando Tauri per questo provider: niente fetch('/api/...'), che nel
        // webview impacchettato non esiste. Segnaliamo che il test non è disponibile.
        setTestResults(prev => ({ ...prev, [providerId]: { error: t('stores.notAvailable') } }));
        toast.error(t('stores.notAvailable'));
      } else {
        // Usa il comando Tauri per un test reale.
        // NB: alcuni comandi (ubisoft, gog, amazon…) risolvono con una STRINGA
        // descrittiva su successo, altri (steam, epic…) con un oggetto.
        const result = await invoke<{ connected?: boolean; success?: boolean; error?: string; message?: string; games_count?: number } | string>(command);
        if (typeof result === 'string') {
          // Ok(String) dal backend: successo, salvo il caso "❌ ..." (es. credenziali scadute)
          const ok = !result.trim().startsWith('❌');
          setTestResults(prev => ({ ...prev, [providerId]: { connected: ok, message: result, error: ok ? undefined : result } }));
          if (ok) {
            toast.success(result);
          } else {
            toast.error(`${providerId}: ${result}`);
          }
        } else {
          const connected = result?.connected ?? result?.success ?? false;
          const testResult = {
            connected,
            message: result?.message || (connected ? t('stores.connected') : t('stores.disconnected')),
            error: result?.error,
          };
          setTestResults(prev => ({ ...prev, [providerId]: testResult }));
          if (connected) {
            const suffix = result?.games_count
              ? ` ${t('storesPage.gamesCountSuffix').replace('{count}', String(result.games_count))}`
              : '';
            toast.success(t('storesPage.connectionVerified').replace('{name}', providerId) + suffix);
          } else {
            toast.error(
              t('storesPage.problemWith')
                .replace('{name}', providerId)
                .replace('{msg}', result?.error || t('stores.connectionFailed'))
            );
          }
        }
      }
    } catch (error: unknown) {
      // Tauri rigetta con una stringa: non buttarla via con un generico "Test fallito"
      const errMsg = error instanceof Error ? error.message
        : typeof error === 'string' && error ? error
        : t('common.testFallito');
      toast.error(t('storesPage.testError').replace('{name}', providerId).replace('{msg}', errMsg));
      setTestResults(prev => ({ ...prev, [providerId]: { error: errMsg } }));
    }
    setTestingProvider(null);
  };

  return (
    <div className="p-2 space-y-1.5 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 p-1.5">
        <div className="relative flex items-center gap-2">
          <div className="p-1.5 bg-black/30 rounded-lg border border-white/10">
            <StoreIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">{t('stores.title')}</h1>
            <p className="text-white/70 text-micro">{t('stores.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Banner Riepilogo Connessioni */}
      {(() => {
        const connectedStores = storesConfig.filter(s => {
          if (s.id === 'xbox') return xboxDetected === true;
          if (s.id === 'amazon') return amazonDetected === true;
          if (EXTRA_DETECT_IDS.includes(s.id)) return extraDetected[s.id] === true;
          return isConnected(s.id);
        }).length;
        const activeUtilities = utilityServicesConfig.filter(s => isConnected(s.id)).length;
        return (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${connectedStores > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-300">
                <span className="font-semibold text-white">{connectedStores}</span>/{storesConfig.length} {t('storesPage.storesCountLabel')}
              </span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${activeUtilities > 0 ? 'bg-orange-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-300">
                <span className="font-semibold text-white">{activeUtilities}</span>/{utilityServicesConfig.length} {t('storesPage.servicesCountLabel')}
              </span>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {storesConfig.map((store) => {
          const isConnectable = connectableProviders.includes(store.id);
          const isAutoDetect = autoDetectProviders.includes(store.id);
          const currentLoading = loadingProvider === store.id;
          const xboxActive = store.id === 'xbox' && xboxDetected === true && !ignoredStores.includes('xbox');
          const amazonActive = store.id === 'amazon' && amazonDetected === true && !ignoredStores.includes('amazon');
          const isExtraDetect = EXTRA_DETECT_IDS.includes(store.id);
          const extraActive = isExtraDetect && extraDetected[store.id] === true && !ignoredStores.includes(store.id);
          const connected = store.id === 'xbox' ? xboxActive
            : isExtraDetect ? extraActive
            : isConnected(store.id);
          const isDetecting = (store.id === 'xbox' && xboxDetected === null)
            || (isExtraDetect && extraDetected[store.id] === null);

          const autoDetectStatus = store.id === 'xbox'
            ? (xboxDetected === null
                ? (t('stores.detecting') || 'Detecting...')
                : xboxDetected
                  ? (t('stores.xboxDetectedLabel') || 'Xbox App / Game Pass detected')
                  : (t('stores.xboxNotFound') || 'Xbox App not found'))
            : store.id === 'amazon' && amazonActive
            ? (t('stores.amazonDetectedLabel') || 'Amazon Games detected')
            : isExtraDetect
            ? (extraDetected[store.id] === null
                ? (t('stores.detecting') || 'Detecting...')
                : extraDetected[store.id]
                  ? (t('stores.appDetected') || '{name} rilevato').replace('{name}', store.name)
                  : (t('stores.appNotFound') || '{name} non trovato').replace('{name}', store.name))
            : null;

          const autoDetectCommand = store.id === 'xbox' ? 'test_xbox_connection'
            : store.id === 'humble' ? 'test_humble_connection'
            : store.id === 'gamejolt' ? 'test_gamejolt_connection'
            : store.id === 'bigfish' ? 'test_bigfish_connection'
            : null;

          return (
            <Card key={store.id} className={`p-1.5 card-hover ${
              store.id === 'xbox' ? 'border-[#107c10]/30' :
              store.id === 'amazon' ? 'border-[#ff9900]/30' : ''
            }`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="relative h-6 w-6 flex items-center justify-center flex-shrink-0">
                  {store.id === 'xbox' ? (
                    <div className="h-6 w-6 rounded bg-[#107c10] flex items-center justify-center text-white text-2xs font-bold">X</div>
                  ) : store.id === 'amazon' ? (
                    <div className="h-6 w-6 rounded bg-[#ff9900] flex items-center justify-center text-black text-2xs font-bold">A</div>
                  ) : store.id === 'humble' ? (
                    <div className="h-6 w-6 rounded bg-[#cb272c] flex items-center justify-center text-white text-2xs font-bold">H</div>
                  ) : store.id === 'gamejolt' ? (
                    <div className="h-6 w-6 rounded bg-[#191919] flex items-center justify-center text-[#ccff00] text-2xs font-bold">GJ</div>
                  ) : store.id === 'bigfish' ? (
                    <div className="h-6 w-6 rounded bg-[#0e5aa7] flex items-center justify-center text-white text-2xs font-bold">BF</div>
                  ) : store.logoUrl ? (
                    <Image
                      src={store.logoUrl}
                      alt={`${store.name} logo`}
                      width={24}
                      height={24}
                      style={{ objectFit: 'contain' }}
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-xs truncate">{store.name}</span>
                    {connected ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : isDetecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-micro text-muted-foreground line-clamp-1">
                    {connected && libraryCounts[store.id]
                      ? (t('stores.gamesImported') || '{count} giochi importati').replace('{count}', libraryCounts[store.id].toLocaleString())
                      : autoDetectStatus ?? t(`stores.${store.descKey}`)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
              {connected ? (
                  <>
                    {/* Stato connesso = positivo (verde). Il rosso "Disconnetti" appare solo al hover. */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-2xs group/disc border-emerald-500/40 text-emerald-400 bg-emerald-500/5 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10"
                      disabled={isLoading || currentLoading}
                      onClick={() => handleDisconnect(store.id)}
                    >
                      {currentLoading ? (
                        <Loader2 className="animate-spin h-3 w-3 mr-1" />
                      ) : (
                        <>
                          <span className="flex items-center gap-1 group-hover/disc:hidden">
                            <CheckCircle className="h-3 w-3" />
                            {t('stores.connected')}
                          </span>
                          <span className="hidden items-center gap-1 group-hover/disc:flex">
                            <Unplug className="h-3 w-3" />
                            {t('stores.disconnect')}
                          </span>
                        </>
                      )}
                    </Button>
                    {store.id === 'steam' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-2xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                        onClick={() => setIsFamilySharingOpen(true)}
                        title={t('storesPage.familySharing')}
                      >
                        👨‍👩‍👧‍👦
                      </Button>
                    )}
                    {store.id === 'gog' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-2xs border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                        onClick={() => shellOpen('https://www.gog.com/account').catch(() => window.open('https://www.gog.com/account', '_blank'))}
                        title={t('storesPage.openGog')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    {/* Store auto-rilevati hanno già il proprio pulsante Test: evita il doppione */}
                    {!isAutoDetect && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={testingProvider === store.id}
                        onClick={() => testConnection(store.id)}
                        title={t('storesPage.test')}
                      >
                        {testingProvider === store.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : testResults[store.id]?.connected ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </>
                ) : isConnectable ? (
                  <>
                    {/* Rockstar non è ancora supportato: bottone disabilitato + "Prossimamente" */}
                    <Button
                      size="sm"
                      variant="outline"
                      className={`flex-1 h-7 text-2xs ${
                        store.id === 'rockstar'
                          ? 'border-slate-700 text-slate-500 cursor-not-allowed'
                          : 'border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400'
                      }`}
                      disabled={store.id === 'rockstar' || isLoading || currentLoading}
                      onClick={() => handleConnect(store.id)}
                    >
                      {currentLoading ? (
                        <Loader2 className="animate-spin h-3 w-3 mr-1" />
                      ) : store.id === 'rockstar' ? (
                        <Clock className="h-3 w-3 mr-1" />
                      ) : (
                        <Plug className="h-3 w-3 mr-1" />
                      )}
                      {store.id === 'rockstar' ? t('stores.comingSoon') : t('stores.connect')}
                    </Button>
                    {store.id === 'gog' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-2xs border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                          onClick={() => shellOpen('https://www.gog.com/en/games').catch(() => window.open('https://www.gog.com/en/games', '_blank'))}
                          title={t('storesPage.gogStore')}
                        >
                          <StoreIcon className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-2xs border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                          onClick={() => shellOpen('https://www.gog.com/galaxy').catch(() => window.open('https://www.gog.com/galaxy', '_blank'))}
                          title={t('common.scaricaGogGalaxy')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </>
                ) : isAutoDetect && ignoredStores.includes(store.id) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-2xs border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                    onClick={() => reenableDetectedStore(store.id)}
                  >
                    <Plug className="h-3 w-3 mr-1" />
                    {t('stores.connect')}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-2xs border-orange-500/30 text-orange-300/50" disabled={true}>
                    {t('stores.notAvailable')}
                  </Button>
                )}
              {isAutoDetect && autoDetectCommand ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={testingProvider === store.id}
                  title={t('storesPage.testDetection').replace('{name}', store.name)}
                  onClick={async () => {
                    setTestingProvider(store.id);
                    try {
                      const result = await invoke<string>(autoDetectCommand);
                      setTestResults(prev => ({ ...prev, [store.id]: { connected: true, message: result } }));
                      toast.success(result);
                    } catch (e: unknown) {
                      const msg = String(e);
                      setTestResults(prev => ({ ...prev, [store.id]: { error: msg } }));
                      toast.error(msg);
                    }
                    setTestingProvider(null);
                  }}
                >
                  {testingProvider === store.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : testResults[store.id]?.connected ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                </Button>
              ) : null}
              {/* Link alla pagina di download dell'app dello store — sempre visibile.
                  GOG escluso: ha già i suoi pulsanti dedicati (account/Galaxy). */}
              {store.appUrl && store.id !== 'gog' && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-200"
                  title={(t('stores.downloadApp') || "Scarica l'app {name}").replace('{name}', store.name)}
                  onClick={() => shellOpen(store.appUrl).catch(() => window.open(store.appUrl, '_blank'))}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Steam Family Sharing Dialog */}
      <Dialog open={isFamilySharingOpen} onOpenChange={setIsFamilySharingOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('storesPage.familySharing')}</DialogTitle>
          </DialogHeader>
          <SteamFamilySharing />
        </DialogContent>
      </Dialog>

      {/* Utility Services Section - Collapsible */}
      <div className="mt-2">
        <button 
          onClick={() => {
            setUtilityExpanded(!utilityExpanded);
            if (!utilityExpanded) {
              setTimeout(() => {
                document.getElementById('utility-section')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }, 100);
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-1 px-3 rounded bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors"
        >
          <span className="text-sm font-medium text-slate-300">{t('stores.utilityServices')}</span>
          <span className={utilityExpanded ? '' : 'inline-block animate-bounce'}><ChevronDown className={`h-5 w-5 text-orange-400 transition-transform ${utilityExpanded ? 'rotate-180' : ''}`} /></span>
        </button>
        
        {utilityExpanded && (
        <div id="utility-section" className="mt-1">
        <p className="text-muted-foreground text-2xs mb-0.5">
          {t('stores.utilityServicesDesc')}
        </p>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
          {utilityServicesConfig.map((service) => {
            const connected = isConnected(service.id);
            const isConnectable = connectableUtilities.includes(service.id);
            const currentLoading = loadingProvider === service.id;

            return (
              <Card key={service.id} className="p-1.5 card-hover">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="relative h-5 w-5 flex items-center justify-center flex-shrink-0">
                  {service.iconType === 'clock' && <Clock className="h-4 w-4 text-blue-500" />}
                  {service.iconType === 'gamepad' && <Gamepad2 className="h-4 w-4 text-orange-500" />}
                  {service.iconType === 'trophy' && <Trophy className="h-4 w-4 text-yellow-500" />}
                  {service.iconType === 'chart' && <BarChart3 className="h-4 w-4 text-green-500" />}
                  {service.iconType === 'globe' && <Globe className="h-4 w-4 text-cyan-500" />}
                  {service.iconType === 'search' && <Search className="h-4 w-4 text-emerald-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-xs truncate">{service.name}</span>
                    {connected ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-micro text-muted-foreground line-clamp-1">{t(`stores.${service.descKey}`)}</p>
                </div>
              </div>
              <div className="flex gap-1">
                    {connected ? (
                      <>
                  {/* Servizio attivo = positivo (verde), "Disattiva" solo al hover — coerente con gli store */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-2xs group/deact border-emerald-500/40 text-emerald-400 bg-emerald-500/5 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10"
                    disabled={isLoading || currentLoading}
                    onClick={() => handleDisconnectUtility(service.id)}
                  >
                    {currentLoading ? (
                      <Loader2 className="animate-spin h-3 w-3 mr-1" />
                    ) : (
                      <>
                        <span className="flex items-center gap-1 group-hover/deact:hidden">
                          <CheckCircle className="h-3 w-3" />
                          {t('stores.active')}
                        </span>
                        <span className="hidden items-center gap-1 group-hover/deact:flex">
                          <Unplug className="h-3 w-3" />
                          {t('stores.deactivate')}
                        </span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={testingProvider === service.id}
                    onClick={() => testConnectionUtility(service.id)}
                    title={t('storesPage.test')}
                  >
                    {testingProvider === service.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : testResults[service.id]?.connected ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                  </Button>
                </>
                    ) : isConnectable ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-2xs border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                  disabled={isLoading || currentLoading}
                  onClick={() => handleConnectUtility(service.id)}
                >
                  {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Plug className="h-3 w-3 mr-1" />}
                  {t('stores.activate')}
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="flex-1 h-7 text-2xs border-orange-500/30 text-orange-300/50" disabled={true}>
                  {t('stores.comingSoon')}
                </Button>
              )}
              </div>
            </Card>
            );
          })}
        </div>
        </div>
        )}
      </div>

      {/* Modern Modals */}
      <SteamModal
        isOpen={isSteamModalOpen}
        onClose={() => setIsSteamModalOpen(false)}
        onSubmit={handleSteamLogin}
        isLoading={loadingProvider === 'steam'}
      />

      <ItchioModal
        isOpen={isItchioModalOpen}
        onClose={() => setIsItchioModalOpen(false)}
        onSubmit={handleItchioLogin}
        isLoading={loadingProvider === 'itchio'}
      />

      <GenericCredentialsModal
        isOpen={isUbisoftModalOpen}
        onClose={() => {
          setIsUbisoftModalOpen(false);
          setUbisoftCredentials({ email: '', password: '' });
        }}
        onSubmit={handleUbisoftLogin}
        provider="ubisoft"
        isLoading={loadingProvider === 'ubisoft'}
      />

      {genericModalProvider && genericModalProvider !== 'itchio' && (
        <GenericCredentialsModal
          isOpen={true}
          onClose={() => {
            setGenericModalProvider(null);
            setGenericCredentials({ email: '', password: '' });
          }}
          onSubmit={handleGenericLogin}
          provider={genericModalProvider}
          isLoading={loadingProvider === genericModalProvider}
        />
      )}

      {/* SteamGridDB API Key Modal */}
      <Dialog open={isSteamGridDBModalOpen} onOpenChange={(open) => { if (!open) { setIsSteamGridDBModalOpen(false); setSteamGridDBApiKey(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('storesPage.steamgriddbApiKey')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('storesPage.steamgriddbApiKeyDesc')}
          </p>
          <a 
            href="https://www.steamgriddb.com/profile/preferences/api" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm underline"
          >
            {t('storesPage.getApiKeyHere')}
          </a>
          <Input
            placeholder={t('stores.apiKey')}
            value={steamGridDBApiKey}
            onChange={(e) => setSteamGridDBApiKey(e.target.value)}
            className="font-mono"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsSteamGridDBModalOpen(false);
                setSteamGridDBApiKey('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (steamGridDBApiKey.trim()) {
                  const newPrefs = { ...utilityPreferences, steamgriddb: { enabled: true, apiKey: steamGridDBApiKey.trim() } };
                  localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
                  setUtilityPreferences(newPrefs);
                  toast.success(t('common.steamgriddbCollegatoConSuccesso'));
                  setIsSteamGridDBModalOpen(false);
                  setSteamGridDBApiKey('');
                } else {
                  toast.error(t('common.inserisciUnaApiKeyValida'));
                }
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {t('common.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}



