#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * av-checklist.js — checklist anti-falsi-positivi per l'ultima release.
 *
 *   npm run av:checklist            # ultima release
 *   npm run av:checklist -- v1.14.0 # release specifica
 *
 * Elenca gli asset Windows della release (nome, dimensione, sha256 quando
 * GitHub lo espone) e stampa i passi per la submission a Microsoft
 * (Defender + SmartScreen). Da fare entro poche ore dalla pubblicazione:
 * la reputazione SmartScreen riparte da zero ad ogni release.
 *
 * Richiede `gh` autenticato. Vedi docs/DEFENDER_SUBMISSION.md per il runbook.
 */
const { execFileSync } = require('child_process');

const C = { r: '\x1b[0m', b: '\x1b[1m', grn: '\x1b[32m', yel: '\x1b[33m', cya: '\x1b[36m', dim: '\x1b[2m' };
const REPO = 'rouges78/GameStringer';

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' });
}

function fmtSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function main() {
  const tag = process.argv[2] || '';
  const endpoint = tag
    ? `repos/${REPO}/releases/tags/${tag}`
    : `repos/${REPO}/releases/latest`;

  let release;
  try {
    // AV_CHECKLIST_FIXTURE: path a un JSON di release (per test senza gh).
    if (process.env.AV_CHECKLIST_FIXTURE) {
      release = JSON.parse(require('fs').readFileSync(process.env.AV_CHECKLIST_FIXTURE, 'utf8'));
    } else {
      release = JSON.parse(gh(['api', endpoint]));
    }
  } catch {
    console.error(`Impossibile leggere la release (${endpoint}): gh è autenticato?`);
    process.exit(1);
  }

  console.log(`\n${C.b}🛡️  Checklist antivirus — ${release.tag_name}${C.r} ${C.dim}(${release.published_at || 'not published'})${C.r}\n`);

  // Asset rilevanti per Defender/SmartScreen: gli eseguibili Windows.
  const winAssets = (release.assets || []).filter((a) =>
    /\.(exe|msi)$/i.test(a.name) || /portable.*\.zip$/i.test(a.name)
  );

  if (!winAssets.length) {
    console.log(`${C.yel}Nessun asset Windows trovato in questa release.${C.r}`);
  } else {
    console.log(`${C.b}Asset Windows da sottoporre:${C.r}`);
    for (const a of winAssets) {
      // Dal 2025 l'API GitHub espone `digest` (sha256:...) sugli asset.
      const digest = a.digest ? a.digest.replace('sha256:', '') : null;
      console.log(`  • ${a.name}  ${C.dim}${fmtSize(a.size)}${C.r}`);
      console.log(`    ${C.dim}url:${C.r} ${a.browser_download_url}`);
      if (digest) console.log(`    ${C.dim}sha256:${C.r} ${digest}`);
    }
    if (!winAssets.some((a) => a.digest)) {
      console.log(`  ${C.dim}(sha256 non esposto dall'API: calcolalo dopo il download con \`Get-FileHash <file>\`)${C.r}`);
    }
  }

  console.log(`\n${C.b}Passi (5 minuti, entro poche ore dalla release):${C.r}`);
  console.log(`  1. ${C.cya}Microsoft Defender / SmartScreen${C.r} — submission da sviluppatore:`);
  console.log(`     https://www.microsoft.com/en-us/wdsi/filesubmission`);
  console.log(`     ${C.dim}"Software developer" → "I believe this file is safe" → allega il setup .exe${C.r}`);
  console.log(`  2. Installa la release su una VM/PC Windows pulito e lancia l'app una volta`);
  console.log(`     ${C.dim}(esecuzioni reali con l'installer firmato accelerano la reputazione SmartScreen)${C.r}`);
  console.log(`  3. Se un utente segnala un vendor specifico (Avast, Bitdefender, Kaspersky…),`);
  console.log(`     usa il modulo false-positive di quel vendor — link nel runbook.`);
  console.log(`\n${C.dim}Runbook completo: docs/DEFENDER_SUBMISSION.md · Pagina utenti: docs/ANTIVIRUS.md${C.r}\n`);
}

main();
