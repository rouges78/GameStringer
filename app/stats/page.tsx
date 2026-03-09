'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';

const TranslationStatsWidget = dynamic(
  () => import('@/components/dashboard/translation-stats-widget').then(m => m.TranslationStatsWidget),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function StatsPage() {
  return (
    <div className="p-6 space-y-6">
      <TranslationStatsWidget />
    </div>
  );
}



