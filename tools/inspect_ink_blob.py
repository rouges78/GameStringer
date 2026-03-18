"""Inspect how Ink text is stored in sharedassets2.assets"""
import struct

fpath = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets2.assets.backup"
data = open(fpath, 'rb').read()

# We know "TRUTH AND NOTHING ELSE" is at 0x740e0c
needle = b"TRUTH AND NOTHING ELSE"
idx = data.find(needle)
print(f"Found at 0x{idx:x}")

# Show wider context - 500 bytes before
start = max(0, idx - 500)
ctx = data[start:idx+200]

# Find the nearest length prefix before this text
# Check for a large LP that could contain this as part of a big blob
for back in [4, 8, 12, 16, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000, 100000]:
    off = idx - back
    if off < 0:
        continue
    lp = struct.unpack_from('<I', data, off)[0]
    if lp > 1000 and off + 4 + lp > idx and off + 4 + lp <= len(data):
        print(f"\nPotential LP at 0x{off:x} (back={back}): length={lp:,}")
        blob_start = off + 4
        blob_end = off + 4 + lp
        print(f"  Blob: 0x{blob_start:x} - 0x{blob_end:x}")
        snippet = data[blob_start:blob_start+100].decode('utf-8', errors='replace')
        print(f"  Start: {snippet[:90]}")
        # Check if it contains inkVersion
        sub = data[blob_start:blob_end]
        if b'inkVersion' in sub:
            print(f"  Contains inkVersion!")
        if b'"^' in sub:
            print(f"  Contains Ink text markers (\"^)")

# Also scan a wider range for the LP
print("\n--- Scanning for LP that contains offset 0x{:x} ---".format(idx))
# The blob containing this text must have LP at some offset before it
# and LP+4+value must be > idx
for scan_off in range(max(0, idx - 500000), idx, 4):
    lp = struct.unpack_from('<I', data, scan_off)[0]
    if 100000 <= lp <= 5000000:
        blob_end = scan_off + 4 + lp
        if blob_end > idx and blob_end <= len(data):
            snippet = data[scan_off+4:scan_off+4+40].decode('utf-8', errors='replace')
            if snippet.startswith('{') or 'ink' in snippet.lower():
                print(f"  LP at 0x{scan_off:x}: length={lp:,}, blob 0x{scan_off+4:x}-0x{blob_end:x}")
                print(f"    Start: {snippet[:40]}")
                break
