# GameStringer Font Bundle - Download Script
# Scarica i font Noto necessari per la traduzione multi-lingua

$ErrorActionPreference = "Stop"

$FontsDir = "$PSScriptRoot\Fonts"
New-Item -ItemType Directory -Path $FontsDir -Force | Out-Null

Write-Host "🔤 GameStringer Font Bundle Downloader" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# URLs dei font Noto (Google Fonts)
$fonts = @{
    "NotoSans-Regular" = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf"
    "NotoSans-Bold" = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf"
    "NotoSansCJKjp-Regular" = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf"
    "NotoSansCJKsc-Regular" = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf"
    "NotoSansCJKkr-Regular" = "https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf"
}

foreach ($font in $fonts.GetEnumerator()) {
    $name = $font.Key
    $url = $font.Value
    $ext = if ($url -match "\.otf$") { "otf" } else { "ttf" }
    $outFile = "$FontsDir\$name.$ext"
    
    if (Test-Path $outFile) {
        Write-Host "⏭️  $name già presente, skip" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "📥 Downloading $name..." -ForegroundColor Green
    try {
        Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing
        Write-Host "   ✅ Completato: $((Get-Item $outFile).Length / 1MB)MB" -ForegroundColor Green
    }
    catch {
        Write-Host "   ❌ Errore: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Download completato!" -ForegroundColor Cyan
Write-Host "   Font salvati in: $FontsDir" -ForegroundColor White
Write-Host ""
Write-Host "Prossimi passi:" -ForegroundColor Yellow
Write-Host "1. Apri Unity Editor" -ForegroundColor White
Write-Host "2. Importa i font in Assets/Fonts/" -ForegroundColor White
Write-Host "3. Crea i TextMeshPro Font Assets" -ForegroundColor White
Write-Host "4. Esegui Build Font Bundle" -ForegroundColor White
