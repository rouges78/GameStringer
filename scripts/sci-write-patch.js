#!/usr/bin/env node
/**
 * Scrive i file PATCH esterni delle risorse Sierra SCI — la via di scrittura
 * che NON tocca RESOURCE.001-004 e non richiede un compressore.
 *
 * COME FUNZIONA (meccanismo nativo SCI, usato da Sierra stessa per i fix):
 * un file `<numero>.<EXT>` nella cartella del gioco SOVRASCRIVE la risorsa
 * omonima nei volumi, e viene letto NON COMPRESSO. Quindi per tradurre basta
 * scrivere `000.TEX` accanto a SCIV.EXE: niente riscrittura dei volumi, niente
 * LZW in scrittura. È l'equivalente SCI del pak override di American Arcadia.
 *
 * Formato del file patch (SCI0/SCI1):
 *   byte 0 : tipo risorsa (3 = text)
 *   byte 1 : byte extra di header dopo questi due (0 per le TEXT)
 *   dati   : le stringhe NUL-terminate, nello stesso ordine dell'originale
 *
 * ⚠️ L'ORDINE E IL NUMERO DELLE STRINGHE NON SI TOCCANO: lo script del gioco
 * le richiama per INDICE (Print text, N). Una stringa in meno = dialoghi
 * sbagliati o crash. Lo script rifiuta di scrivere se il conteggio non torna.
 *
 * Uso:
 *   # PROVA DEL CANALE prima di tradurre 3000 stringhe (lezione Arcadia):
 *   node scripts/sci-write-patch.js "<gioco>" --marker
 *   # scrittura vera da un JSON {"text.000":["str",...], ...}
 *   node scripts/sci-write-patch.js "<gioco>" --apply traduzioni.json
 *   # rimozione delle patch scritte da noi
 *   node scripts/sci-write-patch.js "<gioco>" --remove
 *
 * In --apply lo script scrive anche <gioco>/GameStringer/translation_session.json
 * — la STESSA traccia che lascia il flusso Unreal: è ciò che il backfill della
 * pagina Progetti legge per ricostruire la card (lib/backfill-session-projects.ts).
 * Senza, il lavoro esiste solo su disco e i Progetti non lo vedono (è il motivo
 * per cui Larry 3 non compariva). Opzioni: --game-name "Nome" --lang it
 *
 * I file originali NON vengono modificati: le patch si tolgono cancellandole.
 */
const fs = require('fs');
const path = require('path');

const TIPO_TEXT = 3;
const EXT_TEXT = 'TEX';

const argv = process.argv.slice(2);
const gameDir = argv.find(a => !a.startsWith('--'));
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const modoMarker = argv.includes('--marker');
const modoRemove = argv.includes('--remove');
const applyFile = opt('apply');
const gameName = opt('game-name');
const targetLang = opt('lang') || 'it';
const estrattiFile = opt('estratti') || 'estratti-larry3/testi-estratti.json';

if (!gameDir || !fs.existsSync(gameDir)) {
  console.error('Uso: node scripts/sci-write-patch.js "<cartella gioco>" [--marker | --apply trad.json | --remove]');
  process.exit(2);
}

const nomePatch = (numero) => path.join(gameDir, `${String(numero).padStart(3, '0')}.${EXT_TEXT}`);
const REGISTRO = path.join(gameDir, 'GameStringer_patches.txt');

// ── rimozione ───────────────────────────────────────────────────────────────
if (modoRemove) {
  if (!fs.existsSync(REGISTRO)) {
    console.log('Nessun registro GameStringer_patches.txt: niente da rimuovere.');
    process.exit(0);
  }
  const righe = fs.readFileSync(REGISTRO, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  let n = 0;
  for (const f of righe) {
    const p = path.join(gameDir, f);
    if (fs.existsSync(p)) { fs.unlinkSync(p); n++; }
  }
  fs.unlinkSync(REGISTRO);
  console.log(`🧹 Rimosse ${n} patch. Il gioco torna com'era (i volumi non erano stati toccati).`);
  process.exit(0);
}

// ── costruzione del blob di una risorsa TEXT ────────────────────────────────
function costruisciTex(stringhe) {
  const pezzi = [Buffer.from([TIPO_TEXT, 0])]; // header patch
  for (const s of stringhe) {
    // latin1: il font SCI è a 8 bit. Gli accenti si decidono dopo aver
    // guardato il font vero — qui si scrive ciò che arriva, senza inventare.
    pezzi.push(Buffer.from(s, 'latin1'), Buffer.from([0]));
  }
  return Buffer.concat(pezzi);
}

const estratti = JSON.parse(fs.readFileSync(estrattiFile, 'utf8'));
const scritte = [];

// ── modalità MARCATORE: prova del canale, una stringa sola ──────────────────
if (modoMarker) {
  const chiave = 'text.000';
  const orig = estratti[chiave];
  if (!orig) { console.error(`❌ ${chiave} non presente in ${estrattiFile}`); process.exit(1); }

  // Indice 4 = «You may know the word "%s" but it's beyond Al Lowe's vocabulary!»
  // Appare digitando una parola che il parser non conosce: visibile in 10 secondi.
  const IDX = 4;
  const copia = orig.slice();
  if (!/%s/.test(copia[IDX])) {
    console.log(`⚠️ La stringa ${IDX} non contiene %s — controlla che sia quella giusta:`);
    console.log(`   "${copia[IDX]}"`);
  }
  // Il marcatore contiene TUTTI gli accenti italiani: così una prova sola
  // verifica insieme il canale di scrittura dei testi E i glifi iniettati nei
  // font (à è é ì ò ù). Se i font non sono patchati si vedranno caratteri a
  // caso proprio lì — ed è esattamente l'informazione che serve.
  copia[IDX] = 'GS: "%s"? Perché no! Città, così, però, più, giù, caffè.';

  const blob = costruisciTex(copia);
  const dest = nomePatch(0);
  fs.writeFileSync(dest, blob);
  scritte.push(path.basename(dest));
  fs.writeFileSync(REGISTRO, scritte.join('\n') + '\n');

  console.log(`🔬 PROVA DEL CANALE scritta: ${dest}`);
  console.log(`   ${copia.length} stringhe (identiche all'originale tranne la #${IDX})`);
  console.log(`   Marcatore: "${copia[IDX]}"`);
  console.log('\n▶️  Avvia Larry 3 e digita una parola senza senso (es. "puffo").');
  console.log('   Se compare GAMESTRINGER OK → il canale patch FUNZIONA, si può tradurre tutto.');
  console.log('   Se compare il testo originale di Al Lowe → il gioco ignora le patch: si cambia via.');
  console.log(`\n🧹 Per togliere: node scripts/sci-write-patch.js "<gioco>" --remove`);
  process.exit(0);
}

// ── modalità APPLY: scrittura vera ──────────────────────────────────────────
if (!applyFile) {
  console.error('Serve --marker (prova del canale) oppure --apply <traduzioni.json>');
  process.exit(2);
}
const trad = JSON.parse(fs.readFileSync(applyFile, 'utf8'));

let risorseScritte = 0, stringheTradotte = 0, rifiutate = 0;
for (const [chiave, orig] of Object.entries(estratti)) {
  const tradotte = trad[chiave];
  if (!tradotte) continue;

  // GUARDIA: stesso numero di stringhe, sempre. Gli script richiamano per indice.
  if (tradotte.length !== orig.length) {
    console.log(`   ❌ ${chiave}: ${tradotte.length} stringhe invece di ${orig.length} — RIFIUTATA (gli indici si sposterebbero)`);
    rifiutate++;
    continue;
  }
  // Le stringhe non tradotte restano in inglese: mai vuoti al posto del testo.
  const finale = orig.map((s, i) => {
    const t = tradotte[i];
    return (typeof t === 'string' && t.length) ? t : s;
  });
  let nTrad = 0;
  for (let i = 0; i < finale.length; i++) if (finale[i] !== orig[i]) nTrad++;

  const numero = parseInt(chiave.split('.')[1], 10);
  const dest = nomePatch(numero);
  fs.writeFileSync(dest, costruisciTex(finale));
  scritte.push(path.basename(dest));
  risorseScritte++;
  stringheTradotte += nTrad;
}

fs.writeFileSync(REGISTRO, scritte.join('\n') + '\n');

// ── traccia per la pagina Progetti ──────────────────────────────────────────
// Stesso formato del flusso Unreal: entries con namespace (risorsa) + key
// (indice). TUTTE le stringhe, non solo le tradotte: così totalStrings del
// progetto è il conteggio vero e il progresso è onesto. Le risorse rifiutate
// dalla guardia restano con translated assente (= pending), non con un falso.
const sessionEntries = [];
for (const [chiave, orig] of Object.entries(estratti)) {
  const tradotte = trad[chiave];
  const valide = Array.isArray(tradotte) && tradotte.length === orig.length;
  for (let i = 0; i < orig.length; i++) {
    const t = valide ? tradotte[i] : undefined;
    const entry = { namespace: chiave, key: String(i), original: orig[i] };
    if (typeof t === 'string' && t.length && t !== orig[i]) entry.translated = t;
    sessionEntries.push(entry);
  }
}
const sessionDir = path.join(gameDir, 'GameStringer');
fs.mkdirSync(sessionDir, { recursive: true });
const sessionPath = path.join(sessionDir, 'translation_session.json');
fs.writeFileSync(sessionPath, JSON.stringify({
  gameName: gameName || path.basename(gameDir),
  gamePath: gameDir,
  engine: 'SierraSCI',
  sourceLanguage: 'en',
  targetLanguage: targetLang,
  updatedAt: new Date().toISOString(),
  entries: sessionEntries,
}, null, 1));
console.log(`\n🗂️ Sessione per la pagina Progetti: ${sessionPath} (${sessionEntries.length} entries)`);

console.log(`\n📊 ${risorseScritte} risorse patchate · ${stringheTradotte} stringhe tradotte · ${rifiutate} rifiutate`);
console.log(`📝 Registro: ${REGISTRO} (serve al --remove)`);
if (rifiutate > 0) console.log('⚠️ Le risorse rifiutate restano in inglese: meglio inglese che indici sballati.');
console.log('\n▶️  Avvia il gioco e verifica a schermo. Per tornare indietro: --remove');
