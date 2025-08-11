#!/usr/bin/env node

/**
 * Script per resettare il sistema profili di GameStringer
 * Utile quando si rimane bloccati nella schermata di selezione profili
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Reset sistema profili GameStringer...');

// Percorsi dei file di configurazione profili
const profilesPaths = [
  'src-tauri/profiles.db',
  'src-tauri/profiles.sqlite',
  'src-tauri/profiles/',
  '.next/cache/',
  'node_modules/.cache/',
];

// Rimuovi file di cache e database profili
profilesPaths.forEach(profilePath => {
  const fullPath = path.resolve(profilePath);
  
  if (fs.existsSync(fullPath)) {
    try {
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        console.log(`📁 Rimozione directory: ${profilePath}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        console.log(`📄 Rimozione file: ${profilePath}`);
        fs.unlinkSync(fullPath);
      }
      
      console.log(`✅ Rimosso: ${profilePath}`);
    } catch (error) {
      console.log(`⚠️  Errore rimozione ${profilePath}:`, error.message);
    }
  } else {
    console.log(`ℹ️  Non trovato: ${profilePath}`);
  }
});

// Crea un profilo di default
const defaultProfile = {
  id: 'default-profile',
  name: 'Profilo Default',
  created_at: new Date().toISOString(),
  is_default: true,
  settings: {
    language: 'it',
    theme: 'dark',
    auto_translate: true
  }
};

// Salva configurazione di default
const configDir = 'src-tauri/profiles';
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const configPath = path.join(configDir, 'default.json');
fs.writeFileSync(configPath, JSON.stringify(defaultProfile, null, 2));

console.log('✅ Profilo default creato:', configPath);

// Aggiorna .env.local per saltare autenticazione
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  if (!envContent.includes('NEXT_PUBLIC_SKIP_AUTH')) {
    envContent += '\n# Skip authentication for development/testing\nNEXT_PUBLIC_SKIP_AUTH=true\n';
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Aggiornato .env.local per saltare autenticazione');
  }
}

console.log('\n🎉 Reset completato!');
console.log('💡 Suggerimenti:');
console.log('   1. Riavvia l\'applicazione con: npm run tauri dev');
console.log('   2. Se il problema persiste, controlla la console per errori');
console.log('   3. Per riabilitare l\'autenticazione, rimuovi NEXT_PUBLIC_SKIP_AUTH da .env.local');