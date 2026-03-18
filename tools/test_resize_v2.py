"""Test resize with 16-byte alignment on sharedassets5 only."""
import struct, os, shutil, sys
sys.path.insert(0, os.path.dirname(__file__))
from inject_ink_resize import load_translations, parse_unity_header, process_file

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
TEST_FILE = "sharedassets5.assets"

def validate_alignment(fpath):
    data = open(fpath, 'rb').read()
    header = parse_unity_header(data)
    do = header['data_offset']
    objs = header['obj_entries']

    print(f"  file_size: header={header['file_size_raw']}, actual={len(data)}, match={header['file_size_raw'] == len(data)}")

    errors = 0
    for i, obj in enumerate(objs):
        bs = obj['byte_start']
        bsz = obj['byte_size']
        abs_end = do + bs + bsz

        if bs % 16 != 0:
            print(f"  ALIGN ERROR obj[{i}] pathid={obj['path_id']}: byte_start={bs}, %16={bs%16}")
            errors += 1
        if abs_end > len(data):
            print(f"  BOUNDS ERROR obj[{i}] pathid={obj['path_id']}: abs_end={abs_end} > {len(data)}")
            errors += 1

    if errors == 0:
        print(f"  All {len(objs)} objects: 16-byte aligned, in bounds ✓")
    else:
        print(f"  {errors} ERRORS!")
    return errors == 0


fpath = os.path.join(ASSETS_DIR, TEST_FILE)
backup = fpath + ".backup"

# Restore clean
shutil.copy2(backup, fpath)
print("Restored from backup")

print("\n=== BEFORE ===")
validate_alignment(fpath)

# Run resize
blobs, replaced, _, shift = process_file(fpath, sorted(
    load_translations().items(), key=lambda x: len(x[0]), reverse=True))
print(f"\nResize: {blobs} blobs, {replaced} replaced, {shift:+d} bytes")

print("\n=== AFTER ===")
ok = validate_alignment(fpath)

if ok:
    print("\n✅ Alignment OK! Prova ad avviare il gioco.")
else:
    print("\n❌ FAILED — restoring backup")
    shutil.copy2(backup, fpath)
