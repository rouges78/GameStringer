#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const PortManager = require('./port-manager');

class UnifiedDevServer {
  constructor() {
    this.portManager = new PortManager();
    this.processes = new Map();
    this.isShuttingDown = false;
  }

  // Gestisce la chiusura pulita di tutti i processi
  setupGracefulShutdown() {
    const cleanup = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      console.log(`\n🛑 Ricevuto ${signal}, chiusura processi...`);
      
      // Chiudi tutti i processi
      for (const [name, process] of this.processes) {
        console.log(`🔪 Terminando ${name}...`);
        try {
          process.kill('SIGTERM');
          // Aspetta un po' per la chiusura pulita
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        } catch (error) {
          console.warn(`⚠️  Errore terminazione ${name}: ${error.message}`);
        }
      }
      
      console.log('👋 Arrivederci!');
      process.exit(0);
    };

    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('SIGTERM', () => cleanup('SIGTERM'));
    process.on('SIGHUP', () => cleanup('SIGHUP'));
    
    // Gestisce Ctrl+C su Windows
    if (process.platform === 'win32') {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.on('SIGINT', () => cleanup('SIGINT'));
    }
  }

  // Spawna un processo e lo monitora
  spawnProcess(name, command, args = [], options = {}) {
    console.log(`🚀 Avvio ${name}: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    process.on('error', (error) => {
      console.error(`❌ Errore ${name}: ${error.message}`);
    });

    process.on('exit', (code, signal) => {
      this.processes.delete(name);
      if (!this.isShuttingDown) {
        if (code === 0) {
          console.log(`✅ ${name} terminato normalmente`);
        } else {
          console.error(`❌ ${name} terminato con codice ${code} (signal: ${signal})`);
        }
      }
    });

    this.processes.set(name, process);
    return process;
  }

  // Avvia il server Next.js
  async startNextJS(port) {
    console.log(`🌐 Avvio Next.js sulla porta ${port}...`);
    
    const nextProcess = this.spawnProcess(
      'Next.js',
      'npm',
      ['run', 'dev:simple'],  // Usa dev:simple per evitare loop
      {
        env: {
          ...process.env,
          PORT: port.toString(),
          NEXT_PUBLIC_PORT: port.toString()
        }
      }
    );

    // Aspetta che Next.js sia pronto
    console.log('⏳ Attendendo che Next.js sia pronto...');
    await new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // 60 secondi max
      
      const checkNext = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(checkNext);
          console.log('⚠️  Timeout Next.js - continuo comunque...');
          resolve();
          return;
        }
        
        try {
          const response = await fetch(`http://localhost:${port}`);
          if (response.ok) {
            clearInterval(checkNext);
            console.log(`✅ Next.js pronto su http://localhost:${port}`);
            resolve();
          }
        } catch (error) {
          // Continua ad aspettare
          console.log(`🔄 Tentativo ${attempts}/${maxAttempts}...`);
        }
      }, 2000);
    });

    return nextProcess;
  }

  // Avvia Tauri dev
  async startTauri() {
    console.log('🦀 Avvio Tauri dev...');
    
    const tauriProcess = this.spawnProcess(
      'Tauri',
      'cargo',
      ['tauri', 'dev'],
      {
        cwd: path.join(process.cwd(), 'src-tauri')
      }
    );

    return tauriProcess;
  }

  // Avvia tutto il sistema di sviluppo
  async startDevelopment(mode = 'full') {
    try {
      console.log('🔧 === UNIFIED DEV SERVER ===');
      console.log(`🎯 Modalità: ${mode}`);
      
      // 1. Sincronizza le porte
      console.log('\n📡 Fase 1: Sincronizzazione porte...');
      const port = await this.portManager.synchronizePorts();
      this.portManager.exportEnvironmentVariables(port);
      
      // 2. Verifica configurazione
      console.log('\n🔍 Fase 2: Verifica configurazione...');
      await this.portManager.verifyConfiguration();
      
      // 3. Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // 4. Avvia Next.js
      console.log('\n🌐 Fase 3: Avvio Next.js...');
      await this.startNextJS(port);
      
      if (mode === 'full' || mode === 'tauri') {
        // 5. Avvia Tauri (se richiesto e cargo disponibile)
        console.log('\n🦀 Fase 4: Avvio Tauri...');
        try {
          await this.startTauri();
        } catch (error) {
          console.warn(`⚠️  Tauri non disponibile: ${error.message}`);
          console.log('💡 Continuo solo con Next.js...');
        }
      }
      
      console.log('\n✅ === SISTEMA PRONTO ===');
      console.log(`🌐 Frontend: http://localhost:${port}`);
      console.log(`🛠️  Store Manager: http://localhost:${port}/store-manager`);
      if (mode === 'full' || mode === 'tauri') {
        console.log(`🦀 Tauri: Finestra desktop aperta`);
      }
      console.log('\n📝 Log in tempo reale. Premi Ctrl+C per fermare tutto.');
      
      // Mantieni il processo attivo
      await new Promise(() => {}); // Infinito fino a interruzione
      
    } catch (error) {
      console.error(`❌ Errore critico: ${error.message}`);
      process.exit(1);
    }
  }

  // Modalità solo Next.js
  async startNextOnly() {
    return this.startDevelopment('next');
  }

  // Modalità completa con Tauri
  async startFull() {
    return this.startDevelopment('full');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const devServer = new UnifiedDevServer();

  try {
    switch (args[0]) {
      case 'next':
        console.log('🌐 Modalità: Solo Next.js');
        await devServer.startNextOnly();
        break;
        
      case 'tauri':
      case 'full':
        console.log('🦀 Modalità: Completa (Next.js + Tauri)');
        await devServer.startFull();
        break;
        
      case 'port':
        // Solo sincronizzazione porte
        const portManager = new PortManager();
        const port = await portManager.synchronizePorts(args[1] ? parseInt(args[1]) : null);
        console.log(`✅ Porte sincronizzate sulla ${port}`);
        break;
        
      default:
        console.log(`
🔧 Unified Dev Server - GameStringer

Uso:
  node scripts/unified-dev.js [modalità]

Modalità:
  next          # Solo Next.js (frontend)
  tauri|full    # Next.js + Tauri (completo)
  port [N]      # Solo sincronizzazione porte

Esempi:
  node scripts/unified-dev.js next        # Solo web
  node scripts/unified-dev.js tauri       # Desktop app
  node scripts/unified-dev.js port 3002   # Forza porta 3002

Script npm equivalenti:
  npm run dev          → next
  npm run tauri:dev    → tauri
        `);
        process.exit(0);
    }
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main();
} else {
  module.exports = UnifiedDevServer;
}