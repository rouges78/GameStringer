$file = "c:\dev\GameStringer\docs\USER_GUIDE_KO.md"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Fix duplicate index: remove the second block of entries 25-32
# After call 1, entries 25-32 appear; call 2 inserted another set right after "24. [...]"
# The pattern is: 32.[문화적 적응] immediately followed by 25.[용어집]
$idx = $content.IndexOf("32. [")
while ($idx -ge 0) {
    $after = $content.IndexOf("`n", $idx)
    if ($after -ge 0) {
        $nextLine = $content.Substring($after + 1, [Math]::Min(30, $content.Length - $after - 1))
        if ($nextLine.StartsWith("25. [")) {
            # Found the junction: 32. followed by 25. - remove the second block
            # Find where this second block ends (at the next ---)
            $blockEnd = $content.IndexOf("`n`n---", $after)
            if ($blockEnd -ge 0) {
                $content = $content.Substring(0, $after) + $content.Substring($blockEnd)
                Write-Host "Fixed index duplicate at position $idx"
                break
            }
        }
    }
    $idx = $content.IndexOf("32. [", $idx + 1)
}

# Fix duplicate body: find second occurrence of "## 용어집"
$marker = "`n## 용어집`n"
$first = $content.IndexOf($marker)
$second = if ($first -ge 0) { $content.IndexOf($marker, $first + 1) } else { -1 }

if ($second -ge 0) {
    # Find the --- separator just before the second occurrence
    $sepBefore = $content.LastIndexOf("`n---`n", $second)
    # Find ## What's New after the second occurrence
    $whatsNew = $content.IndexOf("`n## What's New in v1.4.0`n", $second)
    if ($sepBefore -ge 0 -and $whatsNew -ge 0) {
        # Remove from sepBefore (exclusive - keep the \n before ---) to whatsNew (inclusive \n)
        $content = $content.Substring(0, $sepBefore + 1) + $content.Substring($whatsNew + 1)
        Write-Host "Fixed body duplicate. Removed second section block."
    } else {
        Write-Host "Could not find boundaries for body fix. sepBefore=$sepBefore whatsNew=$whatsNew"
    }
} else {
    Write-Host "No duplicate body section found (second idx=$second)"
}

[System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done."
