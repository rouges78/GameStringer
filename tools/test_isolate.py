"""
Isolate what breaks sharedassets5 after resize.
Test A: Append 16 bytes + update file_size only (no obj table, no content)
Test B: Only change blob content in-place (no resize, no structural changes)
Test C: Change blob content + LP + byte_size (no file resize, keep same boundaries)
"""
import struct, os, shutil, sys
sys.path.insert(0, os.path.dirname(__file__))
from inject_ink_resize import load_translations, parse_unity_header, find_ink_blobs, replace_strings_in_blob

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
TEST_FILE = "sharedassets5.assets"

def restore():
    fpath = os.path.join(ASSETS_DIR, TEST_FILE)
    backup = fpath + ".backup"
    shutil.copy2(backup, fpath)
    return fpath

def test_a():
    """Append 16 null bytes at end + update file_size. No other changes."""
    print("\n=== TEST A: append 16 bytes + update file_size ===")
    fpath = restore()
    data = bytearray(open(fpath, 'rb').read())
    old_size = len(data)
    data += b'\x00' * 16
    # Update file_size at offset 24 (BE u64 for v22)
    struct.pack_into('>Q', data, 24, old_size + 16)
    with open(fpath, 'wb') as f:
        f.write(bytes(data))
    print(f"  Written: {old_size} -> {len(data)} (+16)")
    print("  >>> Prova ad avviare il gioco, poi premi INVIO <<<")
    input()

def test_b():
    """In-place content change only — no LP, no byte_size, no resize."""
    print("\n=== TEST B: in-place content change (single replacement) ===")
    fpath = restore()
    data = bytearray(open(fpath, 'rb').read())
    # Find a short string to replace in-place
    marker = b'"Hello"'
    pos = data.find(marker)
    if pos >= 0:
        data[pos:pos+len(marker)] = b'"Ciao!"'
        with open(fpath, 'wb') as f:
            f.write(bytes(data))
        print(f"  Replaced 'Hello' -> 'Ciao!' at offset {pos}")
    else:
        # Try a known Ink string
        blobs = find_ink_blobs(data)
        trans = load_translations()
        sorted_trans = sorted(trans.items(), key=lambda x: len(x[0]), reverse=True)
        blob = blobs[0]
        old_content = bytes(data[blob['content_start']:blob['content_start'] + blob['old_len']])
        # Find first replacement that's same length or shorter
        for eng, ita in sorted_trans:
            if eng.encode('utf-8') in old_content and len(ita) <= len(eng):
                old_b = eng.encode('utf-8')
                new_b = ita.encode('utf-8').ljust(len(old_b), b' ')
                pos = data.find(old_b, blob['content_start'])
                if pos >= 0:
                    data[pos:pos+len(old_b)] = new_b
                    with open(fpath, 'wb') as f:
                        f.write(bytes(data))
                    print(f"  Replaced '{eng[:40]}' in-place at {pos}")
                    break
    print("  >>> Prova ad avviare il gioco, poi premi INVIO <<<")
    input()

def test_c_filesize_only():
    """Check: is the header file_size field at the right offset?"""
    print("\n=== TEST C: verify header fields ===")
    fpath = restore()
    data = open(fpath, 'rb').read()
    
    # Dump first 48 bytes as hex
    print("  Header (48 bytes):")
    for i in range(0, 48, 4):
        val_be = struct.unpack_from('>I', data, i)[0]
        val_le = struct.unpack_from('<I', data, i)[0]
        raw = data[i:i+4].hex()
        print(f"    [{i:2d}] {raw}  BE={val_be:>12d}  LE={val_le:>12d}")
    
    # v22 fields
    meta_size = struct.unpack_from('<I', data, 20)[0]
    file_size = struct.unpack_from('>Q', data, 24)[0]
    data_off = struct.unpack_from('>Q', data, 32)[0]
    print(f"\n  v22: metadata_size={meta_size}, file_size={file_size} (actual={len(data)}), data_offset={data_off}")
    
    # Also check if file_size might be LE
    file_size_le = struct.unpack_from('<Q', data, 24)[0]
    print(f"  file_size as LE u64: {file_size_le}")
    
    # What about offset 40?
    unk40 = struct.unpack_from('>Q', data, 40)[0]
    unk40_le = struct.unpack_from('<Q', data, 40)[0]
    print(f"  [40] unknown: BE={unk40}, LE={unk40_le}")

def test_d():
    """MINIMAL resize: expand one blob by exactly 16 bytes (add spaces to JSON)."""
    print("\n=== TEST D: minimal +16 byte resize on one blob ===")
    fpath = restore()
    data = bytearray(open(fpath, 'rb').read())
    orig_size = len(data)
    header = parse_unity_header(data)
    do = header['data_offset']
    objs = header['obj_entries']
    is_v22 = header['is_v22']
    
    blobs = find_ink_blobs(data)
    # Pick the LAST blob (highest offset)
    blob = max(blobs, key=lambda b: b['lp_off'])
    
    lp_off = blob['lp_off']
    cs = blob['content_start']
    old_len = blob['old_len']
    old_padded = blob['old_padded']
    
    # Add 12 spaces at end of blob (before closing })
    old_content = bytes(data[cs:cs + old_len])
    # Find last }
    last_brace = old_content.rfind(b'}')
    new_content = old_content[:last_brace] + b'            ' + old_content[last_brace:]  # +12 bytes
    new_len = len(new_content)
    new_padded = new_len + (4 - new_len % 4) % 4
    
    old_region_start = lp_off
    old_region_end = cs + old_padded
    old_region_size = old_region_end - old_region_start
    
    new_region_4pad = struct.pack('<I', new_len) + new_content + b'\x00' * (new_padded - new_len)
    raw_diff = len(new_region_4pad) - old_region_size
    aligned_shift = ((raw_diff + 15) // 16) * 16
    extra_pad = aligned_shift - raw_diff
    new_region = new_region_4pad + b'\x00' * extra_pad
    
    print(f"  Blob @{lp_off}: {old_len} -> {new_len} (+{new_len-old_len})")
    print(f"  raw_diff={raw_diff}, aligned_shift={aligned_shift}, extra_pad={extra_pad}")
    
    data[old_region_start:old_region_end] = new_region
    
    # Update byte_size
    blob_abs = cs
    for obj in objs:
        obj_start = do + obj['byte_start']
        obj_end = obj_start + obj['byte_size']
        if obj_start <= blob_abs < obj_end:
            new_bsz = obj['byte_size'] + raw_diff
            struct.pack_into('<I', data, obj['byte_size_off'], new_bsz)
            print(f"  obj pathid={obj['path_id']}: byte_size {obj['byte_size']} -> {new_bsz}")
            obj['byte_size'] = new_bsz
            break
    
    # Shift subsequent objects
    shifted = 0
    for obj in objs:
        if do + obj['byte_start'] > blob_abs:
            new_bs = obj['byte_start'] + aligned_shift
            if is_v22:
                struct.pack_into('<q', data, obj['byte_start_off'], new_bs)
            else:
                struct.pack_into('<I', data, obj['byte_start_off'], new_bs)
            obj['byte_start'] = new_bs
            shifted += 1
    print(f"  Shifted {shifted} objects by {aligned_shift}")
    
    # Update file_size
    new_size = orig_size + aligned_shift
    struct.pack_into('>Q', data, 24, new_size)
    print(f"  file_size: {orig_size} -> {new_size}")
    
    # Verify alignment
    for obj in objs:
        if obj['byte_start'] % 16 != 0:
            print(f"  ALIGN ERROR: pathid={obj['path_id']} bs={obj['byte_start']} %16={obj['byte_start']%16}")
    
    with open(fpath, 'wb') as f:
        f.write(bytes(data))
    print(f"  Written {len(data)} bytes")
    print("  >>> Prova ad avviare il gioco, poi premi INVIO <<<")
    input()


# Run tests
test_c_filesize_only()  # Just inspect header
test_a()  # Append + file_size
