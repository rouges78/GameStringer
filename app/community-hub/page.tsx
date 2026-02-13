'use client';

import { Globe } from 'lucide-react';
import { CommunityHub } from '@/components/tools/community-hub';
import { useTranslation } from '@/lib/i18n';

export default function CommunityHubPage() {
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto p-4 space-y-3">
      {/* Compact Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 p-3 text-white">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-black/30 rounded-lg border border-white/10">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">
                {t('communityHub.title')}
              </h1>
              <p className="text-white/60 text-[10px]">
                {t('communityHub.subtitle')}
              </p>
            </div>
          </div>
          
        </div>
      </div>
      
      <CommunityHub />
    </div>
  );
}



