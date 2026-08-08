'use client';

/**
 * Selettore cloud / Ollama locale per i traduttori file-based.
 *
 * Volutamente minuscolo e in linea con la fascia sotto il pulsante "String
 * it!": la scelta del motore AI non merita una card, ma DEVE essere visibile
 * senza aprire i devtools — che è esattamente il difetto che questo componente
 * chiude (vedi lib/translation-backend.ts per la storia).
 *
 * I due tooltip dicono la cosa che conta davvero, cioè chi paga: il cloud usa
 * le chiavi API delle Impostazioni e consuma credito, il locale è gratis ma
 * vuole Ollama avviato. Un selettore che non lo dice sposterebbe solo il
 * problema dai devtools a un pulsante muto.
 */

import { Cloud, HardDrive } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { TranslationBackend } from '@/lib/translation-backend';

export function BackendPicker({
  value,
  onChange,
  disabled,
}: {
  value: TranslationBackend;
  onChange: (v: TranslationBackend) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const opts: { id: TranslationBackend; label: string; hint: string; Icon: typeof Cloud }[] = [
    { id: 'ollama', label: t('translationBackend.local'), hint: t('translationBackend.localHint'), Icon: HardDrive },
    { id: 'cloud', label: t('translationBackend.cloud'), hint: t('translationBackend.cloudHint'), Icon: Cloud },
  ];

  return (
    <div className="mt-1.5 flex items-center gap-1.5" role="radiogroup" aria-label={t('translationBackend.label')}>
      <span className="text-micro font-bold uppercase tracking-wider text-slate-500 shrink-0">
        {t('translationBackend.label')}
      </span>
      <div className="flex flex-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
        {opts.map(({ id, label, hint, Icon }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              title={hint}
              onClick={() => onChange(id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-micro font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                active
                  ? 'bg-indigo-600/40 text-indigo-200 shadow-sm'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
