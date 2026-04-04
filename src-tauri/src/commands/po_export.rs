// Universal PO (Portable Object) Export/Import
// Generates and parses standard GNU PO/POT files for use with
// translation tools (Poedit, Weblate, Crowdin, etc.)

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::command;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoEntry {
    pub msgctxt: Option<String>,
    pub msgid: String,
    pub msgstr: String,
    pub reference: Option<String>,
    pub extracted_comment: Option<String>,
    pub translator_comment: Option<String>,
    pub flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PotEntry {
    pub msgctxt: Option<String>,
    pub msgid: String,
    pub reference: Option<String>,
    pub extracted_comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoMetadata {
    pub project_name: String,
    pub language: String,
    pub source_language: String,
    pub game_engine: String,
    pub generator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoParseResult {
    pub entries: Vec<PoEntry>,
    pub metadata: PoMetadata,
    pub stats: PoStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoStats {
    pub total: u32,
    pub translated: u32,
    pub untranslated: u32,
    pub fuzzy: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoMergeResult {
    pub entries_kept: u32,
    pub entries_added: u32,
    pub entries_removed: u32,
    pub entries_fuzzy: u32,
    pub output_path: String,
}

// ============================================================================
// STRING HELPERS
// ============================================================================

/// Escape a string for PO format.
/// Backslashes first, then quotes, then control chars.
fn escape_po_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\t', "\\t")
        .replace('\r', "\\r")
}

/// Unescape a PO-format string back to its raw value.
fn unescape_po_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some('r') => out.push('\r'),
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Format a (possibly multi-line) PO string value.
/// If the string contains newlines, it is split across multiple quoted lines
/// with an initial empty "" line (standard PO multi-line format).
fn format_po_value(keyword: &str, value: &str) -> String {
    let escaped = escape_po_string(value);

    // Check if the escaped string contains literal \n sequences
    if escaped.contains("\\n") {
        // Multi-line: split on the escaped newline marker
        let segments: Vec<&str> = escaped.split("\\n").collect();
        let mut lines = Vec::with_capacity(segments.len() + 1);
        lines.push(format!("{} \"\"", keyword));
        for (i, seg) in segments.iter().enumerate() {
            if i < segments.len() - 1 {
                lines.push(format!("\"{}\\n\"", seg));
            } else if !seg.is_empty() {
                // Last segment (no trailing \n)
                lines.push(format!("\"{}\"", seg));
            }
        }
        lines.join("\n")
    } else {
        format!("{} \"{}\"", keyword, escaped)
    }
}

// ============================================================================
// HEADER GENERATION
// ============================================================================

fn build_header(metadata: &PoMetadata, is_pot: bool) -> String {
    let now = Utc::now().format("%Y-%m-%d %H:%M%z").to_string();
    let revision = if is_pot {
        "YEAR-MO-DA HO:MI+ZONE".to_string()
    } else {
        now.clone()
    };
    let lang = if is_pot {
        String::new()
    } else {
        metadata.language.clone()
    };

    let header_value = format!(
        "Project-Id-Version: {}\\n\n\
         \"Report-Msgid-Bugs-To: \\n\"\n\
         \"POT-Creation-Date: {}\\n\"\n\
         \"PO-Revision-Date: {}\\n\"\n\
         \"Last-Translator: GameStringer User\\n\"\n\
         \"Language-Team: \\n\"\n\
         \"Language: {}\\n\"\n\
         \"MIME-Version: 1.0\\n\"\n\
         \"Content-Type: text/plain; charset=UTF-8\\n\"\n\
         \"Content-Transfer-Encoding: 8bit\\n\"\n\
         \"X-Generator: {}\\n\"\n\
         \"X-Game-Engine: {}\\n\"",
        metadata.project_name,
        now,
        revision,
        lang,
        metadata.generator,
        metadata.game_engine
    );

    format!(
        "# Translation file for {}\n\
         # Generated by {}\n\
         #\n\
         msgid \"\"\n\
         msgstr \"\"\n\
         \"{}",
        metadata.project_name, metadata.generator, header_value
    )
}

// ============================================================================
// ENTRY SERIALIZATION
// ============================================================================

fn serialize_entry(entry: &PoEntry) -> String {
    let mut lines: Vec<String> = Vec::new();

    // Translator comment
    if let Some(ref tc) = entry.translator_comment {
        for line in tc.lines() {
            lines.push(format!("# {}", line));
        }
    }
    // Extracted comment
    if let Some(ref ec) = entry.extracted_comment {
        for line in ec.lines() {
            lines.push(format!("#. {}", line));
        }
    }
    // Reference
    if let Some(ref r) = entry.reference {
        lines.push(format!("#: {}", r));
    }
    // Flags
    if !entry.flags.is_empty() {
        lines.push(format!("#, {}", entry.flags.join(", ")));
    }
    // Context
    if let Some(ref ctx) = entry.msgctxt {
        lines.push(format_po_value("msgctxt", ctx));
    }
    // Source
    lines.push(format_po_value("msgid", &entry.msgid));
    // Translation
    lines.push(format_po_value("msgstr", &entry.msgstr));

    lines.join("\n")
}

fn serialize_pot_entry(entry: &PotEntry) -> String {
    let po = PoEntry {
        msgctxt: entry.msgctxt.clone(),
        msgid: entry.msgid.clone(),
        msgstr: String::new(),
        reference: entry.reference.clone(),
        extracted_comment: entry.extracted_comment.clone(),
        translator_comment: None,
        flags: Vec::new(),
    };
    serialize_entry(&po)
}

// ============================================================================
// PARSER — STATE MACHINE
// ============================================================================

#[derive(Debug, PartialEq)]
enum ParseField {
    None,
    MsgCtxt,
    MsgId,
    MsgStr,
}

struct EntryBuilder {
    msgctxt: Option<String>,
    msgid: String,
    msgstr: String,
    reference: Option<String>,
    extracted_comment: Option<String>,
    translator_comment: Option<String>,
    flags: Vec<String>,
    field: ParseField,
}

impl EntryBuilder {
    fn new() -> Self {
        Self {
            msgctxt: None,
            msgid: String::new(),
            msgstr: String::new(),
            reference: None,
            extracted_comment: None,
            translator_comment: None,
            flags: Vec::new(),
            field: ParseField::None,
        }
    }

    fn is_empty(&self) -> bool {
        self.msgid.is_empty() && self.msgctxt.is_none() && self.field == ParseField::None
    }

    fn build(self) -> PoEntry {
        PoEntry {
            msgctxt: self.msgctxt,
            msgid: self.msgid,
            msgstr: self.msgstr,
            reference: self.reference,
            extracted_comment: self.extracted_comment,
            translator_comment: self.translator_comment,
            flags: self.flags,
        }
    }

    /// Append a continuation (quoted) string to the current field.
    fn append_continuation(&mut self, text: &str) {
        match self.field {
            ParseField::MsgCtxt => {
                if let Some(ref mut ctx) = self.msgctxt {
                    ctx.push_str(text);
                }
            }
            ParseField::MsgId => self.msgid.push_str(text),
            ParseField::MsgStr => self.msgstr.push_str(text),
            ParseField::None => {}
        }
    }
}

/// Extract the quoted string content from a line like `"some text"`.
/// Returns the unescaped content between the outermost quotes.
fn extract_quoted(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        Some(unescape_po_string(&trimmed[1..trimmed.len() - 1]))
    } else {
        None
    }
}

/// Parse a PO file from its text content and return entries + raw header map.
fn parse_po_content(content: &str) -> (Vec<PoEntry>, HashMap<String, String>) {
    let mut entries: Vec<PoEntry> = Vec::new();
    let mut builder = EntryBuilder::new();
    let mut header_map: HashMap<String, String> = HashMap::new();
    let mut is_first = true;

    let flush = |builder: &mut EntryBuilder,
                 entries: &mut Vec<PoEntry>,
                 header_map: &mut HashMap<String, String>,
                 is_first: &mut bool| {
        if builder.is_empty() {
            return;
        }
        let entry = std::mem::replace(builder, EntryBuilder::new()).build();

        // The header entry has an empty msgid
        if *is_first && entry.msgid.is_empty() {
            // Parse header fields from msgstr
            for line in entry.msgstr.lines() {
                let line = line.trim();
                if let Some(idx) = line.find(':') {
                    let key = line[..idx].trim().to_string();
                    let val = line[idx + 1..].trim().to_string();
                    header_map.insert(key, val);
                }
            }
            *is_first = false;
            return;
        }
        *is_first = false;
        entries.push(entry);
    };

    for raw_line in content.lines() {
        let line = raw_line.trim();

        // Blank line → flush current entry
        if line.is_empty() {
            flush(&mut builder, &mut entries, &mut header_map, &mut is_first);
            continue;
        }

        // Comment lines
        if line.starts_with("#. ") {
            let text = &line[3..];
            builder.extracted_comment = Some(match builder.extracted_comment.take() {
                Some(prev) => format!("{}\n{}", prev, text),
                None => text.to_string(),
            });
            continue;
        }
        if line.starts_with("#: ") {
            builder.reference = Some(line[3..].to_string());
            continue;
        }
        if line.starts_with("#, ") {
            let flags_str = &line[3..];
            builder.flags = flags_str.split(',').map(|f| f.trim().to_string()).collect();
            continue;
        }
        if line.starts_with("# ") || line == "#" {
            let text = if line.len() > 2 { &line[2..] } else { "" };
            builder.translator_comment = Some(match builder.translator_comment.take() {
                Some(prev) => format!("{}\n{}", prev, text),
                None => text.to_string(),
            });
            continue;
        }

        // Keyword lines
        if let Some(rest) = line.strip_prefix("msgctxt ") {
            builder.field = ParseField::MsgCtxt;
            if let Some(val) = extract_quoted(rest) {
                builder.msgctxt = Some(val);
            } else {
                builder.msgctxt = Some(String::new());
            }
            continue;
        }
        if let Some(rest) = line.strip_prefix("msgid ") {
            builder.field = ParseField::MsgId;
            if let Some(val) = extract_quoted(rest) {
                builder.msgid = val;
            }
            continue;
        }
        if let Some(rest) = line.strip_prefix("msgstr ") {
            builder.field = ParseField::MsgStr;
            if let Some(val) = extract_quoted(rest) {
                builder.msgstr = val;
            }
            continue;
        }

        // Continuation line (bare quoted string)
        if let Some(val) = extract_quoted(line) {
            builder.append_continuation(&val);
        }
    }
    // Flush last entry
    flush(&mut builder, &mut entries, &mut header_map, &mut is_first);

    (entries, header_map)
}

fn metadata_from_header(header: &HashMap<String, String>) -> PoMetadata {
    PoMetadata {
        project_name: header
            .get("Project-Id-Version")
            .cloned()
            .unwrap_or_default(),
        language: header.get("Language").cloned().unwrap_or_default(),
        source_language: String::new(), // Not stored in standard PO headers
        game_engine: header
            .get("X-Game-Engine")
            .cloned()
            .unwrap_or_default(),
        generator: header.get("X-Generator").cloned().unwrap_or_default(),
    }
}

fn compute_stats(entries: &[PoEntry]) -> PoStats {
    let total = entries.len() as u32;
    let mut translated = 0u32;
    let mut fuzzy = 0u32;
    let mut untranslated = 0u32;

    for e in entries {
        let is_fuzzy = e.flags.iter().any(|f| f == "fuzzy");
        if is_fuzzy {
            fuzzy += 1;
        } else if e.msgstr.is_empty() {
            untranslated += 1;
        } else {
            translated += 1;
        }
    }

    PoStats {
        total,
        translated,
        untranslated,
        fuzzy,
    }
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Generate a standard .po file from translation entries.
#[command]
pub fn generate_po_file(
    entries: Vec<PoEntry>,
    metadata: PoMetadata,
    output_path: String,
) -> Result<String, String> {
    let mut parts: Vec<String> = Vec::with_capacity(entries.len() + 2);

    // Header
    parts.push(build_header(&metadata, false));

    // Entries
    for entry in &entries {
        parts.push(serialize_entry(entry));
    }

    let content = parts.join("\n\n") + "\n";

    // Ensure parent directory exists
    if let Some(parent) = Path::new(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create directory: {}", e))?;
    }

    fs::write(&output_path, content.as_bytes())
        .map_err(|e| format!("Failed to write PO file: {}", e))?;

    log::info!(
        "PO file generated: {} ({} entries)",
        output_path,
        entries.len()
    );

    Ok(output_path)
}

/// Read and parse a .po file, returning all entries and metadata.
#[command]
pub fn parse_po_file(po_path: String) -> Result<PoParseResult, String> {
    let content =
        fs::read_to_string(&po_path).map_err(|e| format!("Failed to read PO file: {}", e))?;

    let (entries, header) = parse_po_content(&content);
    let metadata = metadata_from_header(&header);
    let stats = compute_stats(&entries);

    log::info!(
        "PO file parsed: {} — {} total, {} translated, {} fuzzy, {} untranslated",
        po_path,
        stats.total,
        stats.translated,
        stats.fuzzy,
        stats.untranslated
    );

    Ok(PoParseResult {
        entries,
        metadata,
        stats,
    })
}

/// Generate a .pot (template) file. Like a PO file but all msgstr are empty.
#[command]
pub fn generate_pot_file(
    entries: Vec<PotEntry>,
    metadata: PoMetadata,
    output_path: String,
) -> Result<String, String> {
    let mut parts: Vec<String> = Vec::with_capacity(entries.len() + 2);

    parts.push(build_header(&metadata, true));

    for entry in &entries {
        parts.push(serialize_pot_entry(entry));
    }

    let content = parts.join("\n\n") + "\n";

    if let Some(parent) = Path::new(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create directory: {}", e))?;
    }

    fs::write(&output_path, content.as_bytes())
        .map_err(|e| format!("Failed to write POT file: {}", e))?;

    log::info!(
        "POT file generated: {} ({} entries)",
        output_path,
        entries.len()
    );

    Ok(output_path)
}

/// Merge existing translations (.po) with an updated source template (.pot).
/// Marks changed source strings as fuzzy, removes obsolete entries, adds new ones.
#[command]
pub fn merge_po_translations(
    pot_path: String,
    po_path: String,
    output_path: String,
) -> Result<PoMergeResult, String> {
    // Parse both files
    let pot_content =
        fs::read_to_string(&pot_path).map_err(|e| format!("Failed to read POT file: {}", e))?;
    let po_content =
        fs::read_to_string(&po_path).map_err(|e| format!("Failed to read PO file: {}", e))?;

    let (pot_entries, _pot_header) = parse_po_content(&pot_content);
    let (po_entries, po_header) = parse_po_content(&po_content);

    // Build a lookup from the existing PO: key = (msgctxt, msgid) → PoEntry
    let mut po_lookup: HashMap<(Option<String>, String), PoEntry> = HashMap::new();
    for entry in po_entries {
        po_lookup.insert((entry.msgctxt.clone(), entry.msgid.clone()), entry);
    }

    let mut merged: Vec<PoEntry> = Vec::with_capacity(pot_entries.len());
    let mut kept = 0u32;
    let mut added = 0u32;
    let mut fuzzy_count = 0u32;

    for pot_entry in &pot_entries {
        let key = (pot_entry.msgctxt.clone(), pot_entry.msgid.clone());

        if let Some(existing) = po_lookup.remove(&key) {
            // Entry exists with same source — keep translation
            merged.push(PoEntry {
                msgctxt: pot_entry.msgctxt.clone(),
                msgid: pot_entry.msgid.clone(),
                msgstr: existing.msgstr,
                reference: pot_entry.reference.clone(),
                extracted_comment: pot_entry.extracted_comment.clone(),
                translator_comment: existing.translator_comment,
                flags: existing.flags,
            });
            kept += 1;
        } else {
            // Try fuzzy match: same context but different msgid
            // Look for entries with the same context that were not yet consumed
            let fuzzy_match = if pot_entry.msgctxt.is_some() {
                po_lookup
                    .iter()
                    .find(|((ctx, _), e)| {
                        ctx == &pot_entry.msgctxt && !e.msgstr.is_empty()
                    })
                    .map(|(k, _)| k.clone())
            } else {
                None
            };

            if let Some(fuzzy_key) = fuzzy_match {
                if let Some(fuzzy_entry) = po_lookup.remove(&fuzzy_key) {
                    let mut flags = fuzzy_entry.flags.clone();
                    if !flags.contains(&"fuzzy".to_string()) {
                        flags.push("fuzzy".to_string());
                    }
                    merged.push(PoEntry {
                        msgctxt: pot_entry.msgctxt.clone(),
                        msgid: pot_entry.msgid.clone(),
                        msgstr: fuzzy_entry.msgstr,
                        reference: pot_entry.reference.clone(),
                        extracted_comment: pot_entry.extracted_comment.clone(),
                        translator_comment: fuzzy_entry.translator_comment,
                        flags,
                    });
                    fuzzy_count += 1;
                }
            } else {
                // Brand new entry
                merged.push(PoEntry {
                    msgctxt: pot_entry.msgctxt.clone(),
                    msgid: pot_entry.msgid.clone(),
                    msgstr: String::new(),
                    reference: pot_entry.reference.clone(),
                    extracted_comment: pot_entry.extracted_comment.clone(),
                    translator_comment: None,
                    flags: Vec::new(),
                });
                added += 1;
            }
        }
    }

    // Entries remaining in po_lookup are obsolete (removed from POT)
    let removed = po_lookup.len() as u32;

    // Reconstruct metadata from original PO header
    let metadata = metadata_from_header(&po_header);

    // Write merged file
    let mut parts: Vec<String> = Vec::with_capacity(merged.len() + 2);
    parts.push(build_header(&metadata, false));
    for entry in &merged {
        parts.push(serialize_entry(entry));
    }
    let content = parts.join("\n\n") + "\n";

    if let Some(parent) = Path::new(&output_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create directory: {}", e))?;
    }

    fs::write(&output_path, content.as_bytes())
        .map_err(|e| format!("Failed to write merged PO file: {}", e))?;

    log::info!(
        "PO merge: kept={}, added={}, removed={}, fuzzy={}",
        kept,
        added,
        removed,
        fuzzy_count
    );

    Ok(PoMergeResult {
        entries_kept: kept,
        entries_added: added,
        entries_removed: removed,
        entries_fuzzy: fuzzy_count,
        output_path,
    })
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_unescape_roundtrip() {
        let cases = [
            "Hello world",
            "Line1\nLine2",
            "She said \"hello\"",
            "Path\\to\\file",
            "Tab\there",
            "Mix\n\"quotes\"\tand\\backslash",
        ];
        for original in &cases {
            let escaped = escape_po_string(original);
            let unescaped = unescape_po_string(&escaped);
            assert_eq!(*original, unescaped, "Roundtrip failed for: {}", original);
        }
    }

    #[test]
    fn test_format_po_value_simple() {
        let out = format_po_value("msgid", "Hello");
        assert_eq!(out, "msgid \"Hello\"");
    }

    #[test]
    fn test_format_po_value_multiline() {
        let out = format_po_value("msgid", "Hello\nWorld");
        assert!(out.starts_with("msgid \"\""));
        assert!(out.contains("\"Hello\\n\""));
        assert!(out.contains("\"World\""));
    }

    #[test]
    fn test_parse_simple_po() {
        let po_text = r#"
msgid ""
msgstr ""
"Project-Id-Version: Test\n"
"Language: it\n"

#. Auto-extracted
#: file.txt:10
msgctxt "CTX1"
msgid "Hello"
msgstr "Ciao"

msgid "World"
msgstr ""
"#;
        let (entries, header) = parse_po_content(po_text);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].msgid, "Hello");
        assert_eq!(entries[0].msgstr, "Ciao");
        assert_eq!(entries[0].msgctxt.as_deref(), Some("CTX1"));
        assert_eq!(entries[0].reference.as_deref(), Some("file.txt:10"));
        assert_eq!(entries[1].msgid, "World");
        assert_eq!(entries[1].msgstr, "");
        assert_eq!(header.get("Language").unwrap(), "it");
    }

    #[test]
    fn test_compute_stats() {
        let entries = vec![
            PoEntry {
                msgctxt: None,
                msgid: "a".into(),
                msgstr: "b".into(),
                reference: None,
                extracted_comment: None,
                translator_comment: None,
                flags: vec![],
            },
            PoEntry {
                msgctxt: None,
                msgid: "c".into(),
                msgstr: "".into(),
                reference: None,
                extracted_comment: None,
                translator_comment: None,
                flags: vec![],
            },
            PoEntry {
                msgctxt: None,
                msgid: "d".into(),
                msgstr: "e".into(),
                reference: None,
                extracted_comment: None,
                translator_comment: None,
                flags: vec!["fuzzy".into()],
            },
        ];
        let stats = compute_stats(&entries);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.translated, 1);
        assert_eq!(stats.untranslated, 1);
        assert_eq!(stats.fuzzy, 1);
    }
}
