# build-all.ps1 — builda gs-hook.dll + gs-injector.exe per x64 e x86 (Win32)
# e copia gli artefatti nelle resources Tauri per il bundling.
#
# Prerequisiti:
#   - Visual Studio 2022 (o Build Tools) con toolset C++ x64 e x86
#   - CMake >= 3.20 nel PATH
#
# Uso (da PowerShell):
#   .\gs-hook\build-all.ps1                # Release (default)
#   .\gs-hook\build-all.ps1 -Config Debug
#
# Output:
#   src-tauri\resources\gs-hook\x64\{gs-hook.dll, gs-injector.exe}
#   src-tauri\resources\gs-hook\x86\{gs-hook.dll, gs-injector.exe}

param(
    [ValidateSet('Release', 'Debug')]
    [string]$Config = 'Release'
)

$ErrorActionPreference = 'Stop'

$hookDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $hookDir
$resBase  = Join-Path $repoRoot 'src-tauri\resources\gs-hook'

# (tag arch per CMake -A, sottocartella resources, build dir dedicata)
$targets = @(
    @{ Arch = 'x64';   Dir = 'x64'; Out = 'build-x64' },
    @{ Arch = 'Win32'; Dir = 'x86'; Out = 'build-x86' }
)

foreach ($t in $targets) {
    $buildDir = Join-Path $hookDir $t.Out

    # Una CMakeCache.txt ricorda il percorso ASSOLUTO da cui è stata generata:
    # se il repo è stato spostato (o clonato altrove), cmake si rifiuta di
    # riconfigurare con un errore che sembra un problema di sorgenti
    # ("does not match the source ... used to generate cache"). Le build dir
    # sono gitignorate e rigenerabili: se la cache non corrisponde, si butta.
    $cache = Join-Path $buildDir 'CMakeCache.txt'
    if (Test-Path $cache) {
        $home_ = (Select-String -Path $cache -Pattern '^CMAKE_HOME_DIRECTORY:INTERNAL=(.*)$' |
                  Select-Object -First 1).Matches.Groups[1].Value
        if ($home_ -and ($home_.Replace('\', '/').TrimEnd('/') -ne $hookDir.Replace('\', '/').TrimEnd('/'))) {
            Write-Host "==> Cache stantia in $buildDir (generata da $home_): la rimuovo" -ForegroundColor Yellow
            Remove-Item -Recurse -Force $buildDir
        }
    }

    Write-Host "==> Configurazione $($t.Arch) in $buildDir" -ForegroundColor Cyan
    cmake -S $hookDir -B $buildDir -A $t.Arch
    if ($LASTEXITCODE -ne 0) { throw "cmake configure fallita per $($t.Arch)" }

    Write-Host "==> Build $($t.Arch) ($Config)" -ForegroundColor Cyan
    cmake --build $buildDir --config $Config
    if ($LASTEXITCODE -ne 0) { throw "cmake build fallita per $($t.Arch)" }

    $destDir = Join-Path $resBase $t.Dir
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null

    $dll = Join-Path $buildDir "bin\$Config\gs-hook.dll"
    $exe = Join-Path $buildDir "bin\$Config\gs-injector.exe"

    if (!(Test-Path $dll)) { throw "DLL non trovata: $dll" }
    if (!(Test-Path $exe)) { throw "Injector non trovato: $exe" }

    Copy-Item $dll -Destination $destDir -Force
    Copy-Item $exe -Destination $destDir -Force
    Write-Host "==> Copiati gs-hook.dll + gs-injector.exe in $destDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "OK — artefatti dual-arch pronti in $resBase" -ForegroundColor Green
