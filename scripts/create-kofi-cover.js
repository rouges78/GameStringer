const sharp = require('sharp');

const w = 1200, h = 400;
const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1b4b"/>
      <stop offset="50%" style="stop-color:#312e81"/>
      <stop offset="100%" style="stop-color:#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <text x="600" y="160" font-family="Arial Black, sans-serif" font-size="72" fill="white" text-anchor="middle" font-weight="900">GAMESTRINGER</text>
  <text x="600" y="230" font-family="Arial, sans-serif" font-size="28" fill="#94a3b8" text-anchor="middle">Translate your favorite games into any language</text>
  <text x="600" y="300" font-family="Arial, sans-serif" font-size="20" fill="#60a5fa" text-anchor="middle">AI Translation • OCR • Unity Patcher • Unreal Engine</text>
  <text x="600" y="340" font-family="Arial, sans-serif" font-size="18" fill="#22d3ee" text-anchor="middle">Free &amp; Open Source</text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile('kofi-cover.png')
  .then(() => console.log('✅ Cover creata: kofi-cover.png (1200x400)'))
  .catch(console.error);
