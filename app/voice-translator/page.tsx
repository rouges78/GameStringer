'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';
import { useTranslation } from '@/lib/i18n';

const VoiceTranslator = dynamic(
  () => import('@/components/voice/voice-translator').then(m => m.VoiceTranslator),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function VoiceTranslatorPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 overflow-y-auto h-full">
      <VoiceTranslator />
    </div>
  );
}



