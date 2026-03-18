"""Deeper inspection of how Ink text is stored in sharedassets2"""
import struct

fpath = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets2.assets.backup"
data = open(fpath, 'rb').read()

idx = 0x740e0c  # "TRUTH AND NOTHING ELSE"

# Show hex around the text
print("=== Context around 'TRUTH AND NOTHING ELSE' ===")
for off in range(max(0, idx - 100), idx + 50, 16):
    chunk = data[off:off+16]
    hex_str = " ".join(f"{b:02x}" for b in chunk)
    asc = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
    marker = " <--" if off <= idx < off + 16 else ""
    print(f"  0x{off:06x}: {hex_str}  {asc}{marker}")

# Scan ALL possible LPs from 0 to idx that could contain this offset
print("\n=== Scanning for ANY LP containing offset 0x{:x} ===".format(idx))
found = []
for scan_off in range(max(0, idx - 2000000), idx, 4):
    lp = struct.unpack_from('<I', data, scan_off)[0]
    if 10000 <= lp <= 8000000:
        blob_end = scan_off + 4 + lp
        if blob_end > idx and blob_end <= len(data) and blob_end < idx + 5000000:
            found.append((scan_off, lp, blob_end))

print(f"Found {len(found)} potential LPs")
for off, lp, end in found[-10:]:
    snippet = data[off+4:off+4+60].decode('utf-8', errors='replace')
    print(f"  LP at 0x{off:x}: len={lp:,}, end=0x{end:x}, start: {snippet[:50]}")

# Also check if there are smaller strings - maybe each line is separate
print("\n=== Check for smaller LP right before the text ===")
for back in range(1, 200):
    off = idx - back
    lp = struct.unpack_from('<I', data, off)[0]
    if 10 <= lp <= 5000 and off + 4 + lp <= len(data):
        try:
            s = data[off+4:off+4+lp].decode('utf-8')
            if idx >= off + 4 and idx < off + 4 + lp:
                print(f"  LP at 0x{off:x} (back={back}): len={lp}, text: {s[:100]}")
                break
        except:
            pass
