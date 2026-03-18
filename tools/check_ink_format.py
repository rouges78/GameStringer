"""Check how Ink strings are stored in sharedassets1.assets"""
import struct

data = open(r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\sharedassets1.assets.backup", "rb").read()

# Find a known Ink string
test = b"Has your mind slipped"
idx = data.find(test)
if idx >= 0:
    start = max(0, idx - 60)
    ctx = data[start:idx + len(test) + 60]
    print(f"Found at 0x{idx:x}")
    # Show hex + ascii context
    for i in range(0, len(ctx), 32):
        chunk = ctx[i:i+32]
        hex_str = " ".join(f"{b:02x}" for b in chunk)
        asc_str = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        print(f"  {hex_str}  {asc_str}")

    # Check for JSON quote before
    for back in range(1, 500):
        if data[idx - back] == ord('"'):
            print(f"\nJSON quote at 0x{idx-back:x} (back={back})")
            # Show the full JSON string value
            json_start = idx - back + 1
            json_end = data.find(b'"', idx)
            if json_end > 0:
                full = data[json_start:json_end].decode("utf-8", errors="replace")
                print(f"Full JSON string value ({len(full)} chars): {full[:200]}")
            break
else:
    print("NOT FOUND")
    # Try other strings
    for t in [b"A cleric", b"Miska", b"Darrow", b"You step"]:
        idx2 = data.find(t)
        print(f"  {t.decode()}: {'0x'+format(idx2,'x') if idx2>=0 else 'NOT FOUND'}")
