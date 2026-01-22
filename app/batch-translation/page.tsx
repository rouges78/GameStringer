'use client';

import { BatchTranslationQueue } from '@/components/tools/batch-translation-queue';
import { useTranslation } from '@/lib/i18n';

export default function BatchTranslationPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6">
      <BatchTranslationQueue />
    </div>
  );
}



