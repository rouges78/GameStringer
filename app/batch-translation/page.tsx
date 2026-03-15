'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';
import { useTranslation } from '@/lib/i18n';

const BatchTranslationQueue = dynamic(
  () => import('@/components/tools/batch-translation-queue').then(m => m.BatchTranslationQueue),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function BatchTranslationPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6">
      <BatchTranslationQueue />
    </div>
  );
}



