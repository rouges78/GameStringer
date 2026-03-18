using AssetsTools.NET;
using AssetsTools.NET.Extra;
using System.Text;

var resourcesPath = @"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets";
var transDir = @"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated";
var classDataPath = @"C:\dev\GameStringer\tools\UABEA\classdata.tpk";

Console.WriteLine("=== Esoteric Ebb - AssetsTools.NET Injector ===");

// Load translations
var translations = new Dictionary<string, Dictionary<string, string>>();
var transFiles = new Dictionary<string, string> {
    {"uielements", "uielements.csv"},
    {"feats", "feats.csv"},
    {"questpoints", "questpoints.csv"},
    {"backgrounds", "table_0.csv"},
};

foreach (var kv in transFiles) {
    var path = Path.Combine(transDir, kv.Value);
    if (!File.Exists(path)) continue;
    var lines = File.ReadAllLines(path, Encoding.UTF8);
    var dict = new Dictionary<string, string>();
    for (int i = 1; i < lines.Length; i++) {
        var parts = ParseCsvLine(lines[i]);
        if (parts.Length >= 3 && !string.IsNullOrEmpty(parts[0]) && !string.IsNullOrEmpty(parts[2])) {
            dict[parts[0].Trim()] = parts[2].Trim();
        }
    }
    if (dict.Count > 0) {
        translations[kv.Key] = dict;
        Console.WriteLine($"  {kv.Key}: {dict.Count} translations");
    }
}

Console.WriteLine($"  Total: {translations.Values.Sum(d => d.Count)}");

// Open assets file with AssetsTools.NET
var am = new AssetsManager();
am.LoadClassPackage(classDataPath);

var afileInst = am.LoadAssetsFile(resourcesPath, true);
var afile = afileInst.file;
am.LoadClassDatabaseFromPackage(afile.Metadata.UnityVersion);

Console.WriteLine($"\nUnity: {afile.Metadata.UnityVersion}");
Console.WriteLine($"Objects: {afile.Metadata.AssetInfos.Count}");

// Find all objects and check for CSV content
var replacers = new List<AssetsReplacer>();
int totalInjected = 0;

foreach (var info in afile.Metadata.AssetInfos) {
    try {
        var baseField = am.GetBaseField(afileInst, info);
        if (baseField == null) continue;

        // Look for m_Script field (TextAsset) or any string field with CSV
        AssetTypeValueField? scriptField = null;
        string? scriptValue = null;

        // Try TextAsset pattern: m_Name + m_Script
        try {
            scriptField = baseField["m_Script"];
            if (scriptField != null && !scriptField.IsDummy) {
                scriptValue = scriptField.AsString;
            }
        } catch { }

        if (string.IsNullOrEmpty(scriptValue) || !scriptValue.StartsWith("ID,ENGLISH"))
            continue;

        var nameField = baseField["m_Name"];
        var name = nameField != null ? nameField.AsString : "unknown";

        var tableName = IdentifyTable(scriptValue);
        if (tableName == null || !translations.ContainsKey(tableName)) {
            Console.WriteLine($"  Skip: {name} ({tableName ?? "?"})");
            continue;
        }

        var trans = translations[tableName];
        Console.WriteLine($"\n  {name} ({tableName}): {trans.Count} translations");

        var newCsv = ReplaceEnglish(scriptValue, trans);
        scriptField!.AsString = newCsv;

        replacers.Add(new AssetsReplacerFromMemory(afile, info, baseField));
        totalInjected += trans.Count;
        Console.WriteLine($"    Injected!");
    } catch (Exception ex) {
        // Skip objects that can't be parsed
    }
}

if (replacers.Count == 0) {
    Console.WriteLine("\nNo TextAssets found with CSV data!");
    Console.WriteLine("Trying alternative: scan all MonoBehaviour objects...");
    
    // Alternative: look for MonoBehaviour objects that contain CSV strings
    foreach (var info in afile.Metadata.AssetInfos) {
        try {
            var baseField = am.GetBaseField(afileInst, info);
            if (baseField == null) continue;
            
            // Recursively search all string fields
            SearchAndReplace(baseField, translations, replacers, afile, info, ref totalInjected);
        } catch { }
    }
}

if (replacers.Count == 0) {
    Console.WriteLine("\n No modifiable assets found!");
    return;
}

// Write modified file
var outputPath = resourcesPath + ".modified";
Console.WriteLine($"\nWriting {replacers.Count} modified assets...");

using (var writer = new AssetsFileWriter(outputPath)) {
    afile.Write(writer, 0, replacers);
}

// Replace original
File.Move(outputPath, resourcesPath, true);

Console.WriteLine($"\n=== DONE: {totalInjected} translations injected ===");
Console.WriteLine("Avvia il gioco!");

// ============================================
// Helper functions
// ============================================

static string IdentifyTable(string csv) {
    var lines = csv.Split('\n');
    if (lines.Length < 2) return null!;
    var ids = string.Join(" ", lines.Skip(1).Take(5).Select(l => {
        var idx = l.IndexOf(',');
        return idx > 0 ? l[..idx].Trim().ToLower() : "";
    }));
    if (ids.Contains("ui_") || ids.Contains("death_")) return "uielements";
    if (ids.Contains("quest_")) return "questpoints";
    if (ids.Contains("feat_")) return "feats";
    if (ids.Contains("bg_")) return "backgrounds";
    return null!;
}

static string ReplaceEnglish(string csv, Dictionary<string, string> trans) {
    var lines = csv.Split('\n');
    var result = new List<string> { lines[0] };

    for (int i = 1; i < lines.Length; i++) {
        var line = lines[i];
        if (string.IsNullOrWhiteSpace(line)) { result.Add(line); continue; }

        var parts = ParseCsvLine(line);
        var id = parts.Length > 0 ? parts[0].Trim() : "";

        if (trans.ContainsKey(id) && parts.Length > 1) {
            parts[1] = trans[id];
        }

        result.Add(ToCsvLine(parts));
    }

    return string.Join("\n", result);
}

static string[] ParseCsvLine(string line) {
    var result = new List<string>();
    var current = new StringBuilder();
    bool inQuotes = false;

    foreach (var ch in line) {
        if (ch == '"') { inQuotes = !inQuotes; }
        else if (ch == ',' && !inQuotes) { result.Add(current.ToString()); current.Clear(); }
        else { current.Append(ch); }
    }
    result.Add(current.ToString());
    return result.ToArray();
}

static string ToCsvLine(string[] parts) {
    return string.Join(",", parts.Select(p => {
        if (p.Contains(',') || p.Contains('"') || p.Contains('\n') || p.Contains('<') || p.Contains('>')) {
            return "\"" + p.Replace("\"", "\"\"") + "\"";
        }
        return p;
    }));
}

static void SearchAndReplace(AssetTypeValueField field, Dictionary<string, Dictionary<string, string>> translations,
    List<AssetsReplacer> replacers, AssetsFile afile, AssetFileInfo info, ref int totalInjected) {
    
    if (field.Value != null && field.Value.ValueType == AssetValueType.String) {
        var val = field.AsString;
        if (!string.IsNullOrEmpty(val) && val.StartsWith("ID,ENGLISH")) {
            var tableName = IdentifyTable(val);
            if (tableName != null && translations.ContainsKey(tableName)) {
                var trans = translations[tableName];
                Console.WriteLine($"  Found CSV in field '{field.FieldName}' ({tableName}): {trans.Count}");
                field.AsString = ReplaceEnglish(val, trans);
                totalInjected += trans.Count;
            }
        }
    }
    
    foreach (var child in field.Children) {
        SearchAndReplace(child, translations, replacers, afile, info, ref totalInjected);
    }
}
