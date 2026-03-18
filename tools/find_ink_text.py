"""Search ALL files in game data directory for Ink narrative text"""
import os

d = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
needles = [b"TRUTH AND NOTHING ELSE", b"Your name is Ragn", b"Getting paid for labor",
           b"TRUTH AND NOTHING", b"name is Ragn"]

# List all files
for root, dirs, files in os.walk(d):
    for fname in files:
        fpath = os.path.join(root, fname)
        # Skip very large files we already checked, and skip .backup
        if fname.endswith('.backup'):
            continue
        try:
            size = os.path.getsize(fpath)
            if size > 500_000_000:  # skip > 500MB
                continue
            data = open(fpath, 'rb').read()
            for needle in needles:
                idx = data.find(needle)
                if idx >= 0:
                    rel = os.path.relpath(fpath, d)
                    print(f"  {rel}: '{needle.decode()}' at 0x{idx:x}")
        except:
            pass

print("\nAlso checking StreamingAssets...")
sa_dir = os.path.join(d, "StreamingAssets")
if os.path.exists(sa_dir):
    for root, dirs, files in os.walk(sa_dir):
        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                data = open(fpath, 'rb').read()
                for needle in needles:
                    idx = data.find(needle)
                    if idx >= 0:
                        rel = os.path.relpath(fpath, d)
                        print(f"  {rel}: '{needle.decode()}' at 0x{idx:x}")
            except:
                pass
else:
    print("  No StreamingAssets directory")

print("\nDone.")
