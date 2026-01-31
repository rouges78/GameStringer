'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Check, Image as ImageIcon, Grid3X3, Sparkles, Type, AlertCircle, ThumbsUp, User, RefreshCw, Key, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export function CoverPicker({ isOpen, onClose, appId, gameName, onCoverSelected, currentCover }: CoverPickerProps) {
  const [covers, setCovers] = useState<Cover[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCover, setSelectedCover] = useState<Cover | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'hero' | 'logo' | 'all'>('grid');
  const [saving, setSaving] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  const getApiKey = useCallback(() => {
    // Cerca API key nelle impostazioni
    const savedSettings = localStorage.getItem('gameStringerSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        return settings?.integrations?.steamGridDbApiKey || null;
      } catch (e) {}
    }
    // Fallback a utility prefs
    const utilityPrefs = localStorage.getItem('gamestringer_utility_prefs');
    if (utilityPrefs) {
      try {
        const prefs = JSON.parse(utilityPrefs);
        return prefs?.steamgriddb?.apiKey || null;
      } catch (e) {}
    }
    return null;
  }, []);

  const saveApiKey = (key: string) => {
    // Salva in utility prefs
    const utilityPrefs = localStorage.getItem('gamestringer_utility_prefs');
    let prefs = {};
    if (utilityPrefs) {
      try { prefs = JSON.parse(utilityPrefs); } catch (e) {}
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
      } catch (e) {}
    }
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      saveApiKey(tempApiKey.trim());
      setShowApiKeyInput(false);
      setError(null);
      toast.success('API Key salvata!');
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

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<{
        success: boolean;
        error?: string;
        covers: Cover[];
        game_name?: string;
        total: number;
      }>('fetch_steamgriddb_covers', {
        appId: appId,
        gameName: gameName,
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
    } catch (e) {
      console.error('CoverPicker fetch error:', e);
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
      toast.success('Cover aggiornata con successo!');
      onClose();
    } catch (e) {
      console.error('Error saving cover:', e);
      toast.error('Errore nel salvare la cover');
    } finally {
      setSaving(false);
    }
  };

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
            <ImageIcon className="h-5 w-5 text-blue-400" />
            Scegli Cover per {gameName}
          </DialogTitle>
          <DialogDescription>
            Seleziona la cover che preferisci da SteamGridDB
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between">
            <TabsList className="grid grid-cols-4 w-fit">
              <TabsTrigger value="grid" className="gap-1">
                <Grid3X3 className="h-3.5 w-3.5" />
                Grid
              </TabsTrigger>
              <TabsTrigger value="hero" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Hero
              </TabsTrigger>
              <TabsTrigger value="logo" className="gap-1">
                <Type className="h-3.5 w-3.5" />
                Logo
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1">
                <ImageIcon className="h-3.5 w-3.5" />
                Tutti
              </TabsTrigger>
            </TabsList>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchCovers(activeTab)}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Ricarica
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <span className="ml-2 text-muted-foreground">Caricamento cover...</span>
              </div>
            ) : showApiKeyInput ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <Key className="h-12 w-12 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold mb-2">API Key Richiesta</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Per cercare cover su SteamGridDB è necessaria una API Key gratuita.
                </p>
                <a 
                  href="https://www.steamgriddb.com/profile/preferences/api" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mb-4 underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ottieni la tua API Key gratuita
                </a>
                <div className="flex gap-2 w-full max-w-sm">
                  <Input
                    type="text"
                    placeholder="Incolla qui la tua API Key..."
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveApiKey} disabled={!tempApiKey.trim()}>
                    <Check className="h-4 w-4 mr-1" />
                    Salva
                  </Button>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
                <p className="text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchCovers(activeTab)}>
                  Riprova
                </Button>
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
                        ? "border-blue-500 ring-2 ring-blue-500/30 scale-[1.02]"
                        : "border-transparent hover:border-blue-500/50"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[460/215] bg-slate-800 relative">
                      <img
                        src={cover.thumb || cover.url}
                        alt={`Cover by ${cover.author}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* Selected overlay */}
                      {selectedCover?.id === cover.id && selectedCover?.type === cover.type && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="bg-blue-500 rounded-full p-2">
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
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              {getStyleLabel(cover.style)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Type badge */}
                    <div className="absolute top-1 right-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 gap-0.5 bg-black/60">
                        {getTypeIcon(cover.type)}
                        {cover.type}
                      </Badge>
                    </div>

                    {/* NSFW/Humor badges */}
                    {(cover.nsfw || cover.humor) && (
                      <div className="absolute top-1 left-1 flex gap-1">
                        {cover.nsfw && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">NSFW</Badge>
                        )}
                        {cover.humor && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-yellow-500/20 text-yellow-300 border-yellow-500/30">😄</Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="text-sm text-muted-foreground">
            {filteredCovers.length} cover disponibili
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button 
              onClick={handleSelectCover} 
              disabled={!selectedCover || saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Usa questa cover
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CoverPicker;
