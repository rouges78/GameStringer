/**
 * Quanto costa tradurre questo gioco? — stima da un checkpoint reale.
 *
 * Nasce il 10/08/2026 per una decisione con scadenza. ⚠️ QUELLA SCADENZA NON
 * ESISTE PIÙ, e questo commento è rimasto a mentire per sei giorni: il 10/08
 * Anthropic ha ANNULLATO l'aumento previsto per il 1° settembre e reso
 * permanente il prezzo di $2/$10 per Mtoken su Sonnet 5. Riverificato il
 * 15/08 e di nuovo il 16/08. Non c'è nessuna fretta di spendere entro il 31/08.
 *
 * ⏰ LA SCADENZA VERA, oggi, è un'altra e riguarda DeepSeek: dalle 16:00 UTC
 * del 16/08/2026 la famiglia V4 passa a tariffe a fasce (picco / fuori picco a
 * metà prezzo). Su V4-Flash l'input cache-miss va da $0.14 a $0.44 di picco e
 * l'output da $0.28 a $1.32: fino a 4,7 volte. Fascia di picco 01:00-04:00 e
 * 06:00-10:00 UTC, cioè in Italia le 08:00-12:00 — la mattina.
 *
 * Serve a rispondere con numeri, non a naso, a tre domande diverse:
 *   1. quanto costa finire ciò che manca
 *   2. quanto costa RIFARE tutto meglio (se il grosso è già tradotto in locale
 *      e la qualità non convince: è una decisione diversa dalla 1)
 *   3. quanto cambia il conto a seconda del fornitore e dell'ORA del giorno
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
// ⚠️ DATARE SEMPRE questa tabella, VOCE PER VOCE. Un listino vecchio travestito
// da fatto è il modo più facile per sbagliare una decisione — e in questo
// progetto è già successo due volte: remote-config.ts raccomandava
// 'claude-3-5-sonnet' nel 2026 (due generazioni dopo), e l'intestazione di
// QUESTO file ha continuato a parlare di una scadenza al 31/08 per sei giorni
// dopo che era stata annullata. La data accanto al numero non è pedanteria: è
// l'unica cosa che distingue un prezzo da una diceria.
const LISTINI = [
  ['ALTA', 'GPT-5.6 Sol', 5, 30, 'la più cara della tabella · non riverificata dal 10/08'],
  ['ALTA', 'Claude Opus 5', 5, 25, 'massima qualità Anthropic · non riverificata dal 10/08'],
  ['MEDIA', 'Claude Sonnet 5', 2, 10, '✅ $2/$10 PERMANENTE: l\'aumento del 01/09 è stato annullato il 10/08 (riverificato 16/08)'],
  ['MEDIA', 'GPT-5.6 Terra', 2, 12, 'fascia bilanciata OpenAI · non riverificata dal 10/08'],
  ['MEDIA', 'Gemini 3.1 Pro', 2, 12, 'fino a 200K token di prompt · non riverificata dal 10/08'],
  ['BASSA', 'Haiku 4.5', 1, 5, 'buon compromesso, meno voce sui dialoghi · non riverificata dal 10/08'],
  ['BASSA', 'Gemini 3.7 Flash', 0.75, 3.75, '🆕 uscito il 13/08/2026, prezzo introduttivo: metà di Gemini 3.6 Flash (verificato 16/08). NON è ancora il consigliato dell\'app: prima va misurato'],
  ['BASSA', 'GPT-5.6 Luna', 0.2, 1.2, 'la più economica fra le cloud · non riverificata dal 10/08'],
  ['BASSA', 'DeepSeek V4 Flash — PICCO', 0.44, 1.32, '⏰ dal 16/08/2026 16:00 UTC. Picco = 01:00-04:00 e 06:00-10:00 UTC (in Italia 08:00-12:00, la mattina)'],
  ['BASSA', 'DeepSeek V4 Flash — fuori picco', 0.22, 0.66, '⭐ metà prezzo: tutte le altre ore. Su una run lunga è la differenza fra due conti diversi'],
  ['LOCALE', 'Ollama', 0, 0, 'gratis: si paga in ore e in qualità · qwen3.8:27b è uscito il 14/08 (Apache 2.0, ~18 GB)'],
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

// La decisione con l'orologio non è più «entro il 31/08» (quell'aumento è stato
// annullato): è l'ORA DEL GIORNO in cui si lancia una run su DeepSeek.
const dsPicco = (tokIn / 1e6) * 0.44 + (tokOut / 1e6) * 1.32;
const dsFuori = (tokIn / 1e6) * 0.22 + (tokOut / 1e6) * 0.66;
const dsPrima = (tokIn / 1e6) * 0.14 + (tokOut / 1e6) * 0.28;
console.log(`\n⏰ DEEPSEEK V4 FLASH — cosa cambia dalle 16:00 UTC del 16/08/2026:`);
console.log(`     prima del rincaro : $${dsPrima.toFixed(2)}`);
console.log(`     in fascia di PICCO: $${dsPicco.toFixed(2)}   (×${(dsPicco / dsPrima).toFixed(1)} — 08:00-12:00 ora italiana)`);
console.log(`     FUORI picco       : $${dsFuori.toFixed(2)}   (×${(dsFuori / dsPrima).toFixed(1)} — tutte le altre ore)`);
console.log(`   ⭐ Aspettare il pomeriggio fa risparmiare $${(dsPicco - dsFuori).toFixed(2)} su questa run.`);
console.log(`\n✅ Su Claude Sonnet 5 NON c'è più nessuna scadenza: $2/$10 è permanente`);
console.log(`   dal 10/08/2026. (Il tokenizer recente conta ~30% di token in più a`);
console.log(`   parità di testo, quindi il confronto per-token resta ottimista.)`);
console.log(`\n⚠️ Stima, non preventivo: 4 char/token è una regola pratica e`);
console.log(`   l'overhead è un moltiplicatore. Prima di impegnare la cifra piena,`);
console.log(`   fare un LOTTO DI PROVA e misurare il costo reale su quello.`);
