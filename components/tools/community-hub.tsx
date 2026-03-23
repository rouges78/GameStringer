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
  Heart,
  Gamepad2,
  HardDrive,
  Bell,
  Bookmark,
  BookmarkCheck,
  Trophy,
  UserPlus,
  UserMinus,
  Send,
  ThumbsUp,
  Edit3,
  Trash2,
  Crown,
  Medal,
  Shield
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
  RETRO_PLATFORMS,
  type TranslationPack,
  type PackReview,
  type HubStats,
  type PackSearchFilters,
  type RetroPlatform
} from '@/lib/community-hub-service';
import {
  type PackComment,
  type LeaderboardEntry,
  type BadgeAward,
  type HubNotification,
  type HubUser,
  fetchComments,
  postComment,
  editComment as editCommentApi,
  deleteComment as deleteCommentApi,
  toggleCommentLike,
  fetchLeaderboard,
  toggleFavorite,
  getFavorites,
  isFavorite,
  fetchNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  followUser,
  unfollowUser,
  isFollowing,
  getFullProfile,
  getUserBadges,
  checkBadges,
  isBackendEnabled,
} from '@/lib/community-hub-backend';
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

// Sfondo tematico per card in base al gioco — gradiente sottile appena accennato
function getGameCardStyle(gameName: string, gameId: string): React.CSSProperties {
  const key = (gameName + ' ' + gameId).toLowerCase();
  // Mapping giochi → gradiente tematico (colore dominante del gioco)
  const themes: [string[], string][] = [
    [['final fantasy vi', 'ff6'], 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 50%, transparent 100%)'],     // viola — Terra/Esper
    [['final fantasy vii', 'ff7'], 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,95,70,0.06) 50%, transparent 100%)'],        // verde materia/lifestream
    [['chrono trigger', 'chrono'], 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(147,51,234,0.05) 50%, transparent 100%)'],      // blu/viola — portali temporali
    [['mother 3', 'mother'], 'linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(234,88,12,0.05) 50%, transparent 100%)'],             // arancio sunflower
    [['dragon quest', 'dq'], 'linear-gradient(135deg, rgba(234,179,8,0.08) 0%, rgba(161,98,7,0.05) 50%, transparent 100%)'],               // oro slime
    [['fire emblem', 'fe'], 'linear-gradient(135deg, rgba(220,38,38,0.07) 0%, rgba(153,27,27,0.04) 50%, transparent 100%)'],               // rosso fuoco
    [['mega man', 'megaman', 'rockman'], 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(29,78,216,0.05) 50%, transparent 100%)'],  // blu Mega Man
    [['pokemon', 'poke'], 'linear-gradient(135deg, rgba(250,204,21,0.08) 0%, rgba(234,179,8,0.05) 50%, transparent 100%)'],                // giallo Pikachu
    [['zelda', 'link'], 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(22,163,74,0.05) 50%, transparent 100%)'],                   // verde Link
    [['metroid', 'samus'], 'linear-gradient(135deg, rgba(249,115,22,0.07) 0%, rgba(194,65,12,0.04) 50%, transparent 100%)'],               // arancio suit
    [['castlevania', 'dracula'], 'linear-gradient(135deg, rgba(127,29,29,0.08) 0%, rgba(88,28,135,0.05) 50%, transparent 100%)'],          // rosso scuro gotico
    [['sonic'], 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.05) 50%, transparent 100%)'],                          // blu Sonic
    [['mario', 'super mario'], 'linear-gradient(135deg, rgba(220,38,38,0.07) 0%, rgba(234,179,8,0.04) 50%, transparent 100%)'],            // rosso/oro Mario
    [['kirby'], 'linear-gradient(135deg, rgba(244,114,182,0.08) 0%, rgba(236,72,153,0.05) 50%, transparent 100%)'],                        // rosa Kirby
    [['persona', 'shin megami'], 'linear-gradient(135deg, rgba(220,38,38,0.07) 0%, rgba(15,15,15,0.05) 50%, transparent 100%)'],           // rosso/nero Persona
  ];

  for (const [keywords, gradient] of themes) {
    if (keywords.some(kw => key.includes(kw))) {
      return { background: gradient };
    }
  }

  // Fallback: genera un colore dal hash del nome per avere comunque un tocco di colore
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { background: `linear-gradient(135deg, hsla(${hue},60%,50%,0.06) 0%, transparent 100%)` };
}

interface CommunityHubProps {
  initialAction?: string;
  initialQuery?: string;
  initialGameId?: string;
  initialGameName?: string;
}

export function CommunityHub({ initialAction, initialQuery, initialGameId, initialGameName }: CommunityHubProps) {
  const { t } = useTranslation();
  const [packs, setPacks] = useState<TranslationPack[]>([]);
  const [stats, setStats] = useState<HubStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<TranslationPack | null>(null);
  const [packReviews, setPackReviews] = useState<PackReview[]>([]);
  const [showPackDetails, setShowPackDetails] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // New community features state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [comments, setComments] = useState<PackComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [favoritePacks, setFavoritePacks] = useState<TranslationPack[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<HubNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');
  const [backendAvailable, setBackendAvailable] = useState(false);

  const [filters, setFilters] = useState<PackSearchFilters>({
    query: '',
    targetLanguage: '',
    platform: '',
    patchFormat: '',
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
    platform: '' as RetroPlatform | '',
    patchFormat: '' as 'ips' | 'bps' | 'xdelta' | 'none' | '',
    tags: '',
    files: [] as File[]
  });

  useEffect(() => {
    loadData();
    setBackendAvailable(isBackendEnabled());

    // Load community features if backend is available
    if (isBackendEnabled()) {
      loadLeaderboard();
      loadNotifications();
      loadFavorites();
    }

    // Handle URL params from Editor/Batch/Library
    if (initialQuery) {
      setFilters(f => ({ ...f, query: initialQuery }));
    }
    if (initialAction === 'publish') {
      setShowUploadDialog(true);
      if (initialGameName) {
        setUploadData(d => ({ ...d, gameName: initialGameName, gameId: initialGameId || '' }));
      }
    }
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

  const loadLeaderboard = async () => {
    try {
      const data = await fetchLeaderboard(20);
      setLeaderboard(data);
    } catch (e) { console.error('Leaderboard error:', e); }
  };

  const loadNotifications = async () => {
    try {
      const [notifs, count] = await Promise.all([fetchNotifications(20), getUnreadCount()]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (e) { console.error('Notifications error:', e); }
  };

  const loadFavorites = async () => {
    try {
      const favs = await getFavorites();
      setFavoritePacks(favs);
      setFavoriteIds(new Set(favs.map(p => p.id)));
    } catch (e) { console.error('Favorites error:', e); }
  };

  const handleToggleFavorite = async (packId: string) => {
    try {
      const nowFav = await toggleFavorite(packId);
      setFavoriteIds(prev => {
        const next = new Set(prev);
        nowFav ? next.add(packId) : next.delete(packId);
        return next;
      });
      toast.success(nowFav ? 'Aggiunto ai preferiti' : 'Rimosso dai preferiti');
      if (activeTab === 'favorites') loadFavorites();
    } catch (e: any) { toast.error(e.message || 'Errore preferiti'); }
  };

  const loadComments = async (packId: string) => {
    try {
      const data = await fetchComments(packId);
      setComments(data);
    } catch (e) { console.error('Comments error:', e); }
  };

  const handlePostComment = async (packId: string, parentId?: string) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;
    try {
      await postComment(packId, content.trim(), parentId);
      setNewComment('');
      setReplyContent('');
      setReplyTo(null);
      await loadComments(packId);
      toast.success('Commento pubblicato');
    } catch (e: any) { toast.error(e.message || 'Errore commento'); }
  };

  const handleDeleteComment = async (commentId: string, packId: string) => {
    try {
      await deleteCommentApi(commentId);
      await loadComments(packId);
      toast.success('Commento eliminato');
    } catch (e: any) { toast.error(e.message || 'Errore eliminazione'); }
  };

  const handleToggleCommentLike = async (commentId: string, packId: string) => {
    try {
      await toggleCommentLike(commentId);
      await loadComments(packId);
    } catch (e: any) { toast.error(e.message || 'Errore like'); }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) { console.error(e); }
  };

  const handleViewPack = async (pack: TranslationPack) => {
    setSelectedPack(pack);
    const reviews = await communityHubService.getPackReviews(pack.id);
    setPackReviews(reviews);
    setShowPackDetails(true);
    if (backendAvailable) {
      loadComments(pack.id);
    }
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
        platform: uploadData.platform || undefined,
        patchFormat: (uploadData.patchFormat || 'none') as any,
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
        platform: '',
        patchFormat: '',
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
        {backendAvailable && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) loadNotifications(); }}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            {showNotifications && (
              <div className="absolute right-0 top-10 z-50 w-80 bg-background border rounded-lg shadow-xl max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between p-3 border-b">
                  <span className="text-sm font-semibold">Notifiche</span>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleMarkAllRead}>
                      Segna tutte lette
                    </Button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Nessuna notifica</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-3 border-b last:border-0 text-sm ${!n.read ? 'bg-primary/5' : ''}`}>
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 p-1 rounded-full ${
                          n.type === 'badge_earned' ? 'bg-yellow-500/10 text-yellow-500' :
                          n.type === 'new_follower' ? 'bg-blue-500/10 text-blue-500' :
                          n.type === 'pack_comment' ? 'bg-green-500/10 text-green-500' :
                          'bg-orange-500/10 text-orange-500'
                        }`}>
                          {n.type === 'badge_earned' && <Award className="h-3 w-3" />}
                          {n.type === 'new_follower' && <UserPlus className="h-3 w-3" />}
                          {n.type === 'pack_comment' && <MessageSquare className="h-3 w-3" />}
                          {n.type === 'pack_review' && <Star className="h-3 w-3" />}
                          {!['badge_earned','new_follower','pack_comment','pack_review'].includes(n.type) && <Bell className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs">{n.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
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
          value={filters.platform || 'all'}
          onValueChange={(v) => setFilters(f => ({ ...f, platform: v === 'all' ? '' : v as RetroPlatform }))}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Piattaforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le piattaforme</SelectItem>
            {RETRO_PLATFORMS.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-8 flex-wrap">
          <TabsTrigger value="browse" className="text-xs h-7">{t('communityHub.browsePacks')}</TabsTrigger>
          <TabsTrigger value="retro" className="text-xs h-7">🎮 Retro Patches</TabsTrigger>
          <TabsTrigger value="featured" className="text-xs h-7">⭐ {t('communityHub.featured')}</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs h-7"><Trophy className="h-3 w-3 mr-1" />Classifica</TabsTrigger>
          {backendAvailable && (
            <TabsTrigger value="favorites" className="text-xs h-7"><Bookmark className="h-3 w-3 mr-1" />Preferiti</TabsTrigger>
          )}
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
                <Card key={pack.id} className="hover:border-primary/50 transition-colors" style={getGameCardStyle(pack.gameName, pack.gameId)}>
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
                        <p className="text-xs text-muted-foreground truncate">
                          {pack.platform && (
                            <span className="mr-1">{RETRO_PLATFORMS.find(p => p.id === pack.platform)?.icon}</span>
                          )}
                          {pack.gameName}
                        </p>
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
                      {pack.patchFormat && pack.patchFormat !== 'none' && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase">{pack.patchFormat}</Badge>
                      )}
                      {pack.tags.length > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{pack.tags[0]}</Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {backendAvailable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); handleToggleFavorite(pack.id); }}
                        >
                          {favoriteIds.has(pack.id) ? (
                            <BookmarkCheck className="h-3.5 w-3.5 text-orange-500" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      )}
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

        <TabsContent value="retro" className="space-y-3 mt-3">
          {/* Retro Patches - CDRomance alternative */}
          <div className="rounded-lg bg-gradient-to-r from-purple-500/10 via-fuchsia-500/5 to-pink-500/10 border border-purple-500/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-bold text-purple-300">Retro Translation Patches</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Patch di traduzione per giochi retro (NES, SNES, GBA, PS1, DS...). Scarica e applica direttamente con il patcher IPS/BPS integrato.</p>
          </div>

          {/* Platform quick filters */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={!filters.platform ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilters(f => ({ ...f, platform: '' }))}
            >
              Tutte
            </Button>
            {RETRO_PLATFORMS.filter(p => p.id !== 'other' && p.id !== 'pc_dos' && p.id !== 'pc_win').map(p => (
              <Button
                key={p.id}
                variant={filters.platform === p.id ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilters(f => ({ ...f, platform: f.platform === p.id ? '' : p.id }))}
              >
                {p.icon} {p.name.split(' / ')[0].split(' (')[0]}
              </Button>
            ))}
          </div>

          {/* Patch format filters */}
          <div className="flex gap-1.5">
            <Badge
              variant={!filters.patchFormat ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setFilters(f => ({ ...f, patchFormat: '' }))}
            >
              Tutti i formati
            </Badge>
            <Badge
              variant={filters.patchFormat === 'ips' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setFilters(f => ({ ...f, patchFormat: f.patchFormat === 'ips' ? '' : 'ips' }))}
            >
              <HardDrive className="h-3 w-3 mr-1" />IPS
            </Badge>
            <Badge
              variant={filters.patchFormat === 'bps' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setFilters(f => ({ ...f, patchFormat: f.patchFormat === 'bps' ? '' : 'bps' }))}
            >
              <HardDrive className="h-3 w-3 mr-1" />BPS
            </Badge>
            <Badge
              variant={filters.patchFormat === 'xdelta' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setFilters(f => ({ ...f, patchFormat: f.patchFormat === 'xdelta' ? '' : 'xdelta' }))}
            >
              <HardDrive className="h-3 w-3 mr-1" />xdelta
            </Badge>
          </div>

          {/* Filtered pack list */}
          {packs.filter(p => p.platform || p.patchFormat).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Gamepad2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Nessuna patch retro trovata</p>
                <p className="text-xs text-muted-foreground mt-1">Pubblica la tua traduzione retro con il pulsante Upload!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {packs.filter(p => p.platform || p.patchFormat).map(pack => (
                <Card key={pack.id} className="hover:border-purple-500/50 transition-colors" style={getGameCardStyle(pack.gameName, pack.gameId)}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">
                            {RETRO_PLATFORMS.find(p => p.id === pack.platform)?.icon || '🎮'}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4">
                            {RETRO_PLATFORMS.find(p => p.id === pack.platform)?.name.split(' / ')[0] || pack.platform}
                          </Badge>
                          {pack.patchFormat && pack.patchFormat !== 'none' && (
                            <Badge className="text-[10px] h-4 bg-purple-500/80 uppercase">{pack.patchFormat}</Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm truncate">{pack.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {getLanguageFlag(pack.sourceLanguage)} → {getLanguageFlag(pack.targetLanguage)} | {pack.gameName}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 text-yellow-500 ml-2">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="text-xs font-medium">{pack.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                      <span className="flex items-center gap-0.5"><Download className="h-3 w-3" />{pack.downloads.toLocaleString()}</span>
                      <span className="flex items-center gap-0.5"><FileText className="h-3 w-3" />{(pack.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => handleViewPack(pack)}>
                        {t('communityHub.details')}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs bg-purple-500 hover:bg-purple-600"
                        onClick={() => handleDownloadPack(pack.id)}
                        disabled={isDownloading === pack.id || communityHubService.isPackInstalled(pack.id)}
                      >
                        {isDownloading === pack.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : communityHubService.isPackInstalled(pack.id) ? (
                          <><CheckCircle className="h-3 w-3 mr-1" />Installata</>
                        ) : (
                          <><Download className="h-3 w-3 mr-1" />Scarica</>
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

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <CardTitle className="text-base">Classifica Traduttori</CardTitle>
              </div>
              <CardDescription>I migliori traduttori della community, ordinati per punteggio</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{backendAvailable ? 'Classifica vuota' : 'Configura Supabase nelle impostazioni per abilitare la classifica'}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                      i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                      i === 1 ? 'bg-slate-300/10 border border-slate-400/20' :
                      i === 2 ? 'bg-amber-700/10 border border-amber-700/20' :
                      'hover:bg-muted/50'
                    }`}>
                      {/* Rank */}
                      <div className="w-8 text-center">
                        {i === 0 ? <Crown className="h-5 w-5 text-yellow-500 mx-auto" /> :
                         i === 1 ? <Medal className="h-5 w-5 text-slate-400 mx-auto" /> :
                         i === 2 ? <Medal className="h-5 w-5 text-amber-700 mx-auto" /> :
                         <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>}
                      </div>
                      {/* Avatar */}
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={entry.avatar} />
                        <AvatarFallback className="text-xs">{entry.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm truncate">{entry.username}</span>
                          {entry.verifiedTranslator && <Shield className="h-3 w-3 text-blue-500" />}
                          {entry.country && <span className="text-xs">{entry.country}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{entry.publishedPacks} pack</span>
                          <span>{entry.totalDownloads.toLocaleString()} dl</span>
                          {entry.avgRating > 0 && <span>★ {entry.avgRating.toFixed(1)}</span>}
                          {entry.badgeCount > 0 && <span>{entry.badgeCount} badge</span>}
                        </div>
                      </div>
                      {/* Score */}
                      <div className="text-right">
                        <p className="text-sm font-bold text-orange-500">{entry.score.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">punti</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Favorites Tab */}
        {backendAvailable && (
          <TabsContent value="favorites" className="space-y-3 mt-3">
            {favoritePacks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">Nessun preferito</p>
                  <p className="text-muted-foreground text-sm">Usa il pulsante segnalibro sulle card per aggiungere pack ai preferiti</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {favoritePacks.map(pack => (
                  <Card key={pack.id} className="hover:border-primary/50 transition-colors" style={getGameCardStyle(pack.gameName, pack.gameId)}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm">{getLanguageFlag(pack.sourceLanguage)}→{getLanguageFlag(pack.targetLanguage)}</span>
                            {getStatusBadge(pack.status)}
                          </div>
                          <h3 className="font-semibold text-sm truncate">{pack.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{pack.gameName}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleToggleFavorite(pack.id)}
                          >
                            <BookmarkCheck className="h-3.5 w-3.5 text-orange-500" />
                          </Button>
                          <div className="flex items-center gap-0.5 text-yellow-500">
                            <Star className="h-3 w-3 fill-current" />
                            <span className="text-xs font-medium">{pack.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Progress value={pack.completionPercentage} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground w-8">{pack.completionPercentage}%</span>
                      </div>
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
        )}

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

                {/* Comments Section */}
                {backendAvailable && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Commenti ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
                    </h4>

                    {/* New comment input */}
                    <div className="flex gap-2 mb-4">
                      <Input
                        placeholder="Scrivi un commento..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(selectedPack.id); } }}
                        className="flex-1 h-9"
                      />
                      <Button
                        size="sm"
                        className="h-9"
                        onClick={() => handlePostComment(selectedPack.id)}
                        disabled={!newComment.trim()}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Comment list */}
                    <div className="space-y-3">
                      {comments.map(comment => (
                        <div key={comment.id} className="space-y-2">
                          {/* Root comment */}
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{comment.author.username}</span>
                                {comment.author.verifiedTranslator && <Shield className="h-3 w-3 text-blue-500" />}
                                {comment.edited && <span className="text-[10px] text-muted-foreground">(modificato)</span>}
                              </div>
                              <span className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm mb-2">{comment.content}</p>
                            <div className="flex items-center gap-3">
                              <button
                                className={`flex items-center gap-1 text-[11px] ${comment.likedByMe ? 'text-blue-500' : 'text-muted-foreground'} hover:text-blue-500 transition-colors`}
                                onClick={() => handleToggleCommentLike(comment.id, selectedPack.id)}
                              >
                                <ThumbsUp className="h-3 w-3" /> {comment.likes > 0 ? comment.likes : ''}
                              </button>
                              <button
                                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                              >
                                Rispondi
                              </button>
                            </div>
                          </div>

                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="ml-6 space-y-2">
                              {comment.replies.map(reply => (
                                <div key={reply.id} className="p-2.5 bg-muted/20 rounded-lg border-l-2 border-muted">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">{reply.author.username}</span>
                                      {reply.author.verifiedTranslator && <Shield className="h-2.5 w-2.5 text-blue-500" />}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{new Date(reply.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-xs">{reply.content}</p>
                                  <button
                                    className={`flex items-center gap-1 text-[10px] mt-1 ${reply.likedByMe ? 'text-blue-500' : 'text-muted-foreground'} hover:text-blue-500`}
                                    onClick={() => handleToggleCommentLike(reply.id, selectedPack.id)}
                                  >
                                    <ThumbsUp className="h-2.5 w-2.5" /> {reply.likes > 0 ? reply.likes : ''}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply input */}
                          {replyTo === comment.id && (
                            <div className="ml-6 flex gap-2">
                              <Input
                                placeholder="Rispondi..."
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(selectedPack.id, comment.id); } }}
                                className="flex-1 h-8 text-xs"
                                autoFocus
                              />
                              <Button size="sm" className="h-8" onClick={() => handlePostComment(selectedPack.id, comment.id)} disabled={!replyContent.trim()}>
                                <Send className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8" onClick={() => { setReplyTo(null); setReplyContent(''); }}>
                                ✕
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}

                      {comments.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-4">Nessun commento ancora. Sii il primo!</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                {backendAvailable && (
                  <Button
                    variant="outline"
                    onClick={() => handleToggleFavorite(selectedPack.id)}
                  >
                    {favoriteIds.has(selectedPack.id) ? (
                      <><BookmarkCheck className="h-4 w-4 mr-2 text-orange-500" />Preferito</>
                    ) : (
                      <><Bookmark className="h-4 w-4 mr-2" />Aggiungi ai preferiti</>
                    )}
                  </Button>
                )}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Piattaforma (retro)</Label>
                <Select
                  value={uploadData.platform || 'none'}
                  onValueChange={(v) => setUploadData(d => ({ ...d, platform: v === 'none' ? '' : v as RetroPlatform }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nessuna (gioco moderno)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna (gioco moderno)</SelectItem>
                    {RETRO_PLATFORMS.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Formato patch</Label>
                <Select
                  value={uploadData.patchFormat || 'none'}
                  onValueChange={(v) => setUploadData(d => ({ ...d, patchFormat: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna patch (solo testo)</SelectItem>
                    <SelectItem value="ips">IPS (classico, max 16MB)</SelectItem>
                    <SelectItem value="bps">BPS (moderno, con checksum)</SelectItem>
                    <SelectItem value="xdelta">xdelta / VCDIFF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  accept=".json,.po,.csv,.resx,.xliff,.xlf,.ips,.bps,.xdelta,.xd,.vcdiff"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setUploadData(d => ({ ...d, files }));
                    // Auto-detect patch format
                    const patchFile = files.find(f => /\.(ips|bps|xdelta|xd|vcdiff)$/i.test(f.name));
                    if (patchFile) {
                      const ext = patchFile.name.split('.').pop()?.toLowerCase();
                      const fmt = ext === 'ips' ? 'ips' : ext === 'bps' ? 'bps' : 'xdelta';
                      setUploadData(d => ({ ...d, files, patchFormat: fmt as any }));
                    } else {
                      setUploadData(d => ({ ...d, files }));
                    }
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">{t('communityHub.clickToSelect')}</p>
                  <p className="text-xs text-muted-foreground">JSON, PO, CSV, RESX, XLIFF, IPS, BPS, xdelta</p>
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



