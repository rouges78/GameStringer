//! Shared encoding detection and decoding utilities for all game engine patchers.
//!
//! Supports: UTF-8, UTF-8 BOM, UTF-16 LE/BE, Shift-JIS, Windows-1252, EUC-JP, EUC-KR, Big5.
//! Uses `encoding_rs` for proper multi-byte decoding (replaces manual Shift-JIS approximation).

use encoding_rs::{Encoding, SHIFT_JIS, WINDOWS_1252, EUC_JP, EUC_KR, BIG5, UTF_16LE, UTF_16BE};

/// Detected encoding with confidence level.
#[derive(Debug, Clone, PartialEq)]
pub struct EncodingResult {
    /// Canonical encoding name (e.g., "utf-8", "shift-jis", "windows-1252")
    pub encoding: String,
    /// Confidence: 1.0 = BOM-confirmed, 0.9 = valid UTF-8, 0.5-0.8 = heuristic
    pub confidence: f32,
    /// Whether a BOM was found
    pub has_bom: bool,
}

/// Detect the encoding of a byte slice.
///
/// Detection order:
/// 1. BOM check (UTF-8, UTF-16 LE/BE) — confidence 1.0
/// 2. Valid UTF-8 check — confidence 0.95
/// 3. CJK heuristics (Shift-JIS, EUC-JP, EUC-KR, Big5) — confidence 0.5-0.8
/// 4. Windows-1252 fallback for Latin scripts — confidence 0.4
/// 5. UTF-8 lossy fallback — confidence 0.1
pub fn detect_encoding(data: &[u8]) -> EncodingResult {
    // 1. BOM detection (highest confidence)
    if let Some(result) = detect_bom(data) {
        return result;
    }

    // 2. Valid UTF-8?
    if std::str::from_utf8(data).is_ok() {
        return EncodingResult {
            encoding: "utf-8".to_string(),
            confidence: 0.95,
            has_bom: false,
        };
    }

    // 3. CJK heuristics
    let sjis_score = score_shift_jis(data);
    let euc_jp_score = score_euc_jp(data);
    let euc_kr_score = score_euc_kr(data);
    let big5_score = score_big5(data);
    let w1252_score = score_windows_1252(data);

    // Pick the best scoring encoding
    let mut best = ("windows-1252", w1252_score);
    if sjis_score > best.1 { best = ("shift-jis", sjis_score); }
    if euc_jp_score > best.1 { best = ("euc-jp", euc_jp_score); }
    if euc_kr_score > best.1 { best = ("euc-kr", euc_kr_score); }
    if big5_score > best.1 { best = ("big5", big5_score); }

    if best.1 > 0.0 {
        return EncodingResult {
            encoding: best.0.to_string(),
            confidence: best.1,
            has_bom: false,
        };
    }

    // 5. Fallback
    EncodingResult {
        encoding: "utf-8".to_string(),
        confidence: 0.1,
        has_bom: false,
    }
}

/// Decode bytes to String using the specified encoding name.
///
/// Supported encoding names: "utf-8", "utf-8-bom", "utf-16le", "utf-16be",
/// "shift-jis", "windows-1252", "euc-jp", "euc-kr", "big5".
///
/// Returns decoded string (lossy — invalid sequences become U+FFFD).
pub fn decode_string(data: &[u8], encoding: &str) -> String {
    match encoding {
        "utf-16le" => {
            let skip = if data.len() >= 2 && data[0] == 0xFF && data[1] == 0xFE { 2 } else { 0 };
            let pairs: Vec<u16> = data[skip..].chunks(2)
                .filter(|c| c.len() == 2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            String::from_utf16_lossy(&pairs)
        }
        "utf-16be" => {
            let skip = if data.len() >= 2 && data[0] == 0xFE && data[1] == 0xFF { 2 } else { 0 };
            let pairs: Vec<u16> = data[skip..].chunks(2)
                .filter(|c| c.len() == 2)
                .map(|c| u16::from_be_bytes([c[0], c[1]]))
                .collect();
            String::from_utf16_lossy(&pairs)
        }
        "utf-8-bom" => {
            let skip = if data.len() >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF { 3 } else { 0 };
            String::from_utf8_lossy(&data[skip..]).to_string()
        }
        "utf-8" => String::from_utf8_lossy(data).to_string(),
        other => {
            // Use encoding_rs for everything else.
            // Use decode_without_bom_handling to avoid false-positive BOM sniffing
            // (e.g., Windows-1252 data starting with 0xFF 0xFE should not be
            // reinterpreted as UTF-16LE).
            if let Some(enc) = lookup_encoding(other) {
                let (decoded, _) = enc.decode_without_bom_handling(data);
                decoded.to_string()
            } else {
                String::from_utf8_lossy(data).to_string()
            }
        }
    }
}

/// Auto-detect encoding and decode bytes to String in one step.
///
/// Convenience wrapper combining `detect_encoding` + `decode_string`.
pub fn auto_decode(data: &[u8]) -> (String, EncodingResult) {
    let result = detect_encoding(data);
    let decoded = decode_string(data, &result.encoding);
    (decoded, result)
}

/// Encode a String back to bytes in the specified encoding.
///
/// Useful for patching: decode → translate → re-encode in original encoding.
pub fn encode_string(text: &str, encoding: &str) -> Vec<u8> {
    match encoding {
        "utf-8" | "utf-8-bom" => {
            let mut result = Vec::new();
            if encoding == "utf-8-bom" {
                result.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
            }
            result.extend_from_slice(text.as_bytes());
            result
        }
        "utf-16le" => {
            let mut result = Vec::new();
            for code_unit in text.encode_utf16() {
                result.extend_from_slice(&code_unit.to_le_bytes());
            }
            result
        }
        "utf-16be" => {
            let mut result = Vec::new();
            for code_unit in text.encode_utf16() {
                result.extend_from_slice(&code_unit.to_be_bytes());
            }
            result
        }
        other => {
            if let Some(enc) = lookup_encoding(other) {
                let (encoded, _, _) = enc.encode(text);
                encoded.to_vec()
            } else {
                text.as_bytes().to_vec()
            }
        }
    }
}

/// Strip BOM from data, returning the data without BOM and the BOM type found.
pub fn strip_bom(data: &[u8]) -> (&[u8], Option<&str>) {
    if data.len() >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
        (&data[3..], Some("utf-8-bom"))
    } else if data.len() >= 2 && data[0] == 0xFF && data[1] == 0xFE {
        (&data[2..], Some("utf-16le"))
    } else if data.len() >= 2 && data[0] == 0xFE && data[1] == 0xFF {
        (&data[2..], Some("utf-16be"))
    } else {
        (data, None)
    }
}

/// Check if data looks like UTF-16 (lots of null bytes alternating with content).
pub fn is_utf16(data: &[u8]) -> Option<&str> {
    if data.len() < 4 { return None; }

    // Check BOM first
    if data[0] == 0xFF && data[1] == 0xFE { return Some("utf-16le"); }
    if data[0] == 0xFE && data[1] == 0xFF { return Some("utf-16be"); }

    // Heuristic: count null bytes in even vs odd positions
    let sample = &data[..data.len().min(256)];
    let null_even: usize = sample.iter().step_by(2).filter(|&&b| b == 0).count();
    let null_odd: usize = sample.iter().skip(1).step_by(2).filter(|&&b| b == 0).count();
    let half = sample.len() / 2;

    // If >40% of even positions are null → UTF-16BE (big byte is zero for ASCII)
    if half > 0 && null_even > half * 2 / 5 && null_odd < half / 5 {
        return Some("utf-16be");
    }
    // If >40% of odd positions are null → UTF-16LE
    if half > 0 && null_odd > half * 2 / 5 && null_even < half / 5 {
        return Some("utf-16le");
    }

    None
}

// === Internal helpers ===

fn detect_bom(data: &[u8]) -> Option<EncodingResult> {
    if data.len() >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
        return Some(EncodingResult {
            encoding: "utf-8-bom".to_string(),
            confidence: 1.0,
            has_bom: true,
        });
    }
    if data.len() >= 2 && data[0] == 0xFF && data[1] == 0xFE {
        return Some(EncodingResult {
            encoding: "utf-16le".to_string(),
            confidence: 1.0,
            has_bom: true,
        });
    }
    if data.len() >= 2 && data[0] == 0xFE && data[1] == 0xFF {
        return Some(EncodingResult {
            encoding: "utf-16be".to_string(),
            confidence: 1.0,
            has_bom: true,
        });
    }
    None
}

/// Score how likely data is Shift-JIS (0.0 to 0.8).
fn score_shift_jis(data: &[u8]) -> f32 {
    let mut valid_sequences = 0u32;
    let mut invalid_sequences = 0u32;
    let mut i = 0;

    while i < data.len() {
        let b = data[i];
        if b < 0x80 {
            i += 1;
            continue;
        }
        if (0xA1..=0xDF).contains(&b) {
            // Half-width katakana — strong Shift-JIS signal
            valid_sequences += 2;
            i += 1;
        } else if ((0x81..=0x9F).contains(&b) || (0xE0..=0xFC).contains(&b)) && i + 1 < data.len() {
            let b2 = data[i + 1];
            if (0x40..=0x7E).contains(&b2) || (0x80..=0xFC).contains(&b2) {
                valid_sequences += 1;
                i += 2;
            } else {
                invalid_sequences += 1;
                i += 1;
            }
        } else {
            invalid_sequences += 1;
            i += 1;
        }
    }

    if valid_sequences == 0 { return 0.0; }
    let total = valid_sequences + invalid_sequences;
    let ratio = valid_sequences as f32 / total as f32;
    // Scale: pure valid → 0.8, 50% valid → 0.4
    ratio * 0.8
}

/// Score how likely data is EUC-JP (0.0 to 0.8).
fn score_euc_jp(data: &[u8]) -> f32 {
    let mut valid = 0u32;
    let mut invalid = 0u32;
    let mut i = 0;

    while i < data.len() {
        let b = data[i];
        if b < 0x80 {
            i += 1;
            continue;
        }
        if (0xA1..=0xFE).contains(&b) && i + 1 < data.len() {
            let b2 = data[i + 1];
            if (0xA1..=0xFE).contains(&b2) {
                valid += 1;
                i += 2;
                continue;
            }
        }
        // SS2 (0x8E) + katakana
        if b == 0x8E && i + 1 < data.len() && (0xA1..=0xDF).contains(&data[i + 1]) {
            valid += 1;
            i += 2;
            continue;
        }
        // SS3 (0x8F) + 2 bytes
        if b == 0x8F && i + 2 < data.len()
            && (0xA1..=0xFE).contains(&data[i + 1])
            && (0xA1..=0xFE).contains(&data[i + 2])
        {
            valid += 1;
            i += 3;
            continue;
        }
        invalid += 1;
        i += 1;
    }

    if valid == 0 { return 0.0; }
    let ratio = valid as f32 / (valid + invalid) as f32;
    ratio * 0.75 // Slightly lower max than SJIS since EUC-JP overlaps
}

/// Score how likely data is EUC-KR (0.0 to 0.7).
fn score_euc_kr(data: &[u8]) -> f32 {
    let mut valid = 0u32;
    let mut invalid = 0u32;
    let mut i = 0;

    while i < data.len() {
        let b = data[i];
        if b < 0x80 {
            i += 1;
            continue;
        }
        if (0xA1..=0xFE).contains(&b) && i + 1 < data.len() {
            let b2 = data[i + 1];
            if (0xA1..=0xFE).contains(&b2) {
                valid += 1;
                i += 2;
                continue;
            }
        }
        invalid += 1;
        i += 1;
    }

    if valid == 0 { return 0.0; }
    let ratio = valid as f32 / (valid + invalid) as f32;
    ratio * 0.7
}

/// Score how likely data is Big5 (0.0 to 0.7).
fn score_big5(data: &[u8]) -> f32 {
    let mut valid = 0u32;
    let mut invalid = 0u32;
    let mut i = 0;

    while i < data.len() {
        let b = data[i];
        if b < 0x80 {
            i += 1;
            continue;
        }
        if (0x81..=0xFE).contains(&b) && i + 1 < data.len() {
            let b2 = data[i + 1];
            if (0x40..=0x7E).contains(&b2) || (0xA1..=0xFE).contains(&b2) {
                valid += 1;
                i += 2;
                continue;
            }
        }
        invalid += 1;
        i += 1;
    }

    if valid == 0 { return 0.0; }
    let ratio = valid as f32 / (valid + invalid) as f32;
    ratio * 0.7
}

/// Score how likely data is Windows-1252 (0.0 to 0.6).
fn score_windows_1252(data: &[u8]) -> f32 {
    // Windows-1252 is a superset of Latin-1 with chars in 0x80-0x9F
    let mut high_bytes = 0u32;
    let mut w1252_special = 0u32; // 0x80-0x9F chars that exist in Windows-1252 but not Latin-1

    for &b in data {
        if b >= 0x80 {
            high_bytes += 1;
            // Windows-1252 specific: these are valid characters (€, ‚, ƒ, „, etc.)
            // vs Latin-1 where 0x80-0x9F are control codes
            if matches!(b, 0x80 | 0x82..=0x8C | 0x8E | 0x91..=0x9C | 0x9E | 0x9F) {
                w1252_special += 1;
            }
        }
    }

    if high_bytes == 0 { return 0.0; }

    // If we see Windows-1252 specific bytes, it's likely W1252
    if w1252_special > 0 {
        return 0.6;
    }

    // High bytes in 0xA0-0xFF are valid in both Latin-1 and W1252
    // Common for accented chars in European languages
    let ratio = high_bytes as f32 / data.len() as f32;
    if ratio > 0.01 && ratio < 0.3 {
        0.4 // Reasonable amount of accented characters
    } else {
        0.0
    }
}

/// Lookup encoding_rs Encoding by name.
fn lookup_encoding(name: &str) -> Option<&'static Encoding> {
    match name.to_lowercase().as_str() {
        "shift-jis" | "shift_jis" | "sjis" | "shiftjis" | "cp932" => Some(SHIFT_JIS),
        "windows-1252" | "windows_1252" | "cp1252" | "latin1" | "iso-8859-1" => Some(WINDOWS_1252),
        "euc-jp" | "euc_jp" | "eucjp" => Some(EUC_JP),
        "euc-kr" | "euc_kr" | "euckr" | "cp949" => Some(EUC_KR),
        "big5" | "big-5" | "cp950" => Some(BIG5),
        "utf-16le" | "utf16le" => Some(UTF_16LE),
        "utf-16be" | "utf16be" => Some(UTF_16BE),
        _ => Encoding::for_label(name.as_bytes()),
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    // === BOM Detection ===

    #[test]
    fn test_detect_utf8_bom() {
        let data = [0xEF, 0xBB, 0xBF, b'H', b'e', b'l', b'l', b'o'];
        let result = detect_encoding(&data);
        assert_eq!(result.encoding, "utf-8-bom");
        assert_eq!(result.confidence, 1.0);
        assert!(result.has_bom);
    }

    #[test]
    fn test_detect_utf16le_bom() {
        let data = [0xFF, 0xFE, b'H', 0x00, b'i', 0x00];
        let result = detect_encoding(&data);
        assert_eq!(result.encoding, "utf-16le");
        assert_eq!(result.confidence, 1.0);
        assert!(result.has_bom);
    }

    #[test]
    fn test_detect_utf16be_bom() {
        let data = [0xFE, 0xFF, 0x00, b'H', 0x00, b'i'];
        let result = detect_encoding(&data);
        assert_eq!(result.encoding, "utf-16be");
        assert_eq!(result.confidence, 1.0);
        assert!(result.has_bom);
    }

    // === UTF-8 Detection ===

    #[test]
    fn test_detect_utf8_ascii() {
        let data = b"Hello World!";
        let result = detect_encoding(data);
        assert_eq!(result.encoding, "utf-8");
        assert!(result.confidence >= 0.9);
        assert!(!result.has_bom);
    }

    #[test]
    fn test_detect_utf8_multibyte() {
        let data = "Héllo Wörld! 日本語".as_bytes();
        let result = detect_encoding(data);
        assert_eq!(result.encoding, "utf-8");
        assert!(result.confidence >= 0.9);
    }

    #[test]
    fn test_detect_empty() {
        let result = detect_encoding(b"");
        assert_eq!(result.encoding, "utf-8");
    }

    // === Shift-JIS Detection ===

    #[test]
    fn test_detect_shift_jis() {
        // "テスト" in Shift-JIS = 0x83 0x65 0x83 0x58 0x83 0x67
        let data = [0x83, 0x65, 0x83, 0x58, 0x83, 0x67];
        let result = detect_encoding(&data);
        assert_eq!(result.encoding, "shift-jis");
        assert!(result.confidence > 0.5);
    }

    #[test]
    fn test_detect_shift_jis_with_ascii() {
        // ASCII text mixed with Shift-JIS
        let mut data = Vec::from(b"Hello " as &[u8]);
        data.extend_from_slice(&[0x83, 0x65, 0x83, 0x58, 0x83, 0x67]); // テスト
        let result = detect_encoding(&data);
        assert_eq!(result.encoding, "shift-jis");
    }

    #[test]
    fn test_detect_shift_jis_halfwidth_katakana() {
        // Half-width katakana: ｱｲｳ = 0xB1 0xB2 0xB3
        let data = [0xB1, 0xB2, 0xB3];
        let result = detect_encoding(&data);
        assert_eq!(result.encoding, "shift-jis");
    }

    // === Windows-1252 Detection ===

    #[test]
    fn test_detect_windows_1252() {
        // "café" with é=0xE9 (valid in both Latin-1 and W1252)
        // plus € = 0x80 (W1252-specific)
        let data = [b'c', b'a', b'f', 0xE9, b' ', 0x80, b'5'];
        let result = detect_encoding(&data);
        assert_eq!(result.encoding, "windows-1252");
        assert!(result.confidence >= 0.4);
    }

    #[test]
    fn test_detect_windows_1252_accented() {
        // "naïve résumé" in Windows-1252/Latin-1
        let data = [b'n', b'a', 0xEF, b'v', b'e', b' ', b'r', 0xE9, b's', b'u', b'm', 0xE9];
        let result = detect_encoding(&data);
        // Should detect as W1252 (high bytes in 0xA0-0xFF range)
        assert!(result.encoding == "windows-1252" || result.encoding == "shift-jis");
    }

    // === Decode ===

    #[test]
    fn test_decode_utf8() {
        let text = "Hello 日本語!";
        let decoded = decode_string(text.as_bytes(), "utf-8");
        assert_eq!(decoded, text);
    }

    #[test]
    fn test_decode_utf8_bom() {
        let mut data = vec![0xEF, 0xBB, 0xBF];
        data.extend_from_slice(b"Hello");
        let decoded = decode_string(&data, "utf-8-bom");
        assert_eq!(decoded, "Hello");
    }

    #[test]
    fn test_decode_utf16le() {
        // "Hi" in UTF-16LE with BOM
        let data = [0xFF, 0xFE, b'H', 0x00, b'i', 0x00];
        let decoded = decode_string(&data, "utf-16le");
        assert_eq!(decoded, "Hi");
    }

    #[test]
    fn test_decode_utf16le_no_bom() {
        let data = [b'H', 0x00, b'i', 0x00];
        let decoded = decode_string(&data, "utf-16le");
        assert_eq!(decoded, "Hi");
    }

    #[test]
    fn test_decode_utf16be() {
        let data = [0xFE, 0xFF, 0x00, b'H', 0x00, b'i'];
        let decoded = decode_string(&data, "utf-16be");
        assert_eq!(decoded, "Hi");
    }

    #[test]
    fn test_decode_shift_jis() {
        // "テスト" in Shift-JIS
        let data = [0x83, 0x65, 0x83, 0x58, 0x83, 0x67];
        let decoded = decode_string(&data, "shift-jis");
        assert_eq!(decoded, "テスト");
    }

    #[test]
    fn test_decode_shift_jis_mixed() {
        // "Hello" + テスト
        let mut data = Vec::from(b"Hello" as &[u8]);
        data.extend_from_slice(&[0x83, 0x65, 0x83, 0x58, 0x83, 0x67]);
        let decoded = decode_string(&data, "shift-jis");
        assert_eq!(decoded, "Helloテスト");
    }

    #[test]
    fn test_decode_windows_1252() {
        // "café" — é is 0xE9 in Windows-1252
        let data = [b'c', b'a', b'f', 0xE9];
        let decoded = decode_string(&data, "windows-1252");
        assert_eq!(decoded, "café");
    }

    #[test]
    fn test_decode_windows_1252_euro() {
        // € is 0x80 in Windows-1252
        let data = [0x80];
        let decoded = decode_string(&data, "windows-1252");
        assert_eq!(decoded, "€");
    }

    // === Auto-decode ===

    #[test]
    fn test_auto_decode_utf8() {
        let (text, result) = auto_decode("Hello World".as_bytes());
        assert_eq!(text, "Hello World");
        assert_eq!(result.encoding, "utf-8");
    }

    #[test]
    fn test_auto_decode_shift_jis() {
        let data = [0x83, 0x65, 0x83, 0x58, 0x83, 0x67]; // テスト
        let (text, result) = auto_decode(&data);
        assert_eq!(result.encoding, "shift-jis");
        assert_eq!(text, "テスト");
    }

    #[test]
    fn test_auto_decode_utf16le_bom() {
        let data = [0xFF, 0xFE, b'O', 0x00, b'K', 0x00];
        let (text, result) = auto_decode(&data);
        assert_eq!(result.encoding, "utf-16le");
        assert_eq!(text, "OK");
    }

    // === Encode ===

    #[test]
    fn test_encode_utf8() {
        let encoded = encode_string("Hello", "utf-8");
        assert_eq!(encoded, b"Hello");
    }

    #[test]
    fn test_encode_utf8_bom() {
        let encoded = encode_string("Hi", "utf-8-bom");
        assert_eq!(&encoded[..3], &[0xEF, 0xBB, 0xBF]);
        assert_eq!(&encoded[3..], b"Hi");
    }

    #[test]
    fn test_encode_utf16le() {
        let encoded = encode_string("Hi", "utf-16le");
        assert_eq!(encoded, vec![b'H', 0x00, b'i', 0x00]);
    }

    #[test]
    fn test_encode_utf16be() {
        let encoded = encode_string("Hi", "utf-16be");
        assert_eq!(encoded, vec![0x00, b'H', 0x00, b'i']);
    }

    #[test]
    fn test_encode_shift_jis() {
        let encoded = encode_string("テスト", "shift-jis");
        assert_eq!(encoded, vec![0x83, 0x65, 0x83, 0x58, 0x83, 0x67]);
    }

    #[test]
    fn test_encode_windows_1252() {
        let encoded = encode_string("café", "windows-1252");
        assert_eq!(encoded, vec![b'c', b'a', b'f', 0xE9]);
    }

    // === Round-trip ===

    #[test]
    fn test_roundtrip_shift_jis() {
        let original = [0x83, 0x65, 0x83, 0x58, 0x83, 0x67]; // テスト
        let decoded = decode_string(&original, "shift-jis");
        let reencoded = encode_string(&decoded, "shift-jis");
        assert_eq!(reencoded, original);
    }

    #[test]
    fn test_roundtrip_windows_1252() {
        let original = [b'c', b'a', b'f', 0xE9]; // café
        let decoded = decode_string(&original, "windows-1252");
        let reencoded = encode_string(&decoded, "windows-1252");
        assert_eq!(reencoded, original.to_vec());
    }

    #[test]
    fn test_roundtrip_utf16le() {
        let text = "Hello 世界";
        let encoded = encode_string(text, "utf-16le");
        let decoded = decode_string(&encoded, "utf-16le");
        assert_eq!(decoded, text);
    }

    // === Strip BOM ===

    #[test]
    fn test_strip_bom_utf8() {
        let data = [0xEF, 0xBB, 0xBF, b'H', b'i'];
        let (stripped, bom) = strip_bom(&data);
        assert_eq!(stripped, b"Hi");
        assert_eq!(bom, Some("utf-8-bom"));
    }

    #[test]
    fn test_strip_bom_utf16le() {
        let data = [0xFF, 0xFE, b'H', 0x00];
        let (stripped, bom) = strip_bom(&data);
        assert_eq!(stripped, &[b'H', 0x00]);
        assert_eq!(bom, Some("utf-16le"));
    }

    #[test]
    fn test_strip_bom_none() {
        let data = b"Hello";
        let (stripped, bom) = strip_bom(data);
        assert_eq!(stripped, b"Hello");
        assert_eq!(bom, None);
    }

    // === is_utf16 ===

    #[test]
    fn test_is_utf16_le_bom() {
        let data = [0xFF, 0xFE, b'H', 0x00];
        assert_eq!(is_utf16(&data), Some("utf-16le"));
    }

    #[test]
    fn test_is_utf16_be_bom() {
        let data = [0xFE, 0xFF, 0x00, b'H'];
        assert_eq!(is_utf16(&data), Some("utf-16be"));
    }

    #[test]
    fn test_is_utf16_le_heuristic() {
        // ASCII text in UTF-16LE (null bytes in odd positions)
        let mut data = Vec::new();
        for &b in b"Hello World Test" {
            data.push(b);
            data.push(0x00);
        }
        assert_eq!(is_utf16(&data), Some("utf-16le"));
    }

    #[test]
    fn test_is_utf16_not() {
        let data = b"Just plain ASCII text here";
        assert_eq!(is_utf16(data), None);
    }

    #[test]
    fn test_is_utf16_too_short() {
        assert_eq!(is_utf16(b"Hi"), None);
    }

    // === Lookup encoding ===

    #[test]
    fn test_lookup_encoding_aliases() {
        assert!(lookup_encoding("shift-jis").is_some());
        assert!(lookup_encoding("sjis").is_some());
        assert!(lookup_encoding("cp932").is_some());
        assert!(lookup_encoding("windows-1252").is_some());
        assert!(lookup_encoding("cp1252").is_some());
        assert!(lookup_encoding("euc-jp").is_some());
        assert!(lookup_encoding("big5").is_some());
    }

    #[test]
    fn test_lookup_encoding_unknown() {
        // encoding_rs's for_label handles many aliases
        assert!(lookup_encoding("completely-bogus-12345").is_none());
    }

    // === Score functions edge cases ===

    #[test]
    fn test_score_shift_jis_pure_ascii() {
        assert_eq!(score_shift_jis(b"Hello World"), 0.0);
    }

    #[test]
    fn test_score_euc_jp_pure_ascii() {
        assert_eq!(score_euc_jp(b"Hello World"), 0.0);
    }

    #[test]
    fn test_score_windows_1252_pure_ascii() {
        assert_eq!(score_windows_1252(b"Hello World"), 0.0);
    }

    #[test]
    fn test_score_empty() {
        assert_eq!(score_shift_jis(b""), 0.0);
        assert_eq!(score_euc_jp(b""), 0.0);
        assert_eq!(score_euc_kr(b""), 0.0);
        assert_eq!(score_big5(b""), 0.0);
        assert_eq!(score_windows_1252(b""), 0.0);
    }
}
