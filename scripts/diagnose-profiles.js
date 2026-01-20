/**
 * Script di Diagnostica Profili
 * 
 * Questo script verifica lo stato del sistema profili e identifica
 * eventuali problemi con profili multipli attivi.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnostica Sistema Profili\n');
console.log('=' .repeat(60));

// Percorso dati profili
const profilesDataPath = path.join(process.cwd(), 'gamestringer_data', 'profiles');

console.log('\n📁 Percorso profili:', profilesDataPath);

// Verifica esistenza directory
if (!fs.existsSync(profilesDataPath)) {
  console.log('❌ Directory profili non trovata');
  process.exit(1);
}

// Leggi tutti i file profilo
const profileFiles = fs.readdirSync(profilesDataPath)
  .filter(file => file.endsWith('.json'));

console.log('\n📊 Profili Trovati:', profileFiles.length);
console.log('=' .repeat(60));

const profiles = [];

// Analizza ogni profilo
profileFiles.forEach((file, index) => {
  const filePath = path.join(profilesDataPath, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const profile = JSON.parse(content);
    profiles.push(profile);
    
    console.log(`\n${index + 1}. Profilo: ${profile.name || 'N/A'}`);
    console.log(`   ID: ${profile.id || 'N/A'}`);
    console.log(`   Creato: ${profile.created_at || 'N/A'}`);
    console.log(`   Ultimo accesso: ${profile.last_accessed || 'N/A'}`);
    console.log(`   Bloccato: ${profile.is_locked ? '🔒 Sì' : '✅ No'}`);
    console.log(`   Tentativi falliti: ${profile.failed_attempts || 0}`);
  } catch (error) {
    console.log(`\n❌ Errore lettura profilo ${file}:`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log('\n📈 Riepilogo:');
console.log(`   Profili totali: ${profiles.length}`);
console.log(`   Profili bloccati: ${profiles.filter(p => p.is_locked).length}`);
console.log(`   Profili con tentativi falliti: ${profiles.filter(p => p.failed_attempts > 0).length}`);

// Verifica profili duplicati
const profileNames = profiles.map(p => p.name);
const duplicateNames = profileNames.filter((name, index) => profileNames.indexOf(name) !== index);

if (duplicateNames.length > 0) {
  console.log('\n⚠️  ATTENZIONE: Profili duplicati trovati!');
  console.log('   Nomi duplicati:', [...new Set(duplicateNames)]);
} else {
  console.log('\n✅ Nessun profilo duplicato trovato');
}

// Verifica profilo attivo (se esiste un file di sessione)
const sessionPath = path.join(process.cwd(), 'gamestringer_data', 'settings', 'session.json');

if (fs.existsSync(sessionPath)) {
  try {
    const sessionContent = fs.readFileSync(sessionPath, 'utf8');
    const session = JSON.parse(sessionContent);
    
    console.log('\n🔐 Sessione Attiva:');
    console.log(`   Profilo ID: ${session.profile_id || 'N/A'}`);
    console.log(`   Profilo Nome: ${session.profile_name || 'N/A'}`);
    console.log(`   Autenticato: ${session.is_authenticated ? '✅ Sì' : '❌ No'}`);
    console.log(`   Ultimo aggiornamento: ${session.last_updated || 'N/A'}`);
    
    // Verifica che il profilo della sessione esista
    const sessionProfile = profiles.find(p => p.id === session.profile_id);
    if (!sessionProfile) {
      console.log('\n⚠️  ATTENZIONE: Il profilo della sessione non esiste più!');
    } else {
      console.log('\n✅ Profilo della sessione valido');
    }
  } catch (error) {
    console.log('\n❌ Errore lettura sessione:', error.message);
  }
} else {
  console.log('\n📝 Nessuna sessione attiva trovata');
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ Diagnostica completata\n');

// Conclusioni
console.log('💡 Note:');
console.log('   - "Profili totali" mostra TUTTI i profili creati nel sistema');
console.log('   - Solo UN profilo può essere autenticato alla volta');
console.log('   - Se vedi "3 profili", significa che hai creato 3 profili');
console.log('   - Questo NON significa che ci sono 3 profili attivi simultaneamente\n');
