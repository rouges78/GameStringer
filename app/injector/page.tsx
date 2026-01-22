'use client';

import { UniversalInjector } from '@/components/tools/universal-injector';
import { useTranslation } from '@/lib/i18n';

export default function InjectorPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 overflow-y-auto h-full">
      <UniversalInjector />
    </div>
  );
}



