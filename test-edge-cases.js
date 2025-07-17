#!/usr/bin/env node

/**
 * Test Edge Cases e Error Handling per Steam Family Sharing
 */

const fs = require('fs');
const path = require('path');

class EdgeCaseTester {
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
      this.log(`🧪 Running edge case test: ${name}`, 'info');
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

  // Simulazione parser VDF robusto
  parseVDFRobust(content) {
    if (!content || typeof content !== 'string') {
      return { shared_games: [], total_shared_games: 0, authorized_users: [] };
    }

    try {
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));
      
      const sharedGames = [];
      const authorizedUsers = [];
      
      let currentUserId = null;
      let currentUserName = null;
      let inAppsSection = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Rileva Steam ID con validazione
        const steamIdMatch = line.match(/^"(76561198\d{9})"/);
        if (steamIdMatch) {
          const steamId = steamIdMatch[1];
          if (steamId.length === 17 && /^\d+$/.test(steamId)) {
            currentUserId = steamId;
            inAppsSection = false;
            authorizedUsers.push(currentUserId);
          }
        }
        
        // Rileva Account Name con sanitizzazione
        if (line.includes('"AccountName"') && currentUserId) {
          const match = line.match(/"AccountName"\s+"([^"]+)"/);
          if (match) {
            // Sanitizza il nome utente
            currentUserName = match[1]
              .replace(/[<>]/g, '') // Rimuovi caratteri pericolosi
              .substring(0, 50); // Limita lunghezza
          }
        }
        
        // Rileva sezione Apps
        if (line === '"Apps"' && currentUserId) {
          inAppsSection = true;
        }
        
        // Rileva giochi con validazione App ID
        if (inAppsSection && line.match(/^"\d+"/)) {
          const appIdMatch = line.match(/^"(\d+)"/);
          if (appIdMatch) {
            const appId = parseInt(appIdMatch[1]);
            
            // Valida App ID (Steam App IDs sono tipicamente 1-9999999999)
            if (appId > 0 && appId <= 9999999999) {
              let gameName = `Game ${appId}`;
              
              // Cerca il nome del gioco con sicurezza
              for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const nextLine = lines[j];
                if (nextLine.includes('"name"')) {
                  const nameMatch = nextLine.match(/"name"\s+"([^"]+)"/);
                  if (nameMatch) {
                    // Sanitizza il nome del gioco
                    gameName = nameMatch[1]
                      .replace(/[<>]/g, '')
                      .substring(0, 100);
                    break;
                  }
                }
                // Esci se troviamo un nuovo gioco
                if (nextLine.match(/^"\d+"/)) break;
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
      }
      
      // Rimuovi duplicati
      const uniqueGames = [];
      const seenIds = new Set();
      for (const game of sharedGames) {
        if (!seenIds.has(game.appid)) {
          seenIds.add(game.appid);
          uniqueGames.push(game);
        }
      }
      
      return {
        shared_games: uniqueGames,
        total_shared_games: uniqueGames.length,
        authorized_users: [...new Set(authorizedUsers)]
      };
    } catch (error) {
      // In caso di errore, ritorna struttura vuota invece di crashare
      return { shared_games: [], total_shared_games: 0, authorized_users: [] };
    }
  }

  createTestFiles() {
    // File VDF malformato
    const malformedVdf = `"UserRoamingConfigStore"
{
  "Software"
  {
    "Valve"
    {
      "Steam"
      {
        "SharedLibraryUsers"
        {
          "76561198012345678"
          {
            "AccountName"    "TestUser"
            "Apps"
            {
              "INVALID_APP_ID"
              {
                "name"    "Invalid Game"
              }
              "440"
              {
                // Questo è un commento che dovrebbe essere ignorato
                "name"    "Team Fortress 2"
              }
            }
          }
        }
      }
    }
  }
// File truncato qui...`;

    // File VDF con caratteri speciali
    const specialCharsVdf = `"UserRoamingConfigStore"
{
  "Software"
  {
    "Valve"
    {
      "Steam"
      {
        "SharedLibraryUsers"
        {
          "76561198012345678"
          {
            "AccountName"    "User<script>alert('xss')</script>"
            "Apps"
            {
              "440"
              {
                "name"    "Game with \\\"quotes\\\" and <tags>"
              }
            }
          }
        }
      }
    }
  }
}`;

    // File VDF vuoto
    const emptyVdf = '';

    // File VDF con Steam ID invalidi
    const invalidSteamIdVdf = `"UserRoamingConfigStore"
{
  "Software"
  {
    "Valve"
    {
      "Steam"
      {
        "SharedLibraryUsers"
        {
          "12345678"
          {
            "AccountName"    "InvalidUser1"
          }
          "76561197999999999"
          {
            "AccountName"    "InvalidUser2"
          }
          "76561198012345678"
          {
            "AccountName"    "ValidUser"
            "Apps"
            {
              "440"
              {
                "name"    "Valid Game"
              }
            }
          }
        }
      }
    }
  }
}`;

    return {
      malformed: malformedVdf,
      specialChars: specialCharsVdf,
      empty: emptyVdf,
      invalidSteamIds: invalidSteamIdVdf
    };
  }

  runEdgeCaseTests() {
    this.log('🚀 Starting Edge Cases and Error Handling Tests', 'info');
    
    const testFiles = this.createTestFiles();

    // Test 1: File VDF malformato
    this.test('Handles malformed VDF gracefully', () => {
      const result = this.parseVDFRobust(testFiles.malformed);
      
      // Dovrebbe ignorare App ID invalidi e continuare
      if (result.total_shared_games !== 1) {
        return `Expected 1 valid game, got ${result.total_shared_games}`;
      }
      
      const validGame = result.shared_games.find(g => g.appid === 440);
      if (!validGame) {
        return 'Valid game (440) not found';
      }
      
      return true;
    });

    // Test 2: Caratteri speciali e XSS
    this.test('Sanitizes special characters and prevents XSS', () => {
      const result = this.parseVDFRobust(testFiles.specialChars);
      
      if (result.total_shared_games !== 1) {
        return `Expected 1 game, got ${result.total_shared_games}`;
      }
      
      const game = result.shared_games[0];
      
      // Verifica che i caratteri pericolosi siano rimossi
      if (game.owner_account_name.includes('<script>')) {
        return 'XSS attempt not sanitized in account name';
      }
      
      if (game.name.includes('<') || game.name.includes('>')) {
        return 'Special characters not sanitized in game name';
      }
      
      return true;
    });

    // Test 3: File vuoto
    this.test('Handles empty files correctly', () => {
      const result = this.parseVDFRobust(testFiles.empty);
      
      return result.total_shared_games === 0 && 
             result.shared_games.length === 0 && 
             result.authorized_users.length === 0;
    });

    // Test 4: Input null/undefined
    this.test('Handles null/undefined input', () => {
      const resultNull = this.parseVDFRobust(null);
      const resultUndefined = this.parseVDFRobust(undefined);
      
      const isValidEmpty = (r) => r.total_shared_games === 0 && 
                                   r.shared_games.length === 0 && 
                                   r.authorized_users.length === 0;
      
      return isValidEmpty(resultNull) && isValidEmpty(resultUndefined);
    });

    // Test 5: Steam ID validation
    this.test('Validates Steam IDs correctly', () => {
      const result = this.parseVDFRobust(testFiles.invalidSteamIds);
      
      // Solo l'ID valido dovrebbe essere accettato
      if (result.authorized_users.length !== 1) {
        return `Expected 1 valid user, got ${result.authorized_users.length}`;
      }
      
      if (result.authorized_users[0] !== '76561198012345678') {
        return `Expected specific valid Steam ID, got ${result.authorized_users[0]}`;
      }
      
      return true;
    });

    // Test 6: App ID extremes
    this.test('Handles extreme App IDs', () => {
      const extremeVdf = `"UserRoamingConfigStore"
{
  "Software"
  {
    "Valve"
    {
      "Steam"
      {
        "SharedLibraryUsers"
        {
          "76561198012345678"
          {
            "AccountName"    "TestUser"
            "Apps"
            {
              "0"
              {
                "name"    "Invalid Zero"
              }
              "1"
              {
                "name"    "Valid Minimum"
              }
              "999999999999"
              {
                "name"    "Too Large"
              }
              "9999999999"
              {
                "name"    "Valid Maximum"
              }
            }
          }
        }
      }
    }
  }
}`;
      
      const result = this.parseVDFRobust(extremeVdf);
      
      // Dovrebbe avere solo 2 giochi validi (ID 1 e 9999999999)
      if (result.total_shared_games !== 2) {
        return `Expected 2 valid games, got ${result.total_shared_games}`;
      }
      
      const validIds = result.shared_games.map(g => g.appid).sort();
      if (validIds[0] !== 1 || validIds[1] !== 9999999999) {
        return `Invalid App IDs accepted: ${validIds}`;
      }
      
      return true;
    });

    // Test 7: Unicode e caratteri internazionali
    this.test('Handles Unicode characters', () => {
      const unicodeVdf = `"UserRoamingConfigStore"
{
  "Software"
  {
    "Valve"
    {
      "Steam"
      {
        "SharedLibraryUsers"
        {
          "76561198012345678"
          {
            "AccountName"    "用户名测试"
            "Apps"
            {
              "440"
              {
                "name"    "Игра на русском языке 🎮"
              }
              "570"
              {
                "name"    "日本のゲーム 🇯🇵"
              }
            }
          }
        }
      }
    }
  }
}`;
      
      const result = this.parseVDFRobust(unicodeVdf);
      
      if (result.total_shared_games !== 2) {
        return `Expected 2 games, got ${result.total_shared_games}`;
      }
      
      // Verifica che i caratteri Unicode siano preservati
      const hasUnicodeGame = result.shared_games.some(g => 
        g.name.includes('русском') || g.name.includes('日本')
      );
      
      if (!hasUnicodeGame) {
        return 'Unicode characters not preserved in game names';
      }
      
      return true;
    });

    // Test 8: Performance con file molto grande
    this.test('Performance with very large files', () => {
      const startTime = Date.now();
      
      // Genera file VDF con 10,000 giochi
      let largeContent = `"UserRoamingConfigStore"\n{\n\t"Software"\n\t{\n\t\t"Valve"\n\t\t{\n\t\t\t"Steam"\n\t\t\t{\n\t\t\t\t"SharedLibraryUsers"\n\t\t\t\t{\n`;
      
      // Aggiungi 10 utenti con 1000 giochi ciascuno
      for (let user = 0; user < 10; user++) {
        const steamId = `7656119801234567${user}`;
        largeContent += `\t\t\t\t\t"${steamId}"\n\t\t\t\t\t{\n\t\t\t\t\t\t"AccountName"\t\t"User${user}"\n\t\t\t\t\t\t"Apps"\n\t\t\t\t\t\t{\n`;
        
        for (let game = 1; game <= 1000; game++) {
          const appId = user * 1000 + game;
          largeContent += `\t\t\t\t\t\t\t"${appId}"\n\t\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\t"name"\t\t"Game ${appId}"\n\t\t\t\t\t\t\t}\n`;
        }
        
        largeContent += `\t\t\t\t\t\t}\n\t\t\t\t\t}\n`;
      }
      
      largeContent += `\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}`;
      
      const result = this.parseVDFRobust(largeContent);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.log(`⏱️ Large file test: parsed ${result.total_shared_games} games in ${duration}ms`, 'info');
      
      if (duration > 10000) { // 10 secondi
        return `Performance too slow: ${duration}ms for large file`;
      }
      
      if (result.total_shared_games !== 10000) {
        return `Expected 10000 games, got ${result.total_shared_games}`;
      }
      
      if (result.authorized_users.length !== 10) {
        return `Expected 10 users, got ${result.authorized_users.length}`;
      }
      
      return true;
    });
  }

  printSummary() {
    this.log('\n📊 EDGE CASE TEST SUMMARY', 'info');
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
const tester = new EdgeCaseTester();
tester.runEdgeCaseTests();
const allPassed = tester.printSummary();

process.exit(allPassed ? 0 : 1);