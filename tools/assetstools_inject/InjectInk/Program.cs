using AssetsTools.NET;
using AssetsTools.NET.Extra;
using System.Text;
using System.Text.RegularExpressions;

var assetsDir = @"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data";
var classDataPath = @"C:\dev\GameStringer\tools\UABEA\classdata.tpk";
var translationsCsv = @"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv";

Console.WriteLine("=== Esoteric Ebb - Ink Story Injector (ALL FILES) ===");

// Load translations (ENGLISH -> ITALIAN mapping)
var translations = new Dictionary<string, string>();
if (!File.Exists(translationsCsv)) {
    Console.WriteLine($"ERROR: Translation CSV not found: {translationsCsv}");
    return;
}

var csvLines = File.ReadAllLines(translationsCsv, Encoding.UTF8);
for (int i = 1; i < csvLines.Length; i++) {
    var parts = ParseCsvLine(csvLines[i]);
    if (parts.Length >= 2 && !string.IsNullOrEmpty(parts[0]) && !string.IsNullOrEmpty(parts[1])) {
        translations[parts[0].Trim()] = parts[1].Trim();
    }
}
Console.WriteLine($"Ink translations loaded: {translations.Count}");

// Also load level rich-text translations
var levelCsv = @"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_translations.csv";
if (File.Exists(levelCsv)) {
    var levelLines = File.ReadAllLines(levelCsv, Encoding.UTF8);
    int added = 0;
    for (int i = 1; i < levelLines.Length; i++) {
        var parts = ParseCsvLine(levelLines[i]);
        if (parts.Length >= 2 && !string.IsNullOrEmpty(parts[0]) && !string.IsNullOrEmpty(parts[1])) {
            var key = parts[0].Trim();
            var val = parts[1].Trim();
            if (!translations.ContainsKey(key)) {
                translations[key] = val;
                added++;
            }
        }
    }
    Console.WriteLine($"Level translations added: {added}");
}

// Also load UI translations (menu, stats, settings labels)
var uiCsv = @"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\ui_translations.csv";
if (File.Exists(uiCsv)) {
    var uiLines = File.ReadAllLines(uiCsv, Encoding.UTF8);
    int added = 0;
    for (int i = 1; i < uiLines.Length; i++) {
        var parts = ParseCsvLine(uiLines[i]);
        if (parts.Length >= 2 && !string.IsNullOrEmpty(parts[0]) && !string.IsNullOrEmpty(parts[1])) {
            var key = parts[0].Trim();
            var val = parts[1].Trim();
            if (!translations.ContainsKey(key)) {
                translations[key] = val;
                added++;
            }
        }
    }
    Console.WriteLine($"UI translations added: {added}");
}

Console.WriteLine($"Total translations: {translations.Count}");

if (translations.Count == 0) {
    Console.WriteLine("No translations to inject!");
    return;
}

// Find all target files: level0-level24 + ALL sharedassets*.assets
var targetFiles = new List<string>();
for (int lvl = 0; lvl <= 24; lvl++)
    targetFiles.Add(Path.Combine(assetsDir, $"level{lvl}"));
for (int sa = 0; sa <= 24; sa++)
    targetFiles.Add(Path.Combine(assetsDir, $"sharedassets{sa}.assets"));

// Filter to files that exist
targetFiles = targetFiles.Where(File.Exists).ToList();
Console.WriteLine($"Target files: {targetFiles.Count}");

int grandTotalReplaced = 0;
int grandTotalStories = 0;
int filesProcessed = 0;

foreach (var targetFile in targetFiles) {
    var fileName = Path.GetFileName(targetFile);
    var backupPath = targetFile + ".backup";

    // Backup
    if (!File.Exists(backupPath)) {
        File.Copy(targetFile, backupPath);
    }

    try {
        var am = new AssetsManager();
        am.LoadClassPackage(classDataPath);

        var afileInst = am.LoadAssetsFile(backupPath, true);
        var afile = afileInst.file;
        am.LoadClassDatabaseFromPackage(afile.Metadata.UnityVersion);

        var replacers = new List<AssetsReplacer>();
        int totalReplaced = 0;
        int storiesModified = 0;

        foreach (var info in afile.Metadata.AssetInfos) {
            try {
                var baseField = am.GetBaseField(afileInst, info);
                if (baseField == null) continue;

                // Search ALL string fields recursively for Ink JSON
                bool modified = false;
                SearchAndReplaceInk(baseField, translations, ref totalReplaced, ref storiesModified, ref modified);

                if (modified) {
                    replacers.Add(new AssetsReplacerFromMemory(afile, info, baseField));
                }
            } catch { }
        }

        if (replacers.Count > 0) {
            var outputPath = targetFile + ".modified";
            using (var writer = new AssetsFileWriter(outputPath)) {
                afile.Write(writer, 0, replacers);
            }
            try {
                File.Move(outputPath, targetFile, true);
            } catch {
                // Fallback: try copy
                File.Copy(outputPath, targetFile, true);
                File.Delete(outputPath);
            }
            grandTotalReplaced += totalReplaced;
            grandTotalStories += storiesModified;
            filesProcessed++;
            Console.WriteLine($"  {fileName}: {storiesModified} stories, {totalReplaced} replacements");
        } else {
            Console.WriteLine($"  {fileName}: no Ink stories");
        }

        am.UnloadAll();
    } catch (Exception ex) {
        Console.WriteLine($"  {fileName}: ERROR - {ex.Message[..Math.Min(100, ex.Message.Length)]}");
    }
}

Console.WriteLine($"\n=== DONE ===");
Console.WriteLine($"  Files processed: {filesProcessed}/{targetFiles.Count}");
Console.WriteLine($"  Stories modified: {grandTotalStories}");
Console.WriteLine($"  Total replacements: {grandTotalReplaced}");
Console.WriteLine("Avvia il gioco!");

// ============================================================
static string ReplaceInkStrings(string json, Dictionary<string, string> translations, ref int count) {
    // Strategy: find all "^text" patterns in the JSON and replace the text part
    // We need to be careful to only replace the display text, not Ink control strings
    
    var sb = new StringBuilder(json.Length + json.Length / 4);
    int i = 0;
    
    while (i < json.Length) {
        // Look for "^ pattern (caret-prefixed display text in Ink JSON)
        if (i + 2 < json.Length && json[i] == '"' && json[i + 1] == '^') {
            // Find the closing quote (handle escaped quotes)
            int start = i;
            int textStart = i + 2; // after "^
            int j = textStart;
            while (j < json.Length) {
                if (json[j] == '\\' && j + 1 < json.Length) {
                    j += 2; // skip escaped char
                    continue;
                }
                if (json[j] == '"') break;
                j++;
            }
            
            if (j < json.Length) {
                // Extract the text between ^ and closing "
                var originalText = json[textStart..j].Trim();
                
                // Check if we have a translation for this text
                // Try with and without HTML tags
                string? translation = null;
                if (translations.TryGetValue(originalText, out var t1)) {
                    translation = t1;
                } else {
                    // Try trimmed version
                    var trimmed = originalText.TrimEnd(' ');
                    if (translations.TryGetValue(trimmed, out var t2)) {
                        translation = t2;
                    }
                }
                
                if (translation != null) {
                    // Escape the translation for JSON
                    var escaped = EscapeJsonString(translation);
                    sb.Append('"');
                    sb.Append('^');
                    sb.Append(escaped);
                    // Preserve trailing space if original had one
                    if (originalText.Length > 0 && json[j - 1] == ' ' && !escaped.EndsWith(" "))
                        sb.Append(' ');
                    sb.Append('"');
                    count++;
                } else {
                    // Keep original
                    sb.Append(json[start..(j + 1)]);
                }
                i = j + 1;
                continue;
            }
        }
        
        sb.Append(json[i]);
        i++;
    }
    
    return sb.ToString();
}

static string EscapeJsonString(string s) {
    return s.Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\n", "\\n")
            .Replace("\r", "\\r")
            .Replace("\t", "\\t");
}

static void SearchAndReplaceInk(AssetTypeValueField field, Dictionary<string, string> translations,
    ref int totalReplaced, ref int storiesModified, ref bool modified, int depth = 0) {
    if (depth > 8) return;
    
    try {
        if (field.Value != null && field.Value.ValueType == AssetValueType.String) {
            var val = field.AsString;
            if (val != null && val.Length > 2) {
                // Case 1: Full Ink JSON block
                if (val.Contains("inkVersion") && val.Length > 100) {
                    int replacedInThis = 0;
                    var newVal = ReplaceInkStrings(val, translations, ref replacedInThis);
                    if (replacedInThis > 0) {
                        field.AsString = newVal;
                        totalReplaced += replacedInThis;
                        storiesModified++;
                        modified = true;
                    }
                }
                // Case 2: Direct string match (for level files with pre-parsed Ink data)
                else if (translations.TryGetValue(val, out var trans)) {
                    field.AsString = trans;
                    totalReplaced++;
                    modified = true;
                } else {
                    // Try trimmed
                    var trimmed = val.Trim();
                    if (trimmed != val && translations.TryGetValue(trimmed, out var trans2)) {
                        field.AsString = trans2;
                        totalReplaced++;
                        modified = true;
                    }
                }
            }
        }

        foreach (var child in field.Children) {
            SearchAndReplaceInk(child, translations, ref totalReplaced, ref storiesModified, ref modified, depth + 1);
        }
    } catch { }
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
