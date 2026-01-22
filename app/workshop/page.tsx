'use client';

import { SteamWorkshopBrowser } from '@/components/tools/steam-workshop-browser';
import { useTranslation } from '@/lib/i18n';

export default function WorkshopPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6">
      <SteamWorkshopBrowser />
    </div>
  );
}



