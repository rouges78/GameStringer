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
import { CheckCircle, Plug, Unplug, XCircle, Loader2 } from 'lucide-react';

import React, { useState } from 'react';
import Image, { StaticImageData } from 'next/image';
import { useSession, signIn } from 'next-auth/react';
import { toast } from 'react-hot-toast';

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
  { id: 'gog', name: 'GOG', logoUrl: '/logos/gog.png', description: 'La connessione con GOG non è ancora supportata.' },
  { id: 'ea', name: 'EA App', logoUrl: '/logos/ea-app.png', description: 'La connessione con EA App non è ancora supportata.' },
  { id: 'battlenet', name: 'Battle.net', logoUrl: '/logos/battlenet.png', description: 'La connessione con Battle.net non è ancora supportata.' },
  { id: 'rockstar', name: 'Rockstar', logoUrl: '/logos/rockstar.png', description: 'La connessione con Rockstar non è ancora supportata.' },
];

const connectableProviders = ['steam', 'epic', 'ubisoft', 'itchio'];

export default function StoresPage() {
  const { data: session, status, update } = useSession();
  const isLoading = status === 'loading';

  // State for UI elements and forms
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [vdfFile, setVdfFile] = React.useState<File | null>(null);
  const [sharedAccounts, setSharedAccounts] = React.useState<string[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  
  const [steamId, setSteamId] = useState('');
  const [fixMessage, setFixMessage] = useState('');

  // State for Steam ID modal
  const [isSteamModalOpen, setIsSteamModalOpen] = useState(false);
  const [steamIdInput, setSteamIdInput] = useState('');

  const [ubisoftCredentials, setUbisoftCredentials] = useState({ email: '', password: '' });
  const [isUbisoftModalOpen, setIsUbisoftModalOpen] = useState(false);

  const providerMap: { [key: string]: string } = {
    steam: 'steam-credentials',
    itchio: 'itchio-credentials',
    epic: 'epicgames',
    ubisoft: 'ubisoft-credentials',
  };

  const isConnected = (providerId: string): boolean => {
    if (!session?.user?.accounts) return false;
    const backendProviderId = providerMap[providerId] || providerId;
    return session.user.accounts.some(acc => acc.provider === backendProviderId);
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
      toast.error(`Errore: ${result.error}`);
      setFixMessage(`Errore: ${result.error}`);
    }
    setLoadingProvider(null);
  };

  const handleConnect = async (providerId: string) => {
    setLoadingProvider(providerId);
    const userId = session?.user?.id;

    if (providerId === 'ubisoft') {
      setIsUbisoftModalOpen(true);
      setLoadingProvider(null); // Stop loading, modal will handle its own loading state
      return;
    }

    if (providerId === 'epic') {
      await signIn('epicgames', { callbackUrl: '/stores' });
      // setLoadingProvider(null) will be called on page reload
      return;
    }

    // For credential-based providers
    let signInResult;
    if (providerId === 'steam') {
      setIsSteamModalOpen(true);
      setLoadingProvider(null); // Modal will handle its own loading
      return;
    } else if (providerId === 'itchio') {
      const accessToken = prompt('Per favore, inserisci la tua chiave API di Itch.io:');
      if (accessToken) {
        signInResult = await signIn('itchio-credentials', {
          accessToken: accessToken,
          userId: userId,
          redirect: false,
        });
      }
    }

    if (signInResult?.error) {
      toast.error(signInResult.error);
    } else if (signInResult?.ok) {
      toast.success(`Account ${providerId} collegato con successo!`);
      await update();
    }
    
    setLoadingProvider(null);
  };

  const handleDisconnect = async (providerId: string) => {
    setLoadingProvider(providerId);
    const backendProviderId = getBackendProviderId(providerId);
    const response = await fetch('/api/auth/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: backendProviderId }),
    });

    if (response.ok) {
      toast.success(`Account ${providerId} scollegato.`);
      await update();
    } else {
      const result = await response.json();
      toast.error(`Errore durante la disconnessione: ${result.error}`);
    }
    setLoadingProvider(null);
  };

  const handleUbisoftLogin = async () => {
    if (!ubisoftCredentials.email || !ubisoftCredentials.password) {
      toast.error('Per favore, inserisci sia email che password.');
      return;
    }
    setLoadingProvider('ubisoft');
    const result = await signIn('ubisoft-credentials', {
      redirect: false,
      email: ubisoftCredentials.email,
      password: ubisoftCredentials.password,
      userId: session?.user.id,
    });

    if (result?.error) {
      toast.error(result.error || 'Errore durante la connessione con Ubisoft.');
    } else {
      toast.success('Account Ubisoft collegato con successo!');
      setIsUbisoftModalOpen(false);
      setUbisoftCredentials({ email: '', password: '' });
      await update();
    }
    setLoadingProvider(null);
  };

  const handleSteamLogin = async () => {
    if (!/^\d{17}$/.test(steamIdInput)) {
      toast.error('Formato SteamID non valido. Deve essere un numero di 17 cifre.');
      return;
    }
    setLoadingProvider('steam');
    const result = await signIn('steam-credentials', {
      redirect: false,
      steamid: steamIdInput,
      userId: session?.user.id,
    });

    if (result?.error) {
      toast.error(result.error || 'Errore durante la connessione con Steam.');
    } else {
      toast.success('Account Steam collegato con successo!');
      setIsSteamModalOpen(false);
      setSteamIdInput('');
      await update();
    }
    setLoadingProvider(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setVdfFile(event.target.files[0]);
      setParseError(null);
    }
  };

  const handleParseVdf = async () => {
    if (!vdfFile) {
      setParseError('Per favore, seleziona un file prima di procedere.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setSharedAccounts([]);

    try {
      const fileContent = await vdfFile.text();
      const response = await fetch('/api/steam/shared-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: fileContent,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Si è verificato un errore sconosciuto.');
      }

      setSharedAccounts(result.sharedAccounts || []);
      if (result.sharedAccounts.length === 0) {
        setParseError('Nessun account condiviso trovato nel file.');
      }

    } catch (error: any) {
      setParseError(error.message);
    } finally {
      setIsParsing(false);
    }
  };

  const steamAccount = session?.user?.accounts?.find(acc => acc.provider === 'steam-credentials');
  const isSteamIdInvalid = steamAccount ? !/^\d{17}$/.test(steamAccount.providerAccountId) : false;

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
        <p className="text-muted-foreground">
          Collega i tuoi account per sincronizzare la tua libreria di giochi e accedere a funzionalità avanzate.
        </p>
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
                    <Button
                      className="w-full"
                      variant="destructive"
                      disabled={isLoading || currentLoading}
                      onClick={() => handleDisconnect(store.id)}
                    >
                      {currentLoading ? <Loader2 className="animate-spin mr-2" /> : <Unplug className="mr-2 h-4 w-4" />}
                      Disconnetti
                    </Button>
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

      {isUbisoftModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Collega Ubisoft Connect</h3>
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={ubisoftCredentials.email}
                onChange={(e) => setUbisoftCredentials({ ...ubisoftCredentials, email: e.target.value })}
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="password"
                placeholder="Password"
                value={ubisoftCredentials.password}
                onChange={(e) => setUbisoftCredentials({ ...ubisoftCredentials, password: e.target.value })}
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => setIsUbisoftModalOpen(false)}
                className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 transition-colors"
                disabled={loadingProvider === 'ubisoft'}
              >
                Annulla
              </button>
              <button
                onClick={handleUbisoftLogin}
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 transition-colors flex items-center"
                disabled={loadingProvider === 'ubisoft'}
              >
                {loadingProvider === 'ubisoft' ? <Loader2 className="animate-spin mr-2" /> : null}
                Collega
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Steam Family Sharing</h2>
        <Card>
          <CardHeader>
            <CardTitle>Analizza la tua configurazione di condivisione</CardTitle>
            <CardDescription>
              Carica il tuo file <code>sharedconfig.vdf</code> per vedere con chi stai condividendo la tua libreria di giochi Steam.
              Puoi trovarlo nella cartella <code>config</code> della tua installazione di Steam (es. <code>C:\Program Files (x86)\Steam\config</code>).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <input type="file" accept=".vdf" onChange={handleFileChange} className="text-sm" />
              <Button onClick={handleParseVdf} disabled={isParsing || !vdfFile}>
                {isParsing ? <><Loader2 className="animate-spin mr-2" /> Analisi in corso...</> : 'Analizza File'}
              </Button>
              {parseError && <p className="text-red-500 text-sm">{parseError}</p>}
              {sharedAccounts.length > 0 && (
                <div>
                  <h3 className="font-semibold">Account autorizzati:</h3>
                  <ul className="list-disc pl-5 mt-2">
                    {sharedAccounts.map(id => <li key={id}><code>{id}</code></li>)}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isSteamModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-xl w-full max-w-md border">
            <h3 className="text-lg font-semibold mb-4">Collega Account Steam</h3>
            <p className="text-sm text-muted-foreground mb-4">Inserisci il tuo SteamID64 (un numero di 17 cifre) per collegare il tuo account.</p>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <label htmlFor="steamid">SteamID64</label>
              <Input
                id="steamid"
                value={steamIdInput}
                onChange={(e) => setSteamIdInput(e.target.value)}
                placeholder="Inserisci il tuo SteamID64 di 17 cifre"
              />
              <div className="text-xs text-muted-foreground pt-1">
                <a href="https://steamid.io/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                  Non conosci il tuo SteamID? Trovalo qui.
                </a>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <Button
                variant="outline"
                onClick={() => setIsSteamModalOpen(false)}
                disabled={loadingProvider === 'steam'}
              >
                Annulla
              </Button>
              <Button
                onClick={handleSteamLogin}
                disabled={loadingProvider === 'steam'}
              >
                {loadingProvider === 'steam' ? <Loader2 className="animate-spin mr-2" /> : null}
                Collega
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}