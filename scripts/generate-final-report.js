#!/usr/bin/env node

/**
 * Genera report finale combinando test automatizzati e manuali
 */

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

class FinalReportGenerator {
  constructor() {
    this.projectRoot = process.cwd();
  }

  loadTestResults() {
    const results = {
      automated: null,
      manual: null
    };

    // Carica risultati test automatizzati
    const automatedPath = path.join(this.projectRoot, 'test-results-profiles-integration.json');
    if (fs.existsSync(automatedPath)) {
      try {
        results.automated = JSON.parse(fs.readFileSync(automatedPath, 'utf8'));
      } catch (error) {
        log(`⚠️  Errore caricamento test automatizzati: ${error.message}`, 'yellow');
      }
    }

    // Carica risultati test manuali
    const manualPath = path.join(this.projectRoot, 'manual-test-results.json');
    if (fs.existsSync(manualPath)) {
      try {
        results.manual = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
      } catch (error) {
        log(`⚠️  Errore caricamento test manuali: ${error.message}`, 'yellow');
      }
    }

    return results;
  }

  generateReport() {
    const results = this.loadTestResults();
    
    log('\n🎯 REPORT FINALE - TASK 11.3 TEST INTEGRAZIONE END-TO-END', 'bold');
    log('=' .repeat(70), 'blue');
    
    // Sezione test automatizzati
    log('\n🤖 TEST AUTOMATIZZATI', 'bold');
    log('-' .repeat(30), 'cyan');
    
    if (results.automated) {
      const auto = results.automated.summary;
      log(`✅ Passati: ${auto.passed}/${auto.total} (${auto.percentage}%)`, auto.percentage === 100 ? 'green' : 'yellow');
      
      if (results.automated.results) {
        results.automated.results.forEach(category => {
          const percentage = category.total > 0 ? Math.round((category.passed / category.total) * 100) : 0;
          const icon = percentage === 100 ? '✅' : percentage >= 80 ? '⚠️' : '❌';
          log(`  ${icon} ${category.name}: ${category.passed}/${category.total} (${percentage}%)`, 
              percentage === 100 ? 'green' : percentage >= 80 ? 'yellow' : 'red');
        });
      }
    } else {
      log('❌ Risultati test automatizzati non trovati', 'red');
      log('   Esegui: node scripts/test-profiles-integration.js', 'cyan');
    }

    // Sezione test manuali
    log('\n👤 TEST MANUALI', 'bold');
    log('-' .repeat(30), 'cyan');
    
    if (results.manual) {
      const manual = results.manual.summary;
      log(`✅ Passati: ${manual.passed}/${manual.total} (${manual.percentage}%)`, manual.percentage === 100 ? 'green' : 'yellow');
      
      if (results.manual.results) {
        results.manual.results.forEach(test => {
          const icon = test.result === 'PASS' ? '✅' : '❌';
          const color = test.result === 'PASS' ? 'green' : 'red';
          log(`  ${icon} ${test.name}: ${test.result}`, color);
          if (test.details) {
            log(`     ${test.details}`, 'cyan');
          }
        });
      }
    } else {
      log('⚠️  Risultati test manuali non trovati', 'yellow');
      log('   Esegui: node scripts/run-manual-tests.js', 'cyan');
    }

    // Calcolo risultato complessivo
    log('\n📊 RISULTATO COMPLESSIVO', 'bold');
    log('=' .repeat(40), 'blue');

    let overallScore = 0;
    let maxScore = 0;

    if (results.automated) {
      overallScore += results.automated.summary.percentage;
      maxScore += 100;
    }

    if (results.manual) {
      overallScore += results.manual.summary.percentage;
      maxScore += 100;
    }

    if (maxScore > 0) {
      const finalPercentage = Math.round(overallScore / (maxScore / 100));
      const status = finalPercentage === 100 ? 'ECCELLENTE' : 
                   finalPercentage >= 90 ? 'OTTIMO' :
                   finalPercentage >= 80 ? 'BUONO' :
                   finalPercentage >= 70 ? 'SUFFICIENTE' : 'INSUFFICIENTE';
      
      const color = finalPercentage === 100 ? 'green' :
                   finalPercentage >= 90 ? 'green' :
                   finalPercentage >= 80 ? 'yellow' :
                   finalPercentage >= 70 ? 'yellow' : 'red';

      log(`🎯 PUNTEGGIO FINALE: ${finalPercentage}% - ${status}`, color);

      // Raccomandazioni
      log('\n💡 RACCOMANDAZIONI', 'bold');
      log('-' .repeat(20), 'cyan');

      if (finalPercentage === 100) {
        log('🎉 Perfetto! Il sistema profili è completamente funzionante.', 'green');
        log('✅ Task 11.3 completato con successo.', 'green');
        log('🚀 Il sistema è pronto per la produzione.', 'green');
      } else if (finalPercentage >= 90) {
        log('👍 Ottimo lavoro! Il sistema è quasi perfetto.', 'green');
        log('🔧 Risolvi i piccoli problemi rimanenti.', 'yellow');
        log('✅ Task 11.3 sostanzialmente completato.', 'green');
      } else if (finalPercentage >= 80) {
        log('⚠️  Il sistema funziona bene ma ha alcuni problemi.', 'yellow');
        log('🔧 Risolvi i problemi identificati prima del rilascio.', 'yellow');
        log('📋 Task 11.3 parzialmente completato.', 'yellow');
      } else {
        log('❌ Il sistema ha problemi significativi.', 'red');
        log('🚨 Richiede interventi importanti prima del rilascio.', 'red');
        log('📋 Task 11.3 non completato.', 'red');
      }

      // Prossimi passi
      log('\n🎯 PROSSIMI PASSI', 'bold');
      log('-' .repeat(20), 'cyan');

      if (!results.automated) {
        log('1. Esegui test automatizzati: node scripts/test-profiles-integration.js', 'yellow');
      }
      
      if (!results.manual) {
        log('2. Esegui test manuali: node scripts/run-manual-tests.js', 'yellow');
      }

      if (finalPercentage < 100) {
        log('3. Risolvi i problemi identificati nei test', 'yellow');
        log('4. Ri-esegui i test dopo le correzioni', 'yellow');
      }

      if (finalPercentage >= 90) {
        log('5. Procedi con Task 12 - Documentazione e deployment', 'green');
      }

    } else {
      log('❌ Nessun risultato di test disponibile', 'red');
      log('Esegui prima i test automatizzati e manuali.', 'yellow');
    }

    // Salva report finale
    const finalReport = {
      timestamp: new Date().toISOString(),
      task: '11.3 - Test Integrazione End-to-End',
      automated: results.automated,
      manual: results.manual,
      summary: {
        overallScore: maxScore > 0 ? Math.round(overallScore / (maxScore / 100)) : 0,
        status: maxScore > 0 ? (overallScore / (maxScore / 100) >= 90 ? 'COMPLETED' : 'PARTIAL') : 'NOT_STARTED'
      }
    };

    const reportPath = path.join(this.projectRoot, 'TASK_11_3_FINAL_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    
    log(`\n📄 Report finale salvato in: ${reportPath}`, 'blue');
    
    return finalReport;
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  const generator = new FinalReportGenerator();
  const report = generator.generateReport();
  
  // Exit code basato sul risultato
  const success = report.summary.overallScore >= 90;
  process.exit(success ? 0 : 1);
}

module.exports = FinalReportGenerator;