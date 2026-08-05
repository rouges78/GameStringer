#!/usr/bin/env node
/**
 * American Arcadia — riempimento dell'italiano nei CSV L10N.
 *
 * Il gioco elenca l'italiano ma it/L10N.csv ha 4312/4313 chiavi vuote
 * (misurato 05/08/2026): il menu offre Italiano, i dialoghi ricadono
 * sull'inglese. Qui si costruisce la cartella override con l'it riempito.
 *
 * Due modi:
 *   node scripts/arcadia-merge-it.js                   → statistiche + todo JSON
 *       scrive estratti-arcadia/it-todo.json { tabella: { chiave: testo_en } }
 *   node scripts/arcadia-merge-it.js --apply <trad.json>
 *       trad.json: { tabella: { chiave: testo_it } } (anche parziale)
 *       scrive estratti-arcadia/override/AArcadia/.../TextLocalization/it/*.csv
 *
 * ⚠️ CSV VERO: 61 record multiriga e 131 virgolette escapate ("") solo in en —
 * parsing RFC4180, MAI split per righe (la lezione degli a capo di Greed,
 * vedi placeholder-guard). Guardia placeholder: {var}, <tag>, %d e conteggio
 * a capo confrontati con l'inglese; discrepanza = riga scartata con errore,
 * non un successo taciuto.
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join('estratti-arcadia', 'AArcadia', 'Content', 'AArcadia', 'TextLocalization');
const TABELLE = ['L10N', 'L10N_DEMO', 'L10N_UI'];
const VUOTO = '<STRING IS EMPTY>';

// ── CSV RFC4180 ─────────────────────────────────────────────────────────────
function parseCsv(testo) {
  if (testo.charCodeAt(0) === 0xfeff) testo = testo.slice(1);
  const record = [];
  let campo = '', riga = [], inQuote = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (inQuote) {
      if (c === '"') {
        if (testo[i + 1] === '"') { campo += '"'; i++; }
        else inQuote = false;
      } else campo += c;
    } else if (c === '"') inQuote = true;
    else if (c === ',') { riga.push(campo); campo = ''; }
    else if (c === '\n') {
      riga.push(campo.endsWith('\r') ? campo.slice(0, -1) : campo);
      if (riga.length > 1 || riga[0] !== '') record.push(riga);
      campo = ''; riga = [];
    } else campo += c;
  }
  if (campo !== '' || riga.length) { riga.push(campo); record.push(riga); }
  return record;
}

function csvCampo(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function leggiTabella(lingua, tabella) {
  const p = path.join(BASE, lingua, `${tabella}.csv`);
  const record = parseCsv(fs.readFileSync(p, 'utf8'));
  const intestazione = record.shift(); // Key,SourceString
  const mappa = new Map(record.map(r => [r[0], r[1] ?? '']));
  return { intestazione, record, mappa };
}

// ── guardia placeholder: l'italiano deve avere gli stessi token dell'inglese ─
function token(s) {
  const t = [];
  for (const m of s.matchAll(/\[\[[^\]]*\]\]|\{[^}]*\}|<[^>]*>|%[sd]|\\[nN]|\r?\n/g)) {
    t.push(m[0].replace(/\r\n/g, '\n'));
  }
  return t.sort().join('|');
}

function main() {
  // --slot <lang>: TRAVESTIMENTO — il menu del gioco non elenca l'italiano
  // (lista cablata in un widget cotto), quindi si serve l'italiano in uno slot
  // visibile (es_ar). Differenze dal modo it: il non-tradotto resta in INGLESE
  // (leggibile, non vuoto) e l'etichetta UI_LANG_ES-AR diventa «Italiano (GS)».
  const slotIdx = process.argv.indexOf('--slot');
  const slot = slotIdx >= 0 ? process.argv[slotIdx + 1] : null;
  const applyIdx = process.argv.indexOf('--apply');
  const tradFile = applyIdx >= 0 ? process.argv[applyIdx + 1] : null;
  if (applyIdx >= 0 && !tradFile) {
    console.error('Uso: node scripts/arcadia-merge-it.js [--apply traduzioni.json]');
    process.exit(2);
  }
  const trad = tradFile ? JSON.parse(fs.readFileSync(tradFile, 'utf8')) : null;

  const todo = {};
  let vuoteTot = 0, riempite = 0, scartate = 0;

  for (const tab of TABELLE) {
    const en = leggiTabella('en', tab);
    const it = leggiTabella('it', tab);
    todo[tab] = {};

    // ⚠️ L'intestazione originale è SENZA virgolette (Key,SourceString):
    // riprodurla identica, un parser rigido può scartare il file per meno.
    const uscita = [en.intestazione.join(',')];
    for (const [chiave, testoEn] of en.mappa) {
      let valore = it.mappa.get(chiave) ?? '';
      const vuota = valore === '' || valore === VUOTO;
      const enVuota = testoEn === '' || testoEn === VUOTO;

      if (slot) valore = testoEn; // travestimento: base inglese, mai vuoti

      if ((vuota || slot) && !enVuota) {
        const proposta = trad?.[tab]?.[chiave];
        if (proposta != null) {
          if (token(proposta) !== token(testoEn)) {
            console.log(`   ❌ ${tab}/${chiave}: placeholder/a-capo NON combaciano — scartata`);
            console.log(`      en: ${JSON.stringify(testoEn).slice(0, 100)}`);
            console.log(`      it: ${JSON.stringify(proposta).slice(0, 100)}`);
            scartate++;
          } else {
            valore = proposta;
            riempite++;
          }
        } else if (!slot) {
          todo[tab][chiave] = testoEn;
          vuoteTot++;
        }
      } else if (enVuota && vuota) {
        valore = testoEn; // conserva il marcatore com'è in en ('' o <STRING IS EMPTY>)
      }
      // etichetta del menu lingue per lo slot travestito
      if (slot && chiave === `UI_LANG_${slot.toUpperCase().replace('_', '-')}`) {
        valore = 'Italiano (GS)';
      }
      uscita.push(`${csvCampo(chiave)},${csvCampo(valore)}`);
    }

    if (trad) {
      const dest = path.join('estratti-arcadia', 'override', 'AArcadia', 'Content',
        'AArcadia', 'TextLocalization', slot || 'it', `${tab}.csv`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // BOM + \r\n come gli originali del gioco
      fs.writeFileSync(dest, '﻿' + uscita.join('\r\n') + '\r\n');
      console.log(`📄 ${dest}`);
    }
  }

  if (trad) {
    console.log(`\n📊 ${riempite} riempite, ${scartate} scartate dalla guardia, ${vuoteTot} ancora vuote`);
    console.log('Prossimo: repak pack sulla cartella estratti-arcadia/override → *_P.pak in Paks/');
    if (scartate > 0) process.exit(1);
  } else {
    const f = path.join('estratti-arcadia', 'it-todo.json');
    fs.writeFileSync(f, JSON.stringify(todo, null, 1));
    const conteggi = TABELLE.map(t => `${t}: ${Object.keys(todo[t]).length}`).join(' · ');
    console.log(`📝 ${f} — da tradurre: ${conteggi}`);
  }
}

main();
