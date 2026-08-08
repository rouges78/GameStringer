#!/usr/bin/env node
/**
 * check-tauri-parity.js — guard npm-vs-crate per la famiglia Tauri.
 *
 * Nato il 07/08/2026 dal difetto n°6 della ship v1.16.0: la PR Dependabot
 * npm-minor-patch del 04/08 ha portato @tauri-apps/cli+api a 2.11 col crate
 * tauri fermo a 2.10.3 — e `tauri build` rifiuta i minor disallineati su
 * TUTTI gli OS. Il danno si è visto solo in release, cioè nel momento più
 * costoso. Stessa famiglia di to-ico ([sec-deps]): i bump di gruppo
 * Dependabot toccano il lato npm senza guardare il lato Rust.
 *
 * REGOLA: major.minor di @tauri-apps/cli, @tauri-apps/api (npm, versioni
 * RISOLTE nel package-lock) e del crate tauri (versione RISOLTA in
 * src-tauri/Cargo.lock) devono coincidere. I lockfile sono la verità:
 * è ciò che installa la CI, non ciò che dichiara un range.
 *
 * Uso:  node scripts/check-tauri-parity.js        # exit 1 se disallineati
 *       npm run tauri:parity
 *
 * Nessuna dipendenza, nessuna rete: legge tre file e confronta.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function fail(msg) {
  console.error(`❌ tauri-parity: ${msg}`);
  process.exit(1);
}

function minor(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) fail(`versione non parsabile: "${v}"`);
  return `${m[1]}.${m[2]}`;
}

// --- npm: versioni risolte dal package-lock ---------------------------------
const lockPath = path.join(ROOT, 'package-lock.json');
if (!fs.existsSync(lockPath)) fail('package-lock.json assente.');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const pkgs = lock.packages || {};

function npmResolved(name) {
  const entry = pkgs[`node_modules/${name}`];
  if (!entry || !entry.version) fail(`${name} non trovato nel package-lock (node_modules/${name}).`);
  return entry.version;
}

const cliV = npmResolved('@tauri-apps/cli');
const apiV = npmResolved('@tauri-apps/api');

// --- crate: versione risolta da Cargo.lock ----------------------------------
const cargoLockPath = path.join(ROOT, 'src-tauri', 'Cargo.lock');
if (!fs.existsSync(cargoLockPath)) fail('src-tauri/Cargo.lock assente.');
const cargoLock = fs.readFileSync(cargoLockPath, 'utf8');
// Blocco [[package]] con name = "tauri" ESATTO (non tauri-build, non i plugin).
const m = /\[\[package\]\]\s*\nname = "tauri"\nversion = "([^"]+)"/.exec(cargoLock);
if (!m) fail('crate "tauri" non trovato in src-tauri/Cargo.lock.');
const crateV = m[1];

// --- confronto ---------------------------------------------------------------
const rows = [
  ['@tauri-apps/cli (npm lock)', cliV],
  ['@tauri-apps/api (npm lock)', apiV],
  ['tauri (Cargo.lock)', crateV],
];
const minors = new Set(rows.map(([, v]) => minor(v)));

for (const [name, v] of rows) console.log(`   ${name.padEnd(28)} ${v}  (minor ${minor(v)})`);

if (minors.size > 1) {
  console.error('');
  fail(
    `minor DISALLINEATI (${[...minors].join(' vs ')}) — tauri build rifiuterà su tutti gli OS.\n` +
    '   Cura: riallinea npm e crate allo STESSO minor. O si abbassano i pacchetti npm\n' +
    '   (npm install @tauri-apps/cli@<ver> @tauri-apps/api@<ver> --save-exact), o si alza\n' +
    '   il crate (cd src-tauri && cargo update -p tauri) — e in ogni caso: cargo check\n' +
    '   A FREDDO prima di qualsiasi release. Riferimento: difetto 6 della ship v1.16.0.'
  );
}

console.log(`✅ tauri-parity: npm e crate allineati sul minor ${[...minors][0]}.`);
