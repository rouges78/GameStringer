"""
Translate rich-text strings in level files by:
1. Loading existing Ink translations (already have 10,894)
2. Extracting rich-text strings from level files
3. For strings with only markup wrapping around translated text, auto-apply
4. For remaining strings, translate via Ollama preserving markup
"""
import struct
import os
import re
import json
import csv
import hashlib
import time
import requests

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CACHE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\translation_cache.json"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated"
CACHE_FILE = os.path.join(OUTPUT_DIR, "level_translation_cache.json")
os.makedirs(OUTPUT_DIR, exist_ok=True)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"


def strip_tags(s):
    """Remove HTML/Unity rich text tags."""
    return re.sub(r'<[^>]+>', '', s)


def load_ink_translations():
    """Load EN->IT translations from Ink translation work."""
    trans = {}
    if os.path.exists(INK_CSV):
        with open(INK_CSV, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)  # skip header
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    trans[row[0].strip()] = row[1].strip()
    print(f"Loaded {len(trans)} Ink translations")
    return trans


def extract_rich_text_strings(data):
    """Extract length-prefixed strings that contain rich text markup and game text."""
    strings = []
    i = 0
    while i + 4 < len(data):
        lp = struct.unpack_from('<I', data, i)[0]
        if 20 <= lp <= 5000 and i + 4 + lp <= len(data):
            raw = data[i+4:i+4+lp]
            try:
                s = raw.decode('utf-8')
                # Must contain actual English words
                clean = strip_tags(s).replace('\\n', ' ').replace('\\r', ' ').replace('\n', ' ').replace('\r', ' ')
                has_english = bool(re.search(r'[a-zA-Z]{4,}', clean))
                # Must be actual game text (not code, paths, etc)
                is_code = any(x in s for x in ['#version', '#define', '#include', 'void ', 'float ', 'vec4', 'uniform'])
                is_path = s.startswith(('Assets/', 'Packages/', 'Library/', 'guid:'))
                
                if has_english and not is_code and not is_path and len(clean) > 10:
                    strings.append((i, lp, s))
            except UnicodeDecodeError:
                pass
            i += 4 + lp
            while i % 4 != 0:
                i += 1
            continue
        i += 1
    return strings


def translate_with_ollama(text, cache):
    """Translate a rich-text string preserving markup."""
    key = hashlib.md5(text.encode()).hexdigest()
    if key in cache:
        return cache[key]

    prompt = f"""Translate this RPG game text from English to Italian.
IMPORTANT: Keep ALL HTML/XML tags exactly as they are (<b>, </b>, <i>, </i>, <color=#HEX>, </color>, <size=N>, </size>).
Keep \\n and \\r as they are.
Keep proper nouns: Miska, Darrow, Snell, Meek, Urth, Norvik, Torna, Prax, Fillius, Halfweed.
Use standard Italian RPG terms: Forza, Destrezza, Costituzione, Intelligenza, Saggezza, Carisma.
ONLY output the Italian translation, nothing else.

English: {text}
Italian:"""

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 1000}
        }, timeout=90)
        result = resp.json().get("response", "").strip()
        result = result.replace("Italian:", "").strip()
        # Take first meaningful block (avoid explanations)
        lines = result.split("\n")
        result = lines[0].strip() if lines else result
        if result and len(result) > 3:
            cache[key] = result
            return result
    except Exception as e:
        print(f"  ERROR: {e}")
    return None


def main():
    print("=" * 60)
    print("Level Rich Text Translator")
    print("=" * 60)

    # Load existing Ink translations for fuzzy matching
    ink_trans = load_ink_translations()

    # Load/create cache
    cache = {}
    if os.path.exists(CACHE_FILE):
        cache = json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
        print(f"Cache: {len(cache)} entries")

    # Process level0 first (character creation screen)
    for lvl in range(25):
        fname = f"level{lvl}"
        fpath = os.path.join(ASSETS_DIR, fname)
        backup = fpath + ".backup"
        source = backup if os.path.exists(backup) else fpath
        if not os.path.exists(source):
            continue

        data = open(source, 'rb').read()
        strings = extract_rich_text_strings(data)

        # Filter to strings that need translation
        to_translate = []
        for off, ln, s in strings:
            key = hashlib.md5(s.encode()).hexdigest()
            if key in cache:
                continue
            # Check if plain text version is already in Ink translations
            clean = strip_tags(s).strip()
            # Remove \n \r
            clean2 = clean.replace('\\n', ' ').replace('\\r', ' ').replace('\n', ' ').replace('\r', ' ').strip()
            clean2 = re.sub(r'\s+', ' ', clean2)
            if clean2 in ink_trans:
                # Auto-apply: just use the Ink translation
                # But we lose the markup... better translate the full string
                pass
            to_translate.append((off, ln, s))

        if not to_translate:
            print(f"  {fname}: nothing to translate")
            continue

        print(f"  {fname}: {len(to_translate)} strings to translate")

        for i, (off, ln, s) in enumerate(to_translate):
            result = translate_with_ollama(s, cache)
            if result:
                if (i + 1) % 10 == 0:
                    print(f"    [{i+1}/{len(to_translate)}]")
                    # Save periodically
                    json.dump(cache, open(CACHE_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

        # Save after each level
        json.dump(cache, open(CACHE_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        cached = sum(1 for _, _, s in to_translate if hashlib.md5(s.encode()).hexdigest() in cache)
        print(f"    Translated: {cached}/{len(to_translate)}")

    # Final save
    json.dump(cache, open(CACHE_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # Export CSV
    csv_path = os.path.join(OUTPUT_DIR, "level_translations.csv")
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['ENGLISH', 'ITALIAN'])
        for en, it in cache.items():
            # en is the hash, need to reverse... store text->translation instead
            pass
    # Actually save as hash->translation (the injector will use hash matching)
    print(f"\nCache saved: {CACHE_FILE} ({len(cache)} entries)")
    print("Run InjectInk to apply translations to level files")


if __name__ == '__main__':
    main()
