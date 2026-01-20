#!/usr/bin/env node

/**
 * Script di test automatizzato per l'integrazione del sistema profili
 * Testa i flussi principali end-to-end
 */

const fs = require('fs');
const path = require('path');

// Colori per output console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  log(`${statusIcon} ${testName}: ${colors[statusColor]}${status}${colors.reset}${details ? ' - ' + details : ''}`, 'reset');
}

class ProfilesIntegrationTester {
  constructor() {
    this.testResults = [];
    this.projectRoot = process.cwd();
  }

  // Test 1: Verifica struttura file sistema profili
  testFileStructure() {
    log('\n🔍 Test 1: Verifica struttura file sistema profili', 'blue');
    
    const requiredFiles = [
      'components/profiles/profile-wrapper.tsx',
      'components/profiles/profile-selector.tsx',
      'components/profiles/create-profile-dialog.tsx',
      'components/auth/protected-route.tsx',
      'lib/profile-auth.tsx',
      'hooks/use-profiles.ts',
      'types/profiles.ts',
      'src-tauri/src/profiles/manager.rs',
      'src-tauri/src/profiles/models.rs',
      'src-tauri/src/profiles/encryption.rs'
    ];

    let passed = 0;
    let failed = 0;

    requiredFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        logTest(`File ${file}`, 'PASS');
        passed++;
      } else {
        logTest(`File ${file}`, 'FAIL', 'File mancante');
        failed++;
      }
    });

    this.testResults.push({
      name: 'File Structure',
      passed,
      failed,
      total: requiredFiles.length
    });
  }

  // Test 2: Verifica configurazione layout
  testLayoutIntegration() {
    log('\n🔍 Test 2: Verifica integrazione layout', 'blue');
    
    try {
      const layoutPath = path.join(this.projectRoot, 'app/layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');
      
      const checks = [
        { name: 'ProfileWrapper import', pattern: /import.*ProfileWrapper.*from.*profile-wrapper/ },
        { name: 'ProfileWrapper usage', pattern: /<ProfileWrapper>/ },
        { name: 'ThemeProvider integration', pattern: /<ThemeProvider/ },
        { name: 'ErrorBoundary integration', pattern: /<ErrorBoundary/ }
      ];

      let passed = 0;
      let failed = 0;

      checks.forEach(check => {
        if (check.pattern.test(layoutContent)) {
          logTest(`Layout ${check.name}`, 'PASS');
          passed++;
        } else {
          logTest(`Layout ${check.name}`, 'FAIL', 'Pattern non trovato');
          failed++;
        }
      });

      this.testResults.push({
        name: 'Layout Integration',
        passed,
        failed,
        total: checks.length
      });

    } catch (error) {
      logTest('Layout Integration', 'FAIL', `Errore lettura file: ${error.message}`);
      this.testResults.push({
        name: 'Layout Integration',
        passed: 0,
        failed: 1,
        total: 1
      });
    }
  }

  // Test 3: Verifica componenti profili
  testProfileComponents() {
    log('\n🔍 Test 3: Verifica componenti profili', 'blue');
    
    const components = [
      {
        file: 'components/profiles/profile-selector.tsx',
        checks: [
          { name: 'ProfileSelector export', pattern: /export.*ProfileSelector/ },
          { name: 'onProfileSelected prop', pattern: /onProfileSelected/ },
          { name: 'onCreateProfile prop', pattern: /onCreateProfile/ }
        ]
      },
      {
        file: 'components/profiles/create-profile-dialog.tsx',
        checks: [
          { name: 'CreateProfileDialog export', pattern: /export.*CreateProfileDialog/ },
          { name: 'Form validation', pattern: /validation|validate/ },
          { name: 'Password input', pattern: /password|Password/ }
        ]
      },
      {
        file: 'components/auth/protected-route.tsx',
        checks: [
          { name: 'ProtectedRoute export', pattern: /export.*ProtectedRoute/ },
          { name: 'useProfileAuth hook', pattern: /useProfileAuth/ },
          { name: 'Authentication check', pattern: /isAuthenticated/ }
        ]
      }
    ];

    let totalPassed = 0;
    let totalFailed = 0;
    let totalChecks = 0;

    components.forEach(component => {
      try {
        const filePath = path.join(this.projectRoot, component.file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        component.checks.forEach(check => {
          totalChecks++;
          if (check.pattern.test(content)) {
            logTest(`${path.basename(component.file)} - ${check.name}`, 'PASS');
            totalPassed++;
          } else {
            logTest(`${path.basename(component.file)} - ${check.name}`, 'FAIL');
            totalFailed++;
          }
        });

      } catch (error) {
        component.checks.forEach(check => {
          totalChecks++;
          logTest(`${path.basename(component.file)} - ${check.name}`, 'FAIL', 'File non leggibile');
          totalFailed++;
        });
      }
    });

    this.testResults.push({
      name: 'Profile Components',
      passed: totalPassed,
      failed: totalFailed,
      total: totalChecks
    });
  }

  // Test 4: Verifica backend Rust
  testRustBackend() {
    log('\n🔍 Test 4: Verifica backend Rust', 'blue');
    
    const rustFiles = [
      {
        file: 'src-tauri/src/profiles/manager.rs',
        checks: [
          { name: 'ProfileManager struct', pattern: /pub struct ProfileManager/ },
          { name: 'create_profile method', pattern: /pub.*fn.*create_profile/ },
          { name: 'authenticate_profile method', pattern: /pub.*fn.*authenticate_profile/ }
        ]
      },
      {
        file: 'src-tauri/src/profiles/models.rs',
        checks: [
          { name: 'UserProfile struct', pattern: /pub struct UserProfile/ },
          { name: 'Serialization support', pattern: /#\[derive.*Serialize/ },
          { name: 'ProfileSettings struct', pattern: /pub struct ProfileSettings/ }
        ]
      },
      {
        file: 'src-tauri/src/commands/profiles.rs',
        checks: [
          { name: 'Tauri commands', pattern: /(#\[tauri::command\]|tauri::\{command|#\[command\])/ },
          { name: 'list_profiles command', pattern: /fn.*list_profiles/ },
          { name: 'create_profile command', pattern: /fn.*create_profile/ }
        ]
      }
    ];

    let totalPassed = 0;
    let totalFailed = 0;
    let totalChecks = 0;

    rustFiles.forEach(rustFile => {
      try {
        const filePath = path.join(this.projectRoot, rustFile.file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        rustFile.checks.forEach(check => {
          totalChecks++;
          if (check.pattern.test(content)) {
            logTest(`${path.basename(rustFile.file)} - ${check.name}`, 'PASS');
            totalPassed++;
          } else {
            logTest(`${path.basename(rustFile.file)} - ${check.name}`, 'FAIL');
            totalFailed++;
          }
        });

      } catch (error) {
        rustFile.checks.forEach(check => {
          totalChecks++;
          logTest(`${path.basename(rustFile.file)} - ${check.name}`, 'FAIL', 'File non leggibile');
          totalFailed++;
        });
      }
    });

    this.testResults.push({
      name: 'Rust Backend',
      passed: totalPassed,
      failed: totalFailed,
      total: totalChecks
    });
  }

  // Test 5: Verifica configurazione routing
  testRoutingConfiguration() {
    log('\n🔍 Test 5: Verifica configurazione routing', 'blue');
    
    try {
      const routeConfigPath = path.join(this.projectRoot, 'lib/route-config.ts');
      const middlewarePath = path.join(this.projectRoot, 'middleware.ts');
      
      let passed = 0;
      let failed = 0;
      let total = 0;

      // Test route-config.ts
      if (fs.existsSync(routeConfigPath)) {
        const routeConfigContent = fs.readFileSync(routeConfigPath, 'utf8');
        const routeChecks = [
          { name: 'RouteConfig interface', pattern: /interface RouteConfig/ },
          { name: 'routes array', pattern: /export const routes/ },
          { name: 'isProtectedRoute function', pattern: /export const isProtectedRoute/ }
        ];

        routeChecks.forEach(check => {
          total++;
          if (check.pattern.test(routeConfigContent)) {
            logTest(`route-config.ts - ${check.name}`, 'PASS');
            passed++;
          } else {
            logTest(`route-config.ts - ${check.name}`, 'FAIL');
            failed++;
          }
        });
      } else {
        total++;
        logTest('route-config.ts', 'FAIL', 'File mancante');
        failed++;
      }

      // Test middleware.ts
      if (fs.existsSync(middlewarePath)) {
        const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
        const middlewareChecks = [
          { name: 'middleware function', pattern: /export function middleware/ },
          { name: 'protectedRoutes array', pattern: /protectedRoutes/ },
          { name: 'config export', pattern: /export const config/ }
        ];

        middlewareChecks.forEach(check => {
          total++;
          if (check.pattern.test(middlewareContent)) {
            logTest(`middleware.ts - ${check.name}`, 'PASS');
            passed++;
          } else {
            logTest(`middleware.ts - ${check.name}`, 'FAIL');
            failed++;
          }
        });
      } else {
        total++;
        logTest('middleware.ts', 'FAIL', 'File mancante');
        failed++;
      }

      this.testResults.push({
        name: 'Routing Configuration',
        passed,
        failed,
        total
      });

    } catch (error) {
      logTest('Routing Configuration', 'FAIL', `Errore: ${error.message}`);
      this.testResults.push({
        name: 'Routing Configuration',
        passed: 0,
        failed: 1,
        total: 1
      });
    }
  }

  // Genera report finale
  generateReport() {
    log('\n📊 REPORT FINALE TEST AUTOMATIZZATI', 'bold');
    log('='.repeat(50), 'blue');

    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    this.testResults.forEach(result => {
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalTests += result.total;

      const percentage = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
      const status = percentage === 100 ? 'green' : percentage >= 80 ? 'yellow' : 'red';
      
      log(`\n${result.name}:`, 'bold');
      log(`  ✅ Passati: ${result.passed}/${result.total} (${percentage}%)`, status);
      if (result.failed > 0) {
        log(`  ❌ Falliti: ${result.failed}`, 'red');
      }
    });

    const overallPercentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    const overallStatus = overallPercentage === 100 ? 'green' : overallPercentage >= 80 ? 'yellow' : 'red';

    log('\n' + '='.repeat(50), 'blue');
    log(`RISULTATO COMPLESSIVO: ${totalPassed}/${totalTests} test passati (${overallPercentage}%)`, overallStatus);
    
    if (overallPercentage === 100) {
      log('🎉 Tutti i test automatizzati sono passati!', 'green');
    } else if (overallPercentage >= 80) {
      log('⚠️  La maggior parte dei test è passata, ma ci sono alcuni problemi da risolvere.', 'yellow');
    } else {
      log('❌ Ci sono problemi significativi che richiedono attenzione.', 'red');
    }

    return {
      passed: totalPassed,
      failed: totalFailed,
      total: totalTests,
      percentage: overallPercentage
    };
  }

  // Esegui tutti i test
  async runAllTests() {
    log('🚀 AVVIO TEST AUTOMATIZZATI SISTEMA PROFILI', 'bold');
    log('='.repeat(50), 'blue');

    this.testFileStructure();
    this.testLayoutIntegration();
    this.testProfileComponents();
    this.testRustBackend();
    this.testRoutingConfiguration();

    const report = this.generateReport();

    // Salva report su file
    const reportData = {
      timestamp: new Date().toISOString(),
      results: this.testResults,
      summary: report
    };

    const reportPath = path.join(this.projectRoot, 'test-results-profiles-integration.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    log(`\n📄 Report salvato in: ${reportPath}`, 'blue');
    
    return report;
  }
}

// Esegui i test se lo script viene chiamato direttamente
if (require.main === module) {
  const tester = new ProfilesIntegrationTester();
  tester.runAllTests().then(report => {
    process.exit(report.percentage === 100 ? 0 : 1);
  }).catch(error => {
    console.error('Errore durante l\'esecuzione dei test:', error);
    process.exit(1);
  });
}

module.exports = ProfilesIntegrationTester;