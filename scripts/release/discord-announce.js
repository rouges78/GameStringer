#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * discord-announce.js — annuncia una release su Discord, da solo.
 *
 *   npm run discord:announce -- v1.15.0 --dry-run   # PROVA: stampa e non manda
 *   npm run discord:announce -- v1.15.0             # manda davvero
 *
 * PERCHÉ ESISTE
 * -------------
 * Il Discord del progetto esiste per gli annunci di release. Scriverli a mano
 * ad ogni versione è lavoro che si dimentica: la prima release si annuncia, la
 * terza no, e un canale annunci fermo comunica "progetto morto" più di un canale
 * che non esiste. Questo script legge la sezione del CHANGELOG della versione e
 * la pubblica come embed, così l'annuncio è un effetto della release e non un
 * compito in più.
 *
 * COME SI COLLEGA
 *   1. Discord → Impostazioni canale #annunci → Integrazioni → Webhook → Nuovo
 *      webhook → Copia URL.
 *   2. GitHub → repo → Settings → Secrets and variables → Actions → New secret
 *      · nome:  DISCORD_WEBHOOK_URL
 *      · valore: l'URL copiato
 *   3. Fatto: `release.yml` lo chiama da solo alla fine di ogni release.
 *
 * FAIL-OPEN, DI PROPOSITO: se il webhook non è configurato lo script esce 0 e
 * dice che salta. Un annuncio non pubblicato non deve MAI far risultare fallita
 * una release che invece è andata bene — il workflow lo chiama comunque con
 * continue-on-error, ma la doppia difesa costa zero.
 *
 * L'URL del webhook non viene mai stampato: chi ce l'ha può scrivere nel canale.
 */

const fs = require('fs');
const path = require('path');

const REPO = 'rouges78/GameStringer';
const CHANGELOG = path.join(__dirname, '..', '..', 'CHANGELOG.md');

/** Colore dell'embed: il viola del brand. */
const EMBED_COLOR = 0x8b5cf6;

/** Discord tronca a 4096 il testo di un embed; stiamo larghi. */
const MAX_DESC = 3500;

// ── Argomenti ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const version = (args.find((a) => !a.startsWith('--')) || process.env.RELEASE_VERSION || '').trim();

if (!version) {
  console.error('Manca la versione.  Uso: npm run discord:announce -- v1.15.0 [--dry-run]');
  process.exit(2);
}

const tag = version.startsWith('v') ? version : `v${version}`;
const bare = tag.slice(1);

// ── Estrazione della sezione di changelog ─────────────────────────────────

/**
 * Ritorna le righe della sezione `## ... vX.Y.Z ...` fino all'intestazione
 * successiva. Se la versione non c'è, ritorna null: meglio un annuncio scarno
 * che uno con le note di un'altra versione.
 */
function sezioneChangelog(v) {
  if (!fs.existsSync(CHANGELOG)) return null;
  const righe = fs.readFileSync(CHANGELOG, 'utf8').split(/\r?\n/);

  // L'intestazione è del tipo "## 🚀 v1.15.0 - 2026-07-24"
  const inizio = righe.findIndex((r) => /^##\s/.test(r) && r.includes(v));
  if (inizio === -1) return null;

  const corpo = [];
  for (let i = inizio + 1; i < righe.length; i++) {
    if (/^##\s/.test(righe[i])) break;
    corpo.push(righe[i]);
  }

  const testo = corpo.join('\n').trim();
  return testo || null;
}

/** Data dall'intestazione, se c'è, per il footer. */
function dataDaChangelog(v) {
  if (!fs.existsSync(CHANGELOG)) return null;
  const riga = fs
    .readFileSync(CHANGELOG, 'utf8')
    .split(/\r?\n/)
    .find((r) => /^##\s/.test(r) && r.includes(v));
  const m = riga && riga.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function tronca(testo, max) {
  if (testo.length <= max) return testo;
  // Taglia su un confine di riga, non a metà parola.
  const tagliato = testo.slice(0, max);
  const ultimaRiga = tagliato.lastIndexOf('\n');
  return `${tagliato.slice(0, ultimaRiga > 0 ? ultimaRiga : max)}\n\n…and more.`;
}

// ── Costruzione del messaggio ─────────────────────────────────────────────

const note = sezioneChangelog(tag);
const data = dataDaChangelog(tag);
const urlRelease = `https://github.com/${REPO}/releases/tag/${tag}`;
const urlChangelog = `https://github.com/${REPO}/blob/main/CHANGELOG.md`;

if (!note) {
  console.warn(`⚠ Nessuna sezione per ${tag} in CHANGELOG.md: annuncio senza note.`);
}

// NB: il messaggio PUBBLICATO è in inglese — è la lingua del CHANGELOG da cui
// prende le note, e quella del canale annunci. I commenti e l'output a console
// restano in italiano: quelli li legge solo chi lavora al progetto.
const descrizione = [
  note ? tronca(note, MAX_DESC) : '_Release notes not available._',
  '',
  `⬇️ **[Download ${tag}](${urlRelease})**  ·  📄 [Full changelog](${urlChangelog})`,
].join('\n');

const payload = {
  username: 'GameStringer',
  embeds: [
    {
      title: `GameStringer ${tag}`,
      url: urlRelease,
      description: descrizione,
      color: EMBED_COLOR,
      footer: { text: data ? `Released on ${data}` : 'New version available' },
      timestamp: new Date().toISOString(),
    },
  ],
};

// ── Invio ─────────────────────────────────────────────────────────────────

async function main() {
  if (dryRun) {
    console.log('— PROVA (--dry-run): niente viene inviato —\n');
    console.log(`Titolo:  ${payload.embeds[0].title}`);
    console.log(`Link:    ${payload.embeds[0].url}`);
    console.log(`Footer:  ${payload.embeds[0].footer.text}`);
    console.log(`\nTesto (${descrizione.length} caratteri):\n`);
    console.log(descrizione);
    return;
  }

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    // NON è un errore: è la configurazione che manca. Vedi FAIL-OPEN in testa.
    console.log('DISCORD_WEBHOOK_URL non impostato: salto l\'annuncio.');
    console.log('Per attivarlo, vedi le istruzioni in testa a questo file.');
    return;
  }

  const risposta = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!risposta.ok) {
    const testo = await risposta.text().catch(() => '');
    // Il corpo dell'errore di Discord non contiene l'URL, ma tagliamo comunque.
    throw new Error(`Discord ha risposto ${risposta.status}: ${testo.slice(0, 300)}`);
  }

  console.log(`✓ Annuncio di ${tag} pubblicato su Discord.`);
}

main().catch((e) => {
  console.error(`✗ Annuncio non pubblicato: ${e.message}`);
  process.exit(1);
});
