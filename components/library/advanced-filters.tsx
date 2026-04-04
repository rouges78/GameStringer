'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Filter, X, SlidersHorizontal, Calendar, Clock, 
  Languages, Gamepad2, Store, Tag, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

export interface GameFilter {
  search: string;
  stores: string[];
  engines: string[];
  translationStatus: ('none' | 'partial' | 'complete')[];
  hasItalian: boolean | null;
  minPlaytime: number;
  maxPlaytime: number;
  yearRange: [number, number];
  genres: string[];
  tags: string[];
  sortBy: 'name' | 'playtime' | 'lastPlayed' | 'added' | 'progress';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTER: GameFilter = {
  search: '',
  stores: [],
  engines: [],
  translationStatus: [],
  hasItalian: null,
  minPlaytime: 0,
  maxPlaytime: 10000,
  yearRange: [2000, new Date().getFullYear()],
  genres: [],
  tags: [],
  sortBy: 'name',
  sortOrder: 'asc',
};

const STORES = [
  { id: 'steam', name: 'Steam', icon: '🎮' },
  { id: 'epic', name: 'Epic Games', icon: '🎯' },
  { id: 'gog', name: 'GOG', icon: '🌌' },
  { id: 'ubisoft', name: 'Ubisoft', icon: '🔷' },
  { id: 'origin', name: 'EA/Origin', icon: '🔶' },
  { id: 'xbox', name: 'Xbox/PC Game Pass', icon: '🟢' },
  { id: 'itch', name: 'itch.io', icon: '🎨' },
];

const ENGINES = [
  { id: 'unity', name: 'Unity' },
  { id: 'unreal', name: 'Unreal Engine' },
  { id: 'godot', name: 'Godot' },
  { id: 'rpgmaker', name: 'RPG Maker' },
  { id: 'gamemaker', name: 'GameMaker' },
  { id: 'renpy', name: "Ren'Py" },
  { id: 'kirikiri', name: 'Kirikiri' },
  { id: 'other', name: 'Altro' },
];

const GENRES = [
  'RPG', 'Action', 'Adventure', 'Strategy', 'Simulation',
  'Puzzle', 'Visual Novel', 'Horror', 'Indie', 'Platformer'
];

interface AdvancedFiltersProps {
  filter: GameFilter;
  onFilterChange: (filter: GameFilter) => void;
  totalGames: number;
  filteredGames: number;
}

export function AdvancedFilters({
  filter,
  onFilterChange,
  totalGames,
  filteredGames,
}: AdvancedFiltersProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.stores.length > 0) count++;
    if (filter.engines.length > 0) count++;
    if (filter.translationStatus.length > 0) count++;
    if (filter.hasItalian !== null) count++;
    if (filter.minPlaytime > 0 || filter.maxPlaytime < 10000) count++;
    if (filter.genres.length > 0) count++;
    if (filter.tags.length > 0) count++;
    return count;
  }, [filter]);

  const updateFilter = useCallback((updates: Partial<GameFilter>) => {
    onFilterChange({ ...filter, ...updates });
  }, [filter, onFilterChange]);

  const resetFilters = useCallback(() => {
    onFilterChange(DEFAULT_FILTER);
  }, [onFilterChange]);

  const toggleArrayItem = useCallback(<T extends string>(
    array: T[],
    item: T,
    key: keyof GameFilter
  ) => {
    const newArray = array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
    updateFilter({ [key]: newArray } as Partial<GameFilter>);
  }, [updateFilter]);

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Input
          aria-label="Cerca" placeholder="Cerca giochi..."
          value={filter.search}
          onChange={(e) => updateFilter({ search: e.target.value })}
          className="pl-9"
        />
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>

      {/* Quick Filters */}
      <Select
        value={filter.sortBy}
        onValueChange={(value) => updateFilter({ sortBy: value as GameFilter['sortBy'] })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Ordina per" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">{t('advancedFiltersComp.nome')}</SelectItem>
          <SelectItem value="playtime">{t('advancedFiltersComp.tempoDiGioco')}</SelectItem>
          <SelectItem value="lastPlayed">{t('advancedFiltersComp.ultimaSessione')}</SelectItem>
          <SelectItem value="added">{t('advancedFiltersComp.dataAggiunta')}</SelectItem>
          <SelectItem value="progress">{t('advancedFiltersComp.progressoTrad')}</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={() => updateFilter({ sortOrder: filter.sortOrder === 'asc' ? 'desc' : 'asc' })}
      >
        {filter.sortOrder === 'asc' ? '↑' : '↓'}
      </Button>

      {/* Advanced Filters Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filtri
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filtri Avanzati
              </h4>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>

            {/* Store Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Store className="h-4 w-4" />
                Store
              </Label>
              <div className="flex flex-wrap gap-1">
                {STORES.map((store) => (
                  <Badge
                    key={store.id}
                    variant={filter.stores.includes(store.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleArrayItem(filter.stores, store.id, 'stores')}
                  >
                    {store.icon} {store.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Engine Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Gamepad2 className="h-4 w-4" />
                Engine
              </Label>
              <div className="flex flex-wrap gap-1">
                {ENGINES.map((engine) => (
                  <Badge
                    key={engine.id}
                    variant={filter.engines.includes(engine.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleArrayItem(filter.engines, engine.id, 'engines')}
                  >
                    {engine.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Translation Status */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Languages className="h-4 w-4" />
                Stato Traduzione
              </Label>
              <div className="flex gap-2">
                {[
                  { id: 'none', label: 'Non tradotto', color: 'bg-red-500' },
                  { id: 'partial', label: 'Parziale', color: 'bg-yellow-500' },
                  { id: 'complete', label: 'Completo', color: 'bg-green-500' },
                ].map((status) => (
                  <Badge
                    key={status.id}
                    variant={filter.translationStatus.includes(status.id as unknown) ? 'default' : 'outline'}
                    className="cursor-pointer gap-1"
                    onClick={() => toggleArrayItem(
                      filter.translationStatus,
                      status.id as 'none' | 'partial' | 'complete',
                      'translationStatus'
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full', status.color)} />
                    {status.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Has Italian */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasItalian"
                checked={filter.hasItalian === true}
                onCheckedChange={(checked) => 
                  updateFilter({ hasItalian: checked ? true : null })
                }
              />
              <Label htmlFor="hasItalian" className="text-sm cursor-pointer">
                🇮🇹 Solo giochi con italiano ufficiale
              </Label>
            </div>

            {/* Playtime Range */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                Tempo di gioco: {filter.minPlaytime}h - {filter.maxPlaytime === 10000 ? '∞' : `${filter.maxPlaytime}h`}
              </Label>
              <Slider
                min={0}
                max={500}
                step={10}
                value={[filter.minPlaytime, Math.min(filter.maxPlaytime, 500)]}
                onValueChange={([min, max]) => updateFilter({ 
                  minPlaytime: min, 
                  maxPlaytime: max === 500 ? 10000 : max 
                })}
              />
            </div>

            {/* Genres */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4" />
                Generi
              </Label>
              <div className="flex flex-wrap gap-1">
                {GENRES.map((genre) => (
                  <Badge
                    key={genre}
                    variant={filter.genres.includes(genre) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleArrayItem(filter.genres, genre, 'genres')}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="pt-2 border-t text-sm text-muted-foreground">
              Mostrando <strong>{filteredGames}</strong> di <strong>{totalGames}</strong> giochi
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1">
          {filter.stores.map(store => (
            <Badge key={store} variant="secondary" className="gap-1">
              {STORES.find(s => s.id === store)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleArrayItem(filter.stores, store, 'stores')}
              />
            </Badge>
          ))}
          {filter.engines.slice(0, 2).map(engine => (
            <Badge key={engine} variant="secondary" className="gap-1">
              {ENGINES.find(e => e.id === engine)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleArrayItem(filter.engines, engine, 'engines')}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function useGameFilter(games: unknown[]) {
  const [filter, setFilter] = useState<GameFilter>(DEFAULT_FILTER);

  const filteredGames = useMemo(() => {
    return games.filter(game => {
      // Search
      if (filter.search) {
        const search = filter.search.toLowerCase();
        if (!game.name?.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Stores
      if (filter.stores.length > 0) {
        if (!filter.stores.includes(game.store?.toLowerCase())) {
          return false;
        }
      }

      // Engines
      if (filter.engines.length > 0) {
        if (!filter.engines.includes(game.engine?.toLowerCase())) {
          return false;
        }
      }

      // Playtime
      const playtime = game.playtimeHours || 0;
      if (playtime < filter.minPlaytime || playtime > filter.maxPlaytime) {
        return false;
      }

      // Genres
      if (filter.genres.length > 0) {
        const gameGenres = game.genres || [];
        if (!filter.genres.some(g => gameGenres.includes(g))) {
          return false;
        }
      }

      return true;
    });
  }, [games, filter]);

  const sortedGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      let comparison = 0;
      
      switch (filter.sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'playtime':
          comparison = (a.playtimeHours || 0) - (b.playtimeHours || 0);
          break;
        case 'lastPlayed':
          comparison = new Date(a.lastPlayed || 0).getTime() - new Date(b.lastPlayed || 0).getTime();
          break;
        case 'progress':
          comparison = (a.translationProgress || 0) - (b.translationProgress || 0);
          break;
      }

      return filter.sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [filteredGames, filter.sortBy, filter.sortOrder]);

  return {
    filter,
    setFilter,
    filteredGames: sortedGames,
    totalGames: games.length,
  };
}

export default AdvancedFilters;
