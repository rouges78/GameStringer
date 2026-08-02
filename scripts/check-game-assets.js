#!/usr/bin/env node
/**
 * Guard anti file-di-gioco nel repo.
 *
 * Il 02/08/2026, durante una ricognizione di routine, è saltato fuori che
 * `estratti_pak/` era TRACCIATA da git: 18 file (9 .locres estratti dal .pak di
 * un gioco UE5 commerciale, più 9 .json col testo in chiaro) entrati col commit
 * 9c6971e0 del 01/08 e già su origin/main, cioè su un repo PUBBLICO.
 *
 * Non era malizia e non era distrazione: era il modo in cui era scritta la
 * difesa. Il .gitignore elencava le cartelle di lavoro una per una —
 * `/estratti/`, `/estratti2/` — e la terza, nata dopo con un nome nuovo, non
 * era nell'elenco. Un elenco copre i nomi che qualcuno si è ricordato di
 * aggiungere; non copre quelli di domani. Il .gitignore ora usa un glob su
 * "estratti" seguito da qualsiasi cosa, ma un glob difende solo dal caso che
 * abbiamo già visto: la prossima cartella potrebbe chiamarsi "dump-ue5" o
 * "lavoro-tmp".
 *
 * Questo gate difende dall'ALTRO lato: non da come si chiama la cartella, ma da
 * COSA c'è dentro. Se un file con estensione da gioco risulta tracciato fuori
 * da `__tests__/fixtures/`, la CI si ferma. È l'unico controllo che non dipende
 * da chi si ricorda di aggiornare il .gitignore.
 *
 * PERCHÉ CONTA PIÙ DI 108 KB. GameStringer promette esattamente questo:
 * docs/ANTI_PIRACY.md, docs/DMCA.md, il redistribution-guard che blocca la
 * pubblicazione di un .gspack contenente testo sorgente ("solo diff"), il gate
 * "possiedi il gioco". Un repo che ridistribuisce dialoghi estratti da un
 * gioco commerciale smentisce le sue stesse difese — e lo fa nel momento
 * peggiore, cioè quando si scrive a un publisher per chiedere collaborazione.
 *
 * LE TRE REGOLE
 *
 *  1. Nessun file con estensione da gioco tracciato fuori da
 *     `__tests__/fixtures/`. Le eccezioni si dichiarano in ALLOWLIST, con
 *     motivazione scritta: un'eccezione senza motivo è un buco, non un permesso.
 *
 *  2. Ogni fixture binaria dev'essere CITATA PER NOME in un README della sua
 *     cartella (o di quella sopra). Il .gitignore chiede fixture "tagliate e
 *     documentate": una fixture di cui nessuno sa dire da dove viene è
 *     indistinguibile da un file di gioco infilato lì per comodità.
 *
 *  3. Nessuna fixture oltre MAX_FIXTURE_BYTES. "Tagliata" è una parola che
 *     serve solo se qualcuno la misura. Dal 02/08/2026 sera NESSUNA fixture
 *     autentica da gioco commerciale è più nel repo (l'ultima, il .locres autentico, è stata spostata fuori: vive in estratti/, ignorata, e i test la
 *     ricevono via GS_UE_AUTHENTIC_LOCRES). Il tetto resta come cintura di
 *     sicurezza per le fixture sintetiche.
 *
 * COSA QUESTO GATE NON FA. Non guarda dentro i file: un .json pieno di dialoghi
 * di un gioco passa liscio, perché .json è l'estensione di mezzo progetto.
 * Contro quello serve il buon senso, non uno script. E non ripulisce la storia:
 * i 18 file restano dentro 9c6971e0 finché non si decide di riscriverla.
 *
 * Uso:
 *   node scripts/check-game-assets.js           # verifica (esce 1 se rosso)
 *   node scripts/check-game-assets.js --report  # elenca tutto ciò che vede
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PREFIX = '__tests__/fixtures/';
const MAX_FIXTURE_BYTES = 256 * 1024;

// Estensioni di archivi e file di localizzazione dei motori che sappiamo
// gestire. Deliberatamente NON include i font (.ttf/.otf): sono un problema di
// licenza diverso e le fixture font del repo sono sintetiche.
const GAME_EXT = new Set([
  // Unreal
  'locres', 'locmeta', 'pak', 'utoc', 'ucas', 'uasset', 'uexp', 'umap',
  // Unity
  'assets', 'bundle', 'resource', 'resS',
  // GameMaker / Godot / Ren'Py / RPG Maker
  'win', 'pck', 'rpa', 'rpyc', 'rvdata', 'rvdata2', 'rgssad', 'rgss3a',
  // Bethesda / CRI / Danganronpa / Wwise
  'bsa', 'ba2', 'esp', 'esm', 'cpk', 'acb', 'awb', 'stx', 'bnk',
  // dump di memoria
  'dmp',
]);

/**
 * Eccezioni FUORI da __tests__/fixtures/. Ogni voce vuole un motivo scritto e
 * un percorso esatto — niente glob, altrimenti l'eccezione cresce da sola.
 * Formato: { file: 'percorso/relativo', perche: 'motivo' }
 */
const ALLOWLIST = [];

function tracked() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8');
  return out.split('\0').filter(Boolean);
}

function extOf(f) {
  const e = path.extname(f);
  return e ? e.slice(1) : '';
}

function isGameFile(f) {
  const e = extOf(f);
  // confronto case-insensitive: .LOCRES esiste, e un gate che non lo vede è peggio di nessun gate
  for (const known of GAME_EXT) if (known.toLowerCase() === e.toLowerCase()) return true;
  return false;
}

/** README candidati: la cartella del file, quella sopra, e la radice delle fixture. */
function readmesFor(rel) {
  const dir = path.posix.dirname(rel);
  const up = path.posix.dirname(dir);
  const cands = [
    path.posix.join(dir, 'README.md'),
    path.posix.join(up, 'README.md'),
    `${FIXTURE_PREFIX}engines/README.md`,
    `${FIXTURE_PREFIX}README.md`,
  ];
  return [...new Set(cands)];
}

function main() {
  const report = process.argv.includes('--report');
  const files = tracked();

  // Prova di effetto: se git non ha elencato nulla, il gate NON è verde —
  // è cieco. Un controllo che esamina zero file passa sempre.
  if (files.length === 0) {
    console.error('✖ git ls-files non ha restituito alcun file: il gate non ha esaminato niente.');
    process.exit(1);
  }

  const gameFiles = files.filter(isGameFile);
  const allowed = new Set(ALLOWLIST.map((a) => a.file));

  const fuori = [];
  const nonDocumentate = [];
  const troppoGrandi = [];

  for (const rel of gameFiles) {
    if (allowed.has(rel)) continue;

    if (!rel.startsWith(FIXTURE_PREFIX)) {
      fuori.push(rel);
      continue;
    }

    const base = path.posix.basename(rel);
    const citata = readmesFor(rel).some((r) => {
      const abs = path.join(ROOT, r);
      return fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').includes(base);
    });
    if (!citata) nonDocumentate.push(rel);

    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) {
      const size = fs.statSync(abs).size;
      if (size > MAX_FIXTURE_BYTES) troppoGrandi.push({ rel, size });
    }
  }

  if (report) {
    console.log(`File tracciati: ${files.length} · con estensione da gioco: ${gameFiles.length}`);
    for (const f of gameFiles) {
      const abs = path.join(ROOT, f);
      const kb = fs.existsSync(abs) ? (fs.statSync(abs).size / 1024).toFixed(1) : '?';
      const dove = f.startsWith(FIXTURE_PREFIX) ? 'fixture' : allowed.has(f) ? 'allowlist' : 'FUORI';
      console.log(`  [${dove}] ${f} (${kb} KB)`);
    }
    if (ALLOWLIST.length) {
      console.log('\nEccezioni dichiarate:');
      for (const a of ALLOWLIST) console.log(`  ${a.file} — ${a.perche}`);
    }
  }

  let rosso = false;

  if (fuori.length) {
    rosso = true;
    console.error(`\n✖ ${fuori.length} file di gioco tracciati FUORI da ${FIXTURE_PREFIX}:`);
    for (const f of fuori) console.error(`    ${f}`);
    console.error(
      '\n  Questi file finiscono nel repo pubblico. Se sono materiale di lavoro:\n' +
        '    git rm -r --cached <cartella>/   e aggiungi la cartella al .gitignore\n' +
        '  Se invece servono ai test, spostali in __tests__/fixtures/, tagliali al minimo\n' +
        '  e scrivi nel README della cartella da dove vengono.\n' +
        '  Se esiste un motivo vero per tenerli dove sono, dichiaralo in ALLOWLIST\n' +
        '  dentro questo script, con la motivazione: un permesso senza motivo è un buco.'
    );
  }

  if (nonDocumentate.length) {
    rosso = true;
    console.error(`\n✖ ${nonDocumentate.length} fixture binarie non citate in nessun README:`);
    for (const f of nonDocumentate) console.error(`    ${f}`);
    console.error(
      '\n  Aggiungi il nome del file al README della sua cartella, con una riga su\n' +
        "  cos'è e da dove viene (sintetica? estratta da un gioco? quale?).\n" +
        '  Una fixture anonima è indistinguibile da un file di gioco lasciato lì.'
    );
  }

  if (troppoGrandi.length) {
    rosso = true;
    console.error(`\n✖ ${troppoGrandi.length} fixture oltre ${(MAX_FIXTURE_BYTES / 1024).toFixed(0)} KB:`);
    for (const t of troppoGrandi) console.error(`    ${t.rel} (${(t.size / 1024).toFixed(1)} KB)`);
    console.error(
      '\n  Le fixture vanno tagliate al minimo che riproduce il caso. Se un file\n' +
        '  grande serve davvero, alza MAX_FIXTURE_BYTES scrivendo QUI il perché.'
    );
  }

  if (rosso) process.exit(1);

  console.log(
    `✅ Nessun file di gioco fuori posto (${gameFiles.length} file con estensione da gioco, ` +
      `tutti sotto ${FIXTURE_PREFIX}, documentati e sotto i ${(MAX_FIXTURE_BYTES / 1024).toFixed(0)} KB).`
  );
}

main();
