'use client';

import { TranslationFixer } from '@/components/tools/translation-fixer';
import { useTranslation } from '@/lib/i18n';

export default function FixerPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 overflow-y-auto h-full">
      <TranslationFixer />
    </div>
  );
}



