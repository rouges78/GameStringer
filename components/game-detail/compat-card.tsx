'use client';

/**
 * CompatCard — community compatibility ("ProtonDB of translations") for a game.
 *
 * Two jobs, one compact card:
 * 1. If a boot confirmation is pending for this game (armed after a successful
 *    patch by the compat telemetry), asks "does the game start with the
 *    translation?" — the single most valuable data point of the database.
 * 2. Shows the community summary for this game: % of successful runs, number
 *    of runs/testers, in-game confirmations, plus the user's target language.
 *
 * Renders nothing when there is neither a summary nor a pending question, so
 * it adds zero clutter for games nobody has tested yet.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, CheckCircle2, XCircle, Gamepad2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import {
  fetchCompatSummary, getPendingBootCheck, resolvePendingBootCheck,
  type CompatGameRef, type CompatSummary, type PendingBootCheck,
} from '@/lib/compat-telemetry';

interface CompatCardProps {
  game: CompatGameRef;
  /** Lingua di destinazione corrente dell'utente (per la riga "nella tua lingua"). */
  targetLang?: string;
}

export function CompatCard({ game, targetLang }: CompatCardProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<CompatSummary | null>(null);
  const [pending, setPending] = useState<PendingBootCheck | null>(null);
  const [answering, setAnswering] = useState<'yes' | 'no' | 'skip' | null>(null);
  const [thanked, setThanked] = useState(false);

  const refresh = useCallback(() => {
    setPending(getPendingBootCheck(game.key));
    void fetchCompatSummary(game.key).then(setSummary).catch(() => {});
  }, [game.key]);

  useEffect(() => { refresh(); }, [refresh]);

  const answer = async (a: 'yes' | 'no' | 'skip') => {
    setAnswering(a);
    try {
      await resolvePendingBootCheck(game.key, a, game);
      if (a !== 'skip') setThanked(true);
    } finally {
      setAnswering(null);
      setPending(null);
    }
  };

  const hasData = !!summary && summary.runs > 0;
  if (!hasData && !pending && !thanked) return null;

  const pct = hasData ? Math.round((summary.okRuns / summary.runs) * 100) : 0;
  const pctColor = pct >= 75 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';
  const langRow = hasData && targetLang
    ? summary.byLang.find(l => (l.targetLang || '').toLowerCase() === targetLang.toLowerCase())
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] p-3 space-y-2"
      data-testid="compat-card"
    >
      {/* ── Domanda boot (il dato più prezioso) ── */}
      {pending && (
        <div className="flex items-start gap-3">
          <Gamepad2 className="h-4 w-4 shrink-0 mt-0.5 text-indigo-300" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-indigo-200">
              {t('compat.bootQuestion')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="xs" variant="outline" disabled={!!answering}
                className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => void answer('yes')}>
                {answering === 'yes' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                <span className="ml-1">{t('compat.bootYes')}</span>
              </Button>
              <Button size="xs" variant="outline" disabled={!!answering}
                className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                onClick={() => void answer('no')}>
                {answering === 'no' ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                <span className="ml-1">{t('compat.bootNo')}</span>
              </Button>
              <Button size="xs" variant="ghost" disabled={!!answering}
                className="text-muted-foreground"
                onClick={() => void answer('skip')}>
                {t('compat.bootSkip')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {thanked && !pending && (
        <p className="text-[12px] text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5" /> {t('compat.bootThanks')}
        </p>
      )}

      {/* ── Riepilogo community ── */}
      {hasData && (
        <div className="flex items-start gap-3">
          <Users className="h-4 w-4 shrink-0 mt-0.5 text-indigo-300" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-indigo-200">
              {t('compat.cardTitle')}
            </p>
            <p className="text-[12px] text-foreground/90 mt-0.5">
              <span className={`font-bold ${pctColor}`}>
                {t('compat.worksPct').replace('{pct}', String(pct))}
              </span>
              {' · '}
              {t('compat.runs').replace('{n}', String(summary.runs))}
              {summary.bootOkRuns > 0 && (
                <>{' · '}{t('compat.bootConfirmed').replace('{n}', String(summary.bootOkRuns))}</>
              )}
            </p>
            {langRow && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('compat.yourLang')
                  .replace('{lang}', (langRow.targetLang || '').toUpperCase())
                  .replace('{ok}', String(langRow.okRuns))
                  .replace('{runs}', String(langRow.runs))}
              </p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
