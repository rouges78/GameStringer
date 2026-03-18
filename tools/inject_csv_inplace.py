"""
In-place CSV injection for Esoteric Ebb.
Replaces English text with Italian WITHOUT changing file size.
Uses smart truncation: shorter translations create slack for longer ones.
"""
import struct, os, csv, io, shutil

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
TRANS_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated"
TARGET = os.path.join(ASSETS_DIR, "resources.assets")
BACKUP = TARGET + ".backup"

SEARCH = b"ID,ENGLISH"


def load_trans(path):
    if not os.path.exists(path):
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        t = {}
        for row in reader:
            eid = row.get('ID', '').strip()
            eng = row.get('ENGLISH', '').strip()
            ita = row.get('ITALIAN', '').strip()
            if eid and eng and ita and eng != ita:
                t[eid] = ita
        return t


def ident(text):
    lines = text.strip().split('\n')
    if len(lines) < 2:
        return None
    ids = ' '.join(l.split(',', 1)[0].strip().lower() for l in lines[1:5] if l.strip())
    if 'ui_' in ids or 'death_' in ids:
        return 'uielements'
    if 'll_' in ids or 'vl_' in ids:
        return 'popups'
    if 'quest_' in ids:
        return 'questpoints'
    if 'feat_' in ids:
        return 'feats'
    if 'bg_' in ids:
        return 'backgrounds'
    return None


def replace_english(csv_text, trans):
    """Replace English column with Italian translations."""
    lines = csv_text.split('\n')
    header = lines[0]
    cols = header.split(',')

    try:
        eng_idx = cols.index('ENGLISH')
    except ValueError:
        return csv_text, 0

    new_lines = [header]
    count = 0
    for line in lines[1:]:
        if not line.strip():
            new_lines.append(line)
            continue
        parts = line.split(',')
        row_id = parts[0].strip() if parts else ''
        if row_id in trans and len(parts) > eng_idx:
            # Replace commas in translation with placeholder to avoid CSV issues
            ita = trans[row_id].replace(',', ';')
            parts[eng_idx] = ita
            count += 1
        new_lines.append(','.join(parts))

    return '\n'.join(new_lines), count


def fit_csv_inplace(original_csv, translated_csv, max_bytes):
    """
    Fit translated CSV into max_bytes by progressively truncating
    the longest cell values that exceed their original length.
    """
    trans_bytes = translated_csv.encode('utf-8')
    if len(trans_bytes) <= max_bytes:
        return translated_csv, 0  # fits!

    excess = len(trans_bytes) - max_bytes

    # Parse rows and find which cells grew the most
    orig_lines = original_csv.split('\n')
    trans_lines = translated_csv.split('\n')

    # Build list of (line_idx, col_idx, orig_len, trans_len, excess)
    growths = []
    for i in range(1, min(len(orig_lines), len(trans_lines))):
        orig_parts = orig_lines[i].split(',')
        trans_parts = trans_lines[i].split(',')
        if len(orig_parts) > 1 and len(trans_parts) > 1:
            orig_cell = orig_parts[1]  # ENGLISH column
            trans_cell = trans_parts[1]
            cell_excess = len(trans_cell.encode('utf-8')) - len(orig_cell.encode('utf-8'))
            if cell_excess > 0:
                growths.append((i, cell_excess, len(trans_cell.encode('utf-8'))))

    # Sort by excess (largest first) — truncate biggest offenders first
    growths.sort(key=lambda x: -x[1])

    truncated = 0
    remaining_excess = excess

    for line_idx, cell_excess, cell_len in growths:
        if remaining_excess <= 0:
            break

        # How much to cut from this cell
        cut = min(cell_excess, remaining_excess)
        trans_parts = trans_lines[line_idx].split(',')
        cell_text = trans_parts[1]

        # Truncate: remove 'cut' bytes from end, try to cut at word boundary
        cell_bytes = cell_text.encode('utf-8')
        target_len = len(cell_bytes) - cut
        if target_len < 10:
            target_len = 10

        truncated_bytes = cell_bytes[:target_len]
        # Try to decode safely
        while target_len > 0:
            try:
                truncated_text = truncated_bytes.decode('utf-8')
                break
            except UnicodeDecodeError:
                target_len -= 1
                truncated_bytes = cell_bytes[:target_len]

        # Cut at last space for word boundary
        last_space = truncated_text.rfind(' ')
        if last_space > len(truncated_text) // 2:
            truncated_text = truncated_text[:last_space]

        trans_parts[1] = truncated_text
        trans_lines[line_idx] = ','.join(trans_parts)
        remaining_excess -= cut
        truncated += 1

    result = '\n'.join(trans_lines)
    result_bytes = result.encode('utf-8')

    # Final safety: hard truncate if still too long
    if len(result_bytes) > max_bytes:
        result_bytes = result_bytes[:max_bytes]
        # Ensure valid UTF-8
        while len(result_bytes) > 0:
            try:
                result = result_bytes.decode('utf-8')
                break
            except UnicodeDecodeError:
                result_bytes = result_bytes[:-1]

    return result, truncated


def find_blocks(data):
    """Find all length-prefixed CSV blocks."""
    blocks = []
    pos = 0
    while pos + len(SEARCH) < len(data):
        idx = data.find(SEARCH, pos)
        if idx == -1:
            break
        if idx >= 4:
            pre_len = struct.unpack_from('<I', data, idx - 4)[0]
            end = idx
            while end < len(data) and data[end] != 0:
                end += 1
            csv_len = end - idx
            if pre_len == csv_len:
                padded_len = csv_len + (4 - csv_len % 4) % 4
                try:
                    text = data[idx:end].decode('utf-8')
                    blocks.append({
                        'lp_offset': idx - 4,
                        'text_offset': idx,
                        'text_end': end,
                        'old_len': csv_len,
                        'old_padded': padded_len,
                        'text': text,
                    })
                except:
                    pass
        pos = idx + 1 if idx >= 0 else len(data)
    return blocks


def main():
    print("=" * 60)
    print("Esoteric Ebb - In-Place CSV Injector (no resize)")
    print("=" * 60)

    # Load translations
    tm = {}
    for n, f in [('uielements', 'uielements.csv'), ('feats', 'feats.csv'),
                  ('questpoints', 'questpoints.csv'), ('backgrounds', 'table_0.csv')]:
        t = load_trans(os.path.join(TRANS_DIR, f))
        if t:
            tm[n] = t
            print(f"  {n}: {len(t)}")
    print(f"  Total: {sum(len(v) for v in tm.values())}")

    # Read clean backup
    with open(BACKUP, 'rb') as f:
        data = bytearray(f.read())
    orig_size = len(data)
    print(f"\nOriginal: {orig_size:,} bytes")

    # Find CSV blocks
    blocks = find_blocks(data)
    print(f"CSV blocks: {len(blocks)}")

    total_injected = 0
    total_truncated = 0

    for block in blocks:
        name = ident(block['text'])
        if not name or name not in tm:
            continue

        trans = tm[name]
        translated_csv, count = replace_english(block['text'], trans)
        if count == 0:
            continue

        # Keep ORIGINAL LP value — fit text within original LP boundary
        max_text_bytes = block['old_len']  # original LP value, NOT padded

        fitted_csv, trunc_count = fit_csv_inplace(block['text'], translated_csv, max_text_bytes)
        fitted_bytes = fitted_csv.encode('utf-8')
        new_len = len(fitted_bytes)

        # Write text + null padding (do NOT change LP)
        text_off = block['text_offset']
        region_start = text_off
        region_end = text_off + block['old_padded']

        # Fit within original LP size, pad rest with nulls
        if new_len > block['old_len']:
            fitted_bytes = fitted_bytes[:block['old_len']]
            new_len = block['old_len']
        new_region = fitted_bytes + b'\x00' * (block['old_padded'] - new_len)
        data[region_start:region_end] = new_region

        pct = (new_len / len(translated_csv.encode('utf-8'))) * 100 if trunc_count > 0 else 100
        print(f"\n  {name}: {count} translated, {trunc_count} truncated")
        print(f"    {block['old_len']} → {new_len} bytes (max: {max_text_bytes})")
        if trunc_count > 0:
            print(f"    Content preserved: {pct:.1f}%")

        total_injected += count
        total_truncated += trunc_count

    # Verify file size unchanged
    assert len(data) == orig_size, f"File size changed! {orig_size} → {len(data)}"

    # Write
    with open(TARGET, 'wb') as f:
        f.write(bytes(data))

    print(f"\n{'=' * 60}")
    print(f"✅ DONE: {total_injected} translated, {total_truncated} truncated")
    print(f"File size: {orig_size:,} (unchanged)")
    print(f"Written: {TARGET}")


if __name__ == '__main__':
    main()
