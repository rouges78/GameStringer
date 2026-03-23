"""Find all untranslated caret strings in Ink blobs across all sharedassets files."""
import struct, csv, json, os, re

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
LEVEL_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_translations.csv"
CACHE_JSON = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\translation_cache.json"
OUTPUT = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\untranslated.csv"

# Load existing translations
trans = {}
for csv_path in [INK_CSV, LEVEL_CSV]:
    if os.path.exists(csv_path):
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    trans[row[0].strip()] = row[1].strip()
if os.path.exists(CACHE_JSON):
    try:
        with open(CACHE_JSON, 'r', encoding='utf-8') as f:
            cache = json.load(f)
        for k, v in cache.items():
            if k not in trans and v and v.strip():
                trans[k.strip()] = v.strip()
    except:
        pass

print(f"Traduzioni esistenti: {len(trans)}")

# Patterns to skip (Ink control strings, not display text)
def is_display_text(text):
    """Return True if this looks like actual display text, not Ink control."""
    t = text.strip()
    if not t:
        return False
    if len(t) < 3:
        return False
    # Skip Ink control patterns
    if t.startswith('->'):
        return False
    if t.startswith('.') and ('==' in t or '>=' in t or '<=' in t or '_' in t):
        return False
    if t.startswith('ev') or t.startswith('/ev'):
        return False
    if t.startswith('#') or t.startswith('/#'):
        return False
    if t == '\\n' or t == '\n':
        return False
    # Skip if it's all caps variable/tag names
    if re.match(r'^[A-Z_0-9]+$', t):
        return False
    # Skip Ink divert/logic patterns
    if re.match(r'^[\.\-\>\$\#\/\\]+', t) and not any(c.isalpha() and c.islower() for c in t[:10]):
        return False
    # Must contain at least one letter
    if not any(c.isalpha() for c in t):
        return False
    # Skip very short tags
    if len(t) <= 3 and not any(c == ' ' for c in t):
        return False
    return True


# Extract all caret strings from backup files
untranslated = {}  # text -> set of source files
total_carets = 0
total_display = 0
total_translated = 0

for f in sorted(os.listdir(ASSETS_DIR)):
    if not f.endswith('.assets.backup') and not (f.endswith('.backup') and not '.assets' in f):
        # Use backup files (originals)
        if f.startswith('sharedassets') and f.endswith('.assets.backup'):
            pass
        else:
            continue
    
    fpath = os.path.join(ASSETS_DIR, f)
    if not os.path.isfile(fpath):
        continue
    
    data = open(fpath, 'rb').read()
    
    # Find caret strings via regex on the raw text portions
    # Search for "^text" in all Ink JSON blobs
    bom = b'\xef\xbb\xbf'
    blobs_found = 0
    idx = 0
    seen_lp = set()
    
    while True:
        idx = data.find(b'inkVersion', idx)
        if idx < 0:
            break
        for back in range(1, 300):
            off = idx - back
            if off < 0:
                break
            if data[off:off+3] == bom:
                lp_off = off - 4
                if lp_off >= 0 and lp_off not in seen_lp:
                    lp = struct.unpack_from('<I', data, lp_off)[0]
                    bs = lp_off + 4
                    be = bs + lp
                    if lp > 50 and be <= len(data):
                        seen_lp.add(lp_off)
                        # Extract caret strings from this blob
                        blob = data[bs:be]
                        try:
                            blob_str = blob.decode('utf-8', errors='replace')
                            carets = re.findall(r'"\^([^"]*)"', blob_str)
                            for c in carets:
                                total_carets += 1
                                if is_display_text(c):
                                    total_display += 1
                                    ct = c.strip()
                                    if ct in trans:
                                        total_translated += 1
                                    else:
                                        if ct not in untranslated:
                                            untranslated[ct] = set()
                                        untranslated[ct].add(f.replace('.backup', ''))
                        except:
                            pass
                        blobs_found += 1
                break
        idx += 1

print(f"Totale caret strings: {total_carets}")
print(f"Display text (testo visibile): {total_display}")
print(f"Gia tradotte: {total_translated}")
print(f"NON tradotte (uniche): {len(untranslated)}")
print(f"Copertura: {total_translated}/{total_display} ({100*total_translated/max(1,total_display):.1f}%)")

# Write untranslated to CSV
with open(OUTPUT, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['english', 'italian', 'source_files'])
    # Sort by length (longer = more important dialogue)
    for text in sorted(untranslated.keys(), key=len, reverse=True):
        sources = ', '.join(sorted(untranslated[text]))
        writer.writerow([text, '', sources])

print(f"\nScritto: {OUTPUT}")
print(f"\nPrime 20 frasi non tradotte (piu lunghe):")
for i, text in enumerate(sorted(untranslated.keys(), key=len, reverse=True)[:20]):
    print(f"  {i+1}. [{text[:80]}]")
