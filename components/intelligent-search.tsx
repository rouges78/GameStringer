'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Clock, Zap, Filter, Star, Calendar, Gamepad2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Game {
  id: string;
  name: string;
  store: string;
  genre?: string;
  engine?: string;
  year?: number;
  rating?: number;
  playtime?: number;
  tags?: string[];
  description?: string;
  developer?: string;
  publisher?: string;
  isInstalled?: boolean;
  lastPlayed?: Date;
}

interface SearchResult {
  game: Game;
  score: number;
  matchedFields: string[];
  highlightedName: string;
}

interface SearchSuggestion {
  type: 'game' | 'genre' | 'store' | 'tag' | 'developer' | 'year';
  value: string;
  count?: number;
  icon: React.ReactNode;
}

interface IntelligentSearchProps {
  games: Game[];
  onSearchResults: (results: Game[]) => void;
  onSearchChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

const IntelligentSearch: React.FC<IntelligentSearchProps> = ({
  games,
  onSearchResults,
  onSearchChange,
  placeholder = "Search games, genres, developers...",
  className
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('gamestringer-search-history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    }
  }, []);

  // Save search history
  const saveSearchHistory = (newHistory: string[]) => {
    localStorage.setItem('gamestringer-search-history', JSON.stringify(newHistory));
  };

  // Add to history
  const addToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const newHistory = [
      searchQuery,
      ...searchHistory.filter(h => h !== searchQuery)
    ].slice(0, 10); // Keep only the last 10 searches
    
    setSearchHistory(newHistory);
    saveSearchHistory(newHistory);
  };

  // Generate suggestions based on games
  const generateSuggestions = useMemo(() => {
    const suggestions: SearchSuggestion[] = [];
    
    // Extract unique data
    const genres = [...new Set(games.map(g => g.genre).filter(Boolean))];
    const stores = [...new Set(games.map(g => g.store))];
    const tags = [...new Set(games.flatMap(g => g.tags || []))];
    const developers = [...new Set(games.map(g => g.developer).filter(Boolean))];
    const years = [...new Set(games.map(g => g.year).filter(Boolean))];

    // Add suggestions for genres
    genres.forEach(genre => {
      const count = games.filter(g => g.genre === genre).length;
      suggestions.push({
        type: 'genre',
        value: genre!,
        count,
        icon: <Filter className="h-4 w-4" />
      });
    });

    // Add suggestions for stores
    stores.forEach(store => {
      const count = games.filter(g => g.store === store).length;
      suggestions.push({
        type: 'store',
        value: store,
        count,
        icon: <Gamepad2 className="h-4 w-4" />
      });
    });

    // Add suggestions for popular tags
    tags.slice(0, 20).forEach(tag => {
      const count = games.filter(g => g.tags?.includes(tag)).length;
      suggestions.push({
        type: 'tag',
        value: tag,
        count,
        icon: <Star className="h-4 w-4" />
      });
    });

    // Add suggestions for developers
    developers.slice(0, 15).forEach(developer => {
      const count = games.filter(g => g.developer === developer).length;
      suggestions.push({
        type: 'developer',
        value: developer!,
        count,
        icon: <Zap className="h-4 w-4" />
      });
    });

    // Add suggestions for years
    years.slice(0, 10).forEach(year => {
      const count = games.filter(g => g.year === year).length;
      suggestions.push({
        type: 'year',
        value: year!.toString(),
        count,
        icon: <Calendar className="h-4 w-4" />
      });
    });

    return suggestions;
  }, [games]);

  // Calcola punteggio di rilevanza
  const calculateRelevanceScore = (game: Game, searchQuery: string): { score: number; matchedFields: string[] } => {
    const query = searchQuery.toLowerCase();
    let score = 0;
    const matchedFields: string[] = [];

    // Punteggi per diversi campi
    const fieldWeights = {
      name: 10,
      genre: 5,
      developer: 4,
      publisher: 3,
      tags: 2,
      description: 1,
      store: 1
    };

    // Check name (higher weight)
    if (game.name.toLowerCase().includes(query)) {
      score += fieldWeights.name;
      matchedFields.push('name');
      
      // Bonus for exact match or word start
      if (game.name.toLowerCase() === query) {
        score += 20;
      } else if (game.name.toLowerCase().startsWith(query)) {
        score += 10;
      }
    }

    // Check genre
    if (game.genre?.toLowerCase().includes(query)) {
      score += fieldWeights.genre;
      matchedFields.push('genre');
    }

    // Check developer
    if (game.developer?.toLowerCase().includes(query)) {
      score += fieldWeights.developer;
      matchedFields.push('developer');
    }

    // Check publisher
    if (game.publisher?.toLowerCase().includes(query)) {
      score += fieldWeights.publisher;
      matchedFields.push('publisher');
    }

    // Check tags
    if (game.tags?.some(tag => tag.toLowerCase().includes(query))) {
      score += fieldWeights.tags;
      matchedFields.push('tags');
    }

    // Check description
    if (game.description?.toLowerCase().includes(query)) {
      score += fieldWeights.description;
      matchedFields.push('description');
    }

    // Check store
    if (game.store.toLowerCase().includes(query)) {
      score += fieldWeights.store;
      matchedFields.push('store');
    }

    // Bonus for installed games
    if (game.isInstalled) {
      score += 2;
    }

    // Bonus for recently played games
    if (game.lastPlayed && game.lastPlayed > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      score += 3;
    }

    // Bonus for high rating
    if (game.rating && game.rating > 8) {
      score += 1;
    }

    return { score, matchedFields };
  };

  // Highlight matching text
  const highlightMatch = (text: string, query: string): string => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  // Perform search
  const performSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      onSearchResults(games);
      return;
    }

    const searchResults: SearchResult[] = [];

    games.forEach(game => {
      const { score, matchedFields } = calculateRelevanceScore(game, searchQuery);
      
      if (score > 0) {
        searchResults.push({
          game,
          score,
          matchedFields,
          highlightedName: highlightMatch(game.name, searchQuery)
        });
      }
    });

    // Sort by descending score
    searchResults.sort((a, b) => b.score - a.score);
    
    setResults(searchResults);
    onSearchResults(searchResults.map(r => r.game));
  };

  // Handle query change
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    onSearchChange?.(newQuery);
    performSearch(newQuery);
    
    // Show suggestions if query is short
    if (newQuery.length > 0 && newQuery.length < 3) {
      setIsOpen(true);
    }
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addToHistory(query.trim());
      performSearch(query);
      setIsOpen(false);
    }
  };

  // Filter suggestions based on query
  const filteredSuggestions = useMemo(() => {
    if (!query) return generateSuggestions.slice(0, 10);
    
    const queryLower = query.toLowerCase();
    return generateSuggestions
      .filter(s => s.value.toLowerCase().includes(queryLower))
      .slice(0, 8);
  }, [query, generateSuggestions]);

  // Select suggestion
  const selectSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.value);
    performSearch(suggestion.value);
    addToHistory(suggestion.value);
    setIsOpen(false);
  };

  // Select from history
  const selectFromHistory = (historyItem: string) => {
    setQuery(historyItem);
    performSearch(historyItem);
    setIsOpen(false);
  };

  // Clear search
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    onSearchResults(games);
    onSearchChange?.('');
  };

  return (
    <div className={`relative ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => setIsOpen(true)}
                  placeholder={placeholder}
                  className="pl-10 pr-10"
                />
                {query && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </div>
        </PopoverTrigger>
        
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandList>
              {/* Cronologia ricerche */}
              {searchHistory.length > 0 && !query && (
                <CommandGroup heading="Ricerche Recenti">
                  {searchHistory.slice(0, 5).map((item, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => selectFromHistory(item)}
                      className="cursor-pointer"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      {item}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Suggerimenti */}
              {filteredSuggestions.length > 0 && (
                <CommandGroup heading="Suggerimenti">
                  {filteredSuggestions.map((suggestion, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => selectSuggestion(suggestion)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {suggestion.icon}
                          <span>{suggestion.value}</span>
                          <Badge variant="secondary" className="text-xs">
                            {suggestion.type}
                          </Badge>
                        </div>
                        {suggestion.count && (
                          <Badge variant="outline" className="text-xs">
                            {suggestion.count}
                          </Badge>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Search results */}
              {query && results.length > 0 && (
                <CommandGroup heading={`Results (${results.length})`}>
                  {results.slice(0, 8).map((result, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => {
                        // You might want to implement selecting a specific game
                        setIsOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col gap-1">
                          <span 
                            dangerouslySetInnerHTML={{ 
                              __html: result.highlightedName 
                            }} 
                          />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{result.game.store}</span>
                            {result.game.genre && (
                              <>
                                <Separator orientation="vertical" className="h-3" />
                                <span>{result.game.genre}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.game.isInstalled && (
                            <Badge variant="secondary" className="text-xs">
                              Installed
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {result.score}
                          </Badge>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {query && results.length === 0 && (
                <CommandEmpty>
                  No results found for "{query}"
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Active results */}
      {query && (
        <div className="mt-2 text-sm text-muted-foreground">
          {results.length > 0 ? (
            <span>
              Found {results.length} results for "{query}"
            </span>
          ) : (
            <span>No results for "{query}"</span>
          )}
        </div>
      )}
    </div>
  );
};

export default IntelligentSearch;



