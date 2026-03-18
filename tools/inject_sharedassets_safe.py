"""
Safe binary injection for sharedassets1.assets.
Replaces Ink story strings in-place without changing file size.
Uses reverse-search (anchor patterns) to find all length-prefixed strings.
"""
import struct, os, re, csv, json, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
FNAME = "sharedassets1.assets"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"

# Anchor patterns to find English text
ANCHORS = [
    rb' the ', rb' and ', rb' your ', rb' you ', rb' with ', rb' for ',
    rb' that ', rb' this ', rb' from ', rb' have ', rb' are ', rb' was ',
    rb' The ', rb' Your ', rb' You ', rb' will ', rb' can ',
    rb' not ', rb' but ', rb' all ', rb' its ', rb' has ',
    rb'<b>', rb'<i>', rb'<color=',
]

SKIP = ['#version', '#define', 'void ', 'float ', 'vec4', 'Assets/', 'Packages/',
        'guid:', 'UnityEngine', '.shader', '.prefab', '.mat', 'HLSLCC',
        'uniform ', 'sampler2D', 'precision ', 'layout(', 'm_Script']


def load_translations():
    trans = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                trans[row[0]] = row[1]
    return trans


def find_lp_string(data, text_offset):
    """Given an offset inside a string, trace back to find the length prefix."""
    for back in range(1, 2000):
        off = text_offset - back
        if off < 0: return None
        lp = struct.unpack_from('<I', data, off)[0]
        if 4 <= lp <= 50000 and off + 4 + lp > text_offset and off + 4 + lp <= len(data):
            try:
                s = data[off+4:off+4+lp].decode('utf-8')
                if text_offset >= off + 4 and text_offset < off + 4 + lp:
                    return (off, lp, s)
            except: pass
    return None


def is_translatable(s):
    if len(s) < 4: return False
    if any(x in s for x in SKIP): return False
    return True


def main():
    print("=" * 60)
    print("sharedassets1.assets - Safe Binary Injection")
    print("=" * 60)

    # Load translations
    trans = load_translations()
    print(f"Translations loaded: {len(trans)}")

    # Read file
    fpath = os.path.join(ASSETS_DIR, FNAME)
    backup = fpath + ".backup"
    if not os.path.exists(backup):
        import shutil
        shutil.copy2(fpath, backup)

    data = bytearray(open(backup, 'rb').read())
    orig_size = len(data)
    print(f"File size: {orig_size:,} bytes")

    # Find all strings via reverse-search
    print("\nSearching for strings...")
    found = {}  # offset -> (lp, text)

    for pattern in ANCHORS:
        idx = 0
        while True:
            idx = data.find(pattern, idx)
            if idx < 0: break
            result = find_lp_string(data, idx)
            if result:
                off, lp, text = result
                if off not in found and is_translatable(text) and text in trans:
                    found[off] = (lp, text)
            idx += 1

    print(f"Found {len(found)} translatable strings with translations")

    # Inject
    replaced = 0
    truncated = 0
    for off, (lp, text) in found.items():
        italian = trans[text]
        it_bytes = italian.encode('utf-8')

        # Available space
        padded = 4 + lp
        while padded % 4 != 0: padded += 1
        available = padded - 4

        if len(it_bytes) <= available:
            struct.pack_into('<I', data, off, len(it_bytes))
            data[off+4:off+4+len(it_bytes)] = it_bytes
            for j in range(len(it_bytes), available):
                data[off+4+j] = 0
            replaced += 1
        else:
            # Truncate to fit
            trunc = it_bytes[:available]
            while trunc:
                try: trunc.decode('utf-8'); break
                except: trunc = trunc[:-1]
            if trunc:
                struct.pack_into('<I', data, off, len(trunc))
                data[off+4:off+4+len(trunc)] = trunc
                for j in range(len(trunc), available):
                    data[off+4+j] = 0
                replaced += 1
                truncated += 1

    # Verify same size
    assert len(data) == orig_size, f"Size changed! {len(data)} != {orig_size}"

    with open(fpath, 'wb') as f:
        f.write(bytes(data))

    print(f"\nReplaced: {replaced} ({truncated} truncated)")
    print(f"File size: {len(data):,} (unchanged)")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
