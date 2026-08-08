#!/usr/bin/env node
/**
 * release-all.js — Orchestratore di release "un comando e basta".
 *
 * Incatena tutto il processo per pubblicare una nuova versione di GameStringer
 * su Windows / Linux / macOS con auto-update, changelog in-app (11+ lingue),
 * CHANGELOG.md, README/guide e sito aggiornati.
 *
 *   npm run ship                 # auto: bump dedotto dai commit
 *   npm run ship -- patch        # forza patch
 *   npm run ship -- minor        # forza minor
 *   npm run ship -- major        # forza major
 *   npm run ship -- --dry-run    # mostra tutto, NON scrive/committa/pubblica
 *   npm run ship -- --no-publish # fa tutto MA non lancia la build pubblica
 *   npm run ship -- --yes        # salta la conferma interattiva
 *   npm run ship -- --resume     # riprende una release interrotta a metà
 *
 * RIPRENDIBILITÀ (07/08/2026, difetto 2 della ship v1.16.0): un index.lock
 * stale ha ucciso la ship al passo 8, DOPO il bump — e rilanciare avrebbe
 * ribumpato a 1.17.0, quindi tutto il resto è stato fatto a mano. Ora ogni
 * passo riuscito viene registrato in .release-state.json (gitignorato):
 * se la ship muore, `npm run ship -- --resume` riparte dal passo fallito
 * con la STESSA versione e le STESSE voci changelog, senza ribumpare.
 * A release completata il file di stato viene rimosso.
 *
 * Passi:
 *   0. Preflight (branch, working tree pulito, gh disponibile)
 *   1. Raccoglie commit dall'ultimo tag -> voci changelog + bump type
 *   2. Conferma
 *   3. version-manager bump (+ sync package.json/Cargo.toml/tauri.conf.json)
 *   4. Rigenera CHANGELOG.md
 *   5. Scrive changelog i18n in tutte le lingue (traduzione automatica)
 *   6. senior-versioning-agent fix (README badge/footer + versione guide)
 *   7. Aggiorna versione nel sito (docs/sito) se presente
 *   8. commit + push main + tag + push tag
 *   9. Dispatch release.yml (build & publish multi-OS) — se non --no-publish
 *  10. Stampa link al run e i comandi di verifica
 */

const { execSync, execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'version.json');
const STATE_FILE = path.join(ROOT, '.release-state.json');
const VM = path.join(__dirname, 'version-manager.js');
const AGENT = path.join(__dirname, 'senior-versioning-agent.js');
const { getLastTag, getCommits, buildChanges } = require('./release/changelog-from-git');
const { writeChangelogKeys } = require('./release/translate-changelog');

const C = { r: '\x1b[0m', b: '\x1b[1m', red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', cya: '\x1b[36m', dim: '\x1b[2m' };
const log = {
  step: (n, m) => console.log(`\n${C.b}${C.cya}[${n}]${C.r} ${C.b}${m}${C.r}`),
  ok: (m) => console.log(`   ${C.grn}✅${C.r} ${m}`),
  warn: (m) => console.log(`   ${C.yel}⚠️ ${C.r} ${m}`),
  err: (m) => console.log(`   ${C.red}❌${C.r} ${m}`),
  info: (m) => console.log(`   ${m}`),
};

function sh(cmd, opts = {}) { return execSync(cmd, { encoding: 'utf8', stdio: opts.capture ? 'pipe' : 'inherit', cwd: ROOT, ...opts }); }
function shOut(cmd) { return execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim(); }
function have(bin) { return spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }).status === 0; }

function parseArgs(argv) {
  const a = { bump: null, dryRun: false, noPublish: false, yes: false, resume: false };
  for (const t of argv) {
    if (t === '--dry-run' || t === '-n') a.dryRun = true;
    else if (t === '--no-publish') a.noPublish = true;
    else if (t === '--yes' || t === '-y') a.yes = true;
    else if (t === '--resume') a.resume = true;
    else if (['patch', 'minor', 'major', 'auto'].includes(t)) a.bump = t === 'auto' ? null : t;
  }
  return a;
}

// ---- Stato riprendibile -----------------------------------------------------
// Il file vive nella ROOT ma è gitignorato: il `git add -A` del passo 8 non
// deve mai committarlo. Ogni passo riuscito viene registrato SUBITO su disco,
// così un crash lascia una fotografia onesta di dove si era arrivati.
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}
function saveState(st) { fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2) + '\n'); }
function clearState() { try { fs.unlinkSync(STATE_FILE); } catch {} }
function markStep(st, n) { st.steps[String(n)] = true; saveState(st); }
function stepDone(st, n) { return Boolean(st && st.steps && st.steps[String(n)]); }

async function confirm(question) {
  // Conferma interattiva via readline (no dipendenze). In CI usa --yes.
  // NB: la vecchia versione usava fs.readFileSync(0) che legge stdin FINO A
  // EOF: nella console Windows "y"+Invio non produce EOF, quindi lo script
  // restava appeso per sempre sulla conferma. readline risolve una riga alla
  // volta e funziona su Windows/macOS/Linux.
  if (!process.stdin.isTTY) return false; // stdin non interattivo: rifiuta (usa --yes)
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => rl.question(`${question} [y/N] `, resolve));
    return /^\s*y(es)?\s*$/i.test(answer || '');
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`${C.b}🚀 GameStringer — release-all${C.r}${args.dryRun ? `  ${C.yel}(DRY-RUN)${C.r}` : ''}`);

  // ---- Stato: c'è una release interrotta? ---------------------------------
  // PRIMA del preflight: una release interrotta lascia il working tree sporco
  // per definizione, e il check sul tree pulito risponderebbe «committa o
  // stasha» — il consiglio SBAGLIATO — senza mai dire che esiste un --resume.
  let st = loadState();
  if (args.dryRun && args.resume) { log.err('--resume e --dry-run insieme non hanno senso.'); process.exit(1); }
  if (!args.dryRun) {
    if (st && !args.resume) {
      log.err(`trovata una release INTERROTTA (v${st.next}, avviata ${st.startedAt}).`);
      log.info('Riprendila con:      npm run ship -- --resume');
      log.info('Oppure, se è da buttare davvero, cancella .release-state.json e rilancia.');
      process.exit(1);
    }
    if (!st && args.resume) { log.err('niente da riprendere: .release-state.json assente.'); process.exit(1); }
  }

  // ---- 0. Preflight -------------------------------------------------------
  log.step(0, 'Preflight');
  let branch = 'unknown';
  try { branch = shOut('git rev-parse --abbrev-ref HEAD'); } catch {}
  log.info(`branch: ${branch}`);
  if (branch !== 'main' && branch !== 'master') log.warn(`non sei su main/master (sei su "${branch}").`);

  const dirty = shOut('git status --porcelain');
  if (dirty && !args.dryRun && !args.resume) {
    log.err('working tree non pulito. Committa o stasha le modifiche prima di rilasciare.');
    console.log(dirty.split('\n').slice(0, 10).map((l) => '      ' + l).join('\n'));
    process.exit(1);
  } else if (dirty && args.resume) {
    // In resume lo sporco è ATTESO: è il bump non ancora committato del run interrotto.
    log.warn('working tree non pulito (atteso in --resume: è il lavoro del run interrotto).');
  } else if (dirty) {
    log.warn('working tree non pulito (ignorato in dry-run).');
  } else {
    log.ok('working tree pulito');
  }

  // Guard npm-vs-crate (difetto 6 della ship v1.16.0): i minor di
  // @tauri-apps/cli+api e del crate tauri devono coincidere, sennò la build
  // muore su tutti gli OS DOPO che il bump è già stato committato. Due secondi
  // qui risparmiano una release monca.
  try { execFileSync('node', [path.join(__dirname, 'check-tauri-parity.js')], { stdio: 'inherit', cwd: ROOT }); }
  catch { log.err('parity npm-vs-crate fallita: riallinea PRIMA di rilasciare (vedi sopra).'); process.exit(1); }

  const ghOk = have('gh');
  if (!ghOk) {
    if (!args.noPublish && !args.dryRun) { log.err('GitHub CLI "gh" non trovato: serve per lanciare la build. Installa gh o usa --no-publish.'); process.exit(1); }
    log.warn('gh non trovato (ok perché non si pubblica).');
  } else {
    const auth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
    if (auth.status !== 0 && !args.noPublish && !args.dryRun) { log.err('gh non autenticato. Esegui `gh auth login`.'); process.exit(1); }
    log.ok('gh disponibile e autenticato');
  }

  let changes, bumpType, next;
  if (args.resume) {
    // NON si rideducono i commit: se il passo 8 era passato, i commit dal tag
    // sarebbero zero e la versione ricalcolata sarebbe SBAGLIATA. La verità
    // del run interrotto sta nello stato.
    ({ changes, bumpType, next } = st);
    const fatti = Object.keys(st.steps || {}).filter((k) => st.steps[k]);
    log.step('R', `Riprendo la release v${next} — passi già completati: ${fatti.length ? fatti.join(', ') : 'nessuno'}`);
    console.log(`   ${C.dim}voci changelog (dallo stato):${C.r} ${changes.length}`);
  } else {
    // ---- 1. Changelog dai commit -----------------------------------------
    log.step(1, 'Raccolta commit dall\'ultimo tag');
    const lastTag = getLastTag();
    const commits = getCommits(lastTag);
    log.info(`ultimo tag: ${lastTag || '(nessuno)'}`);
    log.info(`commit dal tag: ${commits.length}`);
    if (commits.length === 0) { log.err('Nessun commit nuovo dall\'ultimo tag: niente da rilasciare.'); process.exit(1); }

    const { changes: ch, bumpType: autoBump } = buildChanges(commits);
    changes = ch;
    bumpType = args.bump || autoBump;
    if (changes.length === 0) { log.err('Nessuna voce changelog significativa generata.'); process.exit(1); }

    const cur = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    next = (() => {
      let { major, minor, patch } = cur;
      if (bumpType === 'major') { major++; minor = 0; patch = 0; }
      else if (bumpType === 'minor') { minor++; patch = 0; }
      else { patch++; }
      return `${major}.${minor}.${patch}`;
    })();

    console.log(`\n   ${C.dim}versione:${C.r} ${cur.version} → ${C.b}${next}${C.r}  ${C.dim}(${bumpType}${args.bump ? ', forzato' : ', auto'})${C.r}`);
    console.log(`   ${C.dim}voci changelog:${C.r}`);
    changes.forEach((c) => console.log('     ' + c));
  }

  // ---- 2. Conferma --------------------------------------------------------
  if (!args.dryRun && !args.yes) {
    const what = args.resume ? `RIPRENDERE la release interrotta`
      : args.noPublish ? 'preparare la release (senza pubblicare)' : 'PUBBLICARE la release su tutti gli OS';
    if (!(await confirm(`\n${C.yel}Procedo a ${what} v${next}?${C.r}`))) { log.warn('Annullato.'); process.exit(0); }
  }
  if (args.dryRun) { log.step('✓', 'Dry-run completato: nessuna modifica scritta.'); printVerify(next, args); return; }

  // Da qui in poi si scrive: lo stato nasce ORA (run nuovo) e ogni passo
  // riuscito viene registrato subito, così un crash non cancella la storia.
  if (!args.resume) {
    st = { next, bumpType, changes, branch, startedAt: new Date().toISOString(), steps: {} };
    saveState(st);
  }

  // ---- 3. Bump versione + sync -------------------------------------------
  if (stepDone(st, 3)) {
    log.step(3, 'Bump versione (già fatto in un run precedente, salto)');
  } else {
    const curNow = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    if (args.resume && curNow.version === next) {
      // Crash avvenuto DOPO il bump ma PRIMA della registrazione del passo:
      // version.json è già alla versione giusta, ribumpare sarebbe il difetto 2.
      log.step(3, `Bump versione: version.json è GIÀ a ${next}, salto senza ribumpare`);
    } else {
      log.step(3, 'Bump versione e sync (package.json, Cargo.toml, tauri.conf.json)');
      execFileSync('node', [VM, bumpType, ...changes], { stdio: 'inherit', cwd: ROOT });
    }
    const after = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    if (after.version !== next) log.warn(`versione attesa ${next}, ottenuta ${after.version} — proseguo con ${after.version}.`);
    markStep(st, 3);
  }
  const version = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')).version;
  st.version = version; saveState(st);

  // ---- 4. CHANGELOG.md ----------------------------------------------------
  if (stepDone(st, 4)) { log.step(4, 'CHANGELOG.md (già fatto, salto)'); }
  else {
    log.step(4, 'Rigenero CHANGELOG.md');
    execFileSync('node', [VM, 'changelog'], { stdio: 'inherit', cwd: ROOT });
    markStep(st, 4);
  }

  // ---- 5. Changelog i18n (traduzione) ------------------------------------
  if (stepDone(st, 5)) { log.step(5, 'Changelog i18n (già fatto, salto)'); }
  else {
    log.step(5, 'Scrivo changelog in-app in tutte le lingue');
    const tr = await writeChangelogKeys(version, changes, {});
    if (tr.translated) log.ok(`tradotto con ${tr.provider} → ${tr.langs.join(', ')}`);
    else log.warn('changelog i18n: solo italiano (fallback grezzo per le altre lingue).');
    markStep(st, 5);
  }

  // ---- 6. README / guide --------------------------------------------------
  if (stepDone(st, 6)) { log.step(6, 'README/guide (già fatto, salto)'); }
  else {
    log.step(6, 'Aggiorno README, versione guide e PROJECT_STATUS');
    try { execFileSync('node', [AGENT, 'fix'], { stdio: 'inherit', cwd: ROOT }); }
    catch { log.warn('senior-versioning-agent fix ha segnalato problemi (non bloccante).'); }
    bumpProjectStatus(version);
    markStep(st, 6);
  }

  // ---- 7. Sito ------------------------------------------------------------
  if (stepDone(st, 7)) { log.step(7, 'Sito (già fatto, salto)'); }
  else {
    log.step(7, 'Aggiorno versione nel sito (docs/sito)');
    bumpSiteVersion(version);
    markStep(st, 7);
  }

  // ---- 8. Commit + tag + push --------------------------------------------
  // Idempotente per costruzione: ogni sotto-passo CONTROLLA prima di agire,
  // così un crash a metà (l'index.lock del 06/08 è morto proprio qui) si
  // riprende rilanciando, senza commit doppi né tag duplicati.
  if (stepDone(st, 8)) { log.step(8, 'Commit, tag e push (già fatto, salto)'); }
  else {
    log.step(8, 'Commit, tag e push');
    if (shOut('git status --porcelain')) {
      sh('git add -A');
      sh(`git commit -m "chore(release): v${version}"`);
    } else {
      log.info('working tree pulito: commit già fatto in un run precedente, non lo ripeto.');
    }
    sh(`git push origin ${branch}`);
    const tagLocal = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/v${version}`], { cwd: ROOT }).status === 0;
    if (!tagLocal) sh(`git tag v${version} -m "Release v${version}"`);
    else log.info(`tag v${version} già esistente in locale, non lo ricreo.`);
    sh(`git push origin v${version}`);
    log.ok(`commit + tag v${version} pushati`);
    markStep(st, 8);
  }

  // ---- 9. Dispatch build pubblica ----------------------------------------
  if (stepDone(st, 9)) { log.step(9, 'Dispatch build (già fatto, salto)'); }
  else if (args.noPublish) {
    log.step(9, 'Pubblicazione saltata (--no-publish)');
    log.info(`Per pubblicare quando vuoi:\n      gh workflow run release.yml -f version=v${version} -f create_release=true`);
    markStep(st, 9);
  } else {
    log.step(9, 'Lancio build & publish multi-OS (release.yml)');
    sh(`gh workflow run release.yml -f version=v${version} -f create_release=true`);
    log.ok('workflow dispatchato');
    markStep(st, 9);
    try {
      execSync('sleep 4');
      const runId = shOut('gh run list --workflow=release.yml -L 1 --json databaseId -q ".[0].databaseId"');
      const url = shOut(`gh run view ${runId} --json url -q ".url"`);
      log.info(`run: ${url}`);
      log.info(`segui con:  gh run watch ${runId} --exit-status`);
    } catch { log.warn('Non sono riuscito a recuperare l\'URL del run (controlla con `gh run list`).'); }
  }

  // Release completata: lo stato ha finito il suo lavoro.
  clearState();
  log.ok('stato di ripresa rimosso (.release-state.json)');

  printVerify(version, args);
}

function bumpSiteVersion(version) {
  const siteDir = path.join(ROOT, 'docs', 'sito');
  if (!fs.existsSync(siteDir)) { log.info('docs/sito assente, salto.'); return; }
  let touched = 0;
  const files = fs.readdirSync(siteDir).filter((f) => /\.(html|js|json)$/.test(f));
  for (const f of files) {
    const p = path.join(siteDir, f);
    let txt = fs.readFileSync(p, 'utf8');
    const before = txt;
    // Sostituisce pattern di versione "vX.Y.Z" o "version": "X.Y.Z" / data-version
    txt = txt.replace(/v\d+\.\d+\.\d+/g, `v${version}`);
    txt = txt.replace(/("version"\s*:\s*")\d+\.\d+\.\d+(")/g, `$1${version}$2`);
    txt = txt.replace(/(data-version=")\d+\.\d+\.\d+(")/g, `$1${version}$2`);
    if (txt !== before) { fs.writeFileSync(p, txt); touched++; }
  }
  if (touched) log.ok(`sito: versione aggiornata in ${touched} file (deploy automatico via deploy-site.yml al push)`);
  else log.info('sito: nessun riferimento di versione trovato da aggiornare.');
}

function bumpProjectStatus(version) {
  // Stampa versione e data correnti in docs/PROJECT_STATUS.md, così il file
  // non invecchia più (prima era fermo alla versione di aprile).
  const p = path.join(ROOT, 'docs', 'PROJECT_STATUS.md');
  if (!fs.existsSync(p)) { log.info('docs/PROJECT_STATUS.md assente, salto.'); return; }
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  let txt = fs.readFileSync(p, 'utf8');
  const before = txt;
  // Tocca SOLO le righe marcate, non eventuali versioni storiche citate nel testo.
  txt = txt.replace(/(\*\*Versione corrente:\s*)v\d+\.\d+\.\d+(\*\*)/g, `$1v${version}$2`);
  txt = txt.replace(/(Ultimo rilascio:\s*\*?\*?)\d{2}\/\d{2}\/\d{4}/g, `$1${today}`);
  if (txt !== before) { fs.writeFileSync(p, txt); log.ok(`PROJECT_STATUS.md → v${version} (${today})`); }
  else log.info('PROJECT_STATUS.md: nessun riferimento da aggiornare.');
}

function printVerify(version, args) {
  console.log(`\n${C.b}${C.grn}━━ Fatto ━━${C.r}`);
  if (args.dryRun) { console.log('Dry-run: rilancia senza --dry-run per eseguire davvero.'); return; }
  console.log(`Verifica post-release (2 min):`);
  console.log(`  gh release view v${version}`);
  console.log(`  gh release download v${version} -p latest.json -O -   ${C.dim}# 4 piattaforme con signature non vuota${C.r}`);
  console.log(`  ${C.dim}poi testa l'auto-update da una copia installata.${C.r}`);
  console.log(`\n${C.yel}🛡️  Anti falsi-positivi (5 min, entro poche ore):${C.r}`);
  console.log(`  npm run av:checklist   ${C.dim}# asset + passi submission Microsoft (docs/DEFENDER_SUBMISSION.md)${C.r}`);
}

main().catch((e) => { console.error(`\n${C.red}Errore:${C.r} ${e.stack || e.message}`); process.exit(1); });
