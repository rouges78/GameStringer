'use client';

import OfflineTranslator from '@/components/offline-translator';
import { useTranslation } from '@/lib/i18n';

export default function OfflineTranslatorPage() {
  const { t } = useTranslation();
  return (
    <div className="w-full px-4 py-4">
      <OfflineTranslator />
    </div>
  );
}
