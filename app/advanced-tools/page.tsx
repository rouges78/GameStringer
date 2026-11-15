'use client';

import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const LoreAssistantChat = dynamic(
  () => import('@/components/tools/lore-assistant').then(mod => mod.LoreAssistantChat),
  { ssr: false, loading: () => <div className="p-4 text-center text-noir-500 text-sm">Loading...</div> }
);

const AutoHookScanner = dynamic(
  () => import('@/components/tools/auto-hook-scanner').then(mod => mod.AutoHookScanner),
  { ssr: false, loading: () => <div className="p-4 text-center text-noir-500 text-sm">Loading...</div> }
);

export default function AdvancedToolsPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Sparkles className="h-6 w-6 text-rouge-400" />
        <h1 className="text-2xl font-bold text-noir-200">{t('advancedToolsPage.title')}</h1>
        <Badge className="bg-rouge-500/20 text-rouge-300 text-2xs">{t('advancedToolsPage.badge')}</Badge>
      </div>
      <p className="text-sm text-noir-400 -mt-4">{t('advancedToolsPage.subtitle')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <LoreAssistantChat defaultExpanded={true} />
        </div>
        <div className="space-y-4">
          <AutoHookScanner />
        </div>
      </div>
    </div>
  );
}

