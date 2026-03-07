param([string]$targetFile, [string]$sectionsFile, [string]$anchor)

$target = [System.IO.File]::ReadAllText($targetFile, [System.Text.Encoding]::UTF8)
$newSections = [System.IO.File]::ReadAllText($sectionsFile, [System.Text.Encoding]::UTF8)

$idx = $target.IndexOf($anchor)
if ($idx -lt 0) {
    Write-Host "ERROR: anchor not found: $anchor"
    exit 1
}

# Find the --- separator just before anchor
$sepIdx = $target.LastIndexOf("---", $idx)
if ($sepIdx -lt 0) { Write-Host "ERROR: --- separator not found"; exit 1 }

$before = $target.Substring(0, $sepIdx)
$after = $target.Substring($sepIdx)

$result = $before + $newSections + $after
[System.IO.File]::WriteAllText($targetFile, $result, [System.Text.Encoding]::UTF8)
Write-Host "Done. Inserted sections from $sectionsFile into $targetFile at position $sepIdx"
