"""
Safe Ink injection TEST: modifies ONLY 1 blob in sharedassets1.assets.
Uses regex to replace only "^text" patterns inside Ink JSON blobs.
Maintains exact file size by padding shorter translations with spaces.
"""
import struct, csv, os, shutil, re

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
TARGET = os.path.join(ASSETS_DIR, "sharedassets1.assets")
BACKUP = TARGET + ".backup"

def load_translations():
    trans = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                trans[row[0].strip()] = row[1].strip()
    return trans

def find_ink_blobs(data):
    """Find Ink JSON blobs by BOM marker before inkVersion."""
    bom = b'\xef\xbb\xbf'
    blobs = []
    idx = 0
    while True:
        idx = data.find(b'inkVersion', idx)
        if idx < 0:
            break
        # Scan back for BOM (UTF-8 BOM before JSON start)
        bom_pos = -1
        for back in range(1, 300):
            off = idx - back
            if off < 0:
                break
            if data[off:off+3] == bom:
                bom_pos = off
                break
        if bom_pos >= 0 and bom_pos >= 4:
            lp_off = bom_pos - 4
            lp = struct.unpack_from('<I', data, lp_off)[0]
            blob_start = lp_off + 4
            blob_end = blob_start + lp
            if blob_end <= len(data) and lp > 100:
                blobs.append((blob_start, blob_end, lp))
        idx += 1
    return blobs

def replace_caret_strings(blob_str, trans):
    """Replace "^english" with "^italian" keeping same byte length."""
    replaced = 0
    truncated = 0

    def replacer(m):
        nonlocal replaced, truncated
        original = m.group(1)
        # Try lookup: with and without trailing space
        lookup = original.rstrip()
        if lookup not in trans:
            return m.group(0)

        it = trans[lookup]
        # Sanitize for JSON (no unescaped quotes or backslashes)
        it = it.replace('\\', '\\\\').replace('"', '\\"')

        orig_bytes = original.encode('utf-8')
        it_bytes = it.encode('utf-8')
        orig_len = len(orig_bytes)

        if len(it_bytes) <= orig_len:
            # Pad with spaces
            padding = ' ' * (orig_len - len(it_bytes))
            replaced += 1
            return '"^' + it + padding + '"'
        else:
            # Truncate to fit, respecting UTF-8 boundaries
            trunc = it_bytes[:orig_len]
            while trunc:
                try:
                    trunc.decode('utf-8')
                    break
                except UnicodeDecodeError:
                    trunc = trunc[:-1]
            if not trunc:
                return m.group(0)
            decoded = trunc.decode('utf-8')
            padding = ' ' * (orig_len - len(trunc))
            replaced += 1
            truncated += 1
            return '"^' + decoded + padding + '"'

    new_str = re.sub(r'"(\^[^"]*)"', replacer, blob_str)
    return new_str, replaced, truncated

def main():
    print("=" * 60)
    print("SAFE INK INJECTION TEST (1 blob only)")
    print("=" * 60)

    trans = load_translations()
    print(f"Translations loaded: {len(trans)}")

    # Read from backup (original untouched file)
    if not os.path.exists(BACKUP):
        print("ERROR: no backup found!")
        return
    data = bytearray(open(BACKUP, 'rb').read())
    orig_size = len(data)
    print(f"File size: {orig_size:,} bytes")

    blobs = find_ink_blobs(data)
    print(f"Ink blobs found: {len(blobs)}")

    if not blobs:
        print("No blobs found!")
        return

    # TEST: process ONLY the first blob
    blob_start, blob_end, lp = blobs[0]
    print(f"\nProcessing blob 0: offset={blob_start}, size={lp}")

    blob_bytes = bytes(data[blob_start:blob_end])
    blob_str = blob_bytes.decode('utf-8', errors='replace')

    new_str, replaced, truncated = replace_caret_strings(blob_str, trans)
    new_bytes = new_str.encode('utf-8')

    if len(new_bytes) != lp:
        print(f"ERROR: blob size changed! {lp} -> {len(new_bytes)}")
        print("Aborting - file NOT modified")
        return

    # Inject back
    data[blob_start:blob_end] = new_bytes
    assert len(data) == orig_size, "FILE SIZE CHANGED!"

    with open(TARGET, 'wb') as f:
        f.write(bytes(data))

    print(f"Replaced: {replaced} ({truncated} truncated)")
    print(f"File written: {orig_size:,} bytes (unchanged)")
    print("\nAvvia il gioco e verifica il dialogo 'Q_Sea'!")

if __name__ == '__main__':
    main()
