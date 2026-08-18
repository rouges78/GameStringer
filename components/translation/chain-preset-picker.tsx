'use client';

/**
 * Selettore del preset costo/qualità, accanto al pulsante che avvia la spesa.
 *
 * ⛔ LA STORIA, perché non è un componente nuovo ma un interruttore mancante:
 * i dieci preset di lib/translation/chain-presets.ts esistono, sono completi e
 * la pipeline li consuma davvero — ma l'unico punto vivo da cui sceglierli era
 * /binary-patcher, una pagina che non sta nella sidebar, né in tools-registry,
 * né nella command palette, raggiungibile SOLO dopo che una scansione è
 * fallita. Nona comparsa di «completo e irraggiungibile» in questo progetto.
 * E la scelta, per giunta, non si salvava: variabile di modulo, persa al
 * reload (corretto in chain-presets.ts lo stesso giorno).
 *
 * ⭐ PERCHÉ QUI E NON IN IMPOSTAZIONI (decisione di Davide, 18/08/2026):
 * la domanda «quanto voglio spendere» nasce davanti al pulsante che spende,
 * non tre schermate più in là. Stesso posto e stessa forma del BackendPicker,
 * che risolve il gemello di questo problema (locale o cloud).
 *
 * ⭐ I COSTI SONO CALCOLATI, non scritti: vengono da chain-cost.ts, che legge i
 * prezzi veri di remote-config. Le stringhe `cost` dentro i preset sono ferme a
 * mesi fa e il rincaro DeepSeek del 16/08 le ha rese false — mostrarle qui
 * avrebbe messo una bugia sotto gli occhi dell'utente invece di toglierla.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, Coins } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { CHAIN_PRESETS, type ChainPreset } from '@/lib/translation/chain-presets';
import { stimaCostoPreset, formattaStima, STRINGHE_RIFERIMENTO } from '@/lib/translation/chain-cost';

export function ChainPresetPicker({
  value,
  onChange,
  disabled,
  stringhe,
}: {
  value: ChainPreset;
  onChange: (v: ChainPreset) => void;
  disabled?: boolean;
  /** Stringhe del gioco, se già contate: rende la stima un preventivo vero. */
  stringhe?: number;
}) {
  const { t } = useTranslation();
  const [aperto, setAperto] = useState(false);

  const volume = stringhe && stringhe > 0 ? stringhe : STRINGHE_RIFERIMENTO;
  const stime = useMemo(
    () => new Map(CHAIN_PRESETS.map((p) => [p.id, stimaCostoPreset(p, volume)])),
    [volume]
  );

  const attivo = CHAIN_PRESETS.find((p) => p.id === value) ?? CHAIN_PRESETS[0];
  const stimaAttiva = stime.get(attivo.id);

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-micro font-bold uppercase tracking-wider text-slate-500 shrink-0">
          {t('chainPreset.label')}
        </span>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={aperto}
          onClick={() => setAperto((v) => !v)}
          className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-micro font-bold uppercase tracking-wider text-slate-300 transition-all hover:bg-white/10 disabled:opacity-50"
        >
          <span className="truncate">{attivo.name}</span>
          <span className="flex items-center gap-1 shrink-0 text-indigo-300">
            <Coins className="h-3 w-3" />
            {stimaAttiva ? formattaStima(stimaAttiva) : '—'}
            <ChevronDown className={`h-3 w-3 transition-transform ${aperto ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </div>

      {aperto && (
        <div role="radiogroup" aria-label={t('chainPreset.label')} className="mt-1 space-y-0.5 rounded-lg border border-white/10 bg-slate-900/60 p-1">
          {CHAIN_PRESETS.map((p) => {
            const s = stime.get(p.id)!;
            const active = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => {
                  onChange(p.id);
                  setAperto(false);
                }}
                className={`flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-all disabled:opacity-50 ${
                  active ? 'bg-indigo-600/30 text-indigo-100' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{p.name}</span>
                  <span className="block truncate text-micro text-slate-400">{p.description}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-micro font-bold text-indigo-300">{formattaStima(s)}</span>
                  <span className="block text-micro text-slate-500">{p.quality}</span>
                </span>
              </button>
            );
          })}
          {/* Il numero da solo mentirebbe per omissione: qui si dice su quante
              stringhe è calcolato, che il tetto vale solo se i gratuiti in
              testa non reggono, e che l'output è già contato.
              ⚠️ t() prende SOLO la chiave: l'interpolazione si fa con .replace,
              come in compat-badge e auto-translate-stepper. Passare un secondo
              argomento a t() non darebbe errore — lascerebbe «{n}» a schermo in
              tutte e 12 le lingue. */}
          <p className="px-2 pt-1 text-micro leading-snug text-slate-500">
            {t('chainPreset.disclaimer').replace('{n}', volume.toLocaleString())}
          </p>
        </div>
      )}
    </div>
  );
}
