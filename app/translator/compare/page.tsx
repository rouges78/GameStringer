'use client';

import { MultiLLMCompare } from '@/components/translator/multi-llm-compare';
import { useTranslation } from '@/lib/i18n';

export default function MultiLLMComparePage() {
  const { t: _t } = useTranslation();
  return (
    <div className="p-4 overflow-y-auto h-full">
      <MultiLLMCompare />
    </div>
  );
}



