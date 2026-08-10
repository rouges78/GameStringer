#!/usr/bin/env node
/**
 * Backup OFF-SITE del progetto Supabase community (DB + Storage).
 *
 * PERCHÉ ESISTE (09/08/2026). Il piano è Pro, quindi Supabase fa backup
 * giornalieri automatici — ma restano quattro buchi che questo script copre:
 *   1. i backup del DB NON includono lo Storage, dove vivono i FILE dei pack
 *      (cioè le traduzioni vere: il DB da solo ti ridà solo i metadati);
 *   2. la retention è di 7 giorni: un danno scoperto l'ottavo giorno è perso;
 *   3. i backup stanno nello stesso account che stai proteggendo (sospensione
 *      per fatturazione = niente dati e niente backup);
 *   4. un backup mai ripristinato è una speranza, non un backup — vedi il
 *      runbook per la prova di ripristino.
 *
 * USO:
 *   node scripts/supabase-backup.mjs [--out <cartella>]
 *
 * CHIAVI (da variabile d'ambiente, MAI nel repo):
 *   SUPABASE_SERVICE_ROLE_KEY  → backup COMPLETO (bypassa la RLS)
 *   nessuna chiave             → backup PARZIALE dei soli dati pubblici,
 *                                dichiarato come tale nel manifest
 *
 * Output: <out>/supabase-backup-<data>/
 *   tables/<tabella>.json   una riga per record
 *   storage/<bucket>/...    i file dei pack
 *   manifest.json           conteggi, completezza, versione schema
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const URL = process.env.SUPABASE_URL || 'https://relbkjoxdnbqizgomzhs.supabase.co';
// anon key: già pubblica nel client (lib/social/community-hub-backend.ts) e
// nel workflow keep-alive; serve solo per il ramo parziale.
const ANON = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbGJram94ZG5icWl6Z29temhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDcxMDUsImV4cCI6MjA4OTkyMzEwNX0.TY4pVsZVJ3vS_8AArXXr4RghxUn1ATju4kiVwjzpdyM';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const KEY = SERVICE || ANON;
const COMPLETO = Boolean(SERVICE);

const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const OUT_BASE = outArg >= 0 ? argv[outArg + 1] : 'backups';

// Tabelle da salvare. Se ne aggiungi una allo schema, aggiungila QUI:
// un backup che non sa di una tabella non lo dice, la perde in silenzio.
const TABELLE = [
  'user_profiles', 'translation_packs', 'pack_files', 'pack_publish_events',
  'user_badges', 'achievements', 'user_favorites', 'pack_reviews',
  'forum_categories', 'forum_threads', 'forum_posts', 'forum_reactions',
  'community_rooms', 'community_room_members', 'community_messages',
  'community_presence', 'chat_rooms', 'chat_room_members',
  'compat_reports', 'crash_reports', 'user_notifications',
  'glossaries', 'glossary_terms', 'benchmark_reports',
];

const BUCKET = 'translation-packs';

async function rest(path, params = '') {
  const r = await fetch(`${URL}/rest/v1/${path}${params}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => '')}`.slice(0, 200));
  return r.json();
}

async function dumpTabella(nome) {
  // paginazione: mai fidarsi del default (1000 righe) — user_profiles ne ha 1799
  const PAGINA = 1000;
  let tutte = [];
  for (let da = 0; ; da += PAGINA) {
    const r = await fetch(`${URL}/rest/v1/${nome}?select=*&offset=${da}&limit=${PAGINA}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);
    const blocco = await r.json();
    tutte = tutte.concat(blocco);
    if (blocco.length < PAGINA) break;
  }
  return tutte;
}

async function scaricaStorage(destDir) {
  // elenco file via API storage (list è POST)
  const elenca = async (prefix) => {
    const r = await fetch(`${URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    });
    if (!r.ok) throw new Error(`list ${prefix}: ${r.status}`);
    return r.json();
  };

  let scaricati = 0;
  const visita = async (prefix) => {
    const voci = await elenca(prefix);
    for (const v of voci) {
      const percorso = prefix ? `${prefix}/${v.name}` : v.name;
      if (v.id === null) { await visita(percorso); continue; } // cartella
      const r = await fetch(`${URL}/storage/v1/object/${BUCKET}/${percorso}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      });
      if (!r.ok) { console.warn(`  ⚠️  ${percorso}: HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const dest = join(destDir, BUCKET, percorso);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
      scaricati++;
    }
  };
  await visita('');
  return scaricati;
}

// ─────────────────────────────────────────────────────────────
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const DIR = join(OUT_BASE, `supabase-backup-${stamp}`);
mkdirSync(join(DIR, 'tables'), { recursive: true });

console.log('🗄️  Backup Supabase community');
console.log(`   progetto: ${URL}`);
console.log(`   modo: ${COMPLETO ? 'COMPLETO (service role)' : '⚠️  PARZIALE (solo dati leggibili in pubblico)'}`);
if (!KEY) {
  console.error('❌ Nessuna chiave: esporta SUPABASE_SERVICE_ROLE_KEY (completo) o SUPABASE_ANON_KEY (parziale).');
  process.exit(2);
}

const conteggi = {};
const errori = [];
for (const t of TABELLE) {
  try {
    const righe = await dumpTabella(t);
    writeFileSync(join(DIR, 'tables', `${t}.json`), JSON.stringify(righe, null, 1));
    conteggi[t] = righe.length;
    console.log(`   ✓ ${t}: ${righe.length}`);
  } catch (e) {
    // Una tabella che non esiste più non è un errore fatale, ma va DETTA:
    // un backup che salta in silenzio è il difetto che inseguiamo da giorni.
    errori.push(`${t}: ${e.message}`);
    console.warn(`   ⚠️  ${t}: ${e.message}`);
  }
}

let fileStorage = 0;
try {
  fileStorage = await scaricaStorage(join(DIR, 'storage'));
  console.log(`   ✓ storage/${BUCKET}: ${fileStorage} file`);
} catch (e) {
  errori.push(`storage: ${e.message}`);
  console.warn(`   ⚠️  storage: ${e.message}`);
}

const manifest = {
  creato: new Date().toISOString(),
  progetto: URL,
  completo: COMPLETO,
  nota: COMPLETO
    ? 'Backup completo (service role): include i dati non esposti dalla RLS.'
    : 'BACKUP PARZIALE: senza service role key la RLS nasconde i record privati. NON usarlo come unica copia.',
  tabelle: conteggi,
  righe_totali: Object.values(conteggi).reduce((a, b) => a + b, 0),
  file_storage: fileStorage,
  errori,
};
writeFileSync(join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('');
console.log(`✅ ${manifest.righe_totali} righe · ${fileStorage} file → ${DIR}`);
if (errori.length) console.log(`⚠️  ${errori.length} problemi (vedi manifest.json)`);
if (!COMPLETO) console.log('⚠️  Backup PARZIALE: per quello completo serve SUPABASE_SERVICE_ROLE_KEY.');
console.log('');
console.log('⛔ Un backup mai ripristinato è una speranza: vedi');
console.log('   docs/runbooks/supabase-disaster-recovery.md (§ Prova di ripristino).');
