#!/usr/bin/env node

/**
 * Script per risolvere i problemi del database e Prisma su Windows
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Risoluzione problemi database GameStringer\n');

const projectRoot = path.join(__dirname, '..');
const prismaDir = path.join(projectRoot, 'prisma');
const dbPath = path.join(prismaDir, 'dev.db');
const prismaClientDir = path.join(projectRoot, 'node_modules', '.prisma');

// 1. Verifica se il database esiste
console.log('📁 Controllo database...');
if (fs.existsSync(dbPath)) {
  console.log('✅ Database esistente trovato');
} else {
  console.log('⚠️  Database non trovato, verrà creato');
}

// 2. Pulisci la cache di Prisma
console.log('\n🧹 Pulizia cache Prisma...');
try {
  if (fs.existsSync(prismaClientDir)) {
    // Prova a rimuovere la directory .prisma
    try {
      fs.rmSync(prismaClientDir, { recursive: true, force: true });
      console.log('✅ Cache Prisma pulita');
    } catch (err) {
      console.log('⚠️  Impossibile rimuovere completamente la cache:', err.message);
    }
  }
} catch (err) {
  console.log('⚠️  Errore durante la pulizia:', err.message);
}

// 3. Crea/aggiorna il database
console.log('\n💾 Creazione/aggiornamento database...');
try {
  execSync('npx prisma db push --skip-generate', { 
    cwd: projectRoot,
    stdio: 'inherit'
  });
  console.log('✅ Database creato/aggiornato con successo');
} catch (err) {
  console.error('❌ Errore durante la creazione del database:', err.message);
  process.exit(1);
}

// 4. Verifica che il database sia stato creato
if (!fs.existsSync(dbPath)) {
  console.error('❌ Il database non è stato creato correttamente');
  process.exit(1);
}

// 5. Mostra informazioni sul database
const stats = fs.statSync(dbPath);
console.log(`\n📊 Informazioni database:`);
console.log(`   Percorso: ${dbPath}`);
console.log(`   Dimensione: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`   Ultima modifica: ${stats.mtime.toLocaleString()}`);

// 6. Prova a generare il client Prisma
console.log('\n🔨 Generazione client Prisma...');
console.log('⚠️  Se questo passaggio fallisce con errori di permessi:');
console.log('   1. Chiudi tutti i processi Node.js');
console.log('   2. Esegui PowerShell come amministratore');
console.log('   3. Esegui: npx prisma generate');

try {
  execSync('npx prisma generate', { 
    cwd: projectRoot,
    stdio: 'inherit'
  });
  console.log('✅ Client Prisma generato con successo');
} catch (err) {
  console.log('\n⚠️  Generazione client fallita (probabilmente per permessi)');
  console.log('   Il database è comunque stato creato correttamente.');
  console.log('   L\'applicazione potrebbe funzionare anche senza rigenerare il client.');
}

// 7. Crea alcuni dati di test
console.log('\n🌱 Creazione dati di esempio...');
const seedScript = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    // Crea un utente di test
    const user = await prisma.user.upsert({
      where: { email: 'test@gamestringer.com' },
      update: {},
      create: {
        email: 'test@gamestringer.com',
        name: 'Test User',
      }
    });
    
    // Crea un gioco di esempio
    const game = await prisma.game.upsert({
      where: { 
        title_platform: {
          title: 'The Witcher 3',
          platform: 'steam'
        }
      },
      update: {},
      create: {
        title: 'The Witcher 3',
        platform: 'steam',
        installPath: 'C:\\\\Games\\\\The Witcher 3',
        isInstalled: true,
        userId: user.id
      }
    });
    
    console.log('✅ Dati di esempio creati');
  } catch (err) {
    console.log('⚠️  Impossibile creare dati di esempio:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
`;

const seedPath = path.join(projectRoot, 'scripts', 'temp-seed.js');
fs.writeFileSync(seedPath, seedScript);

try {
  execSync('node scripts/temp-seed.js', { 
    cwd: projectRoot,
    stdio: 'inherit'
  });
} catch (err) {
  console.log('⚠️  Seed fallito:', err.message);
} finally {
  // Rimuovi il file temporaneo
  if (fs.existsSync(seedPath)) {
    fs.unlinkSync(seedPath);
  }
}

console.log('\n✨ Processo completato!');
console.log('\n📝 Prossimi passi:');
console.log('   1. Riavvia il server: npm run dev');
console.log('   2. Visita: http://localhost:3001');
console.log('   3. Le API dovrebbero ora funzionare correttamente');
