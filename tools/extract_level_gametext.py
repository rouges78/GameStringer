"""
Extract all game text strings (with rich markup) from level files.
These are ScriptableObject fields containing <b>, <color>, <i>, \n etc.
"""
import struct
import os
import re
import json
import csv
import hashlib

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def extract_length_prefixed_strings(data, min_len=5, max_len=10000):
    """Extract all length-prefixed UTF-8 strings from binary data."""
    strings = []
    i = 0
    while i + 4 < len(data):
        lp = struct.unpack_from('<I', data, i)[0]
        if min_len <= lp <= max_len and i + 4 + lp <= len(data):
            raw = data[i+4:i+4+lp]
            try:
                s = raw.decode('utf-8')
                # Must contain at least 3 consecutive letters
                if re.search(r'[a-zA-Z]{3,}', s):
                    strings.append((i, lp, s))
                    # Skip past this string + alignment padding
                    i += 4 + lp
                    # Align to 4 bytes
                    while i % 4 != 0:
                        i += 1
                    continue
            except UnicodeDecodeError:
                pass
        i += 1
    return strings


def is_game_text(s):
    """Filter for actual game text vs paths/code/metadata."""
    if s.startswith(('Assets/', 'Packages/', 'Library/')):
        return False
    if 'UnityEngine' in s or '.shader' in s or '.prefab' in s:
        return False
    if re.match(r'^[a-f0-9\-]{20,}$', s):
        return False
    if s.startswith('guid:') or s.startswith('m_'):
        return False
    # Must have actual readable English text
    # Strip HTML tags and check
    clean = re.sub(r'<[^>]+>', '', s).strip()
    clean = clean.replace('\\n', ' ').replace('\\r', ' ')
    if len(clean) < 3:
        return False
    # Must have at least one word with 3+ letters
    words = re.findall(r'[a-zA-Z]{3,}', clean)
    if not words:
        return False
    return True


def is_translatable(s):
    """Further filter: is this text that should be translated?"""
    # Skip single-word identifiers
    clean = re.sub(r'<[^>]+>', '', s).strip()
    if re.match(r'^[A-Z][a-z]+$', clean):  # Single capitalized word (likely a name)
        return len(clean) > 6  # Unless it's a long descriptive word
    # Skip very short strings that are likely tags/labels
    if len(clean) < 8 and not any(c == ' ' for c in clean):
        return False
    # Has sentence-like content (spaces, punctuation)
    if len(clean) > 20:
        return True
    return True


def main():
    print("=" * 60)
    print("Level Game Text Extractor")
    print("=" * 60)

    all_unique = {}  # text -> set of files

    # Process level0 through level24
    for lvl in range(25):
        fname = f"level{lvl}"
        fpath = os.path.join(ASSETS_DIR, fname)
        backup = fpath + ".backup"
        source = backup if os.path.exists(backup) else fpath

        if not os.path.exists(source):
            continue

        data = open(source, 'rb').read()
        strings = extract_length_prefixed_strings(data)
        game_strings = [(off, ln, s) for off, ln, s in strings if is_game_text(s)]
        translatable = [(off, ln, s) for off, ln, s in game_strings if is_translatable(s)]

        for off, ln, s in translatable:
            if s not in all_unique:
                all_unique[s] = set()
            all_unique[s].add(fname)

        print(f"  {fname}: {len(strings)} strings, {len(game_strings)} game, {len(translatable)} translatable")

    # Also check sharedassets0 (UI/menus) and globalgamemanagers.assets
    for extra in ['sharedassets0.assets', 'globalgamemanagers.assets']:
        fpath = os.path.join(ASSETS_DIR, extra)
        backup = fpath + ".backup"
        source = backup if os.path.exists(backup) else fpath
        if not os.path.exists(source):
            continue
        data = open(source, 'rb').read()
        strings = extract_length_prefixed_strings(data)
        game_strings = [(off, ln, s) for off, ln, s in strings if is_game_text(s)]
        translatable = [(off, ln, s) for off, ln, s in game_strings if is_translatable(s)]
        for off, ln, s in translatable:
            if s not in all_unique:
                all_unique[s] = set()
            all_unique[s].add(extra)
        print(f"  {extra}: {len(strings)} strings, {len(game_strings)} game, {len(translatable)} translatable")

    print(f"\nTotal unique translatable strings: {len(all_unique)}")

    # Categorize
    rich_text = {s: f for s, f in all_unique.items() if '<' in s and re.search(r'<[a-z]', s)}
    plain_long = {s: f for s, f in all_unique.items() if s not in rich_text and len(s) > 30}
    short = {s: f for s, f in all_unique.items() if s not in rich_text and s not in plain_long}

    print(f"  Rich text (with HTML tags): {len(rich_text)}")
    print(f"  Plain long (>30 chars): {len(plain_long)}")
    print(f"  Short/labels: {len(short)}")

    # Save CSV for translation
    csv_path = os.path.join(OUTPUT_DIR, "level_texts_for_translation.csv")
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['ID', 'FILES', 'LENGTH', 'ENGLISH', 'ITALIAN'])
        for i, (text, files) in enumerate(sorted(all_unique.items(), key=lambda x: -len(x[0]))):
            file_list = ','.join(sorted(files))
            w.writerow([f"lv_{i:04d}", file_list, len(text), text, ''])

    print(f"\nSaved: {csv_path}")

    # Save mapping JSON (for injector)
    json_path = os.path.join(OUTPUT_DIR, "level_texts_map.json")
    mapping = []
    for text, files in all_unique.items():
        mapping.append({
            "text": text,
            "files": sorted(files),
            "hash": hashlib.md5(text.encode()).hexdigest(),
        })
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=1)
    print(f"Saved: {json_path}")

    # Preview
    print("\n--- Top 15 rich text strings ---")
    for s in sorted(rich_text.keys(), key=len, reverse=True)[:15]:
        display = s[:120].replace('\n', '\\n').replace('\r', '\\r')
        print(f"  [{len(s)}] {display}")

    total_chars = sum(len(s) for s in all_unique)
    print(f"\nTotal characters: {total_chars:,}")


if __name__ == '__main__':
    main()
