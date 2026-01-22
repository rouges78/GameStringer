'use client';

import { NexusModsBrowser } from '@/components/tools/nexus-mods-browser';
import { useTranslation } from '@/lib/i18n';

export default function NexusModsPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto p-6">
      <NexusModsBrowser />
    </div>
  );
}



