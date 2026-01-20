'use client';

import { Users, MessageSquare, Share2, Trophy } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function CommunityPage() {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <div className="relative mb-6">
          <Users className="h-20 w-20 mx-auto text-orange-400/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-orange-500/10 animate-ping" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-foreground mb-2">{t('communityPage.title')}</h1>
        <p className="text-xl text-orange-400 font-semibold mb-4">{t('communityPage.comingSoon')}</p>
        
        <p className="text-muted-foreground mb-8">
          {t('communityPage.description')}
        </p>
        
        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-border/50">
            <MessageSquare className="h-4 w-4 text-orange-400" />
            <span>{t('communityPage.forum')}</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-border/50">
            <Share2 className="h-4 w-4 text-orange-400" />
            <span>{t('communityPage.sharing')}</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-border/50">
            <Trophy className="h-4 w-4 text-orange-400" />
            <span>{t('communityPage.leaderboards')}</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-border/50">
            <Users className="h-4 w-4 text-orange-400" />
            <span>{t('communityPage.collaborations')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}



