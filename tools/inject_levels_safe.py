"""
Safe injection for level1-24 using reverse-search.
NEVER changes length prefix - only replaces string content with space padding.
Also injects short labels.
"""
import struct, os, re, json, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\final_cache.json"

ANCHORS = [
    rb' the ', rb' and ', rb' your ', rb' you ', rb' with ', rb' for ',
    rb' that ', rb' this ', rb' from ', rb' have ', rb' are ', rb' was ',
    rb' The ', rb' Your ', rb' You ', rb' will ', rb' can ',
    rb' not ', rb' but ', rb' all ', rb' its ', rb' has ',
    rb'STRENGTH', rb'DEXTERITY', rb'CONSTITUTION', rb'INTELLIGENCE',
    rb'WISDOM', rb'CHARISMA', rb'Hit Points', rb'Saving Throw',
]

SKIP = ['#version', '#define', 'void ', 'float ', 'vec4', 'Assets/', 'Packages/',
        'guid:', 'UnityEngine', '.shader', '.prefab', '.mat', 'HLSLCC',
        'uniform ', 'sampler2D', 'precision ', 'layout(', 'm_Script']

SHORT_LABELS = {
    "Proficient": "Competente",
    "Pre-Built": "Prefatto ",
    "Randomize": "Casuale  ",
    "Punching Bag": "Sacco Boxe  ",
    "Strength": "Forza   ",
    "Dexterity": "Destrezza",
    "Constitution": "Costituzione",
    "Intelligence": "Intelligenza",
    "Wisdom": "Saggez",
    "Charisma": "Carisma ",
    "Return": "Torna ",
    "Proficiencies": "Competenze   ",
    "Hit Points": "Punti Vita",
    "Saving Throws": "Tiri Salvezza",
}


def find_lp_string(data, text_offset):
    for back in range(1, 1000):
        off = text_offset - back
        if off < 0:
            return None
        lp = struct.unpack_from('<I', data, off)[0]
        if 8 <= lp <= 10000 and off + 4 + lp > text_offset and off + 4 + lp <= len(data):
            try:
                s = data[off+4:off+4+lp].decode('utf-8')
                if text_offset >= off + 4 and text_offset < off + 4 + lp:
                    return (off, lp, s)
            except:
                pass
    return None


def is_translatable(s):
    if len(s) < 16:
        return False
    clean = re.sub(r'<[^>]+>', '', s).replace('\\n', ' ').replace('\\r', ' ')
    if not re.search(r'[A-Za-z]{3,}\s+[a-zA-Z]{2,}', clean):
        return False
    if len(clean.strip()) <= 15:
        return False
    if any(x in s for x in SKIP):
        return False
    return True


def process_level(fname, cache):
    fpath = os.path.join(ASSETS_DIR, fname)
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath
    if not os.path.exists(source):
        return 0, 0

    data = bytearray(open(source, 'rb').read())
    orig_size = len(data)

    # 1. Long strings via reverse-search
    found = {}
    for pattern in ANCHORS:
        idx = 0
        while True:
            idx = data.find(pattern, idx)
            if idx < 0:
                break
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
        available = lp

        if len(it_bytes) <= available:
            data[off+4:off+4+len(it_bytes)] = it_bytes
            for j in range(len(it_bytes), available):
                data[off+4+j] = 0x20
        else:
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
        replaced_long += 1

    # 2. Short labels
    replaced_short = 0
    for en, it in SHORT_LABELS.items():
        en_bytes = en.encode('utf-8')
        it_bytes = it.encode('utf-8')
        if len(it_bytes) > len(en_bytes):
            it_bytes = it_bytes[:len(en_bytes)]
            while it_bytes:
                try:
                    it_bytes.decode('utf-8')
                    break
                except:
                    it_bytes = it_bytes[:-1]
            it_bytes = it_bytes + b' ' * (len(en_bytes) - len(it_bytes))
        elif len(it_bytes) < len(en_bytes):
            it_bytes = it_bytes + b' ' * (len(en_bytes) - len(it_bytes))

        idx = 0
        while True:
            idx = data.find(en_bytes, idx)
            if idx < 0:
                break
            if idx >= 4:
                lp = struct.unpack_from('<I', data, idx - 4)[0]
                if lp == len(en_bytes):
                    data[idx:idx+len(it_bytes)] = it_bytes
                    replaced_short += 1
            idx += 1

    assert len(data) == orig_size
    if not os.path.exists(backup):
        import shutil
        shutil.copy2(fpath, backup)
    with open(fpath, 'wb') as f:
        f.write(bytes(data))

    return replaced_long, replaced_short


def main():
    print("=" * 60)
    print("Level1-24 Safe Injection")
    print("=" * 60)

    cache = json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
    print(f"Cache: {len(cache)} entries")

    total_long = 0
    total_short = 0
    for lvl in range(1, 25):
        fname = f"level{lvl}"
        rl, rs = process_level(fname, cache)
        total_long += rl
        total_short += rs
        print(f"  {fname}: {rl} long + {rs} short")

    print(f"\nTotal: {total_long} long + {total_short} short = {total_long + total_short}")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
