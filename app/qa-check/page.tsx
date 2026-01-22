'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { QAChecker } from '@/components/tools/qa-checker';

export default function QACheckPage() {
  return (
    <MainLayout>
      <div className="p-6">
        <QAChecker />
      </div>
    </MainLayout>
  );
}
