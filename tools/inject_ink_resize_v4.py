"""
Ink Resize Injection v4 for Esoteric Ebb.
Combines JSON-aware text replacement (from v3) with Unity file resize.
Full Italian translations without truncation - blobs grow as needed.
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


# ─── Unity v22 SerializedFile parsing ─────────────────────────────────

def read_be64(data, off):
    lo = struct.unpack('>I', data[off:off+4])[0]
    hi = struct.unpack('>I', data[off+4:off+8])[0]
    return lo | (hi << 32)

def write_be64(data, off, val):
    lo = val & 0xFFFFFFFF
    hi = (val >> 32) & 0xFFFFFFFF
    struct.pack_into('>I', data, off, lo)
    struct.pack_into('>I', data, off+4, hi)

def align16(x):
    return (x + 15) & ~15

def parse_header(data):
    version = struct.unpack('>I', data[8:12])[0]
    assert version == 22, f"Expected v22, got {version}"
    return {
        'version': version,
        'meta_size': read_be64(data, 20),
        'file_size': read_be64(data, 28),
        'data_offset': read_be64(data, 36),
    }

def parse_metadata(data, header):
    pos = 48
    end = data.index(b'\x00', pos)
    unity_ver = data[pos:end].decode('utf-8')
    pos = end + 1
    
    platform = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    has_types = data[pos]
    pos += 1
    assert has_types == 0, "Type tree not supported"
    
    type_count = struct.unpack_from('<i', data, pos)[0]
    pos += 4
    
    type_classes = []
    for i in range(type_count):
        class_id = struct.unpack_from('<i', data, pos)[0]
        pos += 4
        pos += 1  # is_stripped
        pos += 2  # script_type_index
        if class_id == 114 or class_id < 0:
            pos += 16
        pos += 16
        type_classes.append(class_id)
    
    obj_count = struct.unpack_from('<i', data, pos)[0]
    pos += 4
    if pos % 4 != 0:
        pos += 4 - (pos % 4)
    
    objects = []
    for i in range(obj_count):
        objects.append({
            'idx': i,
            'table_pos': pos,
            'path_id': struct.unpack_from('<q', data, pos)[0],
            'byte_off': struct.unpack_from('<q', data, pos + 8)[0],
            'byte_size': struct.unpack_from('<I', data, pos + 16)[0],
            'type_idx': struct.unpack_from('<i', data, pos + 20)[0],
            'class_id': type_classes[struct.unpack_from('<i', data, pos + 20)[0]]
                        if 0 <= struct.unpack_from('<i', data, pos + 20)[0] < len(type_classes) else -1,
        })
        pos += 24
    
    return {'unity_ver': unity_ver, 'type_classes': type_classes, 'objects': objects}


# ─── JSON-aware blob replacement (NO truncation) ─────────────────────

def find_caret_strings(blob_bytes, start, end):
    """Find all "^text" patterns. Returns (text_start, text_end) pairs."""
    results = []
    pos = start
    pattern = b'"^'
    while pos < end - 2:
        idx = blob_bytes.find(pattern, pos, end)
        if idx < 0:
            break
        text_start = idx + 2
        p = text_start
        while p < end:
            if blob_bytes[p] == ord('\\'):
                p += 2
                continue
            if blob_bytes[p] == ord('"'):
                break
            p += 1
        if p < end and p > text_start:
            results.append((text_start, p))
        pos = p + 1 if p < end else end
    return results


def replace_blob_text(blob_bytes, trans):
    """
    Replace all "^text" patterns in blob with full Italian translations.
    Returns (new_blob_bytes, replaced_count).
    No truncation — the blob can grow.
    """
    caret_strings = find_caret_strings(blob_bytes, 0, len(blob_bytes))
    if not caret_strings:
        return blob_bytes, 0
    
    # Build list of replacements: (start, end, new_bytes)
    replacements = []
    for text_start, text_end in caret_strings:
        text = blob_bytes[text_start:text_end]
        try:
            eng_text = text.decode('utf-8')
        except UnicodeDecodeError:
            continue
        
        eng_unescaped = eng_text
        try:
            eng_unescaped = eng_text.replace('\\"', '"').replace('\\\\', '\\').replace('\\n', '\n').replace('\\t', '\t')
        except:
            pass
        
        ita_text = (trans.get(eng_unescaped.strip()) or
                    trans.get(eng_unescaped) or
                    trans.get(eng_text.strip()) or
                    trans.get(eng_text))
        if not ita_text:
            continue
        
        ita_safe = sanitize_for_json(ita_text)
        ita_escaped = ita_safe.replace('\n', '\\n').replace('\t', '\\t')
        ita_bytes = ita_escaped.encode('utf-8')
        
        replacements.append((text_start, text_end, ita_bytes))
    
    if not replacements:
        return blob_bytes, 0
    
    # Build new blob by splicing in replacements
    parts = []
    prev_end = 0
    for start, end, new_bytes in replacements:
        parts.append(blob_bytes[prev_end:start])
        parts.append(new_bytes)
        prev_end = end
    parts.append(blob_bytes[prev_end:])
    
    return b''.join(parts), len(replacements)


# ─── Main resize injection ────────────────────────────────────────────

def process_file(fpath, trans):
    """Process one sharedassets file with resize injection."""
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath
    data = bytearray(open(source, 'rb').read())
    orig_size = len(data)
    
    header = parse_header(data)
    meta = parse_metadata(data, header)
    data_off = header['data_offset']
    
    # Find objects containing Ink blobs
    ink_objects = []
    for obj in meta['objects']:
        abs_off = data_off + obj['byte_off']
        if obj['byte_size'] > 100 and abs_off + min(200, obj['byte_size']) <= len(data):
            chunk = data[abs_off:abs_off + min(200, obj['byte_size'])]
            if INK_MARKER in chunk:
                ink_objects.append(obj)
    
    if not ink_objects:
        return 0, 0
    
    # Sort objects by byte_off to process in order
    all_objects = sorted(meta['objects'], key=lambda o: o['byte_off'])
    ink_set = {o['idx'] for o in ink_objects}
    
    # For each Ink object: parse structure, replace text, compute new size
    # Store: obj_idx -> (new_json_bytes, old_obj_data)
    ink_replacements = {}
    total_replaced = 0
    
    for obj in ink_objects:
        abs_off = data_off + obj['byte_off']
        
        # Parse: LP(name) + name + pad + LP(json) + json + json_pad
        name_lp = struct.unpack_from('<I', data, abs_off)[0]
        name_bytes = bytes(data[abs_off+4:abs_off+4+name_lp])
        name_pad = (4 - name_lp % 4) % 4
        json_lp_off = abs_off + 4 + name_lp + name_pad
        json_lp = struct.unpack_from('<I', data, json_lp_off)[0]
        json_start = json_lp_off + 4
        
        # Extract JSON blob and replace text
        json_bytes = bytes(data[json_start:json_start + json_lp])
        new_json, count = replace_blob_text(json_bytes, trans)
        
        if count > 0:
            total_replaced += count
            new_json_lp = len(new_json)
            new_json_pad = (4 - new_json_lp % 4) % 4
            new_obj_size = 4 + name_lp + name_pad + 4 + new_json_lp + new_json_pad
            
            ink_replacements[obj['idx']] = {
                'name_lp': name_lp,
                'name_bytes': name_bytes,
                'name_pad': name_pad,
                'new_json': new_json,
                'new_json_lp': new_json_lp,
                'new_json_pad': new_json_pad,
                'new_obj_size': new_obj_size,
                'old_obj_size': obj['byte_size'],
            }
    
    if total_replaced == 0:
        return len(ink_objects), 0
    
    # ─── Rebuild data section ───
    # Process all objects in order, replacing Ink objects with resized versions
    new_data_parts = []
    new_data_parts.append(bytes(data[:data_off]))  # metadata + header (unchanged)
    
    current_data_pos = 0  # relative to data_offset
    obj_new_offsets = {}  # obj_idx -> new_byte_off
    obj_new_sizes = {}    # obj_idx -> new_byte_size
    
    for obj in all_objects:
        # Align to 16 bytes
        aligned_pos = align16(current_data_pos)
        pad_needed = aligned_pos - current_data_pos
        if pad_needed > 0:
            new_data_parts.append(b'\x00' * pad_needed)
            current_data_pos = aligned_pos
        
        obj_new_offsets[obj['idx']] = current_data_pos
        
        if obj['idx'] in ink_replacements:
            # Write resized Ink object
            rep = ink_replacements[obj['idx']]
            obj_bytes = bytearray()
            # LP(name) + name + name_pad
            obj_bytes.extend(struct.pack('<I', rep['name_lp']))
            obj_bytes.extend(rep['name_bytes'])
            obj_bytes.extend(b'\x00' * rep['name_pad'])
            # LP(json) + json + json_pad
            obj_bytes.extend(struct.pack('<I', rep['new_json_lp']))
            obj_bytes.extend(rep['new_json'])
            obj_bytes.extend(b'\x00' * rep['new_json_pad'])
            
            new_data_parts.append(bytes(obj_bytes))
            obj_new_sizes[obj['idx']] = rep['new_obj_size']
            current_data_pos += rep['new_obj_size']
        else:
            # Copy original object data as-is
            abs_off = data_off + obj['byte_off']
            obj_data = bytes(data[abs_off:abs_off + obj['byte_size']])
            new_data_parts.append(obj_data)
            obj_new_sizes[obj['idx']] = obj['byte_size']
            current_data_pos += obj['byte_size']
    
    new_data = bytearray(b''.join(new_data_parts))
    new_file_size = len(new_data)
    
    # ─── Update object table ───
    for obj in meta['objects']:
        idx = obj['idx']
        table_pos = obj['table_pos']
        
        if idx in obj_new_offsets:
            struct.pack_into('<q', new_data, table_pos + 8, obj_new_offsets[idx])
        if idx in obj_new_sizes:
            struct.pack_into('<I', new_data, table_pos + 16, obj_new_sizes[idx])
    
    # ─── Update header ───
    write_be64(new_data, 28, new_file_size)
    
    # ─── Write output ───
    if not os.path.exists(backup):
        shutil.copy2(fpath, backup)
    with open(fpath, 'wb') as f:
        f.write(bytes(new_data))
    
    diff = new_file_size - orig_size
    print(f"    Size: {orig_size} -> {new_file_size} ({'+' if diff >= 0 else ''}{diff})")
    
    return len(ink_objects), total_replaced


def main():
    print("=" * 60)
    print("Ink Resize Injection v4 (full translations, no truncation)")
    print("=" * 60)
    
    trans = load_translations()
    print(f"Translations: {len(trans)}")
    
    grand_blobs = 0
    grand_replaced = 0
    
    for f in sorted(os.listdir(ASSETS_DIR)):
        if not f.startswith('sharedassets') or not f.endswith('.assets') or f.endswith('.backup'):
            continue
        fpath = os.path.join(ASSETS_DIR, f)
        t0 = time.time()
        blobs, replaced = process_file(fpath, trans)
        elapsed = time.time() - t0
        if blobs > 0:
            print(f"  {f}: {blobs} ink objs, {replaced} replaced [{elapsed:.1f}s]")
        grand_blobs += blobs
        grand_replaced += replaced
    
    print(f"\nTotal: {grand_blobs} ink objects, {grand_replaced} text replacements")
    if grand_replaced > 0:
        print("Avvia il gioco!")


if __name__ == '__main__':
    main()
