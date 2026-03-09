$files = @(
  'c:\dev\GameStringer\docs\GUIDA_UTENTE.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_EN.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_DE.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_ES.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_FR.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_JA.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_KO.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_PL.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_PT.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_RU.md',
  'c:\dev\GameStringer\docs\USER_GUIDE_ZH.md'
)

$expected = @{
  'GUIDA_UTENTE.md' = @('32. [Heatmap Affidabilità](#heatmap-affidabilità)','33. [Gestione Blog](#gestione-blog)','34. [Ren''Py Patcher](#renpy-patcher)','35. [RPG Maker Patcher](#rpg-maker-patcher)','36. [Wolf RPG Patcher](#wolf-rpg-patcher)','37. [Danganronpa Patcher](#danganronpa-patcher)','## Heatmap Affidabilità','## Gestione Blog','## Ren''Py Patcher','## RPG Maker Patcher','## Wolf RPG Patcher','## Danganronpa Patcher')
  'USER_GUIDE_EN.md' = @('32. [Cultural Adaptation](#cultural-adaptation)','33. [Confidence Heatmap](#confidence-heatmap)','34. [Blog Manager](#blog-manager)','35. [Ren''Py Patcher](#renpy-patcher)','36. [RPG Maker Patcher](#rpg-maker-patcher)','37. [Wolf RPG Patcher](#wolf-rpg-patcher)','38. [Danganronpa Patcher](#danganronpa-patcher)','## Confidence Heatmap','## Blog Manager','## Ren''Py Patcher','## RPG Maker Patcher','## Wolf RPG Patcher','## Danganronpa Patcher')
  'USER_GUIDE_DE.md' = @('32. [Konfidenz-Heatmap](#konfidenz-heatmap)','33. [Blog-Verwaltung](#blog-verwaltung)','34. [Ren''Py Patcher](#renpy-patcher)','35. [RPG Maker Patcher](#rpg-maker-patcher)','36. [Wolf RPG Patcher](#wolf-rpg-patcher)','37. [Danganronpa Patcher](#danganronpa-patcher)','## Konfidenz-Heatmap','## Blog-Verwaltung','## Ren''Py Patcher','## RPG Maker Patcher','## Wolf RPG Patcher','## Danganronpa Patcher')
  'USER_GUIDE_ES.md' = @('32. [Mapa de Calor de Confianza](#mapa-de-calor-de-confianza)','33. [Gestor de Blog](#gestor-de-blog)','34. [Ren''Py Patcher](#renpy-patcher)','35. [RPG Maker Patcher](#rpg-maker-patcher)','36. [Wolf RPG Patcher](#wolf-rpg-patcher)','37. [Danganronpa Patcher](#danganronpa-patcher)','## Mapa de Calor de Confianza','## Gestor de Blog','## Ren''Py Patcher','## RPG Maker Patcher','## Wolf RPG Patcher','## Danganronpa Patcher')
  'USER_GUIDE_FR.md' = @('32. [Carte de Chaleur de Confiance](#carte-de-chaleur-de-confiance)','33. [Gestionnaire de Blog](#gestionnaire-de-blog)','34. [Ren''Py Patcher](#renpy-patcher)','35. [RPG Maker Patcher](#rpg-maker-patcher)','36. [Wolf RPG Patcher](#wolf-rpg-patcher)','37. [Danganronpa Patcher](#danganronpa-patcher)','## Carte de Chaleur de Confiance','## Gestionnaire de Blog','## Ren''Py Patcher','## RPG Maker Patcher','## Wolf RPG Patcher','## Danganronpa Patcher')
  'USER_GUIDE_JA.md' = @('32. [信頼度ヒートマップ](#信頼度ヒートマップ)','33. [ブログ管理](#ブログ管理)','34. [Ren''Py パッチャー](#renpy-パッチャー)','35. [RPG Maker パッチャー](#rpg-maker-パッチャー)','36. [Wolf RPG パッチャー](#wolf-rpg-パッチャー)','37. [Danganronpa パッチャー](#danganronpa-パッチャー)','## 信頼度ヒートマップ','## ブログ管理','## Ren''Py パッチャー','## RPG Maker パッチャー','## Wolf RPG パッチャー','## Danganronpa パッチャー')
  'USER_GUIDE_KO.md' = @('33. [신뢰도 히트맵](#신뢰도-히트맵)','34. [블로그 관리](#블로그-관리)','35. [Ren''Py 패처](#renpy-패처)','36. [RPG Maker 패처](#rpg-maker-패처)','37. [Wolf RPG 패처](#wolf-rpg-패처)','38. [Danganronpa 패처](#danganronpa-패처)','## 신뢰도 히트맵','## 블로그 관리','## Ren''Py 패처','## RPG Maker 패처','## Wolf RPG 패처','## Danganronpa 패처')
  'USER_GUIDE_PL.md' = @('33. [Mapa ciepła pewności](#mapa-ciepła-pewności)','34. [Zarządzanie blogiem](#zarządzanie-blogiem)','35. [Ren''Py Patcher](#renpy-patcher)','36. [RPG Maker Patcher](#rpg-maker-patcher)','37. [Wolf RPG Patcher](#wolf-rpg-patcher)','38. [Danganronpa Patcher](#danganronpa-patcher)','## Mapa ciepła pewności','## Zarządzanie blogiem','## Ren''Py Patcher','## RPG Maker Patcher','## Wolf RPG Patcher','## Danganronpa Patcher')
  'USER_GUIDE_PT.md' = @('33. [Mapa de Calor de Confiança](#mapa-de-calor-de-confiança)','34. [Gestor de Blog](#gestor-de-blog)','35. [Ren''Py Patcher](#renpy-patcher)','36. [RPG Maker Patcher](#rpg-maker-patcher)','37. [Wolf RPG Patcher](#wolf-rpg-patcher)','38. [Danganronpa Patcher](#danganronpa-patcher)','## Mapa de Calor de Confiança','## Gestor de Blog','## Ren''Py Patcher','## RPG Maker Patcher','## Wolf RPG Patcher','## Danganronpa Patcher')
  'USER_GUIDE_RU.md' = @('33. [Тепловая карта надёжности](#тепловая-карта-надёжности)','34. [Управление блогом](#управление-блогом)','35. [Ren''Py Patcher](#renpy-patcher)','36. [RPG Maker Patcher](#rpg-maker-patcher)','37. [Wolf RPG Patcher](#wolf-rpg-patcher)','38. [Danganronpa Patcher](#danganronpa-patcher)','## Тепловая карта надёжности','## Управление блогом','## Ren''Py Patcher','## RPG Maker Patcher','## Wolf RPG Patcher','## Danganronpa Patcher')
  'USER_GUIDE_ZH.md' = @('32. [置信度热图](#置信度热图)','33. [博客管理](#博客管理)','34. [Ren''Py 补丁工具](#renpy-补丁工具)','35. [RPG Maker 补丁工具](#rpg-maker-补丁工具)','36. [Wolf RPG 补丁工具](#wolf-rpg-补丁工具)','37. [Danganronpa 补丁工具](#danganronpa-补丁工具)','## 置信度热图','## 博客管理','## Ren''Py 补丁工具','## RPG Maker 补丁工具','## Wolf RPG 补丁工具','## Danganronpa 补丁工具')
}

$allOk = $true
foreach ($file in $files) {
  $name = [System.IO.Path]::GetFileName($file)
  $content = Get-Content $file -Raw -Encoding UTF8
  $missing = @()
  foreach ($item in $expected[$name]) {
    if (-not $content.Contains($item)) { $missing += $item }
  }
  if ($missing.Count -eq 0) {
    Write-Host "OK $name"
  } else {
    $allOk = $false
    Write-Host "MISSING $name"
    foreach ($m in $missing) { Write-Host "  - $m" }
  }
}
if ($allOk) { Write-Host 'ALL_GUIDES_OK' } else { Write-Host 'GUIDE_ERRORS_FOUND' }
