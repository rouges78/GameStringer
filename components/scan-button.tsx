'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

export function ScanButton() {
  const [isScanning, setIsScanning] = useState(false);
  const router = useRouter();

  const handleScan = async () => {
    setIsScanning(true);
    toast.info('Avvio della scansione dei giochi...', { 
      description: 'Questa operazione potrebbe richiedere alcuni minuti.' 
    });

    try {
      const response = await fetch('/api/games/scan', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Errore durante la scansione.');
      }
      
      toast.success('Scansione completata!', {
        description: data.message,
      });

      // Ricarica la pagina corrente per aggiornare i dati (es. conteggio giochi)
      router.refresh();

    } catch (err) {
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
