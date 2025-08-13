#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class PortManager {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.portFile = path.join(this.rootDir, '.port');
    this.tauriConfigFile = path.join(this.rootDir, 'src-tauri', 'tauri.conf.json');
    this.packageJsonFile = path.join(this.rootDir, 'package.json');
    this.defaultPort = 3101; // Allineato con la porta che Next.js cerca di usare
  }

  // Legge la porta dal file .port
  getPortFromFile() {
    try {
      if (fs.existsSync(this.portFile)) {
        const portContent = fs.readFileSync(this.portFile, 'utf8').trim();
        const port = parseInt(portContent);
        if (port && port > 0 && port < 65536) {
          console.log(`📌 Porta trovata in .port: ${port}`);
          return port;
        }
      }
    } catch (error) {
      console.warn(`⚠️  Errore lettura .port: ${error.message}`);
    }
    
    console.log(`📌 Usando porta di default: ${this.defaultPort}`);
    return this.defaultPort;
  }

  // Scrive la porta nel file .port
  writePortToFile(port) {
    try {
      fs.writeFileSync(this.portFile, port.toString(), 'utf8');
      console.log(`✅ Porta ${port} salvata in .port`);
    } catch (error) {
      console.error(`❌ Errore scrittura .port: ${error.message}`);
    }
  }

  // Aggiorna la configurazione Tauri
  updateTauriConfig(port) {
    try {
      if (!fs.existsSync(this.tauriConfigFile)) {
        console.warn(`⚠️  File tauri.conf.json non trovato: ${this.tauriConfigFile}`);
        return false;
      }

      const tauriConfig = JSON.parse(fs.readFileSync(this.tauriConfigFile, 'utf8'));
      const newDevUrl = `http://127.0.0.1:${port}`;
      
      if (tauriConfig.build && tauriConfig.build.devUrl !== newDevUrl) {
        tauriConfig.build.devUrl = newDevUrl;
        fs.writeFileSync(this.tauriConfigFile, JSON.stringify(tauriConfig, null, 2), 'utf8');
        console.log(`✅ tauri.conf.json aggiornato: devUrl = ${newDevUrl}`);
        return true;
      } else {
        console.log(`✅ tauri.conf.json già aggiornato: ${newDevUrl}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Errore aggiornamento tauri.conf.json: ${error.message}`);
      return false;
    }
  }

  // Aggiorna gli script package.json se necessario
  updatePackageJsonScripts(port) {
    try {
      if (!fs.existsSync(this.packageJsonFile)) {
        console.warn(`⚠️  File package.json non trovato: ${this.packageJsonFile}`);
        return false;
      }

      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonFile, 'utf8'));
      let updated = false;

      // Controlla se ci sono script che potrebbero aver bisogno di aggiornamento porte
      if (packageJson.scripts) {
        const devScript = packageJson.scripts.dev;
        if (devScript && devScript.includes('--port') && !devScript.includes(`--port ${port}`)) {
          // Aggiorna script dev se ha --port specificato
          packageJson.scripts.dev = devScript.replace(/--port \d+/, `--port ${port}`);
          updated = true;
        }
      }

      if (updated) {
        fs.writeFileSync(this.packageJsonFile, JSON.stringify(packageJson, null, 2), 'utf8');
        console.log(`✅ package.json aggiornato con porta ${port}`);
      }

      return updated;
    } catch (error) {
      console.error(`❌ Errore aggiornamento package.json: ${error.message}`);
      return false;
    }
  }

  // Verifica se la porta è disponibile
  async isPortAvailable(port) {
    const net = require('net');
    
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  // Trova la prossima porta disponibile
  async findAvailablePort(startPort = this.defaultPort) {
    for (let port = startPort; port < startPort + 100; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`Nessuna porta disponibile a partire da ${startPort}`);
  }

  // Sincronizza tutte le configurazioni
  async synchronizePorts(forcePort = null) {
    console.log('🔧 === PORT MANAGER === Sincronizzazione porte...');
    
    let targetPort;

    if (forcePort) {
      targetPort = forcePort;
      console.log(`🎯 Usando porta forzata: ${targetPort}`);
    } else {
      // Prova prima la porta dal file .port
      const currentPort = this.getPortFromFile();
      
      if (await this.isPortAvailable(currentPort)) {
        targetPort = currentPort;
        console.log(`✅ Porta ${currentPort} disponibile`);
      } else {
        console.log(`⚠️  Porta ${currentPort} occupata, cerco alternativa...`);
        targetPort = await this.findAvailablePort(currentPort);
        console.log(`🔍 Porta alternativa trovata: ${targetPort}`);
      }
    }

    // Sincronizza tutti i file di configurazione
    console.log(`\n🔧 Sincronizzazione porta ${targetPort}:`);
    
    // 1. Salva nel file .port
    this.writePortToFile(targetPort);
    
    // 2. Aggiorna tauri.conf.json
    this.updateTauriConfig(targetPort);
    
    // 3. Aggiorna package.json se necessario
    this.updatePackageJsonScripts(targetPort);

    console.log(`\n✅ === PORT MANAGER === Sincronizzazione completata!`);
    console.log(`📡 Porta configurata: ${targetPort}`);
    console.log(`🌐 URL dev: http://localhost:${targetPort}`);
    console.log(`🦀 URL Tauri: http://127.0.0.1:${targetPort}`);
    
    return targetPort;
  }

  // Esporta variabili d'ambiente per i processi figli
  exportEnvironmentVariables(port) {
    process.env.PORT = port.toString();
    process.env.NEXT_PUBLIC_PORT = port.toString();
    process.env.DEV_URL = `http://127.0.0.1:${port}`;
    
    console.log(`🌍 Variabili ambiente impostate:`);
    console.log(`   PORT=${port}`);
    console.log(`   NEXT_PUBLIC_PORT=${port}`);
    console.log(`   DEV_URL=http://127.0.0.1:${port}`);
  }

  // Verifica stato delle configurazioni
  async verifyConfiguration() {
    console.log('\n🔍 === VERIFICA CONFIGURAZIONE ===');
    
    const port = this.getPortFromFile();
    
    // Verifica .port
    console.log(`📄 .port: ${port}`);
    
    // Verifica tauri.conf.json
    try {
      const tauriConfig = JSON.parse(fs.readFileSync(this.tauriConfigFile, 'utf8'));
      const devUrl = tauriConfig.build?.devUrl || 'non configurato';
      console.log(`🦀 tauri.conf.json devUrl: ${devUrl}`);
      
      const expectedUrl = `http://127.0.0.1:${port}`;
      if (devUrl === expectedUrl) {
        console.log(`✅ tauri.conf.json sincronizzato`);
      } else {
        console.log(`❌ tauri.conf.json NON sincronizzato (atteso: ${expectedUrl})`);
      }
    } catch (error) {
      console.log(`❌ Errore lettura tauri.conf.json: ${error.message}`);
    }

    // Verifica disponibilità porta
    const available = await this.isPortAvailable(port);
    console.log(`🚪 Porta ${port} disponibile: ${available ? '✅' : '❌'}`);
    
    console.log('\n');
    return { port, available };
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const portManager = new PortManager();

  try {
    switch (args[0]) {
      case 'sync':
        const forcePort = args[1] ? parseInt(args[1]) : null;
        const port = await portManager.synchronizePorts(forcePort);
        portManager.exportEnvironmentVariables(port);
        break;
        
      case 'verify':
        await portManager.verifyConfiguration();
        break;
        
      case 'check':
        const currentPort = portManager.getPortFromFile();
        const available = await portManager.isPortAvailable(currentPort);
        console.log(`Porta ${currentPort}: ${available ? 'DISPONIBILE' : 'OCCUPATA'}`);
        process.exit(available ? 0 : 1);
        break;
        
      case 'find':
        const startPort = args[1] ? parseInt(args[1]) : portManager.defaultPort;
        const foundPort = await portManager.findAvailablePort(startPort);
        console.log(foundPort);
        break;
        
      default:
        console.log(`
🔧 Port Manager - GameStringer

Uso:
  node scripts/port-manager.js sync [porta]    # Sincronizza tutte le configurazioni
  node scripts/port-manager.js verify         # Verifica stato configurazioni
  node scripts/port-manager.js check          # Controlla se porta corrente è disponibile
  node scripts/port-manager.js find [porta]   # Trova porta disponibile

Esempi:
  node scripts/port-manager.js sync           # Auto-sincronizza
  node scripts/port-manager.js sync 3002      # Forza porta 3002
  node scripts/port-manager.js verify         # Verifica tutto
        `);
    }
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main();
}

module.exports = PortManager;