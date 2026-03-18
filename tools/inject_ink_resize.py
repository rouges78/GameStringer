"""
Esoteric Ebb - Ink injection with RESIZE.
Finds Ink JSON blobs (length-prefixed), replaces strings inside them,
then resizes the blob and updates Unity SerializedFile structures:
  - Length prefix of the blob
  - Object table byte_start / byte_size
  - Header file_size
Processes files from END to START to keep earlier offsets valid.
Zero truncation - Italian text can be any length.
"""
import struct, os, csv, shutil, time, sys

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


def parse_unity_header(data):
    """Parse Unity SerializedFile header and object table."""
    # Header
    metadata_size = struct.unpack_from('>I', data, 0)[0]
    file_size_raw = struct.unpack_from('>I', data, 4)[0]
    version = struct.unpack_from('>I', data, 8)[0]
    data_offset = struct.unpack_from('>I', data, 12)[0]

    # Version >= 22 uses 64-bit fields
    is_v22 = version >= 22
    if is_v22:
        file_size_raw = struct.unpack_from('>Q', data, 24)[0]
        data_offset = struct.unpack_from('>Q', data, 32)[0]

    # Skip unity version string
    pos = 48 if is_v22 else 20
    while pos < len(data) and data[pos] != 0:
        pos += 1
    pos += 1  # skip null

    # target_platform (4), type_tree_enabled (1)
    pos += 4 + 1

    # Type tree
    type_count = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    for _ in range(type_count):
        cid = struct.unpack_from('<i', data, pos)[0]
        pos += 4
        pos += 1 + 2  # is_stripped + script_type_index
        if cid == 114:
            pos += 16  # script_id hash
        pos += 16  # old_type_hash

    # Object table
    obj_count = struct.unpack_from('<I', data, pos)[0]
    pos += 4

    obj_entries = []
    # v22 uses 24-byte entries: pathID(i64) + byteStart(i64) + byteSize(u32) + typeID(i32)
    # pre-v22 uses 20-byte entries: pathID(i64) + byteStart(u32) + byteSize(u32) + typeID(i32)
    entry_size = 24 if is_v22 else 20
    for _ in range(obj_count):
        if pos % 4 != 0:
            pos += 4 - (pos % 4)
        if is_v22:
            obj_entries.append({
                'offset': pos,
                'path_id': struct.unpack_from('<q', data, pos)[0],
                'byte_start_off': pos + 8,
                'byte_start': struct.unpack_from('<q', data, pos + 8)[0],  # i64 for v22
                'byte_size_off': pos + 16,
                'byte_size': struct.unpack_from('<I', data, pos + 16)[0],
            })
        else:
            obj_entries.append({
                'offset': pos,
                'path_id': struct.unpack_from('<q', data, pos)[0],
                'byte_start_off': pos + 8,
                'byte_start': struct.unpack_from('<I', data, pos + 8)[0],  # u32 for pre-v22
                'byte_size_off': pos + 12,
                'byte_size': struct.unpack_from('<I', data, pos + 12)[0],
            })
        pos += entry_size

    return {
        'version': version,
        'is_v22': is_v22,
        'data_offset': data_offset,
        'obj_entries': obj_entries,
        'file_size_raw': file_size_raw,
    }


def find_ink_blobs(data):
    """Find all Ink JSON blobs with their LP boundaries."""
    blobs = []
    seen = set()
    idx = 0
    while True:
        idx = data.find(INK_MARKER, idx)
        if idx < 0:
            break
        # Scan backward for opening {
        json_start = -1
        for back in range(1, 200):
            off = idx - back
            if off < 0:
                break
            if data[off] == ord('{'):
                json_start = off
                break
        if json_start is not None and json_start >= 4:
            # Find the length prefix
            for lp_back in range(0, 20):
                lp_off = json_start - 4 - lp_back
                if lp_off < 0:
                    continue
                lp = struct.unpack_from('<I', data, lp_off)[0]
                blob_content_start = lp_off + 4
                blob_end = blob_content_start + lp
                if lp >= 100 and blob_end <= len(data) and blob_content_start <= json_start and blob_end > idx:
                    key = lp_off
                    if key not in seen:
                        seen.add(key)
                        # Calculate padded size (Unity aligns to 4 bytes)
                        padded_len = lp + (4 - lp % 4) % 4
                        blobs.append({
                            'lp_off': lp_off,           # offset of 4-byte length field
                            'content_start': blob_content_start,  # start of blob data
                            'old_len': lp,               # original content length
                            'old_padded': padded_len,    # padded to 4 alignment
                        })
                    break
        idx += 1
    return blobs


def replace_strings_in_blob(blob_bytes, sorted_trans):
    """Replace all translatable strings in a blob. Returns new bytes and count."""
    replaced = 0
    text = blob_bytes

    for en, it in sorted_trans:
        en_b = en.encode('utf-8')
        it_b = it.encode('utf-8')
        count = 0
        new_text = bytearray()
        i = 0
        while i < len(text):
            found = text.find(en_b, i)
            if found < 0:
                new_text.extend(text[i:])
                break
            new_text.extend(text[i:found])
            new_text.extend(it_b)
            count += 1
            i = found + len(en_b)
        if count > 0:
            text = bytes(new_text)
            replaced += count

    return text, replaced


def process_file(fpath, sorted_trans):
    """Process a single Unity assets file with resize injection."""
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath
    data = bytearray(open(source, 'rb').read())
    orig_size = len(data)

    # Find Ink blobs
    blobs = find_ink_blobs(data)
    if not blobs:
        return 0, 0, 0, 0

    # Parse Unity header
    try:
        header = parse_unity_header(data)
    except Exception as e:
        print(f"    Warning: header parse failed ({e}), skipping resize for this file")
        return 0, 0, 0, 0

    data_offset = header['data_offset']
    obj_entries = header['obj_entries']
    is_v22 = header['is_v22']

    # Sort blobs from END to START
    blobs.sort(key=lambda b: b['lp_off'], reverse=True)

    total_replaced = 0
    total_shift = 0

    for blob in blobs:
        lp_off = blob['lp_off']
        content_start = blob['content_start']
        old_len = blob['old_len']
        old_padded = blob['old_padded']

        # Extract blob content
        old_content = bytes(data[content_start:content_start + old_len])

        # Replace strings (no truncation!)
        new_content, count = replace_strings_in_blob(old_content, sorted_trans)
        if count == 0:
            continue

        new_len = len(new_content)
        new_padded = new_len + (4 - new_len % 4) % 4

        # Old region: LP(4) + content + null padding to alignment
        old_region_start = lp_off
        old_region_end = content_start + old_padded
        old_region_size = old_region_end - old_region_start

        # New region: LP(4) + new_content + null padding (4-byte)
        new_region_4pad = struct.pack('<I', new_len) + new_content + b'\x00' * (new_padded - new_len)
        raw_size_diff = len(new_region_4pad) - old_region_size

        # Unity v22 requires byte_start to be 16-byte aligned.
        # Ensure shift is a multiple of 16 by adding inter-object gap padding.
        if raw_size_diff >= 0:
            aligned_shift = ((raw_size_diff + 15) // 16) * 16
        else:
            # Round toward zero (less negative)
            aligned_shift = -((-raw_size_diff) // 16 * 16)
        extra_pad = aligned_shift - raw_size_diff

        # Build final region: blob data + alignment padding (gap bytes)
        new_region = new_region_4pad + b'\x00' * extra_pad

        # Replace region in data
        data[old_region_start:old_region_end] = new_region

        # Update object table: byte_size changes by raw_size_diff only
        # (extra_pad bytes are in the inter-object gap, not part of byte_size)
        blob_abs = content_start
        for obj in obj_entries:
            obj_abs_start = data_offset + obj['byte_start']
            obj_abs_end = obj_abs_start + obj['byte_size']

            if obj_abs_start <= blob_abs < obj_abs_end:
                new_size = obj['byte_size'] + raw_size_diff
                struct.pack_into('<I', data, obj['byte_size_off'], new_size)  # byteSize always u32
                obj['byte_size'] = new_size
                break

        # Shift byte_start of objects AFTER this blob by aligned amount (multiple of 16)
        if aligned_shift != 0:
            for obj in obj_entries:
                obj_abs = data_offset + obj['byte_start']
                if obj_abs > blob_abs:
                    new_start = obj['byte_start'] + aligned_shift
                    if header['is_v22']:
                        struct.pack_into('<q', data, obj['byte_start_off'], new_start)
                    else:
                        struct.pack_into('<I', data, obj['byte_start_off'], new_start)
                    obj['byte_start'] = new_start

        total_replaced += count
        total_shift += aligned_shift

    # Update file_size in header
    if total_shift != 0:
        new_file_size = orig_size + total_shift
        if is_v22:
            struct.pack_into('>Q', data, 24, new_file_size)
        else:
            struct.pack_into('>I', data, 4, new_file_size)

    # Write output
    if total_replaced > 0:
        if not os.path.exists(backup):
            shutil.copy2(fpath, backup)
        with open(fpath, 'wb') as f:
            f.write(bytes(data))

    return len(blobs), total_replaced, 0, total_shift


def main():
    print("=" * 60)
    print("Ink Injection with RESIZE (zero truncation)")
    print("=" * 60)

    trans = load_translations()
    print(f"Translations loaded: {len(trans)}")
    sorted_trans = sorted(trans.items(), key=lambda x: len(x[0]), reverse=True)

    grand_blobs = 0
    grand_replaced = 0
    grand_shift = 0

    # Process all sharedassets
    for f in sorted(os.listdir(ASSETS_DIR)):
        if not f.startswith('sharedassets') or not f.endswith('.assets') or f.endswith('.backup'):
            continue
        fpath = os.path.join(ASSETS_DIR, f)
        t0 = time.time()
        blobs, r, _, shift = process_file(fpath, sorted_trans)
        elapsed = time.time() - t0
        if blobs > 0:
            print(f"  {f}: {blobs} blobs, {r} replaced, {shift:+,} bytes [{elapsed:.1f}s]")
        grand_blobs += blobs
        grand_replaced += r
        grand_shift += shift

    # Process level files
    for i in range(25):
        fname = f"level{i}"
        fpath = os.path.join(ASSETS_DIR, fname)
        if not os.path.exists(fpath):
            continue
        t0 = time.time()
        blobs, r, _, shift = process_file(fpath, sorted_trans)
        elapsed = time.time() - t0
        if blobs > 0:
            print(f"  {fname}: {blobs} blobs, {r} replaced, {shift:+,} bytes [{elapsed:.1f}s]")
        grand_blobs += blobs
        grand_replaced += r
        grand_shift += shift

    print(f"\n{'='*60}")
    print(f"Total: {grand_blobs} blobs, {grand_replaced} replaced")
    print(f"File size change: {grand_shift:+,} bytes")
    print(f"Truncated: 0 (ZERO!)")
    print(f"\nAvvia il gioco!")


if __name__ == '__main__':
    main()
