"""Test resize injection on a single small file (sharedassets5) to validate."""
import struct, os, csv, shutil, sys
sys.path.insert(0, os.path.dirname(__file__))
from inject_ink_resize import load_translations, parse_unity_header, find_ink_blobs, replace_strings_in_blob

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
TEST_FILE = "sharedassets5.assets"

def validate_file(fpath, label=""):
    """Validate Unity file structure after modification."""
    data = open(fpath, 'rb').read()
    header = parse_unity_header(data)
    do = header['data_offset']
    objs = header['obj_entries']
    
    print(f"\n  [{label}] file_size_header={header['file_size_raw']}, actual={len(data)}, "
          f"match={header['file_size_raw'] == len(data)}")
    
    errors = 0
    for i, obj in enumerate(objs):
        abs_start = do + obj['byte_start']
        abs_end = abs_start + obj['byte_size']
        if abs_end > len(data):
            print(f"  ERROR obj[{i}]: pathid={obj['path_id']}, abs_end={abs_end} > file_size={len(data)}")
            errors += 1
        if obj['byte_start'] < 0:
            print(f"  ERROR obj[{i}]: negative byte_start={obj['byte_start']}")
            errors += 1
    
    # Check overlapping objects
    sorted_objs = sorted(objs, key=lambda o: o['byte_start'])
    for i in range(len(sorted_objs) - 1):
        end_i = sorted_objs[i]['byte_start'] + sorted_objs[i]['byte_size']
        start_next = sorted_objs[i+1]['byte_start']
        if end_i > start_next and sorted_objs[i]['byte_size'] > 0:
            # Check if they overlap (allowing for alignment gaps)
            if end_i > start_next + 16:  # Allow 16 bytes for alignment
                print(f"  WARNING: obj pathid={sorted_objs[i]['path_id']} "
                      f"(end={end_i}) overlaps obj pathid={sorted_objs[i+1]['path_id']} "
                      f"(start={start_next})")
    
    if errors == 0:
        print(f"  All {len(objs)} objects valid!")
    else:
        print(f"  {errors} ERRORS found!")
    return errors == 0


def main():
    fpath = os.path.join(ASSETS_DIR, TEST_FILE)
    backup = fpath + ".backup"
    
    # Restore from backup first
    if os.path.exists(backup):
        shutil.copy2(backup, fpath)
        print(f"Restored {TEST_FILE} from backup")
    
    # Validate original
    print("\n=== BEFORE resize ===")
    validate_file(fpath, "original")
    
    # Load translations
    trans = load_translations()
    sorted_trans = sorted(trans.items(), key=lambda x: len(x[0]), reverse=True)
    print(f"Translations: {len(trans)}")
    
    # Read file
    data = bytearray(open(fpath, 'rb').read())
    orig_size = len(data)
    
    # Parse header
    header = parse_unity_header(data)
    data_offset = header['data_offset']
    obj_entries = header['obj_entries']
    is_v22 = header['is_v22']
    
    # Find blobs
    blobs = find_ink_blobs(data)
    print(f"Ink blobs: {len(blobs)}")
    
    # Sort end to start
    blobs.sort(key=lambda b: b['lp_off'], reverse=True)
    
    total_replaced = 0
    total_shift = 0
    
    for blob in blobs:
        lp_off = blob['lp_off']
        content_start = blob['content_start']
        old_len = blob['old_len']
        old_padded = blob['old_padded']
        
        old_content = bytes(data[content_start:content_start + old_len])
        new_content, count = replace_strings_in_blob(old_content, sorted_trans)
        if count == 0:
            continue
        
        new_len = len(new_content)
        new_padded = new_len + (4 - new_len % 4) % 4
        
        old_region_start = lp_off
        old_region_end = content_start + old_padded
        old_region_size = old_region_end - old_region_start
        
        new_region = struct.pack('<I', new_len) + new_content + b'\x00' * (new_padded - new_len)
        new_region_size = len(new_region)
        size_diff = new_region_size - old_region_size
        
        print(f"\n  Blob @{lp_off}: {old_len} -> {new_len} bytes, {count} replaced, diff={size_diff:+d}")
        
        # Replace
        data[old_region_start:old_region_end] = new_region
        
        # Find containing object
        blob_abs = content_start
        found_obj = False
        for obj in obj_entries:
            obj_abs_start = data_offset + obj['byte_start']
            obj_abs_end = obj_abs_start + obj['byte_size']
            if obj_abs_start <= blob_abs < obj_abs_end:
                old_size = obj['byte_size']
                new_size = old_size + size_diff
                struct.pack_into('<I', data, obj['byte_size_off'], new_size)
                obj['byte_size'] = new_size
                print(f"    Updated obj pathid={obj['path_id']} byte_size: {old_size} -> {new_size}")
                found_obj = True
                break
        if not found_obj:
            print(f"    WARNING: no containing object found!")
        
        # Update byte_start of objects AFTER
        if size_diff != 0:
            shifted = 0
            for obj in obj_entries:
                obj_abs = data_offset + obj['byte_start']
                if obj_abs > blob_abs:
                    new_start = obj['byte_start'] + size_diff
                    if is_v22:
                        struct.pack_into('<q', data, obj['byte_start_off'], new_start)
                    else:
                        struct.pack_into('<I', data, obj['byte_start_off'], new_start)
                    obj['byte_start'] = new_start
                    shifted += 1
            print(f"    Shifted {shifted} objects by {size_diff:+d}")
        
        total_replaced += count
        total_shift += size_diff
    
    # Update file_size
    new_file_size = orig_size + total_shift
    if is_v22:
        struct.pack_into('>Q', data, 24, new_file_size)
    else:
        struct.pack_into('>I', data, 4, new_file_size)
    
    print(f"\nFile size: {orig_size} -> {new_file_size} ({total_shift:+d})")
    print(f"Total replaced: {total_replaced}")
    
    # Write
    with open(fpath, 'wb') as f:
        f.write(bytes(data))
    
    # Validate modified file
    print("\n=== AFTER resize ===")
    valid = validate_file(fpath, "modified")
    
    if valid:
        print("\n✅ Validation PASSED! Try launching the game.")
    else:
        print("\n❌ Validation FAILED! Restoring backup...")
        shutil.copy2(backup, fpath)
        print("Backup restored.")


if __name__ == '__main__':
    main()
