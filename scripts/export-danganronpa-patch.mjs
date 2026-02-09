/**
 * Export Danganronpa Patch — Crea .zip distribuibile
 * 
 * Contenuto dello zip:
 * - dr1_data_keyboard_us.wad  (WAD patchato v15, All-Ice + GameStringer)
 * - install.bat               (installer automatico Steam)
 * - LEGGIMI.txt               (istruzioni in italiano)
 * - translations.json          (traduzioni sorgente, per chi vuole modificarle)
 */

import { createReadStream, createWriteStream, existsSync, statSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { pipeline } from 'stream/promises';
import { createDeflateRaw } from 'zlib';

// ========== CONFIG ==========
const GAME_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Danganronpa Trigger Happy Havoc';
const PATCHED_WAD = join(GAME_PATH, 'dr1_data_keyboard_us.wad');
const TRANSLATIONS = join(GAME_PATH, 'GameStringer_Translation', 'translations.json');
const OUTPUT_DIR = join(process.cwd(), 'dist');
const ZIP_NAME = 'Danganronpa_ITA_Patch_GameStringer.zip';

// ========== VALIDAZIONE ==========
console.log('📦 Export Danganronpa Patch — GameStringer');
console.log('='.repeat(55));

if (!existsSync(PATCHED_WAD)) {
  console.error('❌ WAD patchato non trovato:', PATCHED_WAD);
  console.error('   Esegui prima: node scripts/patch-wad-v15.mjs');
  process.exit(1);
}

const wadSize = statSync(PATCHED_WAD).size;
const wadMB = (wadSize / (1024 * 1024)).toFixed(1);
console.log(`✅ WAD patchato trovato: ${wadMB} MB`);

if (existsSync(TRANSLATIONS)) {
  const tSize = (statSync(TRANSLATIONS).size / 1024).toFixed(1);
  console.log(`✅ Traduzioni trovate: ${tSize} KB`);
}

// ========== CONTENUTI EXTRA ==========

const README_IT = `╔══════════════════════════════════════════════════════╗
║   DANGANRONPA: TRIGGER HAPPY HAVOC — PATCH ITALIANO  ║
║          Creato con GameStringer                      ║
╚══════════════════════════════════════════════════════╝

📋 CONTENUTO PATCH
━━━━━━━━━━━━━━━━━
• dr1_data_keyboard_us.wad  — File di gioco patchato (italiano)
• translations.json         — Traduzioni sorgente (per modding)
• install.bat               — Installer automatico (Steam)

🎮 INSTALLAZIONE AUTOMATICA (consigliata)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Estrai lo .zip in una cartella qualsiasi
2. Doppio click su "install.bat"
3. Lo script troverà automaticamente il gioco su Steam
4. Verrà creato un backup del file originale (.backup)
5. Il WAD patchato verrà copiato nella cartella del gioco

🔧 INSTALLAZIONE MANUALE
━━━━━━━━━━━━━━━━━━━━━━━━
1. Trova la cartella del gioco:
   Steam → Danganronpa → Tasto destro → Gestisci → Sfoglia file locali
2. Fai un BACKUP di "dr1_data_keyboard_us.wad" (rinominalo .backup)
3. Copia il "dr1_data_keyboard_us.wad" di questa patch nella cartella del gioco

⚙️ ATTIVAZIONE IN GIOCO
━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANTE: Dopo l'installazione, nel gioco vai su:
   Impostazioni → Control Hints → seleziona "Keyboard and Mouse"
Il testo cambierà in italiano!

🔄 DISINSTALLAZIONE
━━━━━━━━━━━━━━━━━━━
Rinomina "dr1_data_keyboard_us.wad.backup" in "dr1_data_keyboard_us.wad"
oppure verifica l'integrità dei file su Steam.

📊 INFO PATCH
━━━━━━━━━━━━━
• Base: All-Ice Team (traduzione completa italiana)
• Override: GameStringer (traduzioni personalizzate)
• Copertura: 100% testo in italiano
• Compatibilità: Steam (versione PC)

💡 CREDITI
━━━━━━━━━━
• All-Ice Team — Traduzione base italiana completa
• GameStringer — Tool di traduzione e patch personalizzate
• Spike Chunsoft — Sviluppatore originale

⚠️ Questa patch è solo per uso personale e di fan-translation.
   Non ridistribuire il gioco originale.
`;

const INSTALL_BAT = `@echo off
chcp 65001 >nul 2>&1
title Danganronpa ITA Patch - GameStringer Installer
color 0A

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║  DANGANRONPA: TRIGGER HAPPY HAVOC                ║
echo  ║  PATCH ITALIANO — GameStringer Installer          ║
echo  ╚═══════════════════════════════════════════════════╝
echo.

:: Cerca cartella gioco Steam
set "STEAM_COMMON=C:\\Program Files (x86)\\Steam\\steamapps\\common"
set "GAME_FOLDER=Danganronpa Trigger Happy Havoc"
set "GAME_PATH=%STEAM_COMMON%\\%GAME_FOLDER%"
set "WAD_NAME=dr1_data_keyboard_us.wad"

if not exist "%GAME_PATH%" (
    echo  [!] Gioco non trovato nel percorso Steam predefinito.
    echo      Cercando in altre posizioni...
    
    :: Cerca in altre librerie Steam
    for /f "tokens=*" %%a in ('dir /b /s /ad "D:\\SteamLibrary\\steamapps\\common\\%GAME_FOLDER%" 2^>nul') do set "GAME_PATH=%%a"
    for /f "tokens=*" %%a in ('dir /b /s /ad "E:\\SteamLibrary\\steamapps\\common\\%GAME_FOLDER%" 2^>nul') do set "GAME_PATH=%%a"
    for /f "tokens=*" %%a in ('dir /b /s /ad "F:\\SteamLibrary\\steamapps\\common\\%GAME_FOLDER%" 2^>nul') do set "GAME_PATH=%%a"
)

if not exist "%GAME_PATH%" (
    echo.
    echo  [ERRORE] Danganronpa non trovato!
    echo  Installa il gioco da Steam o trascina la cartella qui.
    echo.
    pause
    exit /b 1
)

echo  [OK] Gioco trovato: %GAME_PATH%
echo.

:: Backup
if exist "%GAME_PATH%\\%WAD_NAME%" (
    if not exist "%GAME_PATH%\\%WAD_NAME%.backup" (
        echo  [1/3] Creazione backup...
        copy "%GAME_PATH%\\%WAD_NAME%" "%GAME_PATH%\\%WAD_NAME%.backup" >nul
        echo        Backup creato: %WAD_NAME%.backup
    ) else (
        echo  [1/3] Backup già esistente, skip.
    )
) else (
    echo  [1/3] File originale non presente, skip backup.
)

:: Copia WAD patchato
echo  [2/3] Installazione patch...
copy /Y "%~dp0%WAD_NAME%" "%GAME_PATH%\\%WAD_NAME%" >nul
if errorlevel 1 (
    echo.
    echo  [ERRORE] Impossibile copiare il file. Chiudi il gioco e riprova.
    pause
    exit /b 1
)
echo        WAD patchato installato!

:: Copia traduzioni (opzionale)
if exist "%~dp0translations.json" (
    echo  [3/3] Copia traduzioni sorgente...
    if not exist "%GAME_PATH%\\GameStringer_Translation" mkdir "%GAME_PATH%\\GameStringer_Translation"
    copy /Y "%~dp0translations.json" "%GAME_PATH%\\GameStringer_Translation\\translations.json" >nul
    echo        Traduzioni copiate.
) else (
    echo  [3/3] Traduzioni sorgente non incluse, skip.
)

echo.
echo  ╔═══════════════════════════════════════════════════╗
echo  ║  ✅ PATCH INSTALLATA CON SUCCESSO!                ║
echo  ║                                                   ║
echo  ║  Avvia Danganronpa e vai su:                      ║
echo  ║  Impostazioni → Control Hints → Keyboard+Mouse    ║
echo  ║  Il testo sarà in italiano!                       ║
echo  ╚═══════════════════════════════════════════════════╝
echo.
pause
`;

// ========== ZIP BUILDER (senza dipendenze esterne) ==========

class ZipBuilder {
  constructor(outputPath) {
    this.entries = [];
    this.outputPath = outputPath;
  }

  // CRC32 lookup table
  static crc32Table = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })();

  static crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc = ZipBuilder.crc32Table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  addBuffer(name, data) {
    this.entries.push({ name, data, size: data.length, type: 'buffer' });
  }

  addFile(name, filePath) {
    const size = statSync(filePath).size;
    this.entries.push({ name, filePath, size, type: 'file' });
  }

  async build() {
    console.log(`\n📦 Creazione ZIP: ${basename(this.outputPath)}`);
    
    const fd = createWriteStream(this.outputPath);
    let offset = 0;
    const centralEntries = [];

    for (const entry of this.entries) {
      const nameBuf = Buffer.from(entry.name, 'utf8');
      let data;
      
      if (entry.type === 'buffer') {
        data = entry.data;
      } else {
        // Per file grandi, leggi tutto in memoria (necessario per CRC32 + store)
        const sizeMB = (entry.size / (1024*1024)).toFixed(0);
        process.stdout.write(`   📄 ${entry.name} (${sizeMB} MB)... `);
        data = readFileSync(entry.filePath);
        process.stdout.write('letto, ');
      }

      const crc = ZipBuilder.crc32(data);
      
      // Local file header (store, no compression — WAD è già compresso internamente)
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);   // signature
      localHeader.writeUInt16LE(20, 4);            // version needed
      localHeader.writeUInt16LE(0, 6);             // flags
      localHeader.writeUInt16LE(0, 8);             // compression: store
      localHeader.writeUInt16LE(0, 10);            // mod time
      localHeader.writeUInt16LE(0, 12);            // mod date
      localHeader.writeUInt32LE(crc, 14);          // crc32
      localHeader.writeUInt32LE(data.length, 18);  // compressed size
      localHeader.writeUInt32LE(data.length, 22);  // uncompressed size
      localHeader.writeUInt16LE(nameBuf.length, 26); // name length
      localHeader.writeUInt16LE(0, 28);            // extra length

      const headerOffset = offset;
      fd.write(localHeader);
      fd.write(nameBuf);
      fd.write(data);
      offset += 30 + nameBuf.length + data.length;

      if (entry.type === 'file') {
        process.stdout.write('scritto ✅\n');
      }

      // Central directory entry
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);        // signature
      central.writeUInt16LE(20, 4);                // version made by
      central.writeUInt16LE(20, 6);                // version needed
      central.writeUInt16LE(0, 8);                 // flags
      central.writeUInt16LE(0, 10);                // compression: store
      central.writeUInt16LE(0, 12);                // mod time
      central.writeUInt16LE(0, 14);                // mod date
      central.writeUInt32LE(crc, 16);              // crc32
      central.writeUInt32LE(data.length, 20);      // compressed
      central.writeUInt32LE(data.length, 24);      // uncompressed
      central.writeUInt16LE(nameBuf.length, 28);   // name length
      central.writeUInt16LE(0, 30);                // extra length
      central.writeUInt16LE(0, 32);                // comment length
      central.writeUInt16LE(0, 34);                // disk number
      central.writeUInt16LE(0, 36);                // internal attr
      central.writeUInt32LE(0, 38);                // external attr
      central.writeUInt32LE(headerOffset, 42);     // local header offset
      
      centralEntries.push({ header: central, nameBuf });
    }

    // Central directory
    const cdStart = offset;
    for (const ce of centralEntries) {
      fd.write(ce.header);
      fd.write(ce.nameBuf);
      offset += 46 + ce.nameBuf.length;
    }
    const cdSize = offset - cdStart;

    // End of central directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(this.entries.length, 8);
    eocd.writeUInt16LE(this.entries.length, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdStart, 16);
    eocd.writeUInt16LE(0, 20);
    fd.write(eocd);

    await new Promise((resolve, reject) => {
      fd.on('finish', resolve);
      fd.on('error', reject);
      fd.end();
    });

    const zipSize = statSync(this.outputPath).size;
    return zipSize;
  }
}

// ========== MAIN ==========

import { mkdirSync } from 'fs';
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const zipPath = join(OUTPUT_DIR, ZIP_NAME);
const zip = new ZipBuilder(zipPath);

// Aggiungi file
zip.addFile('dr1_data_keyboard_us.wad', PATCHED_WAD);
zip.addBuffer('LEGGIMI.txt', Buffer.from(README_IT, 'utf8'));
zip.addBuffer('install.bat', Buffer.from(INSTALL_BAT, 'utf8'));

if (existsSync(TRANSLATIONS)) {
  zip.addFile('translations.json', TRANSLATIONS);
}

console.log('\n📋 Contenuto ZIP:');
for (const e of zip.entries) {
  const mb = (e.size / (1024*1024)).toFixed(1);
  console.log(`   ${e.name} — ${e.size > 1024*1024 ? mb + ' MB' : (e.size/1024).toFixed(1) + ' KB'}`);
}

const zipSize = await zip.build();
const zipMB = (zipSize / (1024*1024)).toFixed(1);

console.log('');
console.log('='.repeat(55));
console.log(`✅ ZIP CREATO: ${zipPath}`);
console.log(`   Dimensione: ${zipMB} MB`);
console.log('');
console.log('📤 Pronto per la distribuzione!');
