"""
Safe binary injection for sharedassets1.assets - Ink JSON strings.
Searches for exact English text bytes and replaces with Italian in-place.
File size stays identical.
"""
import os, csv, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
FNAME = "sharedassets1.assets"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"


def load_translations():
    trans = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                en = row[0]
                it = row[1]
                # Skip very short strings (high false positive risk)
                if len(en) >= 4:
                    trans[en] = it
    return trans


def main():
    print("=" * 60)
    print("sharedassets1.assets - Safe Ink Injection")
    print("=" * 60)

    trans = load_translations()
    print(f"Translations: {len(trans)}")

    fpath = os.path.join(ASSETS_DIR, FNAME)
    backup = fpath + ".backup"
    if not os.path.exists(backup):
        import shutil
        shutil.copy2(fpath, backup)

    data = bytearray(open(backup, 'rb').read())
    orig_size = len(data)
    print(f"File: {orig_size:,} bytes")

    # Sort translations by length (longest first) to avoid partial matches
    sorted_trans = sorted(trans.items(), key=lambda x: len(x[0]), reverse=True)

    replaced = 0
    truncated = 0
    not_found = 0
    start = time.time()

    for i, (en, it) in enumerate(sorted_trans):
        en_bytes = en.encode('utf-8')
        it_bytes = it.encode('utf-8')

        # Find all occurrences
        idx = 0
        found_any = False
        while True:
            idx = data.find(en_bytes, idx)
            if idx < 0:
                break

            found_any = True
            available = len(en_bytes)

            if len(it_bytes) <= available:
                # Fits - replace and pad with spaces
                data[idx:idx+len(it_bytes)] = it_bytes
                for j in range(len(it_bytes), available):
                    data[idx+j] = 0x20  # space padding
                replaced += 1
            else:
                # Truncate Italian to fit
                trunc = it_bytes[:available]
                # Ensure valid UTF-8
                while trunc:
                    try:
                        trunc.decode('utf-8')
                        break
                    except:
                        trunc = trunc[:-1]
                if trunc:
                    data[idx:idx+len(trunc)] = trunc
                    for j in range(len(trunc), available):
                        data[idx+j] = 0x20
                    replaced += 1
                    truncated += 1

            idx += available  # skip past this replacement

        if not found_any:
            not_found += 1

        if (i + 1) % 1000 == 0:
            elapsed = time.time() - start
            print(f"  [{i+1}/{len(sorted_trans)}] replaced={replaced}, truncated={truncated}, not_found={not_found}")

    # Verify same size
    assert len(data) == orig_size, f"Size changed!"

    with open(fpath, 'wb') as f:
        f.write(bytes(data))

    print(f"\nReplaced: {replaced} occurrences ({truncated} truncated)")
    print(f"Not found: {not_found} strings")
    print(f"File size: {len(data):,} (unchanged)")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
