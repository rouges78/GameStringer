"""Debug VIS5 archive - exhaustive field analysis"""
import struct, os, hashlib

path = r'E:\SteamLibrary\steamapps\common\FoolishMortals\data.vis'
size = os.path.getsize(path)
print(f'File size: {size} bytes ({size/1024/1024:.1f} MB)')

def joaat64(name):
    h = 0
    for b in name.lower().encode():
        h = (h + b) & 0xFFFFFFFFFFFFFFFF
        h = (h + (h << 10)) & 0xFFFFFFFFFFFFFFFF
        h ^= (h >> 6)
    h = (h + (h << 3)) & 0xFFFFFFFFFFFFFFFF
    h ^= (h >> 11)
    h = (h + (h << 15)) & 0xFFFFFFFFFFFFFFFF
    return h & 0xFFFFFFFF

with open(path, 'rb') as f:
    magic = f.read(4)
    print(f'Magic: {magic}')
    count = struct.unpack('>I', f.read(4))[0]
    print(f'File count (BE): {count}')
    
    key = hashlib.md5(b'AGAME4VISPL4').hexdigest().encode()
    
    # 16-byte entries (known to give valid HDR/END)
    dir_total = 3 + count * 4 + count * 16 + 3
    f.seek(8)
    dir_data = bytearray(f.read(dir_total))
    for i in range(len(dir_data)):
        dir_data[i] ^= key[i % len(key)]
    
    # Read hashes
    pos = 3
    all_hashes = []
    for i in range(count):
        h = struct.unpack('>I', dir_data[pos:pos+4])[0]
        all_hashes.append(h)
        pos += 4
    
    # Read raw 16 bytes per entry
    entries_raw = []
    for i in range(count):
        raw = dir_data[pos:pos+16]
        entries_raw.append(raw)
        pos += 16
    
    # Find game.veb
    veb_hash = joaat64('game.veb')
    print(f'game.veb hash: 0x{veb_hash:08x}')
    
    idx = all_hashes.index(veb_hash) if veb_hash in all_hashes else -1
    if idx < 0:
        print('game.veb NOT FOUND')
        exit()
    
    raw = entries_raw[idx]
    print(f'\ngame.veb raw 16 bytes (decrypted): {raw.hex()}')
    
    # Try EVERY interpretation
    print('\n=== All interpretations of 16 bytes ===')
    # BE 4x uint32
    a, b, c, d = struct.unpack('>IIII', raw)
    print(f'BE IIII: {a}, {b}, {c}, 0x{d:08x}')
    # LE 4x uint32
    a, b, c, d = struct.unpack('<IIII', raw)
    print(f'LE IIII: {a}, {b}, {c}, 0x{d:08x}')
    # BE 2x uint64
    a, b = struct.unpack('>QQ', raw)
    print(f'BE QQ: {a}, {b}')
    # LE 2x uint64
    a, b = struct.unpack('<QQ', raw)
    print(f'LE QQ: {a}, {b}')
    # Mixed: BE u32 + BE u64 + BE u32
    # Try: u32 compSize, u32 offset_hi:offset_lo (as single 64-bit), u32 flags
    # Or: offset as field0|field1 combined
    combined_01 = (struct.unpack('>I', raw[0:4])[0] << 32) | struct.unpack('>I', raw[4:8])[0]
    combined_12 = (struct.unpack('>I', raw[4:8])[0] << 32) | struct.unpack('>I', raw[8:12])[0]
    print(f'Combined f0|f1 as 64-bit: {combined_01}')
    print(f'Combined f1|f2 as 64-bit: {combined_12}')
    
    # Now try: maybe the OFFSET field in the entry IS already absolute from file start
    # But it needs to add the base (8 + dir_total)?
    base = 8 + dir_total
    be_fields = struct.unpack('>IIII', raw)
    print(f'\nBase offset (after dir): {base}')
    for fi in range(4):
        val = be_fields[fi]
        abs_off = base + val
        if abs_off < size:
            f.seek(abs_off)
            sample = f.read(20)
            print(f'  base+field{fi} ({base}+{val}={abs_off}): {sample[:16]}')
            if sample[:4] == b'VBIN':
                print(f'    *** VBIN! ***')
    
    # Analyze: for entries with known file types, check where data is
    # The darkstar/gus VISUnpacker says: base_offset = 8 + 3 + files*16 + 3
    # But that's for VIS3 (no hashes). For VIS5 the hashes add count*4
    # Let's check if field0 is the offset FROM the base
    
    print(f'\n=== Checking if field0 is offset from base ===')
    # For a few small entries, read at base + field0
    for i in [1, 5, 10, 20, 50, 100]:
        if i >= count: break
        raw_e = entries_raw[i]
        f0, f1, f2, f3 = struct.unpack('>IIII', raw_e)
        
        # Try base + f0
        off = base + f0
        if off < size:
            f.seek(off)
            sample = f.read(8)
            is_png = sample[:4] == b'\x89PNG'
            is_ogg = sample[:4] == b'OggS'
            is_riff = sample[:4] == b'RIFF'
            is_webp = sample[8:12] == b'WEBP' if len(sample) >= 12 else False
            desc = 'PNG' if is_png else 'OGG' if is_ogg else 'RIFF' if is_riff else sample[:8].hex()
            print(f'  [{i}] base+f0={off} f1={f1} f2={f2} f3=0x{f3:x} => {desc}')
    
    # Now check: is field1 the offset instead?
    print(f'\n=== Checking if field1 is offset from base ===')
    for i in [1, 5, 10, 20, 50, 100]:
        if i >= count: break
        raw_e = entries_raw[i]
        f0, f1, f2, f3 = struct.unpack('>IIII', raw_e)
        
        off = base + f1
        if off < size and f1 < size:
            f.seek(off)
            sample = f.read(8)
            is_png = sample[:4] == b'\x89PNG'
            is_ogg = sample[:4] == b'OggS'
            is_riff = sample[:4] == b'RIFF'
            desc = 'PNG' if is_png else 'OGG' if is_ogg else 'RIFF' if is_riff else sample[:8].hex()
            print(f'  [{i}] base+f1={off} f0={f0} f2={f2} f3=0x{f3:x} => {desc}')
    
    # Check: maybe files are stored at absolute offsets (no base needed)
    # Some VIS5 files put data right after header (offset 8), not after directory
    print(f'\n=== Checking if field0 is ABSOLUTE offset ===')
    for i in [1, 5, 10, 20, 50, 100]:
        if i >= count: break
        raw_e = entries_raw[i]
        f0, f1, f2, f3 = struct.unpack('>IIII', raw_e)
        if f0 < size:
            f.seek(f0)
            sample = f.read(8)
            is_png = sample[:4] == b'\x89PNG'
            is_ogg = sample[:4] == b'OggS'
            is_riff = sample[:4] == b'RIFF'
            desc = 'PNG' if is_png else 'OGG' if is_ogg else 'RIFF' if is_riff else sample[:8].hex()
            print(f'  [{i}] f0={f0} => {desc}  | f1={f1} f2={f2} f3=0x{f3:x}')
    
    print(f'\n=== Checking if field1 is ABSOLUTE offset ===')
    for i in [1, 5, 10, 20, 50, 100]:
        if i >= count: break
        raw_e = entries_raw[i]
        f0, f1, f2, f3 = struct.unpack('>IIII', raw_e)
        if f1 < size:
            f.seek(f1)
            sample = f.read(8)
            is_png = sample[:4] == b'\x89PNG'
            is_ogg = sample[:4] == b'OggS'
            is_riff = sample[:4] == b'RIFF'
            desc = 'PNG' if is_png else 'OGG' if is_ogg else 'RIFF' if is_riff else sample[:8].hex()
            print(f'  [{i}] f1={f1} => {desc}  | f0={f0} f2={f2} f3=0x{f3:x}')

    # SOLUTION: We found VBIN at offset 862888679 by brute-force scan.
    # For the patcher, we can use brute-force VBIN scan instead of parsing the directory.
    # This works because game.veb is the ONLY VBIN in the archive.
    
    # Extract and decompress VBIN to verify string extraction works
    import zlib
    
    vbin_offset = 862888679
    f.seek(vbin_offset)
    header = f.read(16)
    vbin_magic = header[:4]
    unk = struct.unpack('<I', header[4:8])[0]
    uncomp_size = struct.unpack('<I', header[8:12])[0]
    comp_size = struct.unpack('<I', header[12:16])[0]
    
    print(f'\n=== VBIN at {vbin_offset} ===')
    print(f'Magic: {vbin_magic}')
    print(f'Unknown: {unk}')
    print(f'Uncompressed: {uncomp_size}')
    print(f'Compressed: {comp_size}')
    
    # Read compressed data
    compressed = f.read(comp_size)
    print(f'Read {len(compressed)} bytes of compressed data')
    
    # Decompress
    try:
        decompressed = zlib.decompress(compressed)
        print(f'Decompressed: {len(decompressed)} bytes (expected {uncomp_size})')
    except Exception as e:
        print(f'Decompress failed: {e}')
        # Try with wbits=-15 (raw deflate)
        try:
            decompressed = zlib.decompress(compressed, -15)
            print(f'Raw deflate decompressed: {len(decompressed)} bytes')
        except Exception as e2:
            print(f'Raw deflate also failed: {e2}')
            decompressed = b''
    
    if decompressed:
        # Extract strings: find length-prefixed UTF-8 strings
        strings = []
        pos = 0
        while pos + 4 < len(decompressed):
            slen = struct.unpack('<I', decompressed[pos:pos+4])[0]
            if 3 <= slen <= 5000 and pos + 4 + slen <= len(decompressed):
                raw_str = decompressed[pos+4:pos+4+slen]
                try:
                    text = raw_str.decode('utf-8').rstrip('\x00')
                    # Check if it's real text (has letters, spaces, no binary)
                    letters = sum(1 for c in text if c.isalpha())
                    if letters >= 3 and ' ' in text and len(text) >= 5:
                        if not any(text.endswith(ext) for ext in ['.png','.ogg','.wav','.lua','.xml','.webp']):
                            if not text.startswith('e') or ' ' in text:
                                strings.append((pos, text))
                                pos += 4 + slen
                                continue
                except:
                    pass
            pos += 1
        
        print(f'\nFound {len(strings)} translatable strings')
        print('\nFirst 20 strings:')
        for offset, text in strings[:20]:
            print(f'  [{offset}] {text[:100]}')
        
        print(f'\nLast 10 strings:')
        for offset, text in strings[-10:]:
            print(f'  [{offset}] {text[:100]}')
