/**
 * Guardia anti-regressione sulle liste di lingue target.
 *
 * Un utente ceco ha segnalato che il ceco non compariva nei dropdown "lingua
 * target" di OCR Translator e di altre schermate, pur essendo supportato dai
 * provider (DeepL, Gemini, NLLB `ces_Latn`). Causa: ogni schermata ridefiniva
 * la propria lista hardcoded invece di leggere quella canonica in
 * `lib/translation/target-languages.ts`, e ognuna ne conteneva un sottoinsieme
 * diverso.
 *
 * Regole:
 * 1. La lista canonica è l'unica fonte di verità: ogni suo codice deve avere un
 *    nome NLLB e un nome inglese in `language-mappings.ts` (altrimenti la lingua
 *    compare nella UI ma il backend non sa tradurla).
 * 2. Nessun file di `app/` o `components/` può contenere una lista di lingue
 *    inline (>= 5 voci `code: '<iso>'`), tranne l'allowlist qui sotto: sono
 *    liste vincolate dalla tecnologia sottostante (voci TTS, lingue OCR
 *    dell'engine, locale della UI) e NON sono lingue target di traduzione.
 *
 * Se questo test fallisce su un file nuovo: quasi certamente va importata
 * `TARGET_LANGUAGES`, non aggiunto il file all'allowlist.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TARGET_LANGUAGES } from '../../lib/translation/target-languages';
import { LANG_NAMES, NLLB_LANG_MAP } from '../../lib/translation/language-mappings';

const ROOT = join(__dirname, '..', '..');

/**
 * File che possono legittimamente avere una lista di lingue locale, con il
 * motivo. NON aggiungere qui un dropdown di lingua target.
 */
const ALLOWLIST: Record<string, string> = {
  'components/profiles/create-profile-dialog.tsx': 'locale della UI (tipo Language), non lingue target',
  'components/ocr-image-processor.tsx': 'lingue SORGENTE riconosciute dall\'engine OCR + Auto Detect',
  'components/voice/voice-translator.tsx': 'lingue vincolate a Whisper/TTS + Auto-Detect',
  'components/audio-translation.tsx': 'lingue sorgente di Whisper',
  'app/dubbing/page.tsx': 'lingue vincolate alle voci TTS disponibili',
  'app/settings/page.tsx': 'lingue SORGENTE per la pre-indicizzazione della TM',
  'app/editor/page.tsx': 'ordine colonne nei file di localizzazione multi-lingua',
  'app/live-translate/page.tsx': 'OCR_LANGUAGES: codici Tesseract a 3 lettere (eng/ita/...)',
  'components/forum/new-thread.tsx': 'lingue del forum, allineate ai locale della community',
  'components/layout/main-layout.tsx': 'locale della UI',
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('lingue target — fonte di verità unica', () => {
  it('ogni lingua canonica ha mapping NLLB e nome inglese', () => {
    const senzaNllb = TARGET_LANGUAGES.filter(l => !NLLB_LANG_MAP[l.code]).map(l => l.code);
    const senzaNome = TARGET_LANGUAGES.filter(l => !LANG_NAMES[l.code]).map(l => l.code);
    expect(senzaNllb, 'codici senza NLLB_LANG_MAP').toEqual([]);
    expect(senzaNome, 'codici senza LANG_NAMES').toEqual([]);
  });

  it('nessun codice duplicato nella lista canonica', () => {
    const codici = TARGET_LANGUAGES.map(l => l.code);
    expect(codici).toHaveLength(new Set(codici).size);
  });

  it('il ceco è disponibile come lingua target (regressione utente)', () => {
    const cs = TARGET_LANGUAGES.find(l => l.code === 'cs');
    expect(cs, 'cs mancante da TARGET_LANGUAGES').toBeDefined();
    expect(NLLB_LANG_MAP.cs).toBe('ces_Latn');
  });

  it('nessuna schermata ridefinisce una lista di lingue inline', () => {
    const rx = /code:\s*['"][a-z]{2}(?:[-_][A-Za-z]{2,4})?['"]/g;
    const colpevoli: string[] = [];

    for (const dir of ['app', 'components']) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const rel = relative(ROOT, file).split(sep).join('/');
        if (ALLOWLIST[rel]) continue;
        const voci = readFileSync(file, 'utf-8').match(rx)?.length ?? 0;
        if (voci >= 5) colpevoli.push(`${rel} (${voci} voci)`);
      }
    }

    expect(
      colpevoli,
      'importa TARGET_LANGUAGES da lib/translation/target-languages invece di ridefinire la lista',
    ).toEqual([]);
  });
});
