'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@/lib/tauri-api';
import { stores } from '@/data/stores';
import { Toaster, toast } from 'sonner';
import { CheckCircle, XCircle, RefreshCw, Power, PowerOff, AlertTriangle, ImageOff, Gamepad2, Zap, Shield, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SteamModal } from '@/components/modals/steam-modal';
import { ItchioModal } from '@/components/modals/itchio-modal';
import { GenericCredentialsModal } from '@/components/modals/generic-credentials-modal';
import { EpicModal } from '@/components/modals/epic-modal';

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
    case 'rockstar': return Star;
    case 'amazon': return Gamepad2; // Amazon Games
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
  
  // Flag per prevenire test simultanei e loop
  const [isTestingInProgress, setIsTestingInProgress] = useState(false);
  const [lastTestTime, setLastTestTime] = useState<Record<string, number>>({});
  
  // Stati per i modals
  const [showSteamModal, setShowSteamModal] = useState(false);
  const [showItchioModal, setShowItchioModal] = useState(false);
  const [showEpicModal, setShowEpicModal] = useState(false);
  const [showGenericModal, setShowGenericModal] = useState(false);
  const [currentGenericProvider, setCurrentGenericProvider] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [legendaryStatus, setLegendaryStatus] = useState<any>(null);

  // Stati per Epic Games legacy (manteniamo per compatibilità con le funzioni esistenti)
  const [epicUsername, setEpicUsername] = useState('');
  const [epicPassword, setEpicPassword] = useState('');
  const [epicLoading, setEpicLoading] = useState(false);

  // Stati per Steam (deprecated - manteniamo per compatibilità)
  const [steamApiKey, setSteamApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [steamLoading, setSteamLoading] = useState(false);
  
  // Carica credenziali Steam salvate dal backend
  useEffect(() => {
    // Gestisci callback OAuth Epic Games
    const handleEpicOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const epicCode = urlParams.get('epic_code');
      const epicError = urlParams.get('epic_error');
      
      if (epicError) {
        console.error('[EPIC OAUTH] Errore OAuth:', epicError);
        toast.error(`Errore autenticazione Epic Games: ${epicError}`);
        // Pulisci URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      if (epicCode) {
        console.log('[EPIC OAUTH] Authorization code ricevuto:', epicCode);
        toast.info('🔄 Completamento autenticazione Epic Games...');
        
        try {
          const result = await invoke('exchange_epic_oauth_code', { authorizationCode: epicCode });
          console.log('[EPIC OAUTH] Token exchange result:', result);
          
          if (result && result.access_token) {
            toast.success('✅ Epic Games autenticato con successo!');
            
            // Aggiorna stato connessione
            setStoreStatuses(prev => ({
              ...prev,
              epic_games: {
                ...prev.epic_games,
                connected: true,
                loading: false,
                lastChecked: new Date().toISOString(),
                error: null
              }
            }));
            
            // Prova a caricare i giochi
            try {
              await invoke('scan_games');
              toast.success('Libreria aggiornata con i giochi Epic!');
            } catch (scanError) {
              console.error('Errore aggiornamento libreria:', scanError);
              toast.warning('Epic Games connesso, ma errore nell\'aggiornamento libreria.');
            }
          } else {
            toast.error('❌ Errore nel completamento autenticazione Epic Games');
          }
        } catch (error) {
          console.error('[EPIC OAUTH] Errore exchange token:', error);
          toast.error('❌ Errore nel completamento autenticazione Epic Games');
        }
        
        // Pulisci URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    
    handleEpicOAuthCallback();

    const loadSteamCredentials = async () => {
      try {
        const credentials = await invoke('load_steam_credentials');
        if (credentials && typeof credentials === 'object') {
          setSteamApiKey(credentials.api_key || '');
          setSteamId(credentials.steam_id || '');
          console.log('Credenziali Steam caricate dal backend');
        }
      } catch (error) {
        // Silently handle missing credentials - it's normal when not configured yet
        console.debug('Steam credentials not found (normal on first run)');
      }
    };
    
    // Only load credentials if they might exist (avoid error on first run)
    loadSteamCredentials();

    // Carica credenziali Epic Games salvate  
    const loadEpicCredentials = async () => {
      try {
        const credentials = await invoke('load_epic_credentials');
        if (credentials && typeof credentials === 'object') {
          setEpicUsername(credentials.username || '');
          console.log('Credenziali Epic caricate dal backend');
        }
      } catch (error) {
        // Silently handle missing credentials - it's normal when not configured yet
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Nessuna credenziale Epic salvata')) {
          console.debug('Epic credentials not found (normal on first run)');
        } else {
          console.debug('Epic credentials error:', error);
        }
      }
    };
    
    loadEpicCredentials();
    
    // Carica credenziali itch.io salvate  
    const loadItchioCredentials = async () => {
      try {
        const credentials = await invoke('load_itchio_credentials');
        if (credentials && typeof credentials === 'object') {
          console.log('Credenziali itch.io caricate dal backend');
          // Imposta lo stato come connesso se ci sono credenziali valide
          setStoreStatuses(prev => ({
            ...prev,
            itch_io: {
              ...prev.itch_io,
              connected: true,
              loading: false,
              name: 'itch.io'
            }
          }));
        }
      } catch (error) {
        // Silently handle missing credentials - it's normal when not configured yet
        console.debug('itch.io credentials not found (normal on first run):', error);
      }
    };
    
    loadItchioCredentials();
    
    // Carica credenziali Ubisoft Connect salvate  
    const loadUbisoftCredentials = async () => {
      try {
        const credentials = await invoke('load_ubisoft_credentials');
        if (credentials && typeof credentials === 'object') {
          console.log('Credenziali Ubisoft Connect caricate dal backend');
          // Imposta lo stato come connesso se ci sono credenziali valide
          setStoreStatuses(prev => ({
            ...prev,
            ubisoft_connect: {
              ...prev.ubisoft_connect,
              connected: true,
              loading: false,
              name: 'Ubisoft Connect'
            }
          }));
        }
      } catch (error) {
        // Silently handle missing credentials - it's normal when not configured yet
        console.debug('Ubisoft Connect credentials not found (normal on first run):', error);
      }
    };
    
    loadUbisoftCredentials();
    
    // Carica credenziali Rockstar Games salvate  
    const loadRockstarCredentials = async () => {
      try {
        const credentials = await invoke('load_rockstar_credentials');
        if (credentials && typeof credentials === 'object') {
          console.log('Credenziali Rockstar Games caricate dal backend');
          // Imposta lo stato come connesso se ci sono credenziali valide
          setStoreStatuses(prev => ({
            ...prev,
            rockstar: {
              ...prev.rockstar,
              connected: true,
              loading: false,
              name: 'Rockstar Games'
            }
          }));
        }
      } catch (error) {
        // Silently handle missing credentials - it's normal when not configured yet
        console.debug('Rockstar Games credentials not found (normal on first run):', error);
      }
    };
    
    loadRockstarCredentials();
    
    // Carica credenziali Origin/EA salvate  
    const loadOriginCredentials = async () => {
      try {
        const credentials = await invoke('load_origin_credentials');
        if (credentials && typeof credentials === 'object') {
          console.log('Credenziali Origin/EA caricate dal backend');
          // Imposta lo stato come connesso se ci sono credenziali valide
          setStoreStatuses(prev => ({
            ...prev,
            origin: {
              ...prev.origin,
              connected: true,
              loading: false,
              name: 'Origin / EA App'
            }
          }));
        }
      } catch (error) {
        // Silently handle missing credentials - it's normal when not configured yet
        console.debug('Origin/EA credentials not found (normal on first run):', error);
      }
    };
    
    loadOriginCredentials();
    
    // Carica credenziali Battle.net salvate  
    const loadBattlenetCredentials = async () => {
      try {
        const credentials = await invoke('load_battlenet_credentials');
        if (credentials && typeof credentials === 'object') {
          console.log('Credenziali Battle.net caricate dal backend');
          // Imposta lo stato come connesso se ci sono credenziali valide
          setStoreStatuses(prev => ({
            ...prev,
            battle_net: {
              ...prev.battle_net,
              connected: true,
              loading: false,
              name: 'Battle.net'
            }
          }));
        }
      } catch (error) {
        // Silently handle missing credentials - it's normal when not configured yet
        console.debug('Battle.net credentials not found (normal on first run):', error);
      }
    };
    
    loadBattlenetCredentials();
    
    // Carica credenziali GOG salvate  
    const loadGogCredentials = async () => {
      try {
        const credentials = await invoke('load_gog_credentials');
        if (credentials && typeof credentials === 'object') {
          console.log('Credenziali GOG caricate dal backend');
          // Imposta lo stato come connesso se ci sono credenziali valide
          setStoreStatuses(prev => ({
            ...prev,
            gog: {
              ...prev.gog,
              connected: true,
              loading: false,
              name: 'GOG Galaxy'
            }
          }));
        }
      } catch (error) {
        // Silently handle missing credentials - it's normal when not configured yet
        console.debug('GOG credentials not found (normal on first run):', error);
      }
    };
    
    loadGogCredentials();
    
    // Controlla stato Legendary per Epic Games
    const checkLegendaryStatus = async () => {
      try {
        const status = await invoke('check_legendary_status');
        setLegendaryStatus(status);
        console.log('Legendary status:', status);
        
        // Se Legendary è autenticato, aggiorna lo stato di Epic Games
        if (status && status.authenticated) {
          setStoreStatuses(prev => ({
            ...prev,
            epic_games: {
              name: 'Epic Games',
              connected: true,
              loading: false,
              manuallyDisconnected: false,
              gamesCount: 81, // Numero approssimativo, verrà aggiornato
              lastChecked: new Date(),
              error: undefined
            }
          }));
        }
      } catch (error) {
        console.log('Errore controllo Legendary:', error);
      }
    };
    
    checkLegendaryStatus();
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
        loading: store.id === 'steam', // Solo Steam in loading iniziale
        manuallyDisconnected: false,
      };
    }
    setStoreStatuses(initialStatuses);
    setGlobalLoading(true);

    try {
      // Tenta sempre l'auto-connessione Steam all'avvio
      // Questo legge le credenziali salvate (anche da Impostazioni)
      console.log('[STORE-MANAGER] Tentativo auto-connessione Steam...');
      
      // Prima imposta tutti gli store come non connessi (tranne Steam che è in loading)
      const baseStatuses: StoreStatuses = {};
      for (const store of stores) {
        baseStatuses[store.id] = {
          name: store.name,
          connected: false,
          loading: store.id === 'steam',
          manuallyDisconnected: false,
        };
      }
      setStoreStatuses(baseStatuses);
      
      // Ora tenta l'auto-connessione Steam
      const steamAutoConnected = await attemptSteamAutoConnect();
      console.log('[STORE-MANAGER] Steam auto-connesso:', steamAutoConnected);
      
      // Se Steam non si è connesso, aggiorna lo stato per rimuovere il loading
      if (!steamAutoConnected) {
        setStoreStatuses(prev => ({
          ...prev,
          steam: {
            ...prev.steam,
            loading: false
          }
        }));
      }
      
    } catch (error) {
      console.error("Errore in getInitialStatuses:", error);
      // Non mostrare toast di errore al caricamento iniziale
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  useEffect(() => {
    getInitialStatuses();
  }, [getInitialStatuses]);

  const refreshStoreStatus = async (storeId: string, skipDebounce: boolean = false) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) {
      console.error(`Store ${storeId} non trovato`);
      return;
    }

    // Debouncing: previeni chiamate troppo frequenti (minimo 2 secondi tra i test)
    const now = Date.now();
    const lastTest = lastTestTime[storeId] || 0;
    if (!skipDebounce && (now - lastTest) < 2000) {
      console.debug(`Test per ${store.name} saltato (debouncing)`);
      return;
    }

    // Previeni test simultanei
    if (isTestingInProgress) {
      console.debug(`Test per ${store.name} saltato (test in corso)`);
      return;
    }

    setLastTestTime(prev => ({ ...prev, [storeId]: now }));
    setIsTestingInProgress(true);

    setStoreStatuses(prev => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        loading: true,
        error: undefined,
      },
    }));

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

      // Gestione silenziosa degli errori comuni (credenziali mancanti)
      if (!result.connected && result.error) {
        const isCredentialError = result.error.includes('credenziali') || 
                                 result.error.includes('credentials') ||
                                 result.error.includes('Nessuna') ||
                                 result.error.includes('salvata');
        
        if (!isCredentialError) {
          // Solo mostra toast per errori reali, non per credenziali mancanti
          toast.info(`${store.name}: ${result.error}`);
        }
      }

    } catch (error: any) {
      console.debug(`Test ${store.name} fallito:`, error.message);
      
      // Gestione silenziosa per errori comuni
      const isCommonError = error.message?.includes('credenziali') || 
                           error.message?.includes('credentials') ||
                           error.message?.includes('Nessuna') ||
                           error.message?.includes('salvata');

      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: {
          ...prev[storeId],
          connected: false,
          loading: false,
          error: isCommonError ? 'Credenziali non configurate' : (error.message || 'Errore di connessione'),
          lastChecked: new Date(),
        },
      }));

      // Non mostrare toast per errori comuni di credenziali mancanti
      if (!isCommonError) {
        toast.error(`Errore test ${store.name}: ${error.message}`);
      }
    } finally {
      setIsTestingInProgress(false);
    }
  };
  
  const refreshAllStores = async () => {
    if (isTestingInProgress) {
      console.debug("Refresh saltato: test già in corso");
      return;
    }

    setGlobalLoading(true);
    try {
      // Esegui i test in sequenza con delay per evitare sovraccarico
      for (const store of stores) {
        if (storeStatuses[store.id]?.manuallyDisconnected) {
          continue; // Salta store disconnessi manualmente
        }
        
        await refreshStoreStatus(store.id, true); // skipDebounce = true per refresh manuale
        
        // Piccolo delay tra i test per evitare sovraccarico
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
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

    // Apri il modal appropriato in base al tipo di store
    switch (storeId) {
      case 'steam':
        setShowSteamModal(true);
        return;
      
      case 'itch_io':
        setShowItchioModal(true);
        return;
      
      case 'gog':
      case 'origin':
      case 'ubisoft_connect':
      case 'battle_net':
      case 'rockstar':
        setCurrentGenericProvider(storeId);
        setShowGenericModal(true);
        return;
      
      case 'epic_games':
        setShowEpicModal(true);
        return;
      
      default:
        // Per store senza modal specifico, usa la logica esistente
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
          const errorMsg = error instanceof Error ? error.message : String(error);
          // Non mostrare come errore se è semplicemente "non installato"
          if (errorMsg.includes('non installato') || errorMsg.includes('non trovato')) {
            console.info(`ℹ️ ${store.name}: ${errorMsg}`);
            setStoreStatuses(prev => ({
              ...prev,
              [storeId]: {
                ...prev[storeId],
                connected: false,
                loading: false,
                error: 'Non installato'
              }
            }));
            toast.info(`${store.name} non è installato su questo PC`);
          } else {
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
        }
        break;
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

  // Handler per SteamModal
  const handleSteamSubmit = async (apiKey: string, steamId: string) => {
    setModalLoading(true);
    try {
      // Prima salva le credenziali Steam
      await invoke('save_steam_credentials', {
        apiKey: apiKey,
        steamId: steamId
      });
      
      // Poi fa auto-connect per testare e ottenere i giochi
      const result = await invoke('auto_connect_steam');
      
      setStoreStatuses(prev => ({
        ...prev,
        steam: {
          ...prev.steam,
          connected: true,
          loading: false,
          manuallyDisconnected: false,
          gamesCount: result.games_count || 0,
          lastChecked: new Date(),
          error: undefined
        }
      }));
      
      toast.success(`Steam connesso con successo! ${result.games_count || 0} giochi trovati.`);
      
      // Aggiorna automaticamente la libreria
      try {
        await invoke('scan_games');
        toast.success('Libreria aggiornata! I tuoi giochi Steam sono ora disponibili.');
      } catch (scanError) {
        console.error('Errore aggiornamento libreria:', scanError);
        toast.warning('Steam connesso, ma errore nell\'aggiornamento libreria. Vai su Library e clicca "Scansiona Giochi".');
      }
      
    } catch (error: any) {
      const errMsg = String(error);
      // Non loggare errori di credenziali corrotte - già gestiti
      if (!errMsg.includes('Credenziali corrotte') && !errMsg.includes('Riconnettiti')) {
        console.error('Errore connessione Steam:', error);
      }
      setStoreStatuses(prev => ({
        ...prev,
        steam: {
          ...prev.steam,
          connected: false,
          loading: false,
          error: errMsg.includes('Credenziali corrotte') ? 'Riconnettiti a Steam' : 'Errore: Verifica Steam ID'
        }
      }));
      throw error; // Rilancia l'errore per far gestire al modal
    } finally {
      setModalLoading(false);
    }
  };

  // Handler per ItchioModal
  const handleItchioSubmit = async (apiKey: string) => {
    setModalLoading(true);
    try {
      // Implementa la logica di connessione itch.io
      const result = await invoke('connect_itchio', { apiKey });
      
      setStoreStatuses(prev => ({
        ...prev,
        itch_io: {
          ...prev.itch_io,
          connected: true,
          loading: false,
          manuallyDisconnected: false,
          gamesCount: result.games_count || 0,
          lastChecked: new Date(),
          error: undefined
        }
      }));
      
      toast.success(`itch.io connesso con successo! ${result.games_count || 0} giochi trovati.`);
      
      // Aggiorna automaticamente la libreria
      try {
        await invoke('scan_games');
        toast.success('Libreria aggiornata! I tuoi giochi itch.io sono ora disponibili.');
      } catch (scanError) {
        console.error('Errore aggiornamento libreria:', scanError);
        toast.warning('itch.io connesso, ma errore nell\'aggiornamento libreria.');
      }
      
    } catch (error) {
      console.error('Errore connessione itch.io:', error);
      setStoreStatuses(prev => ({
        ...prev,
        itch_io: {
          ...prev.itch_io,
          connected: false,
          loading: false,
          error: 'Errore: Verifica API Key'
        }
      }));
      throw error; // Rilancia l'errore per far gestire al modal
    } finally {
      setModalLoading(false);
    }
  };

  // Handler per GenericCredentialsModal
  const handleGenericSubmit = async (email: string, password: string, twoFactorCode?: string) => {
    setModalLoading(true);
    try {
      // Mappa i provider ai comandi corretti
      let connectCommand = `connect_${currentGenericProvider}`;
      if (currentGenericProvider === 'ubisoft_connect') {
        connectCommand = 'connect_ubisoft';
      } else if (currentGenericProvider === 'rockstar') {
        connectCommand = 'connect_rockstar';
      } else if (currentGenericProvider === 'origin') {
        connectCommand = 'connect_origin';
      } else if (currentGenericProvider === 'battle_net') {
        connectCommand = 'connect_battlenet';
      }
      
      const result = await invoke(connectCommand, { email, password, twoFactorCode });
      
      setStoreStatuses(prev => ({
        ...prev,
        [currentGenericProvider]: {
          ...prev[currentGenericProvider],
          connected: true,
          loading: false,
          manuallyDisconnected: false,
          gamesCount: result.games_count || 0,
          lastChecked: new Date(),
          error: undefined
        }
      }));
      
      const storeName = stores.find(s => s.id === currentGenericProvider)?.name || currentGenericProvider;
      toast.success(`${storeName} connesso con successo! ${result.games_count || 0} giochi trovati.`);
      
      // Aggiorna automaticamente la libreria
      try {
        await invoke('scan_games');
        toast.success(`Libreria aggiornata! I tuoi giochi ${storeName} sono ora disponibili.`);
      } catch (scanError) {
        console.error('Errore aggiornamento libreria:', scanError);
        toast.warning(`${storeName} connesso, ma errore nell\'aggiornamento libreria.`);
      }
      
    } catch (error) {
      console.error(`Errore connessione ${currentGenericProvider}:`, error);
      setStoreStatuses(prev => ({
        ...prev,
        [currentGenericProvider]: {
          ...prev[currentGenericProvider],
          connected: false,
          loading: false,
          error: 'Errore: Verifica credenziali'
        }
      }));
      throw error; // Rilancia l'errore per far gestire al modal
    } finally {
      setModalLoading(false);
    }
  };

  // Handler per EpicModal
  const handleEpicSubmit = async (username: string, password: string) => {
    setModalLoading(true);
    try {
      // Salva le credenziali Epic nel backend
      await invoke('save_epic_credentials', {
        username,
        password
      });
      
      // Testa la connessione Epic
      const result = await invoke('get_epic_games_web');
      
      if (result.success && result.games.length > 0) {
        setStoreStatuses(prev => ({
          ...prev,
          epic_games: {
            ...prev.epic_games,
            connected: true,
            loading: false,
            manuallyDisconnected: false,
            gamesCount: result.games.length,
            lastChecked: new Date(),
            error: undefined
          }
        }));
        
        toast.success(`Epic Games connesso! ${result.games.length} giochi trovati.`);
        
        // Aggiorna automaticamente la libreria
        try {
          await invoke('scan_games');
          toast.success('Libreria aggiornata con i giochi Epic!');
        } catch (scanError) {
          console.error('Errore aggiornamento libreria:', scanError);
          toast.warning('Epic Games connesso, ma errore nell\'aggiornamento libreria.');
        }
      } else {
        setStoreStatuses(prev => ({
          ...prev,
          epic_games: {
            ...prev.epic_games,
            connected: true,
            loading: false,
            manuallyDisconnected: false,
            gamesCount: 0,
            lastChecked: new Date(),
            error: 'Nessun gioco trovato'
          }
        }));
        toast.warning('Epic Games connesso ma nessun gioco trovato nella libreria');
      }
      
    } catch (error) {
      console.error('Errore connessione Epic:', error);
      setStoreStatuses(prev => ({
        ...prev,
        epic_games: {
          ...prev.epic_games,
          connected: false,
          loading: false,
          error: 'Errore: Verifica username e password'
        }
      }));
      throw error; // Rilancia l'errore per far gestire al modal
    } finally {
      setModalLoading(false);
    }
  };

  const handleEpicWebSearch = async () => {
    try {
      toast.info('🌐 Ricerca giochi Epic Games online...');
      
      const result = await invoke('get_epic_games_web');
      console.log('Epic Web Search Result:', result);
      
      if (result.success && result.games.length > 0) {
        toast.success(`🎮 Trovati ${result.games.length} giochi Epic via web!`);
        
        // Aggiorna il conteggio Epic Games
        setStoreStatuses(prev => ({
          ...prev,
          epic_games: {
            ...prev.epic_games,
            connected: true,
            gamesCount: result.games.length,
            lastChecked: new Date(),
            error: undefined
          }
        }));
        
        // Mostra alcuni giochi trovati
        const gamesList = result.games.slice(0, 5).join(', ');
        toast.info(`Giochi trovati: ${gamesList}${result.games.length > 5 ? '...' : ''}`);
        
      } else {
        toast.warning('Nessun gioco Epic trovato online. Prova metodi diversi.');
        console.log('Metodi provati:', result.methods_tried);
      }
      
    } catch (error) {
      console.error('Errore ricerca Epic Games web:', error);
      toast.error('Errore durante la ricerca online Epic Games');
    }
  };

  const handleEpicLogin = async () => {
    if (!epicUsername || !epicPassword) {
      toast.error('Inserisci username e password Epic Games');
      return;
    }

    setEpicLoading(true);
    try {
      toast.info('🔐 Connessione a Epic Games...');
      
      // Salva le credenziali Epic nel backend
      const saveResult = await invoke('save_epic_credentials', {
        username: epicUsername,
        password: epicPassword
      });
      
      console.log('Epic credentials saved:', saveResult);
      
      // Testa la connessione Epic
      const result = await invoke('get_epic_games_web');
      
      if (result.success && result.games.length > 0) {
        toast.success(`🎮 Epic Games connesso! ${result.games.length} giochi trovati.`);
        
        // Aggiorna lo stato
        setStoreStatuses(prev => ({
          ...prev,
          epic_games: {
            ...prev.epic_games,
            connected: true,
            gamesCount: result.games.length,
            lastChecked: new Date(),
            error: undefined
          }
        }));
        
        console.log('Credenziali e stato Epic salvati nel backend');
        
        // Aggiorna automaticamente la libreria
        console.log('🔄 Aggiornamento automatico libreria dopo connessione Epic...');
        try {
          const libraryResult = await invoke('scan_games');
          console.log('✅ Libreria aggiornata con successo!', libraryResult);
          toast.success('📚 Libreria aggiornata con i giochi Epic!');
        } catch (libraryError) {
          console.warn('Errore aggiornamento libreria:', libraryError);
        }
        
        // Chiudi il modal
        setShowEpicModal(false);
        
      } else {
        toast.warning('Epic Games connesso ma nessun gioco trovato nella libreria');
        
        setStoreStatuses(prev => ({
          ...prev,
          epic_games: {
            ...prev.epic_games,
            connected: true,
            gamesCount: 0,
            lastChecked: new Date(),
            error: 'Nessun gioco trovato'
          }
        }));
      }
      
    } catch (error) {
      console.error('Errore connessione Epic:', error);
      setStoreStatuses(prev => ({
        ...prev,
        epic_games: {
          ...prev.epic_games,
          connected: false,
          loading: false,
          error: 'Errore: Verifica username e password'
        }
      }));
      toast.error('Errore connessione Epic Games. Verifica le credenziali.');
    } finally {
      setEpicLoading(false);
    }
  };

  const handleEpicLegendarySearch = async () => {
    try {
      toast.info('🚀 Epic Games - Ricerca completa libreria...');
      
      // Prima verifica lo stato di Legendary
      console.log('🔍 Verifica stato Legendary...');
      const legendaryStatus = await invoke('check_legendary_status');
      console.log('Legendary Status:', legendaryStatus);
      setLegendaryStatus(legendaryStatus);
      
      if (!legendaryStatus.installed) {
        toast.warning('Legendary non installato - Accesso limitato a giochi installati');
        toast.info(legendaryStatus.install_instructions || 'Installa Legendary per accedere alla libreria Epic Games');
      } else if (!legendaryStatus.authenticated) {
        toast.warning('Legendary non autenticato - Esegui "legendary auth"');
      } else {
        toast.success(`${legendaryStatus.message}`);
      }
      
      // Prova a ottenere la libreria Epic Games
      console.log('🔍 Recupero libreria Epic Games...');
      const result = await invoke('get_epic_games_complete');
      console.log('Epic Games Complete Result:', result);
      
      if (result && result.length > 0) {
        toast.success(`🎮 Trovati ${result.length} giochi Epic Games!`);
        
        // Aggiorna il conteggio Epic Games
        setStoreStatuses(prev => ({
          ...prev,
          epic_games: {
            ...prev.epic_games,
            connected: true,
            gamesCount: result.length,
            lastChecked: new Date(),
            error: undefined
          }
        }));
        
        // Mostra alcuni giochi trovati
        const installedCount = result.filter(game => game.is_installed).length;
        const libraryCount = result.length - installedCount;
        
        toast.info(`📦 ${installedCount} installati, 📚 ${libraryCount} in libreria`);
        
        // Mostra alcuni titoli di esempio
        const sampleGames = result.slice(0, 3).map(game => game.title).join(', ');
        if (sampleGames) {
          toast.info(`Esempi: ${sampleGames}${result.length > 3 ? '...' : ''}`);
        }
        
      } else {
        toast.warning('Nessun gioco Epic trovato.');
        
        // Se non trova giochi, prova a suggerire soluzioni
        if (!legendaryStatus.installed) {
          toast.info('💡 Installa Legendary per accedere alla libreria Epic Games');
        } else if (!legendaryStatus.authenticated) {
          toast.info('💡 Autentica Legendary con "legendary auth" per accedere alla libreria');
        }
      }
      
    } catch (error) {
      console.error('Errore Epic Games Complete:', error);
      toast.error('Errore durante la ricerca Epic Games');
      
      // Fallback: mostra info su Legendary se l'errore è correlato
      if (error.toString().includes('legendary') || error.toString().includes('Legendary')) {
        toast.info('💡 Installa Legendary per accedere alla libreria Epic Games');
      }
    }
  };

  const handleResetCredentials = async (storeId: string) => {
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
      toast.info(`Reset credenziali ${store.name} in corso...`);
      
      // 1. Gestione specifica per Steam (mostra il modal)
      if (storeId === 'steam') {
        // Prima disconnetti Steam
        await handleDisconnect(storeId);
        
        // Aspetta un momento
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mostra il modal per riconnessione
        setShowSteamModal(true);
        setSteamApiKey(''); // Pulisci campi
        setSteamId('');
        
        toast.success('Steam resettato! Inserisci nuove credenziali nel modal.');
        return; // Non fare altro per Steam
      }
      
      // 2. Per altri store, disconnetti e ricontrolla
      await handleDisconnect(storeId);
      
      // 3. Aspetta un momento per assicurarsi che la disconnessione sia completata
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 4. Esegui un force refresh del test
      await refreshStoreStatus(storeId);
      
      // 4. Per Epic Games, prova anche a pulire eventuali cache locali
      if (storeId === 'epic_games') {
        try {
          // Comando per pulire cache Epic (se implementato)
          await invoke('clear_epic_cache');
          console.log('Cache Epic Games pulita');
        } catch (e) {
          console.log('Nessuna cache Epic da pulire:', e);
        }
      }
      
      toast.success(`${store.name} resettato e ricontrollato!`);
      
    } catch (error) {
      console.error(`Errore reset ${store.name}:`, error);
      toast.error(`Errore durante il reset di ${store.name}`);
      
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: { ...prev[storeId], loading: false }
      }));
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
      
      // Per altri store, usa clear_credentials se disconnect non è disponibile
      let disconnectCommand;
      if (storeId === 'epic_games') {
        disconnectCommand = 'disconnect_epic';
      } else if (storeId === 'gog') {
        disconnectCommand = 'disconnect_gog';
      } else if (storeId === 'battle_net') {
        disconnectCommand = 'disconnect_battlenet';
      } else if (['origin', 'ubisoft_connect', 'itch_io', 'rockstar'].includes(storeId)) {
        // Per questi store usiamo clear_credentials
        const clearCommand = storeId === 'ubisoft_connect' ? 'clear_ubisoft_credentials' :
                            storeId === 'itch_io' ? 'clear_itchio_credentials' :
                            storeId === 'rockstar' ? 'clear_rockstar_credentials' :
                            storeId === 'origin' ? 'clear_origin_credentials' :
                            `clear_${storeId}_credentials`;
        await invoke(clearCommand);
      } else {
        disconnectCommand = `disconnect_${storeId}`;
      }
      
      if (disconnectCommand) {
        await invoke(disconnectCommand);
      }
      
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
    <div className="h-full bg-gray-900 text-white overflow-hidden flex flex-col">
      <Toaster position="bottom-right" richColors />
      
      {/* Header compatto */}
      <div className="bg-slate-800/50 border-b border-slate-700/50 p-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Store</h1>
            <p className="text-xs text-slate-400">Collega i tuoi account per sincronizzare la libreria</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-lg font-bold text-green-400">{connectedStores}</span>
              <span className="text-xs text-slate-500 ml-1">connessi</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-blue-400">{totalGames}</span>
              <span className="text-xs text-slate-500 ml-1">giochi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid degli store - layout compatto */}
      <div className="max-w-7xl mx-auto p-4 flex-1 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 h-full">
          {stores.map((store, index) => {
            const status = storeStatuses[store.id] || { loading: true, connected: false, name: store.name };
            const StoreIcon = getStoreIcon(store.id);

            return (
              <motion.div
                key={store.id}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600 transition-colors"
              >
                {/* Header compatto */}
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      status.connected ? 'bg-green-500/20' : 'bg-slate-700/50'
                    }`}>
                      <StoreIcon className={`h-4 w-4 ${status.connected ? 'text-green-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{status.name}</h3>
                      {status.connected ? (
                        <span className="text-xs text-green-400">
                          {status.gamesCount ? `${status.gamesCount} giochi` : 'Connesso'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {status.loading ? 'Verifica...' : 'Non connesso'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`h-2.5 w-2.5 rounded-full ${
                    status.loading ? 'bg-blue-500 animate-pulse' : 
                    status.connected ? 'bg-green-500' : 
                    'bg-slate-600'
                  }`} />
                </div>

                {/* Azioni compatte */}
                <div className="px-3 pb-3">
                  {status.error && !status.loading && !status.connected && (
                    <p className="text-[10px] text-amber-400/70 mb-2 truncate" title={status.error}>
                      {status.error}
                    </p>
                  )}

                  {/* Pulsanti compatti */}
                  {status.connected ? (
                    <div className="flex gap-1.5">
                      <Button 
                        onClick={() => refreshStoreStatus(store.id)} 
                        disabled={status.loading}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${status.loading ? 'animate-spin' : ''}`} />
                        Aggiorna
                      </Button>
                      <Button 
                        onClick={() => handleDisconnect(store.id)} 
                        disabled={status.loading}
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 border-red-600/50 text-red-400 hover:bg-red-900/30"
                      >
                        <PowerOff className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handleConnect(store.id)} 
                      disabled={status.loading}
                      size="sm"
                      className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-500"
                    >
                      <Power className="h-3 w-3 mr-1" />
                      Collega
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modal Components */}
      <SteamModal
        isOpen={showSteamModal}
        onClose={() => setShowSteamModal(false)}
        onSubmit={handleSteamSubmit}
        isLoading={modalLoading}
      />
      
      <ItchioModal
        isOpen={showItchioModal}
        onClose={() => setShowItchioModal(false)}
        onSubmit={handleItchioSubmit}
        isLoading={modalLoading}
      />
      
      <EpicModal
        isOpen={showEpicModal}
        onClose={() => setShowEpicModal(false)}
        onSubmit={handleEpicSubmit}
        isLoading={modalLoading}
      />
      
      <GenericCredentialsModal
        isOpen={showGenericModal}
        onClose={() => {
          setShowGenericModal(false);
          setCurrentGenericProvider('');
        }}
        onSubmit={handleGenericSubmit}
        provider={currentGenericProvider}
        isLoading={modalLoading}
      />
    </div>
  );
}
