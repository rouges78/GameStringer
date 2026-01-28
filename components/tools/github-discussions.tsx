'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { open } from '@tauri-apps/plugin-shell';
import {
  MessageSquare,
  ExternalLink,
  RefreshCw,
  ThumbsUp,
  MessageCircle,
  Clock,
  User,
  Plus,
  Tag,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Megaphone,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const GITHUB_REPO = 'rouges78/GameStringer';
const DISCUSSIONS_URL = `https://github.com/${GITHUB_REPO}/discussions`;

interface Discussion {
  id: string;
  number: number;
  title: string;
  body: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  category: {
    name: string;
    emoji: string;
  };
  createdAt: string;
  updatedAt: string;
  comments: {
    totalCount: number;
  };
  upvoteCount: number;
  answerChosenAt: string | null;
  url: string;
}

interface DiscussionsResponse {
  data?: {
    repository?: {
      discussions?: {
        nodes: Discussion[];
      };
    };
  };
}

const categoryIcons: Record<string, React.ReactNode> = {
  'Announcements': <Megaphone className="h-3 w-3" />,
  'General': <MessageSquare className="h-3 w-3" />,
  'Ideas': <Lightbulb className="h-3 w-3" />,
  'Q&A': <HelpCircle className="h-3 w-3" />,
  'Show and tell': <CheckCircle2 className="h-3 w-3" />,
};

const categoryColors: Record<string, string> = {
  'Announcements': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'General': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Ideas': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Q&A': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Show and tell': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

export function GitHubDiscussions() {
  const { t } = useTranslation();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiscussions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Usa API route locale che gestisce GraphQL/scraping
      const response = await fetch('/api/github-discussions');
      
      if (!response.ok) {
        throw new Error('Failed to fetch discussions');
      }
      
      const data = await response.json();
      setDiscussions(data);
    } catch (err) {
      console.error('Error fetching discussions:', err);
      setDiscussions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, []);

  const openInGitHub = async (url: string) => {
    try {
      await open(url);
    } catch (e) {
      // Fallback per browser
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium">{t('communityHub.discussions') || 'Discussions'}</span>
          <Badge variant="outline" className="text-[10px] h-5">
            {discussions.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => fetchDiscussions()}
          >
            <RefreshCw className="h-3 w-3" />
            {t('communityHub.refresh') || 'Aggiorna'}
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1 border-2 border-orange-500 bg-transparent hover:bg-orange-500/20 text-orange-400 hover:text-orange-300"
            onClick={() => openInGitHub(`${DISCUSSIONS_URL}/new`)}
          >
            <Plus className="h-3 w-3" />
            {t('communityHub.newDiscussion') || 'New Discussion'}
          </Button>
        </div>
      </div>

      {/* Discussions List */}
      {discussions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">{t('communityHub.noDiscussions') || 'No discussions yet'}</p>
            <p className="text-muted-foreground mb-4">{t('communityHub.beFirstToPost') || 'Be the first to start a discussion!'}</p>
            <Button
              className="border-2 border-orange-500 bg-transparent hover:bg-orange-500/20 text-orange-400 hover:text-orange-300"
              onClick={() => openInGitHub(`${DISCUSSIONS_URL}/new`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('communityHub.startDiscussion') || 'Start Discussion'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {discussions.map((discussion) => (
            <Card 
              key={discussion.id} 
              className="hover:border-violet-500/50 transition-colors cursor-pointer"
              onClick={() => openInGitHub(discussion.url)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={discussion.author.avatarUrl} />
                    <AvatarFallback className="bg-violet-500/20 text-violet-400 text-xs">
                      {discussion.author.login.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] h-5 px-1.5 gap-1 ${categoryColors[discussion.category.name] || 'bg-gray-500/20 text-gray-400'}`}
                      >
                        {categoryIcons[discussion.category.name] || <Tag className="h-3 w-3" />}
                        {discussion.category.name}
                      </Badge>
                      {discussion.answerChosenAt && (
                        <Badge className="text-[10px] h-5 px-1.5 bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('communityHub.answered') || 'Answered'}
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-sm text-violet-200 line-clamp-1 mb-1">
                      {discussion.title}
                    </h3>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {discussion.body}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {discussion.author.login}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(discussion.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {discussion.upvoteCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {discussion.comments.totalCount}
                      </span>
                    </div>
                  </div>

                  {/* External Link Icon */}
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Footer Link */}
      <div className="text-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-violet-400"
          onClick={() => openInGitHub(DISCUSSIONS_URL)}
        >
          {t('communityHub.viewAllOnGitHub') || 'View all discussions on GitHub'}
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
