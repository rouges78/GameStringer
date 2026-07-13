'use client';

/**
 * Font check di un gioco — scova i □□□ PRIMA di giocare.
 *
 * 1. Scansiona la cartella del gioco alla ricerca di font (ttf/otf/ttc) e ne
 *    analizza la copertura per la lingua target (lib/font-coverage.ts).
 * 2. Per Unity interroga/applica l'override font di XUnity (comandi Rust
 *    check_game_font_status / apply_xunity_font_override — riusano la logica
 *    già presente nell'installer, issue #46).
 * 3. Per gli altri engine produce un verdetto + consiglio operativo
 *    (chiave i18n per engine).
 *
 * Nota: molti giochi tengono i font dentro asset compilati e non come file
 * sciolti; in quel caso il risultato è 'no_fonts_found' e resta il consiglio
 * per-engine (per Unity l'override XUnity funziona comunque a runtime).
 */

import { invoke } from '@/lib/tauri-api';
import { clientLogger } from './client-logger';
import { analyzeFontForLanguage, scriptsForLanguage, type FontLanguageReport } from './font-coverage';

// ── Tipi ───────────────────────────────────────────────────

export interface GameFontFile {
  path: string;
  name: string;
  size: number;
  report: FontLanguageReport | null; // null = non ispezionabile
}

export type FontVerdict =
  | 'ok'              // almeno un font copre la lingua target
  | 'missing_glyphs'  // font trovati ma NESSUNO copre la lingua → □□□ probabili
  | 'no_fonts_found'  // nessun font sciolto ispezionabile
  | 'latin_target';   // la lingua target è latina di base: rischio basso

export interface GameFontCheck {
  verdict: FontVerdict;
  targetLang: string;
  scripts: string[];
  fonts: GameFontFile[];
  /** chiave i18n del consiglio per l'engine (fontCheck.advice*) */
  adviceKey: string;
}

export interface XUnityFontStatus {
  needs_override: boolean;
  xunity_config_path: string | null;
  override_present: boolean;
  tmp_font_expected: string;
  tmp_bundle_present: boolean;
  unity_version: string | null;
}

// ── Scanner ────────────────────────────────────────────────

const MAX_FONTS_TO_ANALYZE = 12;
const MAX_FONT_SIZE = 45_000_000; // read_binary_file_base64 rifiuta >50MB

interface ScannedFile { path: string; name: string; size: number; extension: string }

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Trova e analizza i font della cartella di gioco per la lingua target. */
export async function checkGameFonts(installPath: string, targetLang: string, engine?: string | null): Promise<GameFontCheck> {
  const scripts = scriptsForLanguage(targetLang);
  const adviceKey = adviceKeyForEngine(engine);

  // Lingue latine di base: quasi tutti i font di gioco le coprono.
  const nonLatin = scripts.some(s => !['latin', 'latinExt'].includes(s));

  let found: ScannedFile[] = [];
  try {
    found = await invoke<ScannedFile[]>('scan_localization_files', {
      path: installPath,
      extensions: ['ttf', 'otf', 'ttc'],
      maxDepth: 6,
    });
  } catch (e) {
    clientLogger.warn('[fontCheck] scan fallito:', String(e));
  }

  const fonts: GameFontFile[] = [];
  for (const f of (found || []).slice(0, MAX_FONTS_TO_ANALYZE)) {
    if (f.size > MAX_FONT_SIZE) {
      fonts.push({ path: f.path, name: f.name, size: f.size, report: null });
      continue;
    }
    try {
      const b64 = await invoke<string>('read_binary_file_base64', { path: f.path });
      const report = analyzeFontForLanguage(base64ToArrayBuffer(b64), targetLang);
      fonts.push({ path: f.path, name: f.name, size: f.size, report });
    } catch (e) {
      clientLogger.warn(`[fontCheck] lettura font fallita (${f.name}):`, String(e));
      fonts.push({ path: f.path, name: f.name, size: f.size, report: null });
    }
  }

  let verdict: FontVerdict;
  const analyzed = fonts.filter(f => f.report);
  if (!nonLatin) {
    verdict = 'latin_target';
  } else if (analyzed.length === 0) {
    verdict = 'no_fonts_found';
  } else if (analyzed.some(f => f.report!.ok)) {
    verdict = 'ok';
  } else {
    verdict = 'missing_glyphs';
  }

  return { verdict, targetLang, scripts, fonts, adviceKey };
}

/** Consiglio operativo per engine (chiavi i18n in fontCheck.*). */
function adviceKeyForEngine(engine?: string | null): string {
  const e = (engine || '').toLowerCase();
  if (e.includes('unity')) return 'adviceUnity';
  if (e.includes('unreal')) return 'adviceUnreal';
  if (e.includes('ren')) return 'adviceRenpy';
  if (e.includes('rpg')) return 'adviceRpgMaker';
  if (e.includes('godot')) return 'adviceGodot';
  return 'adviceGeneric';
}

// ── Unity / XUnity ─────────────────────────────────────────

export async function getXUnityFontStatus(installPath: string, targetLang: string): Promise<XUnityFontStatus | null> {
  try {
    return await invoke<XUnityFontStatus>('check_game_font_status', {
      gamePath: installPath,
      targetLang,
    });
  } catch (e) {
    clientLogger.debug('[fontCheck] check_game_font_status non disponibile:', String(e));
    return null;
  }
}

/**
 * Applica l'override font alla config XUnity esistente e scarica/copia il
 * bundle TMP corretto per la versione Unity del gioco. Ritorna i passi
 * eseguiti (da mostrare all'utente).
 */
export async function applyXUnityFontFix(installPath: string, targetLang: string): Promise<string[]> {
  return invoke<string[]>('apply_xunity_font_override', {
    gamePath: installPath,
    targetLang,
  });
}

// ── Sostituzione font automatica (engine file-based) ──────

/** Engine per cui esiste l'installazione font automatica (Noto). */
export function supportsAutoFontInstall(engine?: string | null): boolean {
  const e = (engine || '').toLowerCase();
  return e.includes('ren') || e.includes('rpg');
}

/**
 * Installa un font Noto a copertura ampia nel gioco (Ren'Py: game/ + .rpy di
 * override; RPG Maker MV: www/fonts + gamefont.css; MZ: fonts/ + System.json).
 * Il font viene scaricato una volta sola nella cache locale. Ritorna i passi.
 */
export async function installGameFont(installPath: string, engine: string, targetLang: string): Promise<string[]> {
  return invoke<string[]>('install_game_font', {
    gamePath: installPath,
    engine,
    targetLang,
  });
}

/** Ripristina i font originali del gioco (annulla installGameFont). */
export async function removeGameFont(installPath: string, engine: string): Promise<string[]> {
  return invoke<string[]>('remove_game_font', {
    gamePath: installPath,
    engine,
  });
}
