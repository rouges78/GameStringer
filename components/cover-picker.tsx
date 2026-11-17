'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Check, Image as ImageIcon, Grid3X3, Sparkles, Type, AlertCircle, ThumbsUp, User, RefreshCw, Key, ExternalLink, Link2, Search, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { clientLogger } from '@/lib/client-logger';
import { isTauri } from '@/lib/tauri-api';

// Proxy JSON cross-mode: nel desktop (static export, niente route /api) usa il
// comando Rust `fetch_url_content`; in web/dev usa la route `/api/covers/proxy`.
// Ritorna l'oggetto JSON tipizzato o null su errore.
async function proxyJson<T = unknown>(targetUrl: string): Promise<T | null> {
  try {
    if (isTauri()) {
      const body = await invoke<string>('fetch_url_content', { url: targetUrl });
      return JSON.parse(body) as T;
    }
    const res = await fetch(`/api/covers/proxy?url=${encodeURIComponent(targetUrl)}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface Cover {
  id: number;
  url: string;
  thumb: string;
  width: number;
  height: number;
  style: string;
  author: string;
  type: 'grid' | 'hero' | 'logo';
  score: number;
  upvotes: number;
  downvotes: number;
  nsfw: boolean;
  humor: boolean;
}

interface CoverPickerProps {
  isOpen: boolean;
  onClose: () => void;
  appId: number;
  gameName: string;
  onCoverSelected: (coverUrl: string) => void;
  currentCover?: string;
}

export function CoverPicker({ isOpen, onClose, appId, gameName, onCoverSelected, currentCover: _currentCover }: CoverPickerProps) {
  const { t } = useTranslation();
  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'hero' | 'logo' | 'all'>('grid');
  const [saving, setSaving] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  
  // URL Manuale
  const [customUrl, setCustomUrl] = useState('');
  const [customUrlPreview, setCustomUrlPreview] = useState<string | null>(null);
  const [customUrlError, setCustomUrlError] = useState(false);
  
  // Source selection: 'steamgriddb' | 'igdb' | 'web' | 'custom'
  const [source, setSource] = useState<'steamgriddb' | 'igdb' | 'web' | 'custom'>('steamgriddb');
  
  // IGDB covers
  const [igdbCovers, setIgdbCovers] = useState<Cover[]>([]);
  const [igdbLoading, setIgdbLoading] = useState(false);
  const [igdbError, setIgdbError] = useState<string | null>(null);
  
  // Web search covers (MobyGames, LaunchBox, etc)
  const [webCovers, setWebCovers] = useState<Cover[]>([]);
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);

  const getApiKey = useCallback(() => {
    // Cerca API key nelle impostazioni
    const savedSettings = localStorage.getItem('gameStringerSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        return settings?.integrations?.steamGridDbApiKey || null;
      } catch {}
    }
    // Fallback a utility prefs
    const utilityPrefs = localStorage.getItem('gamestringer_utility_prefs');
    if (utilityPrefs) {
      try {
        const prefs = JSON.parse(utilityPrefs);
        return prefs?.steamgriddb?.apiKey || null;
      } catch {}
    }
    return null;
  }, []);

  const saveApiKey = (key: string) => {
    // Salva in utility prefs
    const utilityPrefs = localStorage.getItem('gamestringer_utility_prefs');
    let prefs = {};
    if (utilityPrefs) {
      try { prefs = JSON.parse(utilityPrefs); } catch {}
    }
    const newPrefs = { ...prefs, steamgriddb: { enabled: true, apiKey: key } };
    localStorage.setItem('gamestringer_utility_prefs', JSON.stringify(newPrefs));
    
    // Salva anche in gameStringerSettings per compatibilità
    const savedSettings = localStorage.getItem('gameStringerSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        settings.integrations = settings.integrations || {};
        settings.integrations.steamGridDbApiKey = key;
        localStorage.setItem('gameStringerSettings', JSON.stringify(settings));
      } catch {}
    }
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      saveApiKey(tempApiKey.trim());
      setShowApiKeyInput(false);
      setError(null);
      toast.success(t('common.apiKeySalvata'));
      fetchCovers(activeTab);
    }
  };

  const fetchCovers = useCallback(async (type: string) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setShowApiKeyInput(true);
      setError(null);
      return;
    }
    setShowApiKeyInput(false);

    // Validazione: se non abbiamo né appId né gameName, non possiamo cercare
    if ((!appId || appId === 0) && (!gameName || gameName.trim() === '')) {
      setError('Impossibile cercare cover: mancano appId e nome del gioco');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Assicurati che appId sia sempre un numero valido (non null/undefined)
      const validAppId = appId && appId > 0 ? appId : 0;
      
      const result = await invoke<{
        success: boolean;
        error?: string;
        covers: Cover[];
        game_name?: string;
        total: number;
      }>('fetch_steamgriddb_covers', {
        appId: validAppId,
        gameName: gameName || '',
        apiKey: apiKey,
        coverType: type
      });

      if (result.success) {
        setCovers(result.covers);
        if (result.covers.length === 0) {
          setError('Nessuna cover trovata per questo gioco.');
        }
      } else {
        setError(result.error || 'Errore durante la ricerca');
      }
    } catch (e: unknown) {
      clientLogger.error('CoverPicker fetch error:', e);
      setError('Errore di connessione a SteamGridDB');
    } finally {
      setLoading(false);
    }
  }, [appId, gameName, getApiKey]);

  useEffect(() => {
    if (isOpen) {
      fetchCovers(activeTab);
    }
  }, [isOpen, activeTab, fetchCovers]);

  const handleSelectCover = async () => {
    if (!selectedCover) return;

    setSaving(true);
    try {
      // Salva in cache locale
      const cacheId = appId > 0 ? String(appId) : gameName;
      await invoke('save_cover_cache', { 
        gameId: cacheId, 
        imageUrl: selectedCover.url 
      });
      
      onCoverSelected(selectedCover.url);
      toast.success(t('common.coverAggiornataConSuccesso'));
      onClose();
    } catch (e: unknown) {
      clientLogger.error('Error saving cover:', e);
      toast.error(t('common.erroreNelSalvareLaCover'));
    } finally {
      setSaving(false);
    }
  };

  // Gestione URL manuale
  const validateAndPreviewUrl = useCallback((url: string) => {
    setCustomUrl(url);
    setCustomUrlError(false);
    setCustomUrlPreview(null);
    
    if (!url.trim()) return;
    
    // Valida che sia un URL immagine valido
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const isImageUrl = imageExtensions.some(ext => url.toLowerCase().includes(ext)) || 
                       url.includes('steamcdn') || 
                       url.includes('cdn.akamai') ||
                       url.includes('images.igdb') ||
                       url.includes('steamgriddb');
    
    if (url.startsWith('http') && (isImageUrl || url.includes('steam'))) {
      setCustomUrlPreview(url);
    }
  }, []);

  const handleUseCustomUrl = async () => {
    if (!customUrlPreview) return;
    
    setSaving(true);
    try {
      const cacheId = appId > 0 ? String(appId) : gameName;
      await invoke('save_cover_cache', { 
        gameId: cacheId, 
        imageUrl: customUrlPreview 
      });
      
      onCoverSelected(customUrlPreview);
      toast.success(t('common.coverPersonalizzataSalvata'));
      onClose();
    } catch (e: unknown) {
      clientLogger.error('Error saving custom cover:', e);
      toast.error(t('common.erroreNelSalvareLaCover'));
    } finally {
      setSaving(false);
    }
  };

  // Cerca su IGDB
  const fetchIgdbCovers = useCallback(async () => {
    setIgdbLoading(true);
    setIgdbError(null);
    
    try {
      const result = await invoke<{
        success: boolean;
        error?: string;
        covers: Cover[];
      }>('fetch_igdb_covers', {
        gameName: gameName,
        appId: appId
      });
      
      if (result.success) {
        setIgdbCovers(result.covers);
        if (result.covers.length === 0) {
          setIgdbError('Nessuna cover trovata su IGDB per questo gioco.');
        }
      } else {
        setIgdbError(result.error || 'Errore durante la ricerca su IGDB');
      }
    } catch (e: unknown) {
      clientLogger.error('IGDB fetch error:', e);
      // Se il comando non esiste, mostra messaggio appropriato
      if (String(e).includes('not found') || String(e).includes('command')) {
        setIgdbError('Ricerca IGDB non ancora configurata. Usa URL manuale.');
      } else {
        setIgdbError('Errore di connessione a IGDB');
      }
    } finally {
      setIgdbLoading(false);
    }
  }, [gameName, appId]);

  // Cerca cover dal web (MobyGames, LaunchBox, GameFAQs, etc)
  const fetchWebCovers = useCallback(async () => {
    setWebLoading(true);
    setWebError(null);
    setWebCovers([]);
    
    const searchName = gameName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const covers: Cover[] = [];
    let coverId = 1000;
    
    try {
      // 1. MobyGames - ottima fonte per giochi classici
      try {
        const mobyData = await proxyJson<{ games?: Array<{ sample_cover?: { image?: string; thumbnail?: string } }> }>(`https://api.mobygames.com/v1/games?title=${encodeURIComponent(searchName)}&format=normal`);
        if (mobyData) {
          if (mobyData.games && mobyData.games.length > 0) {
            const game = mobyData.games[0];
            if (game.sample_cover?.image) {
              covers.push({
                id: coverId++,
                url: game.sample_cover.image,
                thumb: game.sample_cover.thumbnail || game.sample_cover.image,
                width: 600,
                height: 800,
                style: 'official',
                author: 'MobyGames',
                type: 'grid',
                score: 90,
                upvotes: 0,
                downvotes: 0,
                nsfw: false,
                humor: false,
              });
            }
          }
        }
      } catch {}
      
      // 2. LaunchBox rimosso — causa redirect loop e non ha API pubblica
      
      // 3. TheGamesDB
      try {
        const tgdbData = await proxyJson<{ data?: { games?: Array<{ id: number; boxart?: unknown }> } }>(`https://api.thegamesdb.net/v1/Games/ByGameName?apikey=1&name=${encodeURIComponent(searchName)}`);
        if (tgdbData) {
          if (tgdbData.data?.games && tgdbData.data.games.length > 0) {
            const game = tgdbData.data.games[0];
            if (game.boxart) {
              covers.push({
                id: coverId++,
                url: `https://cdn.thegamesdb.net/images/original/boxart/front/${game.id}-1.jpg`,
                thumb: `https://cdn.thegamesdb.net/images/thumb/boxart/front/${game.id}-1.jpg`,
                width: 600,
                height: 800,
                style: 'official',
                author: 'TheGamesDB',
                type: 'grid',
                score: 88,
                upvotes: 0,
                downvotes: 0,
                nsfw: false,
                humor: false,
              });
            }
          }
        }
      } catch {}
      
      // 4. Suggerisci ricerca Google Images
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(gameName + ' box art cover vertical')}&tbm=isch`;
      covers.push({
        id: coverId++,
        url: googleSearchUrl,
        thumb: '',
        width: 0,
        height: 0,
        style: 'alternate',
        author: '🔍 Cerca su Google Images',
        type: 'grid',
        score: 0,
        upvotes: 0,
        downvotes: 0,
        nsfw: false,
        humor: false,
      });
      
      if (covers.length > 1) {
        setWebCovers(covers.filter(c => c.thumb !== ''));
      } else {
        setWebError('Nessuna cover trovata. Prova con URL manuale o cerca su Google Images.');
      }
    } catch (e) {
      clientLogger.error('Web cover search error:', e);
      setWebError('Errore nella ricerca web. Usa URL manuale.');
    } finally {
      setWebLoading(false);
    }
  }, [gameName]);

  // Carica covers quando cambia sorgente
  useEffect(() => {
    if (!isOpen) return;
    
    if (source === 'steamgriddb') {
      fetchCovers(activeTab);
    } else if (source === 'igdb') {
      fetchIgdbCovers();
    } else if (source === 'web') {
      fetchWebCovers();
    }
  }, [source, isOpen]);

  const filteredCovers = activeTab === 'all' 
    ? covers 
    : covers.filter(c => c.type === activeTab);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'grid': return <Grid3X3 className="h-3 w-3" />;
      case 'hero': return <Sparkles className="h-3 w-3" />;
      case 'logo': return <Type className="h-3 w-3" />;
      default: return <ImageIcon className="h-3 w-3" />;
    }
  };

  const getStyleLabel = (style: string) => {
    const styles: Record<string, string> = {
      'alternate': 'Alternativa',
      'blurred': 'Sfocata',
      'white_logo': 'Logo Bianco',
      'material': 'Material',
      'no_logo': 'Senza Logo',
      'official': 'Ufficiale',
    };
    return styles[style] || style;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-noir-400" />
            {t('coverPicker.chooseCoverFor')} {gameName}
          </DialogTitle>
          <DialogDescription>
            {t('coverPicker.subtitle')}</DialogDescription>
        </DialogHeader>

        {/* Source Selection */}
        <div className="flex gap-2 mb-3">
          <Button
            variant={source === 'steamgriddb' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSource('steamgriddb')}
            className="gap-1.5"
          >
            <Database className="h-3.5 w-3.5" />
            SteamGridDB
          </Button>
          <Button
            variant={source === 'igdb' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSource('igdb')}
            className="gap-1.5"
          >
            <Search className="h-3.5 w-3.5" />
            IGDB
          </Button>
          <Button
            variant={source === 'web' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSource('web')}
            className="gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('coverPicker.webTab')}</Button>
          <Button
            variant={source === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSource('custom')}
            className="gap-1.5"
          >
            <Link2 className="h-3.5 w-3.5" />
            {t('coverPicker.manualUrl')}</Button>
        </div>

        {/* Custom URL Input */}
        {source === 'custom' ? (
          <div className="flex-1 flex flex-col">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('coverPickerComp.incollaUrlImmagine')}</label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder={t('coverPicker.urlPh')}
                    value={customUrl}
                    onChange={(e) => validateAndPreviewUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleUseCustomUrl} 
                    disabled={!customUrlPreview || saving}
                    className="bg-rouge-600 hover:bg-rouge-700"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('coverPicker.supportedFormats')}</p>
              </div>
              
              {/* Preview */}
              {customUrlPreview && (
                <div className="border rounded-lg p-4 bg-noir-900/50">
                  <p className="text-sm font-medium mb-2">{t('coverPickerComp.anteprima')}</p>
                  <div className="aspect-[460/215] bg-noir-800 rounded overflow-hidden max-w-md">
                    <img 
                      src={customUrlPreview} 
                      alt={t('coverPicker.previewAlt')} 
                      className="w-full h-full object-cover"
                      onError={() => {
                        setCustomUrlError(true);
                        setCustomUrlPreview(null);
                        toast.error(t('common.impossibileCaricareLimmmagine'));
                      }}
                    />
                  </div>
                </div>
              )}
              
              {customUrlError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {t('coverPicker.invalidUrl')}</div>
              )}
            </div>
          </div>
        ) : source === 'igdb' ? (
          <div className="flex-1 overflow-y-auto">
            {igdbLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-rouge-400" />
                <span className="ml-2 text-muted-foreground">{t('coverPickerComp.cercandoSuIgdb')}</span>
              </div>
            ) : igdbError ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle className="h-12 w-12 text-yellow-400 mb-3" />
                <p className="text-muted-foreground mb-2">{igdbError}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {t('coverPicker.tryManualUrl')}</p>
                <Button variant="outline" size="sm" onClick={fetchIgdbCovers}>
                  {t('coverPicker.retry')}</Button>
              </div>
            ) : igdbCovers.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {igdbCovers.map((cover) => (
                  <div
                    key={`igdb-${cover.id}`}
                    onClick={() => setSelectedCover(cover)}
                    className={cn(
                      "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200",
                      selectedCover?.id === cover.id
                        ? "border-rouge-500 ring-2 ring-rouge-500/30 scale-[1.02]"
                        : "border-transparent hover:border-rouge-500/50"
                    )}
                  >
                    <div className="aspect-[460/215] bg-noir-800 relative">
                      <img
                        src={cover.thumb || cover.url}
                        alt={t('coverPicker.igdbCoverAlt')}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Search className="h-12 w-12 text-noir-500 mb-3" />
                <p className="text-muted-foreground">{t('coverPickerComp.nessunaCoverTrovataSuIgdb')}</p>
              </div>
            )}
          </div>
        ) : source === 'web' ? (
          <div className="flex-1 overflow-y-auto">
            {webLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <span className="ml-2 text-muted-foreground">{t('coverPicker.searchingWeb')}</span>
              </div>
            ) : webError ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle className="h-12 w-12 text-yellow-400 mb-3" />
                <p className="text-muted-foreground mb-2">{webError}</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={fetchWebCovers}>
                    {t('coverPicker.retry')}</Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(gameName + ' box art cover')}&tbm=isch`, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    {t('coverPicker.searchGoogle')}</Button>
                </div>
              </div>
            ) : webCovers.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {t('coverPicker.webCoversInfo')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {webCovers.map((cover) => (
                    <div
                      key={`web-${cover.id}`}
                      onClick={() => setSelectedCover(cover)}
                      className={cn(
                        "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200",
                        selectedCover?.id === cover.id
                          ? "border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.02]"
                          : "border-transparent hover:border-emerald-500/50"
                      )}
                    >
                      <div className="aspect-[2/3] bg-noir-800 relative">
                        <img
                          src={cover.thumb || cover.url}
                          alt={t('coverPicker.webCoverAlt')}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <span className="text-2xs text-white/80">{cover.author}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center pt-4 border-t border-noir-700">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(gameName + ' box art cover vertical')}&tbm=isch`, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    {t('coverPicker.searchMoreGoogle')}</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Search className="h-12 w-12 text-noir-500 mb-3" />
                <p className="text-muted-foreground mb-4">{t('common.nessunaCoverTrovataSulWeb')}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(gameName + ' box art cover')}&tbm=isch`, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  {t('coverPicker.searchGoogleImages')}</Button>
              </div>
            )}
          </div>
        ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "grid" | "hero" | "logo")} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between">
            <TabsList className="grid grid-cols-4 w-fit">
              <TabsTrigger value="grid" className="gap-1">
                <Grid3X3 className="h-3.5 w-3.5" />
                {t('coverPicker.gridFilter')}</TabsTrigger>
              <TabsTrigger value="hero" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                {t('coverPicker.heroFilter')}</TabsTrigger>
              <TabsTrigger value="logo" className="gap-1">
                <Type className="h-3.5 w-3.5" />
                {t('coverPicker.logoFilter')}</TabsTrigger>
              <TabsTrigger value="all" className="gap-1">
                <ImageIcon className="h-3.5 w-3.5" />
                {t('coverPicker.allFilter')}</TabsTrigger>
            </TabsList>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchCovers(activeTab)}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              {t('coverPicker.reload')}</Button>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-noir-400" />
                <span className="ml-2 text-muted-foreground">{t('coverPickerComp.caricamentoCover')}</span>
              </div>
            ) : showApiKeyInput ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <Key className="h-12 w-12 text-noir-400 mb-3" />
                <h3 className="text-lg font-semibold mb-2">{t('coverPickerComp.apiKeyRichiesta')}</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  {t('coverPicker.apiKeyNeeded')}</p>
                <a 
                  href="https://www.steamgriddb.com/profile/preferences/api" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-noir-400 hover:text-noir-300 text-sm mb-4 underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('coverPicker.getApiKey')}</a>
                <div className="flex gap-2 w-full max-w-sm">
                  <Input
                    type="text"
                    placeholder={t('coverPicker.apiKeyPh')}
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveApiKey} disabled={!tempApiKey.trim()}>
                    <Check className="h-4 w-4 mr-1" />
                    {t('coverPicker.save')}</Button>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
                <p className="text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchCovers(activeTab)}>
                  {t('coverPicker.retry')}</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredCovers.map((cover) => (
                  <div
                    key={`${cover.type}-${cover.id}`}
                    onClick={() => setSelectedCover(cover)}
                    className={cn(
                      "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200",
                      selectedCover?.id === cover.id && selectedCover?.type === cover.type
                        ? "border-rouge-500 ring-2 ring-noir-500/30 scale-[1.02]"
                        : "border-transparent hover:border-noir-500/50"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[460/215] bg-noir-800 relative">
                      <img
                        src={cover.thumb || cover.url}
                        alt={`Cover by ${cover.author}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* Selected overlay */}
                      {selectedCover?.id === cover.id && selectedCover?.type === cover.type && (
                        <div className="absolute inset-0 bg-noir-500/20 flex items-center justify-center">
                          <div className="bg-rouge-500 rounded-full p-2">
                            <Check className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <div className="flex items-center gap-1 text-xs text-white/80">
                          <User className="h-3 w-3" />
                          <span className="truncate">{cover.author}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <span className="flex items-center gap-0.5 text-green-400">
                            <ThumbsUp className="h-3 w-3" />
                            {cover.upvotes}
                          </span>
                          {cover.style && (
                            <Badge variant="secondary" className="text-2xs px-1 py-0">
                              {getStyleLabel(cover.style)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Type badge */}
                    <div className="absolute top-1 right-1">
                      <Badge variant="secondary" className="text-2xs px-1.5 py-0.5 gap-0.5 bg-black/60">
                        {getTypeIcon(cover.type)}
                        {cover.type}
                      </Badge>
                    </div>

                    {/* NSFW/Humor badges */}
                    {(cover.nsfw || cover.humor) && (
                      <div className="absolute top-1 left-1 flex gap-1">
                        {cover.nsfw && (
                          <Badge variant="destructive" className="text-2xs px-1 py-0">NSFW</Badge>
                        )}
                        {cover.humor && (
                          <Badge variant="outline" className="text-2xs px-1 py-0 bg-yellow-500/20 text-yellow-300 border-yellow-500/30">😄</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="text-sm text-muted-foreground">
            {filteredCovers.length}  {t('coverPicker.coversAvailable')}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('coverPicker.cancel')}</Button>
            <Button 
              onClick={handleSelectCover} 
              disabled={!selectedCover || saving}
              className="bg-rouge-600 hover:bg-rouge-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('coverPicker.saving')}</>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t('coverPicker.useThisCover')}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CoverPicker;

