"""
Targeted Ink injection: ONLY replaces text INSIDE Ink JSON blobs.
Finds blobs by searching for {"inkVersion" marker and reading the length prefix.
This prevents corrupting non-Ink data (shaders, scripts, etc.).
"""
import struct, os, csv, shutil, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
INK_MARKER = b'{"inkVersion"'


def load_translations():
    trans = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                en = row[0]
                it = row[1]
                if len(en) >= 4:
                    trans[en] = it
    return trans


def find_ink_blobs(data):
    """Find all Ink JSON blobs by their marker and length prefix."""
    blobs = []
    idx = 0
    while True:
        idx = data.find(INK_MARKER, idx)
        if idx < 0:
            break
        # Check 4 bytes before for length prefix
        if idx >= 4:
            lp = struct.unpack_from('<I', data, idx - 4)[0]
            blob_end = idx + lp
            if lp >= 100 and blob_end <= len(data):
                blobs.append((idx, blob_end, lp))
        idx += 1
    return blobs


def inject_in_range(data, start, end, sorted_trans):
    """Replace translations only within data[start:end]."""
    replaced = 0
    truncated = 0

    for en, it in sorted_trans:
        en_bytes = en.encode('utf-8')
        it_bytes = it.encode('utf-8')

        idx = start
        while True:
            idx = data.find(en_bytes, idx, end)
            if idx < 0:
                break

            available = len(en_bytes)
            if len(it_bytes) <= available:
                data[idx:idx+len(it_bytes)] = it_bytes
                for j in range(len(it_bytes), available):
                    data[idx+j] = 0x20
                replaced += 1
            else:
                trunc = it_bytes[:available]
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

            idx += available

    return replaced, truncated


def process_file(fpath, sorted_trans):
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath
    data = bytearray(open(source, 'rb').read())
    orig_size = len(data)

    blobs = find_ink_blobs(data)
    if not blobs:
        return 0, 0, 0

    total_r = 0
    total_t = 0
    for blob_start, blob_end, lp in blobs:
        r, t = inject_in_range(data, blob_start, blob_end, sorted_trans)
        total_r += r
        total_t += t

    assert len(data) == orig_size

    if total_r > 0:
        if not os.path.exists(backup):
            shutil.copy2(fpath, backup)
        with open(fpath, 'wb') as f:
            f.write(bytes(data))

    return len(blobs), total_r, total_t


def main():
    print("=" * 60)
    print("Targeted Ink Injection (blob-safe)")
    print("=" * 60)

    trans = load_translations()
    print(f"Translations: {len(trans)}")
    sorted_trans = sorted(trans.items(), key=lambda x: len(x[0]), reverse=True)

    total_blobs = 0
    total_replaced = 0
    total_truncated = 0

    for f in sorted(os.listdir(ASSETS_DIR)):
        if not f.startswith('sharedassets') or not f.endswith('.assets') or f.endswith('.backup'):
            continue
        if f == 'sharedassets1.assets':
            continue  # already done

        fpath = os.path.join(ASSETS_DIR, f)
        t0 = time.time()
        blobs, r, t = process_file(fpath, sorted_trans)
        elapsed = time.time() - t0
        if blobs > 0:
            print(f"  {f}: {blobs} blobs, {r} replaced ({t} truncated) [{elapsed:.1f}s]")
        total_blobs += blobs
        total_replaced += r
        total_truncated += t

    # Also process level files (they may contain Ink JSON too)
    for i in range(25):
        fname = f"level{i}"
        fpath = os.path.join(ASSETS_DIR, fname)
        if not os.path.exists(fpath):
            continue
        t0 = time.time()
        blobs, r, t = process_file(fpath, sorted_trans)
        elapsed = time.time() - t0
        if blobs > 0:
            print(f"  {fname}: {blobs} blobs, {r} replaced ({t} truncated) [{elapsed:.1f}s]")
        total_blobs += blobs
        total_replaced += r
        total_truncated += t

    print(f"\nTotal: {total_blobs} blobs, {total_replaced} replaced ({total_truncated} truncated)")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
