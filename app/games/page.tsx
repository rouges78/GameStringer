
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  RefreshCw, 
  ServerCrash, 
  Gamepad2,
  Filter,
  ArrowDownUp
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Image from 'next/image';
import type { Game } from '@prisma/client';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: React.ElementType, color: string }) => (
  <Card className="bg-card/50 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className={`h-5 w-5 ${color}`} />
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </CardContent>
  </Card>
);

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('title-asc');

  const loadGames = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/games');
      if (!response.ok) throw new Error('Errore nel caricamento della libreria.');
      const data = await response.json();
      setGames(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto.');
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  const platforms = useMemo(() => ['all', ...Array.from(new Set(games.map(g => g.platform)))], [games]);

  const filteredAndSortedGames = useMemo(() => {
    return games
      .filter(game => 
        game.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (platformFilter === 'all' || game.platform === platformFilter)
      )
      .sort((a, b) => {
        switch (sortOrder) {
          case 'title-desc':
            return b.title.localeCompare(a.title);
          case 'date-asc':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case 'date-desc':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'title-asc':
          default:
            return a.title.localeCompare(b.title);
        }
      });
  }, [games, searchTerm, platformFilter, sortOrder]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libreria Giochi</h1>
        <p className="text-muted-foreground">Gestisci la tua collezione di {games.length} giochi</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Giochi Manuali" value="0" icon={Gamepad2} color="text-blue-400" />
        <StatCard title="Installati" value={games.length} icon={Gamepad2} color="text-green-400" />
        <StatCard title="Traducibili" value="0" icon={Gamepad2} color="text-purple-400" />
        <StatCard title="Piattaforme" value={platforms.length - 1} icon={Gamepad2} color="text-orange-400" />
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cerca giochi..."
            className="pl-10 w-full bg-background/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-full md:w-[180px] bg-background/50">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtra per piattaforma" />
            </SelectTrigger>
            <SelectContent>
              {platforms.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'Tutte le piattaforme' : p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full md:w-[180px] bg-background/50">
              <ArrowDownUp className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ordina per" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title-asc">Nome (A-Z)</SelectItem>
              <SelectItem value="title-desc">Nome (Z-A)</SelectItem>
              <SelectItem value="date-desc">Più Recenti</SelectItem>
              <SelectItem value="date-asc">Meno Recenti</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-red-500 flex flex-col items-center justify-center gap-4 p-16 bg-destructive/10 rounded-lg">
          <ServerCrash className="h-10 w-10" />
          <p className="font-semibold">Errore nel caricamento: {error}</p>
          <Button onClick={loadGames}>Riprova</Button>
        </div>
      ) : filteredAndSortedGames.length > 0 ? (
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filteredAndSortedGames.map(game => (
            <motion.div key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card className="group overflow-hidden rounded-lg border-2 border-transparent hover:border-primary/50 transition-all duration-300 bg-card/50 backdrop-blur-sm h-full flex flex-col">
                <Link href={`/translator/${game.id}`} className="block flex-grow flex flex-col">
                  <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden rounded-t-lg">
                    {game.imageUrl ? (
                      <Image
                        src={game.imageUrl}
                        alt={`Copertina di ${game.title}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gamepad2 className="w-12 h-12 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3 flex-grow flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{game.title}</h3>
                      <Badge variant="outline" className="mt-1.5 text-xs">{game.platform}</Badge>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : (
         <div className="text-center p-16 bg-background/30 rounded-lg">
            <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">Nessun gioco trovato</h3>
            <p className="text-muted-foreground mt-2">
              {searchTerm || platformFilter !== 'all' 
                ? 'Prova a modificare i filtri per trovare quello che cerchi.' 
                : 'La tua libreria è vuota. Vai alla Dashboard per scansionare i tuoi giochi.'}
            </p>
          </div>
      )}
    </div>
  );
}
