'use client';

import { VROverlayPanel } from '@/components/tools/vr-overlay-panel';
import { useTranslation } from '@/lib/i18n';

export default function VROverlayPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto p-4">
      <VROverlayPanel />
    </div>
  );
}
