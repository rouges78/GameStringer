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

  // 3. Create catch-all fallback for dynamic routes
  // Static export doesn't generate /games/[id]/ pages.
  // Tauri serves files from out/ — when navigating to /games/steam_12345/
  // it needs a file at that path. We copy the main index.html as a 
  // catch-all __fallback.html and set up Tauri to use it.
  // Simpler approach: copy out/index.html as out/games/__dynamic.html
  // and configure Tauri's on_page_load to redirect unknown sub-routes.
  //
  // Best approach: create a minimal SPA shell that bootstraps Next.js
  // client-side router for any /games/* and /translator/* path.
  const outDir = path.join(PROJECT_ROOT, 'out');
  const mainIndex = path.join(outDir, 'index.html');

  if (fs.existsSync(mainIndex)) {
    const mainHtml = fs.readFileSync(mainIndex, 'utf8');
    const dynamicDirs = ['games', 'translator'];
    
    for (const dir of dynamicDirs) {
      const dirPath = path.join(outDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      // Copy main index.html into the dynamic route directory
      // This way /games/index.html exists and Tauri can serve it
      // The GameDetailClient reads the ID from URL params
      const targetIndex = path.join(dirPath, 'index.html');
      if (!fs.existsSync(targetIndex)) {
        fs.writeFileSync(targetIndex, mainHtml);
        log(`Created fallback ${dir}/index.html`);
      }
    }
    log('Dynamic route fallbacks created.');
  }
} finally {
  // 4. Restore all folders
  restore();
  delete process.env.TAURI_BUILD;
}

log('Tauri build preparation complete!');
