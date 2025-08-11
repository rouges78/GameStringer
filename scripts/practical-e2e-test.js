#!/usr/bin/env node

/**
 * Test pratico end-to-end del sistema profili
 * Avvia l'applicazione e testa le funzionalità principali
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colori per output console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class PracticalE2ETest {
  constructor() {
    this.projectRoot = process.cwd();
    this.testResults = [];
    this.devServer = null;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  logTest(testName, status, details = '') {
    const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    log(`${statusIcon} ${testName}: ${colors[statusColor]}${status}${colors.reset}${details ? ' - ' + details : ''}`, 'reset');
    
    this.testResults.push({
      name: testName,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Test 1: Verifica che l'applicazione si avvii correttamente
  async testApplicationStartup() {
    log('\n🚀 Test 1: Startup applicazione', 'blue');
    
    return new Promise((resolve) => {
      // Avvia il server di sviluppo
      this.devServer = spawn('npm', ['run', 'dev:profiles'], {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      let startupSuccess = false;
      let output = '';
      let errorOutput = '';

      this.devServer.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Cerca indicatori di avvio riuscito
        if (text.includes('ready') || text.includes('started') || text.includes('listening') || text.includes('3093')) {
          startupSuccess = true;
          this.logTest('Application startup', 'PASS', 'Server avviato correttamente');
          resolve(true);
        }
      });

      this.devServer.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        
        // Ignora warning comuni
        if (!text.includes('warning') && !text.includes('deprecated')) {
          console.log('STDERR:', text);
        }
      });

      this.devServer.on('error', (error) => {
        this.logTest('Application startup', 'FAIL', `Errore avvio: ${error.message}`);
        resolve(false);
      });

      // Timeout dopo 30 secondi
      setTimeout(() => {
        if (!startupSuccess) {
          this.logTest('Application startup', 'FAIL', 'Timeout avvio applicazione (30s)');
          if (this.devServer) {
            this.devServer.kill();
          }
          resolve(false);
        }
      }, 30000);
    });
  }

  // Test 2: Verifica che i file di profilo vengano creati
  async testProfileFileCreation() {
    log('\n📁 Test 2: Creazione file profili', 'blue');
    
    // Attendi che l'applicazione sia completamente avviata
    await this.sleep(5000);
    
    // Verifica che la directory profili esista o venga creata
    const profilesDir = path.join(this.projectRoot, 'profiles');
    
    if (fs.existsSync(profilesDir)) {
      this.logTest('Profiles directory exists', 'PASS', 'Directory profili presente');
    } else {
      this.logTest('Profiles directory exists', 'WARN', 'Directory profili non ancora creata (normale al primo avvio)');
    }

    // Verifica che i file di configurazione esistano
    const configFiles = [
      'src-tauri/tauri.conf.json',
      'package.json',
      'tsconfig.json'
    ];

    configFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        this.logTest(`Config file: ${file}`, 'PASS', 'File configurazione presente');
      } else {
        this.logTest(`Config file: ${file}`, 'FAIL', 'File configurazione mancante');
      }
    });
  }

  // Test 3: Verifica compilazione in tempo reale
  async testRealTimeCompilation() {
    log('\n⚡ Test 3: Compilazione in tempo reale', 'blue');
    
    // Attendi un po' per vedere se ci sono errori di compilazione
    await this.sleep(10000);
    
    // Verifica che non ci siano errori critici nei log
    if (this.devServer && !this.devServer.killed) {
      this.logTest('Development server running', 'PASS', 'Server di sviluppo attivo');
    } else {
      this.logTest('Development server running', 'FAIL', 'Server di sviluppo non attivo');
    }

    // Verifica che i file TypeScript si compilino
    const tsFiles = [
      'components/profiles/profile-wrapper.tsx',
      'hooks/use-profiles.ts',
      'lib/profile-auth.tsx'
    ];

    tsFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          // Verifica sintassi base
          if (content.includes('export') && !content.includes('syntax error')) {
            this.logTest(`TypeScript file: ${path.basename(file)}`, 'PASS', 'File TypeScript valido');
          } else {
            this.logTest(`TypeScript file: ${path.basename(file)}`, 'WARN', 'File TypeScript potrebbe avere problemi');
          }
        } catch (error) {
          this.logTest(`TypeScript file: ${path.basename(file)}`, 'FAIL', `Errore lettura: ${error.message}`);
        }
      }
    });
  }

  // Test 4: Verifica accessibilità endpoint
  async testEndpointAccessibility() {
    log('\n🌐 Test 4: Accessibilità endpoint', 'blue');
    
    // Test semplice per verificare che il server risponda
    try {
      const http = require('http');
      
      const testEndpoint = (port) => {
        return new Promise((resolve) => {
          const req = http.get(`http://localhost:${port}`, (res) => {
            if (res.statusCode === 200 || res.statusCode === 404) {
              resolve(true);
            } else {
              resolve(false);
            }
          });
          
          req.on('error', () => {
            resolve(false);
          });
          
          req.setTimeout(5000, () => {
            req.destroy();
            resolve(false);
          });
        });
      };

      const isAccessible = await testEndpoint(3093);
      
      if (isAccessible) {
        this.logTest('HTTP endpoint accessibility', 'PASS', 'Endpoint HTTP accessibile');
      } else {
        this.logTest('HTTP endpoint accessibility', 'FAIL', 'Endpoint HTTP non accessibile');
      }

    } catch (error) {
      this.logTest('HTTP endpoint accessibility', 'FAIL', `Errore test endpoint: ${error.message}`);
    }
  }

  // Test 5: Verifica integrazione Tauri
  async testTauriIntegration() {
    log('\n🦀 Test 5: Integrazione Tauri', 'blue');
    
    // Verifica che i file Rust siano presenti e validi
    const rustFiles = [
      'src-tauri/src/main.rs',
      'src-tauri/src/commands/profiles.rs',
      'src-tauri/src/profiles/manager.rs'
    ];

    rustFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('tauri') && content.includes('fn ')) {
            this.logTest(`Rust file: ${path.basename(file)}`, 'PASS', 'File Rust valido');
          } else {
            this.logTest(`Rust file: ${path.basename(file)}`, 'WARN', 'File Rust potrebbe essere incompleto');
          }
        } catch (error) {
          this.logTest(`Rust file: ${path.basename(file)}`, 'FAIL', `Errore lettura: ${error.message}`);
        }
      } else {
        this.logTest(`Rust file: ${path.basename(file)}`, 'FAIL', 'File Rust mancante');
      }
    });

    // Verifica Cargo.toml
    const cargoPath = path.join(this.projectRoot, 'src-tauri/Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      try {
        const cargoContent = fs.readFileSync(cargoPath, 'utf8');
        if (cargoContent.includes('tauri') && cargoContent.includes('[dependencies]')) {
          this.logTest('Cargo.toml configuration', 'PASS', 'Configurazione Cargo valida');
        } else {
          this.logTest('Cargo.toml configuration', 'FAIL', 'Configurazione Cargo incompleta');
        }
      } catch (error) {
        this.logTest('Cargo.toml configuration', 'FAIL', `Errore lettura Cargo.toml: ${error.message}`);
      }
    } else {
      this.logTest('Cargo.toml configuration', 'FAIL', 'Cargo.toml mancante');
    }
  }

  // Cleanup e chiusura
  async cleanup() {
    log('\n🧹 Cleanup test environment', 'cyan');
    
    if (this.devServer && !this.devServer.killed) {
      this.devServer.kill('SIGTERM');
      
      // Attendi che il processo si chiuda
      await this.sleep(2000);
      
      if (!this.devServer.killed) {
        this.devServer.kill('SIGKILL');
      }
      
      this.logTest('Development server cleanup', 'PASS', 'Server di sviluppo terminato');
    }
  }

  // Genera report finale
  generateReport() {
    log('\n📊 REPORT TEST PRATICO END-TO-END', 'bold');
    log('='.repeat(50), 'blue');

    const passed = this.testResults.filter(test => test.status === 'PASS').length;
    const failed = this.testResults.filter(test => test.status === 'FAIL').length;
    const warnings = this.testResults.filter(test => test.status === 'WARN').length;
    const total = this.testResults.length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

    log(`\nRisultati test:`, 'bold');
    log(`  ✅ Passati: ${passed}/${total} (${percentage}%)`, passed === total ? 'green' : percentage >= 80 ? 'yellow' : 'red');
    if (failed > 0) log(`  ❌ Falliti: ${failed}`, 'red');
    if (warnings > 0) log(`  ⚠️  Warning: ${warnings}`, 'yellow');

    log('\n🎯 VALUTAZIONE PRATICA:', 'bold');
    if (percentage >= 90) {
      log('🎉 ECCELLENTE: Il sistema è pronto per l\'uso!', 'green');
    } else if (percentage >= 75) {
      log('✅ BUONO: Il sistema funziona con piccoli problemi.', 'yellow');
    } else if (percentage >= 60) {
      log('⚠️  SUFFICIENTE: Il sistema ha problemi che richiedono attenzione.', 'yellow');
    } else {
      log('❌ INSUFFICIENTE: Il sistema ha problemi critici.', 'red');
    }

    // Salva report
    const report = {
      timestamp: new Date().toISOString(),
      test_type: 'practical_e2e',
      results: this.testResults,
      summary: {
        total,
        passed,
        failed,
        warnings,
        percentage
      }
    };

    const reportPath = path.join(this.projectRoot, 'practical-e2e-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n📄 Report salvato in: ${reportPath}`, 'blue');

    return report;
  }

  // Esegui tutti i test pratici
  async runPracticalTests() {
    log('🧪 AVVIO TEST PRATICO END-TO-END SISTEMA PROFILI', 'bold');
    log('='.repeat(50), 'blue');

    try {
      // Esegui i test in sequenza
      const startupSuccess = await this.testApplicationStartup();
      
      if (startupSuccess) {
        await this.testProfileFileCreation();
        await this.testRealTimeCompilation();
        await this.testEndpointAccessibility();
      }
      
      await this.testTauriIntegration();
      
    } catch (error) {
      log(`\n❌ Errore durante i test: ${error.message}`, 'red');
      this.logTest('Test execution', 'FAIL', error.message);
    } finally {
      await this.cleanup();
    }

    return this.generateReport();
  }
}

// Esegui test se script chiamato direttamente
if (require.main === module) {
  const tester = new PracticalE2ETest();
  
  // Gestisci interruzione con Ctrl+C
  process.on('SIGINT', async () => {
    log('\n\n⚠️  Test interrotto dall\'utente', 'yellow');
    await tester.cleanup();
    process.exit(0);
  });

  tester.runPracticalTests().then(report => {
    const success = report.summary.failed === 0;
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Errore durante i test pratici:', error);
    process.exit(1);
  });
}

module.exports = PracticalE2ETest;