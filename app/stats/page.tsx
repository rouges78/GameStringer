'use client';

import { TranslationStatsWidget } from '@/components/dashboard/translation-stats-widget';
import { useTranslation } from '@/lib/i18n';

export default function StatsPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6">
      <TranslationStatsWidget />
    </div>
  );
}



