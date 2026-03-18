"""
Extract translatable text strings from Ink JSON stories in Unity assets.
Ink JSON format uses "^Text" for display text within compiled story data.
"""
import json
import os
import struct
import re

ASSETS_PATH = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets1.assets"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings"


def find_ink_json_blocks(data):
    """Find all Ink JSON story blocks (they start with {"inkVersion")"""
    pattern = b'{"inkVersion"'
    blocks = []
    pos = 0
    while True:
        idx = data.find(pattern, pos)
        if idx == -1:
            break
        # Check for length prefix (4 bytes LE before)
        if idx >= 4:
            pre_len = struct.unpack_from('<I', data, idx - 4)[0]
            # Verify: read pre_len bytes and check it's valid JSON
            if pre_len > 100 and pre_len < 50_000_000 and idx - 4 + 4 + pre_len <= len(data):
                end = idx + pre_len
                # Quick sanity check: last char should be } or close to it
                tail = data[end-5:end]
                if b'}' in tail:
                    blocks.append({
                        'offset': idx,
                        'length': pre_len,
                        'len_offset': idx - 4,
                    })
        pos = idx + 1
    return blocks


def extract_ink_text(json_data):
    """
    Extract display text from Ink JSON.
    In compiled Ink, display text appears as:
    - "^Some text to display"  (caret prefix = display text)
    - Strings that don't start with special chars are also text sometimes
    """
    texts = []
    
    def walk(obj, path=""):
        if isinstance(obj, str):
            # Ink display text starts with ^
            if obj.startswith('^') and len(obj) > 1:
                text = obj[1:]  # Remove ^ prefix
                # Filter out control strings
                if text and not text.startswith(('OBJ', '#', '->','/')) and len(text.strip()) > 1:
                    # Remove Ink tags like <i>, <b>, etc but keep the text
                    clean = text.strip()
                    if clean and any(c.isalpha() for c in clean):
                        texts.append({
                            'text': clean,
                            'path': path,
                        })
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                walk(item, f"{path}[{i}]")
        elif isinstance(obj, dict):
            for key, val in obj.items():
                walk(val, f"{path}.{key}")
    
    walk(json_data)
    return texts


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("Ink Story String Extractor")
    print("=" * 60)
    
    print(f"\nReading: {ASSETS_PATH}")
    with open(ASSETS_PATH, 'rb') as f:
        data = f.read()
    print(f"Size: {len(data):,} bytes")
    
    # Find Ink JSON blocks
    blocks = find_ink_json_blocks(data)
    print(f"\nFound {len(blocks)} Ink JSON blocks")
    
    all_texts = []
    
    for i, block in enumerate(blocks):
        raw = data[block['offset']:block['offset'] + block['length']]
        try:
            ink_json = json.loads(raw)
        except json.JSONDecodeError:
            print(f"  Block {i}: JSON parse error, skipping")
            continue
        
        ink_ver = ink_json.get('inkVersion', '?')
        texts = extract_ink_text(ink_json)
        
        # Filter to unique meaningful texts
        unique_texts = []
        seen = set()
        for t in texts:
            clean = t['text'].strip()
            # Skip very short, pure markup, or duplicates
            if len(clean) < 2 or clean in seen:
                continue
            # Skip HTML-only strings
            if re.match(r'^</?[a-z]+>$', clean):
                continue
            seen.add(clean)
            unique_texts.append(t)
        
        if unique_texts:
            print(f"  Block {i}: inkVersion={ink_ver}, {len(unique_texts)} unique text strings")
            for t in unique_texts:
                t['block'] = i
            all_texts.extend(unique_texts)
    
    print(f"\nTotal unique text strings: {len(all_texts)}")
    
    # Save to JSON
    output_path = os.path.join(OUTPUT_DIR, "ink_texts.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_texts, f, ensure_ascii=False, indent=2)
    print(f"Saved: {output_path}")
    
    # Save readable preview
    preview_path = os.path.join(OUTPUT_DIR, "ink_texts_preview.txt")
    with open(preview_path, 'w', encoding='utf-8') as f:
        for i, t in enumerate(all_texts[:200]):
            f.write(f"[{i}] Block {t['block']}: {t['text'][:100]}\n")
    print(f"Preview: {preview_path}")
    
    # Stats
    total_chars = sum(len(t['text']) for t in all_texts)
    print(f"\nStats:")
    print(f"  Blocks with text: {len(set(t['block'] for t in all_texts))}")
    print(f"  Total strings: {len(all_texts)}")
    print(f"  Total characters: {total_chars:,}")
    avg_len = total_chars / len(all_texts) if all_texts else 0
    print(f"  Average length: {avg_len:.0f} chars")


if __name__ == '__main__':
    main()
