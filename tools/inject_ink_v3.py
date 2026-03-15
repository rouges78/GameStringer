"""
JSON-aware Ink injection v3 for Esoteric Ebb.
Finds text content in Ink JSON blobs by scanning for "^" patterns,
then replaces ONLY the text portion within JSON string boundaries.
This prevents JSON structure corruption.
"""
import struct, os, csv, shutil, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
INK_MARKER = b'inkVersion'


def load_translations():
    trans = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                en, it = row[0].strip(), row[1].strip()
                if len(en) >= 4 and en != it:
                    trans[en] = it
    return trans


def sanitize_for_json(text):
    """Replace characters that would break JSON string structure."""
    text = text.replace('\\', '/')
    text = text.replace('"', "'")
    return text


def find_ink_blobs(data):
    """Find all Ink JSON blobs by scanning for 'inkVersion' and tracing back to LP."""
    blobs = []
    seen = set()
    idx = 0
    while True:
        idx = data.find(INK_MARKER, idx)
        if idx < 0:
            break
        json_start = -1
        for back in range(1, 200):
            off = idx - back
            if off < 0:
                break
            if data[off] == ord('{'):
                json_start = off
                break
        if json_start >= 0 and json_start >= 4:
            for lp_back in range(0, 20):
                lp_off = json_start - 4 - lp_back
                if lp_off < 0:
                    continue
                lp = struct.unpack_from('<I', data, lp_off)[0]
                blob_content_start = lp_off + 4
                blob_end = blob_content_start + lp
                if lp >= 100 and blob_end <= len(data) and blob_content_start <= json_start and blob_end > idx:
                    key = (blob_content_start, blob_end)
                    if key not in seen:
                        seen.add(key)
                        blobs.append((blob_content_start, blob_end))
                    break
        idx += 1
    return blobs


def find_caret_strings(data, start, end):
    """
    Find all "^text" patterns in the blob.
    Returns list of (text_start, text_end) where text is between ^ and closing ".
    text_start is the position of the first char after ^.
    text_end is the position of the closing ".
    """
    results = []
    pos = start
    # Search for "^ pattern (0x22 0x5E)
    pattern = b'"^'
    while pos < end - 2:
        idx = data.find(pattern, pos, end)
        if idx < 0:
            break
        # Position after ^
        text_start = idx + 2
        # Find closing " (handle escape sequences)
        p = text_start
        while p < end:
            if data[p] == ord('\\'):
                p += 2  # skip escaped character
                continue
            if data[p] == ord('"'):
                # Found closing quote
                break
            p += 1
        if p < end:
            text_end = p  # position of closing "
            if text_end > text_start:  # non-empty text
                results.append((text_start, text_end))
        pos = p + 1 if p < end else end
    return results


def inject_blob(data, start, end, trans):
    """
    JSON-aware injection: find "^text" patterns and replace text with translations.
    """
    replaced = 0
    truncated = 0

    # Find all "^text" strings in this blob
    caret_strings = find_caret_strings(data, start, end)

    for text_start, text_end in caret_strings:
        # Extract the English text
        text_bytes = bytes(data[text_start:text_end])
        try:
            eng_text = text_bytes.decode('utf-8')
        except UnicodeDecodeError:
            continue

        # Handle JSON escape sequences in the extracted text
        # Unescape for lookup: \" -> ", \\ -> \, \n -> newline, etc.
        eng_unescaped = eng_text
        try:
            # Use simple unescaping for common cases
            eng_unescaped = eng_text.replace('\\"', '"').replace('\\\\', '\\').replace('\\n', '\n').replace('\\t', '\t')
        except:
            pass

        # Look up translation (try stripped, unescaped, and raw forms)
        ita_text = (trans.get(eng_unescaped.strip()) or
                    trans.get(eng_unescaped) or
                    trans.get(eng_text.strip()) or
                    trans.get(eng_text))
        if not ita_text:
            continue

        # Sanitize Italian text for JSON safety
        ita_safe = sanitize_for_json(ita_text)

        # Re-escape for JSON context (restore any escape sequences)
        # Only escape characters that need escaping in JSON strings
        ita_escaped = ita_safe.replace('\n', '\\n').replace('\t', '\\t')

        ita_bytes = ita_escaped.encode('utf-8')
        available = text_end - text_start  # bytes available for text

        if len(ita_bytes) <= available:
            # Fits: write Italian + space padding
            data[text_start:text_start + len(ita_bytes)] = ita_bytes
            for j in range(len(ita_bytes), available):
                data[text_start + j] = 0x20  # space padding (safe inside JSON string)
            replaced += 1
        else:
            # Too long: truncate to fit
            trunc = ita_bytes[:available]
            # Ensure valid UTF-8
            while trunc:
                try:
                    trunc.decode('utf-8')
                    break
                except UnicodeDecodeError:
                    trunc = trunc[:-1]
            if trunc:
                data[text_start:text_start + len(trunc)] = trunc
                for j in range(len(trunc), available):
                    data[text_start + j] = 0x20
                replaced += 1
                truncated += 1

    return replaced, truncated


def process_file(fpath, trans):
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
        r, t = inject_blob(data, blob_start, blob_end, trans)
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
    print("Ink Injection v3 (JSON-aware, safe)")
    print("=" * 60)

    trans = load_translations()
    print(f"Translations: {len(trans)}")

    grand_blobs = 0
    grand_replaced = 0
    grand_truncated = 0

    for f in sorted(os.listdir(ASSETS_DIR)):
        if not f.startswith('sharedassets') or not f.endswith('.assets') or f.endswith('.backup'):
            continue
        fpath = os.path.join(ASSETS_DIR, f)
        t0 = time.time()
        blobs, r, t = process_file(fpath, trans)
        elapsed = time.time() - t0
        if blobs > 0:
            print(f"  {f}: {blobs} blobs, {r} replaced ({t} truncated) [{elapsed:.1f}s]")
        grand_blobs += blobs
        grand_replaced += r
        grand_truncated += t

    print(f"\nTotal: {grand_blobs} blobs, {grand_replaced} replaced ({grand_truncated} truncated)")
    if grand_replaced > 0:
        print("Avvia il gioco!")


if __name__ == '__main__':
    main()
