#!/usr/bin/env node
/**
 * Script per generare il file latest.json per l'updater di Tauri
 * Usa: node scripts/generate-update-json.js
 */

const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '..', 'version.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'latest.json');
const NSIS_DIR = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', 'nsis');

function getVersion() {
  const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  return versionData.version;
}

function getSignature() {
  const version = getVersion();
  const sigFile = path.join(NSIS_DIR, `GameStringer_${version}_x64-setup.exe.sig`);
  
  if (fs.existsSync(sigFile)) {
    return fs.readFileSync(sigFile, 'utf8').trim();
  }
  
  console.warn('⚠️  Signature file not found:', sigFile);
  return '';
}

function generateLatestJson() {
  const version = getVersion();
  const signature = getSignature();
  const downloadUrl = `https://github.com/rouges78/GameStringer/releases/download/v${version}/GameStringer_${version}_x64-setup.exe`;
  
  const latestJson = {
    version: version,
    notes: `GameStringer v${version} - Aggiornamento automatico`,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: signature,
        url: downloadUrl
      }
    }
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(latestJson, null, 2));
  console.log('✅ latest.json generato:', OUTPUT_FILE);
  console.log('   Versione:', version);
  console.log('   URL:', downloadUrl);
  console.log('   Firma:', signature ? '✓ Presente' : '✗ Mancante');
  
  return latestJson;
}

generateLatestJson();
