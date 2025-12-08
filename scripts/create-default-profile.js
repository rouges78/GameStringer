/**
 * Script per creare un profilo di default
 * Risolve l'errore "Credenziali non valide" quando non ci sono profili nel sistema
 */

const { invoke } = require('@tauri-apps/api/tauri');

async function createDefaultProfile() {
  console.log('🔧 Creazione profilo di default...');
  
  try {
    // Verifica se ci sono già profili
    const profiles = await invoke('list_profiles');
    
    if (profiles && profiles.length > 0) {
      console.log('✅ Profili esistenti trovati:', profiles.length);
      console.log('📋 Profili disponibili:');
      profiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ${profile.name} (ID: ${profile.id})`);
      });
      return;
    }
    
    console.log('📝 Nessun profilo trovato, creazione profilo di default...');
    
    // Crea profilo di default
    const defaultProfile = {
      name: 'Default',
      password: 'password123',
      avatarPath: null
    };
    
    const response = await invoke('create_profile', defaultProfile);
    
    if (response.success) {
      console.log('✅ Profilo di default creato con successo!');
      console.log('📋 Dettagli profilo:');
      console.log(`   Nome: ${response.data.name}`);
      console.log(`   ID: ${response.data.id}`);
      console.log(`   Password: ${defaultProfile.password}`);
      console.log('');
      console.log('🔐 Ora puoi accedere con:');
      console.log(`   Nome utente: ${response.data.name}`);
      console.log(`   Password: ${defaultProfile.password}`);
    } else {
      console.error('❌ Errore nella creazione del profilo:', response.error);
    }
    
  } catch (error) {
    console.error('❌ Errore durante la creazione del profilo:', error);
    
    // Se Tauri non è disponibile, mostra istruzioni manuali
    if (error.message && error.message.includes('__TAURI_IPC__')) {
      console.log('');
      console.log('💡 Sembra che Tauri non sia in esecuzione.');
      console.log('   Per creare un profilo di default:');
      console.log('   1. Avvia l\'applicazione con: npm run tauri dev');
      console.log('   2. Nell\'interfaccia, clicca su "Crea Nuovo Profilo"');
      console.log('   3. Inserisci nome: "Default" e password: "password123"');
    }
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  createDefaultProfile();
}

module.exports = { createDefaultProfile };