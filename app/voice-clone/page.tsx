'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';
import { useTranslation } from '@/lib/i18n';

const VoiceCloneStudio = dynamic(
  () => import('@/components/tools/voice-clone-studio').then(m => m.VoiceCloneStudio),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function VoiceClonePage() {
  const { t: _t } = useTranslation();
  return (
    <div className="container mx-auto p-4">
      <VoiceCloneStudio />
    </div>
  );
}
