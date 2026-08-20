'use client';

import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

// ============================================================================
// TYPES
// ============================================================================

export interface Game {
  id: string;
  name: string;
  provider: string;
  coverUrl?: string;
  installPath?: string;
  supportedLanguages?: string;
}

export interface GameSelectorProps {
  games: Game[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onGameSelect: (game: Game) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GameSelector({
  games,
  searchQuery,
  onSearchChange,
  onGameSelect,
}: GameSelectorProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label={t('common.cerca')} placeholder="Cerca tra i tuoi games..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-10"
        />
      </div>

      <div className="text-sm text-muted-foreground px-1">
        {games.length} games trovati
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {games.slice(0, 20).map((game) => (
          <button
            key={game.id}
            onClick={() => onGameSelect(game)}
            className={cn(
              "group flex items-center gap-2 p-2 rounded-lg border transition-all",
              "hover:border-primary/40 hover:bg-accent",
              "text-left w-full"
            )}
          >
            <div className="relative w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
              {game.coverUrl ? (
                <Image
                  src={game.coverUrl}
                  alt={game.name}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center -z-10">
                <span className="text-xs font-semibold text-muted-foreground">{game.name?.charAt(0)?.toUpperCase() || '?'}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-xs truncate">
                {game.name}
              </h3>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
      {games.length > 20 && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Usa la ricerca per trovare altri {games.length - 20} games
        </p>
      )}
    </div>
  );
}

