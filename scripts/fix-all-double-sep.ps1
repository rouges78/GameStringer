$fixes = @(
    @{ file = "c:\dev\GameStringer\docs\USER_GUIDE_JA.md"; keepBefore = 1176; skipTo = 1179 },
    @{ file = "c:\dev\GameStringer\docs\USER_GUIDE_KO.md"; keepBefore = 1266; skipTo = 1269 },
    @{ file = "c:\dev\GameStringer\docs\USER_GUIDE_RU.md"; keepBefore = 1267; skipTo = 1270 },
    @{ file = "c:\dev\GameStringer\docs\USER_GUIDE_ZH.md"; keepBefore = 1162; skipTo = 1165 }
)

foreach ($fix in $fixes) {
    $lines = Get-Content $fix.file -Encoding UTF8
    $fixed = $lines[0..$fix.keepBefore] + $lines[$fix.skipTo..($lines.Count - 1)]
    Set-Content $fix.file $fixed -Encoding UTF8
    Write-Host ("Fixed " + $fix.file + " — lines: " + $fixed.Count)
}
