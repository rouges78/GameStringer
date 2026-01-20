'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Download, 
  Star, 
  Users, 
  Clock, 
  ExternalLink,
  RefreshCw,
  CheckCircle,
  Globe,
  FileText,
  Gamepad2,
  Heart,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkshopItem {
  id: string;
  title: string;
  description: string;
  author: string;
  gameName: string;
  targetLanguage: string;
  subscribers: number;
  favorites: number;
  views: number;
  rating: number;
  fileSize: number;
  updatedAt: string;
  tags: string[];
  isInstalled: boolean;
}

export function SteamWorkshopBrowser() {
  const [items, setItems] = useState<WorkshopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('it');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [installedItems, setInstalledItems] = useState<Set<string>>(new Set());
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(new Set());

  const searchWorkshop = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockItems: WorkshopItem[] = [
        {
          id: 'ws_001',
          title: 'Traduzione Italiana Completa',
          description: 'Traduzione completa del game in italiano con supporto per tutti i DLC.',
          author: 'ItalianTranslators',
          gameName: 'The Witcher 3',
          targetLanguage: 'it',
          subscribers: 125000,
          favorites: 8500,
          views: 450000,
          rating: 4.8,
          fileSize: 45000000,
          updatedAt: '2025-12-20',
          tags: ['italiano', 'completa', 'dlc'],
          isInstalled: false,
        },
        {
          id: 'ws_002',
          title: 'Italian Language Pack - UI e Dialoghi',
          description: 'Pack lingua italiana per interfaccia e dialoghi principali.',
          author: 'GameLocIT',
          gameName: 'Cyberpunk 2077',
          targetLanguage: 'it',
          subscribers: 89000,
          favorites: 5200,
          views: 320000,
          rating: 4.6,
          fileSize: 38000000,
          updatedAt: '2025-11-15',
          tags: ['italiano', 'ui', 'dialoghi'],
          isInstalled: false,
        },
        {
          id: 'ws_003',
          title: 'Elden Ring - Traduzione Fan-Made',
          description: 'Traduzione italiana realizzata dalla community. Include item, NPC e lore.',
          author: 'SoulsITA',
          gameName: 'Elden Ring',
          targetLanguage: 'it',
          subscribers: 156000,
          favorites: 12000,
          views: 580000,
          rating: 4.9,
          fileSize: 52000000,
          updatedAt: '2025-10-30',
          tags: ['italiano', 'completa', 'lore'],
          isInstalled: false,
        },
        {
          id: 'ws_004',
          title: 'GTA V - Localizzazione Migliorata',
          description: 'Migliora la traduzione ufficiale con correzioni e adattamenti.',
          author: 'GTAItalia',
          gameName: 'Grand Theft Auto V',
          targetLanguage: 'it',
          subscribers: 78000,
          favorites: 4100,
          views: 290000,
          rating: 4.5,
          fileSize: 28000000,
          updatedAt: '2025-09-10',
          tags: ['italiano', 'migliorata'],
          isInstalled: false,
        },
        {
          id: 'ws_005',
          title: 'Baldurs Gate 3 - ITA Complete',
          description: 'Traduzione completa italiana per BG3 con tutti i dialoghi.',
          author: 'BG3Italia',
          gameName: 'Baldurs Gate 3',
          targetLanguage: 'it',
          subscribers: 210000,
          favorites: 15000,
          views: 720000,
          rating: 4.9,
          fileSize: 85000000,
          updatedAt: '2025-12-28',
          tags: ['italiano', 'completa', 'dialoghi'],
          isInstalled: false,
        },
      ];

      let filtered = mockItems;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
          item.title.toLowerCase().includes(query) ||
          item.gameName.toLowerCase().includes(query) ||
          item.author.toLowerCase().includes(query)
        );
      }

      if (selectedLanguage !== 'all') {
        filtered = filtered.filter(item => item.targetLanguage === selectedLanguage);
      }

      if (sortBy === 'popular') filtered.sort((a, b) => b.subscribers - a.subscribers);
      if (sortBy === 'recent') filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      if (sortBy === 'rating') filtered.sort((a, b) => b.rating - a.rating);

      filtered = filtered.map(item => ({
        ...item,
        isInstalled: installedItems.has(item.id)
      }));

      setItems(filtered);
    } catch (error) {
      toast.error('Search error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedLanguage, sortBy, installedItems]);

  useEffect(() => {
    searchWorkshop();
  }, [searchWorkshop]);

  const downloadItem = useCallback(async (item: WorkshopItem) => {
    if (downloadingItems.has(item.id)) return;
    
    setDownloadingItems(prev => new Set(prev).add(item.id));
    
    try {
      toast.info(`Download: ${item.title}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setInstalledItems(prev => new Set(prev).add(item.id));
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, isInstalled: true } : i
      ));
      
      toast.success(`Downloaded: ${item.title}`);
    } catch (error) {
      toast.error(`Error: ${item.title}`);
    } finally {
      setDownloadingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [downloadingItems]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/80 via-blue-950/60 to-indigo-950/80 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
        
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/30">
              <Globe className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-300 to-blue-300 bg-clip-text text-transparent">
                Steam Workshop
              </h1>
              <p className="text-sm text-sky-200/60 mt-1">
                Download translations from the community
              </p>
            </div>
          </div>
          
          <div className="hidden md:flex gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-sky-400">
                <FileText className="h-4 w-4" />
                <span className="text-lg font-bold">{items.length}</span>
              </div>
              <p className="text-xs text-sky-200/50">Results</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-lg font-bold">{installedItems.size}</span>
              </div>
              <p className="text-xs text-sky-200/50">Installed</p>
            </div>
          </div>
        </div>

        <div className="relative flex flex-wrap gap-3 mt-6 pt-4 border-t border-sky-500/20">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400" />
              <Input
                placeholder="Search translations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-sky-950/50 border-sky-500/30"
              />
            </div>
          </div>
          
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-36 bg-sky-950/50 border-sky-500/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le lingue</SelectItem>
              <SelectItem value="it">Italiano</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Espanol</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="fr">Francais</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 bg-sky-950/50 border-sky-500/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Piu popolari</SelectItem>
              <SelectItem value="recent">Piu recenti</SelectItem>
              <SelectItem value="rating">Migliori voti</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="icon"
            onClick={searchWorkshop}
            disabled={loading}
            className="border-sky-500/30 hover:bg-sky-500/10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 text-sky-500 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Globe className="h-12 w-12 mb-3 opacity-30" />
              <p>No results found</p>
              <p className="text-xs mt-1">Try modifying your filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-border/50">
                {items.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
                        <Gamepad2 className="h-8 w-8 text-sky-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                              {item.title}
                              {item.isInstalled && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Installed
                                </Badge>
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.gameName} • di {item.author}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => window.open(`https://steamcommunity.com/sharedfiles/filedetails/?id=${item.id}`, '_blank')}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              className={`h-8 ${item.isInstalled 
                                ? 'bg-emerald-600 hover:bg-emerald-700' 
                                : 'bg-sky-600 hover:bg-sky-700'}`}
                              onClick={() => downloadItem(item)}
                              disabled={item.isInstalled || downloadingItems.has(item.id)}
                            >
                              {downloadingItems.has(item.id) ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : item.isInstalled ? (
                                <CheckCircle className="h-3.5 w-3.5" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              <span className="ml-1">
                                {item.isInstalled ? 'Installed' : 'Download'}
                              </span>
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {item.description}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <div className="flex items-center gap-1 text-xs text-amber-400">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            <span>{item.rating.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-sky-400">
                            <Users className="h-3.5 w-3.5" />
                            <span>{formatNumber(item.subscribers)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-pink-400">
                            <Heart className="h-3.5 w-3.5" />
                            <span>{formatNumber(item.favorites)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Eye className="h-3.5 w-3.5" />
                            <span>{formatNumber(item.views)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <FileText className="h-3.5 w-3.5" />
                            <span>{formatFileSize(item.fileSize)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{new Date(item.updatedAt).toLocaleDateString('it-IT')}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SteamWorkshopBrowser;



