$f = "c:\dev\GameStringer\docs\USER_GUIDE_RU.md"
$lines = Get-Content $f -Encoding UTF8
for ($i = 1114; $i -le 1122; $i++) {
    Write-Host ("|" + $lines[$i] + "|")
}
