#!/usr/bin/env node

/**
 * Script interattivo per guidare i test manuali del sistema profili
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Colori per output console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class ManualTestGuide {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.testResults = [];
    this.currentTest = 0;
  }

  async askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim().toLowerCase());
      });
    });
  }

  async waitForEnter(message = 'Premi ENTER per continuare...') {
    return new Promise((resolve) => {
      this.rl.question(`${colors.cyan}${message}${colors.reset}`, () => {
        resolve();
      });
    });
  }

  async runTest1() {
    log('\n🚀 TEST 1: Flusso Startup → Selezione Profilo → Uso App', 'bold');
    log('=' .repeat(60), 'blue');
    
    log('\n📋 Obiettivo: Verificare il flusso completo dall\'avvio all\'uso normale', 'yellow');
    
    await this.waitForEnter('\n1. Assicurati che l\'app sia chiusa completamente, poi avviala...');
    
    const step1 = await this.askQuestion('✅ L\'app mostra la schermata di selezione/creazione profilo? (s/n): ');
    
    if (step1 === 's') {
      log('✅ Step 1.1 PASS - Schermata profili mostrata correttamente', 'green');
      
      await this.waitForEnter('\n2. Se non hai profili, clicca "Crea Nuovo Profilo"...');
      const step2 = await this.askQuestion('✅ Si apre il dialog di creazione profilo con form? (s/n): ');
      
      if (step2 === 's') {
        log('✅ Step 1.2 PASS - Dialog creazione profilo funziona', 'green');
        
        await this.waitForEnter('\n3. Compila il form (nome: "TestUser1", password: "test123")...');
        const step3 = await this.askQuestion('✅ La validazione funziona in tempo reale? (s/n): ');
        
        if (step3 === 's') {
          log('✅ Step 1.3 PASS - Validazione form funziona', 'green');
          
          await this.waitForEnter('\n4. Clicca "Crea Profilo"...');
          const step4 = await this.askQuestion('✅ Il profilo viene creato e sei autenticato automaticamente? (s/n): ');
          
          if (step4 === 's') {
            log('✅ Step 1.4 PASS - Creazione e autenticazione automatica', 'green');
            
            await this.waitForEnter('\n5. Osserva l\'interfaccia principale...');
            const step5 = await this.askQuestion('✅ L\'header mostra il nome del profilo attivo? (s/n): ');
            
            if (step5 === 's') {
              log('✅ Step 1.5 PASS - Interfaccia principale corretta', 'green');
              this.testResults.push({ name: 'Test 1 - Flusso Startup', result: 'PASS', details: 'Tutti gli step completati' });
              return true;
            }
          }
        }
      }
    }
    
    log('❌ Test 1 FAIL - Uno o più step non sono passati', 'red');
    this.testResults.push({ name: 'Test 1 - Flusso Startup', result: 'FAIL', details: 'Problemi nel flusso' });
    return false;
  }

  async runTest2() {
    log('\n🔄 TEST 2: Cambio Profilo Durante Utilizzo', 'bold');
    log('=' .repeat(60), 'blue');
    
    log('\n📋 Obiettivo: Verificare il cambio profilo durante l\'uso dell\'app', 'yellow');
    
    await this.waitForEnter('\n1. Assicurati di avere almeno 2 profili. Se necessario, crea "TestUser2"...');
    
    const step1 = await this.askQuestion('✅ Hai almeno 2 profili disponibili? (s/n): ');
    
    if (step1 === 's') {
      await this.waitForEnter('\n2. Clicca sull\'avatar/nome profilo nell\'header...');
      const step2 = await this.askQuestion('✅ Si apre un menu con opzioni profilo? (s/n): ');
      
      if (step2 === 's') {
        log('✅ Step 2.1 PASS - Menu profilo accessibile', 'green');
        
        await this.waitForEnter('\n3. Clicca "Cambia Profilo"...');
        const step3 = await this.askQuestion('✅ Torna alla schermata selezione profili? (s/n): ');
        
        if (step3 === 's') {
          log('✅ Step 2.2 PASS - Cambio profilo avviato', 'green');
          
          await this.waitForEnter('\n4. Seleziona un profilo diverso...');
          const step4 = await this.askQuestion('✅ Richiede la password per l\'autenticazione? (s/n): ');
          
          if (step4 === 's') {
            log('✅ Step 2.3 PASS - Richiesta autenticazione', 'green');
            
            await this.waitForEnter('\n5. Inserisci la password corretta...');
            const step5 = await this.askQuestion('✅ L\'autenticazione riesce e l\'header mostra il nuovo profilo? (s/n): ');
            
            if (step5 === 's') {
              log('✅ Step 2.4 PASS - Cambio profilo completato', 'green');
              this.testResults.push({ name: 'Test 2 - Cambio Profilo', result: 'PASS', details: 'Cambio profilo funziona' });
              return true;
            }
          }
        }
      }
    }
    
    log('❌ Test 2 FAIL - Problemi nel cambio profilo', 'red');
    this.testResults.push({ name: 'Test 2 - Cambio Profilo', result: 'FAIL', details: 'Problemi nel flusso' });
    return false;
  }

  async runTest3() {
    log('\n💾 TEST 3: Persistenza Dati Tra Sessioni', 'bold');
    log('=' .repeat(60), 'blue');
    
    log('\n📋 Obiettivo: Verificare che i dati persistano tra le sessioni', 'yellow');
    
    await this.waitForEnter('\n1. Vai in Settings e cambia il tema da "dark" a "light"...');
    const step1 = await this.askQuestion('✅ Il tema cambia immediatamente nell\'interfaccia? (s/n): ');
    
    if (step1 === 's') {
      log('✅ Step 3.1 PASS - Cambio tema funziona', 'green');
      
      await this.waitForEnter('\n2. Fai logout completo dal menu profilo...');
      const step2 = await this.askQuestion('✅ Torni alla schermata selezione profili? (s/n): ');
      
      if (step2 === 's') {
        log('✅ Step 3.2 PASS - Logout funziona', 'green');
        
        await this.waitForEnter('\n3. Chiudi completamente l\'app e riaprila...');
        const step3 = await this.askQuestion('✅ L\'app si riapre con la schermata selezione profili? (s/n): ');
        
        if (step3 === 's') {
          log('✅ Step 3.3 PASS - Riavvio app corretto', 'green');
          
          await this.waitForEnter('\n4. Ri-autentica con lo stesso profilo di prima...');
          const step4 = await this.askQuestion('✅ L\'autenticazione funziona? (s/n): ');
          
          if (step4 === 's') {
            log('✅ Step 3.4 PASS - Re-autenticazione funziona', 'green');
            
            await this.waitForEnter('\n5. Controlla se il tema è ancora "light"...');
            const step5 = await this.askQuestion('✅ Il tema "light" è stato mantenuto? (s/n): ');
            
            if (step5 === 's') {
              log('✅ Step 3.5 PASS - Persistenza impostazioni', 'green');
              this.testResults.push({ name: 'Test 3 - Persistenza Dati', result: 'PASS', details: 'Dati persistono correttamente' });
              return true;
            }
          }
        }
      }
    }
    
    log('❌ Test 3 FAIL - Problemi nella persistenza', 'red');
    this.testResults.push({ name: 'Test 3 - Persistenza Dati', result: 'FAIL', details: 'Dati non persistono' });
    return false;
  }

  async runTest4() {
    log('\n🔒 TEST 4: Sicurezza e Isolamento', 'bold');
    log('=' .repeat(60), 'blue');
    
    log('\n📋 Obiettivo: Verificare sicurezza e isolamento tra profili', 'yellow');
    
    await this.waitForEnter('\n1. Cambia a un profilo diverso...');
    const step1 = await this.askQuestion('✅ Il nuovo profilo non vede i dati del precedente? (s/n): ');
    
    if (step1 === 's') {
      log('✅ Step 4.1 PASS - Isolamento dati funziona', 'green');
      
      await this.waitForEnter('\n2. Fai logout e prova ad accedere con password sbagliata...');
      const step2 = await this.askQuestion('✅ Viene mostrato un errore di autenticazione? (s/n): ');
      
      if (step2 === 's') {
        log('✅ Step 4.2 PASS - Protezione password funziona', 'green');
        this.testResults.push({ name: 'Test 4 - Sicurezza', result: 'PASS', details: 'Sicurezza e isolamento OK' });
        return true;
      }
    }
    
    log('❌ Test 4 FAIL - Problemi di sicurezza', 'red');
    this.testResults.push({ name: 'Test 4 - Sicurezza', result: 'FAIL', details: 'Problemi sicurezza/isolamento' });
    return false;
  }

  generateReport() {
    log('\n📊 REPORT FINALE TEST MANUALI', 'bold');
    log('=' .repeat(50), 'blue');

    let passed = 0;
    let failed = 0;

    this.testResults.forEach(result => {
      const icon = result.result === 'PASS' ? '✅' : '❌';
      const color = result.result === 'PASS' ? 'green' : 'red';
      log(`${icon} ${result.name}: ${result.result}`, color);
      if (result.details) {
        log(`   ${result.details}`, 'cyan');
      }
      
      if (result.result === 'PASS') passed++;
      else failed++;
    });

    const total = passed + failed;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

    log('\n' + '=' .repeat(50), 'blue');
    log(`RISULTATO: ${passed}/${total} test passati (${percentage}%)`, percentage === 100 ? 'green' : percentage >= 75 ? 'yellow' : 'red');

    if (percentage === 100) {
      log('🎉 Tutti i test manuali sono passati! Sistema pronto.', 'green');
    } else if (percentage >= 75) {
      log('⚠️  La maggior parte dei test è passata, ma ci sono problemi da risolvere.', 'yellow');
    } else {
      log('❌ Ci sono problemi significativi che richiedono attenzione.', 'red');
    }

    // Salva report
    const reportData = {
      timestamp: new Date().toISOString(),
      results: this.testResults,
      summary: { passed, failed, total, percentage }
    };

    const reportPath = path.join(process.cwd(), 'manual-test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    log(`\n📄 Report salvato in: ${reportPath}`, 'blue');

    return { passed, failed, total, percentage };
  }

  async runAllTests() {
    log('🧪 GUIDA TEST MANUALI SISTEMA PROFILI', 'bold');
    log('=' .repeat(50), 'blue');
    log('\nQuesta guida ti accompagnerà attraverso i test manuali end-to-end.', 'cyan');
    log('Rispondi con "s" per sì, "n" per no, o "q" per uscire.\n', 'yellow');

    await this.waitForEnter('Premi ENTER per iniziare...');

    try {
      await this.runTest1();
      await this.runTest2();
      await this.runTest3();
      await this.runTest4();

      const report = this.generateReport();
      return report;

    } catch (error) {
      log(`\n❌ Errore durante i test: ${error.message}`, 'red');
      return { passed: 0, failed: 1, total: 1, percentage: 0 };
    } finally {
      this.rl.close();
    }
  }
}

// Esegui i test se lo script viene chiamato direttamente
if (require.main === module) {
  const guide = new ManualTestGuide();
  guide.runAllTests().then(report => {
    process.exit(report.percentage === 100 ? 0 : 1);
  }).catch(error => {
    console.error('Errore durante l\'esecuzione dei test manuali:', error);
    process.exit(1);
  });
}

module.exports = ManualTestGuide;