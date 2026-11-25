'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, RotateCcw, Loader2 } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import type { RunLogEntry, RunLogLevel, RunResult } from '@/lib/string-it/run-log';
import { probeStringItRestore, restoreStringIt } from '@/lib/string-it/restore';

const ICON: Record<RunLogLevel, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE: Record<RunLogLevel, string> = {
  success: 'text-emerald-400',
  error: 'text-rouge-400',
  warning: 'text-amber-400',
  info: 'text-noir-400',
};

const VISIBLE = 6;

/**
 * Esito dell'ultima corsa di String it e ritorno ai file originali.
 * Resta sotto il pulsante anche dopo che i toast sono spariti.
 */
export function StringItResultPanel({
  lastRun,
  gamePath,
  busy,
  onEntry,
}: {
  lastRun: RunResult | null;
  gamePath?: string;
  busy: boolean;
  onEntry: (entry: RunLogEntry) => void;
}) {
  const { t } = useTranslation();
  const [restorable, setRestorable] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Si ricontrolla a fine corsa e dopo ogni ripristino.
  useEffect(() => {
    if (!gamePath || busy) return;
    let cancelled = false;
    probeStringItRestore(gamePath)
      .then(probe => { if (!cancelled) setRestorable(probe.restorable.length > 0); })
      .catch(() => { if (!cancelled) setRestorable(false); });
    return () => { cancelled = true; };
  }, [gamePath, busy, restoring]);

  const handleRestore = async () => {
    if (!gamePath) return;
    const { confirmDialog } = await import('@/lib/confirm-dialog');
    if (!(await confirmDialog(t('stringItResult.restoreConfirm'), t('stringItResult.restore')))) return;
    setRestoring(true);
    try {
      const report = await restoreStringIt(gamePath);
      const at = Date.now();
      for (const r of report.restored) onEntry({ level: 'success', message: t('stringItResult.restored').replace('{method}', r.method), description: r.detail, at });
      for (const s of report.skipped) onEntry({ level: 'warning', message: t('stringItResult.restoreManual').replace('{method}', s.method), description: s.reason, at });
      for (const e of report.errors) onEntry({ level: 'error', message: t('stringItResult.restoreError').replace('{method}', e.method), description: e.error, at });
      if (report.restored.length + report.skipped.length + report.errors.length === 0) {
        onEntry({ level: 'info', message: t('stringItResult.restoreNothing'), at });
      }
    } catch (err: unknown) {
      onEntry({ level: 'error', message: t('stringItResult.restoreError').replace('{method}', 'String it'), description: String(err), at: Date.now() });
    } finally {
      setRestoring(false);
    }
  };

  const entries = lastRun?.entries ?? [];
  if (entries.length === 0 && !restorable) return null;
  const shown = showAll ? entries : entries.slice(-VISIBLE);

  return (
    <section
      className="mt-2 rounded-md border border-noir-800 bg-noir-950/60 p-2 text-2xs"
      aria-label={t('stringItResult.title')}
      aria-live="polite"
    >
      <header className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono uppercase tracking-wider text-noir-500">{t('stringItResult.title')}</span>
        {lastRun && entries.length > 0 && (
          <time className="font-mono text-noir-600" dateTime={new Date(lastRun.startedAt).toISOString()}>
            {new Date(lastRun.startedAt).toLocaleString()}
          </time>
        )}
      </header>
      {shown.length > 0 && (
        <ul className="space-y-0.5">
          {shown.map((e, i) => {
            const Icon = ICON[e.level];
            return (
              <li key={`${e.at}-${i}`} className="flex items-start gap-1.5">
                <Icon className={`mt-px h-3 w-3 shrink-0 ${TONE[e.level]}`} aria-hidden="true" />
                <span className="min-w-0 text-noir-300">
                  {e.message}
                  {e.description && <span className="block truncate text-noir-500" title={e.description}>{e.description}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {entries.length > VISIBLE ? (
          <button type="button" className="text-noir-500 underline-offset-2 hover:text-noir-300 hover:underline" onClick={() => setShowAll(v => !v)}>
            {showAll ? t('stringItResult.showLess') : t('stringItResult.showAll').replace('{n}', String(entries.length))}
          </button>
        ) : <span />}
        {restorable && (
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring || busy}
            className="inline-flex items-center gap-1 rounded-md border border-noir-700 px-2 py-1 font-semibold text-noir-200 hover:border-noir-500 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge-300"
          >
            {restoring ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3 w-3" aria-hidden="true" />}
            {t('stringItResult.restore')}
          </button>
        )}
      </div>
    </section>
  );
}
