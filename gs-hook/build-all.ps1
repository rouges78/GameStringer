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
    [string]$Config = 'Release',

    # Impronta (thumbprint) del certificato di code signing da usare. Se assente
    # si legge da $env:GS_SIGN_THUMBPRINT; se manca anche quella, la firma viene
    # SALTATA e il build prosegue — cosi' chi non ha un certificato compila lo
    # stesso, e chi ce l'ha non deve ricordarsi un passaggio in piu'.
    [string]$SignThumbprint = $env:GS_SIGN_THUMBPRINT,

    # Server di marca temporale. Serve perche' la firma resti valida DOPO la
    # scadenza del certificato: senza, tutti i binari gia' spediti diventano
    # non firmati il giorno in cui il certificato scade.
    [string]$TimestampUrl = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'

# ── Firma digitale (opzionale) ───────────────────────────────────────────────
#
# PERCHE'. Defender mette in quarantena gs-injector.exe x86 come
# `Program:Win32/Contebrew.A!ml`: un eseguibile piccolo, non firmato, che chiama
# OpenProcess + VirtualAllocEx + CreateRemoteThread ha il profilo di un dropper.
# La firma con un certificato ATTENDIBILE e' la cura vera; i metadati di versione
# in injector/injector.rc sono il palliativo che si puo' fare senza certificato.
#
# Un certificato AUTO-GENERATO non serve a niente qui: non e' attendibile, non
# porta reputazione, e il binario viene messo in quarantena esattamente come
# prima. Serve un certificato di code signing vero (OV o, meglio, EV: l'EV ha
# reputazione immediata, l'OV se la costruisce nel tempo).

function Find-SignTool {
    # Il piu' recente signtool.exe x64 dei Windows Kits.
    $roots = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
        "$env:ProgramFiles\Windows Kits\10\bin"
    ) | Where-Object { Test-Path $_ }

    foreach ($r in $roots) {
        $c = Get-ChildItem $r -Filter 'signtool.exe' -Recurse -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName -match '\\x64\\' } |
             Sort-Object FullName -Descending |
             Select-Object -First 1
        if ($c) { return $c.FullName }
    }
    return $null
}

function Invoke-Sign {
    param([string[]]$Files, [string]$Thumbprint, [string]$Timestamp)

    if (-not $Thumbprint) {
        Write-Host "==> Firma saltata: nessun certificato indicato (-SignThumbprint / GS_SIGN_THUMBPRINT)" -ForegroundColor DarkYellow
        Write-Host "    I binari non firmati possono essere messi in quarantena dall'antivirus." -ForegroundColor DarkYellow
        return
    }

    $signtool = Find-SignTool
    if (-not $signtool) { throw "signtool.exe non trovato: installa il Windows SDK" }

    $cert = Get-ChildItem Cert:\CurrentUser\My, Cert:\LocalMachine\My -CodeSigningCert -ErrorAction SilentlyContinue |
            Where-Object { $_.Thumbprint -eq $Thumbprint } | Select-Object -First 1
    if (-not $cert) { throw "Certificato $Thumbprint non trovato negli archivi personali" }
    if (-not $cert.HasPrivateKey) { throw "Il certificato $Thumbprint non ha la chiave privata: non puo' firmare" }

    foreach ($f in $Files) {
        Write-Host "==> Firma $([System.IO.Path]::GetFileName($f))" -ForegroundColor Cyan
        & $signtool sign /sha1 $Thumbprint /fd SHA256 /td SHA256 /tr $Timestamp /q $f
        if ($LASTEXITCODE -ne 0) { throw "signtool ha fallito su $f" }

        # Verificare dopo aver firmato: "signtool sign" puo' uscire 0 e produrre
        # una firma che non convalida (catena incompleta, marca temporale non
        # raggiungibile). Senza questo controllo si spedisce un binario che
        # sembra firmato e non lo e'.
        & $signtool verify /pa /q $f
        if ($LASTEXITCODE -ne 0) { throw "la firma su $f non convalida" }
    }
}


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

    # Si firma PRIMA di copiare: cosi' l'artefatto spedito e quello nella build
    # dir sono lo stesso file, firma compresa.
    Invoke-Sign -Files @($dll, $exe) -Thumbprint $SignThumbprint -Timestamp $TimestampUrl

    Copy-Item $dll -Destination $destDir -Force
    Copy-Item $exe -Destination $destDir -Force
    Write-Host "==> Copiati gs-hook.dll + gs-injector.exe in $destDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "OK — artefatti dual-arch pronti in $resBase" -ForegroundColor Green
