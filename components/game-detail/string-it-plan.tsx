'use client';

import { ShieldAlert } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import type { TranslationPlan } from '@/lib/string-it/plan';

const SOURCE_KEY = {
  files: 'stringItPlan.sourceFiles',
  hint: 'stringItPlan.sourceHint',
  none: 'stringItPlan.sourceNone',
} as const;

/**
 * Il piano di String it sotto il pulsante: quali metodi verranno provati e in
 * che ordine, quali sono saltati per l'anti-cheat, e da dove sappiamo il motore.
 */
export function StringItPlan({ plan }: { plan: TranslationPlan }) {
  const { t } = useTranslation();

  return (
    <div className="mt-1.5 text-2xs text-noir-400">
      <ol className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
        <li className="font-mono uppercase tracking-wider text-noir-500">{t('stringItPlan.title')}</li>
        {plan.methods.map((method, index) => {
          const blocked = method.blocked_by && plan.anti_cheat
            ? t('stringItPlan.blocked').replace('{name}', plan.anti_cheat)
            : null;
          return (
            <li
              key={method.id}
              title={blocked ?? undefined}
              className={`px-1.5 py-0.5 border ${blocked ? 'border-noir-800 text-noir-600 line-through' : index === 0 ? 'border-rouge-500/50 text-noir-100' : 'border-noir-700 text-noir-300'}`}
            >
              <span className="font-mono text-noir-500">{index + 1}</span> {t(`stringItPlan.methods.${method.id}`)}
              {blocked && <span className="sr-only"> ({blocked})</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-center text-noir-500">{t(SOURCE_KEY[plan.engine_source])}</p>
      {plan.anti_cheat && (
        <p className="mt-1 flex items-center justify-center gap-1 text-amber-400">
          <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden />
          {t('stringItPlan.antiCheat').replace('{name}', plan.anti_cheat)}
        </p>
      )}
    </div>
  );
}
