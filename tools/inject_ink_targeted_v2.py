"""
Targeted Ink injection v2: finds Ink JSON blobs by 'inkVersion' marker,
then scans backward for the containing length-prefixed string boundary.
Only replaces text INSIDE Ink blobs - safe for all other game data.
"""
import struct, os, csv, shutil, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
INK_MARKER = b'inkVersion'


def load_translations():
    trans = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                en, it = row[0], row[1]
                if len(en) >= 4:
                    trans[en] = it
    return trans


def find_ink_blobs(data):
    """Find all Ink JSON blobs by scanning for 'inkVersion' and tracing back to LP."""
    blobs = []
    seen = set()
    idx = 0
    while True:
        idx = data.find(INK_MARKER, idx)
        if idx < 0:
            break
        # Scan backward to find the { that starts the JSON
        json_start = -1
        for back in range(1, 200):
            off = idx - back
            if off < 0:
                break
            if data[off] == ord('{'):
                json_start = off
                break
        if json_start >= 0 and json_start >= 4:
            # Try to find LP at various positions before json_start
            for lp_back in range(0, 20):
                lp_off = json_start - 4 - lp_back
                if lp_off < 0:
                    continue
                lp = struct.unpack_from('<I', data, lp_off)[0]
                blob_content_start = lp_off + 4
                blob_end = blob_content_start + lp
                # Verify: LP points to a region that contains our marker
                if lp >= 100 and blob_end <= len(data) and blob_content_start <= json_start and blob_end > idx:
                    key = (blob_content_start, blob_end)
                    if key not in seen:
                        seen.add(key)
                        # Use json_start as the safe injection start (skip any prefix before {)
                        blobs.append((json_start, blob_end))
                    break
        idx += 1
    return blobs


def sanitize_for_json(text):
    """Replace characters that would break JSON string structure."""
    # " inside a JSON string terminates it prematurely
    text = text.replace('"', "'")
    # \ starts an escape sequence that may be invalid
    text = text.replace('\\', '/')
    return text


def inject_in_range(data, start, end, sorted_trans):
    replaced = 0
    truncated = 0
    for en, it in sorted_trans:
        en_bytes = en.encode('utf-8')
        it_safe = sanitize_for_json(it)
        it_bytes = it_safe.encode('utf-8')
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
    for blob_start, blob_end in blobs:
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
    print("Targeted Ink Injection v2 (blob-safe)")
    print("=" * 60)

    trans = load_translations()
    print(f"Translations: {len(trans)}")
    sorted_trans = sorted(trans.items(), key=lambda x: len(x[0]), reverse=True)

    grand_blobs = 0
    grand_replaced = 0
    grand_truncated = 0

    # Process all sharedassets (skip sharedassets1, already done)
    for f in sorted(os.listdir(ASSETS_DIR)):
        if not f.startswith('sharedassets') or not f.endswith('.assets') or f.endswith('.backup'):
            continue
        # Process all sharedassets files including sharedassets1
        fpath = os.path.join(ASSETS_DIR, f)
        t0 = time.time()
        blobs, r, t = process_file(fpath, sorted_trans)
        elapsed = time.time() - t0
        if blobs > 0:
            print(f"  {f}: {blobs} blobs, {r} replaced ({t} truncated) [{elapsed:.1f}s]")
        grand_blobs += blobs
        grand_replaced += r
        grand_truncated += t

    # Process all level files too
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
        grand_blobs += blobs
        grand_replaced += r
        grand_truncated += t

    print(f"\nTotal: {grand_blobs} blobs, {grand_replaced} replaced ({grand_truncated} truncated)")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
