#!/usr/bin/env node
/**
 * translate-changelog.js
 *
 * Scrive le voci del changelog della nuova versione come chiavi i18n
 * `changelog.vX_Y_Z.N` in TUTTI i file lib/i18n/locales/<lang>.json.
 *
 * ⭐ SORGENTE: L'INGLESE — decisione di Davide, 18/08/2026.
 * Le voci arrivano da changelog-from-git, cioè dai messaggi di commit, che per
 * convenzione di progetto sono in INGLESE. Fino a oggi questo script le
 * dichiarava «italiane» e le scriveva pari pari in it.json, poi traduceva
 * DALL'ITALIANO: ma quell'italiano era inglese, quindi la sorgente mentiva e
 * l'utente italiano leggeva un changelog inglese. Misurato il 18/08 su 551
 * voci storiche: 38 identiche all'inglese anche in it.json, e tre versioni
 * intere (v1_11_1, v1_14_0, v1_15_0) di fatto non tradotte in nessuna lingua,
 * perché tradurre una sorgente inglese «italiana» propaga l'inglese.
 * ⇒ Adesso l'inglese è dichiarato per quello che è: en.json riceve le voci
 * così come sono, e TUTTE le altre lingue — ITALIANO COMPRESO — si traducono
 * da lì. L'italiano non è più un caso speciale: è una lingua di arrivo.
 *
 * Provider traduzione (auto-detect via env, in quest'ordine):
 *   OLLAMA_MODEL       -> Ollama locale (gratis)
 *   ANTHROPIC_API_KEY  -> Claude
 *   OPENAI_API_KEY     -> OpenAI
 *   GEMINI_API_KEY / GOOGLE_API_KEY -> Gemini
 *   DEEPL_API_KEY      -> DeepL
 * Senza provider, o se una lingua fallisce, si scrive comunque la SORGENTE in
 * quella lingua: le chiavi devono esistere ovunque (lo pretende il gate
 * __tests__/lib/i18n-locale-integrity.test.ts) e il testo non tradotto viene
 * DICHIARATO, non nascosto. La release non si blocca mai qui; a bloccarla, se
 * le chiavi mancano davvero, è verifyChangelogKeys() dal passo 5 di release-all.
 *
 * Export: async writeChangelogKeys(versionString, englishChanges, opts)
 *   -> { translated:boolean, provider:string|null, langs:string[],
 *        fallback:string[], partial:[{lang,missed:number[]}] }
 *   `partial` elenca le lingue tradotte con qualche voce rimasta in inglese:
 *   la bisezione le isola invece di perdere l'intera lingua, ma restano un
 *   debito e vanno dichiarate, non contate come successo.
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', '..', 'lib', 'i18n', 'locales');

const LANG_NAMES = {
  it: 'Italian', en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  ja: 'Japanese', zh: 'Chinese (Simplified)', ko: 'Korean', pt: 'Portuguese',
  ru: 'Russian', pl: 'Polish', el: 'Greek',
};

function versionKey(version) {
  return 'v' + version.replace(/[.\-]/g, '_');
}

function detectProvider() {
  // Ollama per primo se richiesto esplicitamente: gira in locale, non costa
  // nulla e non dipende dal credito di un account (06/08/2026: la traduzione
  // del changelog v1.16.0 si è fermata proprio su un credito esaurito).
  if (process.env.OLLAMA_MODEL) return 'ollama';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini';
  if (process.env.DEEPL_API_KEY) return 'deepl';
  return null;
}

function listLocaleLangs() {
  return fs.readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

/** Traduce UN blocco di voci -> targetLang. Ritorna array o null se fallisce. */
async function translateChunk(provider, targetLang, sourceChanges) {
  const langName = LANG_NAMES[targetLang] || targetLang;
  const sys = `You are a professional software localizer for a video-game translation desktop app called GameStringer. ` +
    `Translate the given English changelog bullet points into ${langName}. ` +
    `Keep the leading emoji and any technical/proper terms (XUnity, BepInEx, Tauri, IL2CPP, LLM, OCR, Steam, GOG, API names, file paths) unchanged. ` +
    `Keep it concise, same number of items, same order. ` +
    `Return ONLY a JSON array of strings, no prose, no markdown fences.`;
  const user = JSON.stringify(sourceChanges, null, 2);

  try {
    let content;
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
          // 06/08/2026: era 2000 e il changelog v1.16.0 (90 voci) non ci
          // stava MAI: JSON troncato → parse fallito → fallback silenzioso
          // per ogni lingua. Il chunking in translateArray tiene i blocchi
          // piccoli, ma il tetto resta largo per non ricaderci.
          max_tokens: 8000,
          system: sys,
          messages: [{ role: 'user', content: user }],
        }),
      });
      const j = await res.json();
      content = j?.content?.[0]?.text;
      // 06/08/2026: l'errore API veniva INGOIATO (content undefined → return
      // null muto) e il retry sembrava un fallimento senza causa. Dichiararlo.
      if (!content && j?.error) console.warn(`   ⚠️  API anthropic (${targetLang}): ${j.error.type}: ${j.error.message}`);
    } else if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0,
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
      });
      const j = await res.json();
      content = j?.choices?.[0]?.message?.content;
    } else if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0 },
        }),
      });
      const j = await res.json();
      content = j?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (provider === 'ollama') {
      // Locale, gratis: OLLAMA_MODEL=<modello> [OLLAMA_HOST=http://127.0.0.1:11434]
      const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
      const res = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL,
          stream: false,
          options: { temperature: 0 },
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        }),
      });
      const j = await res.json();
      content = j?.message?.content;
      if (!content && j?.error) console.warn(`   ⚠️  API ollama (${targetLang}): ${j.error}`);
    } else if (provider === 'deepl') {
      // DeepL non capisce JSON array: traduce voce per voce.
      const out = [];
      for (const line of sourceChanges) {
        const res = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}` },
          body: new URLSearchParams({ text: line, source_lang: 'EN', target_lang: targetLang.toUpperCase() }),
        });
        const j = await res.json();
        out.push(j?.translations?.[0]?.text || line);
      }
      return out;
    }

    if (!content) return null;
    // Estrai il primo array JSON dal testo.
    const match = content.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(match ? match[0] : content);
    if (Array.isArray(arr) && arr.length === sourceChanges.length) return arr.map(String);
    return null;
  } catch (err) {
    console.warn(`   ⚠️  Traduzione ${targetLang} fallita: ${err.message}`);
    return null;
  }
}

/**
 * Traduce UN blocco, e se fallisce lo DIVIDE A METÀ e ritenta, fino alla
 * singola voce. Ritorna sempre un array lungo quanto `items`: le voci che
 * falliscono anche da sole restano in inglese e vengono dichiarate via
 * `onFallback`, mai sostituite in silenzio.
 *
 * 23/08/2026: senza bisezione, un blocco che non faceva il parse portava via
 * tutte e 88 le voci della lingua. Misurato su ru ed el del changelog v1.16.0:
 * il modello emetteva una virgoletta non escapata a metà del PRIMO blocco, e
 * translateArray restituiva null per l'intera lingua. Peggio: temperature 0
 * rende il guasto DETERMINISTICO — tre passate di riprova sono fallite allo
 * stesso byte (position 511, poi 865). Riprovare uguale non poteva funzionare;
 * dividere sì, e infatti ha recuperato 88/88 su entrambe le lingue.
 */
async function translateBisect(provider, targetLang, items, baseIdx, onFallback) {
  const got = await translateChunk(provider, targetLang, items);
  if (got) return got;
  if (items.length === 1) {
    if (onFallback) onFallback(baseIdx, items[0]);
    return items.slice(); // la SORGENTE inglese, dichiarata
  }
  const mid = Math.ceil(items.length / 2);
  const a = await translateBisect(provider, targetLang, items.slice(0, mid), baseIdx, onFallback);
  const b = await translateBisect(provider, targetLang, items.slice(mid), baseIdx + mid, onFallback);
  return a.concat(b);
}

/**
 * Traduce un array di voci -> targetLang, A BLOCCHI (12 voci per chiamata).
 * Il changelog v1.16.0 aveva 90 voci: una chiamata sola sforava max_tokens e
 * falliva in silenzio.
 *
 * Ritorna l'array completo, oppure null se il provider è morto (vedi sotto).
 * Le singole voci che falliscono restano in inglese e sono DICHIARATE via
 * `onFallback(indice, testo)`: il chiamante deve poterle contare, altrimenti
 * una lingua quasi-tradotta si spaccia per tradotta — che è esattamente la
 * bugia che questo file esiste per non raccontare.
 */
async function translateArray(provider, targetLang, sourceChanges, onFallback) {
  if (provider === 'deepl') return translateChunk(provider, targetLang, sourceChanges); // già voce-per-voce
  const CHUNK = 12;
  const out = [];
  for (let i = 0; i < sourceChanges.length; i += CHUNK) {
    const slice = sourceChanges.slice(i, i + CHUNK);
    let fellBack = 0;
    const part = await translateBisect(provider, targetLang, slice, i, (idx, txt) => {
      fellBack++;
      if (onFallback) onFallback(idx, txt);
    });
    // Provider morto (chiave scaduta, servizio giù): fallisce TUTTO, non una
    // voce. Distinguerlo dalla voce tossica evita di bisezionare 88 volte a
    // vuoto — e restituisce il fallback totale, che è la verità in quel caso.
    if (fellBack === slice.length) {
      console.warn(`   ⚠️  ${targetLang}: l'intero blocco è fallito voce per voce — provider non utilizzabile`);
      return null;
    }
    out.push(...part);
  }
  return out;
}

function setVersionKeys(localePath, vKey, items) {
  const data = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  data.changelog ||= {};
  const obj = {};
  items.forEach((txt, i) => { obj[String(i)] = txt; });
  data.changelog[vKey] = obj;
  fs.writeFileSync(localePath, JSON.stringify(data, null, 2) + '\n');
}

async function writeChangelogKeys(version, sourceChanges, opts = {}) {
  const { dryRun = false } = opts;
  const vKey = versionKey(version);
  const langs = listLocaleLangs();
  const provider = detectProvider();

  // L'inglese è sempre scrivibile: è la sorgente.
  if (dryRun) {
    console.log(`   [dry-run] avrei scritto changelog.${vKey} in: ${langs.join(', ')}`);
    return { translated: Boolean(provider), provider, langs };
  }

  // Scrivi subito l'INGLESE: è la sorgente, arriva dai messaggi di commit.
  if (langs.includes('en')) setVersionKeys(path.join(LOCALES_DIR, 'en.json'), vKey, sourceChanges);

  if (!provider) {
    // 18/08/2026: prima questo ramo scriveva SOLO it.json e usciva. Le altre
    // lingue restavano senza la chiave `changelog.vX_Y_Z.*`, e il gate
    // __tests__/lib/i18n-locale-integrity.test.ts (missing = 0) mandava la CI
    // in rosso subito dopo la release — è successo con la v1.17.0: 60 chiavi
    // mancanti × 10 lingue. Il fallback c'era già per la singola lingua che
    // fallisce (riga sotto): mancava per «nessun provider».
    // Ora scriviamo comunque la sorgente in OGNI lingua — chiavi presenti,
    // testo non tradotto e DICHIARATO — e la verifica a valle lo conferma.
    console.warn('   ⚠️  Nessuna API key di traduzione (ANTHROPIC/OPENAI/GEMINI/DEEPL/OLLAMA_MODEL).');
    const fallback = [];
    for (const lang of langs) {
      if (lang === 'en') continue;
      setVersionKeys(path.join(LOCALES_DIR, `${lang}.json`), vKey, sourceChanges);
      fallback.push(lang);
    }
    console.warn(`       Scritta la SORGENTE (non tradotta) in: ${fallback.join(', ')}.`);
    console.warn(`       Debito da saldare: tradurre changelog.${vKey} in queste lingue.`);
    return { translated: false, provider: null, langs: ['en'], fallback };
  }

  // L'italiano NON è più un caso speciale: è una lingua di arrivo come le altre.
  const done = [];
  const partial = [];
  for (const lang of langs) {
    if (lang === 'en') continue;
    const missed = [];
    const translated = await translateArray(provider, lang, sourceChanges, (idx) => missed.push(idx));
    const items = translated || sourceChanges; // fallback DICHIARATO: la sorgente inglese se la lingua fallisce
    setVersionKeys(path.join(LOCALES_DIR, `${lang}.json`), vKey, items);
    if (translated) done.push(lang);
    // 23/08/2026: con la bisezione una lingua può tornare quasi tutta tradotta
    // con qualche voce ancora in inglese. Contarla come ✅ nasconderebbe il
    // buco: si dichiara, con gli indici, così chi legge sa cosa ripassare.
    if (translated && missed.length) {
      partial.push({ lang, missed });
      process.stdout.write(`   ⚠️  ${lang} (${missed.length} voci in inglese: ${missed.join(', ')})`);
    } else {
      process.stdout.write(`   ${translated ? '✅' : '↩️ '} ${lang}`);
    }
  }
  done.unshift('en');
  process.stdout.write('\n');
  // 06/08/2026: prima ritornava translated:true anche quando OGNI lingua era
  // andata in fallback (done = solo la sorgente) e la ship stampava «tradotto con
  // anthropic» su un fallimento totale — contatore bugiardo. Tradotto è vero
  // solo se almeno una lingua oltre alla sorgente è stata tradotta davvero.
  const fallback = langs.filter((l) => l !== 'en' && !done.includes(l));
  return { translated: done.length > 1, provider, langs: done, fallback, partial };
}

/**
 * PROVA D'EFFETTO: rilegge i file su disco e verifica che `changelog.vKey`
 * esista, sia non vuoto e abbia lo stesso numero di voci della SORGENTE INGLESE in
 * OGNI locale. Non si fida di quello che writeChangelogKeys dice di aver
 * fatto: guarda il risultato.
 *
 * Ritorna { ok, expected, bad: [{ lang, reason }] }.
 */
function verifyChangelogKeys(version, expectedCount) {
  const vKey = versionKey(version);
  const bad = [];
  let expected = expectedCount;

  if (expected === undefined) {
    try {
      const src = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
      expected = Object.keys(src?.changelog?.[vKey] || {}).length;
    } catch { expected = 0; }
  }

  for (const lang of listLocaleLangs()) {
    let entry;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${lang}.json`), 'utf8'));
      entry = data?.changelog?.[vKey];
    } catch (err) {
      bad.push({ lang, reason: `file illeggibile: ${err.message}` });
      continue;
    }
    const n = entry ? Object.keys(entry).length : 0;
    if (!entry) bad.push({ lang, reason: `changelog.${vKey} assente` });
    else if (n !== expected) bad.push({ lang, reason: `${n} voci invece di ${expected}` });
  }

  return { ok: bad.length === 0 && expected > 0, expected, bad, vKey };
}

module.exports = { writeChangelogKeys, verifyChangelogKeys, versionKey, detectProvider, listLocaleLangs, translateArray, setVersionKeys };

if (require.main === module) {
  // Test manuale: node translate-changelog.js 9.9.9 "✨ Test feature" "🐛 Test fix"
  const [version, ...changes] = process.argv.slice(2);
  if (!version) { console.error('Uso: translate-changelog.js <version> <change...>'); process.exit(1); }
  writeChangelogKeys(version, changes, { dryRun: process.env.DRY === '1' }).then((r) => console.log(r));
}
