"""
Esoteric Ebb - Full resize injection.
CSV blocks are length-prefixed (4 byte LE) followed by CSV text + null + padding.
Strategy: replace each CSV block, update length prefix, shift file data,
update object table byte_start/byte_size, update header file_size.
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


def replace_english(orig_text, trans):
    lines = orig_text.split('\n')
    out = [lines[0]]
    for line in lines[1:]:
        if not line.strip(): out.append(line); continue
        r = csv.reader(io.StringIO(line))
        try: parts = list(next(r))
        except StopIteration: out.append(line); continue
        eid = parts[0].strip() if parts else ''
        if eid in trans and len(parts) > 1: parts[1] = trans[eid]
        buf = io.StringIO()
        csv.writer(buf).writerow(parts)
        out.append(buf.getvalue().rstrip('\r\n'))
    return '\n'.join(out)


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


def find_blocks(data):
    """Find all length-prefixed CSV blocks"""
    blocks = []
    pos = 0
    while pos + len(SEARCH) < len(data):
        idx = data.find(SEARCH, pos)
        if idx == -1: break
        # Check 4 bytes before for length prefix
        if idx >= 4:
            pre_len = struct.unpack_from('<I', data, idx - 4)[0]
            # Find actual end (null byte)
            end = idx
            while end < len(data) and data[end] != 0: end += 1
            csv_len = end - idx
            if pre_len == csv_len:
                # This is a properly length-prefixed CSV block
                # Calculate padded region: from length_field to next aligned boundary
                padded_len = csv_len + (4 - csv_len % 4) % 4
                try:
                    text = data[idx:end].decode('utf-8')
                    blocks.append({
                        'len_offset': idx - 4,     # offset of length field
                        'text_offset': idx,         # offset of CSV text
                        'text_end': end,            # offset of null terminator
                        'old_len': csv_len,         # original text length
                        'old_padded': padded_len,   # padded to 4-byte alignment
                        'text': text,
                    })
                except: pass
        pos = idx + 1 if idx >= 0 else len(data)
    return blocks


def main():
    print("=" * 60)
    print("Esoteric Ebb - Full Resize Injector")
    print("=" * 60)

    # Load translations
    tm = {}
    for n, f in [('uielements','uielements.csv'),('feats','feats.csv'),
                  ('questpoints','questpoints.csv'),('backgrounds','table_0.csv')]:
        t = load_trans(os.path.join(TRANS_DIR, f))
        if t: tm[n] = t; print(f"  {n}: {len(t)}")
    print(f"  Total: {sum(len(v) for v in tm.values())}")

    # Backup
    if not os.path.exists(BACKUP):
        shutil.copy2(TARGET, BACKUP)

    # Read clean backup
    with open(BACKUP, 'rb') as f:
        data = bytearray(f.read())
    orig_size = len(data)
    print(f"\nOriginal: {orig_size:,} bytes")

    # Parse header for file_size location
    version = struct.unpack_from('>I', data, 8)[0]
    data_offset = struct.unpack_from('>Q', data, 32)[0]
    print(f"Version: {version}, data_offset: {data_offset}")

    # Find object table for byte_start/byte_size updates
    pos = 48
    while pos < len(data) and data[pos] != 0: pos += 1
    pos += 1  # skip null
    pos += 4  # target_platform
    pos += 1  # type_tree_enabled
    type_count = struct.unpack_from('<I', data, pos)[0]; pos += 4
    for _ in range(type_count):
        cid = struct.unpack_from('<i', data, pos)[0]; pos += 4
        pos += 1 + 2  # is_stripped + script_type_index
        if cid == 114: pos += 16
        pos += 16
    obj_count = struct.unpack_from('<I', data, pos)[0]; pos += 4
    
    # Parse object entries (need to update byte_start after shifts)
    # v22 uses 24-byte entries: pathID(i64) + byteStart(i64) + byteSize(u32) + typeID(i32)
    is_v22 = version >= 22
    entry_size = 24 if is_v22 else 20
    obj_entries = []
    for _ in range(obj_count):
        if pos % 4 != 0: pos += 4 - (pos % 4)
        if is_v22:
            obj_entries.append({
                'offset': pos,
                'path_id': struct.unpack_from('<q', data, pos)[0],
                'byte_start_off': pos + 8,
                'byte_start': struct.unpack_from('<q', data, pos + 8)[0],
                'byte_size_off': pos + 16,
                'byte_size': struct.unpack_from('<I', data, pos + 16)[0],
            })
        else:
            obj_entries.append({
                'offset': pos,
                'path_id': struct.unpack_from('<q', data, pos)[0],
                'byte_start_off': pos + 8,
                'byte_start': struct.unpack_from('<I', data, pos + 8)[0],
                'byte_size_off': pos + 12,
                'byte_size': struct.unpack_from('<I', data, pos + 12)[0],
            })
        pos += entry_size

    print(f"Objects: {obj_count}")

    # Find CSV blocks
    blocks = find_blocks(data)
    print(f"CSV blocks: {len(blocks)}")
    for b in blocks:
        name = ident(b['text'])
        print(f"  {name or '?':15s} @ 0x{b['text_offset']:08x}, {b['old_len']} bytes")

    # Process blocks from END to START (so earlier offsets stay valid)
    blocks.sort(key=lambda b: b['text_offset'], reverse=True)
    
    total_shift = 0
    injected = 0

    for block in blocks:
        name = ident(block['text'])
        if not name or name not in tm:
            continue
        
        trans = tm[name]
        new_csv = replace_english(block['text'], trans)
        new_bytes = new_csv.encode('utf-8')
        new_len = len(new_bytes)
        new_padded = new_len + (4 - new_len % 4) % 4
        
        old_region_start = block['len_offset']      # start of 4-byte length field
        old_region_end = block['text_offset'] + block['old_padded']  # end of padded data
        old_region_size = old_region_end - old_region_start  # 4 + old_padded
        
        # New region: 4 bytes length + new_bytes + null padding to alignment
        new_region = struct.pack('<I', new_len) + new_bytes + b'\x00' * (new_padded - new_len)
        new_region_size = len(new_region)
        
        raw_size_diff = new_region_size - old_region_size
        
        # Align shift to 16 bytes for v22 (byte_start must be 16-byte aligned)
        if is_v22:
            if raw_size_diff >= 0:
                aligned_shift = ((raw_size_diff + 15) // 16) * 16
            else:
                aligned_shift = -((-raw_size_diff) // 16 * 16)
            extra_pad = aligned_shift - raw_size_diff
        else:
            aligned_shift = raw_size_diff
            extra_pad = 0
        
        # Build final region with alignment padding
        final_region = new_region + b'\x00' * extra_pad
        
        print(f"\n🔧 {name}: {block['old_len']} → {new_len} bytes (shift: {aligned_shift:+d})")
        
        # Replace region in data
        data[old_region_start:old_region_end] = final_region
        
        # Update object table: find the object containing this block
        block_abs = block['text_offset']  # absolute offset in file
        for obj in obj_entries:
            obj_abs_start = data_offset + obj['byte_start']
            obj_abs_end = obj_abs_start + obj['byte_size']
            
            if obj_abs_start <= block_abs < obj_abs_end:
                new_size = obj['byte_size'] + raw_size_diff
                struct.pack_into('<I', data, obj['byte_size_off'], new_size)
                print(f"  Updated obj byte_size: {obj['byte_size']} → {new_size}")
                obj['byte_size'] = new_size
                break
        
        # Update byte_start of all objects that come AFTER this block
        if aligned_shift != 0:
            for obj in obj_entries:
                obj_abs = data_offset + obj['byte_start']
                if obj_abs > block_abs:
                    new_start = obj['byte_start'] + aligned_shift
                    if is_v22:
                        struct.pack_into('<q', data, obj['byte_start_off'], new_start)
                    else:
                        struct.pack_into('<I', data, obj['byte_start_off'], new_start)
                    obj['byte_start'] = new_start
        
        total_shift += aligned_shift
        injected += len(trans)
        print(f"  ✅ {len(trans)} translations injected")

    # Update file_size in header
    new_file_size = orig_size + total_shift
    struct.pack_into('>Q', data, 24, new_file_size)
    print(f"\nFile size: {orig_size:,} → {new_file_size:,} ({total_shift:+,} bytes)")

    # Write
    with open(TARGET, 'wb') as f:
        f.write(data)
    print(f"Written: {TARGET}")

    print(f"\n{'='*60}")
    print(f"✅ DONE: {injected} translations, {total_shift:+,} bytes")
    print(f"🎮 Avvia il gioco - il testo inglese è ora in italiano!")


if __name__ == '__main__':
    main()
