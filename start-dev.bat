@echo off
title GameStringer Dev Server
echo 🚀 === GAMESTRINGER DEV SERVER ===
echo.

REM Controlla se Node.js è disponibile
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js non trovato nel PATH
    echo 💡 Soluzioni:
    echo    1. Installa Node.js da https://nodejs.org
    echo    2. Riavvia il terminale dopo l'installazione
    echo    3. Verifica con: node --version
    pause
    exit /b 1
)

REM Controlla se npm è disponibile  
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm non trovato nel PATH
    echo 💡 npm dovrebbe essere incluso con Node.js
    pause
    exit /b 1
)

echo ✅ Node.js e npm trovati
echo.

REM Vai alla directory del progetto
cd /d "%~dp0"

REM Sincronizza le porte
echo 📡 Sincronizzazione porte...
node scripts/port-manager.js sync
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Errore sincronizzazione porte
    pause
    exit /b 1
)
echo.

REM Leggi la porta dal file .port
set /p PORT=<.port
echo ✅ Porta configurata: %PORT%
echo.

REM Avvia Next.js
echo 🌐 Avvio Next.js...
echo ⚡ URL: http://localhost:%PORT%
echo 🛠️  Store Manager: http://localhost:%PORT%/store-manager
echo.
echo 📝 Premi Ctrl+C per fermare il server
echo.

set PORT=%PORT%
set NEXT_PUBLIC_PORT=%PORT%
npm run dev:simple

pause