#!/usr/bin/env node

/**
 * Test Suite per Steam Family Sharing
 * Testa le funzionalità implementate senza dipendere da Tauri
 */

const fs = require('fs');
const path = require('path');

class FamilySharingTester {
  constructor() {
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📄',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  test(name, testFn) {
    try {
      this.log(`🧪 Running test: ${name}`, 'info');
      const result = testFn();
      
      if (result === true || result === undefined) {
        this.passedTests++;
        this.log(`✅ PASS: ${name}`, 'success');
        this.testResults.push({ name, status: 'PASS', error: null });
      } else {
        this.failedTests++;
        this.log(`❌ FAIL: ${name} - ${result}`, 'error');
        this.testResults.push({ name, status: 'FAIL', error: result });
      }
    } catch (error) {
      this.failedTests++;
      this.log(`❌ ERROR: ${name} - ${error.message}`, 'error');
      this.testResults.push({ name, status: 'ERROR', error: error.message });
    }
  }

  // Simulazione del parser VDF (versione JS semplificata)
  parseVDFSimple(content) {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));
    const sharedGames = [];
    const authorizedUsers = [];
    
    let currentUserId = null;
    let currentUserName = null;
    let inAppsSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Rileva Steam ID
      if (line.match(/^"76561198\d+"/)) {
        currentUserId = line.replace(/"/g, '');
        inAppsSection = false;
        authorizedUsers.push(currentUserId);
      }
      
      // Rileva Account Name
      if (line.includes('"AccountName"') && currentUserId) {
        const match = line.match(/"AccountName"\s+"([^"]+)"/);
        if (match) {
          currentUserName = match[1];
        }
      }
      
      // Rileva sezione Apps
      if (line === '"Apps"' && currentUserId) {
        inAppsSection = true;
      }
      
      // Rileva giochi nella sezione Apps
      if (inAppsSection && line.match(/^"\d+"/)) {
        const appIdMatch = line.match(/^"(\d+)"/);
        if (appIdMatch) {
          const appId = parseInt(appIdMatch[1]);
          
          // Cerca il nome del gioco nelle linee successive
          let gameName = `Game ${appId}`;
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const nextLine = lines[j];
            if (nextLine.includes('"name"')) {
              const nameMatch = nextLine.match(/"name"\s+"([^"]+)"/);
              if (nameMatch) {
                gameName = nameMatch[1];
                break;
              }
            }
          }
          
          sharedGames.push({
            appid: appId,
            name: gameName,
            owner_steam_id: currentUserId,
            owner_account_name: currentUserName || 'Unknown User',
            is_shared: true
          });
        }
      }
    }
    
    return {
      shared_games: sharedGames,
      total_shared_games: sharedGames.length,
      authorized_users: [...new Set(authorizedUsers)]
    };
  }

  runTests() {
    this.log('🚀 Starting Steam Family Sharing Test Suite', 'info');
    
    // Test 1: File VDF di test esiste
    this.test('VDF test file exists', () => {
      const testFile = path.join(__dirname, 'test-family-sharing-data.vdf');
      return fs.existsSync(testFile);
    });
    
    // Test 2: Parser VDF funziona con dati validi
    this.test('VDF parser handles valid data', () => {
      const testFile = path.join(__dirname, 'test-family-sharing-data.vdf');
      const content = fs.readFileSync(testFile, 'utf8');
      const result = this.parseVDFSimple(content);
      
      if (result.total_shared_games !== 6) {
        return `Expected 6 games, got ${result.total_shared_games}`;
      }
      
      if (result.authorized_users.length !== 2) {
        return `Expected 2 users, got ${result.authorized_users.length}`;
      }
      
      return true;
    });
    
    // Test 3: Giochi specifici sono rilevati correttamente
    this.test('Specific games are detected correctly', () => {
      const testFile = path.join(__dirname, 'test-family-sharing-data.vdf');
      const content = fs.readFileSync(testFile, 'utf8');
      const result = this.parseVDFSimple(content);
      
      const expectedGames = [
        { appid: 440, name: 'Team Fortress 2' },
        { appid: 570, name: 'Dota 2' },
        { appid: 730, name: 'Counter-Strike 2' },
        { appid: 271590, name: 'Grand Theft Auto V' },
        { appid: 1091500, name: 'Cyberpunk 2077' },
        { appid: 292030, name: 'The Witcher 3: Wild Hunt' }
      ];
      
      for (const expected of expectedGames) {
        const found = result.shared_games.find(g => g.appid === expected.appid);
        if (!found) {
          return `Game ${expected.name} (${expected.appid}) not found`;
        }
        if (found.name !== expected.name) {
          return `Game name mismatch: expected "${expected.name}", got "${found.name}"`;
        }
      }
      
      return true;
    });
    
    // Test 4: User ownership è corretto
    this.test('User ownership is correct', () => {
      const testFile = path.join(__dirname, 'test-family-sharing-data.vdf');
      const content = fs.readFileSync(testFile, 'utf8');
      const result = this.parseVDFSimple(content);
      
      const user1Games = result.shared_games.filter(g => g.owner_steam_id === '76561198012345678');
      const user2Games = result.shared_games.filter(g => g.owner_steam_id === '76561198087654321');
      
      if (user1Games.length !== 3) {
        return `User1 should have 3 games, got ${user1Games.length}`;
      }
      
      if (user2Games.length !== 3) {
        return `User2 should have 3 games, got ${user2Games.length}`;
      }
      
      return true;
    });
    
    // Test 5: Parser gestisce file vuoto/corrotto
    this.test('Parser handles empty/corrupted files', () => {
      try {
        const result = this.parseVDFSimple('');
        return result.total_shared_games === 0 && result.authorized_users.length === 0;
      } catch (error) {
        return `Parser should handle empty files gracefully: ${error.message}`;
      }
    });
    
    // Test 6: Steam ID validation
    this.test('Steam ID validation works', () => {
      const validIds = [
        '76561198012345678',
        '76561198087654321',
        '76561198000000001'
      ];
      
      const invalidIds = [
        '12345678',
        '76561197999999999',
        'not-a-number',
        ''
      ];
      
      // Simula validazione Steam ID (17 caratteri, inizia con 76561198)
      const validateSteamId = (id) => {
        return id.length === 17 && id.startsWith('76561198') && /^\d+$/.test(id);
      };
      
      for (const id of validIds) {
        if (!validateSteamId(id)) {
          return `Valid ID ${id} was rejected`;
        }
      }
      
      for (const id of invalidIds) {
        if (validateSteamId(id)) {
          return `Invalid ID ${id} was accepted`;
        }
      }
      
      return true;
    });
    
    // Test 7: Performance con molti giochi
    this.test('Performance with many games', () => {
      const startTime = Date.now();
      
      // Simula parsing di file con 1000 giochi
      let largeVdfContent = `"UserRoamingConfigStore"\n{\n\t"Software"\n\t{\n\t\t"Valve"\n\t\t{\n\t\t\t"Steam"\n\t\t\t{\n\t\t\t\t"SharedLibraryUsers"\n\t\t\t\t{\n\t\t\t\t\t"76561198012345678"\n\t\t\t\t\t{\n\t\t\t\t\t\t"AccountName"\t\t"PerformanceTestUser"\n\t\t\t\t\t\t"Apps"\n\t\t\t\t\t\t{\n`;
      
      for (let i = 1; i <= 1000; i++) {
        largeVdfContent += `\t\t\t\t\t\t\t"${i}"\n\t\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\t"name"\t\t"Test Game ${i}"\n\t\t\t\t\t\t\t}\n`;
      }
      
      largeVdfContent += `\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}`;
      
      const result = this.parseVDFSimple(largeVdfContent);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.log(`⏱️ Performance test: parsed 1000 games in ${duration}ms`, 'info');
      
      if (duration > 5000) { // 5 secondi
        return `Performance too slow: ${duration}ms for 1000 games`;
      }
      
      if (result.total_shared_games !== 1000) {
        return `Expected 1000 games, got ${result.total_shared_games}`;
      }
      
      return true;
    });
  }

  printSummary() {
    this.log('\n📊 TEST SUMMARY', 'info');
    this.log(`Total Tests: ${this.passedTests + this.failedTests}`, 'info');
    this.log(`Passed: ${this.passedTests}`, 'success');
    this.log(`Failed: ${this.failedTests}`, this.failedTests > 0 ? 'error' : 'success');
    this.log(`Success Rate: ${((this.passedTests / (this.passedTests + this.failedTests)) * 100).toFixed(1)}%`, 'info');
    
    if (this.failedTests > 0) {
      this.log('\n❌ FAILED TESTS:', 'error');
      this.testResults
        .filter(r => r.status !== 'PASS')
        .forEach(r => this.log(`  • ${r.name}: ${r.error}`, 'error'));
    }
    
    return this.failedTests === 0;
  }
}

// Esegui i test
const tester = new FamilySharingTester();
tester.runTests();
const allPassed = tester.printSummary();

process.exit(allPassed ? 0 : 1);