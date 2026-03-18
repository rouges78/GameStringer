"""Debug: parse object table from sharedassets5 and validate."""
import struct

def parse_and_validate(fpath):
    data = open(fpath, 'rb').read()
    print(f"\n=== {fpath.split(chr(92))[-1]} ({len(data):,} bytes) ===")

    version = struct.unpack_from('>I', data, 8)[0]
    is_v22 = version >= 22
    print(f"Version: {version}")

    if is_v22:
        file_size = struct.unpack_from('>Q', data, 24)[0]
        data_offset = struct.unpack_from('>Q', data, 32)[0]
    else:
        file_size = struct.unpack_from('>I', data, 4)[0]
        data_offset = struct.unpack_from('>I', data, 12)[0]

    print(f"file_size: {file_size}, data_offset: {data_offset}")
    print(f"Actual size: {len(data)}, match: {file_size == len(data)}")

    # Unity version string starts at offset 48
    pos = 48
    ver_str = ""
    while pos < len(data) and data[pos] != 0:
        ver_str += chr(data[pos])
        pos += 1
    pos += 1  # skip null
    print(f"Unity version: '{ver_str}' (ends at {pos})")

    # target_platform (4 bytes LE)
    target_platform = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    print(f"target_platform: {target_platform}")

    # type_tree_enabled (1 byte)
    type_tree_enabled = data[pos]
    pos += 1
    print(f"type_tree_enabled: {type_tree_enabled}")

    # Type tree entries
    type_count = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    print(f"type_count: {type_count}")

    for i in range(type_count):
        cid = struct.unpack_from('<i', data, pos)[0]
        pos += 4
        is_stripped = data[pos]
        pos += 1
        script_type_index = struct.unpack_from('<H', data, pos)[0]
        pos += 2
        if cid == 114:
            pos += 16  # script_id hash
        old_type_hash = data[pos:pos+16].hex()
        pos += 16
        if i < 5:
            print(f"  type[{i}]: classID={cid}, stripped={is_stripped}, scriptIdx={script_type_index}")

    if type_count > 5:
        print(f"  ... ({type_count - 5} more types)")

    # Object table
    obj_count = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    print(f"\nobj_count: {obj_count}")

    objs = []
    for i in range(obj_count):
        if pos % 4 != 0:
            pos += 4 - (pos % 4)
        path_id = struct.unpack_from('<q', data, pos)[0]
        byte_start = struct.unpack_from('<I', data, pos + 8)[0]
        byte_size = struct.unpack_from('<I', data, pos + 12)[0]
        type_id = struct.unpack_from('<i', data, pos + 16)[0]
        objs.append({
            'path_id': path_id,
            'byte_start': byte_start,
            'byte_size': byte_size,
            'type_id': type_id,
            'abs_start': data_offset + byte_start,
            'abs_end': data_offset + byte_start + byte_size,
        })
        pos += 20

    # Validate objects
    print(f"\nObjects (first 10):")
    for i, obj in enumerate(objs[:10]):
        in_bounds = obj['abs_end'] <= len(data)
        print(f"  obj[{i}]: pathid={obj['path_id']}, start={obj['byte_start']}, size={obj['byte_size']}, "
              f"type={obj['type_id']}, abs=[{obj['abs_start']}..{obj['abs_end']}] {'OK' if in_bounds else 'OUT OF BOUNDS!'}")

    # Check which objects contain inkVersion
    ink_marker = b'inkVersion'
    idx = 0
    ink_positions = []
    while True:
        idx = data.find(ink_marker, idx)
        if idx < 0:
            break
        ink_positions.append(idx)
        idx += 1

    print(f"\nInk markers found: {len(ink_positions)}")
    for ink_pos in ink_positions[:5]:
        containing_obj = None
        for obj in objs:
            if obj['abs_start'] <= ink_pos < obj['abs_end']:
                containing_obj = obj
                break
        if containing_obj:
            print(f"  ink@{ink_pos} -> obj pathid={containing_obj['path_id']}, "
                  f"size={containing_obj['byte_size']}, type={containing_obj['type_id']}")
        else:
            print(f"  ink@{ink_pos} -> NO MATCHING OBJECT!")

    return objs


# Parse both files
parse_and_validate(r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets5.assets.backup")
parse_and_validate(r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets.backup")
