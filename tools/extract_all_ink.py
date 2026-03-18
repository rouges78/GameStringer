"""
Extract ALL translatable Ink text strings from Esoteric Ebb.
Searches sharedassets1.assets for all Ink JSON TextAssets,
parses them, and extracts display text (^prefix strings).
"""
import json
import os
import csv
import struct

ASSETS = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets1.assets"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def find_ink_blocks(data):
    """Find all inkVersion JSON blocks by searching for the pattern and reading length prefix."""
    blocks = []
    pos = 0
    while True:
        idx = data.find(b'"inkVersion"', pos)
        if idx == -1:
            break
        # Find the opening { before inkVersion
        brace = idx - 1
        while brace > 0 and data[brace] != ord('{'):
            brace -= 1
        if data[brace] != ord('{'):
            pos = idx + 1
            continue

        json_start = brace
        # Find length prefix: 4 bytes LE before the JSON start
        if json_start >= 4:
            length = struct.unpack_from('<I', data, json_start - 4)[0]
            if 100 < length < 50_000_000 and json_start + length <= len(data):
                raw = data[json_start:json_start + length]
                try:
                    raw_str = raw.decode('utf-8')
                    # Try parsing as JSON
                    json_data = json.loads(raw_str)
                    # Find name: go back further to find the TextAsset name
                    name = find_asset_name(data, json_start)
                    blocks.append({
                        'name': name,
                        'offset': json_start,
                        'length': length,
                        'json': json_data,
                    })
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass
        pos = idx + 1
    return blocks


def find_asset_name(data, json_offset):
    """Try to find the TextAsset name by looking for the length-prefixed name before the JSON."""
    # TextAsset structure: [name_len][name][pad][script_len][script_json]
    # The script_len is at json_offset - 4
    # Before that is the padded name
    script_len_off = json_offset - 4
    # Search backwards for a readable name
    search_start = max(0, script_len_off - 200)
    chunk = data[search_start:script_len_off]

    # Look for a name pattern: small length prefix followed by ASCII text
    best_name = "unknown"
    for offset in range(len(chunk) - 8, -1, -1):
        name_len = struct.unpack_from('<I', chunk, offset)[0]
        if 2 <= name_len <= 100:
            name_start = offset + 4
            name_end = name_start + name_len
            if name_end <= len(chunk):
                try:
                    name = chunk[name_start:name_end].decode('ascii')
                    if name.isidentifier() or all(c.isalnum() or c == '_' for c in name):
                        best_name = name
                        break
                except:
                    pass
    return best_name


def extract_texts(obj):
    """Recursively extract ^text display strings from Ink JSON."""
    texts = []
    if isinstance(obj, str):
        if obj.startswith('^') and len(obj) > 1:
            t = obj[1:].strip()
            if t and len(t) >= 2 and any(c.isalpha() for c in t):
                # Filter Ink control strings
                if t not in ('OBJ', 'ev', '/ev', 'str', '/str', 'out') and not t.startswith('/#'):
                    texts.append(t)
    elif isinstance(obj, list):
        for item in obj:
            texts.extend(extract_texts(item))
    elif isinstance(obj, dict):
        for v in obj.values():
            texts.extend(extract_texts(v))
    return texts


def main():
    print("=" * 60)
    print("Esoteric Ebb - Full Ink String Extractor")
    print("=" * 60)

    with open(ASSETS, 'rb') as f:
        data = f.read()
    print(f"File: {len(data):,} bytes")

    blocks = find_ink_blocks(data)
    print(f"Ink stories found: {len(blocks)}")

    all_entries = []  # (name, text)
    all_unique = {}   # text -> first source name

    for block in blocks:
        texts = extract_texts(block['json'])
        # Deduplicate within this block
        unique = list(dict.fromkeys(texts))

        # Filter out short Ink tags like "dex", "str", "wis" etc
        filtered = []
        ink_tags = {'dex','str','wis','int','cha','con','lck','per','spd',
                    'atk','def','hp','mp','xp','exp','dmg','crit','hit',
                    'NewTurn','Minor','Major','XPGain','XP','Combat',
                    'Skill','Attribute','Equipment','HeroScreen','OBJ',
                    'RETURN','Return','END'}
        for t in unique:
            clean = t.replace('<i>','').replace('</i>','').replace('<b>','').replace('</b>','').strip()
            if clean in ink_tags:
                continue
            # Also skip single-word Ink commands
            if len(clean.split()) == 1 and clean.isalpha() and len(clean) <= 12 and clean[0].isupper() and clean == clean.capitalize():
                # Could be a tag like "Insight", "Commerce" etc - check length
                if len(clean) <= 3:
                    continue
            filtered.append(t)

        if filtered:
            print(f"  {block['name']:30s}: {len(filtered):4d} strings ({block['length']:,} chars)")
            for t in filtered:
                all_entries.append((block['name'], t))
                if t not in all_unique:
                    all_unique[t] = block['name']

    print(f"\nTotal entries: {len(all_entries)}")
    print(f"Unique strings: {len(all_unique)}")

    # Save full mapping JSON
    full_path = os.path.join(OUTPUT_DIR, "ink_all_entries.json")
    with open(full_path, 'w', encoding='utf-8') as f:
        json.dump([{"source": name, "text": text} for name, text in all_entries],
                  f, ensure_ascii=False, indent=2)
    print(f"Saved: {full_path}")

    # Save unique texts as CSV (for translation)
    csv_path = os.path.join(OUTPUT_DIR, "ink_for_translation.csv")
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['ID', 'SOURCE', 'ENGLISH', 'ITALIAN'])
        for i, (text, source) in enumerate(all_unique.items()):
            w.writerow([f"ink_{i:04d}", source, text, ''])
    print(f"CSV for translation: {csv_path}")

    # Stats
    total_chars = sum(len(t) for t in all_unique)
    print(f"\nStats:")
    print(f"  Stories: {len(blocks)}")
    print(f"  Unique strings: {len(all_unique)}")
    print(f"  Total characters: {total_chars:,}")
    print(f"  Avg length: {total_chars / max(1, len(all_unique)):.0f} chars")

    # Preview
    preview_path = os.path.join(OUTPUT_DIR, "ink_preview.txt")
    with open(preview_path, 'w', encoding='utf-8') as f:
        for i, (text, source) in enumerate(list(all_unique.items())[:100]):
            f.write(f"[{source}] {text[:120]}\n")
    print(f"Preview: {preview_path}")


if __name__ == '__main__':
    main()
