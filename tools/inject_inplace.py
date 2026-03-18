"""
Esoteric Ebb - In-place injection of Italian translations.
Strategy: Replace ENGLISH column text directly with Italian, 
keeping EXACTLY the same byte length per CSV block.

For strings where Italian is longer: truncate with "…"
For strings where Italian is shorter: pad GERMAN column
"""
import os
import csv
import io
import shutil

RESOURCES_PATH = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets"
BACKUP_PATH = RESOURCES_PATH + ".backup"
TRANSLATED_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated"

SEARCH_PATTERN = b"ID,ENGLISH"


def load_translations(csv_path):
    trans = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            eid = row.get('ID', '').strip()
            it = row.get('ITALIAN', '').strip()
            if eid and it:
                trans[eid] = it
    return trans


def find_csv_blocks(data):
    blocks = []
    pos = 0
    while True:
        idx = data.find(SEARCH_PATTERN, pos)
        if idx == -1:
            break
        end = idx
        while end < len(data) and data[end] != 0:
            end += 1
        try:
            text = data[idx:end].decode('utf-8')
            if len(text) > 20:
                blocks.append({'offset': idx, 'end': end, 'len': end - idx, 'text': text})
        except UnicodeDecodeError:
            pass
        pos = end + 1
    return blocks


def identify_block(text):
    lines = text.strip().split('\n')
    if len(lines) < 2:
        return None
    ids = []
    for line in lines[1:5]:
        parts = line.split(',', 1)
        if parts and parts[0].strip():
            ids.append(parts[0].strip().lower())
    id_str = ' '.join(ids)
    if 'ui_' in id_str or 'death_' in id_str: return 'uielements'
    if 'll_' in id_str or 'vl_' in id_str: return 'popups'
    if 'spell_' in id_str: return 'spelltexts'
    if 'item_' in id_str: return 'itemtexts'
    if 'journal_' in id_str: return 'journaltexts'
    if 'quest_' in id_str: return 'questpoints'
    if 'feat_' in id_str: return 'feats'
    if 'bg_' in id_str: return 'backgrounds'
    return None


def rebuild_csv_replace_english(original_text, translations, target_byte_len):
    """
    Replace ENGLISH column with Italian text.
    Output must be EXACTLY target_byte_len bytes.
    """
    lines = original_text.split('\n')
    if not lines:
        return original_text.encode('utf-8')

    new_lines = [lines[0]]  # Header unchanged

    for line in lines[1:]:
        if not line.strip():
            new_lines.append(line)
            continue

        reader = csv.reader(io.StringIO(line))
        try:
            parts = list(next(reader))
        except StopIteration:
            new_lines.append(line)
            continue

        entry_id = parts[0].strip() if parts else ''

        if entry_id and entry_id in translations and len(parts) > 1:
            parts[1] = translations[entry_id]

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(parts)
        new_lines.append(output.getvalue().rstrip('\r\n'))

    result = '\n'.join(new_lines)
    result_bytes = result.encode('utf-8')

    # Adjust to exact target length
    if len(result_bytes) <= target_byte_len:
        # Pad with spaces at end (before any final newline)
        padding = target_byte_len - len(result_bytes)
        result_bytes = result_bytes + b' ' * padding
    else:
        # Too long - need to truncate some translations
        # Remove translations one by one (longest first) until it fits
        sorted_trans = sorted(translations.items(), key=lambda x: len(x[1]), reverse=True)
        reduced = dict(translations)
        
        for key, _ in sorted_trans:
            if len(result_bytes) <= target_byte_len:
                break
            del reduced[key]
            # Rebuild
            new_lines2 = [lines[0]]
            for line in lines[1:]:
                if not line.strip():
                    new_lines2.append(line)
                    continue
                reader = csv.reader(io.StringIO(line))
                try:
                    parts = list(next(reader))
                except StopIteration:
                    new_lines2.append(line)
                    continue
                entry_id = parts[0].strip() if parts else ''
                if entry_id and entry_id in reduced and len(parts) > 1:
                    parts[1] = reduced[entry_id]
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(parts)
                new_lines2.append(output.getvalue().rstrip('\r\n'))
            result = '\n'.join(new_lines2)
            result_bytes = result.encode('utf-8')

        if len(result_bytes) <= target_byte_len:
            padding = target_byte_len - len(result_bytes)
            result_bytes = result_bytes + b' ' * padding
            return result_bytes, len(reduced)
        else:
            return None, 0

    return result_bytes, len(translations)


def main():
    print("=" * 60)
    print("Esoteric Ebb - In-Place Translation Injector")
    print("Replace ENGLISH column with Italian (same byte length)")
    print("=" * 60)

    # Load translations
    trans_files = {
        'uielements': 'uielements.csv',
        'feats': 'feats.csv',
        'questpoints': 'questpoints.csv',
        'backgrounds': 'table_0.csv',
    }
    all_trans = {}
    for name, fname in trans_files.items():
        fpath = os.path.join(TRANSLATED_DIR, fname)
        if os.path.exists(fpath):
            t = load_translations(fpath)
            if t:
                all_trans[name] = t
                print(f"  {name}: {len(t)} translations")

    total = sum(len(t) for t in all_trans.values())
    print(f"\nTotal: {total} translations")

    # Ensure backup from original
    if not os.path.exists(BACKUP_PATH):
        print(f"\n📦 Backup: {BACKUP_PATH}")
        shutil.copy2(RESOURCES_PATH, BACKUP_PATH)
    
    # Always work from backup (clean original)
    print(f"\n📖 Reading from backup (clean original)...")
    with open(BACKUP_PATH, 'rb') as f:
        data = bytearray(f.read())

    blocks = find_csv_blocks(data)
    print(f"   {len(blocks)} CSV blocks found")

    injected = 0
    for block in blocks:
        table_name = identify_block(block['text'])
        if not table_name or table_name not in all_trans:
            continue

        trans = all_trans[table_name]
        print(f"\n🔧 {table_name} ({block['len']} bytes, {len(trans)} translations)")

        result = rebuild_csv_replace_english(block['text'], trans, block['len'])
        if result[0] is not None:
            new_bytes, count = result
            assert len(new_bytes) == block['len'], f"Size mismatch: {len(new_bytes)} != {block['len']}"
            data[block['offset']:block['end']] = new_bytes
            injected += count
            print(f"   ✅ {count}/{len(trans)} injected")
        else:
            print(f"   ❌ Failed to fit translations")

    print(f"\n💾 Writing modified file...")
    with open(RESOURCES_PATH, 'wb') as f:
        f.write(data)

    print(f"\n{'='*60}")
    print(f"✅ DONE: {injected} translations injected")
    print(f"   Backup: {BACKUP_PATH}")
    print(f"\n🎮 Avvia il gioco - il testo inglese è stato sostituito con l'italiano!")
    print(f"   Non serve cambiare lingua, l'ENGLISH ora è in italiano.")


if __name__ == '__main__':
    main()
