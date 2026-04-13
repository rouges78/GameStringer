'use client';

import { QAChecker } from '@/components/tools/qa-checker';
import { useTranslation } from '@/lib/i18n';

export default function QACheckPage() {
  const { t: _t } = useTranslation();
  return (
    <div className="p-6">
      <QAChecker />
    </div>
  );
}
