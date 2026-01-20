@echo off
echo 🚀 Avvio GameStringer Desktop...
echo.
echo Chiudo processi bloccanti...
taskkill /f /im msedgewebview2.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Avvio applicazione desktop...
cd src-tauri
set RUST_BACKTRACE=1
cargo run --release --jobs 1

pause
