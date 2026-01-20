'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Plug, Unplug, XCircle, Loader2, AlertCircle, CheckCircle2, Clock, Trophy, Gamepad2, BarChart3 } from 'lucide-react';

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

const stores: Store[] = [
  { id: 'steam', name: 'Steam', logoUrl: '/logos/steam.png', description: 'Collega il tuo account Steam per importare i tuoi giochi.' },
  { id: 'epic', name: 'Epic Games', logoUrl: '/logos/epic-games.png', description: 'Collega il tuo account Epic Games per importare i tuoi giochi.' },
  { id: 'ubisoft', name: 'Ubisoft Connect', logoUrl: '/logos/ubisoft-connect.png', description: 'Collega il tuo account Ubisoft Connect per importare i tuoi giochi.' },
  { id: 'itchio', name: 'itch.io', logoUrl: '/logos/itch-io.png', description: 'Collega il tuo account itch.io per importare i tuoi giochi.' },
  { id: 'gog', name: 'GOG', logoUrl: '/logos/gog.png', description: 'Collega il tuo account GOG per importare i tuoi giochi.' },
  { id: 'origin', name: 'EA App / Origin', logoUrl: '/logos/ea-app.png', description: 'Collega il tuo account EA per importare i tuoi giochi.' },
  { id: 'battlenet', name: 'Battle.net', logoUrl: '/logos/battlenet.png', description: 'Collega il tuo account Battle.net per importare i tuoi giochi.' },
  { id: 'rockstar', name: 'Rockstar', logoUrl: '/logos/rockstar.png', description: 'La connessione con Rockstar non è ancora supportata.' },
];

const utilityServices: Store[] = [
  {
    id: 'howlongtobeat',
    name: 'HowLongToBeat',
    icon: <Clock className="h-12 w-12 text-blue-500" />,
    description: 'Ottieni informazioni sui tempi di completamento dei tuoi giochi.'
  },
  {
    id: 'steamgriddb',
    name: 'SteamGridDB',
    icon: <Gamepad2 className="h-12 w-12 text-purple-500" />,
    description: 'Scarica artwork e copertine personalizzate per i tuoi giochi.'
  },
  {
    id: 'achievements',
    name: 'Achievement Tracker',
    icon: <Trophy className="h-12 w-12 text-yellow-500" />,
    description: 'Traccia i tuoi achievement e trofei su tutte le piattaforme.'
  },
  {
    id: 'playtime',
    name: 'Playtime Stats',
    icon: <BarChart3 className="h-12 w-12 text-green-500" />,
    description: 'Analizza le tue statistiche di gioco aggregate.'
  },
];

const connectableProviders = ['steam', 'epic', 'ubisoft', 'itchio', 'gog', 'origin', 'battlenet'];
const connectableUtilities = ['howlongtobeat', 'steamgriddb'];

export default function StoresPage() {
  // Gestione auth locale con persistenza
  const { data: session, status, update } = useSession();
  const isLoading = status === 'loading';
  
  // Aggiorna la sessione quando cambia la pagina
  useEffect(() => {
    update();
  }, []);

  // Carica credenziali Ubisoft dal backend Tauri all'avvio
  useEffect(() => {
    const loadUbisoftCredentials = async () => {
      try {
        const credentials = await invoke<any>('load_ubisoft_credentials');
        if (credentials && credentials.email) {
          console.log('[UBISOFT] Credenziali caricate dal backend:', credentials.email);
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

  // Load utility preferences on mount
  useEffect(() => {
    const loadUtilityPreferences = async () => {
      if (!session?.user?.id) return;
      
      try {
        const response = await fetch('/api/utilities/preferences');
        if (response.ok) {
          const prefs = await response.json();
          setUtilityPreferences(prefs);
        }
      } catch (error) {
        console.error('Error loading utility preferences:', error);
      }
    };
    
    loadUtilityPreferences();
  }, [session]);

  const handleConnectUtility = async (utilityId: string) => {
    setLoadingProvider(utilityId);
    
    try {
      if (utilityId === 'howlongtobeat') {
        // HowLongToBeat doesn't require authentication, just enable it
        const response = await fetch('/api/utilities/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: utilityId, enabled: true }),
        });
        
        if (response.ok) {
          toast.success('HowLongToBeat attivato! Le informazioni sui tempi di gioco verranno mostrate automaticamente.');
          setUtilityPreferences(prev => ({ ...prev, [utilityId]: { enabled: true } }));
        } else {
          throw new Error('Failed to save preference');
        }
      } else if (utilityId === 'steamgriddb') {
        const apiKey = prompt('Inserisci la tua API key di SteamGridDB (ottienila da https://www.steamgriddb.com/profile/preferences/api):');
        if (apiKey) {
          const response = await fetch('/api/utilities/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: utilityId, enabled: true, apiKey }),
          });
          
          if (response.ok) {
            toast.success('SteamGridDB collegato con successo!');
            setUtilityPreferences(prev => ({ ...prev, [utilityId]: { enabled: true, apiKey } }));
          } else {
            throw new Error('Failed to save API key');
          }
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
      const response = await fetch(`/api/utilities/preferences?service=${utilityId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success(`${utilityId} disattivato con successo.`);
        setUtilityPreferences(prev => {
          const newPrefs = { ...prev };
          delete newPrefs[utilityId];
          return newPrefs;
        });
      } else {
        throw new Error('Failed to delete preference');
      }
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
        toast.error('Errore durante la connessione con Epic Games. Verifica le credenziali OAuth.');
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
      // Cancella credenziali dal backend Tauri per Ubisoft
      if (providerId === 'ubisoft') {
        await invoke('clear_ubisoft_credentials');
        setUbisoftConnected(false);
        console.log('[UBISOFT] Credenziali cancellate dal backend');
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
        toast.error(`Errore durante la disconnessione: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast.error(error?.message || 'Errore durante la disconnessione');
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
      // Chiama il backend Tauri per autenticare e salvare le credenziali criptate
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
        toast.error(result.error || 'Errore durante la connessione con Ubisoft.');
      } else {
        setUbisoftConnected(true);
        toast.success(backendResult || 'Account Ubisoft collegato con successo!');
        setIsUbisoftModalOpen(false);
        setUbisoftCredentials({ email: '', password: '' });
        await update();
      }
    } catch (error: any) {
      console.error('Ubisoft auth error:', error);
      toast.error(error?.message || error || 'Errore durante la connessione con Ubisoft. Verifica le credenziali.');
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
        // Se GOG richiede 2FA, l'errore dovrebbe indicarlo
        if (genericModalProvider === 'gog' && result.error.includes('2FA')) {
          toast.error('Per favore inserisci il codice 2FA');
          // La modale gestirà la richiesta del codice 2FA
        } else {
          toast.error(result.error || `Errore durante la connessione con ${genericModalProvider}.`);
        }
      } else {
        toast.success(`Account ${genericModalProvider} collegato con successo!`);
        setGenericModalProvider(null);
        setGenericCredentials({ email: '', password: '' });
        await update();
      }
    } catch (error) {
      console.error(`${genericModalProvider} auth error:`, error);
      toast.error(`Errore durante la connessione con ${genericModalProvider}.`);
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
      toast.error(result.error || 'Errore durante la connessione con Steam.');
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
      toast.error('Errore durante la connessione con itch.io');
      throw error;
    } finally {
      setLoadingProvider(null);
    }
  };

  const steamAccount = session?.user?.accounts?.find(acc => acc.provider === 'steam-credentials');
  // Non mostrare l'avviso se Steam è collegato correttamente tramite il nuovo sistema auth
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
        toast.success(`Connessione ${providerId} verificata!`);
      } else {
        toast.error(`Problema con ${providerId}: ${result.error || 'Connessione non riuscita'}`);
      }
    } catch (error) {
      toast.error(`Errore nel test di ${providerId}`);
      setTestResults(prev => ({ ...prev, [providerId]: { error: 'Test fallito' } }));
    }
    setTestingProvider(null);
  };

  return (
    <div className="p-6">
      {isSteamIdInvalid && (
        <Card className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
          <CardHeader>
            <CardTitle className="text-yellow-700 dark:text-yellow-400">Azione Richiesta: Correggi il tuo SteamID</CardTitle>
            <CardDescription>
              Abbiamo rilevato che il tuo SteamID potrebbe non essere corretto. Per risolvere il problema della scansione dei giochi, per favore inserisci il tuo <strong>SteamID numerico a 17 cifre</strong> qui sotto e clicca su "Correggi".
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Connessioni Store</h1>
        <p className="text-muted-foreground mb-4">
          Collega i tuoi account per sincronizzare la tua libreria di giochi e accedere a funzionalità avanzate.
        </p>
        <div className="flex justify-center">
          <Button asChild variant="outline" className="mb-4">
            <a href="/store-manager">
              <CheckCircle className="h-4 w-4 mr-2" />
              🔧 Gestione Store Interattiva
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {stores.map((store) => {
          const connected = isConnected(store.id);
          const isConnectable = connectableProviders.includes(store.id);
          const currentLoading = loadingProvider === store.id;

          return (
            <Card key={store.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-4">
                  <div className="relative h-12 w-12 flex items-center justify-center">
                    {store.icon ? store.icon : store.logoUrl ? (
                      <Image
                        src={store.logoUrl}
                        alt={`${store.name} logo`}
                        width={48}
                        height={48}
                        style={{ objectFit: 'contain' }}
                      />
                    ) : null}
                  </div>
                  <CardTitle className="text-xl font-bold">{store.name}</CardTitle>
                </div>
                {connected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {store.description}
                </CardDescription>
                <div className="mt-4 flex flex-col space-y-2">
                  {connected ? (
                    <>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          variant="destructive"
                          disabled={isLoading || currentLoading}
                          onClick={() => handleDisconnect(store.id)}
                        >
                          {currentLoading ? <Loader2 className="animate-spin mr-2" /> : <Unplug className="mr-2 h-4 w-4" />}
                          Disconnetti
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={testingProvider === store.id}
                          onClick={() => testConnection(store.id)}
                          title="Test connessione"
                        >
                          {testingProvider === store.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : testResults[store.id]?.connected ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : testResults[store.id]?.error ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {testResults[store.id] && (
                        <div className="text-xs text-muted-foreground">
                          {testResults[store.id].connected ? (
                            <span className="text-green-600">✓ Connessione verificata</span>
                          ) : (
                            <span className="text-red-600">✗ {testResults[store.id].error}</span>
                          )}
                        </div>
                      )}
                    </>
                  ) : isConnectable ? (
                    <Button
                      className="w-full"
                      disabled={isLoading || currentLoading}
                      onClick={() => handleConnect(store.id)}
                    >
                      {currentLoading ? <Loader2 className="animate-spin mr-2" /> : <Plug className="mr-2 h-4 w-4" />}
                      Collega Account
                    </Button>
                  ) : (
                    <Button className="w-full" disabled={true}>
                      <Plug className="mr-2 h-4 w-4" />
                      Non disponibile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ubisoft modal removed - now using GenericCredentialsModal */}


      {/* Steam modal removed - now using a dedicated Steam modal component */}

      {/* Generic modal removed - now using GenericCredentialsModal */}

      {/* Utility Services Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Servizi Utility</h2>
        <p className="text-muted-foreground mb-6">
          Collega servizi aggiuntivi per arricchire la tua esperienza di gioco con informazioni e funzionalità extra.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {utilityServices.map((service) => {
            const connected = isConnected(service.id);
            const isConnectable = connectableUtilities.includes(service.id);
            const currentLoading = loadingProvider === service.id;

            return (
              <Card key={service.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 flex items-center justify-center">
                      {service.icon}
                    </div>
                  </div>
                  {connected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg font-bold mb-2">{service.name}</CardTitle>
                  <CardDescription className="mb-4">
                    {service.description}
                  </CardDescription>
                  <div className="mt-4 flex flex-col space-y-2">
                    {connected ? (
                      <>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            variant="destructive"
                            disabled={isLoading || currentLoading}
                            onClick={() => handleDisconnectUtility(service.id)}
                          >
                            {currentLoading ? <Loader2 className="animate-spin mr-2" /> : <Unplug className="mr-2 h-4 w-4" />}
                            Disattiva
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={testingProvider === service.id}
                            onClick={() => testConnectionUtility(service.id)}
                            title="Test servizio"
                          >
                            {testingProvider === service.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : testResults[service.id]?.connected ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : testResults[service.id]?.error ? (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {testResults[service.id] && (
                          <div className="text-xs text-muted-foreground">
                            {testResults[service.id].connected ? (
                              <span className="text-green-600">✓ Servizio attivo</span>
                            ) : (
                              <span className="text-red-600">✗ {testResults[service.id].error}</span>
                            )}
                          </div>
                        )}
                      </>
                    ) : isConnectable ? (
                      <Button
                        className="w-full"
                        disabled={isLoading || currentLoading}
                        onClick={() => handleConnectUtility(service.id)}
                      >
                        {currentLoading ? <Loader2 className="animate-spin mr-2" /> : <Plug className="mr-2 h-4 w-4" />}
                        Attiva Servizio
                      </Button>
                    ) : (
                      <Button className="w-full" disabled={true}>
                        <Plug className="mr-2 h-4 w-4" />
                        Prossimamente
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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