"""
Extract ALL text strings from Ink JSON blobs in sharedassets and level files.
Ink text strings start with ^ in the compiled JSON format.
Compares with existing translations to find what's missing.
"""
import struct, os, re, csv, json

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
OUTPUT = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\missing_ink_strings.csv"
INK_MARKER = b'inkVersion'


def load_existing():
    trans = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 2 and row[0].strip():
                trans[row[0]] = row[1] if len(row) > 1 else ""
    return trans


def find_ink_blobs(data):
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
                    key = (json_start, blob_end)
                    if key not in seen:
                        seen.add(key)
                        blobs.append((json_start, blob_end))
                    break
        idx += 1
    return blobs


def extract_ink_texts(data, start, end):
    """Extract all ^ prefixed text strings from Ink JSON blob."""
    strings = set()
    blob = data[start:end]
    try:
        text = blob.decode('utf-8')
    except:
        return strings

    # Find all "^..." strings (Ink text markers)
    # In Ink compiled JSON, text is stored as "^Some text here"
    i = 0
    while i < len(text):
        # Look for "^ pattern
        idx = text.find('"^', i)
        if idx < 0:
            break
        # Find closing quote
        j = idx + 2
        s = []
        while j < len(text):
            ch = text[j]
            if ch == '"':
                break
            if ch == '\\':
                j += 1
                if j < len(text):
                    esc = text[j]
                    if esc == 'n':
                        s.append('\n')
                    elif esc == '"':
                        s.append('"')
                    elif esc == '\\':
                        s.append('\\')
                    else:
                        s.append('\\')
                        s.append(esc)
            else:
                s.append(ch)
            j += 1

        content = ''.join(s)
        # Filter: only translatable text
        clean = content.strip()
        if len(clean) >= 2 and re.search(r'[A-Za-z]{2,}', clean):
            # Skip Ink control strings
            if not clean.startswith('->') and not clean.startswith('ev') and clean not in ('end', 'done', 'nop'):
                strings.add(content)

        i = j + 1

    return strings


def main():
    existing = load_existing()
    print(f"Existing translations: {len(existing)}")

    all_strings = set()

    # Process sharedassets
    for f in sorted(os.listdir(ASSETS_DIR)):
        if not f.startswith('sharedassets') or not f.endswith('.assets') or f.endswith('.backup'):
            continue
        fpath = os.path.join(ASSETS_DIR, f)
        bak = fpath + '.backup'
        source = bak if os.path.exists(bak) else fpath
        data = open(source, 'rb').read()
        blobs = find_ink_blobs(data)
        file_strings = set()
        for start, end in blobs:
            file_strings |= extract_ink_texts(data, start, end)
        if file_strings:
            print(f"  {f}: {len(blobs)} blobs, {len(file_strings)} strings")
        all_strings |= file_strings

    # Process levels
    for i in range(25):
        fname = f"level{i}"
        fpath = os.path.join(ASSETS_DIR, fname)
        bak = fpath + '.backup'
        source = bak if os.path.exists(bak) else fpath
        if not os.path.exists(source):
            continue
        data = open(source, 'rb').read()
        blobs = find_ink_blobs(data)
        file_strings = set()
        for start, end in blobs:
            file_strings |= extract_ink_texts(data, start, end)
        if file_strings:
            print(f"  {fname}: {len(blobs)} blobs, {len(file_strings)} strings")
        all_strings |= file_strings

    print(f"\nTotal unique strings: {len(all_strings)}")

    # Find missing
    missing = set()
    for s in all_strings:
        if s not in existing:
            missing.add(s)

    print(f"Already translated: {len(all_strings) - len(missing)}")
    print(f"Missing translations: {len(missing)}")

    # Save missing strings
    with open(OUTPUT, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['ENGLISH', 'ITALIAN'])
        for s in sorted(missing, key=len, reverse=True):
            writer.writerow([s, ''])

    print(f"Saved to {OUTPUT}")

    # Show some samples
    samples = sorted(missing, key=len, reverse=True)[:10]
    print("\nSample missing strings:")
    for s in samples:
        print(f"  [{len(s)}] {s[:80]}")


if __name__ == '__main__':
    main()
