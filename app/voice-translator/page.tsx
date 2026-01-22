'use client';

import { VoiceTranslator } from '@/components/voice/voice-translator';
import { useTranslation } from '@/lib/i18n';

export default function VoiceTranslatorPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 overflow-y-auto h-full">
      <VoiceTranslator />
    </div>
  );
}



