"""
Fix truncated labels in level0 by re-injecting from backup with correct translations.
"""
import struct, os, re, json

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\final_cache.json"

# Fixed short labels - Italian MUST be <= English byte length
# Padded with spaces to exact length in code, not here
SHORT_LABELS = {
    "Proficient": "Competente",        # 10 = 10 OK
    "Pre-Built": "Prefatto ",          # 9 -> 9 OK (8+1space)
    "Randomize": "Casuale  ",          # 9 -> 9 OK
    "Punching Bag": "Sacco Boxe  ",    # 12 -> 12 OK
    "Background Focus": "Focus Background",  # 16 -> 16 OK
    "Strength": "Forza   ",            # 8 -> 8 OK
    "Dexterity": "Destrezza",          # 9 = 9 OK
    "Constitution": "Costituzione",    # 12 = 12 OK!
    "Intelligence": "Intelligenza",    # 12 = 12 OK!
    "Wisdom": "Saggez",                # 6 = 6 (best we can do)
    "Charisma": "Carisma ",            # 8 -> 8 OK
    "Return": "Torna ",                # 6 -> 6 OK
    "Proficiencies": "Competenze   ",  # 13 -> 13 OK
    "Hit Points": "Punti Vita",        # 10 = 10 OK
    "Saving Throws": "Tiri Salvezza",  # 13 = 13 OK
    "Lore": "Lore",                    # 4 = 4 (keep)
    "Uses": "Usi ",                    # 4 -> 4 OK
    "Role": "Ruo.",                    # 4 -> 4 OK
}

ANCHORS = [
    rb' the ', rb' and ', rb' your ', rb' you ', rb' with ', rb' for ',
    rb' that ', rb' this ', rb' from ', rb' have ', rb' are ', rb' was ',
    rb' The ', rb' Your ', rb' You ',
    rb'measures your', rb'Proficient', rb'shepherd', rb'testosterone',
    rb'STRENGTH', rb'DEXTERITY', rb'CONSTITUTION', rb'INTELLIGENCE',
    rb'WISDOM', rb'CHARISMA', rb'Hit Points', rb'Saving Throw',
    rb'Background Focus', rb'Become a', rb'DIVINE', rb'ZEALOT',
    rb'literally die', rb'innocent', rb'Punching Bag',
    rb'unique take', rb'Cleric',
]

SKIP = ['#version', '#define', 'void ', 'float ', 'vec4', 'Assets/', 'Packages/',
        'guid:', 'UnityEngine', '.shader', '.prefab', '.mat', 'HLSLCC',
        'uniform ', 'sampler2D', 'precision ', 'layout(', 'm_Script']


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


def main():
    print("=== Level0 Fixed Injection ===")
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
        italian = cache[text]
        it_bytes = italian.encode('utf-8')
        available = lp  # keep original length

        if len(it_bytes) <= available:
            data[off+4:off+4+len(it_bytes)] = it_bytes
            for j in range(len(it_bytes), available):
                data[off+4+j] = 0x20
        else:
            trunc = it_bytes[:available]
            while trunc:
                try: trunc.decode('utf-8'); break
                except: trunc = trunc[:-1]
            if trunc:
                data[off+4:off+4+len(trunc)] = trunc
                for j in range(len(trunc), available):
                    data[off+4+j] = 0x20
        replaced_long += 1

    # 2. Short labels
    replaced_short = 0
    for en, it in SHORT_LABELS.items():
        en_bytes = en.encode('utf-8')
        it_bytes = it.encode('utf-8')
        # Pad or truncate to exact original length
        if len(it_bytes) > len(en_bytes):
            it_bytes = it_bytes[:len(en_bytes)]
            # Fix UTF-8
            while it_bytes:
                try: it_bytes.decode('utf-8'); break
                except: it_bytes = it_bytes[:-1]
            it_bytes = it_bytes + b' ' * (len(en_bytes) - len(it_bytes))
        elif len(it_bytes) < len(en_bytes):
            it_bytes = it_bytes + b' ' * (len(en_bytes) - len(it_bytes))

        idx = 0
        while True:
            idx = data.find(en_bytes, idx)
            if idx < 0: break
            if idx >= 4:
                lp = struct.unpack_from('<I', data, idx - 4)[0]
                if lp == len(en_bytes):
                    data[idx:idx+len(it_bytes)] = it_bytes
                    replaced_short += 1
            idx += 1

    assert len(data) == orig_size
    with open(fpath, 'wb') as f:
        f.write(bytes(data))

    print(f"Long: {replaced_long}, Short: {replaced_short}")
    print(f"Size: {len(data):,} (unchanged)")

    # Verify
    v = open(fpath, 'rb').read()
    for needle, label in [
        (b'testosterone', 'STRENGTH desc'),
        (b'DIVINE MISSION', 'ZEALOT'),
        (b'Constitution', 'Constitution label'),
        (b'Intelligence', 'Intelligence label'),
    ]:
        idx = v.find(needle)
        if idx >= 0:
            # Check if it's inside a translated context
            ctx = v[max(0,idx-20):idx+len(needle)+20]
            asc = ''.join(chr(b) if 32<=b<127 else '.' for b in ctx)
            print(f"  FOUND {label}: ...{asc}...")
        else:
            print(f"  GONE: {label}")

    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
