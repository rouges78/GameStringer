# GameStringer Release Build Script
# Genera Setup.exe e Portable.zip per Windows

param(
    [string]$Version = "1.0.6"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DistFolder = Join-Path $ProjectRoot "dist"
$ReleaseFolder = Join-Path $ProjectRoot "release"

Write-Host "🎮 GameStringer Release Builder v$Version" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Pulisci cartelle precedenti
Write-Host "`n📁 Pulizia cartelle..." -ForegroundColor Yellow
if (Test-Path $ReleaseFolder) { Remove-Item $ReleaseFolder -Recurse -Force }
New-Item -ItemType Directory -Path $ReleaseFolder -Force | Out-Null

# 2. Build Frontend Next.js
Write-Host "`n⚡ Build Frontend (Next.js)..." -ForegroundColor Yellow
Set-Location $ProjectRoot
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

# 3. Build Tauri (genera .exe e .msi)
Write-Host "`n🦀 Build Tauri (Rust backend)..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }

# 4. Trova i file generati
$TauriBuildFolder = Join-Path $ProjectRoot "src-tauri\target\release\bundle"
$MsiFile = Get-ChildItem -Path "$TauriBuildFolder\msi\*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
$NsisFile = Get-ChildItem -Path "$TauriBuildFolder\nsis\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$ExeFile = Join-Path $ProjectRoot "src-tauri\target\release\GameStringer.exe"

# 5. Crea Setup (usa NSIS se disponibile, altrimenti MSI)
Write-Host "`n📦 Preparazione Release..." -ForegroundColor Yellow

if ($NsisFile) {
    $SetupName = "GameStringer-$Version-Setup.exe"
    Copy-Item $NsisFile.FullName (Join-Path $ReleaseFolder $SetupName)
    Write-Host "  ✅ Setup: $SetupName" -ForegroundColor Green
} elseif ($MsiFile) {
    $SetupName = "GameStringer-$Version-Setup.msi"
    Copy-Item $MsiFile.FullName (Join-Path $ReleaseFolder $SetupName)
    Write-Host "  ✅ Setup: $SetupName" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ Nessun installer trovato" -ForegroundColor Yellow
}

# 6. Crea Portable ZIP
Write-Host "`n📦 Creazione Portable..." -ForegroundColor Yellow
$PortableFolder = Join-Path $ReleaseFolder "GameStringer-Portable"
New-Item -ItemType Directory -Path $PortableFolder -Force | Out-Null

# Copia exe e risorse necessarie
if (Test-Path $ExeFile) {
    Copy-Item $ExeFile $PortableFolder
    
    # Copia DLL necessarie se presenti
    $DllFiles = Get-ChildItem -Path (Split-Path $ExeFile) -Filter "*.dll" -ErrorAction SilentlyContinue
    foreach ($dll in $DllFiles) {
        Copy-Item $dll.FullName $PortableFolder
    }
    
    # Copia WebView2Loader se presente
    $WebView2 = Join-Path (Split-Path $ExeFile) "WebView2Loader.dll"
    if (Test-Path $WebView2) {
        Copy-Item $WebView2 $PortableFolder
    }
    
    # Crea ZIP
    $PortableZip = "GameStringer-$Version-Portable.zip"
    Compress-Archive -Path "$PortableFolder\*" -DestinationPath (Join-Path $ReleaseFolder $PortableZip) -Force
    Remove-Item $PortableFolder -Recurse -Force
    Write-Host "  ✅ Portable: $PortableZip" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ GameStringer.exe non trovato" -ForegroundColor Yellow
}

# 7. Genera checksums
Write-Host "`n🔐 Generazione checksums..." -ForegroundColor Yellow
$ChecksumFile = Join-Path $ReleaseFolder "checksums-sha256.txt"
$ReleaseFiles = Get-ChildItem -Path $ReleaseFolder -File | Where-Object { $_.Extension -in ".exe", ".msi", ".zip" }
foreach ($file in $ReleaseFiles) {
    $hash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash
    "$hash  $($file.Name)" | Add-Content $ChecksumFile
}
Write-Host "  ✅ checksums-sha256.txt" -ForegroundColor Green

# 8. Riepilogo
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "🎉 Release $Version pronta!" -ForegroundColor Green
Write-Host "📂 Cartella: $ReleaseFolder" -ForegroundColor White
Write-Host "`nFile generati:" -ForegroundColor White
Get-ChildItem $ReleaseFolder | ForEach-Object {
    $size = "{0:N2} MB" -f ($_.Length / 1MB)
    Write-Host "  - $($_.Name) ($size)" -ForegroundColor Gray
}

Write-Host "`n📤 Prossimi passi:" -ForegroundColor Yellow
Write-Host "  1. Vai su https://github.com/rouges78/GameStringer/releases/new" -ForegroundColor White
Write-Host "  2. Tag: v$Version" -ForegroundColor White
Write-Host "  3. Titolo: GameStringer v$Version" -ForegroundColor White
Write-Host "  4. Carica i file dalla cartella release/" -ForegroundColor White
Write-Host "  5. Copia le release notes da RELEASE_NOTES.md" -ForegroundColor White
