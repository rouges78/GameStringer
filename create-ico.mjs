import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';

async function createIco() {
  const ico = await pngToIco(['src-tauri/icons/256x256.png']);
  writeFileSync('src-tauri/icons/icon.ico', ico);
  console.log('✅ icon.ico creato!');
}

createIco().catch(console.error);
