"""Debug: find which specific replacement causes JSON invalidity."""
import struct, json, os, csv

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"

# Load translations
trans = {}
with open(INK_CSV, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)
    for row in reader:
        if len(row) >= 2 and row[0].strip() and row[1].strip():
            trans[row[0].strip()] = row[1].strip()

# Check sharedassets1.assets — first file that failed
fpath = os.path.join(ASSETS_DIR, "sharedassets1.assets")
data = bytearray(open(fpath, 'rb').read())
bom = b'\xef\xbb\xbf'

# Find all blobs
idx = 0
blobs = []
seen = set()
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
            if lp_off >= 0 and lp_off not in seen:
                lp = struct.unpack_from('<I', data, lp_off)[0]
                bs = lp_off + 4
                be = bs + lp
                if lp > 50 and be <= len(data):
                    seen.add(lp_off)
                    blobs.append((bs, be, lp))
            break
    idx += 1

print(f"Blobs found: {len(blobs)}")

# For each blob, try injecting one caret at a time and validate JSON
for bi, (bs, be, sz) in enumerate(blobs[:3]):  # first 3 blobs
    blob_orig = bytes(data[bs:be])
    
    # Validate original
    try:
        json.loads(blob_orig[3:].decode('utf-8'))
    except Exception as e:
        print(f"Blob {bi} ALREADY invalid: {e}")
        continue
    
    # Find carets
    quote = ord('"')
    caret = ord('^')
    backslash = ord('\\')
    
    carets = []
    i = bs
    while i < be - 2:
        if data[i] == quote and data[i+1] == caret:
            j = i + 2
            while j < be:
                if data[j] == backslash and j+1 < be:
                    j += 2
                    continue
                if data[j] == quote:
                    break
                j += 1
            if j < be:
                ts = i + 2
                te = j
                try:
                    eng = bytes(data[ts:te]).decode('utf-8')
                    carets.append((ts, te, eng))
                except:
                    pass
                i = j + 1
                continue
        i += 1
    
    # Try replacing each matched caret one at a time
    matched_carets = [(ts, te, eng) for ts, te, eng in carets if eng.rstrip() in trans]
    print(f"\nBlob {bi}: {len(carets)} carets, {len(matched_carets)} matched")
    
    for ci, (ts, te, eng) in enumerate(matched_carets[:500]):
        test_data = bytearray(blob_orig)
        rel_ts = ts - bs
        rel_te = te - bs
        
        it_text = trans[eng.rstrip()]
        it_text = it_text.replace('"', "'")
        # NO backslash escaping — test raw
        
        it_bytes = it_text.encode('utf-8')
        orig_len = rel_te - rel_ts
        
        if len(it_bytes) > orig_len:
            continue
        
        padded = it_bytes + b' ' * (orig_len - len(it_bytes))
        test_data[rel_ts:rel_te] = padded
        
        try:
            json.loads(test_data[3:].decode('utf-8'))
        except Exception as e:
            # This specific replacement broke JSON
            orig_context = blob_orig[rel_ts-5:rel_te+5]
            new_context = test_data[rel_ts-5:rel_te+5]
            print(f"  BROKE at caret {ci}: [{eng[:40]}] -> [{it_text[:40]}]")
            print(f"    orig bytes: {orig_context}")
            print(f"    new bytes:  {new_context}")
            print(f"    error: {e}")
            # Check if translation has backslash
            if '\\' in it_text:
                print(f"    HAS BACKSLASH in translation!")
            break
    else:
        print(f"  All {len(matched_carets)} replacements OK individually")
    
    break  # only first blob
