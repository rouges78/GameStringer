'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from '@/lib/i18n';

const VisionTranslator = dynamic(
  () => import('@/components/tools/vision-translator').then(mod => mod.VisionTranslator),
  { ssr: false, loading: () => <div className="p-6 text-center text-slate-500 text-sm">Caricamento Vision LLM...</div> }
);

export default function VisionTranslatorPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <VisionTranslator />
    </div>
  );
}
