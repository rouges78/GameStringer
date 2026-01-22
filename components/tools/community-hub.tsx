'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  Globe,
  Download,
  Upload,
  Star,
  Users,
  Search,
  Filter,
  Package,
  CheckCircle,
  Clock,
  TrendingUp,
  Award,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  FileText,
  RefreshCw,
  Plus,
  Eye,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  communityHubService,
  type TranslationPack,
  type PackReview,
  type HubStats,
  type PackSearchFilters
} from '@/lib/community-hub-service';

const languages = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export function CommunityHub() {
  const { t } = useTranslation();
  const [packs, setPacks] = useState<TranslationPack[]>([]);
  const [stats, setStats] = useState<HubStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<TranslationPack | null>(null);
  const [packReviews, setPackReviews] = useState<PackReview[]>([]);
  const [showPackDetails, setShowPackDetails] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const [filters, setFilters] = useState<PackSearchFilters>({
    query: '',
    targetLanguage: '',
    minRating: 0,
    sortBy: 'downloads',
    sortOrder: 'desc'
  });

  const [uploadData, setUploadData] = useState({
    name: '',
    gameName: '',
    gameId: '',
    description: '',
    sourceLanguage: 'en',
    targetLanguage: 'it',
    tags: '',
    files: [] as File[]
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    searchPacks();
  }, [filters]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [packsResult, hubStats] = await Promise.all([
        communityHubService.searchPacks(filters),
        communityHubService.getHubStats()
      ]);
      setPacks(packsResult.packs);
      setStats(hubStats);
    } catch (error) {
      console.error('Error loading hub data:', error);
      toast.error(t('communityHub.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  };

  const searchPacks = async () => {
    try {
      const result = await communityHubService.searchPacks(filters);
      setPacks(result.packs);
    } catch (error) {
      console.error('Error searching packs:', error);
    }
  };

  const handleViewPack = async (pack: TranslationPack) => {
    setSelectedPack(pack);
    const reviews = await communityHubService.getPackReviews(pack.id);
    setPackReviews(reviews);
    setShowPackDetails(true);
  };

  const handleDownloadPack = async (packId: string) => {
    setIsDownloading(packId);
    try {
      await communityHubService.downloadPack(packId, './translations');
      toast.success(t('communityHub.packDownloaded'));
      await loadData();
    } catch (error: any) {
      toast.error(error.message || t('communityHub.downloadError'));
    } finally {
      setIsDownloading(null);
    }
  };

  const handleUploadPack = async () => {
    if (!uploadData.name || !uploadData.gameName || uploadData.files.length === 0) {
      toast.error(t('communityHub.fillRequired'));
      return;
    }

    try {
      await communityHubService.createPack({
        name: uploadData.name,
        gameId: uploadData.gameId || uploadData.gameName.toLowerCase().replace(/\s+/g, '_'),
        gameName: uploadData.gameName,
        sourceLanguage: uploadData.sourceLanguage,
        targetLanguage: uploadData.targetLanguage,
        description: uploadData.description,
        tags: uploadData.tags.split(',').map(t => t.trim()).filter(Boolean),
        files: uploadData.files,
        author: {
          id: 'current_user',
          username: 'Tu',
          reputation: 100,
          totalContributions: 0,
          verifiedTranslator: false
        }
      });

      toast.success(t('communityHub.packCreated'));
      setShowUploadDialog(false);
      setUploadData({
        name: '',
        gameName: '',
        gameId: '',
        description: '',
        sourceLanguage: 'en',
        targetLanguage: 'it',
        tags: '',
        files: []
      });
      await loadData();
    } catch (error: any) {
      toast.error(error.message || t('communityHub.createError'));
    }
  };

  const getStatusBadge = (status: TranslationPack['status']) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />{t('communityHub.verified')}</Badge>;
      case 'featured':
        return <Badge className="bg-purple-500"><Award className="w-3 h-3 mr-1" />{t('communityHub.featured')}</Badge>;
      case 'published':
        return <Badge variant="secondary">{t('communityHub.published')}</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{t('communityHub.draft')}</Badge>;
    }
  };

  const getLanguageFlag = (code: string) => {
    return languages.find(l => l.code === code)?.flag || '🌐';
  };

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-3">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm shadow-lg">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
                {t('communityHub.title')}
              </h2>
              <p className="text-white/70 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                {t('communityHub.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={loadData}
              className="bg-white/20 text-white hover:bg-white/30 border-white/30"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('communityHub.refresh')}
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowUploadDialog(true)}
              className="bg-white text-indigo-600 hover:bg-white/90 shadow-lg"
            >
              <Upload className="h-4 w-4 mr-2" />
              {t('communityHub.uploadPack')}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Package className="h-6 w-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{stats.totalPacks}</p>
              <p className="text-xs text-muted-foreground">{t('communityHub.totalPacks')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Download className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{(stats.totalDownloads / 1000).toFixed(1)}k</p>
              <p className="text-xs text-muted-foreground">{t('communityHub.downloads')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{stats.totalContributors}</p>
              <p className="text-xs text-muted-foreground">{t('communityHub.contributors')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">{(stats.totalStrings / 1000).toFixed(0)}k</p>
              <p className="text-xs text-muted-foreground">{t('communityHub.strings')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Globe className="h-6 w-6 mx-auto mb-2 text-cyan-500" />
              <p className="text-2xl font-bold">{stats.languagesCovered}</p>
              <p className="text-xs text-muted-foreground">{t('communityHub.languages')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-pink-500" />
              <p className="text-2xl font-bold">{stats.gamesCovered}</p>
              <p className="text-xs text-muted-foreground">{t('communityHub.games')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('communityHub.searchPlaceholder')}
                  value={filters.query}
                  onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={filters.targetLanguage || 'all'}
              onValueChange={(v) => setFilters(f => ({ ...f, targetLanguage: v === 'all' ? '' : v }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('communityHub.languages')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('communityHub.allLanguages')}</SelectItem>
                {languages.map(l => (
                  <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.sortBy}
              onValueChange={(v: any) => setFilters(f => ({ ...f, sortBy: v }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('communityHub.sortBy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="downloads">{t('communityHub.mostDownloaded')}</SelectItem>
                <SelectItem value="rating">{t('communityHub.highestRated')}</SelectItem>
                <SelectItem value="updated">{t('communityHub.mostRecent')}</SelectItem>
                <SelectItem value="completion">{t('communityHub.completeness')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">{t('communityHub.browsePacks')}</TabsTrigger>
          <TabsTrigger value="featured">{t('communityHub.featured')}</TabsTrigger>
          <TabsTrigger value="activity">{t('communityHub.recentActivity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : packs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">{t('communityHub.noPacksFound')}</p>
                <p className="text-muted-foreground">{t('communityHub.tryModifyingFilters')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {packs.map(pack => (
                <Card key={pack.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(pack.status)}
                          <span className="text-lg">
                            {getLanguageFlag(pack.sourceLanguage)} → {getLanguageFlag(pack.targetLanguage)}
                          </span>
                        </div>
                        <CardTitle className="text-lg">{pack.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span className="font-medium">{pack.gameName}</span>
                          <span>•</span>
                          <span>v{pack.version}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="font-medium">{pack.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({pack.ratingCount})</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {pack.description}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{t('communityHub.completion')}</span>
                        <span className="font-medium">{pack.completionPercentage}%</span>
                      </div>
                      <Progress value={pack.completionPercentage} className="h-2" />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {pack.downloads.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {pack.translatedStrings.toLocaleString()} strings
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {pack.contributors.length + 1}
                      </span>
                    </div>
                    {pack.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {pack.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0 gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewPack(pack)}>
                      <Eye className="h-4 w-4 mr-1" />
                      {t('communityHub.details')}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownloadPack(pack.id)}
                      disabled={isDownloading === pack.id || communityHubService.isPackInstalled(pack.id)}
                    >
                      {isDownloading === pack.id ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : communityHubService.isPackInstalled(pack.id) ? (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      ) : (
                        <Download className="h-4 w-4 mr-1" />
                      )}
                      {communityHubService.isPackInstalled(pack.id) ? t('communityHub.installed') : t('communityHub.download')}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="featured" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packs.filter(p => p.status === 'featured' || p.status === 'verified').slice(0, 6).map(pack => (
              <Card key={pack.id} className="border-2 border-purple-500/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-purple-500" />
                    <CardTitle className="text-base">{pack.name}</CardTitle>
                  </div>
                  <CardDescription>{pack.gameName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span>{pack.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{pack.downloads.toLocaleString()} download</span>
                  </div>
                  <Button className="w-full" size="sm" onClick={() => handleViewPack(pack)}>
                    {t('communityHub.view')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('communityHub.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className={`p-2 rounded-full ${
                      activity.type === 'new_pack' ? 'bg-green-500/10 text-green-500' :
                      activity.type === 'update' ? 'bg-blue-500/10 text-blue-500' :
                      activity.type === 'milestone' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-purple-500/10 text-purple-500'
                    }`}>
                      {activity.type === 'new_pack' && <Plus className="h-4 w-4" />}
                      {activity.type === 'update' && <RefreshCw className="h-4 w-4" />}
                      {activity.type === 'milestone' && <Award className="h-4 w-4" />}
                      {activity.type === 'review' && <Star className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      {activity.gameName && (
                        <p className="text-xs text-muted-foreground">{activity.gameName}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pack Details Dialog */}
      <Dialog open={showPackDetails} onOpenChange={setShowPackDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPack && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedPack.status)}
                  <span className="text-lg">
                    {getLanguageFlag(selectedPack.sourceLanguage)} → {getLanguageFlag(selectedPack.targetLanguage)}
                  </span>
                </div>
                <DialogTitle className="text-xl">{selectedPack.name}</DialogTitle>
                <DialogDescription>
                  {selectedPack.gameName} • v{selectedPack.version}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Author */}
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={selectedPack.author.avatar} />
                    <AvatarFallback>{selectedPack.author.username[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {selectedPack.author.username}
                      {selectedPack.author.verifiedTranslator && (
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPack.author.totalContributions.toLocaleString()} {t('communityHub.contributions')}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{selectedPack.completionPercentage}%</p>
                    <p className="text-xs text-muted-foreground">{t('communityHub.completion')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{selectedPack.downloads.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{t('communityHub.downloads')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold flex items-center justify-center gap-1">
                      <Star className="h-5 w-5 text-yellow-500 fill-current" />
                      {selectedPack.rating.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedPack.ratingCount} {t('communityHub.votes')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{selectedPack.translatedStrings.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{t('communityHub.strings')}</p>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">{t('communityHub.description')}</h4>
                  <p className="text-sm text-muted-foreground">{selectedPack.description}</p>
                </div>

                {/* Changelog */}
                {selectedPack.changelog.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{t('communityHub.changelog')}</h4>
                    <div className="space-y-2">
                      {selectedPack.changelog.slice(0, 3).map((log, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium">v{log.version} - {log.date}</p>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {log.changes.map((change, j) => (
                              <li key={j}>{change}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {packReviews.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">{t('communityHub.reviews')}</h4>
                    <div className="space-y-3">
                      {packReviews.map(review => (
                        <div key={review.id} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{review.author.username}</span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{review.title}</p>
                          <p className="text-sm text-muted-foreground">{review.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPackDetails(false)}>
                  {t('communityHub.close')}
                </Button>
                <Button
                  onClick={() => {
                    handleDownloadPack(selectedPack.id);
                    setShowPackDetails(false);
                  }}
                  disabled={communityHubService.isPackInstalled(selectedPack.id)}
                >
                  {communityHubService.isPackInstalled(selectedPack.id) ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('communityHub.alreadyInstalled')}
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      {t('communityHub.downloadPack')}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('communityHub.uploadTitle')}</DialogTitle>
            <DialogDescription>
              {t('communityHub.uploadSubtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('communityHub.packName')} *</Label>
                <Input
                  value={uploadData.name}
                  onChange={(e) => setUploadData(d => ({ ...d, name: e.target.value }))}
                  placeholder={t('communityHub.packNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('communityHub.gameName')} *</Label>
                <Input
                  value={uploadData.gameName}
                  onChange={(e) => setUploadData(d => ({ ...d, gameName: e.target.value }))}
                  placeholder={t('communityHub.gameNamePlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('communityHub.sourceLanguage')}</Label>
                <Select
                  value={uploadData.sourceLanguage}
                  onValueChange={(v) => setUploadData(d => ({ ...d, sourceLanguage: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(l => (
                      <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('communityHub.targetLanguage')}</Label>
                <Select
                  value={uploadData.targetLanguage}
                  onValueChange={(v) => setUploadData(d => ({ ...d, targetLanguage: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(l => (
                      <SelectItem key={l.code} value={l.code}>{l.flag} {l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('communityHub.description')}</Label>
              <Textarea
                value={uploadData.description}
                onChange={(e) => setUploadData(d => ({ ...d, description: e.target.value }))}
                placeholder={t('communityHub.descriptionPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('communityHub.tags')}</Label>
              <Input
                value={uploadData.tags}
                onChange={(e) => setUploadData(d => ({ ...d, tags: e.target.value }))}
                placeholder={t('communityHub.tagsPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('communityHub.translationFiles')} *</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  accept=".json,.po,.csv,.resx,.xliff,.xlf"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setUploadData(d => ({ ...d, files }));
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">{t('communityHub.clickToSelect')}</p>
                  <p className="text-xs text-muted-foreground">JSON, PO, CSV, RESX, XLIFF</p>
                </label>
              </div>
              {uploadData.files.length > 0 && (
                <div className="space-y-1">
                  {uploadData.files.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4" />
                      <span>{file.name}</span>
                      <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              {t('communityHub.cancel')}
            </Button>
            <Button onClick={handleUploadPack}>
              <Upload className="h-4 w-4 mr-2" />
              {t('communityHub.createPack')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CommunityHub;



