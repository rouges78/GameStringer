import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const svgPath = 'src-tauri/icons/gamestringer-icon-globe-text.svg';
const iconsDir = 'src-tauri/icons';

async function convertIcon() {
  const svgBuffer = readFileSync(svgPath);
  
  // Genera PNG in varie dimensioni
  const sizes = [32, 128, 256, 512];
  
  for (const size of sizes) {
    const outputPath = join(iconsDir, `${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✓ Creato ${outputPath}`);
  }
  
  // 128x128@2x (256px)
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(join(iconsDir, '128x128@2x.png'));
  console.log('✓ Creato 128x128@2x.png');
  
  // Crea anche 32x32 per ICO
  const ico32 = await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toBuffer();
  
  const ico256 = await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toBuffer();
    
  console.log('\\n✅ Conversione completata!');
  console.log('Per creare icon.ico, usa: https://convertio.co/png-ico/');
  console.log('Carica il file 256x256.png e scarica ICO');
}

convertIcon().catch(console.error);
