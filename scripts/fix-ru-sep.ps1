$f = "c:\dev\GameStringer\docs\USER_GUIDE_RU.md"
$lines = Get-Content $f -Encoding UTF8
$fixed = $lines[0..1116] + $lines[1119..($lines.Count - 1)]
Set-Content $f $fixed -Encoding UTF8
Write-Host ("Done. Lines: " + $fixed.Count)
