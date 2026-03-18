"""
Binary injection of translations into level files.
Finds length-prefixed English strings and replaces them with Italian,
updating the length prefix. Uses AssetsTools-style alignment.

Strategy: find specific known English strings, replace with Italian,
update length prefix, and pad/shift as needed.
Since we can't resize easily, we write a new file using the same approach 
as inject_resize.py but for ALL translatable strings.
"""
import struct
import os
import re
import json
import csv
import hashlib

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
TRANSLATIONS_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_translations.csv"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_cache.json"


def load_translations():
    """Load EN->IT from the cache, rebuild as text->translation dict."""
    if not os.path.exists(CACHE_FILE):
        print("ERROR: cache file not found")
        return {}
    
    cache = json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
    print(f"Cache has {len(cache)} hash entries")
    
    # Also load the CSV which has actual text pairs
    text_dict = {}
    if os.path.exists(TRANSLATIONS_CSV):
        with open(TRANSLATIONS_CSV, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)  # skip header
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    text_dict[row[0]] = row[1]
        print(f"CSV has {len(text_dict)} text pairs")
    
    return text_dict


def find_and_extract_strings(data):
    """Find all length-prefixed UTF-8 strings in the binary."""
    strings = []
    i = 0
    while i + 4 < len(data):
        lp = struct.unpack_from('<I', data, i)[0]
        if 8 <= lp <= 5000 and i + 4 + lp <= len(data):
            raw = data[i+4:i+4+lp]
            try:
                s = raw.decode('utf-8')
                # Must have English text
                clean = re.sub(r'<[^>]+>', '', s)
                if re.search(r'[A-Za-z]{3,}\s+[a-zA-Z]{2,}', clean) and len(clean.strip()) > 15:
                    skip = ['#version','#define','void ','float ','vec4','Assets/','Packages/',
                            'guid:','UnityEngine','.shader','.prefab','.mat','HLSLCC',
                            'Scroll View','Fill Area','Sliding Area','Scrollbar']
                    if not any(x in s for x in skip):
                        # Calculate padding
                        total = 4 + lp
                        padded = total
                        while padded % 4 != 0:
                            padded += 1
                        strings.append({
                            'offset': i,
                            'len_prefix': lp,
                            'text': s,
                            'padded_size': padded,
                            'hash': hashlib.md5(s.encode()).hexdigest(),
                        })
            except UnicodeDecodeError:
                pass
            # Skip past
            total = 4 + lp
            while total % 4 != 0:
                total += 1
            i += total
            continue
        i += 1
    return strings


def inject_translations(data, strings, cache):
    """Replace strings in-place, padding shorter translations and truncating longer ones."""
    result = bytearray(data)
    replaced = 0
    
    for s in strings:
        h = s['hash']
        if h not in cache:
            continue
        
        italian = cache[h]
        italian_bytes = italian.encode('utf-8')
        english_bytes = s['text'].encode('utf-8')
        
        # Available space: original padded_size - 4 (for length prefix)
        available = s['padded_size'] - 4
        
        if len(italian_bytes) <= available:
            # Fits! Write length prefix + Italian + null padding
            off = s['offset']
            struct.pack_into('<I', result, off, len(italian_bytes))
            result[off+4:off+4+len(italian_bytes)] = italian_bytes
            # Null-pad the rest
            for j in range(len(italian_bytes), available):
                result[off+4+j] = 0
            replaced += 1
        else:
            # Too long - truncate Italian to fit
            truncated = italian_bytes[:available]
            # Make sure we don't cut in the middle of a UTF-8 character
            while truncated:
                try:
                    truncated.decode('utf-8')
                    break
                except:
                    truncated = truncated[:-1]
            
            off = s['offset']
            struct.pack_into('<I', result, off, len(truncated))
            result[off+4:off+4+len(truncated)] = truncated
            for j in range(len(truncated), available):
                result[off+4+j] = 0
            replaced += 1
    
    return bytes(result), replaced


def main():
    print("=" * 60)
    print("Level Binary Injection")
    print("=" * 60)

    cache = load_translations()
    if not cache:
        return

    total_replaced = 0
    
    for lvl in range(25):
        fname = f"level{lvl}"
        fpath = os.path.join(ASSETS_DIR, fname)
        backup = fpath + ".backup"
        
        # Always read from backup (original)
        if os.path.exists(backup):
            source = backup
        else:
            source = fpath
            # Create backup
            import shutil
            shutil.copy2(fpath, backup)
        
        data = open(source, 'rb').read()
        strings = find_and_extract_strings(data)
        
        # Count how many have translations
        translatable = [s for s in strings if s['hash'] in cache]
        
        if not translatable:
            print(f"  {fname}: no translatable strings found")
            continue
        
        new_data, replaced = inject_translations(data, strings, cache)
        
        if replaced > 0:
            with open(fpath, 'wb') as f:
                f.write(new_data)
            total_replaced += replaced
            print(f"  {fname}: {replaced}/{len(translatable)} replaced")
        else:
            print(f"  {fname}: 0 replaced")

    print(f"\n=== DONE: {total_replaced} total replacements ===")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
