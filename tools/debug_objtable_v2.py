"""Debug object table parsing - try both 20-byte and 24-byte entry sizes."""
import struct

fpath = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets5.assets.backup"
data = open(fpath, 'rb').read()

version = struct.unpack_from('>I', data, 8)[0]
file_size = struct.unpack_from('>Q', data, 24)[0]
data_offset = struct.unpack_from('>Q', data, 32)[0]
print(f"Version: {version}, file_size: {file_size}, data_offset: {data_offset}")

# Parse to object table
pos = 48
while pos < len(data) and data[pos] != 0:
    pos += 1
pos += 1  # skip null
pos += 4  # target_platform
pos += 1  # type_tree_enabled

type_count = struct.unpack_from('<I', data, pos)[0]
pos += 4
for _ in range(type_count):
    cid = struct.unpack_from('<i', data, pos)[0]
    pos += 4 + 1 + 2  # classID + is_stripped + script_type_index
    if cid == 114:
        pos += 16
    pos += 16  # old_type_hash

obj_count = struct.unpack_from('<I', data, pos)[0]
pos += 4
print(f"type_count: {type_count}, obj_count: {obj_count}, obj_table_start: {pos}")

# Try 24-byte entries (v22: pathID=i64, byteStart=i64, byteSize=u32, typeID=i32)
print("\n=== 24-byte entries (v22 with i64 byteStart) ===")
p = pos
for i in range(min(15, obj_count)):
    if p % 4 != 0:
        p += 4 - (p % 4)
    path_id = struct.unpack_from('<q', data, p)[0]
    byte_start = struct.unpack_from('<q', data, p + 8)[0]  # i64!
    byte_size = struct.unpack_from('<I', data, p + 16)[0]
    type_id = struct.unpack_from('<i', data, p + 20)[0]
    abs_start = data_offset + byte_start
    abs_end = abs_start + byte_size
    ok = 0 <= abs_start and abs_end <= len(data)
    print(f"  obj[{i:2d}]: pathid={path_id:6d}, start={byte_start:8d}, size={byte_size:8d}, "
          f"type={type_id:4d}, abs=[{abs_start}..{abs_end}] {'OK' if ok else 'BAD!'}")
    p += 24

# Try 20-byte entries (pre-v22: pathID=i64, byteStart=u32, byteSize=u32, typeID=i32)
print("\n=== 20-byte entries (pre-v22 with u32 byteStart) ===")
p = pos
for i in range(min(15, obj_count)):
    if p % 4 != 0:
        p += 4 - (p % 4)
    path_id = struct.unpack_from('<q', data, p)[0]
    byte_start = struct.unpack_from('<I', data, p + 8)[0]  # u32
    byte_size = struct.unpack_from('<I', data, p + 12)[0]
    type_id = struct.unpack_from('<i', data, p + 16)[0]
    abs_start = data_offset + byte_start
    abs_end = abs_start + byte_size
    ok = 0 <= abs_start and abs_end <= len(data)
    print(f"  obj[{i:2d}]: pathid={path_id:6d}, start={byte_start:8d}, size={byte_size:8d}, "
          f"type={type_id:4d}, abs=[{abs_start}..{abs_end}] {'OK' if ok else 'BAD!'}")
    p += 20

# Check ink markers
ink_marker = b'inkVersion'
ink_pos = data.find(ink_marker)
if ink_pos >= 0:
    print(f"\nFirst ink marker at: {ink_pos}")
    # Check which 24-byte object contains it
    p = pos
    for i in range(obj_count):
        if p % 4 != 0:
            p += 4 - (p % 4)
        path_id = struct.unpack_from('<q', data, p)[0]
        byte_start = struct.unpack_from('<q', data, p + 8)[0]
        byte_size = struct.unpack_from('<I', data, p + 16)[0]
        abs_start = data_offset + byte_start
        abs_end = abs_start + byte_size
        if abs_start <= ink_pos < abs_end:
            print(f"  24-byte: ink in obj[{i}] pathid={path_id}, start={byte_start}, size={byte_size}")
        p += 24
