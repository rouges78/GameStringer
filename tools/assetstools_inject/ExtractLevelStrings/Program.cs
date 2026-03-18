using AssetsTools.NET;
using AssetsTools.NET.Extra;
using System.Text;
using System.Text.RegularExpressions;

var assetsDir = @"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data";
var classDataPath = @"C:\dev\GameStringer\tools\UABEA\classdata.tpk";
var outputDir = @"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings";
Directory.CreateDirectory(outputDir);

Console.WriteLine("=== Esoteric Ebb - Level String Extractor ===");

// Extract from level0 first (character creation screen)
var targetFile = Path.Combine(assetsDir, "level0");
var backupFile = targetFile + ".backup";
var sourceFile = File.Exists(backupFile) ? backupFile : targetFile;

var am = new AssetsManager();
am.LoadClassPackage(classDataPath);
var afileInst = am.LoadAssetsFile(sourceFile, true);
var afile = afileInst.file;
am.LoadClassDatabaseFromPackage(afile.Metadata.UnityVersion);

Console.WriteLine($"File: {Path.GetFileName(sourceFile)}");
Console.WriteLine($"Objects: {afile.Metadata.AssetInfos.Count}");

var allStrings = new List<(long pathId, string fieldName, string value, int depth)>();

foreach (var info in afile.Metadata.AssetInfos) {
    try {
        var baseField = am.GetBaseField(afileInst, info);
        if (baseField == null) continue;
        ExtractStrings(baseField, info.PathId, allStrings, 0);
    } catch { }
}

// Filter: keep strings with actual English text (letters, >5 chars, not paths/code)
var gameStrings = allStrings
    .Where(s => s.value.Length >= 5 
        && Regex.IsMatch(s.value, @"[a-zA-Z]{3,}")
        && !s.value.StartsWith("Assets/")
        && !s.value.StartsWith("Packages/")
        && !s.value.Contains("UnityEngine")
        && !s.value.Contains(".shader")
        && !s.value.Contains(".mat")
        && !s.value.Contains(".prefab")
        && !s.value.Contains("guid:")
        && !Regex.IsMatch(s.value, @"^[a-f0-9\-]{20,}$") // skip GUIDs
    )
    .ToList();

Console.WriteLine($"\nTotal strings: {allStrings.Count}");
Console.WriteLine($"Game strings (>5 chars, has letters): {gameStrings.Count}");

// Deduplicate by value
var unique = gameStrings
    .GroupBy(s => s.value)
    .Select(g => g.First())
    .OrderBy(s => s.value.Length)
    .ToList();

Console.WriteLine($"Unique game strings: {unique.Count}");

// Save all
var csvPath = Path.Combine(outputDir, "level0_strings.csv");
using (var w = new StreamWriter(csvPath, false, Encoding.UTF8)) {
    w.WriteLine("PATH_ID,FIELD,LENGTH,TEXT");
    foreach (var s in unique) {
        var escaped = s.value.Replace("\"", "\"\"");
        if (escaped.Contains(',') || escaped.Contains('"') || escaped.Contains('\n'))
            escaped = "\"" + escaped + "\"";
        w.WriteLine($"{s.pathId},{s.fieldName},{s.value.Length},{escaped}");
    }
}
Console.WriteLine($"Saved: {csvPath}");

// Show some samples of rich-text strings
Console.WriteLine("\n--- Rich text samples (with <b>, <color>, etc.) ---");
var richText = unique.Where(s => s.value.Contains('<') && Regex.IsMatch(s.value, @"<[a-z]")).Take(20).ToList();
foreach (var s in richText) {
    var display = s.value.Length > 120 ? s.value[..120] + "..." : s.value;
    Console.WriteLine($"  [{s.pathId}] {s.fieldName}: {display}");
}

// Show long text strings (likely game content)
Console.WriteLine("\n--- Long text samples (>80 chars, likely game content) ---");
var longText = unique.Where(s => s.value.Length > 80 && !s.value.Contains('{') && !s.value.Contains("http")).Take(20).ToList();
foreach (var s in longText) {
    var display = s.value.Length > 120 ? s.value[..120] + "..." : s.value;
    Console.WriteLine($"  [{s.pathId}] {display}");
}

Console.WriteLine("\n=== DONE ===");

static void ExtractStrings(AssetTypeValueField field, long pathId, 
    List<(long pathId, string fieldName, string value, int depth)> results, int depth) {
    if (depth > 10) return;
    try {
        if (field.Value != null && field.Value.ValueType == AssetValueType.String) {
            var val = field.AsString;
            if (!string.IsNullOrEmpty(val)) {
                results.Add((pathId, field.FieldName, val, depth));
            }
        }
        foreach (var child in field.Children) {
            ExtractStrings(child, pathId, results, depth + 1);
        }
    } catch { }
}
