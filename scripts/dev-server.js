const { spawn } = require('child_process');
const net = require('net');

async function findAvailablePort(startPort = 3000) {
    const tryPort = (port) => {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.listen(port, () => {
                server.once('close', () => resolve(port));
                server.close();
            });
            server.on('error', () => resolve(false));
        });
    };

    for (let port = startPort; port <= startPort + 100; port++) {
        const available = await tryPort(port);
        if (available) return available;
    }
    throw new Error('Nessuna porta disponibile trovata');
}

async function startServer() {
    try {
        const port = await findAvailablePort(3000);
        console.log(`🚀 Avvio server Next.js sulla porta ${port}...`);
        
        // Salva la porta per Tauri
        require('fs').writeFileSync('.port', port.toString());
        
        const child = spawn('npx', ['next', 'dev', '-p', port.toString()], {
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
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

startServer();
