'use client';

/**
 * CompatBadge — mini-badge "funziona al X%" per le card della Library.
 *
 * Legge la summary community via fetchCompatSummaryBatched (le card visibili
 * vengono accorpate in una sola query) e non renderizza nulla se il gioco non
 * ha ancora report: zero rumore per i giochi mai testati.
 */

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';
import { fetchCompatSummaryBatched, type CompatSummary } from '@/lib/compat-telemetry';

export function CompatBadge({ gameKey }: { gameKey: string }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<CompatSummary | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchCompatSummaryBatched(gameKey)
      .then((s) => { if (alive) setSummary(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, [gameKey]);

  if (!summary || summary.runs === 0) return null;

  const pct = Math.round((summary.okRuns / summary.runs) * 100);
  const tone = pct >= 75
    ? 'bg-emerald-600/90 text-white'
    : pct >= 40
      ? 'bg-amber-600/90 text-white'
      : 'bg-red-600/90 text-white';

  return (
    <Badge
      variant="secondary"
      className={`text-2xs border-0 shadow-sm px-1.5 py-0 ${tone}`}
      title={`${t('compat.cardTitle')} — ${t('compat.runs').replace('{n}', String(summary.runs))}`}
      data-testid="compat-badge"
    >
      <Users className="h-2.5 w-2.5 mr-0.5" />
      {pct}%
    </Badge>
  );
}
