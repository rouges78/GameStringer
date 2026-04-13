'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/skeleton-loaders';
import { useTranslation } from '@/lib/i18n';

const VisualTranslationEditor = dynamic(
  () => import('@/components/tools/visual-translation-editor').then(m => m.VisualTranslationEditor),
  { ssr: false, loading: () => <PageSkeleton /> }
);

export default function VisualEditorPage() {
  const { t: _t } = useTranslation();
  return (
    <div className="container mx-auto p-6">
      <VisualTranslationEditor />
    </div>
  );
}



