#!/usr/bin/env node

/**
 * Test rapido per verificare se il server è raggiungibile
 */

const http = require('http');

function testUrl(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      console.log(`✅ ${url} - Status: ${res.statusCode}`);
      resolve(true);
    });

    req.on('error', (err) => {
      console.log(`❌ ${url} - Error: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`❌ ${url} - Timeout`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Test rapido connessione server\n');
  
  const urls = [
    'http://localhost:3001',
    'http://localhost:3001/patches',
    'http://localhost:3001/api/games',
    'http://localhost:3001/api/patches',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3001/api/games'
  ];

  for (const url of urls) {
    await testUrl(url);
  }
}

runTests();
