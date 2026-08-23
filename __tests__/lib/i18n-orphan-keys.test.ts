/**
 * Guardia sulle chiavi i18n orfane.
 *
 * Il 23/08/2026 è stato rimosso `translationRecommendationComp`: 61 chiavi che
 * nessuna riga di codice referenziava, più una in `common`. 744 stringhe su
 * dodici lingue. Dentro ci stavano le uniche quattro rimaste che mandavano
 * l'utente a gdsdecomp, al link UnRPA e a RPG Maker Trans — un tool il cui sito
 * non esiste più. La prosa viva risultava pulita non perché qualcuno l'avesse
 * corretta, ma perché quella sbagliata era irraggiungibile.
 *
 * `i18n-locale-integrity` non poteva vederle: verifica che una chiave ESISTA IN
 * TUTTE LE LINGUE, non che QUALCUNO LA USI. Una chiave orfana è perfettamente in
 * regola per quel controllo.
 *
 * Regola: ZERO chiavi orfane. La baseline è nata a 1601 il 23/08/2026, ed è
 * scesa a zero lo stesso giorno ripulendole tutte. Da soglia decrescente è
 * diventata un controllo stretto: una chiave che nessuno legge non entra.
 *
 * Se questo test diventa rosso hai due strade, e vanno distinte: se la chiave
 * SERVE, collegala a un `t()`; se non serve, toglila da tutti e dodici i
 * locale. Lasciarla lì «per dopo» è come sono nate le 1601.
 *
 * Cosa conta come "usata":
 *  1. la chiave compare LETTERALE da qualche parte nel sorgente. Non solo dentro
 *     `t('...')`: anche `nameKey: 'nav.x'` poi passato a `t(item.nameKey)`.
 *  2. la chiave inizia per un prefisso costruito dinamicamente in un template
 *     literal, es. `changelog.v${version}.${i}` copre tutte le changelog.v*.
 *  3. il suo NAMESPACE è raggiunto come oggetto:
 *       const dash = translations[language]?.dashboard;
 *       ...
 *       <span>{dash.noRecentActivity}</span>
 *     Qui la chiave non compare MAI come stringa. Questa regola mancava nella
 *     prima versione, e cancellare in base a quel conteggio ha rotto il
 *     typecheck in 31 punti su tre pagine. Marca vivo l'intero namespace, il che
 *     tiene qualche chiave morta di troppo — ma è il verso giusto in cui
 *     sbagliare: una falsa «usata» costa una riga inutile in un JSON, una falsa
 *     «orfana» fa vedere all'utente il nome grezzo della chiave.
 */
import { describe, expect, it as test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');

/** Zero: tutte ripulite il 23/08/2026. Vedi il commento in testa se sale. */
const BASELINE = 0;

function flatten(o: unknown, prefix = '', out: string[] = []): string[] {
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out.push(key);
  }
  return out;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'target', '.git', 'locales'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('chiavi i18n orfane', () => {
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/i18n/locales/en.json'), 'utf8'));
  const keys = flatten(en);
  const topNamespaces = Object.keys(en);

  let src = '';
  for (const d of ['app', 'components', 'lib', 'scripts']) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of sourceFiles(dir)) src += fs.readFileSync(f, 'utf8') + '\n';
  }

  // 1. chiavi citate per intero, in qualunque forma di stringa
  const literal = new Set(
    [...src.matchAll(/['"`]([a-zA-Z][\w]*(?:\.[\w]+)+)['"`]/g)].map((m) => m[1]),
  );
  // 2. prefissi costruiti a runtime: `ns.qualcosa${...}`. Devono contenere un
  //    punto, o prefissi come `m` o `d` (variabili in template qualsiasi)
  //    marcherebbero come usata mezza tabella.
  const dynamic = [
    ...new Set([...src.matchAll(/`([a-zA-Z][\w]*\.[\w.]*)\$\{/g)].map((m) => m[1])),
  ];

  // 3. namespace raggiunti come oggetto: `.dashboard`, `?.library`
  const objectNamespaces = topNamespaces.filter((ns) => new RegExp(`\\.${ns}\\b`).test(src));

  const isUsed = (k: string) =>
    literal.has(k) ||
    dynamic.some((p) => k.startsWith(p)) ||
    objectNamespaces.some((ns) => k.startsWith(`${ns}.`));
  const orphans = keys.filter((k) => !isUsed(k));

  test('il rilevatore riconosce le chiavi realmente usate', () => {
    // sanity: se questi non risultano usati, il rilevatore è rotto e il
    // conteggio sotto non vuol dire niente. Le ultime tre sono le chiavi che
    // il 23/08 sono state cancellate per errore e hanno rotto il typecheck:
    // se tornano a risultare orfane, la regola 3 si è persa di nuovo.
    expect(isUsed('changelog.currentVersion')).toBe(true);
    expect(isUsed('dashboard.noRecentActivity')).toBe(true);
    expect(isUsed('library.noGames')).toBe(true);
    expect(isUsed('aiTranslator.provider')).toBe(true);
    expect(keys.length).toBeGreaterThan(5000);
  });

  test('nessuna chiave i18n senza un lettore', () => {
    const sample = orphans.slice(0, 15).join('\n  ');
    expect(
      orphans.length,
      orphans.length > BASELINE
        ? `Chiave i18n non referenziata da nessuna riga di codice.\n` +
          `Orfane: ${orphans.length} (baseline ${BASELINE}).\n` +
          `Se la chiave serve, usala; se non serve, toglila da tutti i locale.\n` +
          `Prime 15:\n  ${sample}`
        : '',
    ).toBeLessThanOrEqual(BASELINE);
  });
});
