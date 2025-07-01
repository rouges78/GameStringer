'use client';

import { useState, useEffect } from 'react';
import { TranslationStats } from '@/components/translation-stats';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';

export default function TranslationDashboard() {
  const [translations, setTranslations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTranslations();
  }, []);

  const fetchTranslations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/translations');
      if (response.ok) {
        const data = await response.json();
        setTranslations(data);
      } else {
        throw new Error('Errore nel caricamento');
      }
    } catch (error) {
      console.error('Errore nel caricamento delle traduzioni:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare le statistiche',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/editor">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna all'Editor
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Dashboard Traduzioni</h1>
            <p className="text-muted-foreground">Panoramica e statistiche delle traduzioni</p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          onClick={fetchTranslations}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Aggiorna
        </Button>
      </div>

      {/* Contenuto */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <TranslationStats translations={translations} />
      )}
    </div>
  );
}