"""
Esoteric Ebb - Safe in-place injection (NO resize, NO offset changes).
Replaces ENGLISH text with Italian PER ROW, adjusting each row to maintain
the EXACT same total byte length for each CSV block.

Strategy per row:
- If Italian fits in the same byte space as English: use it + pad other columns
- If Italian is slightly longer: steal bytes from other empty columns (GERMAN etc)
- If still too long: truncate Italian with "…"
"""
import struct, os, csv, io, shutil

BACKUP = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets.backup"
TARGET = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets"
TRANS_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated"

SEARCH = b"ID,ENGLISH"


def load_trans(path):
    t = {}
    if not os.path.exists(path): return t
    with open(path, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            eid, it = row.get('ID','').strip(), row.get('ITALIAN','').strip()
            if eid and it: t[eid] = it
    return t


def ident(text):
    lines = text.strip().split('\n')
    if len(lines) < 2: return None
    ids = ' '.join(l.split(',',1)[0].strip().lower() for l in lines[1:5] if l.strip())
    if 'ui_' in ids or 'death_' in ids: return 'uielements'
    if 'll_' in ids or 'vl_' in ids: return 'popups'
    if 'quest_' in ids: return 'questpoints'
    if 'feat_' in ids: return 'feats'
    if 'bg_' in ids: return 'backgrounds'
    return None


def csv_line_to_str(parts):
    """Convert list of fields back to CSV string"""
    buf = io.StringIO()
    csv.writer(buf).writerow(parts)
    return buf.getvalue().rstrip('\r\n')


def truncate_utf8(text, max_bytes):
    """Truncate text to fit in max_bytes when UTF-8 encoded, adding … if truncated"""
    encoded = text.encode('utf-8')
    if len(encoded) <= max_bytes:
        return text
    # Need to truncate - leave room for "…" (3 bytes in UTF-8)
    target = max_bytes - 3
    if target < 1:
        return text[:max_bytes]
    # Decode back safely at the target byte boundary
    truncated = encoded[:target].decode('utf-8', errors='ignore')
    return truncated + "…"


def rebuild_csv_same_size(original_text, translations):
    """
    Replace ENGLISH with Italian, keeping EXACT same byte length.
    Returns new CSV text of exactly the same byte length as original.
    """
    original_bytes = original_text.encode('utf-8')
    original_len = len(original_bytes)
    
    lines = original_text.split('\n')
    header = lines[0]
    
    # Figure out column count from header
    header_parts = header.split(',')
    num_cols = len(header_parts)
    
    # Find which columns have data and which are empty (available for padding)
    # We'll process line by line
    new_lines = [header]
    translated_count = 0
    truncated_count = 0
    
    for line in lines[1:]:
        if not line.strip():
            new_lines.append(line)
            continue
        
        # Parse original line
        orig_reader = csv.reader(io.StringIO(line))
        try:
            orig_parts = list(next(orig_reader))
        except StopIteration:
            new_lines.append(line)
            continue
        
        entry_id = orig_parts[0].strip() if orig_parts else ''
        orig_line_bytes = len(line.encode('utf-8'))
        
        if entry_id not in translations or len(orig_parts) < 2:
            new_lines.append(line)
            continue
        
        # Replace ENGLISH (column 1) with Italian
        italian = translations[entry_id]
        new_parts = list(orig_parts)
        new_parts[1] = italian
        
        # Build new line and check size
        new_line = csv_line_to_str(new_parts)
        new_line_bytes = len(new_line.encode('utf-8'))
        
        if new_line_bytes <= orig_line_bytes:
            # Fits! Pad with spaces at end of last column to match size
            diff = orig_line_bytes - new_line_bytes
            if diff > 0 and len(new_parts) > 2:
                # Add spaces to the last non-essential column
                last_col = len(new_parts) - 1
                new_parts[last_col] = new_parts[last_col] + ' ' * diff
                new_line = csv_line_to_str(new_parts)
                # Verify
                actual = len(new_line.encode('utf-8'))
                if actual != orig_line_bytes:
                    # CSV quoting might change things - try raw padding
                    new_line = new_line + ' ' * (orig_line_bytes - actual) if actual < orig_line_bytes else new_line[:orig_line_bytes]
            elif diff > 0:
                new_line = new_line + ' ' * diff
            new_lines.append(new_line)
            translated_count += 1
        else:
            # Italian is longer - try to reduce by stripping other columns
            extra_needed = new_line_bytes - orig_line_bytes
            
            # Try stripping spaces/content from other empty columns (GERMAN, etc)
            saved = 0
            for col_idx in range(2, len(new_parts)):
                col_content = new_parts[col_idx].strip()
                if col_content:
                    col_bytes = len(new_parts[col_idx].encode('utf-8'))
                    stripped_bytes = len(col_content.encode('utf-8'))
                    can_save = col_bytes - stripped_bytes
                    if can_save > 0:
                        new_parts[col_idx] = col_content
                        saved += can_save
            
            if saved >= extra_needed:
                # Rebuilt with stripped columns fits
                new_line = csv_line_to_str(new_parts)
                actual = len(new_line.encode('utf-8'))
                diff = orig_line_bytes - actual
                if diff > 0:
                    new_line = new_line + ' ' * diff
                elif diff < 0:
                    # Still doesn't fit - truncate Italian
                    eng_bytes = len(orig_parts[1].encode('utf-8'))
                    new_parts[1] = truncate_utf8(italian, eng_bytes)
                    new_line = csv_line_to_str(new_parts)
                    actual = len(new_line.encode('utf-8'))
                    diff = orig_line_bytes - actual
                    if diff > 0: new_line = new_line + ' ' * diff
                    elif diff < 0: new_line = new_line[:orig_line_bytes]
                    truncated_count += 1
                new_lines.append(new_line)
                translated_count += 1
            else:
                # Must truncate Italian to fit
                eng_bytes = len(orig_parts[1].encode('utf-8'))
                new_parts[1] = truncate_utf8(italian, eng_bytes + saved)
                for col_idx in range(2, len(new_parts)):
                    new_parts[col_idx] = new_parts[col_idx].strip()
                new_line = csv_line_to_str(new_parts)
                actual = len(new_line.encode('utf-8'))
                diff = orig_line_bytes - actual
                if diff > 0: new_line = new_line + ' ' * diff
                elif diff < 0: new_line = new_line[:orig_line_bytes]
                new_lines.append(new_line)
                translated_count += 1
                truncated_count += 1
    
    result = '\n'.join(new_lines)
    result_bytes = result.encode('utf-8')
    
    # Final size adjustment
    if len(result_bytes) < original_len:
        result_bytes = result_bytes + b' ' * (original_len - len(result_bytes))
    elif len(result_bytes) > original_len:
        result_bytes = result_bytes[:original_len]
    
    assert len(result_bytes) == original_len, f"Size mismatch: {len(result_bytes)} != {original_len}"
    
    return result_bytes, translated_count, truncated_count


def main():
    print("=" * 60)
    print("Esoteric Ebb - Safe In-Place Injector (No Resize)")
    print("=" * 60)

    # Load translations
    tm = {}
    for n, f in [('uielements','uielements.csv'),('feats','feats.csv'),
                  ('questpoints','questpoints.csv'),('backgrounds','table_0.csv')]:
        t = load_trans(os.path.join(TRANS_DIR, f))
        if t: tm[n] = t; print(f"  {n}: {len(t)}")
    print(f"  Total: {sum(len(v) for v in tm.values())}")

    # Read clean backup
    with open(BACKUP, 'rb') as f:
        data = bytearray(f.read())
    print(f"\nFile: {len(data):,} bytes")

    # Find CSV blocks
    blocks = []
    pos = 0
    while True:
        idx = data.find(SEARCH, pos)
        if idx == -1: break
        end = idx
        while end < len(data) and data[end] != 0: end += 1
        try:
            text = data[idx:end].decode('utf-8')
            if len(text) > 20:
                blocks.append({'offset': idx, 'end': end, 'len': end - idx, 'text': text})
        except: pass
        pos = idx + 1

    print(f"CSV blocks: {len(blocks)}")

    total_injected = 0
    total_truncated = 0

    for block in blocks:
        name = ident(block['text'])
        if not name or name not in tm:
            continue

        trans = tm[name]
        print(f"\n🔧 {name}: {block['len']} bytes, {len(trans)} translations")

        new_bytes, count, truncated = rebuild_csv_same_size(block['text'], trans)
        
        # Write to data - EXACT same position and size
        data[block['offset']:block['end']] = new_bytes
        
        total_injected += count
        total_truncated += truncated
        print(f"  ✅ {count} injected, {truncated} truncated")

    # Verify file size unchanged
    assert len(data) == os.path.getsize(BACKUP), "File size changed!"
    
    with open(TARGET, 'wb') as f:
        f.write(data)

    print(f"\n{'='*60}")
    print(f"✅ DONE: {total_injected} translations ({total_truncated} truncated)")
    print(f"   File size: UNCHANGED ({len(data):,} bytes)")
    print(f"\n🎮 Avvia il gioco! Il testo inglese è ora italiano.")


if __name__ == '__main__':
    main()
