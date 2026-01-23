#!/usr/bin/env node

/**
 * 🤖 Senior Versioning Agent
 * 
 * Agente automatico per controllo e aggiornamento di:
 * - CHANGELOG.md
 * - README.md / README_IT.md
 * - docs/GUIDE.md / docs/GUIDE_IT.md
 * - GitHub Release Notes
 * 
 * Uso: node scripts/senior-versioning-agent.js [comando]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colori ANSI per output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
  section: (msg) => console.log(`\n${colors.magenta}▶${colors.reset} ${colors.bright}${msg}${colors.reset}`),
};

class SeniorVersioningAgent {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.files = {
      version: path.join(this.rootDir, 'version.json'),
      package: path.join(this.rootDir, 'package.json'),
      changelog: path.join(this.rootDir, 'CHANGELOG.md'),
      readme: path.join(this.rootDir, 'README.md'),
      readmeIt: path.join(this.rootDir, 'README_IT.md'),
      guide: path.join(this.rootDir, 'docs/GUIDE.md'),
      guideIt: path.join(this.rootDir, 'docs/GUIDE_IT.md'),
      cargoToml: path.join(this.rootDir, 'src-tauri/Cargo.toml'),
      tauriConf: path.join(this.rootDir, 'src-tauri/tauri.conf.json'),
    };
    
    this.issues = [];
    this.suggestions = [];
    this.currentVersion = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CARICAMENTO DATI
  // ═══════════════════════════════════════════════════════════════════

  loadVersion() {
    try {
      const data = JSON.parse(fs.readFileSync(this.files.version, 'utf8'));
      this.currentVersion = data.version;
      return data;
    } catch (error) {
      log.error(`Impossibile leggere version.json: ${error.message}`);
      return null;
    }
  }

  loadFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  getGitInfo() {
    try {
      const lastCommit = execSync('git log -1 --pretty=format:"%h - %s (%cr)"', { encoding: 'utf8' }).trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      const uncommitted = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
      const tags = execSync('git tag --sort=-version:refname | head -5', { encoding: 'utf8', shell: true }).trim().split('\n');
      
      return {
        lastCommit,
        branch,
        hasUncommitted: uncommitted.length > 0,
        uncommittedFiles: uncommitted.split('\n').filter(f => f),
        recentTags: tags.filter(t => t),
      };
    } catch (error) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANALISI DOCUMENTI
  // ═══════════════════════════════════════════════════════════════════

  analyzeChangelog() {
    log.section('Analisi CHANGELOG.md');
    
    const content = this.loadFile(this.files.changelog);
    if (!content) {
      this.issues.push({ type: 'error', file: 'CHANGELOG.md', msg: 'File non trovato' });
      return;
    }

    // Estrai versione dal changelog
    const versionMatch = content.match(/###\s+v?([\d.]+)/);
    const changelogVersion = versionMatch ? versionMatch[1] : null;

    // Estrai versione dalle statistiche
    const statsVersionMatch = content.match(/\*\*Versione attuale\*\*\s*\|\s*([\d.]+)/);
    const statsVersion = statsVersionMatch ? statsVersionMatch[1] : null;

    // Controlla sincronizzazione
    if (changelogVersion !== this.currentVersion) {
      this.issues.push({
        type: 'warning',
        file: 'CHANGELOG.md',
        msg: `Ultima versione nel changelog (${changelogVersion}) diversa da version.json (${this.currentVersion})`,
      });
      this.suggestions.push({
        file: 'CHANGELOG.md',
        action: 'Aggiungere entry per la versione corrente',
      });
    } else {
      log.success(`Versione sincronizzata: ${changelogVersion}`);
    }

    if (statsVersion && statsVersion !== this.currentVersion) {
      this.issues.push({
        type: 'error',
        file: 'CHANGELOG.md',
        msg: `Statistiche mostrano versione ${statsVersion}, dovrebbe essere ${this.currentVersion}`,
        fix: 'updateChangelogStats',
      });
    }

    // Controlla data ultima modifica
    const dateMatch = content.match(/>\s*\*\*Data\*\*:\s*([\d-]+)/);
    if (dateMatch) {
      const lastDate = new Date(dateMatch[1]);
      const daysSince = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
      if (daysSince > 7) {
        log.info(`Ultimo aggiornamento: ${daysSince} giorni fa`);
      }
    }

    // Conta sezioni
    const sections = (content.match(/^### /gm) || []).length;
    log.info(`Sezioni versione trovate: ${sections}`);
  }

  analyzeReadme() {
    log.section('Analisi README.md');
    
    const content = this.loadFile(this.files.readme);
    if (!content) {
      this.issues.push({ type: 'error', file: 'README.md', msg: 'File non trovato' });
      return;
    }

    // Estrai versioni dai badge
    const badgeVersionMatch = content.match(/badge\/version-([\d.]+)/);
    const badgeVersion = badgeVersionMatch ? badgeVersionMatch[1] : null;

    if (badgeVersion && badgeVersion !== this.currentVersion) {
      this.issues.push({
        type: 'error',
        file: 'README.md',
        msg: `Badge versione (${badgeVersion}) non sincronizzato con ${this.currentVersion}`,
        fix: 'updateReadmeBadges',
      });
    } else if (badgeVersion) {
      log.success(`Badge versione sincronizzato: ${badgeVersion}`);
    }

    // Estrai versione footer
    const footerVersionMatch = content.match(/GameStringer v([\d.]+)/);
    const footerVersion = footerVersionMatch ? footerVersionMatch[1] : null;

    if (footerVersion && footerVersion !== this.currentVersion) {
      this.issues.push({
        type: 'warning',
        file: 'README.md',
        msg: `Footer versione (${footerVersion}) non aggiornato`,
        fix: 'updateReadmeFooter',
      });
    }

    // Controlla sezioni essenziali
    const requiredSections = ['Features', 'Download', 'Quick Start', 'Support'];
    for (const section of requiredSections) {
      if (!content.includes(`## ${section}`) && !content.includes(`## ✨ ${section}`)) {
        this.issues.push({
          type: 'info',
          file: 'README.md',
          msg: `Sezione "${section}" potrebbe mancare o avere nome diverso`,
        });
      }
    }

    log.info(`Lunghezza README: ${content.length} caratteri`);
  }

  analyzeGuide() {
    log.section('Analisi GUIDE.md');
    
    const content = this.loadFile(this.files.guide);
    if (!content) {
      this.issues.push({ type: 'warning', file: 'docs/GUIDE.md', msg: 'File non trovato' });
      return;
    }

    // Estrai versione header
    const versionMatch = content.match(/\*\*Version\*\*:\s*([\d.]+)/);
    const guideVersion = versionMatch ? versionMatch[1] : null;

    if (guideVersion && guideVersion !== this.currentVersion) {
      this.issues.push({
        type: 'error',
        file: 'docs/GUIDE.md',
        msg: `Versione guida (${guideVersion}) non sincronizzata con ${this.currentVersion}`,
        fix: 'updateGuideVersion',
      });
    } else if (guideVersion) {
      log.success(`Versione guida sincronizzata: ${guideVersion}`);
    }

    // Estrai versione footer
    const footerMatch = content.match(/GameStringer v([\d.]+)/);
    const footerVersion = footerMatch ? footerMatch[1] : null;

    if (footerVersion && footerVersion !== this.currentVersion) {
      this.issues.push({
        type: 'warning',
        file: 'docs/GUIDE.md',
        msg: `Footer guida (${footerVersion}) non aggiornato`,
        fix: 'updateGuideFooter',
      });
    }

    // Controlla "Last Updated"
    const lastUpdatedMatch = content.match(/\*\*Last Updated\*\*:\s*(\w+\s+\d{4})/);
    if (lastUpdatedMatch) {
      log.info(`Ultimo aggiornamento dichiarato: ${lastUpdatedMatch[1]}`);
    }

    // Conta sezioni principali
    const h2Sections = (content.match(/^## /gm) || []).length;
    log.info(`Sezioni principali: ${h2Sections}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // FIX AUTOMATICI
  // ═══════════════════════════════════════════════════════════════════

  updateChangelogStats() {
    const content = this.loadFile(this.files.changelog);
    if (!content) return false;

    const updated = content.replace(
      /\*\*Versione attuale\*\*\s*\|\s*[\d.]+/,
      `**Versione attuale** | ${this.currentVersion}`
    );

    if (updated !== content) {
      fs.writeFileSync(this.files.changelog, updated);
      log.success('CHANGELOG.md: statistiche aggiornate');
      return true;
    }
    return false;
  }

  updateReadmeBadges() {
    const content = this.loadFile(this.files.readme);
    if (!content) return false;

    const updated = content.replace(
      /badge\/version-[\d.]+-blue/g,
      `badge/version-${this.currentVersion}-blue`
    );

    if (updated !== content) {
      fs.writeFileSync(this.files.readme, updated);
      log.success('README.md: badge versione aggiornato');
      return true;
    }
    return false;
  }

  updateReadmeFooter() {
    const content = this.loadFile(this.files.readme);
    if (!content) return false;

    const updated = content.replace(
      /GameStringer v[\d.]+/g,
      `GameStringer v${this.currentVersion}`
    );

    if (updated !== content) {
      fs.writeFileSync(this.files.readme, updated);
      log.success('README.md: footer aggiornato');
      return true;
    }
    return false;
  }

  updateGuideVersion() {
    const content = this.loadFile(this.files.guide);
    if (!content) return false;

    let updated = content.replace(
      /\*\*Version\*\*:\s*[\d.]+/,
      `**Version**: ${this.currentVersion}`
    );

    if (updated !== content) {
      fs.writeFileSync(this.files.guide, updated);
      log.success('GUIDE.md: versione header aggiornata');
      return true;
    }
    return false;
  }

  updateGuideFooter() {
    const content = this.loadFile(this.files.guide);
    if (!content) return false;

    const updated = content.replace(
      /GameStringer v[\d.]+/g,
      `GameStringer v${this.currentVersion}`
    );

    if (updated !== content) {
      fs.writeFileSync(this.files.guide, updated);
      log.success('GUIDE.md: footer aggiornato');
      return true;
    }
    return false;
  }

  updateAllVersionReferences() {
    log.section('Aggiornamento automatico versioni');
    
    let fixed = 0;
    
    if (this.updateChangelogStats()) fixed++;
    if (this.updateReadmeBadges()) fixed++;
    if (this.updateReadmeFooter()) fixed++;
    if (this.updateGuideVersion()) fixed++;
    if (this.updateGuideFooter()) fixed++;

    // Aggiorna anche README_IT se esiste
    const readmeIt = this.loadFile(this.files.readmeIt);
    if (readmeIt) {
      let updated = readmeIt.replace(/badge\/version-[\d.]+-blue/g, `badge/version-${this.currentVersion}-blue`);
      updated = updated.replace(/GameStringer v[\d.]+/g, `GameStringer v${this.currentVersion}`);
      if (updated !== readmeIt) {
        fs.writeFileSync(this.files.readmeIt, updated);
        log.success('README_IT.md: aggiornato');
        fixed++;
      }
    }

    // Aggiorna GUIDE_IT se esiste
    const guideIt = this.loadFile(this.files.guideIt);
    if (guideIt) {
      let updated = guideIt.replace(/\*\*Version\*\*:\s*[\d.]+/, `**Version**: ${this.currentVersion}`);
      updated = updated.replace(/GameStringer v[\d.]+/g, `GameStringer v${this.currentVersion}`);
      if (updated !== guideIt) {
        fs.writeFileSync(this.files.guideIt, updated);
        log.success('GUIDE_IT.md: aggiornato');
        fixed++;
      }
    }

    log.info(`\nTotale file aggiornati: ${fixed}`);
    return fixed;
  }

  // ═══════════════════════════════════════════════════════════════════
  // GENERAZIONE RELEASE NOTES
  // ═══════════════════════════════════════════════════════════════════

  generateReleaseNotes(lang = 'en') {
    log.section(`Generazione Release Notes (${lang.toUpperCase()}) per GitHub`);
    
    const changelog = this.loadFile(this.files.changelog);
    if (!changelog) {
      log.error('CHANGELOG.md non trovato');
      return null;
    }

    // Estrai l'ultima sezione di versione
    const versionRegex = new RegExp(
      `### v?${this.currentVersion.replace(/\./g, '\\.')}[^]*?(?=### v?\\d|## 📅|## 📊|$)`,
      'i'
    );
    const match = changelog.match(versionRegex);
    
    if (!match) {
      log.warning(`Sezione per v${this.currentVersion} non trovata nel changelog`);
      return null;
    }

    let releaseContent = match[0].trim();
    
    // Traduzioni per header/footer
    const translations = {
      en: {
        header: `# 🎮 GameStringer v${this.currentVersion}

> Automatic release generated on ${new Date().toISOString().split('T')[0]}

---

## What's New

`,
        download: '## 📥 Download',
        installer: 'Windows Installer',
        portable: 'Portable',
        docs: '## 📖 Documentation',
        readme: 'README',
        guide: 'Complete Guide',
        changelog: 'Changelog',
        support: '## 💖 Support the Project',
        fullChangelog: 'Full Changelog'
      },
      it: {
        header: `# 🎮 GameStringer v${this.currentVersion}

> Release automatica generata il ${new Date().toISOString().split('T')[0]}

---

## Novità

`,
        download: '## 📥 Download',
        installer: 'Windows Installer',
        portable: 'Portable',
        docs: '## 📖 Documentazione',
        readme: 'README',
        guide: 'Guida Completa',
        changelog: 'Changelog',
        support: '## 💖 Supporta il Progetto',
        fullChangelog: 'Changelog Completo'
      }
    };

    const t = translations[lang] || translations.en;

    const footer = `

---

${t.download}

- **${t.installer}**: \`GameStringer-${this.currentVersion}-Setup.exe\`
- **${t.portable}**: \`GameStringer-${this.currentVersion}-Portable.zip\`

${t.docs}

- [${t.readme}](https://github.com/rouges78/GameStringer/blob/main/README.md)
- [${t.guide}](https://github.com/rouges78/GameStringer/blob/main/docs/GUIDE.md)
- [${t.changelog}](https://github.com/rouges78/GameStringer/blob/main/CHANGELOG.md)

${t.support}

- [Ko-fi](https://ko-fi.com/gamestringer)
- [GitHub Sponsors](https://github.com/sponsors/rouges78)

---

**${t.fullChangelog}**: https://github.com/rouges78/GameStringer/compare/v${this.getPreviousVersion()}...v${this.currentVersion}
`;

    const releaseNotes = t.header + releaseContent + footer;

    // Salva file (inglese come default, italiano con suffisso _IT)
    const suffix = lang === 'it' ? '_IT' : '';
    const releaseFile = path.join(this.rootDir, `RELEASE_NOTES_v${this.currentVersion}${suffix}.md`);
    fs.writeFileSync(releaseFile, releaseNotes);
    
    log.success(`Release notes (${lang.toUpperCase()}) salvate: ${releaseFile}`);
    return releaseNotes;
  }

  generateAllReleaseNotes() {
    log.section('Generazione Release Notes Bilingue');
    this.generateReleaseNotes('en');
    this.generateReleaseNotes('it');
    log.success('Release notes generate in EN e IT');
  }

  getPreviousVersion() {
    const [major, minor, patch] = this.currentVersion.split('.').map(Number);
    if (patch > 0) return `${major}.${minor}.${patch - 1}`;
    if (minor > 0) return `${major}.${minor - 1}.0`;
    return `${major - 1}.0.0`;
  }

  // ═══════════════════════════════════════════════════════════════════
  // REPORT COMPLETO
  // ═══════════════════════════════════════════════════════════════════

  runFullAudit() {
    log.header('🤖 SENIOR VERSIONING AGENT - Audit Completo');
    
    // Carica versione
    const versionData = this.loadVersion();
    if (!versionData) return;

    log.info(`Versione corrente: ${colors.bright}${this.currentVersion}${colors.reset}`);
    log.info(`Build: ${versionData.buildNumber}`);
    log.info(`Data build: ${versionData.buildDate}`);

    // Git info
    const gitInfo = this.getGitInfo();
    if (gitInfo) {
      log.section('Stato Git');
      log.info(`Branch: ${gitInfo.branch}`);
      log.info(`Ultimo commit: ${gitInfo.lastCommit}`);
      if (gitInfo.hasUncommitted) {
        log.warning(`File non committati: ${gitInfo.uncommittedFiles.length}`);
      }
      if (gitInfo.recentTags.length > 0) {
        log.info(`Tag recenti: ${gitInfo.recentTags.slice(0, 3).join(', ')}`);
      }
    }

    // Analisi documenti
    this.analyzeChangelog();
    this.analyzeReadme();
    this.analyzeGuide();

    // Report finale
    log.header('📋 REPORT FINALE');

    if (this.issues.length === 0) {
      log.success('Nessun problema rilevato! Documentazione sincronizzata.');
    } else {
      console.log(`\nProblemi trovati: ${this.issues.length}\n`);
      
      const errors = this.issues.filter(i => i.type === 'error');
      const warnings = this.issues.filter(i => i.type === 'warning');
      const infos = this.issues.filter(i => i.type === 'info');

      if (errors.length > 0) {
        console.log(`${colors.red}Errori (${errors.length}):${colors.reset}`);
        errors.forEach(e => console.log(`  ❌ [${e.file}] ${e.msg}`));
      }

      if (warnings.length > 0) {
        console.log(`\n${colors.yellow}Warning (${warnings.length}):${colors.reset}`);
        warnings.forEach(w => console.log(`  ⚠️  [${w.file}] ${w.msg}`));
      }

      if (infos.length > 0) {
        console.log(`\n${colors.blue}Info (${infos.length}):${colors.reset}`);
        infos.forEach(i => console.log(`  ℹ  [${i.file}] ${i.msg}`));
      }

      // Suggerimenti fix
      const fixable = this.issues.filter(i => i.fix);
      if (fixable.length > 0) {
        console.log(`\n${colors.green}Fix automatici disponibili (${fixable.length}):${colors.reset}`);
        console.log('  Esegui: node scripts/senior-versioning-agent.js fix');
      }
    }

    console.log('');
  }

  applyFixes() {
    log.header('🔧 APPLICAZIONE FIX AUTOMATICI');
    
    this.loadVersion();
    const fixed = this.updateAllVersionReferences();
    
    if (fixed > 0) {
      log.success(`\n${fixed} file aggiornati con successo!`);
      log.info('Esegui "git diff" per vedere le modifiche');
    } else {
      log.info('Nessuna modifica necessaria');
    }
  }

  generateGitHubRelease() {
    log.header('📦 PREPARAZIONE RELEASE GITHUB');
    
    this.loadVersion();
    
    // Prima aggiorna tutti i riferimenti versione
    this.updateAllVersionReferences();
    
    // Genera release notes
    const notes = this.generateReleaseNotes();
    
    if (notes) {
      log.section('Comandi Git suggeriti');
      console.log(`
  # Committa le modifiche
  git add -A
  git commit -m "chore: prepare release v${this.currentVersion}"
  
  # Crea tag
  git tag -a v${this.currentVersion} -m "Release v${this.currentVersion}"
  
  # Push
  git push origin main
  git push origin v${this.currentVersion}
  
  # Crea release su GitHub (richiede gh CLI)
  gh release create v${this.currentVersion} --title "v${this.currentVersion}" --notes-file RELEASE_NOTES_v${this.currentVersion}.md
`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // UPLOAD RELEASE SU GITHUB
  // ═══════════════════════════════════════════════════════════════════

  getGhPath() {
    // Prima prova il comando diretto
    try {
      execSync('gh --version', { encoding: 'utf8', stdio: 'pipe' });
      return 'gh';
    } catch {}

    // Su Windows, cerca nei percorsi comuni di installazione
    if (process.platform === 'win32') {
      const commonPaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'GitHub CLI', 'gh.exe'),
        path.join(process.env.ProgramFiles || '', 'GitHub CLI', 'gh.exe'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'GitHub CLI', 'gh.exe'),
        'C:\\Program Files\\GitHub CLI\\gh.exe',
        'C:\\Program Files (x86)\\GitHub CLI\\gh.exe',
      ];
      
      for (const ghPath of commonPaths) {
        if (fs.existsSync(ghPath)) {
          try {
            execSync(`"${ghPath}" --version`, { encoding: 'utf8', stdio: 'pipe' });
            return `"${ghPath}"`;
          } catch {}
        }
      }
    }
    
    return null;
  }

  checkGhCli() {
    this.ghPath = this.getGhPath();
    return this.ghPath !== null;
  }

  checkGhAuth() {
    try {
      execSync(`${this.ghPath} auth status`, { encoding: 'utf8', stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  findReleaseAssets() {
    const assetsDir = path.join(this.rootDir, 'src-tauri', 'target', 'release', 'bundle');
    const assets = [];

    // Cerca installer NSIS
    const nsisDir = path.join(assetsDir, 'nsis');
    if (fs.existsSync(nsisDir)) {
      const files = fs.readdirSync(nsisDir).filter(f => f.endsWith('.exe'));
      files.forEach(f => assets.push(path.join(nsisDir, f)));
    }

    // Cerca MSI
    const msiDir = path.join(assetsDir, 'msi');
    if (fs.existsSync(msiDir)) {
      const files = fs.readdirSync(msiDir).filter(f => f.endsWith('.msi'));
      files.forEach(f => assets.push(path.join(msiDir, f)));
    }

    // Cerca nella root di release per portable
    const releaseDir = path.join(this.rootDir, 'src-tauri', 'target', 'release');
    if (fs.existsSync(releaseDir)) {
      const exeFiles = fs.readdirSync(releaseDir).filter(f => 
        f.toLowerCase().includes('gamestringer') && f.endsWith('.exe')
      );
      exeFiles.forEach(f => {
        const fullPath = path.join(releaseDir, f);
        if (!assets.includes(fullPath)) assets.push(fullPath);
      });
    }

    return assets;
  }

  async uploadRelease(options = {}) {
    log.header('🚀 UPLOAD RELEASE SU GITHUB');
    
    this.loadVersion();
    const tagName = `v${this.currentVersion}`;

    // Verifica gh CLI
    if (!this.checkGhCli()) {
      log.error('GitHub CLI (gh) non installato!');
      log.info('Installa da: https://cli.github.com/');
      log.info('Oppure: winget install GitHub.cli');
      return false;
    }
    log.success('GitHub CLI trovato');

    // Verifica autenticazione
    if (!this.checkGhAuth()) {
      log.error('Non autenticato con GitHub CLI!');
      log.info('Esegui: gh auth login');
      return false;
    }
    log.success('Autenticazione GitHub OK');

    // Verifica se release esiste già
    try {
      execSync(`${this.ghPath} release view ${tagName}`, { encoding: 'utf8', stdio: 'pipe' });
      if (!options.force) {
        log.warning(`Release ${tagName} esiste già!`);
        log.info('Usa --force per sovrascrivere o aggiungere asset');
        return false;
      }
      log.info(`Release ${tagName} esiste, aggiornamento asset...`);
    } catch {
      // Release non esiste, procedi con la creazione
    }

    // Genera release notes se non esistono
    const notesFile = path.join(this.rootDir, `RELEASE_NOTES_${tagName}.md`);
    if (!fs.existsSync(notesFile)) {
      log.info('Generazione release notes...');
      this.generateReleaseNotes();
    }

    // Verifica tag git
    try {
      execSync(`git rev-parse ${tagName}`, { encoding: 'utf8', stdio: 'pipe' });
      log.success(`Tag ${tagName} trovato`);
    } catch {
      log.warning(`Tag ${tagName} non trovato, creazione...`);
      try {
        execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { encoding: 'utf8' });
        log.success(`Tag ${tagName} creato`);
      } catch (err) {
        log.error(`Impossibile creare tag: ${err.message}`);
        return false;
      }
    }

    // Push tag se necessario
    try {
      execSync(`git push origin ${tagName}`, { encoding: 'utf8', stdio: 'pipe' });
      log.success(`Tag ${tagName} pushato su origin`);
    } catch {
      log.info(`Tag ${tagName} già presente su origin o push fallito`);
    }

    // Cerca asset da uploadare
    const assets = this.findReleaseAssets();
    
    // Crea o aggiorna release
    try {
      let releaseExists = false;
      try {
        execSync(`${this.ghPath} release view ${tagName}`, { stdio: 'pipe' });
        releaseExists = true;
      } catch {}

      if (!releaseExists) {
        log.info('Creazione release su GitHub...');
        const createCmd = `${this.ghPath} release create ${tagName} --title "GameStringer ${tagName}" --notes-file "${notesFile}"`;
        execSync(createCmd, { encoding: 'utf8', cwd: this.rootDir });
        log.success(`Release ${tagName} creata!`);
      }

      // Upload asset
      if (assets.length > 0) {
        log.section('Upload Asset');
        for (const asset of assets) {
          const fileName = path.basename(asset);
          log.info(`Uploading: ${fileName}...`);
          try {
            execSync(`${this.ghPath} release upload ${tagName} "${asset}" --clobber`, { 
              encoding: 'utf8', 
              cwd: this.rootDir 
            });
            log.success(`${fileName} caricato`);
          } catch (err) {
            log.warning(`Errore upload ${fileName}: ${err.message}`);
          }
        }
      } else {
        log.warning('Nessun asset trovato da uploadare');
        log.info('Compila prima con: npm run tauri build');
      }

      log.success(`\n🎉 Release ${tagName} pubblicata su GitHub!`);
      log.info(`URL: https://github.com/rouges78/GameStringer/releases/tag/${tagName}`);
      return true;

    } catch (err) {
      log.error(`Errore durante la creazione release: ${err.message}`);
      return false;
    }
  }

  showHelp() {
    console.log(`
${colors.bright}${colors.cyan}🤖 Senior Versioning Agent${colors.reset}

Agente automatico per controllo e aggiornamento documentazione.

${colors.bright}Comandi:${colors.reset}

  ${colors.green}audit${colors.reset}     Esegue audit completo di tutti i documenti
  ${colors.green}fix${colors.reset}       Applica fix automatici per sincronizzare versioni
  ${colors.green}release${colors.reset}   Prepara release GitHub (notes + comandi git)
  ${colors.green}notes${colors.reset}     Genera solo le release notes
  ${colors.green}upload${colors.reset}    Pubblica release su GitHub (crea tag, release, upload asset)
  ${colors.green}help${colors.reset}      Mostra questo messaggio

${colors.bright}Esempi:${colors.reset}

  node scripts/senior-versioning-agent.js audit
  node scripts/senior-versioning-agent.js fix
  node scripts/senior-versioning-agent.js release
  node scripts/senior-versioning-agent.js upload
  node scripts/senior-versioning-agent.js upload --force

${colors.bright}File controllati:${colors.reset}

  • CHANGELOG.md     - Changelog dettagliato
  • README.md        - README principale (EN)
  • README_IT.md     - README italiano
  • docs/GUIDE.md    - Guida completa (EN)
  • docs/GUIDE_IT.md - Guida italiana
  • version.json     - Versione master
  • package.json     - Versione npm
  • Cargo.toml       - Versione Rust
  • tauri.conf.json  - Versione Tauri
`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const agent = new SeniorVersioningAgent();

  const command = args[0] || 'audit';

  switch (command) {
    case 'audit':
    case 'check':
      agent.runFullAudit();
      break;
    case 'fix':
    case 'sync':
      agent.applyFixes();
      break;
    case 'release':
    case 'github':
      agent.generateGitHubRelease();
      break;
    case 'notes':
      agent.loadVersion();
      agent.generateAllReleaseNotes();
      break;
    case 'upload':
    case 'publish':
      agent.uploadRelease({ force: args.includes('--force') });
      break;
    case 'help':
    case '--help':
    case '-h':
      agent.showHelp();
      break;
    default:
      log.error(`Comando sconosciuto: ${command}`);
      agent.showHelp();
      process.exit(1);
  }
}

module.exports = SeniorVersioningAgent;

if (require.main === module) {
  main();
}
