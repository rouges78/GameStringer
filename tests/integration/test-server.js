const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log('Richiesta ricevuta:', req.url);
  
  let filePath;
  if (req.url === '/' || req.url === '/index.html') {
    filePath = path.join(__dirname, 'simple-ui', 'index.html');
  } else if (req.url === '/styles.css') {
    filePath = path.join(__dirname, 'simple-ui', 'styles.css');
  } else if (req.url === '/app.js') {
    filePath = path.join(__dirname, 'simple-ui', 'app.js');
  } else {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('File non trovato');
      return;
    }
    
    let contentType = 'text/html';
    if (req.url.endsWith('.css')) contentType = 'text/css';
    if (req.url.endsWith('.js')) contentType = 'application/javascript';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server di test avviato su http://localhost:${PORT}`);
  console.log('📝 Ora puoi eseguire: npm run tauri dev -- --config tauri.conf.test.json');
});
