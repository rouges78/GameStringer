"""
Find Ink JSON blob boundaries in sharedassets files.
Ink blobs contain "inkVersion" and are length-prefixed strings.
"""
import struct, os

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
MARKER = b"inkVersion"


def find_ink_blobs(data):
    """Find all Ink JSON blobs by searching for inkVersion marker and tracing back to length prefix."""
    blobs = []
    idx = 0
    while True:
        idx = data.find(MARKER, idx)
        if idx < 0:
            break
        # Trace back to find length prefix
        for back in range(1, 500):
            off = idx - back
            if off < 0:
                break
            lp = struct.unpack_from('<I', data, off)[0]
            if lp >= 100 and lp <= 5_000_000 and off + 4 + lp <= len(data):
                # Verify this looks like JSON
                start_byte = data[off + 4]
                if start_byte == ord('{'):
                    blobs.append((off + 4, off + 4 + lp))
                    break
        idx += 1
    return blobs


def main():
    for f in sorted(os.listdir(ASSETS_DIR)):
        if not f.startswith('sharedassets') or not f.endswith('.assets') or f.endswith('.backup'):
            continue
        fpath = os.path.join(ASSETS_DIR, f)
        # Use backup if exists
        bak = fpath + '.backup'
        source = bak if os.path.exists(bak) else fpath
        data = open(source, 'rb').read()
        blobs = find_ink_blobs(data)
        if blobs:
            total = sum(end - start for start, end in blobs)
            print(f"{f}: {len(blobs)} Ink blobs, {total:,} bytes total")
            for start, end in blobs[:3]:
                size = end - start
                snippet = data[start:start+80].decode('utf-8', errors='replace')
                print(f"  0x{start:x}-0x{end:x} ({size:,} bytes): {snippet[:70]}...")
            if len(blobs) > 3:
                print(f"  ... and {len(blobs)-3} more")


if __name__ == '__main__':
    main()
