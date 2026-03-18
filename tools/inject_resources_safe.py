"""
Safe injection for resources.assets: replaces CSV text IN-PLACE without changing file size.
Italian text is truncated or padded to fit the exact same space.
No header/object table updates needed = no corruption risk.
"""
import struct, os, csv, io, shutil

BACKUP = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets.backup"
TARGET = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets"
TRANS_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated"

SEARCH = b"ID,ENGLISH"


def load_trans(path):
    t = {}
    if not os.path.exists(path): return t
    with open(path, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            eid, it = row.get('ID','').strip(), row.get('ITALIAN','').strip()
            if eid and it: t[eid] = it
    return t


def replace_english(orig_text, trans):
    lines = orig_text.split('\n')
    out = [lines[0]]
    for line in lines[1:]:
        if not line.strip(): out.append(line); continue
        r = csv.reader(io.StringIO(line))
        try: parts = list(next(r))
        except StopIteration: out.append(line); continue
        eid = parts[0].strip() if parts else ''
        if eid in trans and len(parts) > 1: parts[1] = trans[eid]
        buf = io.StringIO()
        csv.writer(buf).writerow(parts)
        out.append(buf.getvalue().rstrip('\r\n'))
    return '\n'.join(out)


def ident(text):
    lines = text.strip().split('\n')
    if len(lines) < 2: return None
    ids = ' '.join(l.split(',',1)[0].strip().lower() for l in lines[1:5] if l.strip())
    if 'ui_' in ids or 'death_' in ids: return 'uielements'
    if 'll_' in ids or 'vl_' in ids: return 'popups'
    if 'quest_' in ids: return 'questpoints'
    if 'feat_' in ids: return 'feats'
    if 'bg_' in ids: return 'backgrounds'
    return None


def main():
    print("=" * 60)
    print("Resources.assets - Safe In-Place Injection")
    print("=" * 60)

    # Load translations
    tm = {}
    for n, f in [('uielements','uielements.csv'), ('feats','feats.csv'),
                  ('questpoints','questpoints.csv'), ('backgrounds','table_0.csv')]:
        t = load_trans(os.path.join(TRANS_DIR, f))
        if t: tm[n] = t; print(f"  {n}: {len(t)}")
    print(f"  Total: {sum(len(v) for v in tm.values())}")

    # Backup
    if not os.path.exists(BACKUP):
        shutil.copy2(TARGET, BACKUP)

    # Read clean backup
    data = bytearray(open(BACKUP, 'rb').read())
    print(f"\nOriginal: {len(data):,} bytes")

    # Find CSV blocks
    replaced_total = 0
    pos = 0
    while pos + len(SEARCH) < len(data):
        idx = data.find(SEARCH, pos)
        if idx == -1: break

        if idx >= 4:
            pre_len = struct.unpack_from('<I', data, idx - 4)[0]
            # Find null terminator
            end = idx
            while end < len(data) and data[end] != 0: end += 1
            csv_len = end - idx

            if pre_len == csv_len:
                text = data[idx:end].decode('utf-8')
                name = ident(text)

                if name and name in tm:
                    new_csv = replace_english(text, tm[name])
                    new_bytes = new_csv.encode('utf-8')

                    # Available space = original length (don't change size)
                    available = csv_len

                    if len(new_bytes) <= available:
                        # Fits! Write and pad with spaces then null
                        data[idx:idx+len(new_bytes)] = new_bytes
                        # Fill remaining with spaces (valid CSV padding)
                        for j in range(len(new_bytes), available):
                            data[idx+j] = 0x20  # space
                        # Update length prefix to new actual length
                        # Actually keep original length to avoid issues
                        # The trailing spaces are harmless in CSV
                        replaced_total += len(tm[name])
                        print(f"  {name}: {len(tm[name])} translations ({len(new_bytes)}/{available} bytes)")
                    else:
                        # Too long - need to shorten translations
                        # Try progressively shorter translations
                        print(f"  {name}: Italian too long ({len(new_bytes)} > {available}), truncating rows...")
                        # Truncate individual long translations to fit
                        shorter_trans = dict(tm[name])
                        while True:
                            new_csv = replace_english(text, shorter_trans)
                            new_bytes = new_csv.encode('utf-8')
                            if len(new_bytes) <= available:
                                break
                            # Find the longest translation and shorten it
                            longest_key = max(shorter_trans, key=lambda k: len(shorter_trans[k]))
                            val = shorter_trans[longest_key]
                            shorter_trans[longest_key] = val[:len(val)*3//4]  # trim by 25%
                            if len(val) < 5:
                                break

                        if len(new_bytes) <= available:
                            data[idx:idx+len(new_bytes)] = new_bytes
                            for j in range(len(new_bytes), available):
                                data[idx+j] = 0x20
                            replaced_total += len(shorter_trans)
                            print(f"    Fit after trimming: {len(new_bytes)}/{available} bytes")
                        else:
                            print(f"    SKIP: still too long")

        pos = idx + 1

    # Write - SAME SIZE as original
    assert len(data) == os.path.getsize(BACKUP), "File size changed!"
    with open(TARGET, 'wb') as f:
        f.write(data)

    print(f"\nFile size: {len(data):,} (unchanged)")
    print(f"Replaced: {replaced_total} translations")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
