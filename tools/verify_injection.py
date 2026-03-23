"""Verify if Italian text is actually present in the modified game files."""
import os

assets_dir = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"

# Italian phrases that should be in the files after injection
tests = [
    b"Pensa al paladino",
    b"Drago di Tolstad",
    b"clero cittadino",
    b"scomparso",
    b"traduzione",
    b"qualcuno",
]

# Check sharedassets1.assets
sa1 = os.path.join(assets_dir, "sharedassets1.assets")
data = open(sa1, "rb").read()

print(f"sharedassets1.assets size: {len(data):,} bytes")

bak = sa1 + ".backup"
if os.path.exists(bak):
    bak_data = open(bak, "rb").read()
    print(f"backup size: {len(bak_data):,} bytes")
    print(f"difference: {len(data) - len(bak_data):,} bytes")
    print(f"files identical: {data == bak_data}")
else:
    print("No backup found")

for t in tests:
    idx = data.find(t)
    if idx >= 0:
        print(f"FOUND '{t.decode()}' at offset {idx}")
    else:
        print(f"NOT found: '{t.decode()}'")

# Count inkVersion
cnt = data.count(b"inkVersion")
print(f"inkVersion occurrences: {cnt}")

# Check a level file too
lv4 = os.path.join(assets_dir, "level4")
if os.path.exists(lv4):
    lv_data = open(lv4, "rb").read()
    lv_bak = lv4 + ".backup"
    if os.path.exists(lv_bak):
        lv_bak_data = open(lv_bak, "rb").read()
        print(f"\nlevel4 size: {len(lv_data):,}, backup: {len(lv_bak_data):,}")
        print(f"level4 identical to backup: {lv_data == lv_bak_data}")
    # Search for any Italian
    for t in [b"qualcuno", b"scomparso", b"anche"]:
        idx = lv_data.find(t)
        if idx >= 0:
            print(f"level4 FOUND '{t.decode()}' at {idx}")
