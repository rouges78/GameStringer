"""Debug: test cumulative injection on ALL blobs of sharedassets1 to find which blob breaks."""
import struct, json, os, csv

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
LEVEL_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_translations.csv"
CACHE_JSON = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\translation_cache.json"

trans = {}
for csv_path in [INK_CSV, LEVEL_CSV]:
    if os.path.exists(csv_path):
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    k = row[0].strip()
                    if k not in trans:
                        trans[k] = row[1].strip()
if os.path.exists(CACHE_JSON):
    try:
        with open(CACHE_JSON, 'r', encoding='utf-8') as f:
            cache = json.load(f)
        for k, v in cache.items():
            if k not in trans and v and v.strip():
                trans[k.strip()] = v.strip()
    except:
        pass

print(f"Translations: {len(trans)}")

fpath = os.path.join(ASSETS_DIR, "sharedassets1.assets")
data = bytearray(open(fpath, 'rb').read())
bom = b'\xef\xbb\xbf'

# Find ALL blobs
blobs = []
seen = set()
idx = 0
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

print(f"Blobs: {len(blobs)}")

quote = ord('"')
caret_byte = ord('^')
backslash = ord('\\')

for bi, (bs, be, sz) in enumerate(blobs):
    blob_data = bytearray(data[bs:be])
    
    # Validate original first
    try:
        if blob_data[:3] == bom:
            json.loads(blob_data[3:].decode('utf-8'))
        else:
            json.loads(blob_data.decode('utf-8'))
    except Exception as e:
        print(f"  Blob {bi} @{bs} ALREADY invalid: {e}")
        continue
    
    # Find carets
    carets = []
    i = 0
    while i < len(blob_data) - 2:
        if blob_data[i] == quote and blob_data[i+1] == caret_byte:
            j = i + 2
            while j < len(blob_data):
                if blob_data[j] == backslash and j+1 < len(blob_data):
                    j += 2
                    continue
                if blob_data[j] == quote:
                    break
                j += 1
            if j < len(blob_data):
                ts = i + 2
                te = j
                try:
                    eng = bytes(blob_data[ts:te]).decode('utf-8')
                    carets.append((ts, te, eng))
                except:
                    pass
                i = j + 1
                continue
        i += 1
    
    matched = [(ts, te, eng) for ts, te, eng in carets if eng.rstrip() in trans]
    if not matched:
        continue
    
    # Apply cumulatively
    replaced = 0
    broken = False
    for ci, (ts, te, eng) in enumerate(matched):
        it_text = trans[eng.rstrip()]
        it_text = it_text.replace('"', "'")
        
        it_bytes = it_text.encode('utf-8')
        orig_len = te - ts
        
        if len(it_bytes) > orig_len:
            continue
        
        padded = it_bytes + b' ' * (orig_len - len(it_bytes))
        blob_data[ts:te] = padded
        replaced += 1
        
        # Validate
        try:
            if blob_data[:3] == bom:
                json.loads(blob_data[3:].decode('utf-8'))
            else:
                json.loads(blob_data.decode('utf-8'))
        except Exception as e:
            print(f"  Blob {bi} @{bs} BROKE at replacement #{ci}/{len(matched)} (total replaced: {replaced}):")
            print(f"    EN: [{eng[:80]}]")
            print(f"    IT: [{it_text[:80]}]")
            ctx = bytes(blob_data[max(0,ts-10):min(len(blob_data),te+10)])
            print(f"    context: {ctx}")
            print(f"    error: {e}")
            broken = True
            break
    
    if not broken and replaced > 0:
        print(f"  Blob {bi} @{bs}: {replaced} OK")
