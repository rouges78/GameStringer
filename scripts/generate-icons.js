const sharp = require('sharp');
// png-to-ico, NON to-ico: facevano la stessa cosa (erano installati ENTRAMBI),
// ma il bump Dependabot to-ico 1.0.1→1.1.5 del 04/08/2026 ha portato dentro
// resize-img→jimp@0.2.28 (2016) con request/form-data/jpeg-js/minimist vulnerabili:
// 12 advisory di colpo, 5 critical, audit-gate rosso. Un convertitore basta.
// png-to-ico 3.x è transpilato da ESM: require() ritorna { __esModule, default },
// non la funzione. Senza il .default il primo run è morto con
// "pngToIco is not a function" — trovato dalla prova d'effetto, non dai gate.
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;
const path = require('path');
const fs = require('fs');

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
const sourceFile = path.join(iconsDir, 'icon-neon.svg');

async function generateIcons() {
  console.log('🎨 Generazione icone dalla nuova icona SVG...\n');

  if (!fs.existsSync(sourceFile)) {
    console.error('❌ File icon-neon.svg non trovato in src-tauri/icons/');
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(sourceFile);

  // Tutte le dimensioni necessarie per Tauri
  const sizes = [
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
    { name: '256x256.png', size: 256 },
    { name: '512x512.png', size: 512 },
    { name: 'icon.png', size: 512 },
  ];

  for (const { name, size } of sizes) {
    const outputPath = path.join(iconsDir, name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✅ ${name} (${size}x${size})`);
  }

  // Genera layers PNG per ICO (16, 32, 48, 256)
  const icoSizes = [16, 32, 48, 256];
  const pngDir = path.join(iconsDir, 'png');
  if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir);
  
  const icoPngPaths = [];
  for (const size of icoSizes) {
    const buffer = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    const pngPath = path.join(pngDir, `icon-${size}.png`);
    fs.writeFileSync(pngPath, buffer);
    icoPngPaths.push(pngPath);
    console.log(`✅ ICO layer ${size}x${size}`);
  }

  // Genera icon.ico dai layer PNG appena scritti su disco
  try {
    const icoBuffer = await pngToIco(icoPngPaths);
    fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);
    console.log('✅ icon.ico generato automaticamente!');
  } catch (e) {
    console.warn('⚠️  icon.ico fallito:', e.message);
  }

  console.log('\n✅ Tutte le icone generate!');
  console.log('\n💡 Per Mac (icon.icns):');
  console.log('   1. Vai su https://cloudconvert.com/png-to-icns');
  console.log('   2. Carica src-tauri/icons/512x512.png');
  console.log('   3. Salva come src-tauri/icons/icon.icns');
}

generateIcons().catch(console.error);
