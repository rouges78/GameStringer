'use client';

import { Globe } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { CommunityHub } from '@/components/tools/community-hub';
import { useTranslation } from '@/lib/i18n';

export default function CommunityHubPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const action = searchParams.get('action') || undefined;
  const query = searchParams.get('query') || undefined;
  const gameId = searchParams.get('gameId') || undefined;
  const gameName = searchParams.get('gameName') ? decodeURIComponent(searchParams.get('gameName')!) : undefined;
  
  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-3" style={{ background: 'linear-gradient(180deg, #1b2838 0%, #171d25 40%, #0e1419 100%)' }}>
      {/* Compact Hero Header — Steam style */}
      <div className="relative overflow-hidden rounded-sm bg-[#1b2838]/80 border border-[#2a475e]/30 p-3">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#1a9fff]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1a9fff]/10 rounded-sm border border-[#1a9fff]/20">
              <Globe className="h-5 w-5 text-[#67c1f5]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#c6d4df]">
                {t('communityHub.title')}
              </h1>
              <p className="text-[#8f98a0] text-2xs">
                {t('communityHub.subtitle')}
              </p>
            </div>
          </div>
          
        </div>
      </div>
      
      <CommunityHub
        initialAction={action}
        initialQuery={query}
        initialGameId={gameId}
        initialGameName={gameName}
      />
    </div>
  );
}



