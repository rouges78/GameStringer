#!/usr/bin/env node
/**
 * Sonda di confronto per i backend VLM del contesto visivo.
 *
 * Perché esiste (22/08/2026). È arrivata la proposta di adottare
 * `deepseek-v4-flash-vision-exp` come backend VLM economico. Il modello esiste
 * davvero (annunciato il 21/08/2026) e costa quanto `deepseek-v4-flash`, ma
 * "quanto costa dare il contesto visivo" non si deduce dal listino: dipende da
 * quanti token diventa UNA NOSTRA schermata, e ogni provider tokenizza le
 * immagini a modo suo (DeepSeek ridimensiona a ~800×800 con tetto 384 token,
 * OpenAI conta a riquadri, Gemini in modo suo ancora).
 *
 * Quindi qui non si stima: si MISURA, con tre accorgimenti.
 *
 *  1. **Il costo dell'immagine per differenza.** Ogni provider riceve lo stesso
 *     prompt due volte, una senza immagine e una con. `prompt_tokens(con) −
 *     prompt_tokens(senza)` è quanto costa davvero la schermata su QUEL
 *     provider. Nessun listino da interpretare, nessuna regola di
 *     tokenizzazione da indovinare.
 *  2. **La cache misurata, non supposta.** La documentazione DeepSeek non dice
 *     se il context caching si applica agli input immagine — ed è la differenza
 *     fra $0.22 e $0.007 per milione, cioè 31×. La sonda rimanda la stessa
 *     richiesta identica e legge `prompt_cache_hit_tokens` dalla risposta: se i
 *     token immagine finiscono in cache, si vede.
 *  3. **Stesso prompt per tutti.** Il contratto JSON è quello vero di
 *     `lib/ocr/vlm-batch-translate.ts`, così il confronto misura i provider e
 *     non tre prompt diversi.
 *
 * Le chiavi si leggono SOLO dall'ambiente: la sonda non le stampa, non le
 * scrive e non le chiede. Un provider senza chiave viene saltato dicendolo.
 *
 * Uso:
 *   DEEPSEEK_API_KEY=... OPENAI_API_KEY=... \
 *     node scripts/deepseek-vision-probe.mjs <schermata.png> [--giri 2]
 *
 * Esce 1 se nessun provider era eseguibile: un confronto vuoto non è un
 * confronto riuscito, e non deve sembrarlo.
 */
import fs from 'node:fs';
import path from 'node:path';

// ── Listino, con la provenienza accanto ──────────────────────────────────────
//
// I prezzi NON verificati restano `null`: la sonda stampa «prezzo non
// verificato» invece di moltiplicare per un numero inventato. Un costo
// plausibile ma falso è peggio di un costo assente, perché non si controlla.
const PROVIDER = {
  deepseek: {
    modello: 'deepseek-v4-flash-vision-exp',
    // api-docs.deepseek.com/quick_start/pricing, letto il 22/08/2026, e
    // coincide con quanto già verificato in lib/remote-config.ts il 16/08.
    // Tariffa di PICCO: una stima deve sbagliare per eccesso.
    usdPerMInput: 0.44,
    usdPerMOutput: 1.32,
    nota: 'picco; fuori picco costa esattamente la metà',
  },
  openai: {
    modello: 'gpt-4o', // il default di vlm-batch-translate.ts
    // developers.openai.com/api/docs/pricing, letto il 22/08/2026.
    usdPerMInput: 2.5,
    usdPerMOutput: 10.0,
    nota: 'default attuale del path VLM cloud',
  },
  gemini: {
    modello: 'gemini-3.5-flash', // l'altro default di vlm-batch-translate.ts
    usdPerMInput: null,
    usdPerMOutput: null,
    nota: 'PREZZO NON VERIFICATO — lib/remote-config.ts lo segnala dal 16/08',
  },
};

const CHIAVE_ENV = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

// ── Il prompt vero, non uno inventato per la sonda ───────────────────────────
// Ricalca il contratto di lib/ocr/vlm-batch-translate.ts: righe con id, JSON in
// uscita, mappatura 1:1 sui bbox dell'OCR. Se cambia là, va riallineato qui.
const RIGHE_ESEMPIO = [
  { id: 0, text: 'Chest' },
  { id: 1, text: 'Open' },
  { id: 2, text: 'Leave it' },
];

function costruisciPrompt(righe) {
  return [
    'You are translating on-screen game text from English to Italian.',
    'For each line return the translation, a confidence in 0..1, and — when the',
    'screenshot resolves an ambiguity — a short disambiguation note.',
    'Reply with JSON only: {"lines":[{"id":0,"translated":"...","confidence":0.9,"disambiguation":"..."}]}',
    '',
    'Lines:',
    ...righe.map((r) => `${r.id}: ${r.text}`),
  ].join('\n');
}

// ── Chiamate per provider ────────────────────────────────────────────────────
//
// Ognuna ritorna la forma comune { testo, uso } dove `uso` è normalizzato:
// { input, output, cacheHit }. I nomi dei campi d'uso differiscono per
// provider, ed è esattamente il genere di dettaglio che rende inconfrontabili
// due misure se non lo si normalizza qui una volta sola.
async function chiamaDeepseek(chiave, prompt, base64) {
  const contenuto = base64
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
      ]
    : prompt;

  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chiave}` },
    body: JSON.stringify({
      model: PROVIDER.deepseek.modello,
      messages: [{ role: 'user', content: contenuto }],
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature: 0,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return {
    testo: j.choices?.[0]?.message?.content ?? '',
    uso: {
      input: j.usage?.prompt_tokens ?? 0,
      output: j.usage?.completion_tokens ?? 0,
      cacheHit: j.usage?.prompt_cache_hit_tokens ?? 0,
    },
  };
}

async function chiamaOpenai(chiave, prompt, base64) {
  const contenuto = base64
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
      ]
    : prompt;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chiave}` },
    body: JSON.stringify({
      model: PROVIDER.openai.modello,
      messages: [{ role: 'user', content: contenuto }],
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature: 0,
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return {
    testo: j.choices?.[0]?.message?.content ?? '',
    uso: {
      input: j.usage?.prompt_tokens ?? 0,
      output: j.usage?.completion_tokens ?? 0,
      cacheHit: j.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    },
  };
}

async function chiamaGemini(chiave, prompt, base64) {
  const parti = base64
    ? [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: base64 } }]
    : [{ text: prompt }];

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${PROVIDER.gemini.modello}:generateContent?key=${chiave}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: parti }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return {
    testo: j.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    uso: {
      input: j.usageMetadata?.promptTokenCount ?? 0,
      output: j.usageMetadata?.candidatesTokenCount ?? 0,
      cacheHit: j.usageMetadata?.cachedContentTokenCount ?? 0,
    },
  };
}

const CHIAMA = { deepseek: chiamaDeepseek, openai: chiamaOpenai, gemini: chiamaGemini };

// ── Esecuzione ───────────────────────────────────────────────────────────────
async function cronometra(fn) {
  const t0 = process.hrtime.bigint();
  const esito = await fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ...esito, ms };
}

function usd(token, perM) {
  if (perM === null) return null;
  return (token / 1e6) * perM;
}

function formattaUsd(v) {
  if (v === null) return 'n/d';
  return v < 0.01 ? `$${v.toFixed(6)}` : `$${v.toFixed(4)}`;
}

async function misuraProvider(nome, chiave, prompt, base64, giri) {
  const p = PROVIDER[nome];
  const chiama = CHIAMA[nome];

  // 1) senza immagine — la linea di base da cui si ricava il costo dell'immagine
  const senza = await cronometra(() => chiama(chiave, prompt, null));

  // 2) con immagine, ripetuta `giri` volte: il primo giro misura il costo, i
  //    successivi rivelano se la cache prende anche i token immagine.
  const con = [];
  for (let i = 0; i < giri; i++) {
    con.push(await cronometra(() => chiama(chiave, prompt, base64)));
  }

  const tokenImmagine = con[0].uso.input - senza.uso.input;
  return { nome, p, senza, con, tokenImmagine };
}

function stampa(r) {
  const { nome, p, senza, con, tokenImmagine } = r;
  const primo = con[0];
  const costoImmagine = usd(tokenImmagine, p.usdPerMInput);
  const costoChiamata =
    p.usdPerMInput === null
      ? null
      : usd(primo.uso.input, p.usdPerMInput) + usd(primo.uso.output, p.usdPerMOutput);

  console.log(`\n── ${nome} · ${p.modello} ──`);
  console.log(`   ${p.nota}`);
  console.log(`   senza immagine : ${senza.uso.input} token in, ${senza.uso.output} out, ${senza.ms.toFixed(0)} ms`);
  console.log(`   con  immagine  : ${primo.uso.input} token in, ${primo.uso.output} out, ${primo.ms.toFixed(0)} ms`);
  console.log(`   → l'immagine costa ${tokenImmagine} token = ${formattaUsd(costoImmagine)}`);
  console.log(`   → chiamata intera            ${formattaUsd(costoChiamata)}`);
  if (costoChiamata !== null) {
    console.log(`   → 1000 schermate             ${formattaUsd(costoChiamata * 1000)}`);
  }

  if (con.length > 1) {
    const hit = con.slice(1).map((c) => c.uso.cacheHit);
    const inputRipetuto = con[1].uso.input;
    console.log(
      `   cache al 2º giro: ${hit[0]}/${inputRipetuto} token serviti da cache` +
        (hit[0] > 0
          ? hit[0] >= tokenImmagine
            ? '  → copre anche l\'immagine'
            : '  → copre solo parte del prompt, NON l\'immagine'
          : '  → nessuna cache'),
    );
  }
  const anteprima = primo.testo.replace(/\s+/g, ' ').slice(0, 160);
  console.log(`   risposta: ${anteprima}${primo.testo.length > 160 ? '…' : ''}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const immagine = argv.find((a) => !a.startsWith('--'));
  const iGiri = argv.indexOf('--giri');
  const giri = iGiri >= 0 ? Number(argv[iGiri + 1]) : 2;

  if (!immagine) {
    console.error('uso: node scripts/deepseek-vision-probe.mjs <schermata.png> [--giri 2]');
    process.exit(1);
  }
  if (!fs.existsSync(immagine)) {
    console.error(`immagine non trovata: ${immagine}`);
    process.exit(1);
  }

  const buf = fs.readFileSync(immagine);
  const base64 = buf.toString('base64');
  const prompt = costruisciPrompt(RIGHE_ESEMPIO);

  console.log(`schermata: ${path.basename(immagine)} — ${(buf.length / 1024).toFixed(1)} KiB`);
  console.log(`righe nel prompt: ${RIGHE_ESEMPIO.length} · giri con immagine: ${giri}`);

  let eseguiti = 0;
  for (const nome of Object.keys(PROVIDER)) {
    const chiave = process.env[CHIAVE_ENV[nome]];
    if (!chiave) {
      console.log(`\n── ${nome} — SALTATO: ${CHIAVE_ENV[nome]} non è nell'ambiente`);
      continue;
    }
    try {
      stampa(await misuraProvider(nome, chiave, prompt, base64, giri));
      eseguiti++;
    } catch (e) {
      console.log(`\n── ${nome} — FALLITO: ${e.message}`);
    }
  }

  if (eseguiti === 0) {
    console.error('\nNessun provider eseguito: nessuna misura prodotta.');
    process.exit(1);
  }
  console.log(`\n${eseguiti} provider misurati.`);
}

main();
