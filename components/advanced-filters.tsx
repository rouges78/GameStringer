'use client';

import React, { useState, useEffect } from 'react';
import { Filter, X, Calendar, Star, Clock, Gamepad2, Tag, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface Game {
  id: string;
  name: string;
  store: string;
  genre?: string;
  engine?: string;
  year?: number;
  rating?: number;
  playtime?: number;
  size?: number;
  tags?: string[];
  isInstalled?: boolean;
  isVR?: boolean;
  hasMultiplayer?: boolean;
  hasSingleplayer?: boolean;
  supportedLanguages?: string[];
}

interface FilterState {
  search: string;
  stores: string[];
  genres: string[];
  engines: string[];
  yearRange: [number, number];
  ratingRange: [number, number];
  playtimeRange: [number, number];
  sizeRange: [number, number];
  tags: string[];
  isInstalled?: boolean;
  isVR?: boolean;
  hasMultiplayer?: boolean;
  hasSingleplayer?: boolean;
  languages: string[];
}

interface AdvancedFiltersProps {
  games: Game[];
  onFiltersChange: (filteredGames: Game[]) => void;
  className?: string;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  games,
  onFiltersChange,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    stores: [],
    genres: [],
    engines: [],
    yearRange: [1990, 2024],
    ratingRange: [0, 10],
    playtimeRange: [0, 1000],
    sizeRange: [0, 200],
    tags: [],
    languages: []
  });

  // Estrai opzioni uniche dai giochi
  const extractOptions = () => {
    const stores = [...new Set(games.map(g => g.store).filter(Boolean))];
    const genres = [...new Set(games.map(g => g.genre).filter(Boolean))];
    const engines = [...new Set(games.map(g => g.engine).filter(Boolean))];
    const tags = [...new Set(games.flatMap(g => g.tags || []))];
    const languages = [...new Set(games.flatMap(g => g.supportedLanguages || []))];
    
    const years = games.map(g => g.year).filter(Boolean) as number[];
    const ratings = games.map(g => g.rating).filter(Boolean) as number[];
    const playtimes = games.map(g => g.playtime).filter(Boolean) as number[];
    const sizes = games.map(g => g.size).filter(Boolean) as number[];

    return {
      stores: stores.sort(),
      genres: genres.sort(),
      engines: engines.sort(),
      tags: tags.sort(),
      languages: languages.sort(),
      yearRange: years.length > 0 ? [Math.min(...years), Math.max(...years)] : [1990, 2024],
      ratingRange: ratings.length > 0 ? [Math.min(...ratings), Math.max(...ratings)] : [0, 10],
      playtimeRange: playtimes.length > 0 ? [Math.min(...playtimes), Math.max(...playtimes)] : [0, 1000],
      sizeRange: sizes.length > 0 ? [Math.min(...sizes), Math.max(...sizes)] : [0, 200]
    };
  };

  const options = extractOptions();

  // Applica filtri
  const applyFilters = () => {
    let filtered = games;

    // Ricerca testuale
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(game => 
        game.name.toLowerCase().includes(searchLower) ||
        game.store.toLowerCase().includes(searchLower) ||
        game.genre?.toLowerCase().includes(searchLower) ||
        game.engine?.toLowerCase().includes(searchLower) ||
        game.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Filtri store
    if (filters.stores.length > 0) {
      filtered = filtered.filter(game => filters.stores.includes(game.store));
    }

    // Filtri genere
    if (filters.genres.length > 0) {
      filtered = filtered.filter(game => game.genre && filters.genres.includes(game.genre));
    }

    // Filtri engine
    if (filters.engines.length > 0) {
      filtered = filtered.filter(game => game.engine && filters.engines.includes(game.engine));
    }

    // Filtri anno
    filtered = filtered.filter(game => {
      if (!game.year) return true;
      return game.year >= filters.yearRange[0] && game.year <= filters.yearRange[1];
    });

    // Filtri rating
    filtered = filtered.filter(game => {
      if (!game.rating) return true;
      return game.rating >= filters.ratingRange[0] && game.rating <= filters.ratingRange[1];
    });

    // Filtri tempo di gioco
    filtered = filtered.filter(game => {
      if (!game.playtime) return true;
      return game.playtime >= filters.playtimeRange[0] && game.playtime <= filters.playtimeRange[1];
    });

    // Filtri dimensione
    filtered = filtered.filter(game => {
      if (!game.size) return true;
      return game.size >= filters.sizeRange[0] && game.size <= filters.sizeRange[1];
    });

    // Filtri booleani
    if (filters.isInstalled !== undefined) {
      filtered = filtered.filter(game => game.isInstalled === filters.isInstalled);
    }

    if (filters.isVR !== undefined) {
      filtered = filtered.filter(game => game.isVR === filters.isVR);
    }

    if (filters.hasMultiplayer !== undefined) {
      filtered = filtered.filter(game => game.hasMultiplayer === filters.hasMultiplayer);
    }

    if (filters.hasSingleplayer !== undefined) {
      filtered = filtered.filter(game => game.hasSingleplayer === filters.hasSingleplayer);
    }

    // Filtri tag
    if (filters.tags.length > 0) {
      filtered = filtered.filter(game => 
        game.tags?.some(tag => filters.tags.includes(tag))
      );
    }

    // Filtri lingue
    if (filters.languages.length > 0) {
      filtered = filtered.filter(game => 
        game.supportedLanguages?.some(lang => filters.languages.includes(lang))
      );
    }

    onFiltersChange(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [filters, games]);

  const resetFilters = () => {
    setFilters({
      search: '',
      stores: [],
      genres: [],
      engines: [],
      yearRange: options.yearRange as [number, number],
      ratingRange: options.ratingRange as [number, number],
      playtimeRange: options.playtimeRange as [number, number],
      sizeRange: options.sizeRange as [number, number],
      tags: [],
      languages: []
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    count += filters.stores.length;
    count += filters.genres.length;
    count += filters.engines.length;
    count += filters.tags.length;
    count += filters.languages.length;
    if (filters.isInstalled !== undefined) count++;
    if (filters.isVR !== undefined) count++;
    if (filters.hasMultiplayer !== undefined) count++;
    if (filters.hasSingleplayer !== undefined) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className={`w-full ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filtri Avanzati</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4 space-y-6 p-4 border rounded-lg">
          {/* Ricerca */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </Label>
            <Input
              placeholder="Search games, stores, genres..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <Separator />

          {/* Filtri Store */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Store
            </Label>
            <div className="flex flex-wrap gap-2">
              {options.stores.map(store => (
                <div key={store} className="flex items-center space-x-2">
                  <Checkbox
                    id={`store-${store}`}
                    checked={filters.stores.includes(store)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFilters(prev => ({ ...prev, stores: [...prev.stores, store] }));
                      } else {
                        setFilters(prev => ({ ...prev, stores: prev.stores.filter(s => s !== store) }));
                      }
                    }}
                  />
                  <Label htmlFor={`store-${store}`} className="text-sm">
                    {store}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Filtri Genere */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Generi
            </Label>
            <div className="flex flex-wrap gap-2">
              {options.genres.map(genre => (
                <div key={genre} className="flex items-center space-x-2">
                  <Checkbox
                    id={`genre-${genre}`}
                    checked={filters.genres.includes(genre)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFilters(prev => ({ ...prev, genres: [...prev.genres, genre] }));
                      } else {
                        setFilters(prev => ({ ...prev, genres: prev.genres.filter(g => g !== genre) }));
                      }
                    }}
                  />
                  <Label htmlFor={`genre-${genre}`} className="text-sm">
                    {genre}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Filtri Anno */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Anno di Rilascio: {filters.yearRange[0]} - {filters.yearRange[1]}
            </Label>
            <Slider
              value={filters.yearRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, yearRange: value as [number, number] }))}
              min={options.yearRange[0]}
              max={options.yearRange[1]}
              step={1}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Filtri Rating */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Rating: {filters.ratingRange[0]} - {filters.ratingRange[1]}
            </Label>
            <Slider
              value={filters.ratingRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, ratingRange: value as [number, number] }))}
              min={options.ratingRange[0]}
              max={options.ratingRange[1]}
              step={0.1}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Filtri Tempo di Gioco */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo di Gioco (ore): {filters.playtimeRange[0]} - {filters.playtimeRange[1]}
            </Label>
            <Slider
              value={filters.playtimeRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, playtimeRange: value as [number, number] }))}
              min={options.playtimeRange[0]}
              max={options.playtimeRange[1]}
              step={1}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Filtri Booleani */}
          <div className="space-y-3">
            <Label>Stato e Caratteristiche</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="installed"
                  checked={filters.isInstalled === true}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({ 
                      ...prev, 
                      isInstalled: checked ? true : undefined 
                    }));
                  }}
                />
                <Label htmlFor="installed" className="text-sm">Solo Installati</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vr"
                  checked={filters.isVR === true}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({ 
                      ...prev, 
                      isVR: checked ? true : undefined 
                    }));
                  }}
                />
                <Label htmlFor="vr" className="text-sm">VR</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="multiplayer"
                  checked={filters.hasMultiplayer === true}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({ 
                      ...prev, 
                      hasMultiplayer: checked ? true : undefined 
                    }));
                  }}
                />
                <Label htmlFor="multiplayer" className="text-sm">Multiplayer</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="singleplayer"
                  checked={filters.hasSingleplayer === true}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({ 
                      ...prev, 
                      hasSingleplayer: checked ? true : undefined 
                    }));
                  }}
                />
                <Label htmlFor="singleplayer" className="text-sm">Singleplayer</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Azioni */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetFilters}>
              <X className="h-4 w-4 mr-2" />
              Reset Filtri
            </Button>
            <Button onClick={() => setIsOpen(false)}>
              Applica Filtri
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default AdvancedFilters;
