# GameStringer Native Injection Module

Modulo nativo per l'injection di traduzioni in tempo reale nei processi di gioco Windows.

## Requisiti

- Windows 10/11
- Node.js 16+ 
- Python 3.x (per node-gyp)
- Visual Studio Build Tools 2019+ o Visual Studio Community
- Privilegi di amministratore per l'injection

## Installazione

1. Installa le dipendenze di build:
```bash
npm install -g node-gyp
npm install node-addon-api
```

2. Compila il modulo nativo:
```bash
npm run build:native
```

## Utilizzo

Il modulo viene automaticamente caricato dal servizio di injection (`lib/injection-service.ts`).

### Funzioni disponibili:

- `injectTranslations(processId, translations)` - Inietta traduzioni in un processo
- `monitorProcess(processId)` - Monitora un processo per nuovi testi
- `getProcessModules(processId)` - Ottiene i moduli caricati da un processo
- `isProcess64Bit(processId)` - Verifica se un processo è a 64 bit
- `scanMemory(processId, pattern, mask)` - Cerca pattern nella memoria
- `readMemory(processId, address, size)` - Legge memoria da un indirizzo
- `writeMemory(processId, address, data)` - Scrive memoria a un indirizzo

## Sviluppo

In modalità sviluppo, il servizio usa automaticamente un mock del modulo nativo.
Per testare il modulo reale:

1. Compila il modulo: `npm run build:native`
2. Esegui GameStringer come amministratore
3. Imposta `NODE_ENV=production`

## Sicurezza

⚠️ **ATTENZIONE**: Questo modulo richiede privilegi di amministratore e modifica la memoria di altri processi. Usalo solo con giochi che possiedi legalmente.

## Troubleshooting

### Errore "Cannot find module"
Assicurati di aver compilato il modulo con `npm run build:native`

### Errore "Access denied"
Esegui GameStringer come amministratore

### Il gioco crasha dopo l'injection
Alcuni giochi hanno protezioni anti-cheat. Usa solo con giochi single-player offline.
