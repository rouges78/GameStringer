$file = "c:\dev\GameStringer\docs\USER_GUIDE_KO.md"
$lines = Get-Content $file -Encoding UTF8
# Remove duplicate index (lines 37-44, 1-indexed = indices 36-43)
# and duplicate body sections (lines 1125-1310, 1-indexed = indices 1124-1309)
$fixed = $lines[0..35] + $lines[44..1123] + $lines[1310..($lines.Count - 1)]
Set-Content $file $fixed -Encoding UTF8
Write-Host ("Done. Lines: " + $fixed.Count)
