"""
Inject short UI labels that the main injector skips (< 16 chars or no sentence pattern).
These are length-prefixed strings replaced in-place.
"""
import struct, os

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"

# Manual translations for short UI labels
SHORT_LABELS = {
    "Proficient": "Competente",
    "Pre-Built": "Prefatto",
    "Randomize": "Casuale",
    "Punching Bag": "Sacco da Boxe",
    "Background Focus": "Focus Background",
    "Lore Enthusiast": "Appassionato",
    "Page1 - Lore": "Pag1 - Storie",
    "Page2 - Uses": "Pag2 - Usi",
    "Page3 - Role": "Pag3 - Ruolo",
    "Strength": "Forza",
    "Dexterity": "Destrezza",
    "Constitution": "Costituzione",
    "Intelligence": "Intelligenza",
    "Wisdom": "Saggezza",
    "Charisma": "Carisma",
    "Return": "Indietro",
    "Proficiencies": "Competenze",
    "Death Saving Throw": "Tiro Salvezza Morte",
    "Saving Throws": "Tiri Salvezza",
    "Hit Points": "Punti Ferita",
    "Armor Class": "Classe Armatura",
    "Speed": "Velocità",
    "Level": "Livello",
}


def replace_lp_string(data, offset, new_text):
    """Replace a length-prefixed string at offset, pad with nulls."""
    old_lp = struct.unpack_from('<I', data, offset)[0]
    old_padded = 4 + old_lp
    while old_padded % 4 != 0:
        old_padded += 1
    available = old_padded - 4

    new_bytes = new_text.encode('utf-8')
    if len(new_bytes) > available:
        # Truncate
        new_bytes = new_bytes[:available]
        while new_bytes:
            try:
                new_bytes.decode('utf-8')
                break
            except:
                new_bytes = new_bytes[:-1]

    struct.pack_into('<I', data, offset, len(new_bytes))
    data[offset+4:offset+4+len(new_bytes)] = new_bytes
    for j in range(len(new_bytes), available):
        data[offset+4+j] = 0
    return True


def process_file(fname):
    fpath = os.path.join(ASSETS_DIR, fname)
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath

    data = bytearray(open(source, 'rb').read())
    replaced = 0

    for en, it in SHORT_LABELS.items():
        en_bytes = en.encode('utf-8')
        # Find all occurrences
        idx = 0
        while True:
            idx = data.find(en_bytes, idx)
            if idx < 0:
                break
            # Check if this is a length-prefixed string (4 bytes before = length)
            if idx >= 4:
                lp = struct.unpack_from('<I', data, idx - 4)[0]
                if lp == len(en_bytes):
                    # Exact match - this IS the length-prefixed string
                    replace_lp_string(data, idx - 4, it)
                    replaced += 1
            idx += 1

    if replaced > 0:
        if not os.path.exists(backup):
            import shutil
            shutil.copy2(fpath, backup)
        with open(fpath, 'wb') as f:
            f.write(bytes(data))

    return replaced


def main():
    print("=== Short Label Injection ===")
    total = 0
    for lvl in range(25):
        fname = f"level{lvl}"
        if not os.path.exists(os.path.join(ASSETS_DIR, fname)):
            continue
        r = process_file(fname)
        if r > 0:
            print(f"  {fname}: {r} labels replaced")
        total += r

    print(f"\n=== DONE: {total} total label replacements ===")

    # Verify level0
    data = open(os.path.join(ASSETS_DIR, "level0"), 'rb').read()
    for en in ["Proficient", "Pre-Built", "Randomize", "Punching Bag"]:
        idx = data.find(en.encode())
        if idx >= 0:
            print(f"  STILL: {en}")
        else:
            print(f"  REPLACED: {en}")


if __name__ == '__main__':
    main()
