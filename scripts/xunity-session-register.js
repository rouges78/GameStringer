#!/usr/bin/env node
/**
 * Registra nei Progetti un gioco tradotto a RUNTIME con XUnity.AutoTranslator
 * (flusso Unity patch: BepInEx + winhttp.dll), scrivendo la traccia standard
 * GameStringer/translation_session.json che il backfill della pagina Progetti
 * legge (lib/backfill-session-projects.ts) — la stessa lasciata dal flusso
 * Unreal e, dal 05/08/2026, da sci-write-patch.
 *
 * Perché esiste (05/08/2026, Uncanny Tales The Watcher): il gioco era tradotto
 * e giocato in italiano, ma nei Progetti non compariva — il traduttore runtime
 * scrive solo BepInEx/Translation/<lang>/Text/*.txt e nessuna traccia progetto.
 *
 * ⚠️ NOTA DI ONESTÀ SUL CONTEGGIO: XUnity registra le stringhe VISTE A SCHERMO,
 * non tutte quelle del gioco. Il totale della card è quindi «stringhe viste
 * finora», e cresce rigiocando: rilanciare lo script aggiorna la fotografia.
 * Un «100%» qui significa «tutto ciò che è apparso è tradotto», non «tutto il
 * gioco è tradotto» — distinzione da portare nella UI dei Progetti (badge
 * runtime), vedi roadmap [patch-lifecycle].
 *
 * Uso:
 *   node scripts/xunity-session-register.js "<cartella gioco>" [--lang it] [--game-name "Nome"]
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const gameDir = argv.find(a => !a.startsWith('--'));
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const lang = opt('lang', 'it');
const gameName = opt('game-name');

if (!gameDir || !fs.existsSync(gameDir)) {
  console.error('Uso: node scripts/xunity-session-register.js "<cartella gioco>" [--lang it] [--game-name "Nome"]');
  process.exit(2);
}

const textDir = path.join(gameDir, 'BepInEx', 'Translation', lang, 'Text');
if (!fs.existsSync(textDir)) {
  console.error(`❌ ${textDir} non esiste: o il gioco non ha la patch XUnity, o la lingua non è "${lang}".`);
  process.exit(1);
}

// Formato XUnity: una riga per coppia, `originale=tradotto`. Righe vuote e
// commenti (// o #) si saltano. Un solo `=`? No: l'originale può contenerne —
// si spezza SUL PRIMO, come fa XUnity stesso.
const entries = [];
for (const f of fs.readdirSync(textDir).filter(x => x.endsWith('.txt'))) {
  const righe = fs.readFileSync(path.join(textDir, f), 'utf8')
    .replace(/^﻿/, '').split(/\r?\n/);
  let idx = 0;
  for (const riga of righe) {
    if (!riga.trim() || riga.startsWith('//') || riga.startsWith('#')) continue;
    const eq = riga.indexOf('=');
    if (eq <= 0) continue;
    const original = riga.slice(0, eq);
    const translated = riga.slice(eq + 1);
    const entry = { namespace: f, key: String(idx++), original };
    if (translated && translated !== original) entry.translated = translated;
    entries.push(entry);
  }
}

if (entries.length === 0) {
  console.error('❌ Nessuna coppia originale=tradotto trovata: niente da registrare.');
  process.exit(1);
}

const outDir = path.join(gameDir, 'GameStringer');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'translation_session.json');
fs.writeFileSync(outPath, JSON.stringify({
  gameName: gameName || path.basename(gameDir),
  gamePath: gameDir,
  engine: 'Unity',
  translationMode: 'runtime-xunity', // il totale è «stringhe viste», non il gioco intero
  sourceLanguage: 'en',
  targetLanguage: lang,
  updatedAt: new Date().toISOString(),
  entries,
}, null, 1));

const tradotte = entries.filter(e => e.translated).length;
console.log(`🗂️ ${outPath}`);
console.log(`   ${entries.length} stringhe viste · ${tradotte} tradotte (${lang})`);
console.log('   Alla prossima apertura della pagina Progetti il backfill crea/aggiorna la card.');
console.log('   Rigiocando il gioco XUnity vede altre stringhe: rilancia lo script per aggiornare.');
