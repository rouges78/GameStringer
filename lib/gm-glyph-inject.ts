/**
 * gm-glyph-inject — ponte frontend per l'iniezione glifi GameMaker (ADR-005).
 *
 * Il comando Rust `gm_inject_glyphs` riscrive i pixel dei glifi donatori
 * (kanji inutilizzati) DENTRO l'area esistente della texture del font nel
 * data.win, senza spostare un solo offset. Due modalità:
 *  - anteprima (apply: false): calcola tutto, compressione reale inclusa,
 *    e non tocca niente;
 *  - applicazione (apply: true): backup obbligatorio, o tutto o niente.
 *
 * Il TTF sorgente arriva da `gm_prepare_glyph_font`, che riusa la cache font
 * di font_installer.rs (NotoSans LGC: latino esteso + cirillico + greco).
 */

import { invoke } from '@/lib/tauri-api';
import { scriptsForLanguage, SCRIPT_SAMPLES } from '@/lib/font-coverage';

// ── Tipi speculari alle struct Rust (serde rename_all = camelCase) ──

export interface GmEsitoFont {
  font: string;
  texture: number;
  /** Lettere effettivamente iniettate. */
  iniettati: string[];
  /** Lettere saltate, con il motivo (assenti dal TTF o senza celle libere). */
  saltati: [string, string][];
  donatoriSacrificati: number;
  donatoriSvuotati: number;
  /** Altezza in pixel delle lettere disegnate. */
  altezzaGlifi: number;
  /** Altezza delle maiuscole già presenti nel font (il bersaglio). */
  altezzaMaiuscoleFont: number;
}

export interface GmEsitoTextura {
  texture: number;
  font: string[];
  blobOriginale: number;
  blobNuovo: number;
  /** Byte che avanzano. Negativo = non ci sta. */
  margine: number;
  ciSta: boolean;
}

export interface GmEsitoIniezione {
  /** false = anteprima, niente è stato scritto. */
  applicato: boolean;
  dataWin: string;
  backup: string | null;
  font: GmEsitoFont[];
  texture: GmEsitoTextura[];
  /** Vero solo se ogni texture rientra nel proprio budget. */
  realizzabile: boolean;
  avvisi: string[];
}

// ── Caratteri da iniettare per lingua ──
//
// Non tutto latinExt: ogni lettera consuma un glifo donatore, quindi si
// iniettano solo le lettere che la lingua target usa davvero. Per le lingue
// non elencate si ripiega sul campione di scrittura di font-coverage.

const ACCENTS_BY_LANG: Record<string, string> = {
  it: 'àèéìòùÀÈÉÌÒÙ',
  de: 'äöüßÄÖÜ',
  fr: 'àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ',
  es: 'áéíóúüñÁÉÍÓÚÜÑ¿¡',
  pt: 'áàâãçéêíóôõúüÁÀÂÃÇÉÊÍÓÔÕÚÜ',
  pl: 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
  cs: 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ',
  tr: 'çğıİöşüÇĞÖŞÜ',
  hu: 'áéíóöőúüűÁÉÍÓÖŐÚÜŰ',
  ro: 'ăâîșțĂÂÎȘȚ',
  nl: 'éëïÉËÏ',
};

/** Le lettere da aggiungere ai font del gioco per la lingua target. */
export function glyphsToInject(targetLang: string): string {
  const base = (targetLang || '').split(/[-_]/)[0].toLowerCase();
  const accents = ACCENTS_BY_LANG[base];
  if (accents) return accents;
  // Scritture non latine (cyrillic, greek, …): il campione di font-coverage
  // è l'alfabeto utile. Si escludono latin (ASCII già nei font GM) e le
  // scritture CJK/hangul: migliaia di glifi, fuori portata per un atlante.
  const scripts = scriptsForLanguage(base).filter(
    s => s !== 'latin' && s !== 'cjk' && s !== 'hiragana' && s !== 'katakana' && s !== 'hangul'
  );
  const chars = scripts.map(s => SCRIPT_SAMPLES[s]).join('');
  return chars || SCRIPT_SAMPLES.latinExt;
}

/** Vero se la lingua target è iniettabile (niente CJK/hangul: troppi glifi). */
export function isInjectableLang(targetLang: string): boolean {
  const base = (targetLang || '').split(/[-_]/)[0].toLowerCase();
  return !['ja', 'zh', 'ko'].includes(base);
}

/** Scarica (o riusa dalla cache) il TTF adatto e ne dà il percorso. */
export async function prepareGlyphFont(targetLang: string): Promise<string> {
  return invoke<string>('gm_prepare_glyph_font', { targetLang });
}

/**
 * Anteprima o applicazione dell'iniezione.
 * `fontNames` vuoto = tutti i font con glifi donatori.
 */
export async function injectGlyphs(opts: {
  gamePath: string;
  targetLang: string;
  ttfPath: string;
  fontNames?: string[];
  apply: boolean;
}): Promise<GmEsitoIniezione> {
  return invoke<GmEsitoIniezione>('gm_inject_glyphs', {
    gamePath: opts.gamePath,
    fontNames: opts.fontNames ?? [],
    characters: glyphsToInject(opts.targetLang),
    ttfPath: opts.ttfPath,
    apply: opts.apply,
  });
}

/** Il motore è GameMaker? (data.win) */
export function isGameMakerEngine(engine?: string | null): boolean {
  const e = (engine || '').toLowerCase();
  return e.includes('gamemaker') || e.includes('game maker');
}
