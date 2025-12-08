/**
 * Script per reset rapido dei profili
 * Elimina completamente la directory profili senza richiedere password
 */

const fs = require('fs');
const path = require('path');

function resetProfiles() {
  console.log('🗑️ Reset completo profili...');
  
  try {
    const profilesDir = path.join(process.cwd(), 'gamestringer_data', 'profiles');
    
    if (fs.existsSync(profilesDir)) {
      fs.rmSync(profilesDir, { recursive: true, force: true });
      console.log('✅ Directory profili eliminata');
    } else {
      console.log('📝 Directory profili non esistente');
    }
    
    // Ricrea la directory vuota
    fs.mkdirSync(profilesDir, { recursive: true });
    console.log('✅ Directory profili ricreata');
    
    console.log('');
    console.log('🔄 Reset completato!');
    console.log('💡 Ora puoi:');
    console.log('   1. Riavviare l\'applicazione');
    console.log('   2. Verrà creato automaticamente un profilo "Default" con password "password123"');
    console.log('   3. Oppure creare un nuovo profilo personalizzato');
    
  } catch (error) {
    console.error('❌ Errore durante il reset:', error);
    process.exit(1);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  resetProfiles();
}

module.exports = { resetProfiles };