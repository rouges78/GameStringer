// GameStringer Simple UI - JavaScript
class GameStringerApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.games = [];
        this.patches = [];
        this.init();
    }

    async init() {
        console.log('🚀 Inizializzazione GameStringer UI...');
        
        // Setup navigation
        this.setupNavigation();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadDashboardData();
        
        console.log('✅ GameStringer UI inizializzata!');
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.page');

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetPage = item.dataset.page;
                
                // Update nav active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update page visibility
                pages.forEach(page => page.classList.remove('active'));
                document.getElementById(targetPage).classList.add('active');
                
                this.currentPage = targetPage;
                
                // Load page-specific data
                this.loadPageData(targetPage);
            });
        });
    }

    setupEventListeners() {
        // Header buttons
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshCurrentPage();
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettings();
        });

        // Library controls
        document.getElementById('load-steam-btn').addEventListener('click', () => {
            this.loadSteamGames();
        });

        document.getElementById('scan-local-btn').addEventListener('click', () => {
            this.scanLocalGames();
        });

        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterGames(e.target.value);
        });

        // Translator
        document.getElementById('translate-btn').addEventListener('click', () => {
            this.translateText();
        });

        // Patches
        document.getElementById('create-patch-btn').addEventListener('click', () => {
            this.createPatch();
        });

        document.getElementById('import-patch-btn').addEventListener('click', () => {
            this.importPatch();
        });

        document.getElementById('export-patches-btn').addEventListener('click', () => {
            this.exportPatches();
        });

        // Test commands
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                const args = btn.dataset.args ? JSON.parse(btn.dataset.args) : {};
                this.testCommand(command, args);
            });
        });
    }

    async loadPageData(page) {
        switch(page) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'library':
                await this.loadLibraryData();
                break;
            case 'patches':
                await this.loadPatchesData();
                break;
        }
    }

    async loadDashboardData() {
        try {
            console.log('📊 Caricamento dati dashboard...');
            
            // Get Steam games count
            try {
                const steamGames = await this.invokeCommand('get_steam_games', {
                    api_key: 'demo',
                    user_id: 'demo',
                    force_refresh: false
                });
                document.getElementById('steam-games-count').textContent = steamGames?.length || 0;
            } catch (e) {
                document.getElementById('steam-games-count').textContent = '?';
            }

            // Get cache stats
            try {
                const cacheStats = await this.invokeCommand('get_cache_stats');
                document.getElementById('cache-size').textContent = this.formatBytes(cacheStats?.size || 0);
            } catch (e) {
                document.getElementById('cache-size').textContent = '?';
            }

            // Get patches count
            try {
                const patches = await this.invokeCommand('get_patches');
                document.getElementById('translations-count').textContent = patches?.length || 0;
            } catch (e) {
                document.getElementById('translations-count').textContent = '?';
            }

            // Update activity
            this.addActivity('📊 Dashboard aggiornata', 'Ora');

        } catch (error) {
            console.error('❌ Errore caricamento dashboard:', error);
            this.showError('Errore caricamento dashboard: ' + error.message);
        }
    }

    async loadLibraryData() {
        console.log('📚 Caricamento libreria...');
        // La libreria verrà caricata quando l'utente clicca sui pulsanti
    }

    async loadPatchesData() {
        try {
            console.log('🔨 Caricamento patch...');
            const patches = await this.invokeCommand('get_patches');
            this.displayPatches(patches || []);
        } catch (error) {
            console.error('❌ Errore caricamento patch:', error);
            this.showError('Errore caricamento patch: ' + error.message);
        }
    }

    async loadSteamGames() {
        const loadingEl = document.getElementById('library-loading');
        const gamesGrid = document.getElementById('games-grid');
        
        try {
            loadingEl.style.display = 'flex';
            gamesGrid.innerHTML = '';
            
            console.log('🎮 Caricamento giochi Steam...');
            
            const games = await this.invokeCommand('get_steam_games', {
                api_key: 'demo_key',
                user_id: 'demo_user',
                force_refresh: false
            });
            
            this.games = games || [];
            this.displayGames(this.games);
            this.addActivity('🎮 Giochi Steam caricati', `${this.games.length} giochi`);
            
        } catch (error) {
            console.error('❌ Errore caricamento Steam:', error);
            this.showError('Errore caricamento Steam: ' + error.message);
            gamesGrid.innerHTML = '<div class="error-message">❌ Errore caricamento giochi Steam</div>';
        } finally {
            loadingEl.style.display = 'none';
        }
    }

    async scanLocalGames() {
        const loadingEl = document.getElementById('library-loading');
        const gamesGrid = document.getElementById('games-grid');
        
        try {
            loadingEl.style.display = 'flex';
            
            console.log('📁 Scansione giochi locali...');
            
            const localGames = await this.invokeCommand('get_library_games');
            
            this.games = localGames || [];
            this.displayGames(this.games);
            this.addActivity('📁 Giochi locali scansionati', `${this.games.length} giochi`);
            
        } catch (error) {
            console.error('❌ Errore scansione locale:', error);
            this.showError('Errore scansione locale: ' + error.message);
            gamesGrid.innerHTML = '<div class="error-message">❌ Errore scansione giochi locali</div>';
        } finally {
            loadingEl.style.display = 'none';
        }
    }

    async displayGames(games) {
        const gamesGrid = document.getElementById('games-grid');
        
        if (!games || games.length === 0) {
            gamesGrid.innerHTML = '<div class="no-games">🎮 Nessun gioco trovato</div>';
            return;
        }

        // Prima mostra i giochi senza copertine per velocità
        gamesGrid.innerHTML = games.map(game => this.createGameCardHTML(game, null)).join('');
        
        // Poi carica le copertine in batch
        await this.loadGameCovers(games);
    }
    
    createGameCardHTML(game, coverUrl) {
        const gameId = game.id || game.appid;
        const gameName = game.name || 'Gioco Sconosciuto';
        
        return `
            <div class="game-card" data-game-id="${gameId}">
                <div class="game-cover" id="cover-${gameId}">
                    ${coverUrl ? 
                        `<img src="${coverUrl}" alt="${gameName}" onerror="this.parentElement.innerHTML='<div class=\"game-cover-placeholder\">🎮 ${gameName}</div>'">` :
                        `<div class="game-cover-placeholder">🎮 ${gameName}</div>`
                    }
                </div>
                <div class="game-content">
                    <div class="game-title">${gameName}</div>
                    <div class="game-info">
                        ${game.playtime_forever ? `⏱️ ${Math.round(game.playtime_forever / 60)}h giocate<br>` : ''}
                        ${game.languages ? `🌍 ${game.languages.split(',').length} lingue` : ''}
                    </div>
                    <div class="game-actions">
                        <button class="btn" onclick="app.viewGameDetails('${gameId}')">👁️ Dettagli</button>
                        <button class="btn btn-secondary" onclick="app.translateGame('${gameId}')">🔤 Traduci</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    async loadGameCovers(games) {
        try {
            console.log('🖼️ Caricamento copertine per', games.length, 'giochi...');
            
            // Estrai gli App ID Steam
            const steamAppIds = games
                .filter(game => game.appid || game.id)
                .map(game => String(game.appid || game.id))
                .slice(0, 20); // Limita a 20 per performance
            
            if (steamAppIds.length === 0) {
                console.log('⚠️ Nessun App ID Steam trovato per le copertine');
                return;
            }
            
            // Carica copertine in batch
            const covers = await this.invokeCommand('get_steam_covers_batch', { appids: steamAppIds });
            
            // Aggiorna le copertine nella UI
            Object.entries(covers).forEach(([appId, coverUrl]) => {
                const coverElement = document.getElementById(`cover-${appId}`);
                if (coverElement && coverUrl) {
                    const game = games.find(g => String(g.appid || g.id) === appId);
                    const gameName = game ? game.name || 'Gioco Sconosciuto' : 'Gioco Sconosciuto';
                    
                    coverElement.innerHTML = `<img src="${coverUrl}" alt="${gameName}" onerror="this.parentElement.innerHTML='<div class=\"game-cover-placeholder\">🎮 ${gameName}</div>'">`;
                }
            });
            
            console.log('✅ Caricate', Object.keys(covers).length, 'copertine');
            this.addActivity('🖼️ Copertine caricate', `${Object.keys(covers).length} immagini`);
            
        } catch (error) {
            console.error('❌ Errore caricamento copertine:', error);
            // Non mostrare errore all'utente, le copertine sono opzionali
        }
    }

    filterGames(searchTerm) {
        if (!searchTerm) {
            this.displayGames(this.games);
            return;
        }

        const filtered = this.games.filter(game => 
            (game.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        this.displayGames(filtered);
    }

    async viewGameDetails(gameId) {
        try {
            console.log(`👁️ Visualizzazione dettagli gioco: ${gameId}`);
            const details = await this.invokeCommand('get_game_details', { app_id: gameId });
            
            // Mostra i dettagli in un modal o alert per ora
            alert(`Dettagli Gioco:\n\nNome: ${details.name}\nDescrizione: ${details.short_description}\nLingue: ${details.supported_languages}`);
            
        } catch (error) {
            console.error('❌ Errore dettagli gioco:', error);
            this.showError('Errore caricamento dettagli: ' + error.message);
        }
    }

    async translateGame(gameId) {
        try {
            console.log(`🔤 Avvio traduzione gioco: ${gameId}`);
            // Per ora mostra un messaggio
            alert(`🔤 Traduzione gioco ${gameId} - Funzionalità in sviluppo`);
            
        } catch (error) {
            console.error('❌ Errore traduzione:', error);
            this.showError('Errore traduzione: ' + error.message);
        }
    }

    async translateText() {
        const sourceText = document.getElementById('source-text').value;
        const targetLang = document.getElementById('target-language').value;
        const provider = document.getElementById('ai-provider').value;
        const resultEl = document.getElementById('translated-text');
        
        if (!sourceText.trim()) {
            this.showError('Inserisci del testo da tradurre');
            return;
        }

        try {
            resultEl.textContent = '🔄 Traduzione in corso...';
            
            console.log(`🔤 Traduzione testo in ${targetLang} con ${provider}...`);
            
            const translation = await this.invokeCommand('translate_text', {
                text: sourceText,
                target_language: targetLang,
                provider: provider
            });
            
            resultEl.textContent = translation.translated_text || 'Traduzione non disponibile';
            this.addActivity('🔤 Testo tradotto', `${sourceText.substring(0, 30)}...`);
            
        } catch (error) {
            console.error('❌ Errore traduzione:', error);
            resultEl.textContent = '❌ Errore durante la traduzione: ' + error.message;
        }
    }

    displayPatches(patches) {
        const patchesList = document.getElementById('patches-list');
        
        if (!patches || patches.length === 0) {
            patchesList.innerHTML = '<div class="no-patches">🔨 Nessuna patch trovata</div>';
            return;
        }

        patchesList.innerHTML = patches.map(patch => `
            <div class="patch-item">
                <div class="patch-info">
                    <h4>${patch.name || 'Patch Senza Nome'}</h4>
                    <p>Gioco: ${patch.game_name || 'Sconosciuto'} | Lingua: ${patch.target_language || 'N/A'}</p>
                </div>
                <div class="patch-actions">
                    <button class="btn" onclick="app.editPatch('${patch.id}')">✏️ Modifica</button>
                    <button class="btn btn-secondary" onclick="app.exportPatch('${patch.id}')">📤 Esporta</button>
                </div>
            </div>
        `).join('');
    }

    async createPatch() {
        try {
            console.log('➕ Creazione nuova patch...');
            // Per ora mostra un messaggio
            alert('➕ Creazione patch - Funzionalità in sviluppo');
            
        } catch (error) {
            console.error('❌ Errore creazione patch:', error);
            this.showError('Errore creazione patch: ' + error.message);
        }
    }

    async testCommand(command, args = {}) {
        const outputEl = document.getElementById('test-output');
        
        try {
            outputEl.textContent += `\n🧪 Test comando: ${command}\n`;
            outputEl.textContent += `📥 Parametri: ${JSON.stringify(args, null, 2)}\n`;
            
            console.log(`🧪 Test comando: ${command}`, args);
            
            const result = await this.invokeCommand(command, args);
            
            outputEl.textContent += `✅ Risultato:\n${JSON.stringify(result, null, 2)}\n`;
            outputEl.textContent += `${'='.repeat(50)}\n`;
            
            // Scroll to bottom
            outputEl.scrollTop = outputEl.scrollHeight;
            
        } catch (error) {
            console.error(`❌ Errore test ${command}:`, error);
            outputEl.textContent += `❌ Errore: ${error.message}\n`;
            outputEl.textContent += `${'='.repeat(50)}\n`;
            outputEl.scrollTop = outputEl.scrollHeight;
        }
    }

    async invokeCommand(command, args = {}) {
        try {
            console.log(`📡 Invocazione comando Tauri: ${command}`, args);
            
            // Check if Tauri is available
            if (typeof window.__TAURI__ === 'undefined') {
                throw new Error('Tauri non disponibile - esegui l\'app in modalità Tauri');
            }
            
            const result = await window.__TAURI__.core.invoke(command, args);
            console.log(`✅ Comando ${command} completato:`, result);
            return result;
            
        } catch (error) {
            console.error(`❌ Errore comando ${command}:`, error);
            throw error;
        }
    }

    refreshCurrentPage() {
        console.log(`🔄 Aggiornamento pagina: ${this.currentPage}`);
        this.loadPageData(this.currentPage);
        this.addActivity('🔄 Pagina aggiornata', this.currentPage);
    }

    showSettings() {
        alert('⚙️ Impostazioni - Funzionalità in sviluppo');
    }

    addActivity(text, detail) {
        const activityList = document.getElementById('activity-list');
        const now = new Date().toLocaleTimeString('it-IT', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <span class="activity-icon">📝</span>
            <span class="activity-text">${text}</span>
            <span class="activity-time">${detail || now}</span>
        `;
        
        activityList.insertBefore(activityItem, activityList.firstChild);
        
        // Keep only last 5 activities
        while (activityList.children.length > 5) {
            activityList.removeChild(activityList.lastChild);
        }
    }

    showError(message) {
        console.error('❌ Errore:', message);
        // Per ora usa alert, in futuro si può creare un sistema di notifiche più elegante
        alert('❌ Errore: ' + message);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GameStringerApp();
});

// Global functions for onclick handlers
window.editPatch = (patchId) => {
    alert(`✏️ Modifica patch ${patchId} - Funzionalità in sviluppo`);
};

window.exportPatch = (patchId) => {
    alert(`📤 Esporta patch ${patchId} - Funzionalità in sviluppo`);
};

console.log('📱 GameStringer Simple UI caricata!');
