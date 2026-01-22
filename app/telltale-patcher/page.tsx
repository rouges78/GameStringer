'use client';

import { TelltalePatcher } from '@/components/tools/telltale-patcher';
import { useTranslation } from '@/lib/i18n';

export default function TelltalePatcherPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto py-6">
      <TelltalePatcher />
    </div>
  );
}



