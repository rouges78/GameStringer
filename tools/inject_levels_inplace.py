"""
In-place injection into Unity level files for Esoteric Ebb.
Uses KEY-VALUE pattern matching to replace ONLY localization strings.
Pattern: LP(key) + key + align + \x02\x00\x00\x00 + LP(value) + value
This prevents replacing config strings like 'High', 'Off', etc.
"""
import struct, os, csv, shutil, time

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
TRANS_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated"


def load_keyed_translations():
    """Load translations with keys. Returns list of (key, english, italian)."""
    entries = []
    for fname in os.listdir(TRANS_DIR):
        if not fname.endswith('.csv'):
            continue
        path = os.path.join(TRANS_DIR, fname)
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = row.get('ID', '').strip()
                eng = row.get('ENGLISH', '').strip()
                ita = row.get('ITALIAN', '').strip()
                if key and eng and ita and eng != ita:
                    entries.append((key, eng, ita))
    return entries


def build_key_pattern(key):
    """Build the binary pattern for a localization key."""
    key_bytes = key.encode('utf-8')
    key_len = len(key_bytes)
    key_pad = (4 - key_len % 4) % 4
    # LP(key) + key + null_padding + count_field(02 00 00 00)
    pattern = struct.pack('<I', key_len) + key_bytes + b'\x00' * key_pad + b'\x02\x00\x00\x00'
    return pattern


def replace_lp_value(data, str_start, available, ita_text):
    """Replace LP-prefixed value in-place. Returns (success, was_truncated)."""
    ita_bytes = ita_text.encode('utf-8')
    if len(ita_bytes) <= available:
        data[str_start:str_start + len(ita_bytes)] = ita_bytes
        for j in range(len(ita_bytes), available):
            data[str_start + j] = 0x20
        return True, False
    else:
        trunc = ita_bytes[:available]
        while trunc:
            try:
                trunc.decode('utf-8')
                break
            except UnicodeDecodeError:
                trunc = trunc[:-1]
        if trunc:
            data[str_start:str_start + len(trunc)] = trunc
            for j in range(len(trunc), available):
                data[str_start + j] = 0x20
            return True, True
    return False, False


def find_and_replace_keyed(data, entries):
    """
    Find localization key-value pairs and replace values with Italian.
    Only matches the exact localization pattern to avoid replacing config strings.
    """
    replaced = 0
    truncated = 0
    skipped = 0

    for key, eng, ita in entries:
        key_pattern = build_key_pattern(key)
        pos = 0
        while True:
            idx = data.find(key_pattern, pos)
            if idx < 0:
                break

            val_lp_off = idx + len(key_pattern)
            if val_lp_off + 4 > len(data):
                pos = idx + 1
                continue

            val_lp = struct.unpack_from('<I', data, val_lp_off)[0]
            val_start = val_lp_off + 4
            val_end = val_start + val_lp

            if val_end > len(data):
                pos = idx + 1
                continue

            current_val = bytes(data[val_start:val_end])
            try:
                current_str = current_val.decode('utf-8')
            except UnicodeDecodeError:
                pos = idx + 1
                continue

            if current_str.strip() != eng.strip():
                pos = idx + 1
                continue

            ok, trunc = replace_lp_value(data, val_start, val_lp, ita)
            if ok:
                replaced += 1
                if trunc: truncated += 1
            else:
                skipped += 1

            pos = val_end

    return replaced, truncated, skipped


def find_and_replace_lp_direct(data, entries):
    """
    Fallback: directly match LP-prefixed English strings without key context.
    Used for level files that don't have key-value format (e.g., level0).
    Only matches exact LP + english_bytes patterns from our translation list.
    """
    replaced = 0
    truncated = 0
    skipped = 0

    for key, eng, ita in entries:
        eng_bytes = eng.encode('utf-8')
        eng_len = len(eng_bytes)
        search_pattern = struct.pack('<I', eng_len) + eng_bytes
        pos = 0
        while True:
            idx = data.find(search_pattern, pos)
            if idx < 0:
                break
            str_start = idx + 4

            # Safety: skip if preceded by Assembly-CSharp (C# class name reference)
            pre_start = max(0, idx - 50)
            pre_bytes = bytes(data[pre_start:idx])
            if b'Assembly' in pre_bytes or b'CSharp' in pre_bytes or b'MonoBehaviour' in pre_bytes:
                skipped += 1
                pos = str_start + eng_len
                continue

            ok, trunc = replace_lp_value(data, str_start, eng_len, ita)
            if ok:
                replaced += 1
                if trunc: truncated += 1
            else:
                skipped += 1
            pos = str_start + eng_len

    return replaced, truncated, skipped


def process_level_file(fpath, entries):
    """Process a single level file. Tries key-safe first, falls back to LP-direct."""
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath
    data = bytearray(open(source, 'rb').read())
    orig_size = len(data)

    # Try key-safe matching first
    replaced, truncated, skipped = find_and_replace_keyed(data, entries)

    # If very few matches, try LP-direct fallback (level0 format)
    if replaced < 10:
        # Re-read clean data for LP-direct
        data = bytearray(open(source, 'rb').read())
        replaced, truncated, skipped = find_and_replace_lp_direct(data, entries)

    assert len(data) == orig_size, f"File size changed! {orig_size} -> {len(data)}"

    if replaced > 0:
        if not os.path.exists(backup):
            shutil.copy2(fpath, backup)
        with open(fpath, 'wb') as f:
            f.write(bytes(data))

    return replaced, truncated, skipped


def main():
    print("=" * 60)
    print("Esoteric Ebb - Level File In-Place Injector v2 (key-safe)")
    print("=" * 60)

    entries = load_keyed_translations()
    print(f"Keyed translations: {len(entries)}")

    grand_replaced = 0
    grand_truncated = 0
    grand_skipped = 0

    for f in sorted(os.listdir(ASSETS_DIR)):
        if not f.startswith('level') or '.' in f:
            continue
        fpath = os.path.join(ASSETS_DIR, f)
        if not os.path.isfile(fpath):
            continue

        t0 = time.time()
        r, t, s = process_level_file(fpath, entries)
        elapsed = time.time() - t0

        if r > 0:
            print(f"  {f}: {r} replaced ({t} truncated) [{elapsed:.1f}s]")

        grand_replaced += r
        grand_truncated += t
        grand_skipped += s

    print(f"\n{'=' * 60}")
    print(f"Total: {grand_replaced} replaced ({grand_truncated} truncated, {grand_skipped} skipped)")
    print(f"Avvia il gioco!")


if __name__ == '__main__':
    main()
