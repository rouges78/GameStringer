#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class VersionManager {
  constructor() {
    this.versionFile = path.join(__dirname, '../version.json');
    this.packageFile = path.join(__dirname, '../package.json');
    this.cargoFile = path.join(__dirname, '../src-tauri/Cargo.toml');
    this.tauriConfFile = path.join(__dirname, '../src-tauri/tauri.conf.json');
    this.version = this.loadVersion();
  }

  loadVersion() {
    try {
      return JSON.parse(fs.readFileSync(this.versionFile, 'utf8'));
    } catch (error) {
      console.error('Errore caricamento version.json:', error.message);
      process.exit(1);
    }
  }

  saveVersion() {
    try {
      fs.writeFileSync(this.versionFile, JSON.stringify(this.version, null, 2));
      console.log(`✅ Version salvata: ${this.version.version}`);
    } catch (error) {
      console.error('Errore salvataggio version.json:', error.message);
      process.exit(1);
    }
  }

  updatePackageJson() {
    try {
      const pkg = JSON.parse(fs.readFileSync(this.packageFile, 'utf8'));
      pkg.version = this.version.version;
      fs.writeFileSync(this.packageFile, JSON.stringify(pkg, null, 2));
      console.log(`✅ package.json aggiornato: ${this.version.version}`);
    } catch (error) {
      console.warn('⚠️  package.json non trovato o non aggiornabile');
    }
  }

  updateCargoToml() {
    try {
      let cargo = fs.readFileSync(this.cargoFile, 'utf8');
      // Versione senza suffisso -beta per Cargo (semver puro)
      const semver = `${this.version.major}.${this.version.minor}.${this.version.patch}`;
      cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${semver}"`);
      fs.writeFileSync(this.cargoFile, cargo);
      console.log(`✅ Cargo.toml aggiornato: ${semver}`);
    } catch (error) {
      console.warn('⚠️  Cargo.toml non trovato o non aggiornabile:', error.message);
    }
  }

  updateTauriConf() {
    try {
      const conf = JSON.parse(fs.readFileSync(this.tauriConfFile, 'utf8'));
      // Versione senza suffisso -beta per Tauri
      const semver = `${this.version.major}.${this.version.minor}.${this.version.patch}`;
      conf.version = semver;
      fs.writeFileSync(this.tauriConfFile, JSON.stringify(conf, null, 2));
      console.log(`✅ tauri.conf.json aggiornato: ${semver}`);
    } catch (error) {
      console.warn('⚠️  tauri.conf.json non trovato o non aggiornabile:', error.message);
    }
  }

  syncAllVersions() {
    console.log('\n🔄 Sincronizzazione versioni...\n');
    this.saveVersion();
    this.updatePackageJson();
    this.updateCargoToml();
    this.updateTauriConf();
    console.log(`\n✨ Tutte le versioni sincronizzate a ${this.version.version}\n`);
  }

  getGitInfo() {
    try {
      const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      return { gitHash, branch };
    } catch (error) {
      console.warn('⚠️  Git info non disponibile');
      return { gitHash: 'unknown', branch: 'unknown' };
    }
  }

  incrementPatch(changelog = []) {
    this.version.patch += 1;
    this.updateMetadata('patch', changelog);
    console.log(`🔧 PATCH: ${this.version.version}`);
  }

  incrementMinor(changelog = []) {
    this.version.minor += 1;
    this.version.patch = 0;
    this.updateMetadata('minor', changelog);
    console.log(`🚀 MINOR: ${this.version.version}`);
  }

  incrementMajor(changelog = []) {
    this.version.major += 1;
    this.version.minor = 0;
    this.version.patch = 0;
    this.updateMetadata('major', changelog);
    console.log(`💥 MAJOR: ${this.version.version}`);
  }

  incrementBuild() {
    this.version.buildNumber += 1;
    this.updateMetadata('build');
    console.log(`🔨 BUILD: ${this.version.version}.${this.version.buildNumber}`);
  }

  updateMetadata(type, changelog = []) {
    this.version.version = `${this.version.major}.${this.version.minor}.${this.version.patch}`;
    this.version.buildDate = new Date().toISOString();
    
    const gitInfo = this.getGitInfo();
    this.version.gitHash = gitInfo.gitHash;
    this.version.branch = gitInfo.branch;

    // Aggiorna changelog solo per versioni vere (non build)
    if (type !== 'build' && changelog.length > 0) {
      if (!this.version.changelog) {
        this.version.changelog = {};
      }
      
      this.version.changelog[this.version.version] = {
        date: new Date().toISOString().split('T')[0],
        type: type,
        changes: changelog
      };
    }
  }

  generateChangelog() {
    if (!this.version.changelog) return '';

    let markdown = '# GameStringer Changelog\n\n';
    
    // Ordina versioni per data (più recenti prima)
    const sortedVersions = Object.entries(this.version.changelog)
      .sort(([,a], [,b]) => new Date(b.date) - new Date(a.date));

    for (const [version, info] of sortedVersions) {
      const typeIcon = {
        major: '💥',
        minor: '🚀', 
        patch: '🔧'
      };

      markdown += `## ${typeIcon[info.type] || '📝'} v${version} - ${info.date}\n\n`;
      
      for (const change of info.changes) {
        markdown += `- ${change}\n`;
      }
      markdown += '\n';
    }

    return markdown;
  }

  saveChangelog() {
    const changelog = this.generateChangelog();
    const changelogFile = path.join(__dirname, '../CHANGELOG.md');
    fs.writeFileSync(changelogFile, changelog);
    console.log('✅ CHANGELOG.md generato');
  }

  createGitTag() {
    try {
      const tag = `v${this.version.version}`;
      execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: 'inherit' });
      console.log(`🏷️  Git tag creato: ${tag}`);
    } catch (error) {
      console.warn('⚠️  Impossibile creare git tag:', error.message);
    }
  }

  showStatus() {
    console.log('\n📋 GameStringer Version Status:');
    console.log(`   Version: ${this.version.version}`);
    console.log(`   Build: ${this.version.buildNumber}`);
    console.log(`   Date: ${this.version.buildDate}`);
    console.log(`   Git: ${this.version.gitHash} (${this.version.branch})`);
    
    if (this.version.changelog && this.version.changelog[this.version.version]) {
      console.log('\n📝 Last Changes:');
      this.version.changelog[this.version.version].changes.forEach(change => {
        console.log(`   - ${change}`);
      });
    }
    console.log('');
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const vm = new VersionManager();

  if (args.length === 0) {
    vm.showStatus();
    return;
  }

  const command = args[0];
  const changelog = args.slice(1);

  switch (command) {
    case 'patch':
      vm.incrementPatch(changelog);
      break;
    case 'minor':
      vm.incrementMinor(changelog);
      break;
    case 'major':
      vm.incrementMajor(changelog);
      break;
    case 'build':
      vm.incrementBuild();
      break;
    case 'changelog':
      vm.saveChangelog();
      return;
    case 'tag':
      vm.createGitTag();
      return;
    case 'status':
      vm.showStatus();
      return;
    case 'sync':
      vm.syncAllVersions();
      return;
    default:
      console.log(`
🚀 GameStringer Version Manager

Usage:
  node scripts/version-manager.js [command] [changelog...]

Commands:
  status           - Mostra stato corrente
  sync             - Sincronizza tutte le versioni (package.json, Cargo.toml, tauri.conf.json)
  patch [changes]  - Incrementa patch version (bug fixes)
  minor [changes]  - Incrementa minor version (new features)  
  major [changes]  - Incrementa major version (breaking changes)
  build           - Incrementa solo build number
  changelog       - Genera CHANGELOG.md
  tag             - Crea git tag per la versione corrente

Examples:
  node scripts/version-manager.js patch "Fixed Steam API bug" "Updated UI colors"
  node scripts/version-manager.js minor "Added debug tools" "New settings page"
  node scripts/version-manager.js major "Complete rewrite" "New architecture"
      `);
      return;
  }

  vm.syncAllVersions();
}

module.exports = VersionManager;

if (require.main === module) {
  main();
}