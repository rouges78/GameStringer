'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@/lib/tauri-api';

export function ScanButton() {
  const [isScanning, setIsScanning] = useState(false);
  const router = useRouter();

  const handleScan = async () => {
    setIsScanning(true);
    toast.info('Avvio della scansione dei giochi...', { 
      description: 'Questa operazione potrebbe richiedere alcuni minuti.' 
    });

    try {
      // Aspetta che l'API Tauri sia disponibile (max 5 secondi)
      let retries = 0;
      const maxRetries = 50; // 50 * 100ms = 5 secondi
      
      while (retries < maxRetries) {
        if (typeof window !== 'undefined' && window.__TAURI__) {
          console.log('Tauri API trovata dopo', retries * 100, 'ms');
          break;
        }
        
        if (retries === 0) {
          console.log('Aspettando che Tauri API sia disponibile...');
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (!window.__TAURI__) {
        console.error('Tauri API non trovata dopo 5 secondi');
        console.log('Chiavi window che contengono TAURI:', Object.keys(window).filter(k => k.includes('TAURI')));
        throw new Error('Tauri API non disponibile. Assicurati di eseguire l\'app in ambiente Tauri.');
      }

      console.log('Invocando comando scan_games...');
      
      // Usa il comando Tauri per la scansione
      const scanResults = await invoke<any[]>('scan_games');
      
      console.log('Risultati scansione:', scanResults);
      
      toast.success('Scansione completata!', {
        description: `Trovati ${scanResults.length} giochi`,
      });

      // Ricarica la pagina corrente per aggiornare i dati
      router.refresh();

    } catch (err) {
      console.error('Errore durante la scansione:', err);
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto.';
      toast.error('Scansione fallita', {
        description: errorMessage,
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Button onClick={handleScan} disabled={isScanning} className="min-w-[180px]">
      <Search className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
      {isScanning ? 'Scansione...' : 'Scansiona Giochi'}
    </Button>
  );
}
