/**
 * Redistribution guard — garanzia "solo diff" per i .gspack (task ROADMAP
 * `gspack-notext`). È la difesa TECNICA che rende sostenibile il Patch Hub:
 * un pack deve contenere TRADUZIONI (target), non grandi blocchi di TESTO
 * ORIGINALE del gioco (che sarebbe redistribuzione di materiale protetto).
 *
 * Non possiamo confrontare col gioco originale (non ce l'abbiamo), quindi
 * usiamo segnali INTERNI al pack, tutti calcolabili al publish:
 *  1. Rapporto di traduzione (translated/total): un "pack di traduzione" con
 *     pochissime stringhe tradotte è di fatto un dump del testo originale.
 *  2. Voci di glossario "verbatim" (source === target): un glossario fatto per
 *     lo più di copie identiche dell'originale è sospetto.
 *  3. Densità: troppi byte di contenuto per stringa tradotta ⇒ il file è
 *     imbottito di testo non tradotto (originale) attorno a poche traduzioni.
 *  4. File quasi-non-tradotti ma voluminosi.
 *
 * È un'euristica: i falsi positivi si gestiscono con un override in revisione
 * (severity 'warn' non blocca; 'block' sì). La messaggistica chiara è parte
 * della difesa. Collegato a [gspack-notext] / anti-pirateria.
 */

import type { GspackData } from './gspack-manager';

export interface RedistributionReason {
  code: 'low-translation' | 'verbatim-glossary' | 'source-heavy-content' | 'untranslated-file';
  detail: string;
}

export interface RedistributionVerdict {
  /** 'ok' = passa; 'warn' = pubblicabile con revisione/override; 'block' = respinto. */
  severity: 'ok' | 'warn' | 'block';
  flagged: boolean;
  reasons: RedistributionReason[];
  stats: {
    totalStrings: number;
    translatedStrings: number;
    translationRatio: number;
    verbatimGlossaryRatio: number;
    contentBytes: number;
    bytesPerTranslatedString: number;
    suspectFiles: string[];
  };
}

export interface RedistributionOptions {
  /** Sotto questo rapporto tradotto/totale il pack è "per lo più originale". Default 0.2. */
  minTranslationRatio?: number;
  /** Sopra questo rapporto di voci glossario verbatim → sospetto. Default 0.7. */
  maxVerbatimGlossaryRatio?: number;
  /** Sopra questi byte di contenuto per stringa tradotta → contenuto "source-heavy". Default 4000. */
  bytesPerTranslatedStringLimit?: number;
  /** Pack più piccoli di così non vengono giudicati (troppo pochi dati). Default 30. */
  minStringsToJudge?: number;
}

const norm = (s: string): string => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Analizza un pack e ritorna un verdetto sulla redistribuzione di testo originale.
 * Puro e deterministico: nessun I/O.
 */
export function checkRedistribution(
  pack: GspackData,
  opts: RedistributionOptions = {}
): RedistributionVerdict {
  const minRatio = opts.minTranslationRatio ?? 0.2;
  const maxVerbatim = opts.maxVerbatimGlossaryRatio ?? 0.7;
  const bytesLimit = opts.bytesPerTranslatedStringLimit ?? 4000;
  const minJudge = opts.minStringsToJudge ?? 30;

  const files = pack.files || [];
  const glossary = pack.glossary || [];

  // Conteggi: preferisci la somma dei file; ripiega sul manifest.
  const fileTotal = files.reduce((a, f) => a + (f.stringCount || 0), 0);
  const fileTranslated = files.reduce((a, f) => a + (f.translatedCount || 0), 0);
  const totalStrings = fileTotal || pack.manifest?.translation?.totalStrings || 0;
  const translatedStrings = fileTotal ? fileTranslated : (pack.manifest?.translation?.translatedStrings || 0);

  const contentBytes = files.reduce((a, f) => a + (f.content ? f.content.length : 0), 0);
  const translationRatio = totalStrings > 0 ? translatedStrings / totalStrings : 1;
  const bytesPerTranslatedString = contentBytes / Math.max(translatedStrings, 1);

  // Glossario verbatim (source === target dopo normalizzazione, non banale).
  const meaningful = glossary.filter(g => norm(g.source).length >= 3);
  const verbatim = meaningful.filter(g => norm(g.source) === norm(g.target));
  const verbatimGlossaryRatio = meaningful.length > 0 ? verbatim.length / meaningful.length : 0;

  // File voluminosi ma quasi non tradotti.
  const suspectFiles = files
    .filter(f => (f.stringCount || 0) >= minJudge
      && (f.translatedCount || 0) / Math.max(f.stringCount || 0, 1) < minRatio
      && (f.content ? f.content.length : 0) > 4000)
    .map(f => f.path);

  const reasons: RedistributionReason[] = [];

  // Pack troppo piccolo → non giudicabile con affidabilità: passa.
  const judgeable = totalStrings >= minJudge;

  if (judgeable && translationRatio < minRatio) {
    reasons.push({
      code: 'low-translation',
      detail: `Solo il ${(translationRatio * 100).toFixed(0)}% delle stringhe è tradotto (min ${(minRatio * 100).toFixed(0)}%): il pack sembra contenere per lo più testo originale.`,
    });
  }
  if (meaningful.length >= 10 && verbatimGlossaryRatio > maxVerbatim) {
    reasons.push({
      code: 'verbatim-glossary',
      detail: `Il ${(verbatimGlossaryRatio * 100).toFixed(0)}% delle voci di glossario è identico all'originale (verbatim): possibile copia del testo sorgente.`,
    });
  }
  if (judgeable && translatedStrings > 0 && bytesPerTranslatedString > bytesLimit) {
    reasons.push({
      code: 'source-heavy-content',
      detail: `~${Math.round(bytesPerTranslatedString)} byte di contenuto per stringa tradotta: il contenuto è imbottito di testo non tradotto.`,
    });
  }
  if (suspectFiles.length > 0) {
    reasons.push({
      code: 'untranslated-file',
      detail: `${suspectFiles.length} file voluminosi ma quasi non tradotti: ${suspectFiles.slice(0, 3).join(', ')}${suspectFiles.length > 3 ? '…' : ''}.`,
    });
  }

  // Severità: casi gravi bloccano, un solo segnale avvisa.
  let severity: RedistributionVerdict['severity'] = 'ok';
  const hardLowTranslation = judgeable && translationRatio < minRatio / 2; // < metà soglia
  if (hardLowTranslation || reasons.length >= 2) severity = 'block';
  else if (reasons.length === 1) severity = 'warn';

  return {
    severity,
    flagged: severity !== 'ok',
    reasons,
    stats: {
      totalStrings,
      translatedStrings,
      translationRatio,
      verbatimGlossaryRatio,
      contentBytes,
      bytesPerTranslatedString,
      suspectFiles,
    },
  };
}

/** Riassunto leggibile del verdetto per messaggi UI/log. */
export function describeRedistribution(v: RedistributionVerdict): string {
  if (v.severity === 'ok') return 'Nessun segnale di redistribuzione di testo originale.';
  const head = v.severity === 'block'
    ? 'Pubblicazione bloccata: il pack sembra redistribuire testo originale del gioco.'
    : 'Avviso: il pack potrebbe contenere testo originale (richiede revisione).';
  return `${head}\n- ${v.reasons.map(r => r.detail).join('\n- ')}`;
}
