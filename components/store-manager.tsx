'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, RefreshCw, Plug, Unplug } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { invoke } from '@/lib/tauri-api';

interface StoreStatus {
  id: string;
  name: string;
  connected: boolean;
  loading: boolean;
  error?: string;
  gamesCount?: number;
  lastChecked?: Date;
}

interface StoreManagerProps {
  stores: Array<{
    id: string;
    name: string;
    description: string;
    logoUrl?: string;
  }>;
}

export function StoreManager({ stores }: StoreManagerProps) {
  const [storeStatuses, setStoreStatuses] = useState<Record<string, StoreStatus>>({});
  const [globalLoading, setGlobalLoading] = useState(false);

  // Inizializza lo stato degli store
  useEffect(() => {
    const initialStatuses: Record<string, StoreStatus> = {};
    stores.forEach(store => {
      initialStatuses[store.id] = {
        id: store.id,
        name: store.name,
        connected: false,
        loading: false,
      };
    });
    setStoreStatuses(initialStatuses);
  }, [stores]);

  // Testa la connessione a un singolo store usando i comandi Tauri
  const testStoreConnection = async (storeId: string): Promise<{ connected: boolean; error?: string; gamesCount?: number }> => {
    try {
      let result;
      
      switch (storeId) {
        case 'steam':
          result = await invoke('test_steam_connection');
          break;
        case 'epic':
          result = await invoke('test_epic_connection');
          break;
        case 'gog':
          result = await invoke('test_gog_connection');
          break;
        case 'origin':
          result = await invoke('test_origin_connection');
          break;
        case 'ubisoft':
          result = await invoke('test_ubisoft_connection');
          break;
        case 'battlenet':
          result = await invoke('test_battlenet_connection');
          break;
        case 'itchio':
          result = await invoke('test_itchio_connection');
          break;
        default:
          return { connected: false, error: 'Store non supportato' };
      }
      
      // Parsing del risultato dal backend Rust
      if (typeof result === 'string') {
        // Se il risultato è una stringa, probabilmente è un messaggio di successo
        const gamesMatch = result.match(/(\d+) giochi/);
        const gamesCount = gamesMatch ? parseInt(gamesMatch[1]) : undefined;
        
        return {
          connected: !result.toLowerCase().includes('errore'),
          gamesCount,
          error: result.toLowerCase().includes('errore') ? result : undefined
        };
      }
      
      return { connected: true };
    } catch (error) {
      console.error(`Errore test connessione ${storeId}:`, error);
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Errore sconosciuto' 
      };
    }
  };

  // Aggiorna lo stato di un singolo store
  const refreshStoreStatus = async (storeId: string) => {
    setStoreStatuses(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], loading: true }
    }));

    try {
      const result = await testStoreConnection(storeId);
      
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: {
          ...prev[storeId],
          connected: result.connected,
          loading: false,
          error: result.error,
          gamesCount: result.gamesCount,
          lastChecked: new Date()
        }
      }));

      if (result.connected) {
        toast.success(`${storeStatuses[storeId]?.name || storeId} connesso${result.gamesCount ? ` (${result.gamesCount} giochi)` : ''}`);
      } else {
        toast.error(`${storeStatuses[storeId]?.name || storeId}: ${result.error || 'Connessione fallita'}`);
      }
    } catch (error) {
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: {
          ...prev[storeId],
          connected: false,
          loading: false,
          error: 'Errore durante il test',
          lastChecked: new Date()
        }
      }));
      toast.error(`Errore durante il test di ${storeId}`);
    }
  };

  // Aggiorna lo stato di tutti gli store
  const refreshAllStores = async () => {
    setGlobalLoading(true);
    
    try {
      const promises = stores.map(store => refreshStoreStatus(store.id));
      await Promise.all(promises);
      toast.success('Stato di tutti gli store aggiornato');
    } catch (error) {
      toast.error('Errore durante l\'aggiornamento degli store');
    } finally {
      setGlobalLoading(false);
    }
  };

  // Simula connessione/disconnessione store
  const toggleStoreConnection = async (storeId: string) => {
    const currentStatus = storeStatuses[storeId];
    if (!currentStatus) return;

    setStoreStatuses(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], loading: true }
    }));

    try {
      if (currentStatus.connected) {
        // Disconnetti store
        // In un'implementazione reale, questo dovrebbe chiamare un comando Tauri
        // per disconnettere lo store o rimuovere le credenziali
        
        setStoreStatuses(prev => ({
          ...prev,
          [storeId]: {
            ...prev[storeId],
            connected: false,
            loading: false,
            gamesCount: undefined,
            error: undefined
          }
        }));
        
        toast.success(`${currentStatus.name} disconnesso`);
      } else {
        // Connetti store - in realtà dovrebbe aprire un modal o processo di autenticazione
        await refreshStoreStatus(storeId);
      }
    } catch (error) {
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: { ...prev[storeId], loading: false }
      }));
      toast.error(`Errore durante l'operazione su ${currentStatus.name}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header con pulsante refresh globale */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestione Store</h2>
          <p className="text-gray-600">Gestisci le connessioni ai tuoi store di giochi</p>
        </div>
        <Button
          onClick={refreshAllStores}
          disabled={globalLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${globalLoading ? 'animate-spin' : ''}`} />
          Aggiorna Tutti
        </Button>
      </div>

      {/* Griglia degli store */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map(store => {
          const status = storeStatuses[store.id];
          if (!status) return null;

          return (
            <Card key={store.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{store.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {status.loading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    ) : status.connected ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
                <CardDescription>{store.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Stato connessione */}
                <div className="text-sm">
                  <span className="font-medium">Stato: </span>
                  <span className={status.connected ? 'text-green-600' : 'text-red-600'}>
                    {status.connected ? 'Connesso' : 'Disconnesso'}
                  </span>
                </div>

                {/* Numero giochi */}
                {status.gamesCount !== undefined && (
                  <div className="text-sm">
                    <span className="font-medium">Giochi: </span>
                    <span className="text-blue-600">{status.gamesCount}</span>
                  </div>
                )}

                {/* Errore */}
                {status.error && (
                  <div className="text-sm text-red-600">
                    <span className="font-medium">Errore: </span>
                    {status.error}
                  </div>
                )}

                {/* Ultimo controllo */}
                {status.lastChecked && (
                  <div className="text-xs text-gray-500">
                    Ultimo controllo: {status.lastChecked.toLocaleTimeString()}
                  </div>
                )}

                {/* Pulsanti azione */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => toggleStoreConnection(store.id)}
                    disabled={status.loading}
                    variant={status.connected ? "destructive" : "default"}
                    size="sm"
                    className="flex-1"
                  >
                    {status.connected ? (
                      <>
                        <Unplug className="h-4 w-4 mr-1" />
                        Disconnetti
                      </>
                    ) : (
                      <>
                        <Plug className="h-4 w-4 mr-1" />
                        Connetti
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => refreshStoreStatus(store.id)}
                    disabled={status.loading}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className={`h-4 w-4 ${status.loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
