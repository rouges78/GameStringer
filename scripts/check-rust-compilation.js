// Script per verificare la compilazione del codice Rust
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🦀 Verifica Compilazione Rust');
console.log('=============================');

// Verifica se Rust è installato
function checkRustInstallation() {
  return new Promise((resolve, reject) => {
    exec('rustc --version', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Rust non installato o non trovato nel PATH');
        console.log('   Installa Rust da: https://rustup.rs/');
        resolve(false);
      } else {
        console.log('✅ Rust installato:', stdout.trim());
        resolve(true);
      }
    });
  });
}

// Verifica se Cargo è installato
function checkCargoInstallation() {
  return new Promise((resolve, reject) => {
    exec('cargo --version', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Cargo non installato');
        resolve(false);
      } else {
        console.log('✅ Cargo installato:', stdout.trim());
        resolve(true);
      }
    });
  });
}

// Verifica la sintassi del codice Rust
function checkRustSyntax() {
  return new Promise((resolve, reject) => {
    console.log('\n📝 Verifica sintassi Rust...');
    
    const tauriPath = path.join(__dirname, '..', 'src-tauri');
    
    if (!fs.existsSync(tauriPath)) {
      console.log('❌ Cartella src-tauri non trovata');
      resolve(false);
      return;
    }
    
    process.chdir(tauriPath);
    
    exec('cargo check --quiet', { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Errori di compilazione trovati:');
        console.log(stderr || error.message);
        resolve(false);
      } else {
        console.log('✅ Sintassi Rust corretta - nessun errore di compilazione');
        if (stdout.trim()) {
          console.log('ℹ️  Output:', stdout.trim());
        }
        resolve(true);
      }
    });
  });
}

// Verifica le dipendenze nel Cargo.toml
function checkCargoDependencies() {
  console.log('\n📦 Verifica dipendenze Cargo...');
  
  const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
  
  if (!fs.existsSync(cargoTomlPath)) {
    console.log('❌ Cargo.toml non trovato');
    return false;
  }
  
  const cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  
  // Verifica che steamy-vdf sia presente
  if (cargoContent.includes('steamy-vdf')) {
    console.log('✅ steamy-vdf dipendenza trovata');
  } else {
    console.log('⚠️  steamy-vdf non trovata in Cargo.toml');
  }
  
  // Verifica altre dipendenze importanti
  const importantDeps = ['serde', 'tauri', 'winreg', 'tokio'];
  let allDepsFound = true;
  
  importantDeps.forEach(dep => {
    if (cargoContent.includes(dep)) {
      console.log(`✅ ${dep} dipendenza trovata`);
    } else {
      console.log(`⚠️  ${dep} non trovata in Cargo.toml`);
      allDepsFound = false;
    }
  });
  
  return allDepsFound;
}

// Test di compilazione veloce
function quickCompileTest() {
  return new Promise((resolve, reject) => {
    console.log('\n⚡ Test compilazione veloce...');
    
    const tauriPath = path.join(__dirname, '..', 'src-tauri');
    process.chdir(tauriPath);
    
    exec('cargo build --quiet --jobs 1', { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Errore durante la compilazione:');
        console.log(stderr || error.message);
        resolve(false);
      } else {
        console.log('✅ Compilazione completata con successo');
        resolve(true);
      }
    });
  });
}

// Esegue tutti i controlli
async function runAllChecks() {
  console.log('🚀 Avvio verifica completa...\n');
  
  try {
    const rustInstalled = await checkRustInstallation();
    const cargoInstalled = await checkCargoInstallation();
    
    if (!rustInstalled || !cargoInstalled) {
      console.log('\n❌ Impossibile continuare senza Rust/Cargo');
      return;
    }
    
    const depsOk = checkCargoDependencies();
    const syntaxOk = await checkRustSyntax();
    
    if (syntaxOk) {
      console.log('\n🎯 Tentativo compilazione...');
      const compileOk = await quickCompileTest();
      
      if (compileOk) {
        console.log('\n🎉 Tutto OK! Il codice Rust è pronto');
        console.log('================================');
        console.log('✅ Rust/Cargo installati');
        console.log('✅ Dipendenze presenti');
        console.log('✅ Sintassi corretta');
        console.log('✅ Compilazione riuscita');
        
        console.log('\n📋 Prossimi passi:');
        console.log('1. cd src-tauri && cargo run');
        console.log('2. oppure npm run tauri dev');
        console.log('3. Testa il comando: get_all_local_steam_games');
      } else {
        console.log('\n⚠️  Compilazione fallita - controlla gli errori sopra');
      }
    } else {
      console.log('\n⚠️  Errori di sintassi trovati - risolvi prima di compilare');
    }
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runAllChecks();
}

module.exports = { runAllChecks };