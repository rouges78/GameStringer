'use client';

/**
 * GmGlyphCard — iniezione glifi nei font GameMaker (ADR-005).
 *
 * I font GameMaker sono atlanti bitmap dentro data.win: sostituire un TTF non
 * basta (come invece per Ren'Py/RPG Maker). Questa card espone gm_inject_glyphs
 * in due passi onesti:
 *   1. ANTEPRIMA (apply=false): calcola tutto — celle donatrici, corpi per
 *      lettera, budget compresso per texture — senza toccare il file.
 *   2. APPLICA: abilitato SOLO se l'anteprima dice "realizzabile"; backup
 *      obbligatorio, o tutto o niente.
 *
 * Visibile solo per giochi GameMaker con lingua target iniettabile (no CJK).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brush, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import {
  prepareGlyphFont, injectGlyphs, glyphsToInject, isInjectableLang, isGameMakerEngine,
  type GmEsitoIniezione,
} from '@/lib/gm-glyph-inject';

interface GmGlyphCardProps {
  installPath?: string;
  engine?: string | null;
  targetLang: string;
}

export function GmGlyphCard({ installPath, engine, targetLang }: GmGlyphCardProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [esito, setEsito] = useState<GmEsitoIniezione | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttfPath, setTtfPath] = useState<string | null>(null);
  // Simboli che l'utente accetta di perdere anche se il gioco li disegna.
  // Vuoto di default: è una scelta per gioco, non un'impostazione globale.
  const [forzati, setForzati] = useState('');

  if (!installPath || !isGameMakerEngine(engine) || !isInjectableLang(targetLang)) return null;

  const run = async (apply: boolean) => {
    setBusy(apply ? 'apply' : 'preview');
    setError(null);
    try {
      const ttf = ttfPath ?? await prepareGlyphFont(targetLang);
      setTtfPath(ttf);
      const r = await injectGlyphs({
        gamePath: installPath, targetLang, ttfPath: ttf, apply,
        donatoriForzati: forzati,
      });
      setEsito(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  // Il campo compare solo quando serve davvero: quando l'anteprima ha detto
  // che i donatori non bastano. Offrirlo prima significherebbe invitare a
  // pagare un prezzo che magari non serve pagare.
  const donatoriScarsi = (esito?.avvisi ?? []).some(a => a.includes('insufficienti'));

  const chars = glyphsToInject(targetLang);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-violet-500/25 bg-violet-500/[0.05] p-3 space-y-2"
      data-testid="gm-glyph-card"
    >
      <div className="flex items-start gap-3">
        <Brush className="h-4 w-4 shrink-0 mt-0.5 text-violet-300" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[12px] font-semibold text-violet-200">
              {t('gmGlyph.title')} · {targetLang.toUpperCase()}
            </p>
            <Button size="xs" variant="outline" disabled={busy !== null}
              className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
              onClick={() => void run(false)}>
              {busy === 'preview' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brush className="h-3 w-3" />}
              <span className="ml-1">{busy === 'preview' ? t('gmGlyph.previewing') : t('gmGlyph.preview')}</span>
            </Button>
          </div>
          {!esito && !busy && !error && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t('gmGlyph.desc').replace('{chars}', chars.length > 24 ? `${chars.slice(0, 24)}…` : chars)}
            </p>
          )}
          {error && (
            <p className="text-[11px] text-red-300 mt-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0" /> {error}
            </p>
          )}

          {esito && (
            <div className="mt-2 space-y-2">
              {/* Verdetto */}
              <p className={`text-[12px] font-semibold flex items-center gap-2 ${
                esito.applicato ? 'text-emerald-300' : esito.realizzabile ? 'text-emerald-300' : 'text-red-300'
              }`}>
                {esito.applicato
                  ? <><ShieldCheck className="h-4 w-4 text-emerald-400" /> {t('gmGlyph.applied')}</>
                  : esito.realizzabile
                    ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> {t('gmGlyph.feasible')}</>
                    : <><AlertTriangle className="h-4 w-4 text-red-400" /> {t('gmGlyph.notFeasible')}</>}
              </p>
              {esito.applicato && esito.backup && (
                <p className="text-[11px] text-muted-foreground">{t('gmGlyph.backupAt')}: <span className="font-mono">{esito.backup}</span></p>
              )}

              {/* Per-font */}
              {esito.font.map(f => (
                <div key={f.font} className="text-[11px] flex items-center gap-2 flex-wrap">
                  <span className="text-foreground/80 font-mono">{f.font}</span>
                  <span className="px-1.5 rounded border border-emerald-500/40 text-emerald-300 text-[10px]">
                    {t('gmGlyph.injectedN').replace('{n}', String(f.iniettati.length))}
                  </span>
                  {f.saltati.length > 0 && (
                    <span className="px-1.5 rounded border border-amber-500/40 text-amber-300 text-[10px]"
                      title={f.saltati.map(([c, m]) => `${c}: ${m}`).join(' · ')}>
                      {t('gmGlyph.skippedN').replace('{n}', String(f.saltati.length))}
                    </span>
                  )}
                  {f.altezzaGlifi < f.altezzaMaiuscoleFont && (
                    <span className="px-1.5 rounded border border-amber-500/40 text-amber-300 text-[10px]">
                      {t('gmGlyph.smallerGlyphs').replace('{h}', String(f.altezzaGlifi)).replace('{H}', String(f.altezzaMaiuscoleFont))}
                    </span>
                  )}
                </div>
              ))}

              {/* Per-texture: budget */}
              {esito.texture.map(tx => (
                <div key={tx.texture} className="text-[11px] flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">{t('gmGlyph.texture')} #{tx.texture}</span>
                  <span className={`px-1.5 rounded border text-[10px] ${
                    tx.ciSta ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'
                  }`}>
                    {tx.ciSta
                      ? t('gmGlyph.marginOk').replace('{b}', tx.margine.toLocaleString())
                      : t('gmGlyph.marginKo').replace('{b}', Math.abs(tx.margine).toLocaleString())}
                  </span>
                </div>
              ))}

              {/* Avvisi del backend, per nome (À 13px, …) */}
              {esito.avvisi.length > 0 && (
                <ul className="text-[11px] text-amber-300/90 space-y-0.5">
                  {esito.avvisi.map((a, i) => <li key={i}>⚠ {a}</li>)}
                </ul>
              )}

              {/* Celle donatrici insufficienti: qui l'utente può cederne altre.
                  Compare solo dopo un'anteprima che lo ha detto. */}
              {donatoriScarsi && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2 space-y-1.5">
                  <p className="text-[11px] font-semibold text-amber-200">{t('gmGlyph.donorsTitle')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('gmGlyph.donorsHelp')}</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={forzati}
                      onChange={e => setForzati(e.target.value)}
                      placeholder={t('gmGlyph.donorsPlaceholder')}
                      aria-label={t('gmGlyph.donorsTitle')}
                      className="flex-1 min-w-0 rounded-md border border-amber-500/30 bg-black/20 px-2 py-1 text-[12px] font-mono text-amber-100 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                    />
                    <Button size="xs" variant="outline" disabled={busy !== null || !forzati}
                      className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10 shrink-0"
                      onClick={() => void run(false)}>
                      {busy === 'preview' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brush className="h-3 w-3" />}
                      <span className="ml-1">{t('gmGlyph.donorsRetry')}</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Applica: solo se l'anteprima dice che ci sta */}
              {!esito.applicato && esito.realizzabile && (
                <Button size="xs" disabled={busy !== null}
                  className="mt-1 bg-violet-600 hover:bg-violet-500 text-white"
                  onClick={() => void run(true)}>
                  {busy === 'apply' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                  <span className="ml-1">{busy === 'apply' ? t('gmGlyph.applying') : t('gmGlyph.apply')}</span>
                </Button>
              )}
              {!esito.applicato && (
                <p className="text-[10px] text-muted-foreground">{t('gmGlyph.applyNote')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
