'use client';

/**
 * FontCheckCard — "vedrò i quadrati □□□?" con risposta e fix.
 *
 * On-demand (nessun lavoro al mount): al click analizza i font della cartella
 * del gioco per la lingua target (lib/font-check.ts → lib/font-coverage.ts) e,
 * per i giochi Unity con XUnity installato, mostra lo stato dell'override font
 * e offre il fix one-click (config + bundle TMP corretto per versione Unity).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Type, Loader2, CheckCircle2, AlertTriangle, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import {
  checkGameFonts, getXUnityFontStatus, applyXUnityFontFix,
  supportsAutoFontInstall, installGameFont, removeGameFont,
  type GameFontCheck, type XUnityFontStatus,
} from '@/lib/font-check';

interface FontCheckCardProps {
  installPath?: string;
  engine?: string | null;
  targetLang: string;
}

export function FontCheckCard({ installPath, engine, targetLang }: FontCheckCardProps) {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<GameFontCheck | null>(null);
  const [xunity, setXUnity] = useState<XUnityFontStatus | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixSteps, setFixSteps] = useState<string[] | null>(null);

  if (!installPath) return null;
  const isUnity = (engine || '').toLowerCase().includes('unity');

  const run = async () => {
    setChecking(true);
    setFixSteps(null);
    try {
      const result = await checkGameFonts(installPath, targetLang, engine);
      setCheck(result);
      if (isUnity) setXUnity(await getXUnityFontStatus(installPath, targetLang));
    } finally {
      setChecking(false);
    }
  };

  const applyFix = async () => {
    setFixing(true);
    try {
      const steps = await applyXUnityFontFix(installPath, targetLang);
      setFixSteps(steps);
      setXUnity(await getXUnityFontStatus(installPath, targetLang));
    } catch (e) {
      setFixSteps([String(e)]);
    } finally {
      setFixing(false);
    }
  };

  const installFont = async () => {
    setFixing(true);
    try {
      setFixSteps(await installGameFont(installPath, engine || '', targetLang));
    } catch (e) {
      setFixSteps([String(e)]);
    } finally {
      setFixing(false);
    }
  };

  const restoreFont = async () => {
    setFixing(true);
    try {
      setFixSteps(await removeGameFont(installPath, engine || ''));
    } catch (e) {
      setFixSteps([String(e)]);
    } finally {
      setFixing(false);
    }
  };

  const verdictUi = check && {
    ok: { icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, text: t('fontCheck.verdictOk'), cls: 'text-emerald-300' },
    latin_target: { icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />, text: t('fontCheck.verdictLatin'), cls: 'text-emerald-300' },
    missing_glyphs: { icon: <AlertTriangle className="h-4 w-4 text-red-400" />, text: t('fontCheck.verdictMissing'), cls: 'text-red-300' },
    no_fonts_found: { icon: <AlertTriangle className="h-4 w-4 text-amber-400" />, text: t('fontCheck.verdictNoFonts'), cls: 'text-amber-300' },
  }[check.verdict];

  const needsUnityFix = isUnity && xunity?.needs_override &&
    (!xunity.override_present || !xunity.tmp_bundle_present);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-3 space-y-2"
      data-testid="font-check-card"
    >
      <div className="flex items-start gap-3">
        <Type className="h-4 w-4 shrink-0 mt-0.5 text-sky-300" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[12px] font-semibold text-sky-200">
              {t('fontCheck.title')} · {targetLang.toUpperCase()}
            </p>
            <Button size="xs" variant="outline" disabled={checking}
              className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
              onClick={() => void run()}>
              {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Type className="h-3 w-3" />}
              <span className="ml-1">{checking ? t('fontCheck.running') : t('fontCheck.run')}</span>
            </Button>
          </div>
          {!check && !checking && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('fontCheck.desc')}</p>
          )}

          {check && verdictUi && (
            <div className="mt-2 space-y-2">
              <p className={`text-[12px] font-semibold flex items-center gap-2 ${verdictUi.cls}`}>
                {verdictUi.icon} {verdictUi.text}
              </p>

              {/* Font analizzati con copertura per scrittura */}
              {check.fonts.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    {t('fontCheck.fontsFound').replace('{n}', String(check.fonts.length))}
                  </p>
                  {check.fonts.slice(0, 6).map(f => (
                    <div key={f.path} className="text-[11px] flex items-center gap-2 flex-wrap">
                      <span className="text-foreground/80 truncate max-w-[180px]" title={f.path}>{f.name}</span>
                      {f.report ? f.report.byScript.map(s => (
                        <span key={s.script}
                          className={`px-1.5 rounded border text-[10px] ${
                            s.percent >= 95 ? 'border-emerald-500/40 text-emerald-300'
                              : s.percent >= 50 ? 'border-amber-500/40 text-amber-300'
                                : 'border-red-500/40 text-red-300'
                          }`}
                          title={s.missingSamples ? `${t('fontCheck.missingEg')}: ${s.missingSamples}` : undefined}
                        >
                          {s.script} {s.percent}%
                        </span>
                      )) : (
                        <span className="text-[10px] text-muted-foreground">{t('fontCheck.notInspectable')}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Stato e fix XUnity per Unity */}
              {isUnity && xunity && (
                <div className="rounded-lg border border-border/60 p-2 space-y-1">
                  <p className="text-[11px] font-semibold text-foreground/80">{t('fontCheck.xunityTitle')}</p>
                  {!xunity.xunity_config_path ? (
                    <p className="text-[11px] text-muted-foreground">{t('fontCheck.xunityNotInstalled')}</p>
                  ) : (
                    <>
                      <p className="text-[11px]">
                        {xunity.override_present
                          ? <span className="text-emerald-300">✓ {t('fontCheck.xunityOverrideOn')}</span>
                          : <span className="text-amber-300">○ {t('fontCheck.xunityOverrideOff')}</span>}
                      </p>
                      <p className="text-[11px]">
                        {xunity.tmp_bundle_present
                          ? <span className="text-emerald-300">✓ {t('fontCheck.xunityBundleOn').replace('{font}', xunity.tmp_font_expected)}</span>
                          : <span className="text-amber-300">○ {t('fontCheck.xunityBundleOff').replace('{font}', xunity.tmp_font_expected)}</span>}
                      </p>
                      {needsUnityFix && (
                        <Button size="xs" disabled={fixing}
                          className="mt-1 bg-sky-600 hover:bg-sky-500 text-white"
                          onClick={() => void applyFix()}>
                          {fixing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                          <span className="ml-1">{fixing ? t('fontCheck.applying') : t('fontCheck.applyFix')}</span>
                        </Button>
                      )}
                    </>
                  )}
                  {fixSteps && (
                    <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                      {fixSteps.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Installazione font automatica (Ren'Py / RPG Maker) */}
              {supportsAutoFontInstall(engine) &&
                check.verdict !== 'ok' && check.verdict !== 'latin_target' && (
                <div className="rounded-lg border border-border/60 p-2 space-y-1">
                  <p className="text-[11px] font-semibold text-foreground/80">
                    {t('fontCheck.autoInstallTitle')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('fontCheck.autoInstallDesc')}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Button size="xs" disabled={fixing}
                      className="bg-sky-600 hover:bg-sky-500 text-white"
                      onClick={() => void installFont()}>
                      {fixing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      <span className="ml-1">{fixing ? t('fontCheck.applying') : t('fontCheck.installFont')}</span>
                    </Button>
                    <Button size="xs" variant="ghost" disabled={fixing}
                      className="text-muted-foreground"
                      onClick={() => void restoreFont()}>
                      {t('fontCheck.removeFont')}
                    </Button>
                  </div>
                  {fixSteps && !isUnity && (
                    <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                      {fixSteps.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Consiglio per engine */}
              {check.verdict !== 'ok' && check.verdict !== 'latin_target' &&
                !supportsAutoFontInstall(engine) && (
                <p className="text-[11px] text-muted-foreground">
                  {t(`fontCheck.${check.adviceKey}`)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
