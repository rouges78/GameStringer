'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import GameImage from '@/components/game-image';
import { LanguageFlags } from '@/components/ui/language-flags';
import { Cog, AlertCircle } from 'lucide-react';

interface DisplayGame {
  id: string;
  title: string;
  imageUrl: string;
  fallbackImageUrl: string | null;
  isInstalled: boolean;
}

interface GameDetails {
  supported_languages: string[];
  game_engine: string | null;
}

// Definiamo un "fetcher" globale o per componente per SWR
const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error: any = new Error('An error occurred while fetching the data.');
    // Tenta di allegare il corpo dell'errore per il debug, ma non fallire se non è JSON
    try {
      error.info = await res.json();
    } catch (e) {
      error.info = { error: 'Could not parse error JSON body.' };
    }
    error.status = res.status;
    throw error;
  }

  return res.json();
};

const GameCard = ({ game, index }: { game: DisplayGame; index: number }) => {
  const { data: details, error, isLoading } = useSWR<GameDetails>(`/api/steam/game-details/${game.id}`, fetcher, {
    revalidateOnFocus: false, // Opzionale: evita di ricaricare solo perché la finestra torna in focus
    shouldRetryOnError: true, // Fondamentale: dice a SWR di riprovare in caso di errore
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-lg shadow-lg transition-transform duration-300 ease-in-out hover:-translate-y-1 hover:shadow-xl"
    >
      <Link href={`/games/${game.id}`} className="block w-full aspect-video relative">
        <GameImage 
          src={game.imageUrl} 
          alt={game.title} 
          fallbackSrc={game.fallbackImageUrl}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4">
          <h3 className="font-bold text-white drop-shadow-md truncate">{game.title}</h3>
        </div>
      </Link>
      {game.isInstalled && (
        <Badge variant="secondary" className="absolute top-2 right-2 bg-green-600/80 text-white border-none backdrop-blur-sm">
          Installato
        </Badge>
      )}
      <div className="p-4 bg-card min-h-[52px]">
        {isLoading && (
          <div className="h-5 w-full bg-muted animate-pulse rounded-md"></div>
        )}
        {error && !isLoading && (
            // @ts-ignore
            error.status === 404 ? (
                // Se è un 404, significa che non ci sono dettagli (es. DLC, demo). Non mostriamo un errore, ma uno stato neutro.
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <span>N/A</span>
                </div>
            ) : (
                // Per tutti gli altri errori (500, rete, etc.), mostriamo un messaggio di errore per il debug.
                // @ts-ignore
                <div className="flex items-center gap-2 text-xs text-destructive/80" title={`Errore ${error.status}`}>
                    <AlertCircle className="h-4 w-4" />
                    <span>Errore caricamento</span>
                </div>
            )
        )}
        {details && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {details.game_engine && (
              <div className="flex items-center gap-1">
                <Cog className="h-3 w-3" />
                <span>{details.game_engine}</span>
              </div>
            )}
            {details.supported_languages && details.supported_languages.length > 0 && (
              <LanguageFlags supportedLanguages={details.supported_languages} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default GameCard;
