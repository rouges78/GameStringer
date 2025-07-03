const { spawn } = require('child_process');

console.log('🚀 Avvio server Next.js...');

const child = spawn('npx', ['next', 'dev'], {
    stdio: 'inherit',
    shell: true
});

child.on('error', (err) => {
    console.error('❌ Errore durante l\'avvio del server Next.js:', err);
    process.exit(1);
});

child.on('close', (code) => {
    if (code !== 0) {
        console.error(`👋 Il server Next.js si è chiuso con codice ${code}`);
        process.exit(code);
    }
});
