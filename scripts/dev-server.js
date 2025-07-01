#!/usr/bin/env node

/**
 * Script di sviluppo intelligente per GameStringer
 * Gestisce automaticamente le porte occupate per frontend e backend
 */

const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Configurazione porte predefinite
const DEFAULT_FRONTEND_PORT = 3000;
const DEFAULT_BACKEND_PORT = 3001;
const PORT_RANGE = 10; // Prova fino a 10 porte consecutive

// Funzione per verificare se una porta è disponibile
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Trova una porta disponibile partendo da quella specificata
async function findAvailablePort(startPort, name) {
  console.log(`🔍 Cercando porta disponibile per ${name}...`);
  
  for (let port = startPort; port < startPort + PORT_RANGE; port++) {
    if (await isPortAvailable(port)) {
      console.log(`✅ Porta ${port} disponibile per ${name}`);
      return port;
    }
    console.log(`⚠️  Porta ${port} occupata`);
  }
  
  throw new Error(`Nessuna porta disponibile nel range ${startPort}-${startPort + PORT_RANGE}`);
}

// Crea o aggiorna il file .env.local con le porte dinamiche
function updateEnvFile(frontendPort, backendPort) {
  const envPath = path.join(__dirname, '..', '.env.local');
  let envContent = '';
  
  // Leggi il contenuto esistente se il file esiste
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Funzione per aggiornare o aggiungere una variabile
  const updateVar = (name, value) => {
    const regex = new RegExp(`^${name}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${name}=${value}`);
    } else {
      envContent += `\n${name}=${value}`;
    }
  };
  
  // Aggiorna le variabili delle porte
  updateVar('PORT', frontendPort);
  updateVar('NEXT_PUBLIC_API_URL', `http://localhost:${frontendPort}`);
  updateVar('NEXT_PUBLIC_FRONTEND_PORT', frontendPort);
  updateVar('NEXT_PUBLIC_BACKEND_PORT', backendPort);
  
  // Scrivi il file aggiornato
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('✅ File .env.local aggiornato con le nuove porte');
}

// Avvia il server Next.js
function startNextServer(port) {
  console.log('\n🚀 Avvio server Next.js...');
  
  const env = {
    ...process.env,
    PORT: port,
    FORCE_COLOR: '1'
  };
  
  const nextProcess = spawn('npm', ['run', 'next-dev'], {
    env,
    stdio: 'inherit',
    shell: true
  });
  
  nextProcess.on('error', (err) => {
    console.error('❌ Errore nell\'avvio di Next.js:', err);
    process.exit(1);
  });
  
  return nextProcess;
}

// Main
async function main() {
  console.log('\n🎮 GameStringer Development Server\n');
  
  try {
    // Trova porte disponibili
    const frontendPort = await findAvailablePort(DEFAULT_FRONTEND_PORT, 'Frontend');
    const backendPort = await findAvailablePort(DEFAULT_BACKEND_PORT, 'Backend API');
    
    // Aggiorna il file .env.local
    updateEnvFile(frontendPort, backendPort);
    
    // Mostra le URL
    console.log('\n✨ Server pronti su:');
    console.log(`   Frontend: http://localhost:${frontendPort}`);
    console.log(`   API:      http://localhost:${frontendPort}/api`);
    console.log(`   (Le API sono servite dallo stesso server Next.js)`);
    
    // Avvia Next.js
    const nextProcess = startNextServer(frontendPort);
    
    // Gestisci la chiusura pulita
    process.on('SIGINT', () => {
      console.log('\n\n👋 Chiusura server...');
      nextProcess.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

// Avvia lo script
main();
