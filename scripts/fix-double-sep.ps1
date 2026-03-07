param([string]$file, [string]$anchor)

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Detect line ending
$nl = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }

$doubleSep = "---" + $nl + $nl + "---" + $nl + $nl + $anchor
$singleSep = "---" + $nl + $nl + $anchor

if ($content.Contains($doubleSep)) {
    $fixed = $content.Replace($doubleSep, $singleSep)
    [System.IO.File]::WriteAllText($file, $fixed, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed double separator in $file"
} else {
    Write-Host "Double separator not found in $file - no change needed"
}
