#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ProfilesSetupVerifier {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  log(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = {
      error: '❌',
      warning: '⚠️ ',
      success: '✅',
      info: 'ℹ️ '
    }[type] || 'ℹ️ ';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
    
    if (type === 'error') this.errors.push(message);
    if (type === 'warning') this.warnings.push(message);
    if (type === 'success') this.success.push(message);
  }

  checkFileExists(filePath, description) {
    const fullPath = path.join(this.rootDir, filePath);
    if (fs.existsSync(fullPath)) {
      this.log('success', `${description}: ${filePath}`);
      return true;
    } else {
      this.log('error', `${description} mancante: ${filePath}`);
      return false;
    }
  }

  checkFileContains(filePath, searchText, description) {
    const fullPath = path.join(this.rootDir, filePath);
    if (!fs.existsSync(fullPath)) {
      this.log('error', `File non trovato per verifica ${description}: ${filePath}`);
      return false;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(searchText)) {
        this.log('success', `${description} trovato in ${filePath}`);
        return true;
      } else {
        this.log('error', `${description} non trovato in ${filePath}`);
        return false;
      }
    } catch (error) {
      this.log('error', `Errore lettura ${filePath}: ${error.message}`);
      return false;
    }
  }

  async verifyRustBackend() {
    this.log('info', '🦀 Verifica backend Rust...');

    // Verifica file principali
    this.checkFileExists('src-tauri/src/profiles/mod.rs', 'Modulo profili Rust');
    this.checkFileExists('src-tauri/src/profiles/models.rs', 'Modelli dati profili');
    this.checkFileExists('src-tauri/src/profiles/storage.rs', 'Sistema storage profili');
    this.checkFileExists('src-tauri/src/profiles/manager.rs', 'ProfileManager');
    this.checkFileExists('src-tauri/src/profiles/encryption.rs', 'Sistema crittografia');
    this.checkFileExists('src-tauri/src/commands/profiles.rs', 'Comandi Tauri profili');

    // Verifica integrazione in main.rs
    this.checkFileContains('src-tauri/src/main.rs', 'ProfileManagerState', 'ProfileManagerState in main.rs');
    this.checkFileContains('src-tauri/src/main.rs', 'commands::profiles::', 'Comandi profili registrati');
    this.checkFileContains('src-tauri/src/main.rs', 'list_profiles', 'Comando list_profiles');
    this.checkFileContains('src-tauri/src/main.rs', 'create_profile', 'Comando create_profile');
    this.checkFileContains('src-tauri/src/main.rs', 'authenticate_profile', 'Comando authenticate_profile');

    // Verifica Cargo.toml dependencies
    this.checkFileContains('src-tauri/Cargo.toml', 'serde', 'Dipendenza serde');
    this.checkFileContains('src-tauri/Cargo.toml', 'tokio', 'Dipendenza tokio');
  }

  async verifyFrontend() {
    this.log('info', '⚛️  Verifica frontend React...');

    // Verifica componenti principali
    this.checkFileExists('components/profiles/profile-selector.tsx', 'ProfileSelector component');
    this.checkFileExists('components/profiles/create-profile-dialog.tsx', 'CreateProfileDialog component');
    this.checkFileExists('components/profiles/profile-manager.tsx', 'ProfileManager component');
    this.checkFileExists('components/profiles/profile-wrapper.tsx', 'ProfileWrapper component');
    this.checkFileExists('components/auth/protected-route.tsx', 'ProtectedRoute component');

    // Verifica hooks
    this.checkFileExists('hooks/use-profiles.ts', 'useProfiles hook');
    this.checkFileExists('hooks/use-profile-settings.ts', 'useProfileSettings hook');
    this.checkFileExists('lib/profile-auth.tsx', 'ProfileAuth provider');

    // Verifica integrazione in layout
    this.checkFileContains('app/layout.tsx', 'ProfileWrapper', 'ProfileWrapper in layout.tsx');

    // Verifica types
    this.checkFileExists('types/profiles.ts', 'Types profili TypeScript');
  }

  async verifyConfiguration() {
    this.log('info', '⚙️  Verifica configurazione...');

    // Verifica tauri.conf.json
    const tauriConfigPath = path.join(this.rootDir, 'src-tauri', 'tauri.conf.json');
    if (fs.existsSync(tauriConfigPath)) {
      try {
        const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
        if (tauriConfig.build && tauriConfig.build.devUrl) {
          this.log('success', `Tauri devUrl configurato: ${tauriConfig.build.devUrl}`);
        } else {
          this.log('error', 'Tauri devUrl non configurato');
        }
      } catch (error) {
        this.log('error', `Errore parsing tauri.conf.json: ${error.message}`);
      }
    }

    // Verifica package.json scripts
    const packageJsonPath = path.join(this.rootDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.scripts && packageJson.scripts['dev:profiles']) {
          this.log('success', 'Script dev:profiles configurato');
        } else {
          this.log('warning', 'Script dev:profiles non trovato');
        }
      } catch (error) {
        this.log('error', `Errore parsing package.json: ${error.message}`);
      }
    }

    // Verifica port manager
    this.checkFileExists('scripts/port-manager.js', 'Port Manager');
    this.checkFileExists('scripts/unified-dev-with-profiles.js', 'Script sviluppo unificato');
  }

  async verifyDependencies() {
    this.log('info', '📦 Verifica dipendenze...');

    // Verifica node_modules critici
    const criticalDeps = [
      '@tauri-apps/api',
      '@tauri-apps/cli',
      'next',
      'react',
      'typescript'
    ];

    for (const dep of criticalDeps) {
      const depPath = path.join(this.rootDir, 'node_modules', dep);
      if (fs.existsSync(depPath)) {
        this.log('success', `Dipendenza ${dep} installata`);
      } else {
        this.log('error', `Dipendenza ${dep} mancante`);
      }
    }
  }

  async verifyMigrationSystem() {
    this.log('info', '🔄 Verifica sistema migrazione...');

    this.checkFileExists('src-tauri/src/commands/migration.rs', 'Comandi migrazione');
    this.checkFileExists('components/profiles/migration-wizard.tsx', 'Migration Wizard UI');
    this.checkFileContains('src-tauri/src/main.rs', 'migration_wizard', 'Comando migration_wizard');
  }

  async run() {
    console.log('🔍 === VERIFICA SETUP SISTEMA PROFILI ===\n');

    await this.verifyRustBackend();
    console.log('');
    
    await this.verifyFrontend();
    console.log('');
    
    await this.verifyConfiguration();
    console.log('');
    
    await this.verifyDependencies();
    console.log('');
    
    await this.verifyMigrationSystem();
    console.log('');

    // Riepilogo finale
    console.log('📊 === RIEPILOGO VERIFICA ===');
    console.log(`✅ Successi: ${this.success.length}`);
    console.log(`⚠️  Warning: ${this.warnings.length}`);
    console.log(`❌ Errori: ${this.errors.length}`);

    if (this.errors.length === 0) {
      console.log('\n🎉 SISTEMA PROFILI COMPLETAMENTE CONFIGURATO!');
      console.log('🚀 Puoi avviare con: npm run dev:profiles');
      return true;
    } else {
      console.log('\n❌ ERRORI TROVATI:');
      this.errors.forEach(error => console.log(`   • ${error}`));
      
      if (this.warnings.length > 0) {
        console.log('\n⚠️  WARNING:');
        this.warnings.forEach(warning => console.log(`   • ${warning}`));
      }
      
      console.log('\n🔧 Risolvi gli errori prima di avviare l\'applicazione.');
      return false;
    }
  }
}

// CLI
async function main() {
  const verifier = new ProfilesSetupVerifier();
  const success = await verifier.run();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = ProfilesSetupVerifier;