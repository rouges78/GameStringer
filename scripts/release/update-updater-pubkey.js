#!/usr/bin/env node
/**
 * update-updater-pubkey.js — scrive in tauri.conf.json la chiave PUBBLICA
 * dell'updater, leggendola da ~/.tauri/gamestringer.key.pub.
 *
 * Nato il 07/08/2026 per la rotazione della chiave di firma: la privata
 * originale è andata persa e il suo secret GitHub è stato distrutto
 * (vedi ROADMAP, voce ship-v1160). Il campo `plugins.updater.pubkey` è il
 * base64 dell'INTERO file .pub (riga «untrusted comment» inclusa): farlo a
 * mano invita errori di copia — questo script lo fa dai byte del file.
 *
 * Uso:  node scripts/release/update-updater-pubkey.js
 * Prerequisito: npx tauri signer generate -w ~/.tauri/gamestringer.key
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const CONF = path.join(__dirname, '..', '..', 'src-tauri', 'tauri.conf.json');
const PUB = path.join(os.homedir(), '.tauri', 'gamestringer.key.pub');

if (!fs.existsSync(PUB)) {
  console.error('ERRORE: non trovo ' + PUB);
  console.error('Genera prima la coppia:  npx tauri signer generate -w ~/.tauri/gamestringer.key');
  process.exit(1);
}

// La CLI Tauri v2 scrive i file chiave GIÀ in base64 (una riga); il formato
// minisign storico è invece testo a due righe che inizia con «untrusted
// comment». Gestiamo entrambi: il campo pubkey della conf vuole il base64
// dell'intero blocco minisign.
const raw = fs.readFileSync(PUB, 'utf8');
let pubB64;
if (raw.startsWith('untrusted comment')) {
  pubB64 = Buffer.from(raw).toString('base64');           // minisign raw → codifica
} else {
  const maybe = raw.trim();
  const dec = Buffer.from(maybe, 'base64').toString('utf8');
  if (dec.startsWith('untrusted comment')) {
    pubB64 = maybe;                                        // già base64 (formato Tauri) → così com'è
  } else {
    console.error('ERRORE: il .pub non è né minisign raw né base64 di minisign — file sbagliato?');
    console.error('Primi 40 caratteri: ' + raw.slice(0, 40));
    process.exit(1);
  }
}

const conf = JSON.parse(fs.readFileSync(CONF, 'utf8'));
const old = conf.plugins && conf.plugins.updater && conf.plugins.updater.pubkey;
if (!old) { console.error('ERRORE: plugins.updater.pubkey non trovato in tauri.conf.json'); process.exit(1); }

if (old === pubB64) { console.log('La pubkey in conf è GIÀ quella nuova: niente da fare.'); process.exit(0); }

conf.plugins.updater.pubkey = pubB64;
fs.writeFileSync(CONF, JSON.stringify(conf, null, 2) + '\n');

// verifica di effetto: rileggi e decodifica ciò che è stato scritto davvero
const check = JSON.parse(fs.readFileSync(CONF, 'utf8')).plugins.updater.pubkey;
const checkDecoded = Buffer.from(check, 'base64').toString('utf8');
console.log('pubkey VECCHIA (decodificata):', Buffer.from(old, 'base64').toString('utf8').split('\n')[0]);
console.log('pubkey NUOVA  (decodificata):', checkDecoded.split('\n')[0]);
console.log(checkDecoded.startsWith('untrusted comment')
  ? '✅ scritta e riletta correttamente'
  : '⛔ la rilettura non torna: NON committare');
