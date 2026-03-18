import struct, hashlib, json, os

CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_cache.json"
BACKUP = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\level0.backup"
CURRENT = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\level0"

cache = json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
print(f"Cache entries: {len(cache)}")

# Show a few cache keys and values
for i, (k, v) in enumerate(list(cache.items())[:3]):
    print(f"  Key: {k}")
    print(f"  Val: {v[:80]}")
    print()

backup = open(BACKUP, 'rb').read()
current = open(CURRENT, 'rb').read()
print(f"Backup size: {len(backup):,}")
print(f"Current size: {len(current):,}")
print(f"Files identical: {backup == current}")

# Find testosterone string in backup
idx = backup.find(b'testosterone-fueled')
print(f"\ntestosterone in backup @ {idx} (0x{idx:x})")

if idx >= 0:
    for back in range(1, 500):
        off = idx - back
        if off < 0:
            break
        lp = struct.unpack_from('<I', backup, off)[0]
        if 50 < lp < 2000 and off + 4 + lp > idx:
            raw = backup[off+4:off+4+lp]
            try:
                s = raw.decode('utf-8')
                if 'testosterone' in s:
                    h = hashlib.md5(s.encode('utf-8')).hexdigest()
                    print(f"String @ 0x{off:x}, len={lp}")
                    print(f"Hash: {h}")
                    print(f"In cache: {h in cache}")
                    if h in cache:
                        print(f"Translation: {cache[h][:120]}")
                    print(f"Text[:100]: {s[:100]}")
                    break
            except UnicodeDecodeError:
                pass

# Find in current file too
idx2 = current.find(b'testosterone-fueled')
print(f"\ntestosterone in current @ {idx2} (0x{idx2:x})")

# Check if inject_level_binary actually produced different output
# by looking at what it found
print("\n--- Checking what the injector would find ---")
import re
i = 0
found_count = 0
matched_count = 0
while i + 4 < len(backup):
    lp = struct.unpack_from('<I', backup, i)[0]
    if 8 <= lp <= 5000 and i + 4 + lp <= len(backup):
        raw = backup[i+4:i+4+lp]
        try:
            s = raw.decode('utf-8')
            clean = re.sub(r'<[^>]+>', '', s)
            if re.search(r'[A-Za-z]{3,}\s+[a-zA-Z]{2,}', clean) and len(clean.strip()) > 15:
                skip = ['#version','#define','void ','float ','vec4','Assets/','Packages/',
                        'guid:','UnityEngine','.shader','.prefab','.mat','HLSLCC',
                        'Scroll View','Fill Area','Sliding Area','Scrollbar']
                if not any(x in s for x in skip):
                    found_count += 1
                    h = hashlib.md5(s.encode('utf-8')).hexdigest()
                    if h in cache:
                        matched_count += 1
                    if 'testosterone' in s:
                        print(f"  FOUND testosterone @ 0x{i:x}, len={lp}, hash={h}, in_cache={h in cache}")
        except UnicodeDecodeError:
            pass
        total = 4 + lp
        while total % 4 != 0:
            total += 1
        i += total
        continue
    i += 1

print(f"\nTotal extracted: {found_count}")
print(f"Matched in cache: {matched_count}")
