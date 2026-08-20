'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, CheckCircle, AlertTriangle, Edit3, Play, Package, ScanText } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { effectVerdict, type EffectVerification } from '@/lib/translation/effect-verdict';
import { addTranslationCount, shouldAskForSupport, markSupportAsked } from '@/lib/donation-gate';
import { DonationDialog } from '@/components/donation-dialog';

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
  /**
   * Verifica dell'effetto: il gioco è stato cambiato davvero? La prova è
   * `stringsWritten`, il contatore del patcher; l'esistenza dei file da sola
   * non basta (correzione 29/07/2026 — vedi game-detail-client).
   *
   * Il tipo è quello condiviso: tenerne una copia locale voleva dire due
   * definizioni della stessa cosa, libere di divergere in silenzio.
   */
  verification?: EffectVerification;
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

  // Chiave AES per i pak cifrati: si tiene qui e non nel padre perché serve
  // solo dentro questo pannello, e sparisce con lui.
  const [aesKey, setAesKey] = useState('');
  const [salvandoChiave, setSalvandoChiave] = useState(false);

  /* ── RINGRAZIAMENTO DOPO UN SUCCESSO VERO (10/08/2026) ────────────────────
   * Il contatore delle stringhe e la richiesta di supporto vivevano in
   * `translation-recommendation.tsx`, la pipeline che SIMULAVA la traduzione:
   * contavano stringhe mai scritte e chiedevano una donazione dopo un successo
   * inventato, mentre «String it!» — l'unico percorso con prova d'effetto —
   * non contava e non chiedeva niente. Rimossa quella pipeline, il contatore
   * è rimasto senza chiamanti.
   *
   * Ora l'aggancio è qui, sull'UNICA condizione che il progetto considera un
   * successo dimostrato: `verifiedOk` (scrittura reale nel gioco + controprova
   * su disco, vedi lib/translation/effect-verdict.ts). Ambra, parziale e
   * «non risulta cambiato niente» NON contano e non chiedono nulla — chiedere
   * un contributo dopo una patch che forse non è entrata è il modo più rapido
   * di bruciare la fiducia che si sta chiedendo di premiare.
   *
   * ⚠️ `contatoRef` tiene l'oggetto `result` già conteggiato, non un booleano:
   * il pannello si ri-renderizza a ogni cambio di stato del wizard, e un flag
   * «fatto» andrebbe azzerato a mano al risultato successivo — cioè si
   * conterebbe due volte, oppure mai più. */
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportStrings, setSupportStrings] = useState(0);
  const contatoRef = useRef<AutoTranslateResult | null>(null);

  useEffect(() => {
    if (!result || contatoRef.current === result) return;
    const v = effectVerdict(result.verification);
    if (!v.verifiedOk) return;
    contatoRef.current = result;

    // Con la traduzione a runtime (BepInEx/XUnity) non si riscrive niente nel
    // gioco: `stringsWritten` è 0 per costruzione, ma le stringhe tradotte
    // esistono eccome. Contarle come zero le renderebbe invisibili.
    const scritte = v.stringsWritten > 0 ? v.stringsWritten : (result.stringsTranslated || 0);
    if (scritte <= 0) return;

    addTranslationCount(scritte);
    if (shouldAskForSupport()) {
      markSupportAsked();
      setSupportStrings(scritte);
      setSupportOpen(true);
    }
  }, [result]);

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
        {/* Pak cifrato: non è un guasto, è una porta chiusa a chiave. Si chiede
            la chiave invece di mostrare un errore che l'utente non può usare.
            GameStringer non la ricava dal gioco — sarebbe aggirare una
            protezione — ma se l'utente ce l'ha, la usa. */}
        {error === 'PAK_ENCRYPTED_NEEDS_AES_KEY' ? (
          <div className="mt-3 p-3 rounded-lg bg-amber-600/5 border border-amber-600/40 space-y-2">
            <div className="flex items-center gap-2 text-2xs text-amber-900 dark:text-amber-500">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{t('heroJob.pakEncryptedExplain')}</span>
              <button className="ml-auto text-micro font-bold uppercase tracking-wider hover:underline" onClick={onClose}>{t('common.chiudi')}</button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={aesKey}
                onChange={(e) => setAesKey(e.target.value)}
                placeholder={t('heroJob.pakAesPlaceholder')}
                spellCheck={false}
                className="flex-1 h-8 px-2 rounded-md border bg-background text-xs font-mono"
              />
              <button
                disabled={!aesKey.trim() || salvandoChiave}
                onClick={async () => {
                  setSalvandoChiave(true);
                  try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    await invoke('set_pak_aes_key', { gamePath: game.installPath, key: aesKey.trim() });
                    setAesKey('');
                    toast.success(t('heroJob.pakAesSaved'));
                    onClose();
                  } catch (e) {
                    toast.error(String(e));
                  } finally {
                    setSalvandoChiave(false);
                  }
                }}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
              >
                {salvandoChiave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('common.salva')}
              </button>
            </div>
          </div>
        ) : error && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-2xs text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
            <button className="ml-auto text-micro font-bold text-red-400 hover:text-red-300 uppercase tracking-wider" onClick={onClose}>{t('common.chiudi')}</button>
          </div>
        )}

        {/* POST-TRANSLATION COMPLETION WIZARD
            La verità prima del verde (post-translation-truth): il titolo
            dichiara il successo SOLO se il motore ha davvero cambiato il
            gioco. CORREZIONE 29/07/2026: prima bastava che i file dichiarati
            esistessero, e quindi bastava sempre — i motori dichiarano la
            cartella del gioco, e report/backup li scriviamo noi. Ora la prova
            è `stringsWritten`, il contatore del patcher; l'unica eccezione è
            `runtimeOnly` (BepInEx/XUnity), dove non c'è nulla da riscrivere
            perché la traduzione avviene mentre si gioca.
            Niente prova → ambra, e si dice cosa non si è potuto verificare. */}
        {result && steps.every(s => s.status === 'done') && (() => {
          // La regola sta in lib/translation/effect-verdict.ts, con i suoi test:
          // qui dentro non era verificabile, ed è logica che si è già rotta due
          // volte in due giorni. Il verdetto restituisce anche la verifica
          // normalizzata, così qui non si maneggia più un oggetto opzionale.
          const {
            verifiedOk, partial, unverified, tone, nothingWritten,
            stringsWritten, runtimeOnly, missing, verifiedNames,
          } = effectVerdict(result.verification);
          return (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className={`mt-4 rounded-xl border overflow-hidden ${
              tone === 'emerald'
                ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-slate-950/50'
                : 'border-amber-500/30 bg-gradient-to-b from-amber-950/30 to-slate-950/50'
            }`}
          >
            {/* Summary Header */}
            <div className={`px-5 py-4 border-b ${tone === 'emerald' ? 'border-emerald-500/10' : 'border-amber-500/10'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone === 'emerald' ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                  {tone === 'emerald'
                    ? <CheckCircle className="h-5 w-5 text-emerald-400" />
                    : <AlertTriangle className="h-5 w-5 text-amber-400" />}
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-bold ${tone === 'emerald' ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {/* Il titolo dice la cosa che l'utente vuole sapere:
                        quante stringhe sono finite NEL GIOCO. Con la
                        traduzione a runtime quel numero non esiste, e fingere
                        che esista sarebbe la stessa bugia di prima. */}
                    {verifiedOk && runtimeOnly && t('postTranslation.runtimeTitle')}
                    {/* successRate arriva in PERCENTO (0-100) dai percorsi TS,
                        ma in FRAZIONE (0-1) dal success_rate Rust: il 03/08 il
                        62% è diventato "6200%". Normalizziamo qui, un punto
                        solo: ≤1 è una frazione, sopra è già percento. */}
                    {verifiedOk && !runtimeOnly && t('postTranslation.writtenTitle')
                      .replace('{n}', String(stringsWritten))
                      .replace('{pct}', (result.successRate <= 1 ? result.successRate * 100 : result.successRate).toFixed(0))}
                    {partial && t('postTranslation.partialTitle')
                      .replace('{n}', String(stringsWritten))
                      .replace('{missing}', String(missing.length))}
                    {unverified && t('postTranslation.unverifiedTitle')}
                  </h3>
                  <p className="text-2xs text-slate-400 mt-0.5">
                    {result.stringsTranslated > 0 && `${result.stringsTranslated} ${t('postTranslation.stringsTranslated')} | `}
                    Engine: {result.engine} |
                    {result.duration.toFixed(1)} min |
                    {result.targetLang.toUpperCase()}
                    {result.errors > 0 && ` | ${result.errors} ${t('postTranslation.errors')}`}
                  </p>
                  {/* I file confermati, PER NOME: la prova che si offre all'utente */}
                  {verifiedNames.length > 0 && (
                    <p className="text-2xs text-slate-500 mt-1 font-mono truncate" title={verifiedNames.join(' · ')}>
                      ✓ {verifiedNames.slice(0, 3).join(' · ')}{verifiedNames.length > 3 ? ` +${verifiedNames.length - 3}` : ''}
                    </p>
                  )}
                  {/* Il caso che generava le segnalazioni: la pipeline è
                      andata a termine ma nei file del gioco non è entrato
                      niente. Va detto per primo e senza giri di parole. */}
                  {unverified && (
                    <p className="text-2xs text-amber-400/80 mt-1">
                      {/* Sapere che non è entrato niente è diverso da non
                          essere riusciti a controllare: il primo caso merita
                          la frase precisa, il secondo quella prudente. */}
                      {nothingWritten
                        ? t('postTranslation.nothingWrittenHint')
                        : t('postTranslation.unverifiedHint')}
                    </p>
                  )}
                  {partial && (
                    <p className="text-2xs text-amber-400/80 mt-1 font-mono truncate" title={missing.join(' · ')}>
                      ✗ {missing.slice(0, 2).join(' · ')}{missing.length > 2 ? ` +${missing.length - 2}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Prompt */}
            <div className="px-5 py-4">
              <p className="text-xs text-slate-300 mb-1 font-medium">{t('postTranslation.whatNow')}</p>
              {/* «Ho premuto traduci, ha tradotto, e poi?» (triage 26/07, 03/07):
                  il passo successivo non è lo stesso per tutti. Con un patcher
                  il gioco è già cambiato e va solo verificato; con BepInEx la
                  traduzione avviene giocando e il primo avvio è lento; se non
                  è stato scritto niente va detto che il gioco è invariato. */}
              <p className="text-2xs text-slate-500 mb-4 leading-tight">
                {unverified
                  ? t('postTranslation.nextStepNothing')
                  : runtimeOnly
                    ? t('postTranslation.nextStepRuntime')
                    : t('postTranslation.nextStepPatched')}
              </p>

              {/* Fallback → Traduzione live OCR (palette blue/sky = Traduzione):
                  per RPG Maker con copertura parziale, e per QUALSIASI motore
                  quando la verifica su disco non conferma nessun file. */}
              {(((/rpg\s*maker/i.test(result.engine || '')) && result.successRate < 0.9) || unverified) && (
                <button
                  onClick={() => {
                    onClose();
                    onClearResult();
                    const params = new URLSearchParams({
                      game: game.title || game.name || '',
                      // RPG Maker classico ≈ giapponese → default OCR 'ja' (l'utente può
                      // cambiarlo dal selettore). Niente autostart: prima conferma lingua+finestra.
                      src: 'ja',
                      tgt: result?.targetLang || 'it',
                    });
                    window.location.href = `/ocr-translator?${params.toString()}`;
                  }}
                  className="group w-full mb-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 hover:border-sky-500/50 transition-all text-left"
                >
                  <div className="w-9 h-9 shrink-0 rounded-xl bg-sky-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ScanText className="h-4 w-4 text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-sky-300 block">{t('postTranslation.ocrTitle')}</span>
                    <span className="text-2xs text-slate-400 leading-tight block">
                      {unverified
                        ? t('postTranslation.ocrDescUnverified')
                        : t('postTranslation.ocrDescPartial').replace('{pct}', (result.successRate * 100).toFixed(0))}
                    </span>
                  </div>
                </button>
              )}

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
                  <span className="text-2xs text-slate-500 leading-tight">Controlla e modifica le stringhe tradotte nell&apos;editor</span>
                </button>

                {/* Option 2: Test Game */}
                <button
                  onClick={async () => {
                    try {
                      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
                      
                      // Prima prova Steam se ha appid
                      if (game.appid && game.appid > 0) {
                        window.open(`steam://run/${game.appid}`, '_blank');
                        toast.info(t('common.avvioGiocoDaSteamPerTest'));
                        return;
                      }
                      
                      // Altrimenti cerca l'exe nella cartella
                      if (game.installPath) {
                        // Cerca exe nella cartella
                        const exeList = await tauriInvoke<string[]>('find_executables_in_folder', { 
                          folderPath: game.installPath 
                        }).catch(() => [] as string[]);
                        
                        if (exeList && exeList.length > 0) {
                          // Avvia il primo exe trovato
                          const exePath = `${game.installPath}\\${exeList[0]}`;
                          await tauriInvoke('launch_game_direct', { executablePath: exePath, launchOptions: null });
                          toast.success(`Avviato: ${exeList[0]}`);
                        } else {
                          // Fallback: apri la cartella
                          await tauriInvoke('open_path', { path: game.installPath });
                          toast.info(t('common.cartellaGiocoApertaAvviaIlGiocoPerTestare'));
                        }
                        return;
                      }
                      
                      toast.warning('Percorso di installazione non disponibile');
                    } catch (e) {
                      console.error('[TestGame]', e);
                      toast.error(t('common.impossibileAvviareIlGioco'));
                    }
                  }}
                  className="group flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-center"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-emerald-300">{t('common.testaIlGioco')}</span>
                  <span className="text-2xs text-slate-500 leading-tight">Avvia il gioco per verificare le traduzioni in-game</span>
                </button>

                {/* Option 3: Create Patch */}
                <button
                  onClick={async () => {
                    try {
                      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
                      toast.info(t('common.creazionePatchInCorso'));
                      const patchPath = await tauriInvoke<string>('export_translation_patch', {
                        installPath: game.installPath,
                        gameTitle: game.title || game.name || 'Game',
                        targetLang: result?.targetLang || 'it',
                      });
                      toast.success(t('common.patchCreata'));
                      await tauriInvoke('open_path', { path: patchPath }).catch(() => {});
                    } catch (e: unknown) {
                      toast.error(`Errore creazione patch: ${e}`);
                    }
                  }}
                  className="group flex flex-col items-center gap-2 px-4 py-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 transition-all text-center"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="h-4.5 w-4.5 text-amber-400" />
                  </div>
                  <span className="text-xs font-bold text-amber-300">{t('common.creaPatch')}</span>
                  <span className="text-2xs text-slate-500 leading-tight">{t('common.esportaUnPacchettoProntoDaCondividereNellaCommunity')}</span>
                </button>
              </div>
            </div>
          </motion.div>
          );
        })()}
      </div>

      {/* Il ringraziamento arriva SOLO dopo un verde meritato (vedi l'effetto
          più in alto): mode='thanks' non blocca niente e non promette sblocchi
          che non esistono. */}
      <DonationDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        mode="thanks"
        stringsJustWritten={supportStrings}
      />
    </motion.div>
  );
}

