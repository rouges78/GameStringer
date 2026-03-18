"""Check where Ink narrative text lives"""
import os

d = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
needles = [b"TRUTH AND NOTHING ELSE", b"Your name is Ragn", b"Getting paid for labor"]

for needle in needles:
    print(f"\nSearching: {needle.decode()}")
    for i in range(25):
        fpath = os.path.join(d, f"level{i}")
        if os.path.exists(fpath):
            data = open(fpath, "rb").read()
            idx = data.find(needle)
            if idx >= 0:
                print(f"  level{i}: FOUND at 0x{idx:x}")

    # sharedassets1
    sa = os.path.join(d, "sharedassets1.assets")
    data = open(sa, "rb").read()
    idx = data.find(needle)
    if idx >= 0:
        print(f"  sharedassets1.assets: FOUND at 0x{idx:x}")

    # sharedassets1 backup
    bak = sa + ".backup"
    data2 = open(bak, "rb").read()
    idx2 = data2.find(needle)
    if idx2 >= 0:
        print(f"  sharedassets1.assets.backup: FOUND at 0x{idx2:x}")

    # resources
    res = os.path.join(d, "resources.assets")
    data3 = open(res, "rb").read()
    idx3 = data3.find(needle)
    if idx3 >= 0:
        print(f"  resources.assets: FOUND at 0x{idx3:x}")
