'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  User,
  MapPin,
  Link as LinkIcon,
  Calendar,
  MessageSquare,
  Heart,
  Languages,
  Trophy,
  Users,
  UserPlus,
  UserMinus,
  Ban,
  Check,
  Clock,
  Edit,
  Share2,
  MoreHorizontal,
  Shield,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getProfile,
  getProfileByUsername,
  updateProfile,
  getFriends,
  sendFriendRequest,
  removeFriend,
  blockUser,
  getUserAchievements,
  getActivityFeed,
  type UserProfile,
  type Achievement,
  type ActivityItem
} from '@/lib/social/social';
import { getThreads, type ForumThread } from '@/lib/social/forum';
import { clientLogger } from '@/lib/client-logger';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';

// ─── ACHIEVEMENT BADGE ───────────────────────────────────────────────────────

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:scale-105"
      style={{ 
        backgroundColor: `${achievement.color}15`,
        borderColor: `${achievement.color}30`
      }}
    >
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${achievement.color}25`, color: achievement.color }}
      >
        <Trophy className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{achievement.name}</p>
        <p className="text-xs text-slate-400">{achievement.description}</p>
      </div>
    </div>
  );
}

// ─── ACTIVITY ITEM ───────────────────────────────────────────────────────────

function ActivityItemCard({ activity }: { activity: ActivityItem }) {
  const { t } = useTranslation();
  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case 'thread_created': return <MessageSquare className="h-4 w-4 text-blue-400" />;
      case 'post_created': return <MessageSquare className="h-4 w-4 text-emerald-400" />;
      case 'translation_shared': return <Languages className="h-4 w-4 text-purple-400" />;
      case 'friend_added': return <Users className="h-4 w-4 text-pink-400" />;
      case 'achievement_unlocked': return <Trophy className="h-4 w-4 text-amber-400" />;
      default: return <Star className="h-4 w-4 text-slate-400" />;
    }
  };

  const getActivityText = () => {
    switch (activity.activity_type) {
      case 'thread_created': return t('userProfile.noThreads').replace('Nessun thread creato', 'ha creato un nuovo thread');
      case 'post_created': return 'ha risposto a un thread';
      case 'translation_shared': return 'ha condiviso una traduzione';
      case 'friend_added': return 'ha aggiunto un nuovo amico';
      case 'achievement_unlocked': return 'ha sbloccato un achievement';
      default: return 'ha fatto qualcosa';
    }
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-700/50 last:border-0">
      <div className="mt-0.5">{getActivityIcon()}</div>
      <div className="flex-1">
        <p className="text-sm text-slate-300">{getActivityText()}</p>
        {activity.metadata && (
          <p className="text-xs text-slate-500 mt-0.5">
            {(activity.metadata as { title?: string }).title}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: it })}
        </p>
      </div>
    </div>
  );
}

// ─── THREAD CARD ─────────────────────────────────────────────────────────────

function ThreadCard({ thread }: { thread: ForumThread }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors cursor-pointer">
      <MessageSquare className="h-5 w-5 text-blue-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{thread.title}</p>
        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {thread.reply_count}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {thread.like_count}
          </span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale: it })}</span>
        </div>
      </div>
    </div>
  );
}

// ─── USER PROFILE ────────────────────────────────────────────────────────────

interface UserProfileProps {
  userId?: string;
  username?: string;
  /**
   * uid di Supabase Auth dell'utente corrente: `profile.user_id` è normalizzato
   * all'`id` di user_profiles (= uid Supabase), quindi l'id del profilo LOCALE
   * qui non combacia mai e il proprio profilo non risultava "proprio".
   */
  currentUserId?: string;
  onClose?: () => void;
}

export function UserProfileView({ userId, username, currentUserId, onClose }: UserProfileProps) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  // Caricamento fallito (rete/backend): va detto, non spacciato per "utente non trovato".
  const [loadFailed, setLoadFailed] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'friends'>('none');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    website: '',
    discord_tag: '',
    steam_id: '',
    avatar_url: '',
    banner_url: ''
  });

  const isOwnProfile = currentUserId && profile?.user_id === currentUserId;

  // ─── LOAD DATA ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      let profileData: UserProfile | null = null;
      
      if (userId) {
        profileData = await getProfile(userId);
      } else if (username) {
        profileData = await getProfileByUsername(username);
      }

      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setEditForm({
        display_name: profileData.display_name || '',
        bio: profileData.bio || '',
        location: profileData.location || '',
        website: profileData.website || '',
        discord_tag: profileData.discord_tag || '',
        steam_id: profileData.steam_id || '',
        avatar_url: profileData.avatar_url || '',
        banner_url: profileData.banner_url || ''
      });

      // Load additional data
      const [achievementsData, activitiesData, friendsData] = await Promise.all([
        getUserAchievements(profileData.user_id),
        getActivityFeed(profileData.user_id, 10),
        getFriends(profileData.user_id),
      ]);

      // Load user's threads
      const { threads: userThreads } = await getThreads({ 
        search: profileData.username,
        limit: 5 
      });

      setAchievements(achievementsData);
      setActivities(activitiesData);
      setFriends(friendsData);
      setThreads(userThreads);

      // Check friendship status with current user
      if (currentUserId && currentUserId !== profileData.user_id) {
        const currentUserFriends = await getFriends(currentUserId);
        const isFriend = currentUserFriends.some(f => f.user_id === profileData.user_id);
        setFriendshipStatus(isFriend ? 'friends' : 'none');
      }
    } catch (error) {
      clientLogger.error('[UserProfile] Error loading data:', error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [userId, username, currentUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── HANDLERS ──────────────────────────────────────────────────────────────

  const handleSendFriendRequest = async () => {
    if (!currentUserId || !profile) return;
    const success = await sendFriendRequest(currentUserId, profile.user_id);
    if (success) {
      setFriendshipStatus('pending');
    }
  };

  const handleRemoveFriend = async () => {
    if (!currentUserId || !profile) return;
    const success = await removeFriend(currentUserId, profile.user_id);
    if (success) {
      setFriendshipStatus('none');
    }
  };

  const handleBlockUser = async () => {
    if (!currentUserId || !profile) return;
    await blockUser(currentUserId, profile.user_id);
    onClose?.();
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    const success = await updateProfile(profile.user_id, editForm).catch(() => false);
    if (success) {
      setProfile({ ...profile, ...editForm });
      setIsEditing(false);
    } else {
      toast.error(t('common.impossibileSalvareLeModifiche'));
    }
  };

  // ─── LOADING ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!profile) {
    if (loadFailed) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <User className="h-16 w-16 text-slate-500 mb-4" />
          <p className="text-sm text-slate-400">{t('forum.backendUnavailable')}</p>
          <Button variant="outline" size="sm" onClick={loadData} className="mt-4">
            {t('common.retry')}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <User className="h-16 w-16 text-slate-500 mb-4" />
        <h3 className="text-lg font-semibold text-white">{t('userProfile.userNotFound')}</h3>
        <p className="text-sm text-slate-400">{t('userProfile.profileNotExist')}</p>
      </div>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto">
      {/* Banner & Avatar */}
      <div className="relative">
        <div 
          className="h-40 rounded-t-xl bg-gradient-to-r from-blue-600 to-purple-600"
          style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: 'cover' } : {}}
        />
        <div className="absolute -bottom-12 left-6 flex items-end gap-4">
          <Avatar className="h-24 w-24 border-4 border-slate-900">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="bg-slate-700 text-2xl">
              {profile.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Profile Header */}
      <div className="pt-14 px-6 pb-4 bg-slate-800/50 rounded-b-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">
                {profile.display_name || profile.username}
              </h1>
              {profile.is_verified && (
                <Badge className="bg-blue-500">
                  <Check className="h-3 w-3 mr-1" />
                  {t('userProfile.verified')}
                </Badge>
              )}
              {profile.is_moderator && (
                <Badge className="bg-purple-500">
                  <Shield className="h-3 w-3 mr-1" />
                  {t('userProfile.moderator')}
                </Badge>
              )}
            </div>
            <p className="text-slate-400">@{profile.username}</p>
            
            {profile.bio && (
              <p className="text-sm text-slate-300 mt-2 max-w-lg">{profile.bio}</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
              {profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </span>
              )}
              {profile.website && (
                <a 
                  href={profile.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:underline"
                >
                  <LinkIcon className="h-4 w-4" />
                  {t('userProfile.website')}
                </a>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {t('userProfile.memberSince')} {formatDistanceToNow(new Date(profile.created_at), { locale: it })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    {t('userProfile.editProfile')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('userProfile.editProfile')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
                      <div>
                        <label className="text-sm text-slate-400">{t('userProfile.displayName')}</label>
                        <Input
                          value={editForm.display_name}
                          onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                          placeholder={t('userProfile.displayNamePlaceholder')}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">{t('userProfile.avatarUrl')}</label>
                        <Input
                          value={editForm.avatar_url}
                          onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                          placeholder={t('userProfile.avatarUrlPlaceholder')}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">{t('userProfile.bannerUrl')}</label>
                        <Input
                          value={editForm.banner_url}
                          onChange={(e) => setEditForm({ ...editForm, banner_url: e.target.value })}
                          placeholder={t('userProfile.bannerUrlPlaceholder')}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">{t('userProfile.bio')}</label>
                        <Textarea
                          value={editForm.bio}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          placeholder={t('userProfile.bioPlaceholder')}
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">{t('userProfile.location')}</label>
                        <Input
                          value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          placeholder={t('userProfile.locationPlaceholder')}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">{t('userProfile.website')}</label>
                        <Input
                          value={editForm.website}
                          onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                          placeholder={t('userProfile.websitePlaceholder')}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">{t('userProfile.discordTag')}</label>
                        <Input
                          value={editForm.discord_tag}
                          onChange={(e) => setEditForm({ ...editForm, discord_tag: e.target.value })}
                          placeholder={t('userProfile.discordTagPlaceholder')}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">{t('userProfile.steamId')}</label>
                        <Input
                          value={editForm.steam_id}
                          onChange={(e) => setEditForm({ ...editForm, steam_id: e.target.value })}
                          placeholder={t('userProfile.steamIdPlaceholder')}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button onClick={handleSaveProfile} className="flex-1">
                          {t('userProfile.saveChanges')}
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">
                          {t('userProfile.cancel')}
                        </Button>
                      </div>
                    </div>
                </DialogContent>
              </Dialog>
            ) : (
              <>
                {friendshipStatus === 'none' && (
                  <Button onClick={handleSendFriendRequest} size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t('social.addFriend')}
                  </Button>
                )}
                {friendshipStatus === 'pending' && (
                  <Button variant="secondary" size="sm" disabled>
                    <Clock className="h-4 w-4 mr-2" />
                    {t('social.requestSent')}
                  </Button>
                )}
                {friendshipStatus === 'friends' && (
                  <Button variant="outline" size="sm" onClick={handleRemoveFriend}>
                    <UserMinus className="h-4 w-4 mr-2" />
                    {t('social.removeFriend')}
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Share2 className="h-4 w-4 mr-2" />
                      {t('userProfile.shareProfile')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-400" onClick={handleBlockUser}>
                      <Ban className="h-4 w-4 mr-2" />
                      {t('social.blockUser')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-6 pt-4 border-t border-slate-700/50">
          <div className="text-center">
            <div className="text-xl font-bold text-white">{profile.stats?.threads || 0}</div>
            <div className="text-xs text-slate-400">{t('userProfile.threads')}</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white">{profile.stats?.posts || 0}</div>
            <div className="text-xs text-slate-400">{t('userProfile.replies')}</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white">{profile.stats?.translations || 0}</div>
            <div className="text-xs text-slate-400">{t('userProfile.translations')}</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white">{profile.stats?.likes_received || 0}</div>
            <div className="text-xs text-slate-400">{t('userProfile.likesReceived')}</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white">{friends.length}</div>
            <div className="text-xs text-slate-400">{t('userProfile.friendsCount')}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="activity" className="mt-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="activity">{t('userProfile.activity')}</TabsTrigger>
          <TabsTrigger value="threads">{t('userProfile.threads')} ({threads.length})</TabsTrigger>
          <TabsTrigger value="achievements">Achievement ({achievements.length})</TabsTrigger>
          <TabsTrigger value="friends">{t('userProfile.friendsCount')} ({friends.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4">
          <div className="bg-slate-800/30 rounded-xl p-4">
            {activities.length > 0 ? (
              activities.map(activity => (
                <ActivityItemCard key={activity.id} activity={activity} />
              ))
            ) : (
              <p className="text-center text-slate-500 py-8">{t('userProfile.noActivity')}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="threads" className="mt-4">
          <div className="space-y-2">
            {threads.length > 0 ? (
              threads.map(thread => (
                <ThreadCard key={thread.id} thread={thread} />
              ))
            ) : (
              <p className="text-center text-slate-500 py-8">{t('userProfile.noThreads')}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {achievements.length > 0 ? (
              achievements.map(achievement => (
                <AchievementBadge key={achievement.id} achievement={achievement} />
              ))
            ) : (
              <p className="text-center text-slate-500 py-8 col-span-2">{t('userProfile.noAchievements')}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="friends" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {friends.length > 0 ? (
              friends.map(friend => (
                <div 
                  key={friend.user_id}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="bg-slate-700">
                      {friend.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">{friend.display_name || friend.username}</p>
                    <p className="text-xs text-slate-400">@{friend.username}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-8 col-span-4">{t('userProfile.noFriends')}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default UserProfileView;

