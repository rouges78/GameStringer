#!/usr/bin/env node

/**
 * Script di test sistematico per GameStringer
 * Verifica tutte le funzionalità principali
 */

const fs = require('fs');
const path = require('path');

// Colori per output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

async function testEndpoint(name, url, options = {}) {
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const success = response.ok;
    const data = await response.text();
    
    results.tests.push({
      name,
      url,
      status: response.status,
      success,
      data: data.substring(0, 100) + (data.length > 100 ? '...' : '')
    });

    if (success) {
      results.passed++;
      log(`✅ ${name}`, 'green');
    } else {
      results.failed++;
      log(`❌ ${name} (Status: ${response.status})`, 'red');
    }

    return { success, response, data };
  } catch (error) {
    results.failed++;
    results.tests.push({
      name,
      url,
      status: 0,
      success: false,
      error: error.message
    });
    log(`❌ ${name} - ${error.message}`, 'red');
    return { success: false, error };
  }
}

async function checkFile(name, filePath) {
  const exists = fs.existsSync(filePath);
  results.tests.push({
    name: `File: ${name}`,
    path: filePath,
    exists,
    success: exists
  });

  if (exists) {
    results.passed++;
    log(`✅ File exists: ${name}`, 'green');
    
    // Check for syntax errors in TypeScript/JavaScript files
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const hasIssues = content.includes('<<<<<<') || content.includes('>>>>>>');
      if (hasIssues) {
        results.warnings++;
        log(`⚠️  File has merge conflicts: ${name}`, 'yellow');
      }
    }
  } else {
    results.failed++;
    log(`❌ File missing: ${name}`, 'red');
  }
  
  return exists;
}

async function runTests() {
  log('\n🧪 GameStringer System Test\n', 'cyan');
  log('Testing all major components...\n', 'blue');

  const baseUrl = 'http://localhost:3001';

  // 1. Test pagine principali
  log('\n📄 Testing Main Pages:', 'blue');
  await testEndpoint('Homepage', `${baseUrl}/`);
  await testEndpoint('Patches Page', `${baseUrl}/patches`);
  await testEndpoint('Editor Page', `${baseUrl}/editor`);
  await testEndpoint('Stores Page', `${baseUrl}/stores`);
  await testEndpoint('Library Page', `${baseUrl}/library`);
  await testEndpoint('Dashboard Page', `${baseUrl}/dashboard`);

  // 2. Test API endpoints
  log('\n🔌 Testing API Endpoints:', 'blue');
  await testEndpoint('Games API', `${baseUrl}/api/games`);
  await testEndpoint('Patches API', `${baseUrl}/api/patches`);
  await testEndpoint('Translations API', `${baseUrl}/api/translations`);
  await testEndpoint('Auth Session', `${baseUrl}/api/auth/session`);
  await testEndpoint('Stores Test Connection', `${baseUrl}/api/stores/test-connection`, {
    method: 'POST',
    body: { provider: 'steam-credentials' }
  });

  // 3. Test file critici
  log('\n📁 Checking Critical Files:', 'blue');
  const projectRoot = path.join(__dirname, '..');
  
  checkFile('Patches Page Component', path.join(projectRoot, 'app/patches/page.tsx'));
  checkFile('Editor Page Component', path.join(projectRoot, 'app/editor/page.tsx'));
  checkFile('Stores Page Component', path.join(projectRoot, 'app/stores/page.tsx'));
  checkFile('Games API Route', path.join(projectRoot, 'app/api/games/route.ts'));
  checkFile('Patches API Route', path.join(projectRoot, 'app/api/patches/route.ts'));
  checkFile('Translations API Route', path.join(projectRoot, 'app/api/translations/route.ts'));
  checkFile('Database Schema', path.join(projectRoot, 'prisma/schema.prisma'));
  checkFile('Environment Config', path.join(projectRoot, '.env.local'));

  // 4. Test database
  log('\n💾 Checking Database:', 'blue');
  const dbExists = fs.existsSync(path.join(projectRoot, 'prisma/dev.db'));
  if (dbExists) {
    results.passed++;
    log('✅ Database file exists', 'green');
  } else {
    results.failed++;
    log('❌ Database file missing - run: npx prisma db push', 'red');
  }

  // 5. Test dipendenze
  log('\n📦 Checking Dependencies:', 'blue');
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const requiredDeps = ['next', 'react', 'prisma', '@prisma/client', 'next-auth'];
  
  for (const dep of requiredDeps) {
    const hasIt = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
    if (hasIt) {
      results.passed++;
      log(`✅ Dependency: ${dep}`, 'green');
    } else {
      results.failed++;
      log(`❌ Missing dependency: ${dep}`, 'red');
    }
  }

  // Risultati finali
  log('\n📊 Test Results Summary:', 'cyan');
  log('━'.repeat(40), 'cyan');
  log(`Total Tests: ${results.passed + results.failed}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, 'red');
  log(`Warnings: ${results.warnings}`, 'yellow');
  
  const successRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
  log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');

  // Suggerimenti per problemi comuni
  if (results.failed > 0) {
    log('\n💡 Troubleshooting Tips:', 'yellow');
    
    const failedTests = results.tests.filter(t => !t.success);
    
    if (failedTests.some(t => t.name.includes('API'))) {
      log('• API failures: Check if the server is running on the correct port', 'yellow');
      log('• Run: npm run dev', 'yellow');
    }
    
    if (failedTests.some(t => t.name.includes('Database'))) {
      log('• Database issues: Initialize with: npx prisma db push', 'yellow');
    }
    
    if (failedTests.some(t => t.status === 500)) {
      log('• Server errors: Check console logs for detailed error messages', 'yellow');
    }
  }

  // Export risultati dettagliati
  const reportPath = path.join(projectRoot, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log(`\n📄 Detailed report saved to: test-report.json`, 'blue');
}

// Esegui i test
runTests().catch(error => {
  log(`\n❌ Test runner error: ${error.message}`, 'red');
  process.exit(1);
});
