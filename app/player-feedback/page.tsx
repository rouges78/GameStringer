'use client';

import { PlayerFeedbackPanel } from '@/components/tools/player-feedback-panel';
import { useTranslation } from '@/lib/i18n';

export default function PlayerFeedbackPage() {
  const { t: _t } = useTranslation();
  return (
    <div className="container mx-auto p-4">
      <PlayerFeedbackPanel />
    </div>
  );
}
