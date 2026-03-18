"""
Resize injection test for Unity SerializedFile v22.
Tests on sharedassets0.assets which has exactly 1 Ink blob.
Strategy: grow the Ink JSON blob, fix LP + object table + header.
"""
import struct, os, shutil, copy

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
TARGET = "sharedassets0.assets"

def read_be64(data, off):
    """Read 64-bit value stored as [lo32_BE][hi32_BE]."""
    lo = struct.unpack('>I', data[off:off+4])[0]
    hi = struct.unpack('>I', data[off+4:off+8])[0]
    return lo | (hi << 32)

def write_be64(data, off, val):
    """Write 64-bit value as [lo32_BE][hi32_BE]."""
    lo = val & 0xFFFFFFFF
    hi = (val >> 32) & 0xFFFFFFFF
    struct.pack_into('>I', data, off, lo)
    struct.pack_into('>I', data, off+4, hi)

def align16(x):
    return (x + 15) & ~15

def parse_header(data):
    """Parse Unity SerializedFile v22 header."""
    version = struct.unpack('>I', data[8:12])[0]
    assert version == 22, f"Expected v22, got {version}"
    
    meta_size = read_be64(data, 20)
    file_size = read_be64(data, 28)
    data_offset = read_be64(data, 36)
    
    return {
        'version': version,
        'meta_size': meta_size,
        'file_size': file_size,
        'data_offset': data_offset,
    }

def parse_metadata(data, header):
    """Parse metadata: types and object table."""
    pos = 48  # after header
    
    # Unity version string
    end = data.index(b'\x00', pos)
    unity_ver = data[pos:end].decode('utf-8')
    pos = end + 1
    
    # Platform (u32 LE)
    platform = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    
    # Has type tree (u8)
    has_types = data[pos]
    pos += 1
    assert has_types == 0, "Type tree not supported"
    
    # Type count
    type_count = struct.unpack_from('<i', data, pos)[0]
    pos += 4
    
    # Parse type entries
    type_classes = []
    for i in range(type_count):
        class_id = struct.unpack_from('<i', data, pos)[0]
        pos += 4
        pos += 1  # is_stripped
        pos += 2  # script_type_index
        if class_id == 114 or class_id < 0:
            pos += 16  # script_id_hash
        pos += 16  # old_type_hash
        type_classes.append(class_id)
    
    # Object count
    obj_count = struct.unpack_from('<i', data, pos)[0]
    pos += 4
    
    # Align to 4 bytes
    if pos % 4 != 0:
        pos += 4 - (pos % 4)
    
    obj_table_offset = pos
    
    # Parse objects
    objects = []
    for i in range(obj_count):
        path_id = struct.unpack_from('<q', data, pos)[0]
        byte_off = struct.unpack_from('<q', data, pos + 8)[0]
        byte_size = struct.unpack_from('<I', data, pos + 16)[0]
        type_idx = struct.unpack_from('<i', data, pos + 20)[0]
        objects.append({
            'idx': i,
            'table_pos': pos,
            'path_id': path_id,
            'byte_off': byte_off,
            'byte_size': byte_size,
            'type_idx': type_idx,
            'class_id': type_classes[type_idx] if 0 <= type_idx < len(type_classes) else -1,
        })
        pos += 24
    
    # After objects: script references count + externals count + ...
    after_objects_pos = pos
    
    return {
        'unity_ver': unity_ver,
        'type_classes': type_classes,
        'objects': objects,
        'obj_table_offset': obj_table_offset,
        'after_objects_pos': after_objects_pos,
    }

def find_ink_objects(data, header, meta):
    """Find objects containing Ink JSON blobs."""
    ink_objs = []
    data_off = header['data_offset']
    for obj in meta['objects']:
        abs_off = data_off + obj['byte_off']
        if obj['byte_size'] > 100:
            # Check for inkVersion in first 200 bytes  
            chunk = data[abs_off:abs_off + min(200, obj['byte_size'])]
            if b'inkVersion' in chunk:
                ink_objs.append(obj)
    return ink_objs

def main():
    fpath = os.path.join(ASSETS_DIR, TARGET)
    backup = fpath + ".backup"
    
    # Always start from clean backup
    if not os.path.exists(backup):
        print("ERROR: No backup found!")
        return
    
    data = bytearray(open(backup, 'rb').read())
    orig_size = len(data)
    print(f"File: {TARGET} ({orig_size} bytes)")
    
    header = parse_header(data)
    meta = parse_metadata(data, header)
    ink_objs = find_ink_objects(data, header, meta)
    
    print(f"Objects: {len(meta['objects'])}, Ink blobs: {len(ink_objs)}")
    
    if len(ink_objs) != 1:
        print("Expected exactly 1 Ink blob for test!")
        return
    
    ink = ink_objs[0]
    data_off = header['data_offset']
    abs_off = data_off + ink['byte_off']
    
    # Parse the Ink object structure: LP(name) + name + pad + LP(json) + json
    name_lp = struct.unpack_from('<I', data, abs_off)[0]
    name = data[abs_off+4:abs_off+4+name_lp].decode('utf-8')
    name_pad = (4 - name_lp % 4) % 4
    json_lp_off = abs_off + 4 + name_lp + name_pad
    json_lp = struct.unpack_from('<I', data, json_lp_off)[0]
    json_start = json_lp_off + 4
    json_end = json_start + json_lp
    
    print(f"\nInk object: {name}")
    print(f"  obj[{ink['idx']}] pathID={ink['path_id']} byte_off={ink['byte_off']} byte_size={ink['byte_size']}")
    print(f"  JSON LP: {json_lp} bytes, abs range: [{json_start}, {json_end})")
    
    # === RESIZE TEST ===
    # Add 32 bytes to the JSON (append spaces before closing })
    EXTRA = 32  # Actual resize test
    
    # Find the last } in JSON
    last_brace = json_end - 1
    while last_brace > json_start and data[last_brace] != ord('}'):
        last_brace -= 1
    
    # Insert EXTRA spaces before the closing brace
    new_json = bytes(data[json_start:last_brace]) + b' ' * EXTRA + bytes(data[last_brace:json_end])
    new_json_lp = len(new_json)
    
    print(f"\n=== RESIZE TEST ===")
    print(f"  Original JSON: {json_lp} bytes")
    print(f"  New JSON:      {new_json_lp} bytes (+{EXTRA})")
    
    # Calculate new object size (include LP-alignment padding for JSON)
    json_pad = (4 - new_json_lp % 4) % 4
    overhead = 4 + name_lp + name_pad + 4  # LP(name) + name + pad + LP(json)
    new_obj_size = overhead + new_json_lp + json_pad
    old_obj_aligned_end = data_off + ink['byte_off'] + align16(ink['byte_size'])
    new_obj_aligned_end = data_off + ink['byte_off'] + align16(new_obj_size)
    
    shift = align16(new_obj_size) - align16(ink['byte_size'])
    print(f"  Old obj size: {ink['byte_size']}, aligned end: {old_obj_aligned_end}")
    print(f"  New obj size: {new_obj_size} (json_pad={json_pad}), aligned end: {new_obj_aligned_end}")  
    print(f"  Shift for subsequent objects: {shift}")
    
    # Build new file
    # Part 1: everything before the JSON content
    new_data = bytearray(data[:json_start])
    
    # Part 2: new JSON content + LP-alignment padding
    new_data.extend(new_json)
    new_data.extend(b'\x00' * json_pad)
    
    # Part 3: padding to align the next object to 16 bytes
    next_aligned = align16(ink['byte_off'] + new_obj_size)
    pad_needed = (data_off + next_aligned) - len(new_data)
    if pad_needed > 0:
        new_data.extend(b'\x00' * pad_needed)
    
    # Part 4: everything after the old object (shifted)
    old_next_start = data_off + align16(ink['byte_off'] + ink['byte_size'])
    new_data.extend(data[old_next_start:])
    
    print(f"  Old next obj start: {old_next_start}")
    print(f"  New next obj start: {data_off + next_aligned}")
    print(f"  New file size: {len(new_data)} (was {orig_size}, diff={len(new_data)-orig_size})")
    
    # Update JSON LP
    struct.pack_into('<I', new_data, json_lp_off, new_json_lp)
    
    # Update object table: byte_size for ink object
    struct.pack_into('<I', new_data, ink['table_pos'] + 16, new_obj_size)
    
    # Update object table: shift all subsequent objects
    shifted_count = 0
    for obj in meta['objects']:
        if obj['byte_off'] > ink['byte_off']:
            new_off = obj['byte_off'] + shift
            struct.pack_into('<q', new_data, obj['table_pos'] + 8, new_off)
            shifted_count += 1
    print(f"  Shifted {shifted_count} subsequent objects by {shift}")
    
    # Update header: file_size
    new_file_size = len(new_data)
    write_be64(new_data, 28, new_file_size)
    
    # Also update the old header field (bytes 4-7) if non-zero
    # (In v22 they're 0, but let's be safe)
    
    print(f"  Updated header file_size: {new_file_size}")
    
    # Verify: check that the Ink blob is valid
    verify_lp = struct.unpack_from('<I', new_data, json_lp_off)[0]
    verify_start = json_lp_off + 4
    verify_json = new_data[verify_start:verify_start+30]
    print(f"\n=== VERIFICATION ===")
    print(f"  JSON LP after update: {verify_lp}")
    print(f"  JSON start: {verify_json}")
    
    # Write output
    with open(fpath, 'wb') as f:
        f.write(bytes(new_data))
    
    print(f"\nWrote {new_file_size} bytes to {TARGET}")
    print(f"Avvia il gioco per testare!")

if __name__ == '__main__':
    main()
