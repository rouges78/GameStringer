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

  // Initialize store state
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

  // Test connection to a single store using Tauri commands
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
        case 'amazon':
          result = await invoke('test_amazon_connection');
          break;
        default:
          return { connected: false, error: 'Store not supported' };
      }
      
      // Parse result from Rust backend
      if (typeof result === 'string') {
        // If result is a string, it's probably a success message
        const gamesMatch = result.match(/(\d+) games/);
        const gamesCount = gamesMatch ? parseInt(gamesMatch[1]) : undefined;
        
        return {
          connected: !result.toLowerCase().includes('error'),
          gamesCount,
          error: result.toLowerCase().includes('error') ? result : undefined
        };
      }
      
      return { connected: true };
    } catch (error) {
      console.error(`Connection test error ${storeId}:`, error);
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  };

  // Update single store state
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
        toast.success(`${storeStatuses[storeId]?.name || storeId} connected${result.gamesCount ? ` (${result.gamesCount} games)` : ''}`);
      } else {
        toast.error(`${storeStatuses[storeId]?.name || storeId}: ${result.error || 'Connection failed'}`);
      }
    } catch (error) {
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: {
          ...prev[storeId],
          connected: false,
          loading: false,
          error: 'Error during test',
          lastChecked: new Date()
        }
      }));
      toast.error(`Error testing ${storeId}`);
    }
  };

  // Update all stores state
  const refreshAllStores = async () => {
    setGlobalLoading(true);
    
    try {
      const promises = stores.map(store => refreshStoreStatus(store.id));
      await Promise.all(promises);
      toast.success('All stores status updated');
    } catch (error) {
      toast.error('Error updating stores');
    } finally {
      setGlobalLoading(false);
    }
  };

  // Simulate store connection/disconnection
  const toggleStoreConnection = async (storeId: string) => {
    const currentStatus = storeStatuses[storeId];
    if (!currentStatus) return;

    setStoreStatuses(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], loading: true }
    }));

    try {
      if (currentStatus.connected) {
        // Disconnect store
        // In a real implementation, this should call a Tauri command
        // to disconnect the store or remove credentials
        
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
        
        toast.success(`${currentStatus.name} disconnected`);
      } else {
        // Connect store - should actually open a modal or auth process
        await refreshStoreStatus(storeId);
      }
    } catch (error) {
      setStoreStatuses(prev => ({
        ...prev,
        [storeId]: { ...prev[storeId], loading: false }
      }));
      toast.error(`Error during operation on ${currentStatus.name}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with global refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Store Management</h2>
          <p className="text-gray-600">Manage connections to your game stores</p>
        </div>
        <Button
          onClick={refreshAllStores}
          disabled={globalLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${globalLoading ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      {/* Store grid */}
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
                {/* Connection status */}
                <div className="text-sm">
                  <span className="font-medium">Status: </span>
                  <span className={status.connected ? 'text-green-600' : 'text-red-600'}>
                    {status.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                {/* Games count */}
                {status.gamesCount !== undefined && (
                  <div className="text-sm">
                    <span className="font-medium">Games: </span>
                    <span className="text-blue-600">{status.gamesCount}</span>
                  </div>
                )}

                {/* Error */}
                {status.error && (
                  <div className="text-sm text-red-600">
                    <span className="font-medium">Error: </span>
                    {status.error}
                  </div>
                )}

                {/* Last check */}
                {status.lastChecked && (
                  <div className="text-xs text-gray-500">
                    Last check: {status.lastChecked.toLocaleTimeString()}
                  </div>
                )}

                {/* Action buttons */}
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
                        Disconnect
                      </>
                    ) : (
                      <>
                        <Plug className="h-4 w-4 mr-1" />
                        Connect
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



