'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Download, 
  Upload, 
  Star,
  Search,
  TrendingUp,
  Clock,
  Package,
  Shield,
  MessageSquare,
  ThumbsUp,
  Filter,
  Globe,
  Gamepad2,
  Sparkles,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import {
  getCommunityPackages,
  getTrendingPackages,
  getRecentPackages,
  getCommunityStats,
  downloadPackageEntries,
  ratePackage,
  type CommunityPackage
} from '@/lib/community-hub';

const LANGUAGE_FLAGS: Record<string, string> = {
  'en': '🇬🇧',
  'it': '🇮🇹',
  'de': '🇩🇪',
  'es': '🇪🇸',
  'fr': '🇫🇷',
  'ja': '🇯🇵',
  'ko': '🇰🇷',
  'zh': '🇨🇳',
  'pt': '🇵🇹',
  'ru': '🇷🇺'
};

export function CommunityHub() {
  const [packages, setPackages] = useState<CommunityPackage[]>([]);
  const [trending, setTrending] = useState<CommunityPackage[]>([]);
  const [recent, setRecent] = useState<CommunityPackage[]>([]);
  const [stats, setStats] = useState<{
    totalPackages: number;
    totalDownloads: number;
    totalEntries: number;
    topLanguages: { lang: string; count: number }[];
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'recent'>('downloads');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<CommunityPackage | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    searchPackages();
  }, [searchQuery, selectedLanguage, sortBy]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allPackages, trendingPkgs, recentPkgs, communityStats] = await Promise.all([
        getCommunityPackages({ sortBy }),
        getTrendingPackages(5),
        getRecentPackages(5),
        getCommunityStats()
      ]);
      
      setPackages(allPackages);
      setTrending(trendingPkgs);
      setRecent(recentPkgs);
      setStats(communityStats);
    } catch (error) {
      console.error('Failed to load community data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchPackages = async () => {
    const results = await getCommunityPackages({
      search: searchQuery,
      targetLanguage: selectedLanguage || undefined,
      sortBy
    });
    setPackages(results);
  };

  const handleDownload = async (pkg: CommunityPackage) => {
    setDownloadingId(pkg.id);
    try {
      const entries = await downloadPackageEntries(pkg.id);
      
      // Create downloadable file
      const content = JSON.stringify({
        metadata: {
          name: pkg.name,
          game: pkg.gameName,
          sourceLanguage: pkg.sourceLanguage,
          targetLanguage: pkg.targetLanguage,
          author: pkg.author,
          version: pkg.version
        },
        entries
      }, null, 2);
      
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pkg.name.replace(/\s+/g, '_')}_TM.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      // Refresh to update download count
      loadData();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRate = async (pkg: CommunityPackage, rating: number) => {
    await ratePackage(pkg.id, rating);
    loadData();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const PackageCard = ({ pkg, compact = false }: { pkg: CommunityPackage; compact?: boolean }) => (
    <Card 
      className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-500/50 hover:-translate-y-1 bg-gradient-to-br from-white/5 to-transparent ${
        compact ? '' : ''
      }`}
      onClick={() => setSelectedPackage(pkg)}
    >
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold truncate ${compact ? 'text-sm' : ''}`}>
                {pkg.name}
              </h3>
              {pkg.verified && (
                <Shield className="h-4 w-4 text-green-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{pkg.gameName}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-lg">{LANGUAGE_FLAGS[pkg.sourceLanguage] || '🌐'}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-lg">{LANGUAGE_FLAGS[pkg.targetLanguage] || '🌐'}</span>
          </div>
        </div>
        
        {!compact && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {pkg.description}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500" />
              {pkg.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {formatNumber(pkg.downloads)}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Package className="h-3 w-3" />
              {formatNumber(pkg.entryCount)}
            </span>
          </div>
          <Badge variant="outline" className="text-[10px]">v{pkg.version}</Badge>
        </div>
        
        {!compact && pkg.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {pkg.tags.slice(0, 4).map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-600/30 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-black/20 backdrop-blur-sm shadow-lg">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="bg-black/20 backdrop-blur-sm rounded-lg px-2 py-1">
              <h2 className="text-lg font-bold text-white">Community Translation Hub</h2>
              <p className="text-white/90 text-[10px]">Share and download Translation Memory</p>
            </div>
          </div>
          
          <Button className="bg-white text-orange-600 hover:bg-white/90 shadow-lg" size="lg">
            <Upload className="h-5 w-5 mr-2" />
            Share Pack
          </Button>
        </div>
        
        {/* Stats in Header */}
        {stats && (
          <div className="relative grid grid-cols-4 gap-2 mt-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/20 flex items-center gap-2">
              <Package className="h-4 w-4 text-white/80" />
              <div>
                <p className="text-lg font-bold text-white leading-none">{stats.totalPackages}</p>
                <p className="text-[10px] text-white/60">Pacchetti</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/20 flex items-center gap-2">
              <Download className="h-4 w-4 text-white/80" />
              <div>
                <p className="text-lg font-bold text-white leading-none">{formatNumber(stats.totalDownloads)}</p>
                <p className="text-[10px] text-white/60">Download</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/20 flex items-center gap-2">
              <Globe className="h-4 w-4 text-white/80" />
              <div>
                <p className="text-lg font-bold text-white leading-none">{formatNumber(stats.totalEntries)}</p>
                <p className="text-[10px] text-white/60">Traduzioni</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/20 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/80" />
              <div>
                <p className="text-lg font-bold text-white leading-none">{stats.topLanguages[0]?.lang.toUpperCase() || 'IT'}</p>
                <p className="text-[10px] text-white/60">Top Lingua</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Old Stats Cards removed - now in header */}
      {false && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalPackages}</p>
                  <p className="text-xs text-muted-foreground">Pacchetti</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.totalDownloads)}</p>
                  <p className="text-xs text-muted-foreground">Download</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.totalEntries)}</p>
                  <p className="text-xs text-muted-foreground">Traduzioni</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.topLanguages[0]?.lang.toUpperCase() || 'IT'}</p>
                  <p className="text-xs text-muted-foreground">Top Lingua</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browse">Esplora</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="upload">Condividi</TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by game, name or tag..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="h-10 px-3 rounded-md border bg-background text-sm"
              >
                <option value="">All languages</option>
                <option value="it">🇮🇹 Italiano</option>
                <option value="en">🇬🇧 English</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="es">🇪🇸 Español</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="ja">🇯🇵 日本語</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 px-3 rounded-md border bg-background text-sm"
              >
                <option value="downloads">Most downloaded</option>
                <option value="rating">Top rated</option>
                <option value="recent">Most recent</option>
              </select>
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : packages.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nessun pacchetto trovato</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map(pkg => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Trending Tab */}
        <TabsContent value="trending" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trending */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  Più Popolari
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {trending.map((pkg, i) => (
                  <div 
                    key={pkg.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedPackage(pkg)}
                  >
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">{pkg.gameName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatNumber(pkg.downloads)}</p>
                      <p className="text-xs text-muted-foreground">download</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Aggiornati di Recente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recent.map(pkg => (
                  <div 
                    key={pkg.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedPackage(pkg)}
                  >
                    <Gamepad2 className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">{pkg.gameName}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(pkg.updatedAt).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-green-500" />
                Share your Translation Memory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Help the community by sharing your translations! Verified packages gain 
                more visibility and your profile will accumulate reputation.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="p-4 text-center">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <h4 className="font-medium">1. Export TM</h4>
                    <p className="text-xs text-muted-foreground">
                      From the Memory page, export your translations
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-500/10 border-blue-500/30">
                  <CardContent className="p-4 text-center">
                    <Upload className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                    <h4 className="font-medium">2. Upload</h4>
                    <p className="text-xs text-muted-foreground">
                      Add description, tags and game information
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-500/10 border-purple-500/30">
                  <CardContent className="p-4 text-center">
                    <Star className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                    <h4 className="font-medium">3. Earn Rep</h4>
                    <p className="text-xs text-muted-foreground">
                      Receive feedback and increase your reputation
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600">
                <Upload className="h-4 w-4 mr-2" />
                Upload Translation Memory
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Package Detail Dialog */}
      <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
        <DialogContent className="max-w-2xl">
          {selectedPackage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedPackage.name}
                  {selectedPackage.verified && (
                    <Badge className="bg-green-500">
                      <Shield className="h-3 w-3 mr-1" />
                      Verificato
                    </Badge>
                  )}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Game Info */}
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <Gamepad2 className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedPackage.gameName}</p>
                    <p className="text-sm text-muted-foreground">
                      {LANGUAGE_FLAGS[selectedPackage.sourceLanguage]} {selectedPackage.sourceLanguage.toUpperCase()} → {LANGUAGE_FLAGS[selectedPackage.targetLanguage]} {selectedPackage.targetLanguage.toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(selectedPackage.downloads)}</p>
                    <p className="text-xs text-muted-foreground">Download</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold flex items-center justify-center gap-1">
                      <Star className="h-5 w-5 text-yellow-500" />
                      {selectedPackage.rating.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedPackage.ratingCount} voti</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(selectedPackage.entryCount)}</p>
                    <p className="text-xs text-muted-foreground">Traduzioni</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatSize(selectedPackage.size)}</p>
                    <p className="text-xs text-muted-foreground">Dimensione</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Descrizione</h4>
                  <p className="text-sm text-muted-foreground">{selectedPackage.description}</p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {selectedPackage.tags.map(tag => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>

                {/* Author & Version */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Autore: <strong>{selectedPackage.author}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Versione: <strong>{selectedPackage.version}</strong>
                  </span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Vota:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => handleRate(selectedPackage, star)}
                        className="hover:scale-110 transition-transform"
                      >
                        <Star 
                          className={`h-6 w-6 ${
                            star <= Math.round(selectedPackage.rating) 
                              ? 'text-yellow-500 fill-yellow-500' 
                              : 'text-muted-foreground'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Download Button */}
                <Button
                  onClick={() => handleDownload(selectedPackage)}
                  disabled={downloadingId === selectedPackage.id}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-600"
                  size="lg"
                >
                  {downloadingId === selectedPackage.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5 mr-2" />
                      Download Translation Memory
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



