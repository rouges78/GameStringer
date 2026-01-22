'use client';

import { DictionaryManager } from '@/components/dictionaries/dictionary-manager';
import { useTranslation } from '@/lib/i18n';

export default function DictionariesPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <DictionaryManager />
    </div>
  );
}



