'use client';

import { UnrealTranslator } from '@/components/tools/unreal-translator';
import { useTranslation } from '@/lib/i18n';

export default function UnrealTranslatorPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto p-6">
      <UnrealTranslator />
    </div>
  );
}



