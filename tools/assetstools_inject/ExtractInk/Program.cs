using AssetsTools.NET;
using AssetsTools.NET.Extra;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

var assetsDir = @"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data";
var classDataPath = @"C:\dev\GameStringer\tools\UABEA\classdata.tpk";
var outputDir = @"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings";
Directory.CreateDirectory(outputDir);

Console.WriteLine("=== Esoteric Ebb - Ink/TextAsset String Extractor ===");

var am = new AssetsManager();
am.LoadClassPackage(classDataPath);

// Scan sharedassets1.assets - the main file with game text
var targetFile = Path.Combine(assetsDir, "sharedassets1.assets");
Console.WriteLine($"\nScanning: {targetFile}");
Console.WriteLine($"Size: {new FileInfo(targetFile).Length:N0} bytes");

var afileInst = am.LoadAssetsFile(targetFile, true);
var afile = afileInst.file;
am.LoadClassDatabaseFromPackage(afile.Metadata.UnityVersion);

Console.WriteLine($"Unity: {afile.Metadata.UnityVersion}");
Console.WriteLine($"Objects: {afile.Metadata.AssetInfos.Count}");

// Collect all string fields from all objects
var allStrings = new List<Dictionary<string, object>>();
int textAssetCount = 0;
int monoBehaviourCount = 0;
int inkJsonCount = 0;
int totalTextStrings = 0;

foreach (var info in afile.Metadata.AssetInfos) {
    try {
        var baseField = am.GetBaseField(afileInst, info);
        if (baseField == null) continue;

        // Get object name
        string objName = "unknown";
        try {
            var nameField = baseField["m_Name"];
            if (nameField != null && !nameField.IsDummy)
                objName = nameField.AsString;
        } catch { }

        // Check for TextAsset m_Script field
        try {
            var scriptField = baseField["m_Script"];
            if (scriptField != null && !scriptField.IsDummy) {
                var script = scriptField.AsString;
                if (!string.IsNullOrEmpty(script) && script.Length > 10) {
                    textAssetCount++;
                    
                    // Check if it's an Ink JSON story
                    if (script.Contains("inkVersion")) {
                        inkJsonCount++;
                        // Debug: save first 3 Ink JSON samples
                        if (inkJsonCount <= 3) {
                            var samplePath = Path.Combine(outputDir, $"ink_sample_{inkJsonCount}_{objName}.json");
                            File.WriteAllText(samplePath, script.Length > 100000 ? script[..100000] : script);
                            Console.WriteLine($"  SAMPLE saved: {samplePath} ({script.Length} chars)");
                        }
                        var inkTexts = ExtractInkTexts(script);
                        Console.WriteLine($"  TextAsset '{objName}': Ink story, {script.Length} chars, {inkTexts.Count} text strings");
                        if (inkTexts.Count > 0) {
                            foreach (var t in inkTexts) {
                                allStrings.Add(new Dictionary<string, object> {
                                    {"source", $"TextAsset:{objName}"},
                                    {"pathId", info.PathId},
                                    {"type", "ink"},
                                    {"text", t},
                                });
                            }
                            totalTextStrings += inkTexts.Count;
                        }
                    }
                    // Check if it's a CSV
                    else if (script.StartsWith("ID,ENGLISH")) {
                        Console.WriteLine($"  TextAsset '{objName}': CSV localization");
                    }
                }
            }
        } catch { }

        // Also scan all string fields recursively for MonoBehaviour
        ScanStringFields(baseField, objName, info.PathId, allStrings, ref totalTextStrings, 0);

    } catch { }
}

Console.WriteLine($"\nResults:");
Console.WriteLine($"  TextAssets: {textAssetCount}");
Console.WriteLine($"  Ink stories: {inkJsonCount}");
Console.WriteLine($"  Total text strings: {totalTextStrings}");
Console.WriteLine($"  Unique strings: {allStrings.Select(s => s["text"]).Distinct().Count()}");

// Save all strings
var jsonPath = Path.Combine(outputDir, "all_ink_strings.json");
var jsonOpts = new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
File.WriteAllText(jsonPath, JsonSerializer.Serialize(allStrings, jsonOpts));
Console.WriteLine($"\nSaved: {jsonPath}");

// Save deduplicated text-only list for translation
var uniqueTexts = allStrings
    .Select(s => (string)s["text"])
    .Distinct()
    .Where(t => t.Length >= 3 && !Regex.IsMatch(t, @"^[\d\s\.\,\-\+\=\:\;\!\?\(\)\[\]\{\}\/\\<>]+$"))
    .OrderBy(t => t)
    .ToList();

var textPath = Path.Combine(outputDir, "unique_texts.txt");
File.WriteAllLines(textPath, uniqueTexts);
Console.WriteLine($"Unique translatable texts: {uniqueTexts.Count}");
Console.WriteLine($"Saved: {textPath}");

// Preview
var previewPath = Path.Combine(outputDir, "preview.txt");
using (var pw = new StreamWriter(previewPath, false, Encoding.UTF8)) {
    foreach (var t in uniqueTexts.Take(300)) {
        var display = t.Length > 120 ? t[..120] + "..." : t;
        pw.WriteLine(display);
    }
}
Console.WriteLine($"Preview: {previewPath}");

Console.WriteLine("\n=== DONE ===");

// ============================================================
static List<string> ExtractInkTexts(string jsonStr) {
    var texts = new List<string>();
    var seen = new HashSet<string>();
    
    try {
        using var doc = JsonDocument.Parse(jsonStr);
        WalkJson(doc.RootElement, texts, seen);
    } catch (Exception ex) {
        Console.WriteLine($"    JSON PARSE ERROR: {ex.Message.Substring(0, Math.Min(200, ex.Message.Length))}");
        // Fallback: regex extract ^text patterns
        var matches = System.Text.RegularExpressions.Regex.Matches(jsonStr, @"""\^([^""]{2,})""");
        foreach (System.Text.RegularExpressions.Match m in matches) {
            var text = m.Groups[1].Value.Trim();
            if (!string.IsNullOrEmpty(text) && text.Length >= 2
                && !text.StartsWith("OBJ") && !text.StartsWith("/#")
                && !text.StartsWith("->") && text != "\\n" && text != "\n"
                && Regex.IsMatch(text, @"[a-zA-Z]")
                && !seen.Contains(text)) {
                seen.Add(text);
                texts.Add(text);
            }
        }
        if (texts.Count > 0)
            Console.WriteLine($"    Regex fallback found {texts.Count} strings");
    }
    
    return texts;
}

static void WalkJson(JsonElement el, List<string> texts, HashSet<string> seen) {
    switch (el.ValueKind) {
        case JsonValueKind.String:
            var s = el.GetString();
            if (s != null && s.StartsWith("^") && s.Length > 1) {
                var text = s[1..].Trim();
                // Filter control strings
                if (!string.IsNullOrEmpty(text) 
                    && text.Length >= 2
                    && !text.StartsWith("OBJ") && !text.StartsWith("/#")
                    && !text.StartsWith("->") && !text.StartsWith("ev")
                    && !text.StartsWith("/ev") && !text.StartsWith("str")
                    && text != "\\n" && text != "\n"
                    && Regex.IsMatch(text, @"[a-zA-Z]")
                    && !seen.Contains(text)) {
                    // Remove HTML tags for dedup but keep original
                    seen.Add(text);
                    texts.Add(text);
                }
            }
            break;
        case JsonValueKind.Array:
            foreach (var item in el.EnumerateArray())
                WalkJson(item, texts, seen);
            break;
        case JsonValueKind.Object:
            foreach (var prop in el.EnumerateObject())
                WalkJson(prop.Value, texts, seen);
            break;
    }
}

static void ScanStringFields(AssetTypeValueField field, string objName, long pathId, 
    List<Dictionary<string, object>> results, ref int count, int depth) {
    if (depth > 5) return; // Avoid deep recursion
    
    try {
        if (field.Value != null && field.Value.ValueType == AssetValueType.String) {
            var val = field.AsString;
            if (val != null && val.Contains("inkVersion") && val.Length > 100) {
                // This is an Ink JSON in a non-TextAsset field
                var texts = ExtractInkTexts(val);
                if (texts.Count > 0) {
                    Console.WriteLine($"  MonoBehaviour field '{field.FieldName}' in '{objName}': {texts.Count} Ink texts");
                    foreach (var t in texts) {
                        results.Add(new Dictionary<string, object> {
                            {"source", $"MonoBehaviour:{objName}.{field.FieldName}"},
                            {"pathId", pathId},
                            {"type", "ink_mono"},
                            {"text", t},
                        });
                    }
                    count += texts.Count;
                }
            }
        }

        foreach (var child in field.Children) {
            ScanStringFields(child, objName, pathId, results, ref count, depth + 1);
        }
    } catch { }
}
