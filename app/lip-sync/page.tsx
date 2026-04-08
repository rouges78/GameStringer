'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';

const LipSyncPanel = dynamic(
  () => import('@/components/tools/lip-sync-panel').then(m => m.LipSyncPanel),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function LipSyncPage() {
  return (
    <div className="container mx-auto p-6">
      <LipSyncPanel />
    </div>
  );
}
