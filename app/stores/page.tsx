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
import { CheckCircle, Plug, Unplug, XCircle, Loader2, AlertCircle, CheckCircle2, Clock, Trophy, Gamepad2, BarChart3, Store as StoreIcon, ChevronDown } from 'lucide-react';

import React, { useState, useEffect } from 'react';
import Image, { StaticImageData } from 'next/image';
import { useSession, signIn, signOut, isProviderConnected, getConnectedAccount } from '@/lib/auth';
import { toast } from 'react-hot-toast';
import { invoke } from '@/lib/tauri-api';
import { ItchioModal } from '@/components/modals/itchio-modal';
import { GenericCredentialsModal } from '@/components/modals/generic-credentials-modal';
import { SteamModal } from '@/components/modals/steam-modal';

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
        const apiKey = prompt('Inserisci la tua API key di SteamGridDB (ottienila da https://www.steamgriddb.com/profile/preferences/api):');
        if (apiKey) {
          const newPrefs = { ...utilityPreferences, [utilityId]: { enabled: true, apiKey } };
          localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
          setUtilityPreferences(newPrefs);
          toast.success('SteamGridDB collegato con successo!');
        }
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
        // Test HowLongToBeat API
        const response = await fetch('/api/utilities/howlongtobeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ search: 'The Witcher 3' }),
        });
        
        if (response.ok) {
          setTestResults(prev => ({ ...prev, [utilityId]: { connected: true } }));
          toast.success('HowLongToBeat funziona correttamente!');
        } else {
          throw new Error('API test failed');
        }
      } else if (utilityId === 'steamgriddb') {
        // Test SteamGridDB API
        const apiKey = utilityPreferences[utilityId]?.apiKey;
        if (!apiKey) {
          throw new Error('API key mancante');
        }
        
        const response = await fetch('/api/utilities/steamgriddb?search=The Witcher 3', {
          headers: { 'X-API-Key': apiKey },
        });
        
        if (response.ok) {
          setTestResults(prev => ({ ...prev, [utilityId]: { connected: true } }));
          toast.success('SteamGridDB funziona correttamente!');
        } else {
          throw new Error('API test failed');
        }
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [utilityId]: { error: error instanceof Error ? error.message : 'Test fallito' } }));
      toast.error(`Problema con ${utilityId}: ${error instanceof Error ? error.message : 'Test fallito'}`);
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
    <div className="p-3 space-y-2 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 p-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black/30 rounded-lg shadow-lg shadow-black/40 border border-white/10">
              <StoreIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{t('stores.title')}</h1>
              <p className="text-white/70 text-[10px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{t('stores.subtitle')}</p>
            </div>
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {storesConfig.map((store) => {
          const connected = isConnected(store.id);
          const isConnectable = connectableProviders.includes(store.id);
          const currentLoading = loadingProvider === store.id;

          return (
            <Card key={store.id} className="p-2 card-hover">
              <div className="flex items-center gap-2 mb-1">
                <div className="relative h-8 w-8 flex items-center justify-center flex-shrink-0">
                  {store.logoUrl ? (
                    <Image
                      src={store.logoUrl}
                      alt={`${store.name} logo`}
                      width={32}
                      height={32}
                      style={{ objectFit: 'contain' }}
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{store.name}</span>
                    {connected ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{t(`stores.${store.descKey}`)}</p>
                </div>
              </div>
              <div className="flex gap-2">
              {connected ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-8 text-xs"
                      disabled={isLoading || currentLoading}
                      onClick={() => handleDisconnect(store.id)}
                    >
                      {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Unplug className="h-3 w-3 mr-1" />}
                      {t('stores.disconnect')}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                    disabled={isLoading || currentLoading}
                    onClick={() => handleConnect(store.id)}
                  >
                    {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Plug className="h-3 w-3 mr-1" />}
                    {t('stores.connect')}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-orange-500/30 text-orange-300/50" disabled={true}>
                    {t('stores.notAvailable')}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Ubisoft modal removed - now using GenericCredentialsModal */}


      {/* Steam modal removed - now using a dedicated Steam modal component */}

      {/* Generic modal removed - now using GenericCredentialsModal */}

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
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors"
        >
          <span className="text-sm font-medium text-slate-300">{t('stores.utilityServices')}</span>
          <span className={utilityExpanded ? '' : 'inline-block animate-bounce'}><ChevronDown className={`h-5 w-5 text-orange-400 transition-transform ${utilityExpanded ? 'rotate-180' : ''}`} /></span>
        </button>
        
        {utilityExpanded && (
        <div id="utility-section" className="mt-2">
        <p className="text-muted-foreground text-[10px] mb-1">
          {t('stores.utilityServicesDesc')}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {utilityServicesConfig.map((service) => {
            const connected = isConnected(service.id);
            const isConnectable = connectableUtilities.includes(service.id);
            const currentLoading = loadingProvider === service.id;

            return (
              <Card key={service.id} className="p-2 card-hover">
              <div className="flex items-center gap-2 mb-1">
                <div className="relative h-6 w-6 flex items-center justify-center flex-shrink-0">
                  {service.iconType === 'clock' && <Clock className="h-5 w-5 text-blue-500" />}
                  {service.iconType === 'gamepad' && <Gamepad2 className="h-5 w-5 text-orange-500" />}
                  {service.iconType === 'trophy' && <Trophy className="h-5 w-5 text-yellow-500" />}
                  {service.iconType === 'chart' && <BarChart3 className="h-5 w-5 text-green-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{service.name}</span>
                    {connected ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{t(`stores.${service.descKey}`)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                    {connected ? (
                      <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 h-8 text-xs"
                    disabled={isLoading || currentLoading}
                    onClick={() => handleDisconnectUtility(service.id)}
                  >
                    {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Unplug className="h-3 w-3 mr-1" />}
                    {t('stores.deactivate')}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
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
                  className="flex-1 h-8 text-xs border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400"
                  disabled={isLoading || currentLoading}
                  onClick={() => handleConnectUtility(service.id)}
                >
                  {currentLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Plug className="h-3 w-3 mr-1" />}
                  {t('stores.activate')}
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-orange-500/30 text-orange-300/50" disabled={true}>
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

    </div>
  );
}


