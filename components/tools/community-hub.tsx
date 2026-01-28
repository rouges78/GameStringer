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
import { GitHubDiscussions } from './github-discussions';

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
        return <Badge className="bg-orange-500"><Award className="w-3 h-3 mr-1" />{t('communityHub.featured')}</Badge>;
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
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={loadData}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('communityHub.refresh')}
        </Button>
        <Button 
          size="sm"
          onClick={() => setShowUploadDialog(true)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Upload className="h-4 w-4 mr-2" />
          {t('communityHub.uploadPack')}
        </Button>
      </div>

      {/* Compact Stats */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Package className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-sm font-bold">{stats.totalPacks}</p>
              <p className="text-[10px] text-muted-foreground">{t('communityHub.packs')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Download className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-bold">{(stats.totalDownloads / 1000).toFixed(1)}k</p>
              <p className="text-[10px] text-muted-foreground">download</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Users className="h-4 w-4 text-orange-400" />
            <div>
              <p className="text-sm font-bold">{stats.totalContributors}</p>
              <p className="text-[10px] text-muted-foreground">{t('communityHub.contributors')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <FileText className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-sm font-bold">{(stats.totalStrings / 1000).toFixed(0)}k</p>
              <p className="text-[10px] text-muted-foreground">stringhe</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Globe className="h-4 w-4 text-cyan-500" />
            <div>
              <p className="text-sm font-bold">{stats.languagesCovered}</p>
              <p className="text-[10px] text-muted-foreground">lingue</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <TrendingUp className="h-4 w-4 text-pink-500" />
            <div>
              <p className="text-sm font-bold">{stats.gamesCovered}</p>
              <p className="text-[10px] text-muted-foreground">giochi</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters - Compact */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('communityHub.searchPlaceholder')}
            value={filters.query}
            onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
            className="pl-10 h-9"
          />
        </div>
        <Select
          value={filters.targetLanguage || 'all'}
          onValueChange={(v) => setFilters(f => ({ ...f, targetLanguage: v === 'all' ? '' : v }))}
        >
          <SelectTrigger className="w-[140px] h-9">
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
          <SelectTrigger className="w-[130px] h-9">
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

      {/* Tabs */}
      <Tabs defaultValue="browse">
        <TabsList className="h-8">
          <TabsTrigger value="browse" className="text-xs h-7">{t('communityHub.browsePacks')}</TabsTrigger>
          <TabsTrigger value="featured" className="text-xs h-7">⭐ {t('communityHub.featured')}</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs h-7">{t('communityHub.recentActivity')}</TabsTrigger>
          <TabsTrigger value="discussions" className="text-xs h-7">💬 {t('communityHub.discussions') || 'Discussions'}</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3 mt-3">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {packs.map(pack => (
                <Card key={pack.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-3">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">
                            {getLanguageFlag(pack.sourceLanguage)}→{getLanguageFlag(pack.targetLanguage)}
                          </span>
                          {getStatusBadge(pack.status)}
                        </div>
                        <h3 className="font-semibold text-sm truncate">{pack.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{pack.gameName}</p>
                      </div>
                      <div className="flex items-center gap-0.5 text-yellow-500 ml-2">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="text-xs font-medium">{pack.rating.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-2 mb-2">
                      <Progress value={pack.completionPercentage} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground w-8">{pack.completionPercentage}%</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                      <span className="flex items-center gap-0.5">
                        <Download className="h-3 w-3" />
                        {pack.downloads.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <FileText className="h-3 w-3" />
                        {(pack.translatedStrings / 1000).toFixed(1)}k
                      </span>
                      {pack.tags.length > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{pack.tags[0]}</Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => handleViewPack(pack)}>
                        {t('communityHub.details')}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs bg-orange-500 hover:bg-orange-600"
                        onClick={() => handleDownloadPack(pack.id)}
                        disabled={isDownloading === pack.id || communityHubService.isPackInstalled(pack.id)}
                      >
                        {isDownloading === pack.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : communityHubService.isPackInstalled(pack.id) ? (
                          <><CheckCircle className="h-3 w-3 mr-1" />✓</>
                        ) : (
                          <><Download className="h-3 w-3 mr-1" />{t('communityHub.download')}</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="featured" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packs.filter(p => p.status === 'featured' || p.status === 'verified').slice(0, 6).map(pack => (
              <Card key={pack.id} className="border-2 border-orange-500/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-orange-500" />
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
                  <Button className="w-full bg-orange-500 hover:bg-orange-600" size="sm" onClick={() => handleViewPack(pack)}>
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
                      'bg-orange-500/10 text-orange-500'
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

        <TabsContent value="discussions" className="mt-4">
          <GitHubDiscussions />
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



