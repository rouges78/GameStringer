'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';

const VisualTranslationEditor = dynamic(
  () => import('@/components/tools/visual-translation-editor').then(m => m.VisualTranslationEditor),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function VisualEditorPage() {
  return (
    <div className="container mx-auto p-6">
      <VisualTranslationEditor />
    </div>
  );
}



