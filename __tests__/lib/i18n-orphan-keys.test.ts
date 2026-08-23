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
 * Regola: il numero di chiavi orfane può solo SCENDERE. Non zero — ce ne sono
 * già ~1600, e ripulirle tutte è un lavoro a parte — ma nessuna nuova.
 *
 * Cosa conta come "usata":
 *  1. la chiave compare LETTERALE da qualche parte nel sorgente. Non solo dentro
 *     `t('...')`: anche `nameKey: 'nav.x'` poi passato a `t(item.nameKey)`.
 *  2. la chiave inizia per un prefisso costruito dinamicamente in un template
 *     literal, es. `changelog.v${version}.${i}` copre tutte le changelog.v*.
 */
import { describe, expect, it as test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');

/** Numero di orfane al 23/08/2026, dopo la rimozione di translationRecommendationComp. */
const BASELINE = 1601;

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
  const keys = flatten(JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/i18n/locales/en.json'), 'utf8')));

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

  const isUsed = (k: string) => literal.has(k) || dynamic.some((p) => k.startsWith(p));
  const orphans = keys.filter((k) => !isUsed(k));

  test('il rilevatore riconosce le chiavi realmente usate', () => {
    // sanity: se questi non risultano usati, il rilevatore è rotto e il
    // conteggio sotto non vuol dire niente.
    expect(isUsed('changelog.currentVersion')).toBe(true);
    expect(keys.length).toBeGreaterThan(5000);
    expect(orphans.length).toBeLessThan(keys.length / 2);
  });

  test(`nessuna nuova chiave orfana (baseline ${BASELINE})`, () => {
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
