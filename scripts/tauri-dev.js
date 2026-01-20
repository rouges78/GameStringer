const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function updateTauriConfig(port) {
    const configPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config.build.devUrl = `http://127.0.0.1:${port}`;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`✅ Configurazione Tauri aggiornata per porta ${port}`);
    } catch (error) {
        console.error('❌ Errore aggiornamento configurazione Tauri:', error.message);
        throw error;
    }
}

function getPortFromFile() {
    try {
        const portFile = path.join(__dirname, '..', '.port');
        if (fs.existsSync(portFile)) {
            return fs.readFileSync(portFile, 'utf8').trim();
        }
    } catch (error) {
        console.log('⚠️ Impossibile leggere il file porta, uso 3000 di default');
    }
    return '3000';
}

async function startTauriDev() {
    try {
        const port = getPortFromFile();
        console.log(`🚀 Configurazione Tauri per porta ${port}...`);
        
        // Aggiorna configurazione Tauri con la porta corretta
        await updateTauriConfig(port);
        
        console.log(`🚀 Avvio Tauri dev...`);
        const child = spawn('tauri', ['dev'], {
            stdio: 'inherit',
            shell: true
        });

        child.on('error', (err) => {
            console.error('❌ Errore durante l\'avvio di Tauri:', err);
            process.exit(1);
        });

        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`👋 Tauri si è chiuso con codice ${code}`);
                process.exit(code);
            }
        });
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

startTauriDev();