#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Setup Git Hooks per GameStringer');

try {
  // Configura git hooks path
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
  
  // Rendi eseguibili tutti gli hooks
  const hooksDir = path.join(__dirname, '../.githooks');
  if (fs.existsSync(hooksDir)) {
    const hooks = fs.readdirSync(hooksDir);
    hooks.forEach(hook => {
      const hookPath = path.join(hooksDir, hook);
      fs.chmodSync(hookPath, '755');
      console.log(`✅ Hook ${hook} configurato`);
    });
  }
  
  console.log('🎉 Git hooks configurati con successo!');
  console.log('\nHooks disponibili:');
  console.log('  pre-commit: Auto-increment build number');
  
} catch (error) {
  console.error('❌ Errore setup hooks:', error.message);
  process.exit(1);
}