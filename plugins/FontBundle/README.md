# GameStringer Universal Font Bundle

Font AssetBundle per risolvere il problema dei caratteri mancanti (□□□) durante la traduzione in-game.

## Il Problema

Quando traduci un gioco da/verso lingue con alfabeti diversi (es. Giapponese → Italiano, o Inglese → Cinese), il gioco potrebbe non avere i font necessari per visualizzare tutti i caratteri, mostrando invece quadrati vuoti (□□□).

## La Soluzione

Un AssetBundle Unity contenente font open source completi che coprono tutti gli alfabeti principali:

- **Noto Sans** - Latino, Cirillico, Greco
- **Noto Sans CJK** - Cinese, Giapponese, Coreano
- **Noto Sans Arabic** - Arabo
- **Noto Sans Hebrew** - Ebraico
- **Noto Sans Thai** - Thailandese

## Creazione del Font Bundle

### Prerequisiti

- Unity Editor 2019.4+ (LTS consigliato)
- ~500MB di spazio per i font Noto

### Step 1: Scarica i Font Noto

```powershell
# Esegui lo script di download
.\download-fonts.ps1
```

Oppure scarica manualmente da: https://fonts.google.com/noto

### Step 2: Crea il Progetto Unity

1. Apri Unity Hub
2. Crea nuovo progetto 2D/3D (qualsiasi template)
3. Importa i font nella cartella `Assets/Fonts/`

### Step 3: Crea TextMeshPro Font Assets

Per ogni font:

1. Window → TextMeshPro → Font Asset Creator
2. Source Font: seleziona il font .ttf/.otf
3. Atlas Resolution: 4096x4096
4. Character Set: Custom Characters
5. Incolla i caratteri necessari (vedi `character-sets/`)
6. Generate Font Atlas
7. Save as... `Assets/Fonts/TMP_[NomFont].asset`

### Step 4: Crea l'AssetBundle

1. Seleziona tutti i Font Asset creati
2. Inspector → AssetBundle → Crea nuovo "gamestringer-fonts"
3. Esegui lo script di build:

```csharp
// Editor/BuildFontBundle.cs
using UnityEditor;

public class BuildFontBundle
{
    [MenuItem("GameStringer/Build Font Bundle")]
    static void Build()
    {
        BuildPipeline.BuildAssetBundles(
            "Assets/StreamingAssets",
            BuildAssetBundleOptions.None,
            BuildTarget.StandaloneWindows64
        );
    }
}
```

### Step 5: Distribuisci

Copia `gamestringer-fonts` nella cartella del plugin GameStringer.Satellite.

## Struttura File

```
FontBundle/
├── README.md
├── download-fonts.ps1      # Script download font
├── character-sets/         # Set di caratteri per lingua
│   ├── latin.txt
│   ├── cjk-common.txt
│   ├── cyrillic.txt
│   └── ...
└── Unity/                  # Progetto Unity (da creare)
    └── Assets/
        ├── Fonts/
        └── Editor/
```

## Utilizzo nel Plugin

Il plugin GameStringer.Satellite carica automaticamente il font bundle:

```csharp
// Nel Plugin.cs
var fontBundle = AssetBundle.LoadFromFile(
    Path.Combine(pluginPath, "gamestringer-fonts")
);
var notoFont = fontBundle.LoadAsset<TMP_FontAsset>("TMP_NotoSansCJK");

// Sostituisci il font nei componenti TMPro
foreach (var text in FindObjectsOfType<TMP_Text>())
{
    text.font = notoFont;
}
```

## Font Consigliati

| Font | Copertura | Dimensione |
|------|-----------|------------|
| Noto Sans Regular | Latino, Cirillico, Greco | ~500KB |
| Noto Sans CJK JP | Giapponese + CJK comune | ~16MB |
| Noto Sans CJK SC | Cinese Semplificato | ~16MB |
| Noto Sans CJK TC | Cinese Tradizionale | ~16MB |
| Noto Sans CJK KR | Coreano | ~16MB |
| Noto Sans Arabic | Arabo | ~300KB |

## Ottimizzazione

Per ridurre le dimensioni del bundle:

1. **Subset dei caratteri**: Includi solo i caratteri effettivamente usati
2. **Compressione**: Usa LZMA per l'AssetBundle
3. **Font dinamici**: Carica solo i font necessari per la lingua target

## Licenza

I font Noto sono rilasciati sotto [SIL Open Font License](https://scripts.sil.org/OFL).
