"""
Safe binary injection for ALL sharedassets files (not just sharedassets1).
Direct byte-search replacement of English -> Italian Ink text.
File sizes stay identical.
"""
import os, csv, time, shutil

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"


def load_translations():
    trans = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                en = row[0]
                it = row[1]
                if len(en) >= 4:
                    trans[en] = it
    return trans


def inject_file(fpath, sorted_trans):
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath

    data = bytearray(open(source, 'rb').read())
    orig_size = len(data)

    replaced = 0
    truncated = 0

    for en, it in sorted_trans:
        en_bytes = en.encode('utf-8')
        it_bytes = it.encode('utf-8')

        idx = 0
        while True:
            idx = data.find(en_bytes, idx)
            if idx < 0:
                break

            available = len(en_bytes)
            if len(it_bytes) <= available:
                data[idx:idx+len(it_bytes)] = it_bytes
                for j in range(len(it_bytes), available):
                    data[idx+j] = 0x20
                replaced += 1
            else:
                trunc = it_bytes[:available]
                while trunc:
                    try:
                        trunc.decode('utf-8')
                        break
                    except:
                        trunc = trunc[:-1]
                if trunc:
                    data[idx:idx+len(trunc)] = trunc
                    for j in range(len(trunc), available):
                        data[idx+j] = 0x20
                    replaced += 1
                    truncated += 1

            idx += available

    assert len(data) == orig_size

    if replaced > 0:
        if not os.path.exists(backup):
            shutil.copy2(fpath, backup)
        with open(fpath, 'wb') as f:
            f.write(bytes(data))

    return replaced, truncated


def main():
    print("=" * 60)
    print("All sharedassets - Safe Ink Injection")
    print("=" * 60)

    trans = load_translations()
    print(f"Translations: {len(trans)}")

    sorted_trans = sorted(trans.items(), key=lambda x: len(x[0]), reverse=True)

    # Find all sharedassets files (skip sharedassets1 which is already done)
    files = []
    for f in sorted(os.listdir(ASSETS_DIR)):
        if f.startswith('sharedassets') and f.endswith('.assets') and not f.endswith('.backup'):
            if f == 'sharedassets1.assets':
                continue  # already injected
            files.append(f)

    total_replaced = 0
    total_truncated = 0

    for fname in files:
        fpath = os.path.join(ASSETS_DIR, fname)
        start = time.time()
        r, t = inject_file(fpath, sorted_trans)
        elapsed = time.time() - start
        if r > 0:
            print(f"  {fname}: {r} replaced ({t} truncated) [{elapsed:.1f}s]")
        total_replaced += r
        total_truncated += t

    print(f"\nTotal: {total_replaced} replaced ({total_truncated} truncated)")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
