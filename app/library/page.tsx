'use client';

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { invoke, isTauri } from '@/lib/tauri-api';

// Definiamo l'interfaccia basata sulla struttura dati di Rust
interface Game {
  id: string;
  title: string;
  provider: string;
  header_image: string | null;  // Può essere null se non disponibile
}

export default function LibraryPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setIsLoading(true);
        
        // Aspetta che l'ambiente Tauri sia pronto
        if (!isTauri()) {
          // Riprova dopo un breve ritardo se Tauri non è ancora disponibile
          setTimeout(fetchGames, 100);
          return;
        }
        
        const result = await invoke<Game[]>('get_games');
        console.log(`✅ Trovati ${result.length} giochi nel database`);
        // Log dettagliato del primo gioco per vedere la struttura
        if (result.length > 0) {
          console.log('🎮 Esempio di struttura gioco:', result[0]);
          console.log('🎮 Primi 5 giochi:', result.slice(0, 5));
          // Verifica header_image
          const giochiConImmagini = result.filter(g => g.header_image && g.header_image !== '');
          console.log(`🖼️ Giochi con immagini: ${giochiConImmagini.length} su ${result.length}`);
          if (giochiConImmagini.length > 0) {
            console.log('🖼️ Esempio di URL immagine:', giochiConImmagini[0].header_image);
          }
        }
        setGames(result);
      } catch (err: any) {
        console.error('Errore durante il recupero dei giochi dal backend:', err);
        setError(err.toString());
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-red-500 flex items-center gap-2 mt-4">
          <AlertTriangle className="h-5 w-5" />
          <p><strong>Errore:</strong> {error}</p>
        </div>
      );
    }

    if (games.length === 0) {
      return (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">
            Nessun gioco trovato nella tua libreria.
          </p>
          <p className="text-sm text-muted-foreground">
            Vai alla pagina <strong>Stores</strong> per collegare i tuoi account Steam, Epic Games, e altri store.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mt-6">
        {games.map((game) => (
          <Card key={game.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-0">
              <div className="relative aspect-square w-full bg-gray-200 dark:bg-gray-700">
                {game.header_image ? (
                  <Image 
                    src={game.header_image} 
                    alt={game.title} 
                    fill
                    className="object-cover"
                    onError={(e) => {
                      // Nascondi l'immagine se c'è un errore di caricamento
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-4xl text-gray-400">
                      {game.title ? game.title.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-sm truncate" title={game.title || 'Gioco senza nome'}>
                  {game.title || 'Gioco senza nome'}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Libreria Giochi</h1>
        <p className="text-muted-foreground">
          Seleziona un gioco per iniziare a tradurre le sue stringhe.
        </p>
      </div>
      {renderContent()}
    </div>
  );
}
