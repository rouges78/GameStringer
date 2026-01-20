#!/usr/bin/env node

/**
 * Test UI Integration per Steam Family Sharing
 * Simula l'integrazione frontend con dati mock
 */

class UIIntegrationTester {
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

  async test(name, testFn) {
    try {
      this.log(`🧪 Running UI test: ${name}`, 'info');
      const result = await testFn();
      
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

  // Mock dei tipi TypeScript per simulare l'interfaccia
  createMockInterfaces() {
    return {
      SharedGame: {
        create: (appid, name, ownerId, ownerName) => ({
          appid,
          name,
          owner_steam_id: ownerId,
          owner_account_name: ownerName,
          is_shared: true
        })
      },
      
      FamilySharingConfig: {
        create: (sharedGames, authorizedUsers) => ({
          shared_games: sharedGames,
          total_shared_games: sharedGames.length,
          authorized_users: authorizedUsers
        })
      },
      
      DisplayGame: {
        create: (steamGame, isShared = false) => ({
          id: steamGame.appid.toString(),
          title: steamGame.name,
          imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${steamGame.appid}/header.jpg`,
          fallbackImageUrl: null,
          platform: 'Steam',
          isInstalled: steamGame.is_installed || false,
          playtime: steamGame.playtime_forever || 0,
          lastPlayed: steamGame.last_played || 0,
          isVrSupported: steamGame.is_vr || false,
          engine: steamGame.engine || 'Unknown',
          isShared: steamGame.is_shared || isShared,
          howLongToBeat: steamGame.how_long_to_beat || null,
          genres: steamGame.genres || [],
          categories: steamGame.categories || [],
          shortDescription: steamGame.short_description || '',
          isFree: steamGame.is_free || false,
          developers: steamGame.developers || [],
          publishers: steamGame.publishers || [],
          releaseDate: steamGame.release_date || { coming_soon: false, date: '' },
          supportedLanguages: steamGame.supported_languages || ''
        })
      }
    };
  }

  // Simula le funzioni del componente React
  simulateReactComponent() {
    const mockTauri = {
      invoke: async (command, params) => {
        switch (command) {
          case 'auto_detect_steam_config':
            return {
              steam_path: 'C:\\Program Files (x86)\\Steam',
              logged_in_users: ['76561198012345678', '76561198087654321']
            };
            
          case 'get_family_sharing_games':
            return {
              shared_games: [
                { appid: 440, name: 'Team Fortress 2', owner_steam_id: '76561198012345678', owner_account_name: 'TestUser1', is_shared: true },
                { appid: 570, name: 'Dota 2', owner_steam_id: '76561198012345678', owner_account_name: 'TestUser1', is_shared: true },
                { appid: 271590, name: 'Grand Theft Auto V', owner_steam_id: '76561198087654321', owner_account_name: 'TestUser2', is_shared: true }
              ],
              total_shared_games: 3,
              authorized_users: ['76561198012345678', '76561198087654321']
            };
            
          case 'parse_shared_config_vdf':
            if (!params.fileContent) {
              throw new Error('File content is required');
            }
            return {
              shared_games: [
                { appid: 730, name: 'Counter-Strike 2', owner_steam_id: '76561198012345678', owner_account_name: 'TestUser1', is_shared: true }
              ],
              total_shared_games: 1,
              authorized_users: ['76561198012345678']
            };
            
          case 'get_steam_games_with_family_sharing':
            return [
              // Giochi posseduti
              { appid: 440, name: 'Team Fortress 2', is_shared: false, is_installed: true, playtime_forever: 120 },
              { appid: 570, name: 'Dota 2', is_shared: false, is_installed: false, playtime_forever: 0 },
              // Giochi condivisi
              { appid: 271590, name: 'Grand Theft Auto V', is_shared: true, is_installed: false, playtime_forever: 0, short_description: 'Condiviso da TestUser2' },
              { appid: 1091500, name: 'Cyberpunk 2077', is_shared: true, is_installed: true, playtime_forever: 45, short_description: 'Condiviso da TestUser2' }
            ];
            
          default:
            throw new Error(`Unknown command: ${command}`);
        }
      }
    };

    // Simula il componente SteamFamilySharing
    const createFamilySharingComponent = () => {
      let state = {
        isDetecting: false,
        isUploading: false,
        isLoadingSharedGames: false,
        sharedAccounts: [],
        familySharingConfig: null,
        error: null,
        selectedFile: null,
        detectionProgress: 0
      };

      return {
        getState: () => state,
        
        handleAutoDetect: async () => {
          state.isDetecting = true;
          state.error = null;
          
          try {
            const result = await mockTauri.invoke('auto_detect_steam_config');
            
            if (result.logged_in_users && result.logged_in_users.length > 0) {
              state.sharedAccounts = result.logged_in_users.map(steamId => ({ steamId }));
              
              // Auto-load family sharing games
              const config = await mockTauri.invoke('get_family_sharing_games');
              state.familySharingConfig = config;
            }
          } catch (err) {
            state.error = err.message;
          } finally {
            state.isDetecting = false;
          }
        },
        
        handleFileUpload: async (fileContent) => {
          state.isUploading = true;
          state.error = null;
          
          try {
            const config = await mockTauri.invoke('parse_shared_config_vdf', { fileContent });
            state.familySharingConfig = config;
          } catch (err) {
            state.error = err.message;
          } finally {
            state.isUploading = false;
          }
        },
        
        loadFamilySharingGames: async () => {
          state.isLoadingSharedGames = true;
          
          try {
            const config = await mockTauri.invoke('get_family_sharing_games');
            state.familySharingConfig = config;
          } catch (err) {
            state.error = err.message;
          } finally {
            state.isLoadingSharedGames = false;
          }
        }
      };
    };

    // Simula la pagina Games
    const createGamesPage = () => {
      let state = {
        games: [],
        isLoading: true,
        error: null
      };

      return {
        getState: () => state,
        
        loadGames: async (forceRefresh = false) => {
          state.isLoading = true;
          state.error = null;
          
          try {
            const steamGames = await mockTauri.invoke('get_steam_games_with_family_sharing', {
              apiKey: 'test-key',
              steamId: '76561198012345678',
              forceRefresh
            });
            
            const { DisplayGame } = this.createMockInterfaces();
            state.games = steamGames.map(game => DisplayGame.create(game));
          } catch (err) {
            state.error = err.message;
          } finally {
            state.isLoading = false;
          }
        }
      };
    };

    return {
      mockTauri,
      createFamilySharingComponent,
      createGamesPage
    };
  }

  async runUITests() {
    this.log('🚀 Starting UI Integration Tests', 'info');
    
    const { mockTauri, createFamilySharingComponent, createGamesPage } = this.simulateReactComponent();
    const { SharedGame, FamilySharingConfig, DisplayGame } = this.createMockInterfaces();

    // Test 1: Auto-detect funziona
    await this.test('Auto-detect Steam config works', async () => {
      const component = createFamilySharingComponent();
      
      await component.handleAutoDetect();
      const state = component.getState();
      
      if (state.error) {
        return `Auto-detect failed: ${state.error}`;
      }
      
      if (state.sharedAccounts.length !== 2) {
        return `Expected 2 shared accounts, got ${state.sharedAccounts.length}`;
      }
      
      if (!state.familySharingConfig) {
        return 'Family sharing config not loaded';
      }
      
      if (state.familySharingConfig.total_shared_games !== 3) {
        return `Expected 3 shared games, got ${state.familySharingConfig.total_shared_games}`;
      }
      
      return true;
    });

    // Test 2: File upload funziona
    await this.test('File upload parsing works', async () => {
      const component = createFamilySharingComponent();
      const testVdfContent = '"UserRoamingConfigStore"\n{\n\t"Software"\n\t{\n\t\t"Valve"\n\t\t{\n\t\t\t"Steam"\n\t\t\t{\n\t\t\t\t"SharedLibraryUsers"\n\t\t\t\t{\n\t\t\t\t\t"76561198012345678"\n\t\t\t\t\t{\n\t\t\t\t\t\t"AccountName"\t\t"TestUser"\n\t\t\t\t\t\t"Apps"\n\t\t\t\t\t\t{\n\t\t\t\t\t\t\t"730"\n\t\t\t\t\t\t\t{\n\t\t\t\t\t\t\t\t"name"\t\t"Counter-Strike 2"\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}';
      
      await component.handleFileUpload(testVdfContent);
      const state = component.getState();
      
      if (state.error) {
        return `File upload failed: ${state.error}`;
      }
      
      if (!state.familySharingConfig) {
        return 'Family sharing config not set after file upload';
      }
      
      if (state.familySharingConfig.total_shared_games !== 1) {
        return `Expected 1 shared game from file, got ${state.familySharingConfig.total_shared_games}`;
      }
      
      return true;
    });

    // Test 3: Error handling
    await this.test('Handles upload errors gracefully', async () => {
      const component = createFamilySharingComponent();
      
      await component.handleFileUpload(''); // Empty content
      const state = component.getState();
      
      if (!state.error) {
        return 'Expected error for empty file content';
      }
      
      if (state.familySharingConfig) {
        return 'Config should not be set after error';
      }
      
      return true;
    });

    // Test 4: Games page integration
    await this.test('Games page loads shared games correctly', async () => {
      const gamesPage = createGamesPage();
      
      await gamesPage.loadGames();
      const state = gamesPage.getState();
      
      if (state.error) {
        return `Games loading failed: ${state.error}`;
      }
      
      if (state.games.length !== 4) {
        return `Expected 4 games (2 owned + 2 shared), got ${state.games.length}`;
      }
      
      const sharedGames = state.games.filter(g => g.isShared);
      if (sharedGames.length !== 2) {
        return `Expected 2 shared games, got ${sharedGames.length}`;
      }
      
      const ownedGames = state.games.filter(g => !g.isShared);
      if (ownedGames.length !== 2) {
        return `Expected 2 owned games, got ${ownedGames.length}`;
      }
      
      return true;
    });

    // Test 5: DisplayGame conversion
    await this.test('SteamGame to DisplayGame conversion works', () => {
      const mockSteamGame = {
        appid: 440,
        name: 'Team Fortress 2',
        is_shared: true,
        is_installed: true,
        playtime_forever: 120,
        last_played: 1609459200,
        is_vr: false,
        engine: 'Source',
        short_description: 'Condiviso da TestUser'
      };
      
      const displayGame = DisplayGame.create(mockSteamGame);
      
      if (displayGame.id !== '440') {
        return `Expected ID '440', got '${displayGame.id}'`;
      }
      
      if (displayGame.title !== 'Team Fortress 2') {
        return `Expected title 'Team Fortress 2', got '${displayGame.title}'`;
      }
      
      if (!displayGame.isShared) {
        return 'Expected isShared to be true';
      }
      
      if (!displayGame.isInstalled) {
        return 'Expected isInstalled to be true';
      }
      
      if (displayGame.playtime !== 120) {
        return `Expected playtime 120, got ${displayGame.playtime}`;
      }
      
      return true;
    });

    // Test 6: Badge rendering logic
    await this.test('Badge rendering logic works correctly', () => {
      const games = [
        { isShared: true, isInstalled: true, isVrSupported: false },
        { isShared: false, isInstalled: true, isVrSupported: true },
        { isShared: true, isInstalled: false, isVrSupported: true },
        { isShared: false, isInstalled: false, isVrSupported: false }
      ];
      
      const getBadges = (game) => {
        const badges = [];
        if (game.isVrSupported) badges.push('VR');
        if (game.isShared) badges.push('Condiviso');
        if (game.isInstalled) badges.push('Installato');
        return badges;
      };
      
      const expectedBadges = [
        ['Condiviso', 'Installato'],
        ['VR', 'Installato'],
        ['VR', 'Condiviso'],
        []
      ];
      
      for (let i = 0; i < games.length; i++) {
        const actualBadges = getBadges(games[i]);
        const expected = expectedBadges[i];
        
        if (actualBadges.length !== expected.length) {
          return `Game ${i}: Expected ${expected.length} badges, got ${actualBadges.length}`;
        }
        
        for (const badge of expected) {
          if (!actualBadges.includes(badge)) {
            return `Game ${i}: Missing badge '${badge}'`;
          }
        }
      }
      
      return true;
    });

    // Test 7: State management
    await this.test('Component state management works', async () => {
      const component = createFamilySharingComponent();
      let state = component.getState();
      
      // Initial state
      if (state.isDetecting || state.familySharingConfig || state.error) {
        return 'Initial state is not clean';
      }
      
      // During detection
      const detectPromise = component.handleAutoDetect();
      // Note: In real React, we'd check intermediate state here
      
      await detectPromise;
      state = component.getState();
      
      // After detection
      if (state.isDetecting) {
        return 'isDetecting should be false after completion';
      }
      
      if (!state.familySharingConfig) {
        return 'familySharingConfig should be set after successful detection';
      }
      
      return true;
    });
  }

  printSummary() {
    this.log('\n📊 UI INTEGRATION TEST SUMMARY', 'info');
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
async function main() {
  const tester = new UIIntegrationTester();
  await tester.runUITests();
  const allPassed = tester.printSummary();
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});