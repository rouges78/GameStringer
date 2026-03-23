"""
Esoteric Ebb - Binary-level Ink Injection (v3)
Works directly on raw bytes — no decode/re-encode of the full blob.
Only replaces the text portion of "^text" patterns, byte-for-byte.
"""
import struct, csv, os, re, shutil, sys, json

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
LEVEL_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_translations.csv"
CACHE_JSON = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\translation_cache.json"


def load_translations():
    trans = {}
    if os.path.exists(INK_CSV):
        with open(INK_CSV, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    trans[row[0].strip()] = row[1].strip()
    if os.path.exists(LEVEL_CSV):
        with open(LEVEL_CSV, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    k = row[0].strip()
                    if k not in trans:
                        trans[k] = row[1].strip()
    if os.path.exists(CACHE_JSON):
        try:
            with open(CACHE_JSON, 'r', encoding='utf-8') as f:
                cache = json.load(f)
            for k, v in cache.items():
                if k not in trans and v and v.strip():
                    trans[k.strip()] = v.strip()
        except:
            pass
    return trans


def find_caret_strings(data, start, end):
    """Find all "^..." patterns in raw bytes. Returns list of (text_start, text_end, english_text).
    text_start/text_end point to the text BETWEEN ^ and closing ", i.e. the replaceable part."""
    results = []
    i = start
    quote = ord('"')
    caret = ord('^')
    backslash = ord('\\')
    
    while i < end - 2:
        # Look for "^ pattern
        if data[i] == quote and data[i+1] == caret:
            # Find closing " (respecting backslash escapes)
            j = i + 2
            while j < end:
                if data[j] == backslash and j + 1 < end:
                    j += 2  # skip escaped char
                    continue
                if data[j] == quote:
                    break
                j += 1
            
            if j < end:
                # text is between i+2 (after ^) and j (before closing ")
                text_start = i + 2
                text_end = j
                try:
                    eng_text = bytes(data[text_start:text_end]).decode('utf-8')
                    results.append((text_start, text_end, eng_text))
                except UnicodeDecodeError:
                    pass
                i = j + 1
                continue
        i += 1
    return results


def inject_file(filepath, trans, mode="inject"):
    """Inject translations into a single assets file using raw byte replacement."""
    backup = filepath + ".backup"
    source = backup if os.path.exists(backup) else filepath
    
    data = bytearray(open(source, 'rb').read())
    orig_size = len(data)
    
    # Find all Ink blobs via inkVersion marker
    bom = b'\xef\xbb\xbf'
    blob_regions = []
    idx = 0
    seen_lp = set()
    
    while True:
        idx = data.find(b'inkVersion', idx)
        if idx < 0:
            break
        
        # Scan back for BOM
        for back in range(1, 300):
            off = idx - back
            if off < 0:
                break
            if data[off:off+3] == bom:
                lp_off = off - 4
                if lp_off >= 0 and lp_off not in seen_lp:
                    lp = struct.unpack_from('<I', data, lp_off)[0]
                    blob_start = lp_off + 4
                    blob_end = blob_start + lp
                    if lp > 50 and blob_end <= len(data):
                        seen_lp.add(lp_off)
                        blob_regions.append((blob_start, blob_end, lp))
                break
        idx += 1
    
    if not blob_regions:
        return 0, 0, 0, 0
    
    total_replaced = 0
    total_skipped_long = 0
    total_caret = 0
    
    for blob_start, blob_end, blob_size in blob_regions:
        carets = find_caret_strings(data, blob_start, blob_end)
        total_caret += len(carets)
        
        if mode == "diagnose":
            matched = sum(1 for _, _, eng in carets if eng.rstrip() in trans)
            print(f"    blob@{blob_start}: {len(carets)} carets, {matched} matched")
            continue
        
        for text_start, text_end, eng_text in carets:
            lookup = eng_text.rstrip()
            if lookup not in trans:
                continue
            
            it_text = trans[lookup]
            # Sanitize for raw JSON bytes:
            # 1. Replace lone backslashes — they become invalid \escape in JSON
            # 2. Replace double-quotes to avoid breaking JSON string delimiters
            # 3. Strip trailing backslashes (most common crash cause)
            it_text = it_text.replace('\\', '').replace('"', "'").replace('\n', ' ').replace('\r', ' ').replace('\t', ' ').rstrip()
            
            orig_bytes = data[text_start:text_end]
            orig_len = len(orig_bytes)
            it_bytes = it_text.encode('utf-8')
            
            if len(it_bytes) <= orig_len:
                # Pad with spaces to fill exact same byte length
                padded = it_bytes + b' ' * (orig_len - len(it_bytes))
                data[text_start:text_end] = padded
                total_replaced += 1
            else:
                # Italian is longer — skip (don't truncate, safer)
                total_skipped_long += 1
    
    if mode == "diagnose":
        return len(blob_regions), total_caret, 0, 0
    
    # Verify file size unchanged
    assert len(data) == orig_size, f"FILE SIZE CHANGED: {orig_size} -> {len(data)}"
    
    if total_replaced > 0:
        # Verify the blob JSONs are still valid
        valid = True
        for blob_start, blob_end, blob_size in blob_regions:
            blob_bytes = bytes(data[blob_start:blob_end])
            try:
                # Skip BOM (3 bytes) then parse JSON
                if blob_bytes[:3] == bom:
                    json.loads(blob_bytes[3:].decode('utf-8'))
                else:
                    json.loads(blob_bytes.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                print(f"    JSON INVALID in blob@{blob_start}: {e}")
                valid = False
                break
        
        if not valid:
            print(f"    ABORTED — JSON validation failed, file NOT written")
            return len(blob_regions), total_caret, 0, total_skipped_long
        
        # Write modified file
        if not os.path.exists(backup):
            shutil.copy2(filepath, backup)
        with open(filepath, 'wb') as f:
            f.write(bytes(data))
    
    return len(blob_regions), total_caret, total_replaced, total_skipped_long


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "diagnose"
    
    print("=" * 60)
    print(f"Esoteric Ebb - Byte-level Ink Injection (mode: {mode})")
    print("=" * 60)
    
    trans = load_translations()
    print(f"Traduzioni caricate: {len(trans)}")
    
    if not trans:
        print("ERRORE: nessuna traduzione!")
        return
    
    # Target files
    target_files = []
    for f in sorted(os.listdir(ASSETS_DIR)):
        fpath = os.path.join(ASSETS_DIR, f)
        if not os.path.isfile(fpath):
            continue
        if f.endswith('.backup') or f.endswith('.modified'):
            continue
        if f.startswith('sharedassets') and f.endswith('.assets'):
            target_files.append(fpath)
    
    print(f"File target: {len(target_files)}")
    
    grand_blobs = 0
    grand_carets = 0
    grand_replaced = 0
    grand_skipped = 0
    
    for fpath in target_files:
        fname = os.path.basename(fpath)
        
        if mode == "test1" and grand_blobs > 0:
            break
        
        print(f"  {fname}...")
        blobs, carets, replaced, skipped = inject_file(fpath, trans, mode)
        
        if blobs > 0:
            print(f"    {blobs} blobs, {carets} carets, {replaced} replaced, {skipped} skipped (too long)")
        
        grand_blobs += blobs
        grand_carets += carets
        grand_replaced += replaced
        grand_skipped += skipped
    
    print(f"\nTotale: {grand_blobs} blob, {grand_carets} caret, {grand_replaced} replaced, {grand_skipped} skipped")
    if mode not in ("diagnose",):
        print("Avvia il gioco per testare!")


if __name__ == '__main__':
    main()
