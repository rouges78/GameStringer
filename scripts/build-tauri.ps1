# GameStringer Tauri Build Script
# Builds static export for Tauri production

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "[BUILD] Preparing Tauri Build..." -ForegroundColor Cyan

# Folders to backup (not compatible with static export)
$Backups = @(
    @{ Path = "app\api"; Backup = "app\_api_backup" }
    @{ Path = "app\games\``[id``]"; Backup = "app\games\_id_backup" }
    @{ Path = "app\translator\``[gameId``]"; Backup = "app\translator\_gameId_backup" }
)

# 1. Backup incompatible folders
foreach ($item in $Backups) {
    $FullPath = Join-Path $ProjectRoot $item.Path
    $BackupPath = Join-Path $ProjectRoot $item.Backup
    if (Test-Path $FullPath) {
        Write-Host "[BUILD] Backing up $($item.Path)..." -ForegroundColor Yellow
        if (Test-Path $BackupPath) { Remove-Item $BackupPath -Recurse -Force }
        Move-Item $FullPath $BackupPath -Force
    }
}

try {
    # 2. Build Next.js with static export
    Write-Host "[BUILD] Building Next.js (static export)..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    $env:TAURI_BUILD = "true"
    npm run build
    
    if ($LASTEXITCODE -ne 0) { throw "Next.js build failed" }
    
    Write-Host "[BUILD] Next.js build complete!" -ForegroundColor Green
}
finally {
    # 3. Restore all folders
    foreach ($item in $Backups) {
        $FullPath = Join-Path $ProjectRoot $item.Path
        $BackupPath = Join-Path $ProjectRoot $item.Backup
        if (Test-Path $BackupPath) {
            Write-Host "[BUILD] Restoring $($item.Path)..." -ForegroundColor Yellow
            if (Test-Path $FullPath) { Remove-Item $FullPath -Recurse -Force }
            Move-Item $BackupPath $FullPath -Force
        }
    }
    $env:TAURI_BUILD = $null
}

Write-Host "[BUILD] Tauri build preparation complete!" -ForegroundColor Green
