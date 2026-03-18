import struct, os

fpath = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets5.assets.backup"
data = open(fpath, 'rb').read(200)

print("=== Raw header bytes ===")
for i in range(0, 64, 4):
    b = data[i:i+4]
    be = struct.unpack_from('>I', data, i)[0]
    le = struct.unpack_from('<I', data, i)[0]
    print(f"  [{i:3d}] {b.hex()}  BE={be:12d}  LE={le:12d}")

print()
version = struct.unpack_from('>I', data, 8)[0]
print(f"version (BE@8): {version}")

if version >= 22:
    fs64 = struct.unpack_from('>Q', data, 24)[0]
    do64 = struct.unpack_from('>Q', data, 32)[0]
    print(f"file_size_64 (BE@24): {fs64}")
    print(f"data_offset_64 (BE@32): {do64}")

actual = os.path.getsize(fpath)
print(f"actual file size: {actual}")
print(f"match: {fs64 == actual}" if version >= 22 else "")

# Also check resources.assets for comparison
fpath2 = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets.backup"
data2 = open(fpath2, 'rb').read(200)
print("\n=== resources.assets header ===")
for i in range(0, 64, 4):
    b = data2[i:i+4]
    be = struct.unpack_from('>I', data2, i)[0]
    le = struct.unpack_from('<I', data2, i)[0]
    print(f"  [{i:3d}] {b.hex()}  BE={be:12d}  LE={le:12d}")

v2 = struct.unpack_from('>I', data2, 8)[0]
print(f"version: {v2}")
if v2 >= 22:
    fs2 = struct.unpack_from('>Q', data2, 24)[0]
    do2 = struct.unpack_from('>Q', data2, 32)[0]
    print(f"file_size_64: {fs2}")
    print(f"data_offset_64: {do2}")
    actual2 = os.path.getsize(fpath2)
    print(f"actual: {actual2}, match: {fs2 == actual2}")
