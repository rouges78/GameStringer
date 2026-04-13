'use client';

import { useTranslation } from '@/lib/i18n';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
} from "@/components/ui/card";
import { CheckCircle, Plug, Unplug, XCircle, Loader2, AlertCircle, CheckCircle2, Clock, Trophy, Gamepad2, BarChart3, Store as StoreIcon, ChevronDown, ExternalLink } from 'lucide-react';

import React, { useState, useEffect } from 'react';
import Image, { StaticImageData } from 'next/image';
import { useSession, signIn, signOut, isProviderConnected } from '@/lib/auth';
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

const storesConfig = [
  { id: 'steam', name: 'Steam', logoUrl: '/logos/steam.png', descKey: 'steamDesc' },
  { id: 'epic', name: 'Epic Games', logoUrl: '/logos/epic-games.png', descKey: 'epicDesc' },
  { id: 'ubisoft', name: 'Ubisoft Connect', logoUrl: '/logos/ubisoft-connect.png', descKey: 'ubisoftDesc' },
  { id: 'itchio', name: 'itch.io', logoUrl: '/logos/itch-io.png', descKey: 'itchioDesc' },
  { id: 'gog', name: 'GOG', logoUrl: '/logos/gog.png', descKey: 'gogDesc' },
  { id: 'origin', name: 'EA App / Origin', logoUrl: '/logos/ea-app.png', descKey: 'originDesc' },
  { id: 'battlenet', name: 'Battle.net', logoUrl: '/logos/battlenet.png', descKey: 'battlenetDesc' },
  { id: 'rockstar', name: 'Rockstar', logoUrl: '/logos/rockstar.png', descKey: 'rockstarDesc' },
  { id: 'xbox', name: 'Xbox Game Pass', logoUrl: '/logos/xbox.png', descKey: 'xboxDesc' },
  { id: 'amazon', name: 'Amazon Games', logoUrl: '/logos/amazon.png', descKey: 'amazonDesc' },
];

const utilityServicesConfig = [
  { id: 'howlongtobeat', name: 'HowLongToBeat', iconType: 'clock', descKey: 'howlongtobeatDesc' },
  { id: 'steamgriddb', name: 'SteamGridDB', iconType: 'gamepad', descKey: 'steamgriddbDesc' },
  { id: 'achievements', name: 'Achievements', iconType: 'trophy', descKey: 'achievementsDesc' },
  { id: 'playtime', name: 'Playtime Stats', iconType: 'chart', descKey: 'playtimeDesc' },
];

const connectableProviders = ['steam', 'epic', 'ubisoft', 'itchio', 'gog', 'origin', 'battlenet', 'rockstar', 'amazon'];
const autoDetectProviders = ['xbox'];
const connectableUtilities = ['howlongtobeat', 'steamgriddb', 'achievements', 'playtime'];

// Cache globale in-memory per evitare ri-detection ad ogni mount
const _g = globalThis as unknown as Record<string, unknown>;
if (!_g.__gsStoresCache) {
  _g.__gsStoresCache = {
    xboxDetected: null as boolean | null,
    amazonDetected: null as boolean | null,
    ubisoftConnected: false,
    detectionDone: false,
  };
}
const _storesCache = _g.__gsStoresCache;

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
      const hasProvider = (p: string) => existingAccounts.some((a: unknown) => a.provider === p);

      // Steam — credenziali salvate nel profilo attivo
      if (!hasProvider('steam-credentials')) {
        try {
          const creds = await invoke<unknown>('load_steam_credentials');
          if (creds && creds.steam_id && creds.steam_id.length > 0) {
            existingAccounts.push({ provider: 'steam-credentials', userId: creds.steam_id, steamId: creds.steam_id });
            changed = true;
            clientLogger.debug('[STORES] ✅ Steam credentials restored from backend:', creds.steam_id);
          }
        } catch { clientLogger.debug('[STORES] Steam: nessuna credenziale salvata'); }
      }

      // Epic — credenziali in file standalone
      if (!hasProvider('epicgames')) {
        try {
          const creds = await invoke<unknown>('load_epic_credentials');
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
          const creds = await invoke<unknown>('load_gog_credentials');
          if (creds && (creds.email || creds.username)) {
            existingAccounts.push({ provider: 'gog-credentials', userId: creds.username || 'gog-user' });
            changed = true;
            clientLogger.debug('[STORES] ✅ GOG credentials restored from backend:', creds.username);
          }
        } catch { clientLogger.debug('[STORES] GOG: nessuna credenziale salvata'); }
      }

      // Ubisoft
      if (!hasProvider('ubisoft-credentials')) {
        try {
          const creds = await invoke<unknown>('load_ubisoft_credentials');
          if (creds && creds.email) {
            existingAccounts.push({ provider: 'ubisoft-credentials', userId: creds.email });
            setUbisoftConnected(true);
            _storesCache.ubisoftConnected = true;
            changed = true;
            clientLogger.debug('[STORES] ✅ Ubisoft credentials restored from backend:', creds.email);
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
          const res = await invoke<unknown>('load_store_credentials', { store: 'origin' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'origin-credentials', userId: res.data.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ Origin credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] Origin: nessuna credenziale salvata'); }
      }

      // Battle.net — credenziali dal profilo Tauri
      if (!hasProvider('battlenet-credentials')) {
        try {
          const res = await invoke<unknown>('load_store_credentials', { store: 'battlenet' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'battlenet-credentials', userId: res.data.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ Battle.net credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] Battle.net: nessuna credenziale salvata'); }
      }

      // Rockstar — credenziali dal profilo Tauri
      if (!hasProvider('rockstar-credentials')) {
        try {
          const res = await invoke<unknown>('load_store_credentials', { store: 'rockstar' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'rockstar-credentials', userId: res.data.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ Rockstar credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] Rockstar: nessuna credenziale salvata'); }
      }

      // Amazon — credenziali dal profilo Tauri
      if (!hasProvider('amazon-credentials')) {
        try {
          const res = await invoke<unknown>('load_store_credentials', { store: 'amazon' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'amazon-credentials', userId: res.data.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ Amazon credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] Amazon: nessuna credenziale salvata'); }
      }

      // itch.io — credenziali dal profilo Tauri
      if (!hasProvider('itchio-credentials')) {
        try {
          const res = await invoke<unknown>('load_store_credentials', { store: 'itchio' });
          if (res?.success && res?.data?.username) {
            existingAccounts.push({ provider: 'itchio-credentials', userId: res.data.username });
            changed = true;
            clientLogger.debug('[STORES] ✅ itch.io credentials restored from Tauri profile');
          }
        } catch { clientLogger.debug('[STORES] itch.io: nessuna credenziale salvata'); }
      }

      if (changed) {
        localStorage.setItem('gameStringer_connectedAccounts', JSON.stringify(existingAccounts));
        clientLogger.debug('[STORES] 🔄 connectedAccounts aggiornati:', existingAccounts.length, 'provider');
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
  const [testResults, setTestResults] = useState<{ [key: string]: unknown }>({});
  const [xboxDetected, setXboxDetected] = useState<boolean | null>(_storesCache.xboxDetected);
  const [amazonDetected, setAmazonDetected] = useState<boolean | null>(_storesCache.amazonDetected);
  
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
  }, []);
  
  // Utility services state
  const [utilityPreferences, setUtilityPreferences] = useState<{ [key: string]: unknown }>({});
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
    if (['howlongtobeat', 'steamgriddb', 'achievements', 'playtime'].includes(providerId)) {
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

    // Amazon: auto-detect O credenziali
    if (providerId === 'amazon') {
      return amazonDetected === true || isProviderConnected('amazon-credentials');
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
      clientLogger.error('Error loading utility preferences:', error);
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
        toast.success('HowLongToBeat attivato! Le informazioni sui tempi di gioco verranno mostrate automaticamente.');
      } else if (utilityId === 'achievements') {
        const newPrefs = { ...utilityPreferences, [utilityId]: { enabled: true } };
        localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
        setUtilityPreferences(newPrefs);
        toast.success('Achievement Tracker attivato!');
      } else if (utilityId === 'playtime') {
        const newPrefs = { ...utilityPreferences, [utilityId]: { enabled: true } };
        localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
        setUtilityPreferences(newPrefs);
        toast.success('Playtime Stats attivato!');
      } else if (utilityId === 'steamgriddb') {
        setIsSteamGridDBModalOpen(true);
        setLoadingProvider(null);
        return;
      }
    } catch {
      toast.error(`Errore durante l'attivazione di ${utilityId}`);
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
      toast.success(`${utilityId} disattivato con successo.`);
    } catch {
      toast.error(`Errore durante la disattivazione di ${utilityId}`);
    }
    
    setLoadingProvider(null);
  };

  const handleConnect = async (providerId: string) => {
    setLoadingProvider(providerId);
    const _userId = session?.user?.id;

    // Handle OAuth providers
    if (providerId === 'epic') {
      try {
        await signIn('epicgames', { callbackUrl: '/stores' });
      } catch (error: unknown) {
        clientLogger.error('Epic Games auth error:', error);
        toast.error('error durante la connection con Epic Games. Verifica le Credentials OAuth.');
        setLoadingProvider(null);
      }
      return;
    }

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

    if (['gog', 'origin', 'battlenet', 'rockstar', 'amazon'].includes(providerId)) {
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
      // Cancella Credentials dal backend Tauri per Ubisoft
      if (providerId === 'ubisoft') {
        await invoke('clear_ubisoft_credentials');
        setUbisoftConnected(false);
        clientLogger.debug('[UBISOFT] Credentials cancellate dal backend');
      }

      // Cancella credenziali dal profilo Tauri per store generici
      const tauriStores = ['origin', 'battlenet', 'rockstar', 'amazon', 'itchio', 'gog'];
      if (tauriStores.includes(providerId)) {
        try {
          await invoke('save_store_credentials', { store: providerId, username: '', password: '' });
          clientLogger.debug(`[STORES] 🗑️ Credenziali ${providerId} cancellate dal profilo Tauri`);
        } catch (e: unknown) {
          clientLogger.warn(`[STORES] ⚠️ Impossibile cancellare ${providerId} da Tauri:`, e);
        }
      }
      
      const response = await fetch('/api/auth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-GS-Client': 'gamestringer' },
        body: JSON.stringify({ providerId: backendProviderId }),
      });

      if (response.ok) {
        toast.success(`Account ${providerId} scollegato.`);
        
        // Aggiorna stato locale
        if (providerId === 'steam') {
          await signOut('steam-credentials');
        } else if (providerId === 'ubisoft') {
          await signOut('ubisoft-credentials');
        }
        
        await update();
      } else {
        const result = await response.json();
        toast.error(`error durante la disconnection: ${result.error}`);
      }
    } catch (error: unknown) {
      clientLogger.error('Disconnect error:', error);
      toast.error(error?.message || 'error durante la disconnection');
    }
    setLoadingProvider(null);
  };

  const handleUbisoftLogin = async (email: string, password: string, twoFactorCode?: string) => {
    if (!email || !password) {
      toast.error('Per favore, inserisci sia email che password.');
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
        userId: session?.user.id,
      });

      if (result?.error) {
        toast.error(result.error || 'error durante la connection con Ubisoft.');
      } else {
        setUbisoftConnected(true);
        toast.success(backendResult || 'Account Ubisoft collegato con successo!');
        setIsUbisoftModalOpen(false);
        setUbisoftCredentials({ email: '', password: '' });
        await update();
      }
    } catch (error: unknown) {
      clientLogger.error('Ubisoft auth error:', error);
      toast.error(error?.message || error || 'error durante la connection con Ubisoft. Verifica le Credentials.');
    }
    setLoadingProvider(null);
  };

  const handleGenericLogin = async (email: string, password: string, twoFactorCode?: string) => {
    if (!email || !password) {
      toast.error('Per favore, inserisci sia email che password.');
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
        clientLogger.warn(`[STORES] ⚠️ Fallback: impossibile salvare ${genericModalProvider} in Tauri:`, tauriErr);
      }

      // 2. Salva anche in session/localStorage per il frontend
      const backendProviderId = providerMap[genericModalProvider] || `${genericModalProvider}-credentials`;
      const result = await signIn(backendProviderId, {
        redirect: false,
        email,
        password,
        twoFactorCode,
        userId: session?.user.id,
      });

      if (result?.error) {
        // Se GOG richiede 2FA, l'error dovrebbe indicarlo
        if (genericModalProvider === 'gog' && result.error.includes('2FA')) {
          toast.error('Per favore inserisci il codice 2FA');
          // La modale gestirà la richiesta del codice 2FA
        } else {
          toast.error(result.error || `error durante la connection con ${genericModalProvider}.`);
        }
      } else {
        toast.success(`Account ${genericModalProvider} collegato con successo!`);
        setGenericModalProvider(null);
        setGenericCredentials({ email: '', password: '' });
        await update();
      }
    } catch (error: unknown) {
      clientLogger.error(`${genericModalProvider} auth error:`, error);
      toast.error(`error durante la connection con ${genericModalProvider}.`);
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
      toast.error(result.error || 'error durante la connection con Steam.');
      throw new Error(result.error);
    } else {
      toast.success('Account Steam collegato con successo!');
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
        clientLogger.warn('[STORES] ⚠️ Fallback: impossibile salvare itch.io in Tauri:', tauriErr);
      }

      const result = await signIn('itchio-credentials', {
        accessToken: apiKey,
        userId: session?.user?.id,
        redirect: false,
      });
      
      if (result?.error) {
        throw new Error(result.error);
      } else if (result?.ok) {
        toast.success('Account itch.io collegato con successo!');
        await update();
      }
    } catch (error: unknown) {
      toast.error('error durante la connection con itch.io');
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
        // Test HowLongToBeat - fetch diretto (no API route)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const _response = await fetch('https://howlongtobeat.com', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        // mode: no-cors returns opaque response (status 0) but means site is reachable
        setTestResults(prev => ({ ...prev, [utilityId]: { connected: true } }));
        toast.success('HowLongToBeat raggiungibile!');
      } else if (utilityId === 'steamgriddb') {
        // Test SteamGridDB API via Tauri command (no CORS)
        const apiKey = utilityPreferences[utilityId]?.apiKey;
        if (!apiKey) {
          throw new Error('API key mancante');
        }
        
        const _result = await invoke<string | null>('fetch_steamgriddb_image', {
          appId: 292030,
          gameName: 'The Witcher 3',
          apiKey: apiKey,
        });
        // If no error thrown, the API key works
        setTestResults(prev => ({ ...prev, [utilityId]: { connected: true } }));
        toast.success('SteamGridDB funziona correttamente!');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Test fallito';
      if (error instanceof DOMException && error.name === 'AbortError') {
        setTestResults(prev => ({ ...prev, [utilityId]: { error: 'Timeout - servizio non raggiungibile' } }));
        toast.error(`${utilityId}: Timeout connessione`);
      } else {
        setTestResults(prev => ({ ...prev, [utilityId]: { error: msg } }));
        toast.error(`Problema con ${utilityId}: ${msg}`);
      }
    }
    
    setTestingProvider(null);
  };

  const testConnection = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const backendProviderId = getBackendProviderId(providerId);
      const response = await fetch('/api/stores/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-GS-Client': 'gamestringer' },
        body: JSON.stringify({ provider: backendProviderId }),
      });
      
      const result = await response.json();
      setTestResults(prev => ({ ...prev, [providerId]: result }));
      
      if (result.connected) {
        toast.success(`connection ${providerId} verificata!`);
      } else {
        toast.error(`Problema con ${providerId}: ${result.error || 'connection non riuscita'}`);
      }
    } catch {
      toast.error(`error nel test di ${providerId}`);
      setTestResults(prev => ({ ...prev, [providerId]: { error: 'Test fallito' } }));
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
          return isConnected(s.id);
        }).length;
        const activeUtilities = utilityServicesConfig.filter(s => isConnected(s.id)).length;
        return (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${connectedStores > 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-300">
                <span className="font-semibold text-white">{connectedStores}</span>/{storesConfig.length} store
              </span>
            </div>
            <div className="h-3 w-px bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${activeUtilities > 0 ? 'bg-orange-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-300">
                <span className="font-semibold text-white">{activeUtilities}</span>/{utilityServicesConfig.length} servizi
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
          const xboxActive = store.id === 'xbox' && xboxDetected === true;
          const amazonActive = store.id === 'amazon' && amazonDetected === true;
          const connected = store.id === 'xbox' ? xboxActive
            : isConnected(store.id);
          const isDetecting = (store.id === 'xbox' && xboxDetected === null);

          const autoDetectStatus = store.id === 'xbox'
            ? (xboxDetected === null ? 'Detecting...' : xboxDetected ? 'Xbox App / Game Pass detected' : 'Xbox App not found')
            : store.id === 'amazon' && amazonActive
            ? 'Amazon Games detected'
            : null;

          const autoDetectCommand = store.id === 'xbox' ? 'test_xbox_connection'
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
                    {autoDetectStatus ?? t(`stores.${store.descKey}`)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
              {connected ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-7 text-2xs"
                      disabled={isLoading || currentLoading}
                      onClick={() => handleDisconnect(store.id)}
                    >
                      {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Unplug className="h-3 w-3 mr-1" />}
                      {t('stores.disconnect')}
                    </Button>
                    {store.id === 'steam' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-2xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                        onClick={() => setIsFamilySharingOpen(true)}
                        title="Family Sharing"
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
                        title="Apri GOG.com"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={testingProvider === store.id}
                      onClick={() => testConnection(store.id)}
                      title="Test"
                    >
                      {testingProvider === store.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : testResults[store.id]?.connected ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                    </Button>
                  </>
                ) : isConnectable ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-2xs border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                      disabled={isLoading || currentLoading}
                      onClick={() => handleConnect(store.id)}
                    >
                      {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Plug className="h-3 w-3 mr-1" />}
                      {t('stores.connect')}
                    </Button>
                    {store.id === 'gog' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-2xs border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                          onClick={() => shellOpen('https://www.gog.com/en/games').catch(() => window.open('https://www.gog.com/en/games', '_blank'))}
                          title="GOG Store"
                        >
                          <StoreIcon className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-2xs border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                          onClick={() => shellOpen('https://www.gog.com/galaxy').catch(() => window.open('https://www.gog.com/galaxy', '_blank'))}
                          title="Scarica GOG Galaxy"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </>
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
                  title={`Test ${store.name} detection`}
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
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 h-7 text-2xs"
                    disabled={isLoading || currentLoading}
                    onClick={() => handleDisconnectUtility(service.id)}
                  >
                    {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Unplug className="h-3 w-3 mr-1" />}
                    {t('stores.deactivate')}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={testingProvider === service.id}
                    onClick={() => testConnectionUtility(service.id)}
                    title="Test"
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
            Inserisci la tua API key di SteamGridDB per scaricare automaticamente le copertine dei giochi.
          </p>
          <a 
            href="https://www.steamgriddb.com/profile/preferences/api" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm underline"
          >
            Ottieni la tua API Key qui →
          </a>
          <Input
            placeholder="API Key"
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
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (steamGridDBApiKey.trim()) {
                  const newPrefs = { ...utilityPreferences, steamgriddb: { enabled: true, apiKey: steamGridDBApiKey.trim() } };
                  localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
                  setUtilityPreferences(newPrefs);
                  toast.success('SteamGridDB collegato con successo!');
                  setIsSteamGridDBModalOpen(false);
                  setSteamGridDBApiKey('');
                } else {
                  toast.error('Inserisci una API Key valida');
                }
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Conferma
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}


