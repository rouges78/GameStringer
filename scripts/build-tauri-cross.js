#!/usr/bin/env node
// GameStringer Tauri Build Script (Cross-platform)
// Builds static export for Tauri production

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const BACKUPS = [
  { src: 'app/api', dst: 'app/_api_backup' },
  { src: 'app/games/[id]', dst: 'app/games/_id_backup' },
  { src: 'app/translator/[gameId]', dst: 'app/translator/_gameId_backup' },
];

function log(msg) {
  console.log(`[BUILD] ${msg}`);
}

function rmrf(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function moveDir(src, dst) {
  try {
    fs.renameSync(src, dst);
  } catch {
    // Fallback: copy + delete (handles EPERM on Windows when files are locked)
    fs.cpSync(src, dst, { recursive: true });
    try { rmrf(src); } catch { /* ignore delete failure */ }
  }
}

// 1. Backup incompatible folders
for (const item of BACKUPS) {
  const fullPath = path.join(PROJECT_ROOT, item.src);
  const backupPath = path.join(PROJECT_ROOT, item.dst);
  if (fs.existsSync(fullPath)) {
    log(`Backing up ${item.src}...`);
    rmrf(backupPath);
    moveDir(fullPath, backupPath);
  }
}

function restore() {
  for (const item of BACKUPS) {
    const fullPath = path.join(PROJECT_ROOT, item.src);
    const backupPath = path.join(PROJECT_ROOT, item.dst);
    if (fs.existsSync(backupPath)) {
      log(`Restoring ${item.src}...`);
      rmrf(fullPath);
      moveDir(backupPath, fullPath);
    }
  }
}

try {
  // 2. Build Next.js with static export
  log('Building Next.js (static export)...');
  process.env.TAURI_BUILD = 'true';
  execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  log('Next.js build complete!');
} finally {
  // 3. Restore all folders
  restore();
  delete process.env.TAURI_BUILD;
}

log('Tauri build preparation complete!');
