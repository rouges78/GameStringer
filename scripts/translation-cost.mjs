/**
 * Quanto costa tradurre questo gioco? — stima da un checkpoint reale.
 *
 * Nasce il 10/08/2026 per una decisione con scadenza: il prezzo introduttivo di
 * Claude Sonnet 5 ($2/$10 per Mtoken) vale fino al 31/08/2026; dal 1° settembre
 * passa a $3/$15 (+50%). E il tokenizer nuovo conta ~30% di token in più a
 * parità di testo, quindi il salto REALE è maggiore del 50%.
 *
 * Serve a rispondere con numeri, non a naso, a tre domande diverse:
 *   1. quanto costa finire ciò che manca
 *   2. quanto costa RIFARE tutto meglio (se il grosso è già tradotto in locale
 *      e la qualità non convince: è una decisione diversa dalla 1)
 *   3. quanto si risparmia facendolo entro il 31/08
 *
 * ⚠️ È UNA STIMA, e va detto: il conteggio token è approssimato a 4 caratteri
 * per token (regola d'uso comune per l'inglese) e l'overhead di prompt e
 * contesto è un moltiplicatore, non una misura. Serve a scegliere fra opzioni
 * che differiscono di ordini di grandezza, non a prevedere la fattura al
 * centesimo. Per quella, l'unica via onesta è un lotto di prova reale.
 *
 * USO:
 *   node scripts/translation-cost.mjs "<percorso translations.json>"
 *   node scripts/translation-cost.mjs "<percorso>" --tutto   (costo per RIFARE tutto)
 */
import { readFileSync, existsSync } from 'fs';

const file = process.argv[2];
const TUTTO = process.argv.includes('--tutto');
if (!file || !existsSync(file)) {
  console.error('Uso: node scripts/translation-cost.mjs "<percorso translations.json>" [--tutto]');
  process.exit(2);
}

const righe = JSON.parse(readFileSync(file, 'utf8'));
const tradotte = righe.filter(r => r.translated && String(r.translated).trim() !== '');
const mancanti = righe.filter(r => !(r.translated && String(r.translated).trim() !== ''));
const bersaglio = TUTTO ? righe : mancanti;

const caratteri = bersaglio.reduce((s, r) => s + String(r.original || '').length, 0);
const CHAR_PER_TOKEN = 4;
const OVERHEAD_PROMPT = 1.35;   // istruzioni + contesto + numerazione batch
const RAPPORTO_OUTPUT = 1.15;   // l'italiano è più lungo dell'inglese

const tokIn = Math.round((caratteri / CHAR_PER_TOKEN) * OVERHEAD_PROMPT);
const tokOut = Math.round((caratteri / CHAR_PER_TOKEN) * RAPPORTO_OUTPUT);

console.log(`\n${'═'.repeat(64)}`);
console.log(`CHECKPOINT: ${file}`);
console.log(`  righe totali : ${righe.length.toLocaleString('it-IT')}`);
console.log(`  già tradotte : ${tradotte.length.toLocaleString('it-IT')} (${Math.round(tradotte.length / righe.length * 100)}%)`);
console.log(`  da tradurre  : ${mancanti.length.toLocaleString('it-IT')}`);
console.log(`\nSTIMA SU: ${TUTTO ? 'TUTTE le righe (rifare da capo)' : 'solo le righe mancanti'}`);
console.log(`  caratteri    : ${caratteri.toLocaleString('it-IT')}`);
console.log(`  token input  : ~${(tokIn / 1e6).toFixed(2)} M  (con overhead prompt ×${OVERHEAD_PROMPT})`);
console.log(`  token output : ~${(tokOut / 1e6).toFixed(2)} M`);

// Prezzi in $ per milione di token: [fascia, nome, input, output, nota].
// ⚠️ DATARE SEMPRE questa tabella. Un listino vecchio travestito da fatto è il
// modo più facile per sbagliare una decisione — e in questo progetto è già
// successo: remote-config.ts raccomandava 'claude-3-5-sonnet' nel 2026, due
// generazioni dopo. Verificato con ricerca il 10/08/2026.
const LISTINI = [
  ['ALTA', 'GPT-5.6 Sol', 5, 30, 'la più cara della tabella'],
  ['ALTA', 'Claude Opus 5', 5, 25, 'massima qualità Anthropic'],
  ['ALTA', 'Sonnet 5 — dal 01/09/2026', 3, 15, '+50%: è questo che scatta a settembre'],
  ['MEDIA', 'Sonnet 5 — entro il 31/08/2026', 2, 10, '⏰ prezzo introduttivo, scade'],
  ['MEDIA', 'GPT-5.6 Terra', 2, 12, 'fascia bilanciata OpenAI'],
  ['MEDIA', 'Gemini 3.1 Pro', 2, 12, 'fino a 200K token di prompt'],
  ['BASSA', 'Haiku 4.5', 1, 5, 'buon compromesso, meno voce sui dialoghi'],
  ['BASSA', 'Gemini (fascia Flash)', 0.3, 2.5, 'ordine di grandezza, verificare'],
  ['BASSA', 'GPT-5.6 Luna', 0.2, 1.2, 'la più economica fra le cloud'],
  ['BASSA', 'DeepSeek', 0.28, 1.1, '⚠️ rincaro annunciato il 06/08/2026, cifre ignote'],
  ['LOCALE', 'Ollama', 0, 0, 'gratis: si paga in ore e in qualità'],
];

console.log(`\n${'─'.repeat(64)}`);
console.log('COSTO STIMATO (listini verificati il 10/08/2026 — ricontrollare prima di spendere)');
console.log('─'.repeat(64));
let fasciaCorrente = '';
for (const [fascia, nome, pin, pout, nota] of LISTINI) {
  if (fascia !== fasciaCorrente) {
    const etichette = { ALTA: 'FASCIA ALTA', MEDIA: 'FASCIA MEDIA', BASSA: 'FASCIA ECONOMICA', LOCALE: 'IN LOCALE' };
    console.log(`\n  ── ${etichette[fascia]}`);
    fasciaCorrente = fascia;
  }
  const costo = (tokIn / 1e6) * pin + (tokOut / 1e6) * pout;
  const etichetta = costo === 0 ? '    gratis' : `$${costo.toFixed(2).padStart(8)}`;
  console.log(`  ${etichetta}  ${nome}`);
  if (nota) console.log(`              ${nota}`);
}

// ⚠️ Il confronto per-token FRA MODELLI DIVERSI è ingannevole: Anthropic
// dichiara che dalla 4.7 in poi il tokenizer produce ~30% di token in più a
// parità di testo. Due listini identici sulla carta non danno la stessa
// fattura. Quindi la colonna dei prezzi ordina, non decide.
console.log(`\n  ⚠️ I modelli Anthropic recenti contano ~30% di token in più a parità`);
console.log(`     di testo: confrontare i prezzi per-token fra fornitori diversi`);
console.log(`     sovrastima il vantaggio dei più economici.`);

const conIntro = (tokIn / 1e6) * 2 + (tokOut / 1e6) * 10;
const conPieno = (tokIn / 1e6) * 3 + (tokOut / 1e6) * 15;
console.log(`\n⏰ FARLO ENTRO IL 31/08 FA RISPARMIARE: $${(conPieno - conIntro).toFixed(2)}`);
console.log(`   (e il tokenizer nuovo di Sonnet 5 conta ~30% di token in più a`);
console.log(`    parità di testo: il salto reale è maggiore del +50% nominale)`);
console.log(`\n⚠️ Stima, non preventivo: 4 char/token è una regola pratica e`);
console.log(`   l'overhead è un moltiplicatore. Prima di impegnare la cifra piena,`);
console.log(`   fare un LOTTO DI PROVA e misurare il costo reale su quello.`);
