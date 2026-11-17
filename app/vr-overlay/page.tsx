'use client';

import { AlertTriangle } from 'lucide-react';
import { VROverlayPanel } from '@/components/tools/vr-overlay-panel';
import { useTranslation } from '@/lib/i18n';

export default function VROverlayPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto p-4 space-y-3">
      {/* L'output verso il visore non esiste ancora: qui c'è solo l'anteprima */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-500">{t('vrOverlay.notConnected')}</p>
      </div>
      <VROverlayPanel />
    </div>
  );
}

