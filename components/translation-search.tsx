'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchFilters {
  text: string;
  status: string;
  gameId: string;
  targetLanguage: string;
  onlyManualEdits: boolean;
  onlyWithContext: boolean;
  confidenceMin: number;
}

interface TranslationSearchProps {
  games: Array<{ id: string; title: string }>;
  onSearch: (filters: SearchFilters) => void;
  isCompact?: boolean;
}

export function TranslationSearch({ games, onSearch, isCompact = false }: TranslationSearchProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    text: '',
    status: 'all',
    gameId: 'all',
    targetLanguage: 'all',
    onlyManualEdits: false,
    onlyWithContext: false,
    confidenceMin: 0
  });

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleReset = () => {
    const resetFilters = {
      text: '',
      status: 'all',
      gameId: 'all',
      targetLanguage: 'all',
      onlyManualEdits: false,
      onlyWithContext: false,
      confidenceMin: 0
    };
    setFilters(resetFilters);
    onSearch(resetFilters);
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (isCompact) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca traduzioni..."
            value={filters.text}
            onChange={(e) => updateFilter('text', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="pending">In attesa</SelectItem>
              <SelectItem value="completed">Completate</SelectItem>
              <SelectItem value="reviewed">Revisionate</SelectItem>
              <SelectItem value="edited">Modificate</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filters.gameId} onValueChange={(value) => updateFilter('gameId', value)}>
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i giochi</SelectItem>
              {games.map(game => (
                <SelectItem key={game.id} value={game.id}>
                  {game.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Ricerca Avanzata</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showAdvanced ? 'Nascondi' : 'Mostra'} Filtri
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ricerca base */}
        <div className="space-y-2">
          <Label htmlFor="search">Cerca nel testo</Label>
          <div className="flex space-x-2">
            <Input
              id="search"
              placeholder="Cerca in originale o traduzione..."
              value={filters.text}
              onChange={(e) => updateFilter('text', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filtri avanzati */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Stato</Label>
                  <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti gli stati</SelectItem>
                      <SelectItem value="pending">In attesa</SelectItem>
                      <SelectItem value="completed">Completate</SelectItem>
                      <SelectItem value="reviewed">Revisionate</SelectItem>
                      <SelectItem value="edited">Modificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="game">Gioco</Label>
                  <Select value={filters.gameId} onValueChange={(value) => updateFilter('gameId', value)}>
                    <SelectTrigger id="game">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i giochi</SelectItem>
                      {games.map(game => (
                        <SelectItem key={game.id} value={game.id}>
                          {game.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Lingua di destinazione</Label>
                  <Select value={filters.targetLanguage} onValueChange={(value) => updateFilter('targetLanguage', value)}>
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le lingue</SelectItem>
                      <SelectItem value="it">Italiano</SelectItem>
                      <SelectItem value="es">Spagnolo</SelectItem>
                      <SelectItem value="fr">Francese</SelectItem>
                      <SelectItem value="de">Tedesco</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="manual"
                    checked={filters.onlyManualEdits}
                    onCheckedChange={(checked) => updateFilter('onlyManualEdits', checked)}
                  />
                  <Label htmlFor="manual" className="text-sm font-normal cursor-pointer">
                    Solo modifiche manuali
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="context"
                    checked={filters.onlyWithContext}
                    onCheckedChange={(checked) => updateFilter('onlyWithContext', checked)}
                  />
                  <Label htmlFor="context" className="text-sm font-normal cursor-pointer">
                    Solo con contesto
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confidence">
                    Confidenza minima: {filters.confidenceMin}%
                  </Label>
                  <input
                    id="confidence"
                    type="range"
                    min="0"
                    max="100"
                    value={filters.confidenceMin}
                    onChange={(e) => updateFilter('confidenceMin', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={handleReset}>
                  <X className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  Cerca
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}