#!/usr/bin/env node
/**
 * Gate `npm audit` con allowlist motivata (task ROADMAP `sec-deps`).
 *
 * `npm audit` non ha un equivalente di `cargo audit --ignore`: o passa tutto
 * o fallisce. Questo script fa da gate al posto suo, con le stesse regole che
 * usiamo su cargo:
 *
 *   - bloccano solo le vulnerabilità high/critical (low/moderate = rumore);
 *   - le eccezioni sono ECCEZIONI MOTIVATE, non silenziamenti: ognuna ha una
 *     motivazione scritta e una data di scadenza. Passata quella data il gate
 *     torna rosso e l'eccezione va rivista o rimossa;
 *   - se una vulnerabilità in allowlist sparisce (dipendenza aggiornata) lo
 *     script lo segnala, così l'eccezione viene cancellata alla prima occasione.
 *
 * Se `npm audit` stesso fallisce (registry irraggiungibile, JSON malformato)
 * il gate fallisce: mai fail-open su un audit rotto.
 *
 * Uso:  node scripts/audit-gate.js [--level=high]
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * Eccezioni attive. Ogni voce va giustificata: perché il codice vulnerabile
 * non è raggiungibile da input di terzi, e cosa sblocca la rimozione.
 */
const ALLOWLIST = [
  {
    id: 'GHSA-mh99-v99m-4gvg',
    package: 'brace-expansion',
    until: '2026-09-30',
    reason: [
      'DoS per espansione illimitata di pattern glob (CVSS 7.5). Corretta solo',
      'in brace-expansion 5.0.8: nessun backport su 1.x/2.x/3.x/4.x, quindi ogni',
      'copia nell\'albero risulta vulnerabile.',
      '',
      'Non è raggiungibile da input di terzi: i pattern glob li generiamo noi',
      "(archiver .directory() per i .gspack, e la catena eslint gira solo in dev).",
      'Nessun pattern arriva da file di gioco, pack scaricati o input utente.',
      '',
      'Rimozione: richiede archiver 8 (ESM-only, tocca lib/patch-manager.ts) per',
      'la catena prod ed eslint 10 (flat config) per quella dev. Tracciato a parte:',
      'non si forza con un override, perché il build CJS di brace-expansion 5.x',
      'esporta un oggetto e non una funzione, e rompe minimatch 3.x a runtime.',
    ].join('\n'),
  },
];

const LEVELS = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function runAudit(omitDev) {
  const args = ['audit', '--json'];
  if (omitDev) args.push('--omit=dev');
  // NON TOGLIERE shell:true su Windows, e non provare a sostituirlo nominando
  // 'npm.cmd': dà spawnSync EINVAL. Provato il 27/07/2026.
  //
  // Le due patch di Node si contraddicono. Da 18.20.2/20.12.2 (mitigazione
  // CVE-2024-27980) spawnare un .cmd/.bat SENZA shell è vietato e fallisce con
  // EINVAL; ma spawnarlo CON shell stampa DEP0190, perché con la shell di mezzo
  // gli argomenti vengono concatenati e non escapati. Su Windows `npm` È npm.cmd,
  // quindi le uniche uscite sono shell:true col warning, oppure invocare
  // node su npm-cli.js — che però va localizzato a mano e si rompe con nvm/volta.
  //
  // Qui gli argomenti sono costanti scritte dieci righe più sopra: nessun input
  // di terzi li tocca, quindi il rischio che DEP0190 descrive non esiste. Il
  // warning è rumore nei log, non un difetto: si tiene.
  const res = spawnSync('npm', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });

  if (res.error) {
    throw new Error(`impossibile eseguire npm audit: ${res.error.message}`);
  }
  // npm audit esce !=0 quando trova vulnerabilità: è normale, il verdetto lo
  // diamo noi. Quello che NON è normale è uno stdout che non è JSON.
  let parsed;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    throw new Error(
      `npm audit non ha prodotto JSON valido (exit ${res.status}).\n` +
        `stdout: ${(res.stdout || '').slice(0, 500)}\n` +
        `stderr: ${(res.stderr || '').slice(0, 500)}`
    );
  }
  if (parsed.error) {
    throw new Error(`npm audit ha restituito un errore: ${JSON.stringify(parsed.error)}`);
  }
  return parsed;
}

/** Estrae gli advisory (GHSA) dal report, con i pacchetti impattati. */
function collectAdvisories(report) {
  const advisories = new Map();
  for (const [pkgName, vuln] of Object.entries(report.vulnerabilities || {})) {
    for (const via of vuln.via || []) {
      if (typeof via !== 'object' || !via.url) continue;
      const id = via.url.split('/').pop();
      if (!advisories.has(id)) {
        advisories.set(id, {
          id,
          url: via.url,
          title: via.title,
          severity: via.severity,
          source: via.name,
          packages: new Set(),
        });
      }
      advisories.get(id).packages.add(pkgName);
    }
  }
  return advisories;
}

function main() {
  const levelArg = process.argv.find((a) => a.startsWith('--level='));
  const minLevel = LEVELS[levelArg ? levelArg.split('=')[1] : 'high'];
  if (minLevel === undefined) {
    console.error(`Livello non valido: ${levelArg}`);
    process.exit(2);
  }

  const full = runAudit(false);
  const prodOnly = runAudit(true);
  const advisories = collectAdvisories(full);
  const prodAdvisories = collectAdvisories(prodOnly);

  const allowById = new Map(ALLOWLIST.map((e) => [e.id, e]));
  const today = new Date().toISOString().slice(0, 10);

  const blocking = [];
  const excused = [];
  const belowLevel = [];

  for (const adv of advisories.values()) {
    if (LEVELS[adv.severity] < minLevel) {
      belowLevel.push(adv);
      continue;
    }
    const exception = allowById.get(adv.id);
    if (!exception) {
      blocking.push({ adv, why: 'nessuna eccezione' });
    } else if (exception.until < today) {
      blocking.push({ adv, why: `eccezione SCADUTA il ${exception.until}` });
    } else {
      excused.push({ adv, exception });
    }
  }

  const stale = ALLOWLIST.filter((e) => !advisories.has(e.id));

  // ---- report ----
  const counts = full.metadata?.vulnerabilities || {};
  console.log('=== Gate npm audit ===');
  console.log(
    `Totali: ${counts.critical || 0} critical, ${counts.high || 0} high, ` +
      `${counts.moderate || 0} moderate, ${counts.low || 0} low ` +
      `(soglia bloccante: ${levelArg ? levelArg.split('=')[1] : 'high'})`
  );
  if (belowLevel.length) {
    console.log(`Sotto soglia, non bloccanti: ${belowLevel.length} advisory.`);
  }

  // Un advisory che compare anche con --omit=dev tocca il runtime spedito
  // all'utente; gli altri restano confinati agli strumenti di sviluppo.
  const scopeOf = (id) => (prodAdvisories.has(id) ? 'PROD' : 'solo dev');

  for (const { adv, exception } of excused) {
    const scope = scopeOf(adv.id);
    console.log(`\n⚠️  TOLLERATA ${adv.id} [${adv.severity}, ${scope}] — scade ${exception.until}`);
    console.log(`    ${adv.title}`);
    console.log(`    pacchetti: ${[...adv.packages].sort().join(', ')}`);
    console.log(
      exception.reason
        .split('\n')
        .map((l) => `    | ${l}`)
        .join('\n')
    );
  }

  for (const e of stale) {
    console.log(
      `\n🧹 Eccezione non più necessaria: ${e.id} (${e.package}) non compare più ` +
        `nell'audit. Rimuovila da scripts/audit-gate.js.`
    );
  }

  for (const { adv, why } of blocking) {
    const scope = scopeOf(adv.id);
    console.log(`\n❌ BLOCCANTE ${adv.id} [${adv.severity}, ${scope}] — ${why}`);
    console.log(`    ${adv.title}`);
    console.log(`    pacchetti: ${[...adv.packages].sort().join(', ')}`);
    console.log(`    ${adv.url}`);
  }

  if (blocking.length) {
    console.log(
      `\nGate FALLITO: ${blocking.length} advisory ≥ soglia senza eccezione valida.\n` +
        `Aggiorna la dipendenza, oppure aggiungi un'eccezione MOTIVATA e datata in ` +
        `scripts/audit-gate.js.`
    );
    process.exit(1);
  }

  console.log(
    `\n✅ Gate superato${excused.length ? ` (${excused.length} eccezione/i attive)` : ''}.`
  );
}

try {
  main();
} catch (err) {
  console.error(`❌ Gate npm audit non eseguibile: ${err.message}`);
  process.exit(2);
}
