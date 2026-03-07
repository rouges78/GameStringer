$files = @('USER_GUIDE_JA.md','USER_GUIDE_KO.md','USER_GUIDE_RU.md','USER_GUIDE_ZH.md')
foreach ($f in $files) {
    $path = "c:\dev\GameStringer\docs\$f"
    $lines = Get-Content $path -Encoding UTF8
    for ($i = 0; $i -lt $lines.Count - 2; $i++) {
        if ($lines[$i] -eq '---' -and $lines[$i+1] -eq '' -and $lines[$i+2] -eq '---') {
            Write-Host "$f : double --- at lines $($i+1)-$($i+3)"
        }
    }
}
Write-Host "Check done."
