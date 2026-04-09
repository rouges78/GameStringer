'use client';

import { motion } from 'framer-motion';
import { Zap, Loader2, CheckCircle, AlertTriangle, Edit3, Play, Package, Clock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';

interface AutoTranslateStep {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

interface AutoTranslateResult {
  successRate: number;
  duration: number;
  deliverables: number;
  errors: number;
  engine: string;
  targetLang: string;
  stringsTranslated: number;
  stringsTotal: number;
}

interface AutoTranslateStepperProps {
  steps: AutoTranslateStep[];
  error: string | null;
  result: AutoTranslateResult | null;
  currentFlagLabel: string;
  onClose: () => void;
  onClearResult: () => void;
  game: {
    title?: string;
    name?: string;
    installPath?: string;
    appid?: number;
  };
}

export function AutoTranslateStepper({
  steps,
  error,
  result,
  currentFlagLabel,
  onClose,
  onClearResult,
  game,
}: AutoTranslateStepperProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/40 to-[#0e1419] overflow-hidden"
    >
      <div className="max-w-[800px] mx-auto px-6 py-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Zap className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">{t('gameDetails.autoTranslateTitle') || 'Auto Translation'}</span>
            <span className="text-2xs text-indigo-400/70">{`String it! → ${currentFlagLabel}`}</span>
          </div>
          {steps.every(s => s.status === 'done') && (
            <button className="ml-auto text-micro font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wider px-3 py-1 rounded-lg hover:bg-white/5 transition-all"
              onClick={onClose}
            >
              {t('gameDetails.close') || 'Close'}
            </button>
          )}
        </div>
        <div className="space-y-1">
          {steps.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
              step.status === 'running' ? 'bg-indigo-500/10 border border-indigo-500/20' :
              step.status === 'done' ? 'bg-white/[0.02]' :
              step.status === 'error' ? 'bg-red-500/10 border border-red-500/20' :
              'opacity-40'
            }`}>
              <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                {step.status === 'running' && <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />}
                {step.status === 'done' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                {step.status === 'error' && <AlertTriangle className="h-4 w-4 text-red-400" />}
                {step.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[11px] font-semibold block ${
                  step.status === 'running' ? 'text-indigo-300' :
                  step.status === 'done' ? 'text-slate-300' :
                  step.status === 'error' ? 'text-red-300' :
                  'text-slate-600'
                }`}>{step.label}</span>
                {step.detail && (
                  <span className={`text-micro block mt-0.5 ${
                    step.status === 'running' ? 'text-indigo-400/60' :
                    step.status === 'done' ? 'text-slate-500' :
                    'text-red-400/60'
                  }`}>{step.detail}</span>
                )}
              </div>
              {step.status === 'running' && (
                <div className="w-16 h-1 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              )}
            </div>
          ))}
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-2xs text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
            <button className="ml-auto text-micro font-bold text-red-400 hover:text-red-300 uppercase tracking-wider" onClick={onClose}>Chiudi</button>
          </div>
        )}

        {/* POST-TRANSLATION COMPLETION WIZARD */}
        {result && steps.every(s => s.status === 'done') && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-4 rounded-xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-slate-950/50 overflow-hidden"
          >
            {/* Summary Header */}
            <div className="px-5 py-4 border-b border-emerald-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-emerald-300">
                    Traduzione completata al {(result.successRate * 100).toFixed(0)}%
                    {result.errors === 0 ? ' con 0 errori' : ` con ${result.errors} errori`}
                  </h3>
                  <p className="text-2xs text-slate-400 mt-0.5">
                    {result.stringsTranslated > 0 && `${result.stringsTranslated} stringhe tradotte | `}
                    Engine: {result.engine} |
                    Tempo: {result.duration.toFixed(1)} min |
                    Lingua: {result.targetLang.toUpperCase()} |
                    {result.deliverables} file generati
                  </p>
                </div>
              </div>
            </div>

            {/* Action Prompt */}
            <div className="px-5 py-4">
              <p className="text-xs text-slate-300 mb-4 font-medium">Cosa vuoi fare ora?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Option 1: Review Translations */}
                <button
                  onClick={() => {
                    onClose();
                    onClearResult();
                    const translationSection = document.querySelector('[data-tutorial="translation-section"]');
                    if (translationSection) {
                      translationSection.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      window.location.href = `/editor?game=${encodeURIComponent(game.title || '')}&path=${encodeURIComponent(game.installPath || '')}`;
                    }
                  }}
                  className="group flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 transition-all text-center"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Edit3 className="h-4 w-4 text-indigo-400" />
                  </div>
                  <span className="text-xs font-bold text-indigo-300">Rivedi Traduzioni</span>
                  <span className="text-2xs text-slate-500 leading-tight">Controlla e modifica le stringhe tradotte nell'editor</span>
                </button>

                {/* Option 2: Test Game */}
                <button
                  onClick={async () => {
                    try {
                      if (game.appid) {
                        window.open(`steam://run/${game.appid}`, '_blank');
                        toast.info('Avvio gioco da Steam per test...');
                      } else if (game.installPath) {
                        const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
                        await tauriInvoke('open_path', { path: game.installPath });
                        toast.info('Cartella gioco aperta — avvia il gioco per testare');
                      }
                    } catch {
                      toast.error('Impossibile avviare il gioco');
                    }
                  }}
                  className="group flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-center"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-emerald-300">Testa il Gioco</span>
                  <span className="text-2xs text-slate-500 leading-tight">Avvia il gioco per verificare le traduzioni in-game</span>
                </button>

                {/* Option 3: Create Patch */}
                <button
                  onClick={async () => {
                    try {
                      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
                      toast.info('Creazione patch in corso...');
                      const patchPath = await tauriInvoke<string>('export_translation_patch', {
                        installPath: game.installPath,
                        gameTitle: game.title || game.name || 'Game',
                        targetLang: result?.targetLang || 'it',
                      });
                      toast.success('Patch creata!');
                      await tauriInvoke('open_path', { path: patchPath }).catch(() => {});
                    } catch (e) {
                      toast.error(`Errore creazione patch: ${e}`);
                    }
                  }}
                  className="group flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 transition-all text-center"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="h-4.5 w-4.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-bold text-amber-300">Crea Patch</span>
                  <span className="text-2xs text-slate-500 leading-tight">Esporta un pacchetto pronto da condividere nella community</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
