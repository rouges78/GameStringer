"""
Level File Resize Injection for Esoteric Ebb.
Replaces LP-prefixed strings with full Italian translations, resizing objects as needed.
Uses key-safe pattern matching. Falls back to LP-direct for level0.
"""
import struct, os, csv, shutil, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
TRANS_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated"


# ─── Unity v22 parsing (shared with inject_ink_resize_v4.py) ──────────

def read_be64(data, off):
    lo = struct.unpack('>I', data[off:off+4])[0]
    hi = struct.unpack('>I', data[off+4:off+8])[0]
    return lo | (hi << 32)

def write_be64(data, off, val):
    lo = val & 0xFFFFFFFF
    hi = (val >> 32) & 0xFFFFFFFF
    struct.pack_into('>I', data, off, lo)
    struct.pack_into('>I', data, off+4, hi)

def align4(x):
    return (x + 3) & ~3

def align16(x):
    return (x + 15) & ~15

def parse_header(data):
    version = struct.unpack('>I', data[8:12])[0]
    assert version == 22, f"Expected v22, got {version}"
    return {
        'meta_size': read_be64(data, 20),
        'file_size': read_be64(data, 28),
        'data_offset': read_be64(data, 36),
    }

def parse_metadata(data):
    pos = 48
    end = data.index(b'\x00', pos)
    pos = end + 1
    pos += 4  # platform
    has_types = data[pos]
    pos += 1
    assert has_types == 0, "Type tree not supported"
    type_count = struct.unpack_from('<i', data, pos)[0]
    pos += 4
    type_classes = []
    for i in range(type_count):
        cid = struct.unpack_from('<i', data, pos)[0]
        pos += 4; pos += 1; pos += 2
        if cid == 114 or cid < 0:
            pos += 16
        pos += 16
        type_classes.append(cid)
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
        })
        pos += 24
    return {'type_classes': type_classes, 'objects': objects}


# ─── Translation loading ──────────────────────────────────────────────

def load_keyed_translations():
    entries = []
    for fname in os.listdir(TRANS_DIR):
        if not fname.endswith('.csv'):
            continue
        path = os.path.join(TRANS_DIR, fname)
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = row.get('ID', '').strip()
                eng = row.get('ENGLISH', '').strip()
                ita = row.get('ITALIAN', '').strip()
                if key and eng and ita and eng != ita:
                    entries.append((key, eng, ita))
    return entries


def build_key_pattern(key):
    key_bytes = key.encode('utf-8')
    key_len = len(key_bytes)
    key_pad = (4 - key_len % 4) % 4
    return struct.pack('<I', key_len) + key_bytes + b'\x00' * key_pad + b'\x02\x00\x00\x00'


# ─── Object-level string replacement (with resize) ───────────────────

def resize_object_keyed(obj_data, entries):
    """
    Find key-value patterns in object data and replace values with full Italian.
    Returns (new_obj_data, replaced_count).
    """
    # Collect all replacements: (val_lp_off_in_obj, old_val_lp, old_val_pad, new_val_bytes)
    replacements = []
    
    for key, eng, ita in entries:
        key_pattern = build_key_pattern(key)
        pos = 0
        while True:
            idx = obj_data.find(key_pattern, pos)
            if idx < 0:
                break
            
            val_lp_off = idx + len(key_pattern)
            if val_lp_off + 4 > len(obj_data):
                pos = idx + 1
                continue
            
            val_lp = struct.unpack_from('<I', obj_data, val_lp_off)[0]
            val_start = val_lp_off + 4
            val_end = val_start + val_lp
            
            if val_end > len(obj_data):
                pos = idx + 1
                continue
            
            try:
                current_str = obj_data[val_start:val_end].decode('utf-8')
            except UnicodeDecodeError:
                pos = idx + 1
                continue
            
            if current_str.strip() != eng.strip():
                pos = idx + 1
                continue
            
            old_pad = (4 - val_lp % 4) % 4
            ita_bytes = ita.encode('utf-8')
            new_pad = (4 - len(ita_bytes) % 4) % 4
            
            replacements.append({
                'val_lp_off': val_lp_off,
                'old_total': 4 + val_lp + old_pad,   # LP + value + padding
                'new_lp': len(ita_bytes),
                'new_bytes': ita_bytes,
                'new_pad': new_pad,
            })
            
            pos = val_end + old_pad
    
    if not replacements:
        return obj_data, 0
    
    # Sort by position
    replacements.sort(key=lambda r: r['val_lp_off'])
    
    # Build new object data
    parts = []
    prev_end = 0
    for rep in replacements:
        # Copy everything before this replacement
        parts.append(obj_data[prev_end:rep['val_lp_off']])
        # Write new LP + value + padding
        parts.append(struct.pack('<I', rep['new_lp']))
        parts.append(rep['new_bytes'])
        parts.append(b'\x00' * rep['new_pad'])
        prev_end = rep['val_lp_off'] + rep['old_total']
    
    # Copy remaining data after last replacement
    parts.append(obj_data[prev_end:])
    
    return b''.join(parts), len(replacements)


def resize_object_lp_direct(obj_data, entries):
    """
    LP-direct replacement for level0-style objects.
    Returns (new_obj_data, replaced_count).
    """
    replacements = []
    
    for key, eng, ita in entries:
        eng_bytes = eng.encode('utf-8')
        eng_len = len(eng_bytes)
        search = struct.pack('<I', eng_len) + eng_bytes
        pos = 0
        while True:
            idx = obj_data.find(search, pos)
            if idx < 0:
                break
            
            # Safety: skip Assembly-CSharp references
            pre_start = max(0, idx - 50)
            pre = obj_data[pre_start:idx]
            if b'Assembly' in pre or b'CSharp' in pre or b'MonoBehaviour' in pre:
                pos = idx + 4 + eng_len
                continue
            
            old_pad = (4 - eng_len % 4) % 4
            ita_bytes = ita.encode('utf-8')
            new_pad = (4 - len(ita_bytes) % 4) % 4
            
            replacements.append({
                'lp_off': idx,
                'old_total': 4 + eng_len + old_pad,
                'new_lp': len(ita_bytes),
                'new_bytes': ita_bytes,
                'new_pad': new_pad,
            })
            
            pos = idx + 4 + eng_len + old_pad
    
    if not replacements:
        return obj_data, 0
    
    replacements.sort(key=lambda r: r['lp_off'])
    
    # Deduplicate overlapping replacements
    filtered = [replacements[0]]
    for r in replacements[1:]:
        prev = filtered[-1]
        if r['lp_off'] >= prev['lp_off'] + prev['old_total']:
            filtered.append(r)
    replacements = filtered
    
    parts = []
    prev_end = 0
    for rep in replacements:
        parts.append(obj_data[prev_end:rep['lp_off']])
        parts.append(struct.pack('<I', rep['new_lp']))
        parts.append(rep['new_bytes'])
        parts.append(b'\x00' * rep['new_pad'])
        prev_end = rep['lp_off'] + rep['old_total']
    parts.append(obj_data[prev_end:])
    
    return b''.join(parts), len(replacements)


# ─── Main file processing ─────────────────────────────────────────────

def process_level_file(fpath, entries, use_lp_direct=False):
    """Process a level file with resize injection."""
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath
    data = bytearray(open(source, 'rb').read())
    orig_size = len(data)
    
    header = parse_header(data)
    meta = parse_metadata(data)
    data_off = header['data_offset']
    
    # Build translation lookup patterns once
    # For each object: check if it has translatable strings, resize if needed
    all_objects = sorted(meta['objects'], key=lambda o: o['byte_off'])
    
    # Pre-build search patterns for quick filtering
    search_patterns = set()
    for key, eng, ita in entries:
        search_patterns.add(eng.encode('utf-8')[:20])
    
    resized_objects = {}  # idx -> new_obj_data
    total_replaced = 0
    
    for obj in all_objects:
        abs_off = data_off + obj['byte_off']
        obj_data = bytes(data[abs_off:abs_off + obj['byte_size']])
        
        # Quick check: does this object contain any translatable text?
        has_match = False
        for pat in search_patterns:
            if pat in obj_data:
                has_match = True
                break
        if not has_match:
            continue
        
        # Try replacement
        if use_lp_direct:
            new_data, count = resize_object_lp_direct(obj_data, entries)
        else:
            new_data, count = resize_object_keyed(obj_data, entries)
        
        if count > 0:
            resized_objects[obj['idx']] = new_data
            total_replaced += count
    
    if total_replaced == 0:
        return 0, 0
    
    # Rebuild file with resized objects
    new_file_parts = [bytes(data[:data_off])]  # metadata unchanged
    
    current_data_pos = 0
    obj_new_offsets = {}
    obj_new_sizes = {}
    
    for obj in all_objects:
        # Align to 16 bytes
        aligned_pos = align16(current_data_pos)
        pad = aligned_pos - current_data_pos
        if pad > 0:
            new_file_parts.append(b'\x00' * pad)
            current_data_pos = aligned_pos
        
        obj_new_offsets[obj['idx']] = current_data_pos
        
        if obj['idx'] in resized_objects:
            obj_bytes = resized_objects[obj['idx']]
        else:
            abs_off = data_off + obj['byte_off']
            obj_bytes = bytes(data[abs_off:abs_off + obj['byte_size']])
        
        new_file_parts.append(obj_bytes)
        obj_new_sizes[obj['idx']] = len(obj_bytes)
        current_data_pos += len(obj_bytes)
    
    new_file = bytearray(b''.join(new_file_parts))
    
    # Update object table
    for obj in meta['objects']:
        idx = obj['idx']
        tp = obj['table_pos']
        if idx in obj_new_offsets:
            struct.pack_into('<q', new_file, tp + 8, obj_new_offsets[idx])
        if idx in obj_new_sizes:
            struct.pack_into('<I', new_file, tp + 16, obj_new_sizes[idx])
    
    # Update header file_size
    write_be64(new_file, 28, len(new_file))
    
    # Write
    if not os.path.exists(backup):
        shutil.copy2(fpath, backup)
    with open(fpath, 'wb') as f:
        f.write(bytes(new_file))
    
    diff = len(new_file) - orig_size
    return total_replaced, diff


def main():
    print("=" * 60)
    print("Esoteric Ebb - Level File Resize Injector")
    print("=" * 60)
    
    entries = load_keyed_translations()
    print(f"Translations: {len(entries)}")
    
    grand_replaced = 0
    
    for fname in sorted(os.listdir(ASSETS_DIR)):
        if not fname.startswith('level') or '.' in fname:
            continue
        fpath = os.path.join(ASSETS_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        
        t0 = time.time()
        # level0 uses LP-direct, others use key-safe
        use_lp = (fname == 'level0')
        replaced, diff = process_level_file(fpath, entries, use_lp_direct=use_lp)
        elapsed = time.time() - t0
        
        if replaced > 0:
            print(f"  {fname}: {replaced} replaced, size {'+' if diff >= 0 else ''}{diff} [{elapsed:.1f}s]")
        
        grand_replaced += replaced
    
    print(f"\nTotal: {grand_replaced} replacements")
    if grand_replaced > 0:
        print("Avvia il gioco!")


if __name__ == '__main__':
    main()
