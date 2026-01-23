use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 🧠 Context Injection AI System
/// 
/// Genera automaticamente contesto per migliorare traduzioni AI.
/// Il contesto viene passato a DeepL/OpenAI GRATUITAMENTE (non fatturato).
/// 
/// Tipi di contesto:
/// - Game context (genere, tono, ambientazione)
/// - Surrounding text (frasi precedenti/successive)
/// - Glossary terms (termini rilevanti dal glossary)
/// - Character info (chi parla, personalità)
/// - Scene info (dove, quando, situazione)

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationContext {
    pub game_context: Option<GameContext>,
    pub surrounding_text: Option<SurroundingText>,
    pub glossary_hints: Vec<GlossaryHint>,
    pub character_info: Option<CharacterInfo>,
    pub scene_info: Option<SceneInfo>,
    pub cultural_notes: Vec<String>,
    pub formatting_rules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameContext {
    pub game_name: Option<String>,
    pub genre: String,           // RPG, FPS, Adventure, etc.
    pub tone: String,            // serious, humorous, dark, lighthearted
    pub setting: String,         // fantasy, sci-fi, modern, historical
    pub target_audience: String, // all_ages, teen, mature
    pub formality: String,       // formal, informal, casual, mixed
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurroundingText {
    pub previous_lines: Vec<String>,
    pub next_lines: Vec<String>,
    pub file_context: Option<String>,  // Nome file o sezione
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryHint {
    pub source_term: String,
    pub target_term: String,
    pub tier: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterInfo {
    pub name: Option<String>,
    pub personality: Option<String>,    // shy, bold, wise, childish
    pub speaking_style: Option<String>, // formal, slang, archaic, robotic
    pub gender: Option<String>,
    pub age_group: Option<String>,      // child, teen, adult, elderly
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneInfo {
    pub location: Option<String>,
    pub situation: Option<String>,  // battle, peaceful, tense, romantic
    pub emotion: Option<String>,    // happy, sad, angry, scared
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextInjectionResult {
    pub context_string: String,           // Stringa formattata per API
    pub deepl_context: String,            // Formato specifico DeepL
    pub openai_system_prompt: String,     // System prompt per OpenAI
    pub anthropic_system_prompt: String,  // System prompt per Claude
    pub hints_count: u32,
}

/// Genera contesto per traduzione
#[tauri::command]
pub fn generate_translation_context(
    _text: String,
    context: TranslationContext,
    source_lang: String,
    target_lang: String,
) -> Result<ContextInjectionResult, String> {
    let mut context_parts: Vec<String> = Vec::new();
    let mut hints_count = 0u32;
    
    // 1. Game Context
    if let Some(gc) = &context.game_context {
        context_parts.push(format!(
            "Game: {} ({}, {} tone, {} setting)",
            gc.game_name.as_deref().unwrap_or("Unknown"),
            gc.genre,
            gc.tone,
            gc.setting
        ));
        context_parts.push(format!("Formality: {}", gc.formality));
    }
    
    // 2. Character Info
    if let Some(char) = &context.character_info {
        let mut char_desc = Vec::new();
        if let Some(name) = &char.name {
            char_desc.push(format!("Speaker: {}", name));
        }
        if let Some(style) = &char.speaking_style {
            char_desc.push(format!("Style: {}", style));
        }
        if let Some(personality) = &char.personality {
            char_desc.push(format!("Personality: {}", personality));
        }
        if !char_desc.is_empty() {
            context_parts.push(char_desc.join(", "));
        }
    }
    
    // 3. Scene Info
    if let Some(scene) = &context.scene_info {
        let mut scene_desc = Vec::new();
        if let Some(loc) = &scene.location {
            scene_desc.push(format!("Location: {}", loc));
        }
        if let Some(sit) = &scene.situation {
            scene_desc.push(format!("Situation: {}", sit));
        }
        if let Some(emo) = &scene.emotion {
            scene_desc.push(format!("Emotion: {}", emo));
        }
        if !scene_desc.is_empty() {
            context_parts.push(scene_desc.join(", "));
        }
    }
    
    // 4. Surrounding Text
    if let Some(surrounding) = &context.surrounding_text {
        if !surrounding.previous_lines.is_empty() {
            context_parts.push(format!("Previous: {}", surrounding.previous_lines.join(" | ")));
        }
    }
    
    // 5. Glossary Hints
    if !context.glossary_hints.is_empty() {
        let hints: Vec<String> = context.glossary_hints.iter()
            .map(|h| format!("\"{}\" → \"{}\"", h.source_term, h.target_term))
            .collect();
        context_parts.push(format!("Terminology: {}", hints.join("; ")));
        hints_count = context.glossary_hints.len() as u32;
    }
    
    // 6. Cultural Notes
    if !context.cultural_notes.is_empty() {
        context_parts.push(format!("Notes: {}", context.cultural_notes.join("; ")));
    }
    
    // Build context string
    let context_string = context_parts.join(". ");
    
    // DeepL format (simple context)
    let deepl_context = if context_parts.len() > 0 {
        context_string.clone()
    } else {
        String::new()
    };
    
    // OpenAI system prompt
    let openai_system_prompt = build_openai_prompt(&context, &source_lang, &target_lang);
    
    // Anthropic system prompt
    let anthropic_system_prompt = build_anthropic_prompt(&context, &source_lang, &target_lang);
    
    Ok(ContextInjectionResult {
        context_string,
        deepl_context,
        openai_system_prompt,
        anthropic_system_prompt,
        hints_count,
    })
}

fn build_openai_prompt(context: &TranslationContext, source_lang: &str, target_lang: &str) -> String {
    let mut prompt = format!(
        "You are a professional game translator specializing in {} to {} translation.\n\n",
        get_language_name(source_lang),
        get_language_name(target_lang)
    );
    
    if let Some(gc) = &context.game_context {
        prompt.push_str(&format!(
            "GAME CONTEXT:\n- Genre: {}\n- Tone: {}\n- Setting: {}\n- Formality: {}\n\n",
            gc.genre, gc.tone, gc.setting, gc.formality
        ));
    }
    
    if let Some(char) = &context.character_info {
        prompt.push_str("CHARACTER:\n");
        if let Some(name) = &char.name {
            prompt.push_str(&format!("- Name: {}\n", name));
        }
        if let Some(style) = &char.speaking_style {
            prompt.push_str(&format!("- Speaking style: {}\n", style));
        }
        if let Some(personality) = &char.personality {
            prompt.push_str(&format!("- Personality: {}\n", personality));
        }
        prompt.push('\n');
    }
    
    if !context.glossary_hints.is_empty() {
        prompt.push_str("MANDATORY TERMINOLOGY (use exactly as shown):\n");
        for hint in &context.glossary_hints {
            let tier_note = match hint.tier.as_str() {
                "locked" => " [LOCKED - never change]",
                "synced" => " [SYNCED - keep consistent]",
                _ => "",
            };
            prompt.push_str(&format!("- \"{}\" → \"{}\"{}\n", hint.source_term, hint.target_term, tier_note));
        }
        prompt.push('\n');
    }
    
    if !context.cultural_notes.is_empty() {
        prompt.push_str("CULTURAL NOTES:\n");
        for note in &context.cultural_notes {
            prompt.push_str(&format!("- {}\n", note));
        }
        prompt.push('\n');
    }
    
    prompt.push_str("RULES:\n");
    prompt.push_str("1. Preserve all placeholders ({0}, %s, etc.) exactly as they appear\n");
    prompt.push_str("2. Maintain the same tone and formality level\n");
    prompt.push_str("3. Keep proper names unless a translation is provided in terminology\n");
    prompt.push_str("4. Preserve HTML/XML tags if present\n");
    prompt.push_str("5. Return ONLY the translation, no explanations\n");
    
    prompt
}

fn build_anthropic_prompt(context: &TranslationContext, source_lang: &str, target_lang: &str) -> String {
    let mut prompt = format!(
        "You are an expert game localizer. Translate from {} to {}.\n\n",
        get_language_name(source_lang),
        get_language_name(target_lang)
    );
    
    if let Some(gc) = &context.game_context {
        prompt.push_str(&format!(
            "<game_context>\nGenre: {}\nTone: {}\nSetting: {}\nFormality: {}\n</game_context>\n\n",
            gc.genre, gc.tone, gc.setting, gc.formality
        ));
    }
    
    if !context.glossary_hints.is_empty() {
        prompt.push_str("<terminology>\n");
        for hint in &context.glossary_hints {
            prompt.push_str(&format!("{} = {}\n", hint.source_term, hint.target_term));
        }
        prompt.push_str("</terminology>\n\n");
    }
    
    prompt.push_str("<rules>\n");
    prompt.push_str("- Use the exact terminology provided\n");
    prompt.push_str("- Preserve placeholders and tags\n");
    prompt.push_str("- Match the tone and formality\n");
    prompt.push_str("- Output translation only\n");
    prompt.push_str("</rules>\n");
    
    prompt
}

fn get_language_name(code: &str) -> &str {
    match code.to_lowercase().as_str() {
        "en" => "English",
        "it" => "Italian",
        "es" => "Spanish",
        "fr" => "French",
        "de" => "German",
        "pt" => "Portuguese",
        "ja" => "Japanese",
        "ko" => "Korean",
        "zh" => "Chinese",
        "ru" => "Russian",
        "pl" => "Polish",
        "ar" => "Arabic",
        "tr" => "Turkish",
        "nl" => "Dutch",
        "sv" => "Swedish",
        _ => code,
    }
}

/// Estrae automaticamente contesto da testo circostante
#[tauri::command]
pub fn extract_context_from_text(
    texts: Vec<String>,
    current_index: usize,
    window_size: Option<usize>,
) -> Result<SurroundingText, String> {
    let window = window_size.unwrap_or(2);
    
    let start = if current_index >= window { current_index - window } else { 0 };
    let end = std::cmp::min(current_index + window + 1, texts.len());
    
    let previous_lines: Vec<String> = if current_index > 0 {
        texts[start..current_index].to_vec()
    } else {
        Vec::new()
    };
    
    let next_lines: Vec<String> = if current_index + 1 < texts.len() {
        texts[current_index + 1..end].to_vec()
    } else {
        Vec::new()
    };
    
    Ok(SurroundingText {
        previous_lines,
        next_lines,
        file_context: None,
    })
}

/// Rileva automaticamente il tono del testo
#[tauri::command]
pub fn detect_text_tone(text: String) -> Result<ToneAnalysis, String> {
    let text_lower = text.to_lowercase();
    
    // Simple heuristics for tone detection
    let mut scores: HashMap<&str, i32> = HashMap::new();
    
    // Formal indicators
    let formal_words = ["please", "kindly", "shall", "would you", "sir", "madam", "hereby"];
    for word in &formal_words {
        if text_lower.contains(word) {
            *scores.entry("formal").or_insert(0) += 1;
        }
    }
    
    // Informal indicators
    let informal_words = ["hey", "yeah", "gonna", "wanna", "cool", "awesome", "dude", "man"];
    for word in &informal_words {
        if text_lower.contains(word) {
            *scores.entry("informal").or_insert(0) += 1;
        }
    }
    
    // Serious indicators
    let serious_words = ["danger", "warning", "death", "serious", "important", "critical"];
    for word in &serious_words {
        if text_lower.contains(word) {
            *scores.entry("serious").or_insert(0) += 1;
        }
    }
    
    // Humorous indicators
    let humor_words = ["haha", "lol", "funny", "joke", "kidding", "hilarious"];
    for word in &humor_words {
        if text_lower.contains(word) {
            *scores.entry("humorous").or_insert(0) += 1;
        }
    }
    
    // Exclamation marks suggest emotion/excitement
    let exclamations = text.matches('!').count();
    if exclamations > 1 {
        *scores.entry("excited").or_insert(0) += exclamations as i32;
    }
    
    // Question marks
    let questions = text.matches('?').count();
    if questions > 0 {
        *scores.entry("questioning").or_insert(0) += questions as i32;
    }
    
    // Determine primary tone
    let primary_tone = scores.iter()
        .max_by_key(|&(_, v)| v)
        .map(|(k, _)| k.to_string())
        .unwrap_or_else(|| "neutral".to_string());
    
    // Determine formality
    let formal_score = scores.get("formal").unwrap_or(&0);
    let informal_score = scores.get("informal").unwrap_or(&0);
    let formality = if formal_score > informal_score {
        "formal"
    } else if informal_score > formal_score {
        "informal"
    } else {
        "neutral"
    };
    
    // Convert to String keys
    let string_scores: HashMap<String, i32> = scores.iter()
        .map(|(k, v)| (k.to_string(), *v))
        .collect();
    
    Ok(ToneAnalysis {
        primary_tone,
        formality: formality.to_string(),
        scores: string_scores,
        confidence: calculate_confidence(&scores),
    })
}

fn calculate_confidence(scores: &HashMap<&str, i32>) -> f32 {
    let total: i32 = scores.values().sum();
    if total == 0 {
        return 0.5;
    }
    let max = *scores.values().max().unwrap_or(&0);
    (max as f32 / total as f32).min(1.0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToneAnalysis {
    pub primary_tone: String,
    pub formality: String,
    #[serde(skip)]
    #[allow(dead_code)]
    pub scores: HashMap<String, i32>,
    pub confidence: f32,
}

/// Genera hint culturali per una coppia di lingue
#[tauri::command]
pub fn get_cultural_hints(
    _source_lang: String,
    target_lang: String,
    category: Option<String>,
) -> Result<Vec<CulturalHint>, String> {
    let mut hints = Vec::new();
    
    // IT -> altre lingue
    if target_lang == "it" {
        hints.push(CulturalHint {
            category: "formality".to_string(),
            hint: "Italian uses formal 'Lei' and informal 'tu' - match the game's tone".to_string(),
            example: Some("'You must go' → 'Devi andare' (informal) or 'Deve andare' (formal)".to_string()),
        });
        hints.push(CulturalHint {
            category: "expressions".to_string(),
            hint: "Avoid literal translation of idioms - use Italian equivalents".to_string(),
            example: Some("'It's raining cats and dogs' → 'Piove a catinelle'".to_string()),
        });
    }
    
    // ES variants
    if target_lang == "es" {
        hints.push(CulturalHint {
            category: "regional".to_string(),
            hint: "Spanish varies significantly between Spain (es-ES) and Latin America (es-419)".to_string(),
            example: Some("'Computer' → 'Ordenador' (Spain) vs 'Computadora' (LATAM)".to_string()),
        });
        hints.push(CulturalHint {
            category: "formality".to_string(),
            hint: "Spain uses 'vosotros', Latin America uses 'ustedes' for plural you".to_string(),
            example: None,
        });
    }
    
    // PT variants
    if target_lang == "pt" {
        hints.push(CulturalHint {
            category: "regional".to_string(),
            hint: "Portuguese differs between Brazil (pt-BR) and Portugal (pt-PT)".to_string(),
            example: Some("'Train' → 'Trem' (Brazil) vs 'Comboio' (Portugal)".to_string()),
        });
    }
    
    // JA
    if target_lang == "ja" {
        hints.push(CulturalHint {
            category: "honorifics".to_string(),
            hint: "Japanese uses honorific suffixes (-san, -sama, -kun, -chan) based on relationship".to_string(),
            example: None,
        });
        hints.push(CulturalHint {
            category: "formality".to_string(),
            hint: "Japanese has multiple politeness levels (casual, polite, humble, honorific)".to_string(),
            example: None,
        });
    }
    
    // DE
    if target_lang == "de" {
        hints.push(CulturalHint {
            category: "formality".to_string(),
            hint: "German uses 'Sie' (formal) and 'du' (informal) - consistency is crucial".to_string(),
            example: None,
        });
        hints.push(CulturalHint {
            category: "compound".to_string(),
            hint: "German creates compound words - consider length limits".to_string(),
            example: Some("'Translation Memory' → 'Übersetzungsspeicher'".to_string()),
        });
    }
    
    // General hints
    hints.push(CulturalHint {
        category: "names".to_string(),
        hint: "Keep character and place names consistent - check glossary for official translations".to_string(),
        example: None,
    });
    
    hints.push(CulturalHint {
        category: "humor".to_string(),
        hint: "Humor often doesn't translate literally - adapt jokes to work in target culture".to_string(),
        example: None,
    });
    
    // Filter by category if specified
    if let Some(cat) = category {
        hints.retain(|h| h.category == cat);
    }
    
    Ok(hints)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CulturalHint {
    pub category: String,
    pub hint: String,
    pub example: Option<String>,
}

/// Definisce varianti regionali per una lingua
#[tauri::command]
pub fn get_language_variants(lang_code: String) -> Result<Vec<LanguageVariant>, String> {
    let variants = match lang_code.to_lowercase().as_str() {
        "es" => vec![
            LanguageVariant {
                code: "es-ES".to_string(),
                name: "Spanish (Spain)".to_string(),
                region: "Europe".to_string(),
                notes: "Uses 'vosotros', European vocabulary".to_string(),
            },
            LanguageVariant {
                code: "es-419".to_string(),
                name: "Spanish (Latin America)".to_string(),
                region: "Latin America".to_string(),
                notes: "Uses 'ustedes', Latin American vocabulary".to_string(),
            },
            LanguageVariant {
                code: "es-MX".to_string(),
                name: "Spanish (Mexico)".to_string(),
                region: "North America".to_string(),
                notes: "Mexican Spanish with local expressions".to_string(),
            },
            LanguageVariant {
                code: "es-AR".to_string(),
                name: "Spanish (Argentina)".to_string(),
                region: "South America".to_string(),
                notes: "Uses 'vos', Rioplatense dialect".to_string(),
            },
        ],
        "pt" => vec![
            LanguageVariant {
                code: "pt-BR".to_string(),
                name: "Portuguese (Brazil)".to_string(),
                region: "South America".to_string(),
                notes: "Brazilian vocabulary and grammar".to_string(),
            },
            LanguageVariant {
                code: "pt-PT".to_string(),
                name: "Portuguese (Portugal)".to_string(),
                region: "Europe".to_string(),
                notes: "European Portuguese vocabulary".to_string(),
            },
        ],
        "en" => vec![
            LanguageVariant {
                code: "en-US".to_string(),
                name: "English (US)".to_string(),
                region: "North America".to_string(),
                notes: "American spelling and vocabulary".to_string(),
            },
            LanguageVariant {
                code: "en-GB".to_string(),
                name: "English (UK)".to_string(),
                region: "Europe".to_string(),
                notes: "British spelling and vocabulary".to_string(),
            },
            LanguageVariant {
                code: "en-AU".to_string(),
                name: "English (Australia)".to_string(),
                region: "Oceania".to_string(),
                notes: "Australian expressions and slang".to_string(),
            },
        ],
        "zh" => vec![
            LanguageVariant {
                code: "zh-CN".to_string(),
                name: "Chinese (Simplified)".to_string(),
                region: "Mainland China".to_string(),
                notes: "Simplified characters, mainland vocabulary".to_string(),
            },
            LanguageVariant {
                code: "zh-TW".to_string(),
                name: "Chinese (Traditional)".to_string(),
                region: "Taiwan".to_string(),
                notes: "Traditional characters, Taiwanese vocabulary".to_string(),
            },
            LanguageVariant {
                code: "zh-HK".to_string(),
                name: "Chinese (Hong Kong)".to_string(),
                region: "Hong Kong".to_string(),
                notes: "Traditional characters with Cantonese influence".to_string(),
            },
        ],
        "fr" => vec![
            LanguageVariant {
                code: "fr-FR".to_string(),
                name: "French (France)".to_string(),
                region: "Europe".to_string(),
                notes: "Metropolitan French".to_string(),
            },
            LanguageVariant {
                code: "fr-CA".to_string(),
                name: "French (Canada)".to_string(),
                region: "North America".to_string(),
                notes: "Québécois French with local expressions".to_string(),
            },
        ],
        _ => vec![
            LanguageVariant {
                code: lang_code.clone(),
                name: format!("{} (Standard)", lang_code.to_uppercase()),
                region: "Global".to_string(),
                notes: "Standard variant".to_string(),
            },
        ],
    };
    
    Ok(variants)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageVariant {
    pub code: String,
    pub name: String,
    pub region: String,
    pub notes: String,
}
