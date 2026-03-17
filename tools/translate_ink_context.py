"""
Esoteric Ebb — Context-Aware Ink String Translator

Miglioria rispetto a translate_ink_batch.py:
- Surrounding text: 3 righe prima + 3 dopo come contesto narrativo
- Scene/character detection dal campo source
- Game context (genere, tono, ambientazione) nel system prompt
- Traduce solo le righe NON ancora in cache (incrementale)
"""
import json
import os
import time
import requests
import csv
import re
import hashlib
from collections import defaultdict

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"

INK_JSON = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\all_ink_strings.json"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated"
CACHE_FILE = os.path.join(OUTPUT_DIR, "ink_cache.json")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "ink_translations.csv")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Game Context ──────────────────────────────────────────────────────
GAME_CONTEXT = """GAME: Esoteric Ebb
GENRE: Dark fantasy RPG with political intrigue
TONE: Serious, philosophical, occasionally sardonic/witty
SETTING: A crumbling world of divine tyrants, feudal lords, and Freestriders
ERA: Medieval fantasy with hints of early modern political thought
FORMALITY: Mixed — formal for nobles/clergy, informal for companions/street folk"""

RPG_GLOSSARY = """
GLOSSARY (use these Italian terms ALWAYS):
- Freestrider = Cavalcalibero
- Beast/Beasts = Bestia/Bestie
- Urth = Urth (keep)
- Ebb = Riflusso
- Miska = Miska (keep)
- Darrow = Darrow (keep)
- Snell = Snell (keep)
- Meek = Meek (keep)
- Prax = Prax (keep)
- Fillius = Fillius (keep)
- Halfweed = Halfweed (keep)
- Solveig = Solveig (keep)
- Samuelsdottir = Samuelsdottir (keep)
- Norvik = Norvik (keep)
- Torna = Torna (keep)
- Dex/Dexterity = Destrezza
- Str/Strength = Forza
- Wis/Wisdom = Saggezza
- Int/Intelligence = Intelligenza
- Con/Constitution = Costituzione
- Cha/Charisma = Carisma
- Feat = Talento
- Spell = Incantesimo
- Hit Points/HP = Punti Ferita/PF
- Armor Class/AC = Classe Armatura/CA
- Saving Throw = Tiro Salvezza
- Skill Check = Prova di Abilità
- XP = PE (Punti Esperienza)
- NPC = PNG
- Quest = Missione
- Dungeon = Dungeon (keep)
- Zealot = Zelota
- Cleric = Chierico
- Rogue = Ladro
- Mage = Mago
- Warrior/Fighter = Guerriero
- Ranger = Ranger (keep)
- Paladin = Paladino
- Sea = Mare
- Godly Voice = Voce Divina
- Divine Mission = Missione Divina
- Coinlord = Signore delle Monete
- Tea Shop = Negozio del Tè
"""

# ── Character detection from source field ─────────────────────────────
CHARACTER_MAP = {
    "DN_Darrow": {"name": "Darrow", "style": "gruff veteran, informal, direct"},
    "GG_Miska": {"name": "Miska", "style": "wise, measured, slightly formal"},
    "Meek_Companion": {"name": "Meek", "style": "timid, uncertain, deferential"},
    "LP_Lisa": {"name": "Lisa", "style": "pragmatic, sharp-tongued, informal"},
    "JC_Urth": {"name": "Urth", "style": "ancient, cryptic, formal/archaic"},
    "DS_Razz": {"name": "Razz", "style": "cocky, street-smart, very informal"},
    "DS_Olzis": {"name": "Olzis", "style": "scholarly, precise, formal"},
    "DS_Rixbiter": {"name": "Rixbiter", "style": "aggressive, blunt, informal"},
    "DS_Deck": {"name": "Deck", "style": "calm, methodical"},
    "Q_Sea": {"name": None, "style": "quest dialogue, varied speakers"},
    "CB_Paper": {"name": None, "style": "codex/book entry, narrative tone"},
    "Default_Shrine": {"name": None, "style": "religious/divine, formal and solemn"},
    "Default_DetectThoughts": {"name": None, "style": "internal monologue, introspective"},
}

CONTEXT_WINDOW = 3  # righe prima + dopo


def extract_character(source: str) -> dict:
    """Extract character info from source field."""
    for key, info in CHARACTER_MAP.items():
        if key in source:
            return info
    # Fallback: prova a estrarre nome dal pattern MonoBehaviour:XX_Name o TextAsset:XX_Name
    m = re.search(r'(?:MonoBehaviour|TextAsset):(?:\w+_)?(\w+)', source)
    if m:
        name = m.group(1)
        if name not in ('Script', 'is1', 'Companion'):
            return {"name": name, "style": "unknown speaking style"}
    return {"name": None, "style": None}


def build_context_prompt(text: str, prev_lines: list, next_lines: list, 
                         source: str, char_info: dict) -> str:
    """Build a context-aware translation prompt."""
    parts = [
        f"Translate this RPG game dialogue from English to Italian.",
        "",
        GAME_CONTEXT,
    ]
    
    # Character info
    if char_info.get("name"):
        parts.append(f"\nSPEAKER: {char_info['name']}")
    if char_info.get("style"):
        parts.append(f"SPEAKING STYLE: {char_info['style']}")
    
    # Scene source
    scene = source.split(":")[-1].replace(".m_Script", "").replace("_", " ")
    parts.append(f"SCENE: {scene}")
    
    # Surrounding context
    if prev_lines or next_lines:
        parts.append("\nSURROUNDING DIALOGUE (for context only, do NOT translate these):")
        if prev_lines:
            for pl in prev_lines:
                parts.append(f"  [BEFORE] {pl}")
        parts.append(f"  >>> {text} <<<  (TRANSLATE THIS)")
        if next_lines:
            for nl in next_lines:
                parts.append(f"  [AFTER] {nl}")
    
    parts.append(f"\n{RPG_GLOSSARY}")
    parts.append("Keep HTML tags like <i>, <b>, <shake> exactly as they are.")
    parts.append("Keep proper nouns unchanged.")
    parts.append("ONLY output the Italian translation, nothing else.")
    parts.append(f"\nEnglish: {text}")
    parts.append("Italian:")
    
    return "\n".join(parts)


def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)


def translate_with_context(text, prev_lines, next_lines, source, char_info, cache):
    """Translate a single string with surrounding context."""
    key = hashlib.md5(text.encode()).hexdigest()
    if key in cache:
        return cache[key]

    prompt = build_context_prompt(text, prev_lines, next_lines, source, char_info)

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 500}
        }, timeout=60)
        result = resp.json().get("response", "").strip()
        # Clean up common issues
        result = result.replace("Italian:", "").strip()
        result = result.split("\n")[0].strip()
        if result and len(result) > 1:
            cache[key] = result
            return result
    except Exception as e:
        print(f"  ERROR: {e}")
    return None


def main():
    print("=" * 60)
    print("Esoteric Ebb — Context-Aware Ink Translator")
    print("=" * 60)
    
    # Load all ink entries (ordered by source/scene)
    with open(INK_JSON, 'r', encoding='utf-8') as f:
        all_entries = json.load(f)
    
    # Group by source to maintain scene order
    scenes = defaultdict(list)
    for entry in all_entries:
        scenes[entry["source"]].append(entry["text"])
    
    # Deduplicate texts but keep scene order for context
    unique_texts = set()
    ordered_tasks = []  # (text, prev_lines, next_lines, source)
    
    for source, texts in scenes.items():
        for i, text in enumerate(texts):
            if not text.strip():
                continue
            txt_key = hashlib.md5(text.encode()).hexdigest()
            if txt_key not in unique_texts:
                unique_texts.add(txt_key)
                prev = [texts[j] for j in range(max(0, i - CONTEXT_WINDOW), i) if texts[j].strip()]
                nxt = [texts[j] for j in range(i + 1, min(len(texts), i + 1 + CONTEXT_WINDOW)) if texts[j].strip()]
                ordered_tasks.append((text, prev, nxt, source))
    
    print(f"Total scenes: {len(scenes)}")
    print(f"Unique strings: {len(ordered_tasks)}")
    
    cache = load_cache()
    cached_count = sum(1 for t, _, _, _ in ordered_tasks if hashlib.md5(t.encode()).hexdigest() in cache)
    remaining = len(ordered_tasks) - cached_count
    print(f"Already cached: {cached_count}")
    print(f"Remaining: {remaining}")
    
    if remaining == 0:
        print("✅ All strings already translated!")
    else:
        print(f"\nTranslating with context window of {CONTEXT_WINDOW} lines...")
        print(f"Model: {MODEL}")
    
    translated = 0
    failed = 0
    start_time = time.time()
    save_interval = 50
    
    for idx, (text, prev, nxt, source) in enumerate(ordered_tasks):
        key = hashlib.md5(text.encode()).hexdigest()
        if key in cache:
            continue
        
        char_info = extract_character(source)
        result = translate_with_context(text, prev, nxt, source, char_info, cache)
        
        if result:
            translated += 1
        else:
            failed += 1
        
        # Progress
        if translated % 20 == 0 and translated > 0:
            elapsed = time.time() - start_time
            rate = translated / max(1, elapsed) * 60
            done_total = cached_count + translated
            eta = (remaining - translated) / max(1, rate)
            char_name = char_info.get("name", "?")
            print(f"  [{done_total}/{len(ordered_tasks)}] {rate:.0f}/min, ETA: {eta:.0f}m | {source.split(':')[-1][:20]} ({char_name})")
        
        # Save periodically
        if (translated + failed) % save_interval == 0:
            save_cache(cache)
    
    # Final save
    save_cache(cache)
    
    # Export CSV (all unique texts)
    total_done = 0
    with open(OUTPUT_CSV, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['ENGLISH', 'ITALIAN'])
        for text, _, _, _ in ordered_tasks:
            key = hashlib.md5(text.encode()).hexdigest()
            it = cache.get(key, '')
            w.writerow([text, it])
            if it:
                total_done += 1
    
    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"DONE in {elapsed / 60:.1f} min")
    print(f"  Translated: {total_done}/{len(ordered_tasks)}")
    print(f"  New this run: {translated}")
    print(f"  Failed: {failed}")
    print(f"  Cache: {CACHE_FILE}")
    print(f"  CSV: {OUTPUT_CSV}")
    print(f"\n🧠 Context features used:")
    print(f"  ✅ Surrounding text ({CONTEXT_WINDOW} lines before/after)")
    print(f"  ✅ Character detection ({len(CHARACTER_MAP)} known characters)")
    print(f"  ✅ Scene identification ({len(scenes)} scenes)")
    print(f"  ✅ Game context (genre, tone, setting)")
    print(f"  ✅ RPG Glossary ({RPG_GLOSSARY.count('=')} terms)")


if __name__ == '__main__':
    main()
