"""Inject short UI labels into level0 only."""
import struct, os

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"

SHORT_LABELS = {
    "Proficient": "Competente",
    "Pre-Built": "Prefatto",
    "Randomize": "Casuale",
    "Punching Bag": "Sacco da Boxe",
    "Background Focus": "Focus Background",
    "Lore Enthusiast": "Appassionato",
    "Strength": "Forza",
    "Dexterity": "Destrezza",
    "Constitution": "Costituzione",
    "Intelligence": "Intelligenza",
    "Wisdom": "Saggezza",
    "Charisma": "Carisma",
    "Return": "Indietro",
    "Proficiencies": "Competenze",
    "Hit Points": "Punti Ferita",
    "Armor Class": "Classe Armatura",
    "Speed": "Velocit\u00e0",
    "Level": "Livello",
    "Saving Throws": "Tiri Salvezza",
}

def main():
    fname = "level0"
    fpath = os.path.join(ASSETS_DIR, fname)
    backup = fpath + ".backup"
    # Read from current (already has long string injections)
    data = bytearray(open(fpath, 'rb').read())
    replaced = 0

    for en, it in SHORT_LABELS.items():
        en_bytes = en.encode('utf-8')
        idx = 0
        while True:
            idx = data.find(en_bytes, idx)
            if idx < 0: break
            if idx >= 4:
                lp = struct.unpack_from('<I', data, idx - 4)[0]
                if lp == len(en_bytes):
                    it_bytes = it.encode('utf-8')
                    padded = 4 + lp
                    while padded % 4 != 0: padded += 1
                    available = padded - 4
                    if len(it_bytes) <= available:
                        struct.pack_into('<I', data, idx - 4, len(it_bytes))
                        data[idx:idx+len(it_bytes)] = it_bytes
                        for j in range(len(it_bytes), available):
                            data[idx+j] = 0
                        replaced += 1
            idx += 1

    with open(fpath, 'wb') as f:
        f.write(bytes(data))
    print(f"Level0: {replaced} short labels replaced")

    # Verify
    verify = open(fpath, 'rb').read()
    for en in ["Proficient", "Pre-Built", "Randomize", "Punching Bag", "Strength"]:
        eb = en.encode()
        idx = verify.find(eb)
        # Check it's not inside a longer translated string
        if idx >= 0 and idx >= 4:
            lp = struct.unpack_from('<I', verify, idx-4)[0]
            if lp == len(eb):
                print(f"  STILL: {en}")
            else:
                print(f"  OK (inside longer string): {en}")
        elif idx >= 0:
            print(f"  STILL: {en}")
        else:
            print(f"  REPLACED: {en}")

if __name__ == '__main__':
    main()
