'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';

interface Game {
  id: string;
  name: string;
  imageUrl: string;
  provider: string;
}

export default function LibraryPage() {
  const { data: session, status } = useSession();
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchGames = async () => {
        try {
          setIsLoading(true);
          const response = await fetch('/api/library/games');
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Impossibile caricare i giochi.');
          }
          const data = await response.json();
          setGames(data.games || []);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };

      fetchGames();
    }

    if (status === 'unauthenticated') {
        setIsLoading(false);
    }

  }, [status]);

  const renderContent = () => {
    if (isLoading || status === 'loading') {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (status === 'unauthenticated') {
      return (
        <p className="text-muted-foreground mt-4">
          Devi essere autenticato per vedere la tua libreria. Vai alla pagina degli store per collegare i tuoi account.
        </p>
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
        <p className="text-muted-foreground mt-4">
          Nessun gioco trovato. Assicurati di aver collegato i tuoi account nella pagina degli store.
        </p>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mt-6">
        {games.map((game) => (
          <Card key={game.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-0">
              <div className="relative aspect-square w-full">
                <Image src={game.imageUrl} alt={game.name} layout="fill" objectFit="cover" />
              </div>
              <div className="p-3">
                <p className="font-semibold text-sm truncate" title={game.name}>{game.name}</p>
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
