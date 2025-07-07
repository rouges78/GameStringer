'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@/lib/tauri-api';
import { stores } from '@/data/stores';
import { Toaster, toast } from 'sonner';
import { CheckCircle, XCircle, RefreshCw, Power, PowerOff, AlertTriangle, ImageOff, Gamepad2, Zap, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Icone vere per ogni store
const getStoreIcon = (storeId: string) => {
  switch (storeId) {
    case 'steam': return Gamepad2;
    case 'epic_games': return Zap;
    case 'gog': return Shield;
    case 'origin': return Power;
    case 'ubisoft_connect': return Sparkles;
    case 'battle_net': return XCircle;
    case 'itch_io': return ImageOff;
    default: return Gamepad2;
  }
};

interface StoreStatus {
  name: string;
  connected: boolean;
  loading: boolean;
  gamesCount?: number;
  error?: string;
  lastChecked?: Date;
  manuallyDisconnected?: boolean;
}

interface StoreStatuses {
  [key: string]: StoreStatus;
}

export default function StoreManagerPage() {
  const [storeStatuses, setStoreStatuses] = useState<StoreStatuses>({});
  const [globalLoading, setGlobalLoading] = useState(true);
  const [totalGames, setTotalGames] = useState(0);
  const [connectedStores, setConnectedStores] = useState(0);
  
  // Stati per il modal Steam
  const [showSteamModal, setShowSteamModal] = useState(false);
  const [steamApiKey, setSteamApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [steamLoading, setSteamLoading] = useState(false);
  
  // Carica credenziali Steam salvate dal backend
  useEffect(() => {
    const loadSteamCredentials = async () => {
      try {
        const credentials = await invoke('load_steam_credentials');
        if (credentials && typeof credentials === 'object') {
          setSteamApiKey(credentials.api_key || '');
          setSteamId(credentials.steam_id || '');
          console.log('Credenziali Steam caricate dal backend');
        }
      } catch (error) {
        console.log('Nessuna credenziale Steam salvata:', error);
      }
    };
    
    loadSteamCredentials();
  }, []);
  
  // Funzione per tentare auto-connessione Steam
  const attemptSteamAutoConnect = async () => {
    try {
      console.log('Tentativo auto-connessione Steam...');
      const result = await invoke('auto_connect_steam');
      
      if (result && typeof result === 'object') {
        // Auto-connessione riuscita
        setStoreStatuses(prev => ({
          ...prev,
          steam: {
            name: 'Steam',
            connected: true,
            loading: false,
            manuallyDisconnected: false,
            gamesCount: result.games_count || 0,
            lastChecked: new Date(),
            error: undefined
          }
        }));
        
        console.log('Steam auto-connesso:', result.message);
        
        // Trigger automatico aggiornamento libreria anche per auto-connessione
        try {
          console.log('🔄 Aggiornamento automatico libreria dopo auto-connessione Steam...');
          await invoke('scan_games');
          console.log('✅ Libreria aggiornata automaticamente!');
        } catch (scanError) {
          console.error('Errore aggiornamento libreria auto:', scanError);
          // Non mostrare toast per auto-connessione, è silenzioso
        }
        
        return true;
      }
    } catch (error) {
      console.log('Auto-connessione Steam fallita:', error);
      // Non mostrare errore all'utente, è normale se non ci sono credenziali
    }
    return false;
  };

  const getInitialStatuses = useCallback(async () => {
    const initialStatuses: StoreStatuses = {};
    for (const store of stores) {
      initialStatuses[store.id] = {
        name: store.name,
        connected: false,
        loading: true,
        manuallyDisconnected: false,
      };
    }
    setStoreStatuses(initialStatuses);
    setGlobalLoading(true);

    try {
      // Prima tenta l'auto-connessione Steam
      const steamAutoConnected = await attemptSteamAutoConnect();
      
      // Poi aggiorna lo stato di tutti gli store
      const promises = stores.map(store => {
        // Se Steam è già auto-connesso, salta il refresh
        if (store.id === 'steam' && steamAutoConnected) {
          return Promise.resolve();
        }
        return refreshStoreStatus(store.id, initialStatuses);
      });
      
      await Promise.all(promises);
    } catch (error) {
      toast.error("Errore durante il caricamento dello stato degli store.");
      console.error("Errore in getInitialStatuses:", error);
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  useEffect(() => {
    getInitialStatuses();
  }, [getInitialStatuses]);

  const refreshStoreStatus = async (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) {
      console.error(`Store ${storeId} non trovato`);
      return;
    }

    setStoreStatuses(prev => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        loading: true,
        error: undefined,
      },
    }));

    try {
      try {
        const result: { connected: boolean; games_count?: number; error?: string } = await invoke(store.testCommand);
        
        setStoreStatuses(prev => ({
          ...prev,
          [storeId]: {
            ...prev[storeId],
            connected: result.connected,
            gamesCount: result.games_count,
            loading: false,
            error: result.error || (!result.connected ? 'Test fallito' : undefined),
            lastChecked: new Date(),
          },
        }));

        if(result.connected) {
           // Optional: show a success toast, but might be too noisy.
        } else if(result.error) {
           toast.info(`${store.name}: ${result.error}`);
        }
      } catch (error: any) {
        console.error(`Errore durante il test di ${store.name}:`, error);
        setStoreStatuses(prev => ({
          ...prev,
          [storeId]: {
            ...prev[storeId],
            loading: false,
            error: error.message || 'Impossibile comunicare con il backend.',
            lastChecked: new Date(),
          },
        }));
      }

    } catch (error: any) {
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: {
          ...prev[storeId],
          connected: false,
          loading: false,
          error: error.toString() || 'Errore imprevisto durante il test',
          lastChecked: new Date(),
        },
      }));
      toast.error(`Errore critico durante il test di ${statuses[storeId]?.name || storeId}.`);
      console.error(`Errore test ${storeId}:`, error);
    }
  };
  
  const refreshAllStores = async () => {
    setGlobalLoading(true);
    try {
      const promises = stores.map(store => {
        if (storeStatuses[store.id]?.manuallyDisconnected) {
          return Promise.resolve();
        }
        return refreshStoreStatus(store.id);
      });
      await Promise.all(promises);
      toast.success("Stato di tutti gli store aggiornato.");
    } catch (error) {
      toast.error("Errore durante l'aggiornamento degli store.");
      console.error("Errore in refreshAllStores:", error);
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleConnect = async (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) {
      toast.error(`Store ${storeId} non trovato`);
      return;
    }

    // Logica specifica per Steam
    if (storeId === 'steam') {
      // Mostra il modal invece del prompt
      setShowSteamModal(true);
      return;
    }

    // Per altri store, usa la logica esistente
    setStoreStatuses(prev => ({
      ...prev,
      [storeId]: { 
        ...prev[storeId], 
        manuallyDisconnected: false, 
        loading: true,
        error: undefined
      }
    }));

    toast.info(`Avvio collegamento per ${store.name}...`);
    
    // Testa la connessione e aggiorna lo stato
    try {
      const result = await invoke(store.testCommand);
      
      // Se il test è riuscito, considera lo store connesso
      if (result && typeof result === 'string' && (
        result.includes('riuscita') || 
        result.includes('successful') ||
        result.includes('completata')
      )) {
        setStoreStatuses(prev => ({
          ...prev,
          [storeId]: {
            ...prev[storeId],
            connected: true,
            loading: false,
            manuallyDisconnected: false,
            lastChecked: new Date(),
            error: undefined
          }
        }));
        toast.success(`${store.name} connesso con successo!`);
      } else {
        setStoreStatuses(prev => ({
          ...prev,
          [storeId]: {
            ...prev[storeId],
            connected: false,
            loading: false,
            error: 'Connessione non riuscita'
          }
        }));
        toast.error(`Impossibile connettersi a ${store.name}`);
      }
    } catch (error) {
      console.error(`Errore connessione ${store.name}:`, error);
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: {
          ...prev[storeId],
          connected: false,
          loading: false,
          error: 'Errore di connessione'
        }
      }));
      toast.error(`Errore durante la connessione a ${store.name}`);
    }
  };

  // Funzione per gestire la connessione Steam dal modal
  const handleSteamConnect = async () => {
    if (!steamApiKey.trim()) {
      toast.error('API Key richiesta per Steam');
      return;
    }

    if (!steamId.trim()) {
      toast.error('Steam ID richiesto');
      return;
    }

    setSteamLoading(true);
    
    // Imposta loading nello stato
    setStoreStatuses(prev => ({
      ...prev,
      steam: { 
        ...prev.steam, 
        loading: true,
        error: undefined
      }
    }));

    try {
      // Testa la connessione con le credenziali fornite
      const result = await invoke('get_steam_games', { 
        apiKey: steamApiKey.trim(), 
        steamId: steamId.trim(), 
        forceRefresh: true 
      });
      
      // Se arriva qui, la connessione è riuscita
      setStoreStatuses(prev => ({
        ...prev,
        steam: {
          ...prev.steam,
          connected: true,
          loading: false,
          manuallyDisconnected: false,
          gamesCount: Array.isArray(result) ? result.length : 0,
          lastChecked: new Date(),
          error: undefined
        }
      }));
      
      toast.success(`Steam connesso con successo! ${Array.isArray(result) ? result.length : 0} giochi trovati.`);
      
      // Salva credenziali e stato nel backend
      try {
        await invoke('save_steam_credentials', { 
          apiKey: steamApiKey.trim(), 
          steamId: steamId.trim() 
        });
        
        await invoke('save_steam_connection_status', {
          connected: true,
          gamesCount: Array.isArray(result) ? result.length : 0,
          error: null
        });
        
        console.log('Credenziali e stato Steam salvati nel backend');
      } catch (saveError) {
        console.error('Errore salvataggio backend:', saveError);
      }
      
      // Trigger automatico aggiornamento libreria
      try {
        console.log('🔄 Aggiornamento automatico libreria dopo connessione Steam...');
        toast.info('Aggiornamento libreria in corso...');
        
        await invoke('scan_games');
        console.log('✅ Libreria aggiornata con successo!');
        toast.success('Libreria aggiornata! I tuoi giochi Steam sono ora disponibili.');
      } catch (scanError) {
        console.error('Errore aggiornamento libreria:', scanError);
        toast.warning('Steam connesso, ma errore nell\'aggiornamento libreria. Vai su Library e clicca "Scansiona Giochi".');
      }
      
      // Chiudi il modal ma mantieni i campi per riconnessioni future
      setShowSteamModal(false);
      
    } catch (error) {
      console.error('Errore connessione Steam:', error);
      setStoreStatuses(prev => ({
        ...prev,
        steam: {
          ...prev.steam,
          connected: false,
          loading: false,
          error: 'Errore: Verifica API Key e Steam ID'
        }
      }));
      toast.error('Errore connessione Steam. Verifica API Key e Steam ID.');
    } finally {
      setSteamLoading(false);
    }
  };

  const handleDisconnect = async (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) {
      toast.error(`Store ${storeId} non trovato`);
      return;
    }

    setStoreStatuses(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], loading: true }
    }));

    try {
      // Gestione specifica per Steam
      if (storeId === 'steam') {
        const disconnectedStatus = {
          name: 'Steam',
          connected: false,
          manuallyDisconnected: true,
          gamesCount: 0,
          lastChecked: new Date(),
          error: undefined,
          loading: false
        };
        
        setStoreStatuses(prev => ({
          ...prev,
          [storeId]: disconnectedStatus
        }));
        
        // Rimuovi credenziali e stato dal backend
        try {
          await invoke('remove_steam_credentials');
          console.log('Credenziali Steam rimosse dal backend');
        } catch (error) {
          console.error('Errore rimozione credenziali Steam:', error);
        }
        
        toast.success(`${store.name} disconnesso con successo.`);
        return;
      }
      
      // Per altri store, usa la logica esistente
      const disconnectCommand = storeId === 'epic_games' ? 'disconnect_epic' : 
                               storeId === 'battle_net' ? 'disconnect_battlenet' :
                               `disconnect_${storeId}`;
      
      await invoke(disconnectCommand);
      
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: {
          ...prev[storeId],
          connected: false,
          loading: false,
          manuallyDisconnected: true,
          gamesCount: 0,
          error: 'Disconnesso dall\'utente'
        }
      }));
      toast.success(`${store.name} disconnesso.`);

    } catch (error) {
      console.error(`Errore disconnessione ${store.name}:`, error);
      toast.error(`Errore durante la disconnessione di ${store.name}.`);
      // Restore previous state on error
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: { ...prev[storeId], loading: false }
      }));
    }
  };

  const getStatusColor = (status: StoreStatus) => {
    if (status.loading) return 'border-blue-500';
    if (status.connected) return 'border-green-500';
    if (status.manuallyDisconnected) return 'border-gray-500';
    return 'border-red-500';
  };

  // Calcola statistiche in tempo reale
  useEffect(() => {
    const connected = Object.values(storeStatuses).filter(s => s.connected).length;
    const total = Object.values(storeStatuses).reduce((sum, s) => sum + (s.gamesCount || 0), 0);
    setConnectedStores(connected);
    setTotalGames(total);
  }, [storeStatuses]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="bottom-right" richColors />
      
      {/* Header originale pulito */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Connessioni Store</h1>
          <p className="text-gray-400">Collega i tuoi account per sincronizzare la tua libreria di giochi e accedere a funzionalità avanzate</p>
        </div>
      </div>

      {/* Grid degli store - layout originale */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store, index) => {
            const status = storeStatuses[store.id] || { loading: true, connected: false, name: store.name };
            const StoreIcon = getStoreIcon(store.id);

            return (
              <motion.div
                key={store.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
              >
                {/* Header della card */}
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <StoreIcon className="h-8 w-8 text-gray-300" />
                      <h3 className="text-lg font-semibold text-white">{status.name}</h3>
                    </div>
                    <div className={`h-3 w-3 rounded-full ${
                      status.loading ? 'bg-blue-500 animate-pulse' : 
                      status.connected ? 'bg-green-500' : 
                      'bg-red-500'
                    }`}></div>
                  </div>
                </div>

                {/* Contenuto della card */}
                <div className="p-4">
                  {/* Status */}
                  <div className="mb-4">
                    {status.loading ? (
                      <div className="flex items-center text-blue-400">
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        <span className="text-sm">Verifica in corso...</span>
                      </div>
                    ) : status.connected ? (
                      <div className="flex items-center text-green-400">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span className="text-sm">Connesso</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-400">
                        <XCircle className="h-4 w-4 mr-2" />
                        <span className="text-sm">Non connesso</span>
                      </div>
                    )}
                  </div>

                  {/* Descrizione */}
                  <p className="text-gray-400 text-sm mb-4">
                    Collega il tuo account {status.name} per importare i tuoi giochi.
                  </p>

                  {/* Messaggio di errore */}
                  {status.error && !status.loading && (
                    <div className="bg-yellow-900/30 border border-yellow-700 rounded p-2 mb-4">
                      <div className="flex items-center text-yellow-400">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <span className="text-xs">{status.error}</span>
                      </div>
                    </div>
                  )}

                  {/* Pulsanti */}
                  <div className="space-y-2">
                    {status.connected ? (
                      <Button 
                        onClick={() => handleDisconnect(store.id)} 
                        disabled={status.loading}
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                      >
                        <PowerOff className="h-4 w-4 mr-2" />
                        Disconnetti
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleConnect(store.id)} 
                        disabled={status.loading}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Power className="h-4 w-4 mr-2" />
                        Collega Account
                      </Button>
                    )}
                    
                    {/* Mostra pulsante Test solo per store diversi da Steam o se Steam non è connesso */}
                    {(store.id !== 'steam' || !status.connected) && (
                      <Button 
                        onClick={() => refreshStoreStatus(store.id)} 
                        disabled={status.loading || status.manuallyDisconnected}
                        variant="outline"
                        className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${status.loading ? 'animate-spin' : ''}`} />
                        Test
                      </Button>
                    )}
                  </div>

                  {/* Info aggiuntive */}
                  {status.lastChecked && (
                    <p className="text-xs text-gray-500 mt-3">
                      Ultimo controllo: {new Date(status.lastChecked).toLocaleString()}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modal Steam Connection */}
      {showSteamModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Gamepad2 className="h-6 w-6 text-blue-400" />
                <h3 className="text-xl font-semibold text-white">Connetti Steam</h3>
              </div>
              <button
                onClick={() => {
                  setShowSteamModal(false);
                  setSteamApiKey('');
                  setSteamId('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Steam API Key
                </label>
                <input
                  type="text"
                  value={steamApiKey}
                  onChange={(e) => setSteamApiKey(e.target.value)}
                  placeholder="Inserisci la tua Steam API Key"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Ottieni la tua API Key da:{' '}
                  <a 
                    href="https://steamcommunity.com/dev/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    steamcommunity.com/dev/apikey
                  </a>
                </p>
              </div>

              {/* Steam ID */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Steam ID
                </label>
                <input
                  type="text"
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  placeholder="Inserisci il tuo Steam ID (17 cifre)"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Trova il tuo Steam ID su:{' '}
                  <a 
                    href="https://steamid.io" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    steamid.io
                  </a>
                </p>
              </div>
            </div>

            {/* Pulsanti */}
            <div className="flex space-x-3 mt-6">
              <Button
                onClick={() => {
                  setShowSteamModal(false);
                  setSteamApiKey('');
                  setSteamId('');
                }}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                disabled={steamLoading}
              >
                Annulla
              </Button>
              <Button
                onClick={handleSteamConnect}
                disabled={steamLoading || !steamApiKey.trim() || !steamId.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {steamLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connessione...
                  </>
                ) : (
                  <>
                    <Power className="h-4 w-4 mr-2" />
                    Connetti
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
