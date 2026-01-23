'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Download, 
  Star, 
  Search, 
  Upload,
  TrendingUp,
  Clock,
  Package,
  Filter,
  CheckCircle,
  ExternalLink,
  Heart,
  MessageSquare,
  Languages
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useTranslation } from '@/lib/i18n';
import {
  CommunityPackage,
  getCommunityPackages,
  getCommunityStats,
  downloadPackageEntries,
  ratePackage,
  getTrendingPackages,
  getRecentPackages
} from '@/lib/community-hub';

const LANGUAGE_FLAGS: Record<string, string> = {
  it: '🇮🇹',
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  pt: '🇵🇹',
  ru: '🇷🇺',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
  pl: '🇵🇱',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PackageCard({ pkg, onDownload }: { pkg: CommunityPackage; onDownload: () => void }) {
  const [isDownloading, setIsDownloading] = useState(false);
  
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const entries = await downloadPackageEntries(pkg.id);
      // In a real app, this would integrate with the TM system
      console.log(`Downloaded ${entries.length} entries`);
      onDownload();
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <Card className="hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-500/10">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{pkg.name}</h3>
              {pkg.verified && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{pkg.gameName}</p>
          </div>
          <div className="flex items-center gap-1 text-yellow-500">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium">{pkg.rating.toFixed(1)}</span>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {pkg.description}
        </p>
        
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {LANGUAGE_FLAGS[pkg.sourceLanguage] || pkg.sourceLanguage} → {LANGUAGE_FLAGS[pkg.targetLanguage] || pkg.targetLanguage}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {formatNumber(pkg.entryCount)} stringhe
          </Badge>
          {pkg.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/30">
              {tag}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {formatNumber(pkg.downloads)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {pkg.ratingCount}
            </span>
          </div>
          <Button 
            size="sm" 
            className="h-7 text-xs bg-gradient-to-r from-orange-600 to-amber-600"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? 'Download...' : 'Scarica'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommunityPage() {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<CommunityPackage[]>([]);
  const [trending, setTrending] = useState<CommunityPackage[]>([]);
  const [recent, setRecent] = useState<CommunityPackage[]>([]);
  const [stats, setStats] = useState<{ totalPackages: number; totalDownloads: number; totalEntries: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'recent'>('downloads');
  const [filterLang, setFilterLang] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, [sortBy, filterLang]);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pkgs, trendingPkgs, recentPkgs, communityStats] = await Promise.all([
        getCommunityPackages({ 
          sortBy, 
          targetLanguage: filterLang === 'all' ? undefined : filterLang,
          search: searchQuery || undefined
        }),
        getTrendingPackages(5),
        getRecentPackages(5),
        getCommunityStats()
      ]);
      
      setPackages(pkgs);
      setTrending(trendingPkgs);
      setRecent(recentPkgs);
      setStats(communityStats);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSearch = () => {
    loadData();
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 p-6 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Community Hub</h1>
              <p className="text-white/80 text-sm">Condividi e scarica Translation Memory dalla community</p>
            </div>
          </div>
          
          {stats && (
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                <Package className="w-4 h-4" />
                <div>
                  <p className="text-xs text-white/70">Pacchetti</p>
                  <p className="text-sm font-medium">{stats.totalPackages}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                <Download className="w-4 h-4" />
                <div>
                  <p className="text-xs text-white/70">Download</p>
                  <p className="text-sm font-medium">{formatNumber(stats.totalDownloads)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
                <Languages className="w-4 h-4" />
                <div>
                  <p className="text-xs text-white/70">Stringhe</p>
                  <p className="text-sm font-medium">{formatNumber(stats.totalEntries)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca pacchetti, giochi, autori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Select value={filterLang} onValueChange={setFilterLang}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Lingua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le lingue</SelectItem>
                <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
                <SelectItem value="fr">🇫🇷 Français</SelectItem>
                <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ordina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="downloads">Più scaricati</SelectItem>
                <SelectItem value="rating">Più votati</SelectItem>
                <SelectItem value="recent">Più recenti</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Cerca
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="col-span-3 space-y-4">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Tutti</TabsTrigger>
              <TabsTrigger value="trending">
                <TrendingUp className="w-4 h-4 mr-1" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="recent">
                <Clock className="w-4 h-4 mr-1" />
                Recenti
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {packages.map(pkg => (
                    <PackageCard key={pkg.id} pkg={pkg} onDownload={loadData} />
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="trending" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                {trending.map(pkg => (
                  <PackageCard key={pkg.id} pkg={pkg} onDownload={loadData} />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="recent" className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                {recent.map(pkg => (
                  <PackageCard key={pkg.id} pkg={pkg} onDownload={loadData} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Upload CTA */}
          <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/30">
            <CardContent className="p-4">
              <Upload className="w-8 h-8 text-orange-500 mb-2" />
              <h3 className="font-semibold mb-1">Condividi le tue TM</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Aiuta la community condividendo le tue Translation Memory
              </p>
              <Button className="w-full bg-gradient-to-r from-orange-600 to-amber-600" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Carica Pacchetto
              </Button>
            </CardContent>
          </Card>

          {/* Top Contributors */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                Top Contributori
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-3">
                {[
                  { name: 'TranslatorPro', downloads: 15420 },
                  { name: 'FarmTranslations', downloads: 28750 },
                  { name: 'DeterminedTeam', downloads: 42000 },
                ].map((user, i) => (
                  <div key={user.name} className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-500 text-yellow-900' :
                      i === 1 ? 'bg-gray-300 text-gray-700' :
                      'bg-orange-700 text-orange-100'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm flex-1">{user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(user.downloads)} ↓
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Popular Tags */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Tag Popolari</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-wrap gap-2">
                {['completo', 'indie', 'rpg', 'action', 'revisionato', 'dlc'].map(tag => (
                  <Badge 
                    key={tag} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-orange-500/20 hover:border-orange-500/50"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}



