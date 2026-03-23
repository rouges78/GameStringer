"""Debug: find which cumulative replacement breaks JSON in sharedassets1."""
import struct, json, os, csv

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"

trans = {}
with open(INK_CSV, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)
    for row in reader:
        if len(row) >= 2 and row[0].strip() and row[1].strip():
            trans[row[0].strip()] = row[1].strip()

fpath = os.path.join(ASSETS_DIR, "sharedassets1.assets")
data = open(fpath, 'rb').read()
bom = b'\xef\xbb\xbf'

# Find first blob
idx = data.find(b'inkVersion')
for back in range(1, 300):
    off = idx - back
    if data[off:off+3] == bom:
        lp_off = off - 4
        lp = struct.unpack_from('<I', data, lp_off)[0]
        bs = lp_off + 4
        be = bs + lp
        break

blob_orig = bytearray(data[bs:be])
print(f"Blob size: {lp}, range: {bs}-{be}")

# Find carets in blob (relative offsets)
quote = ord('"')
caret_byte = ord('^')
backslash = ord('\\')

carets = []
i = 0
while i < len(blob_orig) - 2:
    if blob_orig[i] == quote and blob_orig[i+1] == caret_byte:
        j = i + 2
        while j < len(blob_orig):
            if blob_orig[j] == backslash and j+1 < len(blob_orig):
                j += 2
                continue
            if blob_orig[j] == quote:
                break
            j += 1
        if j < len(blob_orig):
            ts = i + 2
            te = j
            try:
                eng = bytes(blob_orig[ts:te]).decode('utf-8')
                carets.append((ts, te, eng))
            except:
                pass
            i = j + 1
            continue
    i += 1

matched = [(ts, te, eng) for ts, te, eng in carets if eng.rstrip() in trans]
print(f"Carets: {len(carets)}, matched: {len(matched)}")

# Apply cumulatively, validate after each
test_data = bytearray(blob_orig)
for ci, (ts, te, eng) in enumerate(matched):
    it_text = trans[eng.rstrip()]
    it_text = it_text.replace('"', "'")
    
    it_bytes = it_text.encode('utf-8')
    orig_len = te - ts
    
    if len(it_bytes) > orig_len:
        continue
    
    padded = it_bytes + b' ' * (orig_len - len(it_bytes))
    test_data[ts:te] = padded
    
    # Validate
    try:
        json.loads(test_data[3:].decode('utf-8'))
    except Exception as e:
        print(f"\nBROKE at cumulative replacement #{ci}:")
        print(f"  EN: [{eng[:60]}]")
        print(f"  IT: [{it_text[:60]}]")
        print(f"  orig bytes ({orig_len}): {bytes(blob_orig[ts:te])[:40]}")
        print(f"  new bytes  ({len(padded)}): {bytes(padded)[:40]}")
        # Show context around the break
        ctx_start = max(0, ts - 20)
        ctx_end = min(len(test_data), te + 20)
        print(f"  context: {bytes(test_data[ctx_start:ctx_end])}")
        print(f"  error: {e}")
        
        # Check for backslash in translation
        raw_it = trans[eng.rstrip()]
        for ch_i, ch in enumerate(raw_it):
            if ch == '\\':
                print(f"  BACKSLASH at pos {ch_i} in raw translation: ...{raw_it[max(0,ch_i-5):ch_i+10]}...")
        break
else:
    print("All cumulative replacements OK!")
