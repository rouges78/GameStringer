'use client';

import { Gamepad2 } from 'lucide-react';
import { RomPatcherUI } from '@/components/tools/rom-patcher-ui';
import { useTranslation } from '@/lib/i18n';

export default function RomPatcherPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto p-4 space-y-3">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-rouge-600 via-rouge-500 to-rouge-500 p-3 text-white">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-2.5">
          <div className="p-2 bg-black/30 rounded-lg border border-white/10">
            <Gamepad2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">{t('common.romPatcher')}</h1>
            <p className="text-white/60 text-2xs">
              Applica e crea patch IPS/BPS per traduzioni retro gaming
            </p>
          </div>
        </div>
      </div>

      <RomPatcherUI />
    </div>
  );
}

