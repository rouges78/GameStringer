const path = require('path');

let nativeModule;

try {
  // Prova a caricare il modulo compilato
  nativeModule = require('./build/Release/gamestringer_injector.node');
} catch (error) {
  console.error('Modulo nativo non trovato. Compila con: npm run build:native');
  // Fallback a funzioni mock per sviluppo
  nativeModule = {
    injectTranslations: (processId, translations) => {
      console.log(`[MOCK] Injecting ${translations.length} translations to process ${processId}`);
      return {
        success: true,
        injectedCount: translations.length,
        injected: translations.map((t, i) => ({
          address: 0x1000 + i * 0x100,
          original: t.original,
          translated: t.translated
        }))
      };
    },
    monitorProcess: (processId) => {
      console.log(`[MOCK] Monitoring process ${processId}`);
      return { success: true, message: 'Mock monitoring started' };
    },
    getProcessModules: (processId) => {
      console.log(`[MOCK] Getting modules for process ${processId}`);
      return [];
    },
    isProcess64Bit: (processId) => {
      console.log(`[MOCK] Checking if process ${processId} is 64-bit`);
      return true;
    },
    scanMemory: (processId, pattern, mask) => {
      console.log(`[MOCK] Scanning memory in process ${processId}`);
      return [];
    },
    readMemory: (processId, address, size) => {
      console.log(`[MOCK] Reading ${size} bytes from ${address} in process ${processId}`);
      return Buffer.alloc(size);
    },
    writeMemory: (processId, address, data) => {
      console.log(`[MOCK] Writing ${data.length} bytes to ${address} in process ${processId}`);
      return true;
    }
  };
}

module.exports = nativeModule;
