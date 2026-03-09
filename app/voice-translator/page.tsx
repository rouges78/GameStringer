'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';

const VoiceTranslator = dynamic(
  () => import('@/components/voice/voice-translator').then(m => m.VoiceTranslator),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function VoiceTranslatorPage() {
  return (
    <div className="p-4 overflow-y-auto h-full">
      <VoiceTranslator />
    </div>
  );
}



