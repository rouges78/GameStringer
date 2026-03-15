'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';
import { useTranslation } from '@/lib/i18n';

const TranslationStatsWidget = dynamic(
  () => import('@/components/dashboard/translation-stats-widget').then(m => m.TranslationStatsWidget),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function StatsPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6">
      <TranslationStatsWidget />
    </div>
  );
}



