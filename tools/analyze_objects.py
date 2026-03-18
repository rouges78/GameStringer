"""Analyze which Unity objects contain the CSV localization data"""
import struct

BACKUP = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets.backup"

# Known CSV offsets from our extraction
CSV_OFFSETS = {
    'backgrounds': 0x002e02f4,
    'journaltexts': 0x00308834,
    'popups': 0x00308880,
    'uielements': 0x00309944,
    'spelltexts': 0x00309bd4,
    'itemtexts': 0x00309c74,
    'feats': 0x00309e10,
    'questpoints': 0x0030bea4,
}

with open(BACKUP, 'rb') as f:
    data = f.read()

# Parse header
version = struct.unpack_from('>I', data, 8)[0]
print(f"Version: {version}")

# v22 header
metadata_size = struct.unpack_from('>I', data, 20)[0]
file_size = struct.unpack_from('>Q', data, 24)[0]
data_offset = struct.unpack_from('>Q', data, 32)[0]
print(f"metadata_size: {metadata_size}")
print(f"file_size: {file_size}")
print(f"data_offset: {data_offset}")

# Skip to unity version string
pos = 48
while pos < len(data) and data[pos] != 0:
    pos += 1
unity_ver = data[48:pos].decode('ascii')
pos += 1  # null
print(f"Unity: {unity_ver}")

target_platform = struct.unpack_from('<I', data, pos)[0]; pos += 4
type_tree = data[pos]; pos += 1
type_count = struct.unpack_from('<I', data, pos)[0]; pos += 4
print(f"Types: {type_count}, TypeTree: {type_tree}")

# Skip types
for i in range(type_count):
    class_id = struct.unpack_from('<i', data, pos)[0]; pos += 4
    pos += 1  # is_stripped
    pos += 2  # script_type_index
    if class_id == 114:
        pos += 16  # script hash
    pos += 16  # type hash

obj_count = struct.unpack_from('<I', data, pos)[0]; pos += 4
print(f"Objects: {obj_count}")

# Parse objects
objects = []
for i in range(obj_count):
    if pos % 4 != 0:
        pos += 4 - (pos % 4)
    path_id = struct.unpack_from('<q', data, pos)[0]; pos += 8
    byte_start = struct.unpack_from('<I', data, pos)[0]; pos += 4
    byte_size = struct.unpack_from('<I', data, pos)[0]; pos += 4
    type_id = struct.unpack_from('<I', data, pos)[0]; pos += 4
    
    abs_start = data_offset + byte_start
    abs_end = abs_start + byte_size
    objects.append({
        'idx': i, 'path_id': path_id,
        'byte_start': byte_start, 'byte_size': byte_size,
        'type_id': type_id, 'abs_start': abs_start, 'abs_end': abs_end,
        'entry_offset': pos - 20,  # start of this entry
    })

# Find which objects contain our CSV offsets
print(f"\nSearching for objects containing CSV data...")
for csv_name, csv_offset in sorted(CSV_OFFSETS.items(), key=lambda x: x[1]):
    found = False
    for obj in objects:
        if obj['abs_start'] <= csv_offset < obj['abs_end']:
            rel = csv_offset - obj['abs_start']
            print(f"  {csv_name:15s} @ 0x{csv_offset:08x} -> obj#{obj['idx']} "
                  f"(type={obj['type_id']}, start=0x{obj['abs_start']:08x}, "
                  f"size={obj['byte_size']}, rel_offset={rel})")
            
            # Try to read TextAsset name at abs_start
            name_len = struct.unpack_from('<I', data, obj['abs_start'])[0]
            if 0 < name_len < 200:
                name = data[obj['abs_start']+4:obj['abs_start']+4+name_len].decode('utf-8', errors='replace')
                print(f"                  TextAsset name: '{name}'")
            found = True
            break
    if not found:
        print(f"  {csv_name:15s} @ 0x{csv_offset:08x} -> NOT FOUND in any object!")

# Also show types used
print(f"\nType distribution:")
type_counts = {}
for obj in objects:
    type_counts[obj['type_id']] = type_counts.get(obj['type_id'], 0) + 1
for tid, cnt in sorted(type_counts.items()):
    print(f"  type {tid}: {cnt} objects")
