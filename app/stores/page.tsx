'use client';

import { useTranslation } from '@/lib/i18n';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Plug, Unplug, XCircle, Loader2, AlertCircle, CheckCircle2, Clock, Trophy, Gamepad2, BarChart3, Store as StoreIcon, ChevronDown, ExternalLink } from 'lucide-react';

import React, { useState, useEffect } from 'react';
import Image, { StaticImageData } from 'next/image';
import { useSession, signIn, signOut, isProviderConnected, getConnectedAccount } from '@/lib/auth';
import { toast } from 'react-hot-toast';
import { invoke } from '@/lib/tauri-api';
import { ItchioModal } from '@/components/modals/itchio-modal';
import { GenericCredentialsModal } from '@/components/modals/generic-credentials-modal';
import { SteamModal } from '@/components/modals/steam-modal';
import { SteamFamilySharing } from '@/components/steam-family-sharing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { open as shellOpen } from '@tauri-apps/plugin-shell';

// Define a type for the store object for better type safety
type Store = {
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
];

const utilityServicesConfig = [
  { id: 'howlongtobeat', name: 'HowLongToBeat', iconType: 'clock', descKey: 'howlongtobeatDesc' },
  { id: 'steamgriddb', name: 'SteamGridDB', iconType: 'gamepad', descKey: 'steamgriddbDesc' },
  { id: 'achievements', name: 'Achievements', iconType: 'trophy', descKey: 'achievementsDesc' },
  { id: 'playtime', name: 'Playtime Stats', iconType: 'chart', descKey: 'playtimeDesc' },
];

const connectableProviders = ['steam', 'epic', 'ubisoft', 'itchio', 'gog', 'origin', 'battlenet'];
const connectableUtilities = ['howlongtobeat', 'steamgriddb', 'achievements', 'playtime'];

export default function StoresPage() {
  const { t } = useTranslation();
  // Gestione auth locale con persistenza
  const { data: session, status, update } = useSession();
  const isLoading = status === 'loading';
  
  // Aggiorna la sessione quando cambia la pagina
  useEffect(() => {
    update();
  }, []);

  // Carica Credentials Ubisoft dal backend Tauri all'avvio
  useEffect(() => {
    const loadUbisoftCredentials = async () => {
      try {
        const credentials = await invoke<any>('load_ubisoft_credentials');
        if (credentials && credentials.email) {
          console.log('[UBISOFT] Credentials loaded dal backend:', credentials.email);
          setUbisoftConnected(true);
        }
      } catch (error) {
        console.log('[UBISOFT] Nessuna credenziale salvata');
        setUbisoftConnected(false);
      }
    };
    loadUbisoftCredentials();
  }, []);

  // State for UI elements and forms
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [ubisoftConnected, setUbisoftConnected] = useState(false);
  
  const [steamId, setSteamId] = useState('');
  const [fixMessage, setFixMessage] = useState('');

  // State for Steam ID modal
  const [isSteamModalOpen, setIsSteamModalOpen] = useState(false);

  const [ubisoftCredentials, setUbisoftCredentials] = useState({ email: '', password: '' });
  const [isUbisoftModalOpen, setIsUbisoftModalOpen] = useState(false);

  // State for itch.io modal
  const [isItchioModalOpen, setIsItchioModalOpen] = useState(false);

  // Generic credentials state for new providers
  const [genericCredentials, setGenericCredentials] = useState({ email: '', password: '' });
  const [genericModalProvider, setGenericModalProvider] = useState<string | null>(null);
  
  // Test connection state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: any }>({});
  
  // Utility services state
  const [utilityPreferences, setUtilityPreferences] = useState<{ [key: string]: any }>({});
  const [utilityExpanded, setUtilityExpanded] = useState(false);
  
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
    
    // Check for other store providers
    if (!session?.user?.accounts) return false;
    const backendProviderId = providerMap[providerId] || providerId;
    return session.user.accounts.some((acc: any) => acc.provider === backendProviderId);
  };

  const getBackendProviderId = (frontendId: string) => {
    return providerMap[frontendId] || frontendId;
  };

  const handleFixSteamId = async () => {
    if (!steamId.trim()) {
      toast.error('Per favore, inserisci uno SteamID.');
      return;
    }
    setLoadingProvider('steam-fix');
    setFixMessage('Correzione in corso...');
    const response = await fetch('/api/steam/fix-steamid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correctSteamId: steamId }),
    });
    const result = await response.json();
    if (response.ok) {
      toast.success('SteamID corretto con successo!');
      setFixMessage('');
      await update();
    } else {
      toast.error(`Error: ${result.error}`);
      setFixMessage(`Error: ${result.error}`);
    }
    setLoadingProvider(null);
  };

  // Load utility preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('gamestringer_utility_prefs');
      if (stored) {
        setUtilityPreferences(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading utility preferences:', error);
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
    } catch (error) {
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
    } catch (error) {
      toast.error(`Errore durante la disattivazione di ${utilityId}`);
    }
    
    setLoadingProvider(null);
  };

  const handleConnect = async (providerId: string) => {
    setLoadingProvider(providerId);
    const userId = session?.user?.id;

    // Handle OAuth providers
    if (providerId === 'epic') {
      try {
        await signIn('epicgames', { callbackUrl: '/stores' });
      } catch (error) {
        console.error('Epic Games auth error:', error);
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

    if (['gog', 'origin', 'battlenet'].includes(providerId)) {
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
        console.log('[UBISOFT] Credentials cancellate dal backend');
      }
      
      const response = await fetch('/api/auth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    } catch (error: any) {
      console.error('Disconnect error:', error);
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
      console.log('[UBISOFT] Backend result:', backendResult);
      
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
    } catch (error: any) {
      console.error('Ubisoft auth error:', error);
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
    } catch (error) {
      console.error(`${genericModalProvider} auth error:`, error);
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
    } catch (error) {
      toast.error('error durante la connection con itch.io');
      throw error;
    } finally {
      setLoadingProvider(null);
    }
  };

  const steamAccount = session?.user?.accounts?.find(acc => acc.provider === 'steam-credentials');
  // Do not show l'avviso se Steam è collegato correttamente tramite il nuovo sistema auth
  const isSteamIdInvalid = false; // Disabilitato: Steam funziona correttamente con il nuovo sistema auth

  const testConnectionUtility = async (utilityId: string) => {
    setTestingProvider(utilityId);
    
    try {
      if (utilityId === 'howlongtobeat') {
        // Test HowLongToBeat - fetch diretto (no API route)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch('https://howlongtobeat.com', {
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
        
        const result = await invoke<string | null>('fetch_steamgriddb_image', {
          appId: 292030,
          gameName: 'The Witcher 3',
          apiKey: apiKey,
        });
        // If no error thrown, the API key works
        setTestResults(prev => ({ ...prev, [utilityId]: { connected: true } }));
        toast.success('SteamGridDB funziona correttamente!');
      }
    } catch (error) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: backendProviderId }),
      });
      
      const result = await response.json();
      setTestResults(prev => ({ ...prev, [providerId]: result }));
      
      if (result.connected) {
        toast.success(`connection ${providerId} verificata!`);
      } else {
        toast.error(`Problema con ${providerId}: ${result.error || 'connection non riuscita'}`);
      }
    } catch (error) {
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
            <p className="text-white/70 text-[9px]">{t('stores.subtitle')}</p>
          </div>
        </div>
      </div>

      {isSteamIdInvalid && (
        <Card className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardHeader>
            <CardTitle className="text-yellow-700 dark:text-yellow-400">Azione Richiesta: Correggi il tuo SteamID</CardTitle>
            <CardDescription>
              Abbiamo rilevato che il tuo SteamID potrebbe non essere corretto. Per risolvere il problema della scansione dei games, per favore inserisci il tuo <strong>SteamID numerico a 17 cifre</strong> qui sotto e clicca su "Correggi".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                placeholder="Es: 76561198..."
                value={steamId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSteamId(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={handleFixSteamId} disabled={loadingProvider === 'steam-fix'}>
                {loadingProvider === 'steam-fix' ? <Loader2 className="animate-spin mr-2" /> : null}
                Correggi SteamID
              </Button>
            </div>
            {fixMessage && <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">{fixMessage}</p>}
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {storesConfig.map((store) => {
          const connected = isConnected(store.id);
          const isConnectable = connectableProviders.includes(store.id);
          const currentLoading = loadingProvider === store.id;

          return (
            <Card key={store.id} className="p-1.5 card-hover">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="relative h-6 w-6 flex items-center justify-center flex-shrink-0">
                  {store.logoUrl ? (
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
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground line-clamp-1">{t(`stores.${store.descKey}`)}</p>
                </div>
              </div>
              <div className="flex gap-1">
              {connected ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-7 text-[10px]"
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
                        className="h-7 px-2 text-[10px] border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
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
                        className="h-7 px-2 text-[10px] border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
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
                      className="flex-1 h-7 text-[10px] border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
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
                          className="h-7 px-2 text-[10px] border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                          onClick={() => shellOpen('https://www.gog.com/en/games').catch(() => window.open('https://www.gog.com/en/games', '_blank'))}
                          title="GOG Store"
                        >
                          <StoreIcon className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[10px] border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
                          onClick={() => shellOpen('https://www.gog.com/galaxy').catch(() => window.open('https://www.gog.com/galaxy', '_blank'))}
                          title="Scarica GOG Galaxy"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] border-orange-500/30 text-orange-300/50" disabled={true}>
                    {t('stores.notAvailable')}
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
            <DialogTitle>Family Sharing</DialogTitle>
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
        <p className="text-muted-foreground text-[10px] mb-0.5">
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
                  <p className="text-[9px] text-muted-foreground line-clamp-1">{t(`stores.${service.descKey}`)}</p>
                </div>
              </div>
              <div className="flex gap-1">
                    {connected ? (
                      <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 h-7 text-[10px]"
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
                  className="flex-1 h-7 text-[10px] border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                  disabled={isLoading || currentLoading}
                  onClick={() => handleConnectUtility(service.id)}
                >
                  {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Plug className="h-3 w-3 mr-1" />}
                  {t('stores.activate')}
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] border-orange-500/30 text-orange-300/50" disabled={true}>
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
      {isSteamGridDBModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-orange-500/50 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">SteamGridDB API Key</h3>
            <p className="text-sm text-slate-400 mb-4">
              Inserisci la tua API key di SteamGridDB per scaricare automaticamente le copertine dei giochi.
            </p>
            <a 
              href="https://www.steamgriddb.com/profile/preferences/api" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm mb-4 underline"
            >
              Ottieni la tua API Key qui →
            </a>
            <Input
              placeholder="API Key"
              value={steamGridDBApiKey}
              onChange={(e) => setSteamGridDBApiKey(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSteamGridDBModalOpen(false);
                  setSteamGridDBApiKey('');
                }}
                className="border-slate-600 text-slate-300"
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
          </div>
        </div>
      )}

    </div>
  );
}


