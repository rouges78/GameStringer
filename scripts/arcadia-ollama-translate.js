#!/usr/bin/env node
/**
 * Traduce le stringhe di it-todo.json con OLLAMA IN LOCALE — lo stesso motore
 * che GameStringer usa nel percorso offline (offline_translate_batch), qui
 * interpellato via la sua API HTTP (http://localhost:11434) senza passare dalla
 * UI dell'app. Costo zero: gira sul PC di Davide.
 *
 * Perché così e non a mano con Opus: tradurre 4310 battute con un modello di
 * frontiera è lo spreco più caro possibile (osservazione di Davide, 05/08).
 *
 * Lezioni cablate (da [[offline-translation-truth]] e [[fallimenti-muti]]):
 *  - MAI un modello fantasma: si legge /api/tags e si usa solo ciò che ESISTE.
 *  - CONTEGGIO ONESTO: i falliti sono falliti, non successi silenziosi.
 *  - CHECKPOINT su disco a ogni lotto: un giro da 40 min non si perde.
 *  - PLACEHOLDER intatti: {0} <tag> [[GRAB]] \n restano; se il modello li
 *    rovina, la guardia di arcadia-merge-it.js scarta la riga (resta inglese).
 *
 * Uso:
 *   node scripts/arcadia-ollama-translate.js [--model <nome>] [--batch 15] [--tab L10N]
 * Output: estratti-arcadia/trad/ollama-out.json  (formato {tab:{chiave:testo_it}})
 * Poi:    node scripts/arcadia-merge-it.js --apply estratti-arcadia/trad/ollama-out.json --slot es_ar
 */
const fs = require('fs');
const path = require('path');

const HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const BATCH = parseInt(opt('batch', '15'), 10);
const soloTab = opt('tab', null); // es. L10N per fare solo i dialoghi
let MODEL = opt('model', null);

const TODO = 'estratti-arcadia/it-todo.json';
const OUT = 'estratti-arcadia/trad/ollama-out.json';

async function api(pathname, body) {
  const r = await fetch(HOST + pathname, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${pathname} → HTTP ${r.status}`);
  return r.json();
}

// ── scelta del modello: solo fra quelli DAVVERO installati ──────────────────
async function scegliModello() {
  let tags;
  try { tags = await api('/api/tags'); }
  catch (e) {
    console.error(`❌ Ollama non raggiungibile su ${HOST} — avvialo (ollama serve) e riprova.\n   ${e.message}`);
    process.exit(2);
  }
  const installati = (tags.models || []).map(m => m.name);
  if (!installati.length) {
    console.error('❌ Nessun modello installato in Ollama. Es: ollama pull qwen2.5:7b-instruct');
    process.exit(2);
  }
  if (MODEL) {
    // richiesto esplicito: deve esistere (match esatto o per prefisso :latest)
    const hit = installati.find(n => n === MODEL || n === `${MODEL}:latest` || n.startsWith(MODEL + ':'));
    if (!hit) {
      console.error(`❌ Modello «${MODEL}» non installato. Disponibili: ${installati.join(', ')}`);
      process.exit(2);
    }
    return hit;
  }
  // auto: preferenza per instruct multilingua, poi il primo che c'è
  const pref = [/qwen2\.5.*instruct/i, /qwen.*instruct/i, /llama3.*instruct/i, /gemma2/i, /mistral/i, /llama3/i, /qwen/i];
  for (const re of pref) { const hit = installati.find(n => re.test(n)); if (hit) return hit; }
  return installati[0];
}

// ── prompt: JSON in → JSON out, placeholder verbatim ────────────────────────
function costruisciPrompt(obj) {
  return `Sei un traduttore professionista di videogiochi. Traduci in ITALIANO i valori del seguente oggetto JSON (inglese → italiano).
REGOLE FERREE:
- Rispondi SOLO con un oggetto JSON con le STESSE chiavi, valori tradotti. Nient'altro.
- Lascia INVARIATI i segnaposto: {0} {1}, i tag <...>, le sequenze [[...]], e le sequenze \\n. Stessa quantità e stesso ordine dell'originale.
- Non tradurre nomi propri (Trevor, Arcadia, INAC, A.D.A., Kovacs...).
- Tono naturale, parlato, da doppiaggio italiano.
- Conserva la punteggiatura di apertura/chiusura e gli spazi finali.

JSON da tradurre:
${JSON.stringify(obj, null, 0)}`;
}

async function traduciLotto(model, obj) {
  const res = await api('/api/generate', {
    model, prompt: costruisciPrompt(obj),
    stream: false, format: 'json',
    options: { temperature: 0.3, num_ctx: 8192 },
  });
  let parsed;
  try { parsed = JSON.parse(res.response); }
  catch { return null; } // parse fallito → il chiamante fa il fallback per-stringa
  return parsed;
}

async function main() {
  const model = await scegliModello();
  console.log(`🤖 Modello: ${model} · host ${HOST} · lotti da ${BATCH}`);

  const todo = JSON.parse(fs.readFileSync(TODO, 'utf8'));
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const tabelle = soloTab ? [soloTab] : Object.keys(todo);
  let tradotte = 0, fallite = 0, saltate = 0;
  const t0 = Date.now();

  for (const tab of tabelle) {
    const voci = Object.entries(todo[tab] || {});
    out[tab] = out[tab] || {};
    console.log(`\n📂 ${tab}: ${voci.length} da tradurre (${Object.keys(out[tab]).length} già fatte)`);

    for (let i = 0; i < voci.length; i += BATCH) {
      const fetta = voci.slice(i, i + BATCH).filter(([k]) => out[tab][k] == null);
      if (!fetta.length) { saltate += Math.min(BATCH, voci.length - i); continue; }
      const inObj = Object.fromEntries(fetta);

      let ris = await traduciLotto(model, inObj);
      // fallback per-stringa: se il lotto non torna JSON o mancano chiavi
      if (!ris || fetta.some(([k]) => typeof ris[k] !== 'string')) {
        ris = ris || {};
        for (const [k, v] of fetta) {
          if (typeof ris[k] === 'string') continue;
          const solo = await traduciLotto(model, { [k]: v });
          if (solo && typeof solo[k] === 'string') ris[k] = solo[k];
        }
      }

      for (const [k, v] of fetta) {
        if (ris && typeof ris[k] === 'string' && ris[k].trim()) { out[tab][k] = ris[k]; tradotte++; }
        else fallite++; // ONESTO: non tradotta = fallita, non finge successo
      }
      fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); // checkpoint a ogni lotto
      const fatte = Object.keys(out[tab]).length;
      const vel = tradotte / ((Date.now() - t0) / 1000);
      process.stdout.write(`\r   ${fatte}/${voci.length} · ${vel.toFixed(1)} str/s · ${fallite} fallite   `);
    }
    console.log();
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n📊 ${tradotte} tradotte, ${fallite} fallite, ${saltate} già presenti — in ${sec}s`);
  console.log(`✍️  ${OUT}`);
  console.log('Prossimo: node scripts/arcadia-merge-it.js --apply ' + OUT + ' --slot es_ar');
  if (fallite > 0) console.log(`⚠️ ${fallite} stringhe non tradotte: resteranno in inglese (onesto). Rilancia per ritentarle.`);
}

main().catch(e => { console.error(e); process.exit(1); });
