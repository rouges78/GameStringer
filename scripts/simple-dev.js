#!/usr/bin/env node

const { spawn } = require('child_process');
const PortManager = require('./port-manager');

async function simpleDev() {
  console.log('🚀 === SIMPLE DEV SERVER ===');
  
  try {
    // 1. Sincronizza le porte
    console.log('📡 Sincronizzazione porte...');
    const portManager = new PortManager();
    const port = await portManager.synchronizePorts();
    
    // 2. Imposta variabili ambiente
    process.env.PORT = port.toString();
    process.env.NEXT_PUBLIC_PORT = port.toString();
    console.log(`✅ Porta configurata: ${port}`);
    
    // 3. Avvia Next.js direttamente
    console.log('🌐 Avvio Next.js...');
    
    const nextProcess = spawn('npm', ['run', 'dev:simple'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        PORT: port.toString(),
        NEXT_PUBLIC_PORT: port.toString()
      }
    });
    
    nextProcess.on('error', (error) => {
      console.error(`❌ Errore Next.js: ${error.message}`);
    });
    
    nextProcess.on('exit', (code) => {
      console.log(`👋 Next.js terminato con codice ${code}`);
      process.exit(code);
    });
    
    // Gestisce Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n🛑 Chiusura in corso...');
      nextProcess.kill('SIGTERM');
      setTimeout(() => {
        nextProcess.kill('SIGKILL');
        process.exit(0);
      }, 3000);
    });
    
    console.log('✅ === READY ===');
    console.log(`🌐 URL: http://localhost:${port}`);
    console.log(`🛠️  Store Manager: http://localhost:${port}/store-manager`);
    console.log('📝 Premi Ctrl+C per fermare');
    
  } catch (error) {
    console.error(`❌ Errore: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  simpleDev();
}

module.exports = simpleDev;