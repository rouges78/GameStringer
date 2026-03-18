// C# Script using AssetsTools.NET to inject translations into Unity TextAssets
// Usage: dotnet script inject.csx
#r "C:\dev\GameStringer\tools\UABEA\AssetsTools.NET.dll"

using AssetsTools.NET;
using AssetsTools.NET.Extra;
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Linq;

var resourcesPath = @"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets";
var transDir = @"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated";
var classDataPath = @"C:\dev\GameStringer\tools\UABEA\classdata.tpk";

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
    var lines = File.ReadAllLines(path);
    var dict = new Dictionary<string, string>();
    for (int i = 1; i < lines.Length; i++) {
        var parts = ParseCsvLine(lines[i]);
        if (parts.Length >= 3 && !string.IsNullOrEmpty(parts[0]) && !string.IsNullOrEmpty(parts[2])) {
            dict[parts[0].Trim()] = parts[2].Trim();
        }
    }
    translations[kv.Key] = dict;
    Console.WriteLine($"  {kv.Key}: {dict.Count} translations");
}

Console.WriteLine($"Total: {translations.Values.Sum(d => d.Count)}");

// Open assets file
var am = new AssetsManager();
am.LoadClassPackage(classDataPath);

var afileInst = am.LoadAssetsFile(resourcesPath, true);
var afile = afileInst.file;
am.LoadClassDatabaseFromPackage(afile.Metadata.UnityVersion);

Console.WriteLine($"\nUnity: {afile.Metadata.UnityVersion}");
Console.WriteLine($"Objects: {afile.AssetInfos.Count}");

// Find TextAsset objects (classId = 49)
var replacers = new List<AssetsReplacer>();
int totalInjected = 0;

foreach (var info in afile.AssetInfos) {
    var baseField = am.GetBaseField(afileInst, info);
    if (baseField == null) continue;
    
    // Check if this is a TextAsset-like object with a m_Script field containing CSV
    var scriptField = baseField["m_Script"];
    if (scriptField == null || scriptField.IsDummy) continue;
    
    var script = scriptField.AsString;
    if (string.IsNullOrEmpty(script) || !script.StartsWith("ID,ENGLISH")) continue;
    
    var nameField = baseField["m_Name"];
    var name = nameField != null ? nameField.AsString : "unknown";
    
    // Identify table
    var tableName = IdentifyTable(script);
    if (tableName == null || !translations.ContainsKey(tableName)) {
        Console.WriteLine($"  Skip: {name} ({tableName})");
        continue;
    }
    
    var trans = translations[tableName];
    Console.WriteLine($"\n🔧 {name} ({tableName}): {trans.Count} translations");
    
    // Replace English with Italian in CSV
    var newCsv = ReplaceEnglishWithItalian(script, trans);
    
    // Set new value
    scriptField.AsString = newCsv;
    
    // Create replacer
    var replacer = new AssetsReplacerFromMemory(afile, info, baseField);
    replacers.Add(replacer);
    totalInjected += trans.Count;
    Console.WriteLine($"  ✅ {trans.Count} injected");
}

if (replacers.Count == 0) {
    Console.WriteLine("\n❌ No TextAssets modified!");
    return;
}

// Write modified file
var outputPath = resourcesPath + ".modified";
using (var writer = new AssetsFileWriter(outputPath)) {
    afile.Write(writer, 0, replacers);
}

// Replace original with modified
File.Copy(outputPath, resourcesPath, true);
File.Delete(outputPath);

Console.WriteLine($"\n✅ DONE: {totalInjected} translations injected");
Console.WriteLine($"🎮 Avvia il gioco!");

// ============================================================
// Helper functions
// ============================================================

string IdentifyTable(string csv) {
    var lines = csv.Split('\n');
    if (lines.Length < 2) return null;
    var ids = string.Join(" ", lines.Skip(1).Take(5).Select(l => l.Split(',')[0].Trim().ToLower()));
    if (ids.Contains("ui_") || ids.Contains("death_")) return "uielements";
    if (ids.Contains("quest_")) return "questpoints";
    if (ids.Contains("feat_")) return "feats";
    if (ids.Contains("bg_")) return "backgrounds";
    return null;
}

string ReplaceEnglishWithItalian(string csv, Dictionary<string, string> trans) {
    var lines = csv.Split('\n');
    var result = new List<string> { lines[0] }; // Keep header
    
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

string[] ParseCsvLine(string line) {
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

string ToCsvLine(string[] parts) {
    return string.Join(",", parts.Select(p => {
        if (p.Contains(',') || p.Contains('"') || p.Contains('\n')) {
            return "\"" + p.Replace("\"", "\"\"") + "\"";
        }
        return p;
    }));
}
