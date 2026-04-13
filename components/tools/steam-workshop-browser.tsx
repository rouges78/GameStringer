'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  Eye,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

interface WorkshopItem {
  publishedfileid: string;
  title: string;
  description: string;
  creator: string;
  creator_appid: number;
  consumer_appid: number;
  filename: string;
  file_size: number;
  preview_url: string;
  url: string;
  subscriptions: number;
  favorited: number;
  views: number;
  score: number;
  time_created: number;
  time_updated: number;
  tags: string[];
}

interface WorkshopSearchResult {
  items: WorkshopItem[];
  total: number;
}

interface SteamCredentials {
  api_key_encrypted: string;
  steam_id: string;
  saved_at: string;
  nonce: string;
}

export function SteamWorkshopBrowser() {
  const { t } = useTranslation();
  const [items, setItems] = useState<WorkshopItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appidFilter, setAppidFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [apiKey, setApiKey] = useState('');
  const [loadingKey, setLoadingKey] = useState(true);
  const [_hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const loadKey = async () => {
      try {
        const creds = await invoke<SteamCredentials>('load_steam_credentials');
        if (creds?.api_key_encrypted) {
          setApiKey(creds.api_key_encrypted);
        }
      } catch {
        // Nessuna credenziale Steam salvata
      } finally {
        setLoadingKey(false);
      }
    };
    loadKey();
  }, []);

  const searchWorkshop = useCallback(async () => {
    if (!apiKey) {
      toast.error('Configura prima Steam nella sezione Stores per usare il Workshop.');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const result = await invoke<WorkshopSearchResult>('search_steam_workshop', {
        apiKey,
        searchText: searchQuery || null,
        appid: appidFilter ? parseInt(appidFilter, 10) : null,
        page: 1,
        numperpage: 25,
        sortBy,
      });

      setItems(result.items);
      setTotalResults(result.total);
    } catch (error: unknown) {
      const msg = typeof error === 'string' ? error : (error instanceof Error ? error.message : 'Errore ricerca Workshop');
      toast.error(msg);
      setItems([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [apiKey, searchQuery, appidFilter, sortBy]);

  const openWorkshopPage = useCallback(async (url: string) => {
    try {
      await open(url);
    } catch {
      window.open(url, '_blank');
    }
  }, []);

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
      <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-950/80 via-amber-950/60 to-yellow-950/80 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
        
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30">
              <Globe className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-300 to-amber-300 bg-clip-text text-transparent">
                {t('workshop.title')}
              </h1>
              <p className="text-sm text-orange-200/60 mt-1">
                {t('workshop.subtitle')}
              </p>
              <button
                onClick={() => openWorkshopPage('https://steamcommunity.com/workshop/')}
                className="flex items-center gap-1.5 mt-2 text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                <span className="underline underline-offset-2">steamcommunity.com/workshop</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          <div className="hidden md:flex gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-orange-400">
                <FileText className="h-4 w-4" />
                <span className="text-lg font-bold">{totalResults}</span>
              </div>
              <p className="text-xs text-orange-200/50">{t('workshop.searchResults')}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-lg font-bold">{items.length}</span>
              </div>
              <p className="text-xs text-orange-200/50">Mostrati</p>
            </div>
          </div>
        </div>

        {!loadingKey && !apiKey && (
          <div className="relative mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-300 font-medium">Steam non configurato</span>
            </div>
            <p className="text-xs text-amber-200/60">
              Per usare il Workshop, configura prima le credenziali Steam nella sezione{' '}
              <button onClick={() => window.location.href = '/stores'} className="underline text-amber-400 hover:text-amber-300 font-medium">Stores</button>.
            </p>
          </div>
        )}

        <div className="relative flex flex-wrap gap-3 mt-6 pt-4 border-t border-orange-500/20">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400" />
              <Input
                placeholder={t('workshop.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchWorkshop(); }}
                className="pl-10 bg-orange-950/50 border-orange-500/30"
              />
            </div>
          </div>

          <Input
            placeholder="App ID (es. 292030)"
            value={appidFilter}
            onChange={(e) => setAppidFilter(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') searchWorkshop(); }}
            className="w-36 bg-orange-950/50 border-orange-500/30"
          />
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 bg-orange-950/50 border-orange-500/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">{t('workshop.popular')}</SelectItem>
              <SelectItem value="recent">{t('workshop.recent')}</SelectItem>
              <SelectItem value="rating">{t('workshop.subscribed')}</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="icon"
            onClick={searchWorkshop}
            disabled={loading}
            className="border-orange-500/30 hover:bg-orange-500/10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {apiKey && (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-2xs h-8 px-2 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Steam connesso
            </Badge>
          )}
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
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
                  <div key={item.publishedfileid} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-4">
                      {item.preview_url ? (
                        <img
                          src={item.preview_url}
                          alt={item.title}
                          className="flex-shrink-0 w-16 h-16 rounded-lg object-cover bg-orange-950/50"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                          <Gamepad2 className="h-8 w-8 text-orange-400" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-sm line-clamp-1">
                              {item.title}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              App {item.consumer_appid || item.creator_appid} • di {item.creator}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => openWorkshopPage(item.url)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 bg-orange-600 hover:bg-orange-700"
                              onClick={() => openWorkshopPage(item.url)}
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span className="ml-1">Download</span>
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {item.description}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <div className="flex items-center gap-1 text-xs text-amber-400">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            <span>{(item.score * 5).toFixed(1)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-orange-400">
                            <Users className="h-3.5 w-3.5" />
                            <span>{formatNumber(item.subscriptions)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-pink-400">
                            <Heart className="h-3.5 w-3.5" />
                            <span>{formatNumber(item.favorited)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Eye className="h-3.5 w-3.5" />
                            <span>{formatNumber(item.views)}</span>
                          </div>
                          {item.file_size > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <FileText className="h-3.5 w-3.5" />
                              <span>{formatFileSize(item.file_size)}</span>
                            </div>
                          )}
                          {item.time_updated > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{new Date(item.time_updated * 1000).toLocaleDateString('it-IT')}</span>
                            </div>
                          )}
                        </div>
                        
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-2xs px-1.5 py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
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



