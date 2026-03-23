"""Analyze Ink blob structure in sharedassets0.assets to understand crash cause."""
import struct, json

ORIG = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets0.assets"

data = open(ORIG, 'rb').read()
bom = b'\xef\xbb\xbf'

# Find first inkVersion
idx = data.find(b'inkVersion')
print(f"inkVersion at: {idx}")

# Find BOM before it
off = -1
for b in range(1, 300):
    if data[idx-b:idx-b+3] == bom:
        off = idx - b
        break

if off < 0:
    print("BOM not found!")
    exit()

print(f"BOM at: {off}")

# Length prefix is 4 bytes before BOM
lp_off = off - 4
lp = struct.unpack_from('<I', data, lp_off)[0]
blob_start = lp_off + 4  # includes BOM
blob_end = blob_start + lp

print(f"LP offset: {lp_off}, LP value: {lp}")
print(f"Blob: {blob_start} -> {blob_end}")
print(f"Starts with BOM: {data[blob_start:blob_start+3] == bom}")
print(f"Last 10 bytes: {repr(data[blob_end-10:blob_end])}")

# Check JSON validity (after BOM)
blob_bytes = data[blob_start:blob_end]
try:
    j = json.loads(blob_bytes[3:].decode('utf-8'))
    print(f"Valid JSON: YES, root keys: {list(j.keys())[:5]}")
except Exception as e:
    print(f"Valid JSON: NO - {e}")

# Decode entire blob (including BOM) and re-encode
blob_str = blob_bytes.decode('utf-8')
re_encoded = blob_str.encode('utf-8')
print(f"Decoded chars: {len(blob_str)}, Re-encoded bytes: {len(re_encoded)}, Original: {lp}")
print(f"Size match: {len(re_encoded) == lp}")

# Now simulate what inject_blob does
# The script sets content_start = blob_start (which includes BOM)
# It decodes, manipulates string, re-encodes
# Check: does decode->encode roundtrip preserve size?
# Check for characters that might change size
import re as regex
carets = regex.findall(r'"(\^[^"]*)"', blob_str)
print(f"\nCaret strings: {len(carets)}")
print(f"First 3: {carets[:3]}")

# Check for problematic chars in the blob
# U+FEFF (BOM as char) should be at position 0
print(f"\nFirst char ord: {ord(blob_str[0])} (should be 65279/BOM)")

# Test: what happens if we replace one caret string?
# Find a short one
for c in carets[:5]:
    eng = c[1:]  # strip ^
    eng_bytes = eng.encode('utf-8')
    print(f"  Caret: [{eng[:40]}] bytes={len(eng_bytes)}")
