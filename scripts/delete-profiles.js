/**
 * Script per eliminare profili
 * Permette di eliminare profili specifici o tutti i profili
 */

const { invoke } = require('@tauri-apps/api/tauri');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function listProfiles() {
  try {
    const response = await invoke('list_profiles');
    if (response.success && response.data) {
      return response.data;
    } else {
      console.error('❌ Errore nel caricamento profili:', response.error);
      return [];
    }
  } catch (error) {
    console.error('❌ Errore nel caricamento profili:', error);
    return [];
  }
}

async function deleteProfile(profileId, password) {
  try {
    const response = await invoke('delete_profile', { 
      profile_id: profileId, 
      password: password 
    });
    
    if (response.success) {
      console.log('✅ Profilo eliminato con successo');
      return true;
    } else {
      console.error('❌ Errore nell\'eliminazione:', response.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Errore nell\'eliminazione:', error);
    return false;
  }
}

async function deleteAllProfiles() {
  console.log('🗑️ Eliminazione di tutti i profili...');
  
  const profiles = await listProfiles();
  
  if (profiles.length === 0) {
    console.log('📝 Nessun profilo da eliminare');
    return;
  }
  
  console.log(`📋 Trovati ${profiles.length} profili:`);
  profiles.forEach((profile, index) => {
    console.log(`   ${index + 1}. ${profile.name} (ID: ${profile.id})`);
  });
  
  const confirm = await askQuestion('\n⚠️ Sei sicuro di voler eliminare TUTTI i profili? (si/no): ');
  
  if (confirm.toLowerCase() !== 'si' && confirm.toLowerCase() !== 'yes') {
    console.log('❌ Operazione annullata');
    return;
  }
  
  console.log('\n🔐 Per eliminare i profili, inserisci la password per ciascuno:');
  
  for (const profile of profiles) {
    console.log(`\n🔑 Eliminazione profilo: ${profile.name}`);
    
    let attempts = 0;
    let success = false;
    
    while (attempts < 3 && !success) {
      const password = await askQuestion(`   Password per ${profile.name}: `);
      
      if (password.trim() === '') {
        console.log('   ⏭️ Saltato (password vuota)');
        break;
      }
      
      success = await deleteProfile(profile.id, password);
      
      if (!success) {
        attempts++;
        if (attempts < 3) {
          console.log(`   ❌ Password errata. Tentativi rimanenti: ${3 - attempts}`);
        } else {
          console.log(`   ❌ Troppi tentativi falliti per ${profile.name}`);
        }
      }
    }
  }
  
  console.log('\n✅ Operazione completata');
}

async function deleteSpecificProfile() {
  console.log('🗑️ Eliminazione profilo specifico...');
  
  const profiles = await listProfiles();
  
  if (profiles.length === 0) {
    console.log('📝 Nessun profilo disponibile');
    return;
  }
  
  console.log('📋 Profili disponibili:');
  profiles.forEach((profile, index) => {
    console.log(`   ${index + 1}. ${profile.name} (ID: ${profile.id})`);
  });
  
  const choice = await askQuestion('\nSeleziona il numero del profilo da eliminare (0 per annullare): ');
  const profileIndex = parseInt(choice) - 1;
  
  if (profileIndex < 0 || profileIndex >= profiles.length) {
    console.log('❌ Selezione non valida');
    return;
  }
  
  const selectedProfile = profiles[profileIndex];
  console.log(`\n🔑 Eliminazione profilo: ${selectedProfile.name}`);
  
  const password = await askQuestion('Password: ');
  
  if (password.trim() === '') {
    console.log('❌ Password richiesta');
    return;
  }
  
  const success = await deleteProfile(selectedProfile.id, password);
  
  if (success) {
    console.log(`✅ Profilo "${selectedProfile.name}" eliminato con successo`);
  }
}

async function resetProfilesDirectory() {
  const fs = require('fs');
  const path = require('path');
  
  console.log('🗑️ Reset completo directory profili...');
  
  const confirm = await askQuestion('⚠️ ATTENZIONE: Questo eliminerà TUTTI i dati dei profili senza richiedere password. Continuare? (RESET/no): ');
  
  if (confirm !== 'RESET') {
    console.log('❌ Operazione annullata');
    return;
  }
  
  try {
    const profilesDir = path.join(process.cwd(), 'gamestringer_data', 'profiles');
    
    if (fs.existsSync(profilesDir)) {
      fs.rmSync(profilesDir, { recursive: true, force: true });
      console.log('✅ Directory profili eliminata');
    }
    
    // Ricrea la directory vuota
    fs.mkdirSync(profilesDir, { recursive: true });
    console.log('✅ Directory profili ricreata');
    
    console.log('🔄 Reset completato. Riavvia l\'applicazione per creare nuovi profili.');
    
  } catch (error) {
    console.error('❌ Errore durante il reset:', error);
  }
}

async function main() {
  console.log('🗑️ Script Eliminazione Profili\n');
  
  try {
    // Verifica se Tauri è disponibile
    await invoke('list_profiles');
  } catch (error) {
    if (error.message && error.message.includes('__TAURI_IPC__')) {
      console.log('💡 Tauri non è in esecuzione. Opzioni disponibili:');
      console.log('   1. Avvia l\'applicazione con: npm run tauri dev');
      console.log('   2. Oppure usa il reset manuale della directory\n');
      
      const choice = await askQuestion('Vuoi fare un reset manuale della directory profili? (si/no): ');
      
      if (choice.toLowerCase() === 'si' || choice.toLowerCase() === 'yes') {
        await resetProfilesDirectory();
      }
      
      rl.close();
      return;
    }
    
    console.error('❌ Errore di connessione:', error);
    rl.close();
    return;
  }
  
  console.log('Opzioni disponibili:');
  console.log('1. Elimina tutti i profili');
  console.log('2. Elimina profilo specifico');
  console.log('3. Reset completo directory profili');
  console.log('0. Esci');
  
  const choice = await askQuestion('\nScegli un\'opzione: ');
  
  switch (choice) {
    case '1':
      await deleteAllProfiles();
      break;
    case '2':
      await deleteSpecificProfile();
      break;
    case '3':
      await resetProfilesDirectory();
      break;
    case '0':
      console.log('👋 Uscita');
      break;
    default:
      console.log('❌ Opzione non valida');
  }
  
  rl.close();
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { deleteProfile, deleteAllProfiles, resetProfilesDirectory };