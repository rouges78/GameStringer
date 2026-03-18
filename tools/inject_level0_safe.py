"""
Safe level0 injection - NEVER changes length prefix or file size.
Only replaces string bytes, padding with spaces to original length.
"""
import struct, os, re, json

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\final_cache.json"

ANCHORS = [
    rb' the ', rb' and ', rb' your ', rb' you ', rb' with ', rb' for ',
    rb' that ', rb' this ', rb' from ', rb' have ', rb' are ', rb' was ',
    rb' The ', rb' Your ', rb' You ',
    rb'measures your', rb'Proficient', rb'shepherd', rb'testosterone',
    rb'STRENGTH', rb'DEXTERITY', rb'CONSTITUTION', rb'INTELLIGENCE',
    rb'WISDOM', rb'CHARISMA', rb'Hit Points', rb'Saving Throw',
    rb'Background Focus', rb'Become a', rb'DIVINE', rb'ZEALOT',
    rb'literally die', rb'innocent', rb'Punching Bag',
]

SKIP = ['#version', '#define', 'void ', 'float ', 'vec4', 'Assets/', 'Packages/',
        'guid:', 'UnityEngine', '.shader', '.prefab', '.mat', 'HLSLCC',
        'uniform ', 'sampler2D', 'precision ', 'layout(', 'm_Script']

# Short labels (exact length-prefix match)
SHORT_LABELS = {
    "Proficient": "Competente",
    "Pre-Built": "Prefatto  ",
    "Randomize": "Casuale  ",
    "Punching Bag": "Sacco Boxe  ",
    "Background Focus": "Focus Background ",
    "Strength": "Forza   ",
    "Dexterity": "Destrezza",
    "Constitution": "Costituzion",
    "Intelligence": "Intelligenz",
    "Wisdom": "Saggez",
    "Charisma": "Carisma ",
    "Return": "Indiet",
    "Proficiencies": "Competenze   ",
    "Hit Points": "Punti Ferit",
    "Saving Throws": "Tiri Salvezza",
}


def find_lp_string(data, text_offset):
    for back in range(1, 1000):
        off = text_offset - back
        if off < 0: return None
        lp = struct.unpack_from('<I', data, off)[0]
        if 8 <= lp <= 10000 and off + 4 + lp > text_offset and off + 4 + lp <= len(data):
            try:
                s = data[off+4:off+4+lp].decode('utf-8')
                if text_offset >= off + 4 and text_offset < off + 4 + lp:
                    return (off, lp, s)
            except: pass
    return None


def is_translatable(s):
    if len(s) < 16: return False
    clean = re.sub(r'<[^>]+>', '', s).replace('\\n',' ').replace('\\r',' ')
    if not re.search(r'[A-Za-z]{3,}\s+[a-zA-Z]{2,}', clean): return False
    if len(clean.strip()) <= 15: return False
    if any(x in s for x in SKIP): return False
    return True


def safe_replace(data, off, orig_lp, italian):
    """Replace string bytes WITHOUT changing length prefix. Pad with spaces."""
    it_bytes = italian.encode('utf-8')
    available = orig_lp  # exact original string length

    if len(it_bytes) <= available:
        # Fits - write Italian + pad with spaces
        data[off+4:off+4+len(it_bytes)] = it_bytes
        for j in range(len(it_bytes), available):
            data[off+4+j] = 0x20  # space padding
        # DO NOT change length prefix!
        return True
    else:
        # Truncate to fit original length
        trunc = it_bytes[:available]
        while trunc:
            try:
                trunc.decode('utf-8')
                break
            except:
                trunc = trunc[:-1]
        if trunc:
            data[off+4:off+4+len(trunc)] = trunc
            for j in range(len(trunc), available):
                data[off+4+j] = 0x20
            return True
    return False


def main():
    print("=== Level0 Safe Injection ===")

    # Load translation cache
    cache = json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
    print(f"Cache: {len(cache)} entries")

    fpath = os.path.join(ASSETS_DIR, "level0")
    backup = fpath + ".backup"
    data = bytearray(open(backup, 'rb').read())
    orig_size = len(data)

    # 1. Long strings via reverse-search
    found = {}
    for pattern in ANCHORS:
        idx = 0
        while True:
            idx = data.find(pattern, idx)
            if idx < 0: break
            result = find_lp_string(data, idx)
            if result:
                off, lp, text = result
                if off not in found and is_translatable(text) and text in cache:
                    found[off] = (lp, text)
            idx += 1

    replaced_long = 0
    for off, (lp, text) in found.items():
        if safe_replace(data, off, lp, cache[text]):
            replaced_long += 1

    # 2. Short labels (exact length-prefix match)
    replaced_short = 0
    for en, it in SHORT_LABELS.items():
        en_bytes = en.encode('utf-8')
        it_bytes = it.encode('utf-8')
        # Ensure Italian is exactly same length as English
        if len(it_bytes) > len(en_bytes):
            it_bytes = it_bytes[:len(en_bytes)]
        elif len(it_bytes) < len(en_bytes):
            it_bytes = it_bytes + b' ' * (len(en_bytes) - len(it_bytes))

        idx = 0
        while True:
            idx = data.find(en_bytes, idx)
            if idx < 0: break
            if idx >= 4:
                lp = struct.unpack_from('<I', data, idx - 4)[0]
                if lp == len(en_bytes):
                    # Replace content, keep length prefix
                    data[idx:idx+len(it_bytes)] = it_bytes
                    replaced_short += 1
            idx += 1

    # Verify same size
    assert len(data) == orig_size, "File size changed!"

    with open(fpath, 'wb') as f:
        f.write(bytes(data))

    print(f"Long strings: {replaced_long}")
    print(f"Short labels: {replaced_short}")
    print(f"File size: {len(data):,} (unchanged)")

    # Verify
    verify = open(fpath, 'rb').read()
    for needle, label in [(b'testosterone-fueled', 'STRENGTH'), (b'DIVINE MISSION', 'ZEALOT'),
                           (b'shepherd knows', 'Torna')]:
        idx = verify.find(needle)
        print(f"  {'STILL' if idx>=0 else 'TRANSLATED'}: {label}")

    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
