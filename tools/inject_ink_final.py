"""
Esoteric Ebb - Safe Ink Injection (Final)
Step 1: Diagnose how caret strings in blobs map to CSV translations
Step 2: Inject translations in-place (same byte size, no file resize)
Step 3: Only modifies sharedassets files (where Ink stories live)
"""
import struct, csv, os, re, shutil, sys, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
LEVEL_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_translations.csv"
CACHE_JSON = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\translation_cache.json"

# ── Step 1: Load translations ───────────────────────────────
def load_translations():
    trans = {}
    # From ink CSV
    if os.path.exists(INK_CSV):
        with open(INK_CSV, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)  # skip header
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    trans[row[0].strip()] = row[1].strip()
    # From level CSV
    if os.path.exists(LEVEL_CSV):
        with open(LEVEL_CSV, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    k = row[0].strip()
                    if k not in trans:
                        trans[k] = row[1].strip()
    # Also try JSON cache (keys are the English text)
    if os.path.exists(CACHE_JSON):
        import json
        try:
            with open(CACHE_JSON, 'r', encoding='utf-8') as f:
                cache = json.load(f)
            for k, v in cache.items():
                if k not in trans and v and v.strip():
                    trans[k.strip()] = v.strip()
        except:
            pass
    return trans


# ── Step 2: Find Ink blobs in a Unity assets file ───────────
def find_ink_blobs(data):
    bom = b'\xef\xbb\xbf'
    blobs = []
    idx = 0
    while True:
        idx = data.find(b'inkVersion', idx)
        if idx < 0:
            break
        # Scan back for BOM or { that starts the JSON
        json_start = -1
        for back in range(1, 300):
            off = idx - back
            if off < 0:
                break
            # BOM marks the true start
            if data[off:off+3] == bom:
                json_start = off + 3  # after BOM
                break
            # Or just a bare {
            if data[off:off+1] == b'{' and json_start < 0:
                json_start = off
        
        if json_start < 0:
            idx += 1
            continue
        
        # Find LP (length prefix) before the string data
        # In Unity, strings are stored as: [4-byte length][string bytes][padding to 4-byte align]
        # The BOM is part of the string, so LP is before BOM
        lp_off = json_start - 3 - 4  # 3 for BOM, 4 for LP
        if lp_off < 0:
            idx += 1
            continue
        
        lp = struct.unpack_from('<I', data, lp_off)[0]
        blob_content_start = lp_off + 4
        blob_content_end = blob_content_start + lp
        
        if lp > 50 and blob_content_end <= len(data):
            blobs.append({
                'lp_off': lp_off,
                'content_start': blob_content_start,
                'content_end': blob_content_end,
                'size': lp
            })
        idx += 1
    
    # Deduplicate by lp_off
    seen = set()
    unique = []
    for b in blobs:
        if b['lp_off'] not in seen:
            seen.add(b['lp_off'])
            unique.append(b)
    return unique


# ── Step 3: Replace caret strings inside a blob ─────────────
def inject_blob(data, blob, trans):
    """Replace "^english" with "^italian" inside a single Ink blob, keeping exact byte size."""
    start = blob['content_start']
    end = blob['content_end']
    size = blob['size']
    
    blob_bytes = bytes(data[start:end])
    blob_str = blob_bytes.decode('utf-8', errors='replace')
    
    replaced = 0
    truncated = 0
    
    # Find all "^text" patterns
    # In Ink JSON: ["^And so here we are. ","#","^dex","/#","\n",...]
    result_parts = []
    i = 0
    while i < len(blob_str):
        # Look for "^ pattern
        if blob_str[i] == '"' and i + 1 < len(blob_str) and blob_str[i+1] == '^':
            # Find closing "
            j = i + 2
            while j < len(blob_str):
                if blob_str[j] == '\\' and j + 1 < len(blob_str):
                    j += 2
                    continue
                if blob_str[j] == '"':
                    break
                j += 1
            
            if j < len(blob_str):
                # Extract text between ^ and "
                original_text = blob_str[i+2:j]
                lookup = original_text.rstrip()
                
                if lookup in trans:
                    it_text = trans[lookup]
                    # Sanitize: escape quotes and backslashes for JSON
                    it_text = it_text.replace('\\', '\\\\').replace('"', "'")
                    
                    # Calculate byte lengths
                    orig_encoded = original_text.encode('utf-8')
                    it_encoded = it_text.encode('utf-8')
                    
                    if len(it_encoded) <= len(orig_encoded):
                        # Pad with spaces
                        pad = ' ' * (len(orig_encoded) - len(it_encoded))
                        result_parts.append('"^')
                        result_parts.append(it_text + pad)
                        result_parts.append('"')
                        replaced += 1
                    else:
                        # Truncate to fit
                        trunc = it_encoded[:len(orig_encoded)]
                        while trunc:
                            try:
                                trunc.decode('utf-8')
                                break
                            except UnicodeDecodeError:
                                trunc = trunc[:-1]
                        if trunc:
                            decoded = trunc.decode('utf-8')
                            pad = ' ' * (len(orig_encoded) - len(trunc))
                            result_parts.append('"^')
                            result_parts.append(decoded + pad)
                            result_parts.append('"')
                            replaced += 1
                            truncated += 1
                        else:
                            result_parts.append(blob_str[i:j+1])
                    
                    i = j + 1
                    continue
                else:
                    # No translation, keep original
                    result_parts.append(blob_str[i:j+1])
                    i = j + 1
                    continue
        
        result_parts.append(blob_str[i])
        i += 1
    
    new_str = ''.join(result_parts)
    new_bytes = new_str.encode('utf-8')
    
    if len(new_bytes) != size:
        # Size mismatch - abort this blob
        return 0, 0, f"SIZE MISMATCH {size} -> {len(new_bytes)}"
    
    data[start:end] = new_bytes
    return replaced, truncated, None


# ── Main ─────────────────────────────────────────────────────
def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "diagnose"
    
    print("=" * 60)
    print(f"Esoteric Ebb - Ink Injection (mode: {mode})")
    print("=" * 60)
    
    trans = load_translations()
    print(f"Translations loaded: {len(trans)}")
    
    if not trans:
        print("ERROR: no translations!")
        return
    
    # Show first 3 translation keys for debugging
    for i, (k, v) in enumerate(list(trans.items())[:3]):
        print(f"  Sample {i}: [{k[:50]}] -> [{v[:50]}]")
    
    # Find target files
    target_files = []
    for f in sorted(os.listdir(ASSETS_DIR)):
        fpath = os.path.join(ASSETS_DIR, f)
        if not os.path.isfile(fpath):
            continue
        if f.endswith('.backup') or f.endswith('.modified'):
            continue
        if f.startswith('sharedassets') and f.endswith('.assets'):
            target_files.append(fpath)
    
    print(f"Target files: {len(target_files)}")
    
    grand_blobs = 0
    grand_replaced = 0
    grand_truncated = 0
    grand_errors = 0
    
    for fpath in target_files:
        fname = os.path.basename(fpath)
        backup = fpath + ".backup"
        source = backup if os.path.exists(backup) else fpath
        
        data = bytearray(open(source, 'rb').read())
        orig_size = len(data)
        
        blobs = find_ink_blobs(data)
        if not blobs:
            continue
        
        if mode == "diagnose":
            # Just show what we'd do
            # Check matching for first blob
            b = blobs[0]
            blob_bytes = bytes(data[b['content_start']:b['content_end']])
            blob_str = blob_bytes.decode('utf-8', errors='replace')
            caret_matches = re.findall(r'"(\^[^"]*)"', blob_str)
            matched = sum(1 for m in caret_matches if m[1:].rstrip() in trans)
            print(f"  {fname}: {len(blobs)} blobs, first blob has {len(caret_matches)} carets, {matched} matched")
            grand_blobs += len(blobs)
            continue
        
        if mode == "test1":
            # Only inject first blob of first file
            if grand_blobs > 0:
                break
        
        # Inject mode
        file_replaced = 0
        file_truncated = 0
        file_errors = 0
        
        for bi, blob in enumerate(blobs):
            if mode == "test1" and bi > 0:
                break
            r, t, err = inject_blob(data, blob, trans)
            if err:
                print(f"  {fname} blob {bi}: {err}")
                file_errors += 1
            file_replaced += r
            file_truncated += t
        
        if file_replaced > 0:
            assert len(data) == orig_size, "FILE SIZE CHANGED!"
            if not os.path.exists(backup):
                shutil.copy2(fpath, backup)
            with open(fpath, 'wb') as f:
                f.write(bytes(data))
            print(f"  {fname}: {len(blobs)} blobs, {file_replaced} replaced ({file_truncated} trunc, {file_errors} err)")
        
        grand_blobs += len(blobs)
        grand_replaced += file_replaced
        grand_truncated += file_truncated
        grand_errors += file_errors
    
    print(f"\nTotal: {grand_blobs} blobs, {grand_replaced} replaced ({grand_truncated} truncated, {grand_errors} errors)")
    if mode != "diagnose":
        print("Avvia il gioco!")


if __name__ == '__main__':
    main()
