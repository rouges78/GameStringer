'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';
import { useTranslation } from '@/lib/i18n';

const LiveOcrOverlay = dynamic(
  () => import('@/components/tools/live-ocr-overlay').then(m => m.LiveOcrOverlay),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function LiveOcrPage() {
  const { t: _t } = useTranslation();
  return (
    <div className="p-6">
      <LiveOcrOverlay />
    </div>
  );
}
