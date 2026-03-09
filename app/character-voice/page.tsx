'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';

const CharacterVoiceEditor = dynamic(
  () => import('@/components/translator/character-voice-editor').then(m => m.CharacterVoiceEditor),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function CharacterVoicePage() {
  return (
    <div className="p-6">
      <CharacterVoiceEditor />
    </div>
  );
}
