const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const iconsDir = path.join(__dirname, '..', 'src-tauri', 'icons');
const sourceFile = path.join(iconsDir, 'gs.png');

async function generateIcons() {
  console.log('🎨 Generazione icone da gs.png (275x275)...\n');

  if (!fs.existsSync(sourceFile)) {
    console.error('❌ File gs.png non trovato in src-tauri/icons/');
    process.exit(1);
  }

  const sizes = [
    { name: '32x32.png', size: 32 },
    { name: '128x128.png', size: 128 },
    { name: '128x128@2x.png', size: 256 },
  ];

  for (const { name, size } of sizes) {
    const outputPath = path.join(iconsDir, name);
    await sharp(sourceFile)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
    console.log(`✅ ${name} (${size}x${size})`);
  }

  // Genera anche le icone per ICO (16, 32, 48, 256)
  const icoSizes = [16, 32, 48, 256];
  const icoBuffers = [];
  
  for (const size of icoSizes) {
    const buffer = await sharp(sourceFile)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    icoBuffers.push({ size, buffer });
    console.log(`✅ ICO layer ${size}x${size}`);
  }

  // Salva i PNG per uso futuro
  const pngDir = path.join(iconsDir, 'png');
  if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir);
  
  for (const { size, buffer } of icoBuffers) {
    fs.writeFileSync(path.join(pngDir, `icon-${size}.png`), buffer);
  }

  console.log('\n✅ Icone PNG generate!');
  console.log('\n⚠️  Per creare icon.ico:');
  console.log('   1. Vai su https://icoconvert.com/ o https://convertio.co/');
  console.log('   2. Carica src-tauri/icons/png/icon-256.png');
  console.log('   3. Seleziona tutte le dimensioni (16, 32, 48, 256)');
  console.log('   4. Scarica e sostituisci src-tauri/icons/icon.ico');
}

generateIcons().catch(console.error);
