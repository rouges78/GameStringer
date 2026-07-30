#!/usr/bin/env node
/**
 * Rigenera le fixture .locres del corpus nel formato VERO di Unreal.
 *
 * PERCHÉ ESISTE
 * -------------
 * Le fixture `__tests__/fixtures/engines/unreal/Game.locres` e `Game_v2.locres`
 * erano state generate "replicando ESATTAMENTE il formato letto dal parser"
 * (commento in src-tauri/tests/engine_fixtures.rs). Il parser però leggeva un
 * magic INVENTATO da noi — quattro byte 0x0E14DA7A invece del FGuid da 16 byte
 * di UE — quindi le fixture congelavano l'errore invece del formato, e i test
 * passavano su file che Unreal non caricherebbe mai.
 *
 * Questo script le riscrive partendo dalla SPECIFICA, non dal nostro parser:
 *   magic  = FGuid(0x7574140E, 0xFC034A67, 0x9D90154A, 0x1B7F37C3), 16 byte
 *   v0     = Legacy: NESSUN header, si comincia dal conteggio dei namespace
 *   v2     = magic + versione + OFFSET i64 assoluto al string array (in fondo)
 *   FString: lunghezza positiva = ANSI a byte singolo · negativa = UTF-16LE,
 *            in entrambi i casi il terminatore nullo è incluso nel conteggio
 *
 * Il contenuto (namespace, key, valori, source hash) è identico a prima, così
 * le asserzioni dei test restano valide: cambia solo l'involucro binario.
 *
 * Uso: node scripts/dev/regen-locres-fixtures.js [--check]
 *      --check verifica senza riscrivere (utile in CI)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'engines', 'unreal');

const LOCRES_MAGIC = Buffer.from([
  0x0e, 0x14, 0x74, 0x75, 0x67, 0x4a, 0x03, 0xfc,
  0x4a, 0x15, 0x90, 0x9d, 0xc3, 0x37, 0x7f, 0x1b,
]);

// ── Contenuto delle fixture (invariato rispetto alle vecchie) ────────────
const ENTRIES = [
  { ns: 'Dialog', key: 'npc_greeting', hash: 0x11111111, value: 'Welcome to Eldoria, traveler!' },
  { ns: 'Dialog', key: 'guard_warning', hash: 0x22222222, value: 'You shall not pass!' },
  { ns: 'UI', key: 'menu_start', hash: 0x33333333, value: 'Start Adventure' },
  { ns: 'UI', key: 'menu_quit', hash: 0x44444444, value: 'Quit Game' },
];

// ── Helper binari ───────────────────────────────────────────────────────
const i32 = (v) => { const b = Buffer.alloc(4); b.writeInt32LE(v, 0); return b; };
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0, 0); return b; };
const i64 = (v) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(v), 0); return b; };

/** FString di UE: ASCII → ANSI a byte singolo; resto → UTF-16LE con len negativa. */
function fstring(s) {
  if (s === '') return i32(0);
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(s)) {
    const body = Buffer.from(s, 'latin1');
    return Buffer.concat([i32(body.length + 1), body, Buffer.from([0])]);
  }
  const body = Buffer.from(s, 'utf16le');
  const units = body.length / 2;
  return Buffer.concat([i32(-(units + 1)), body, Buffer.from([0, 0])]);
}

/** Hash namespace/key: valore FINTO, come quello che scrive il Rust oggi.
 *  Le fixture non devono far credere che sappiamo calcolare l'hash di UE. */
const FAKE_HASH = 0xdeadbeef;

function groupByNamespace() {
  const map = new Map();
  for (const e of ENTRIES) {
    if (!map.has(e.ns)) map.set(e.ns, []);
    map.get(e.ns).push(e);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

// ── v0 Legacy: nessun header ────────────────────────────────────────────
function buildV0() {
  const groups = groupByNamespace();
  const parts = [i32(groups.length)];
  for (const [ns, list] of groups) {
    parts.push(fstring(ns), i32(list.length));
    for (const e of list) parts.push(fstring(e.key), u32(e.hash), fstring(e.value));
  }
  return Buffer.concat(parts);
}

// ── v2 Optimized: magic + versione + offset assoluto, array in fondo ────
function buildV2() {
  const groups = groupByNamespace();

  const strings = [];
  const indexOf = new Map();
  for (const e of ENTRIES) {
    if (!indexOf.has(e.value)) { indexOf.set(e.value, strings.length); strings.push(e.value); }
  }

  const body = [];
  body.push(i32(groups.length));
  for (const [ns, list] of groups) {
    body.push(u32(FAKE_HASH), fstring(ns), i32(list.length));
    for (const e of list) {
      body.push(u32(FAKE_HASH), fstring(e.key), u32(e.hash), i32(indexOf.get(e.value)));
    }
  }
  const bodyBuf = Buffer.concat(body);

  const headerLen = LOCRES_MAGIC.length + 1 + 8; // magic + versione + offset
  const arrayOffset = headerLen + bodyBuf.length;

  const arr = [i32(strings.length)];
  for (const s of strings) arr.push(fstring(s), i32(1)); // refcount (dalla v2 in poi)

  return Buffer.concat([LOCRES_MAGIC, Buffer.from([2]), i64(arrayOffset), bodyBuf, ...arr]);
}

// ── Main ────────────────────────────────────────────────────────────────
const check = process.argv.includes('--check');
const targets = [
  { name: 'Game.locres', buf: buildV0(), desc: 'v0 Legacy (nessun magic)' },
  { name: 'Game_v2.locres', buf: buildV2(), desc: 'v2 Optimized (magic 16 byte + offset)' },
];

let changed = 0;
for (const t of targets) {
  const p = path.join(OUT_DIR, t.name);
  const existing = fs.existsSync(p) ? fs.readFileSync(p) : null;
  const same = existing && existing.equals(t.buf);

  if (same) {
    console.log(`= ${t.name} già aggiornata (${t.buf.length} byte) — ${t.desc}`);
    continue;
  }
  changed++;
  if (check) {
    console.log(`✗ ${t.name} NON aggiornata — ${t.desc}`);
    continue;
  }
  fs.writeFileSync(p, t.buf);
  console.log(`✓ ${t.name} riscritta: ${existing ? existing.length : 0} → ${t.buf.length} byte — ${t.desc}`);
}

if (check && changed) {
  console.error('\nLe fixture .locres non sono nel formato vero. Lancia: node scripts/dev/regen-locres-fixtures.js');
  process.exit(1);
}
