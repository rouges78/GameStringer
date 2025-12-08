/**
 * Script per creare un profilo di test
 * Risolve il problema di autenticazione creando un profilo valido
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createTestProfile() {
  console.log('🔧 Creazione profilo di test...');
  
  try {
    // Percorso directory profili
    const profilesDir = path.join(process.cwd(), 'gamestringer_data', 'profiles');
    
    // Crea la directory se non esiste
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
      console.log('📁 Directory profili creata');
    }
    
    // Genera ID univoco per il profilo
    const profileId = crypto.randomUUID();
    const profileName = 'TestUser';
    const password = 'test123';
    
    // Hash della password (simuliamo l'hash che userebbe Tauri)
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    // Struttura del profilo con auto-login abilitato
    const profileData = {
      id: profileId,
      name: profileName,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      last_login: null,
      settings: {
        theme: 'dark',
        language: 'it',
        notifications: true,
        auto_login: true // 🔑 Abilita auto-login
      },
      steam_credentials: null,
      is_locked: false,
      failed_attempts: 0,
      last_failed_attempt: null
    };
    
    // Percorso file profilo
    const profileFile = path.join(profilesDir, `${profileId}.json`);
    
    // Salva il profilo
    fs.writeFileSync(profileFile, JSON.stringify(profileData, null, 2));
    
    console.log('✅ Profilo di test creato con successo!');
    console.log(`📋 Nome: ${profileName}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🆔 ID: ${profileId}`);
    console.log(`📁 File: ${profileFile}`);
    
    // Crea anche un file di configurazione globale con auto-login
    const configFile = path.join(profilesDir, 'config.json');
    const config = {
      last_active_profile: profileId,
      auto_login: true, // 🔑 Abilita auto-login globale
      profiles_count: 1,
      remember_password: true // 🔑 Ricorda password
    };
    
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log('⚙️ Configurazione globale creata');
    
    return {
      id: profileId,
      name: profileName,
      password: password
    };
    
  } catch (error) {
    console.error('❌ Errore nella creazione del profilo:', error);
    return null;
  }
}

function resetProfilesDirectory() {
  console.log('🗑️ Reset directory profili...');
  
  try {
    const profilesDir = path.join(process.cwd(), 'gamestringer_data', 'profiles');
    
    if (fs.existsSync(profilesDir)) {
      fs.rmSync(profilesDir, { recursive: true, force: true });
      console.log('✅ Directory profili eliminata');
    }
    
    // Ricrea la directory vuota
    fs.mkdirSync(profilesDir, { recursive: true });
    console.log('✅ Directory profili ricreata');
    
  } catch (error) {
    console.error('❌ Errore durante il reset:', error);
  }
}

function main() {
  console.log('🔧 Setup Profilo di Test\n');
  
  // Reset e creazione profilo pulito
  resetProfilesDirectory();
  const profile = createTestProfile();
  
  if (profile) {
    console.log('\n🎉 Setup completato!');
    console.log('\n📝 Per testare l\'autenticazione:');
    console.log(`   Nome utente: ${profile.name}`);
    console.log(`   Password: ${profile.password}`);
    console.log('\n🚀 Ora puoi avviare l\'applicazione con: npm run tauri dev');
  } else {
    console.log('\n❌ Setup fallito');
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  main();
}

module.exports = { createTestProfile, resetProfilesDirectory };