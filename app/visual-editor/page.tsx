'use client';

import { VisualTranslationEditor } from '@/components/tools/visual-translation-editor';
import { useTranslation } from '@/lib/i18n';

export default function VisualEditorPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto p-6">
      <VisualTranslationEditor />
    </div>
  );
}



