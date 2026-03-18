"""
Esoteric Ebb - Inject Italian translations into resources.assets
Writes Italian text into the GERMAN column of each CSV table in the binary.
Player selects "German" in-game language menu to see Italian.
"""
import os
import csv
import io
import struct
import shutil
import json

RESOURCES_PATH = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets"
BACKUP_PATH = RESOURCES_PATH + ".backup"
TRANSLATED_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated"
RAW_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables"

SEARCH_PATTERN = b"ID,ENGLISH"


def load_translations(csv_path):
    """Load translated CSV into dict: id -> italian text"""
    trans = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry_id = row.get('ID', '').strip()
            italian = row.get('ITALIAN', '').strip()
            if entry_id and italian:
                trans[entry_id] = italian
    return trans


def rebuild_csv_with_italian(raw_text, translations):
    """
    Take original CSV text (ID,ENGLISH,GERMAN or ID,ENGLISH,CHINESE,GERMAN,SPANISH,FRENCH)
    and inject Italian text into the GERMAN column.
    Returns the new CSV as bytes.
    """
    lines = raw_text.split('\n')
    if not lines:
        return raw_text.encode('utf-8')
    
    # Parse header to find column positions
    header_parts = lines[0].split(',')
    header_lower = [h.strip().lower() for h in header_parts]
    
    german_idx = None
    for i, h in enumerate(header_lower):
        if h == 'german':
            german_idx = i
            break
    
    if german_idx is None:
        print(f"    ⚠️ No GERMAN column found in header: {lines[0]}")
        return raw_text.encode('utf-8')
    
    new_lines = [lines[0]]  # Keep header unchanged
    
    for line in lines[1:]:
        if not line.strip():
            new_lines.append(line)
            continue
        
        # Parse CSV line properly (handle quoted fields)
        reader = csv.reader(io.StringIO(line))
        try:
            parts = next(reader)
        except StopIteration:
            new_lines.append(line)
            continue
        
        entry_id = parts[0].strip() if parts else ''
        
        if entry_id and entry_id in translations:
            # Ensure we have enough columns
            while len(parts) <= german_idx:
                parts.append('')
            parts[german_idx] = translations[entry_id]
        
        # Write back as CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(parts)
        new_lines.append(output.getvalue().rstrip('\r\n'))
    
    return '\n'.join(new_lines).encode('utf-8')


def find_csv_blocks(data):
    """Find all CSV blocks (ID,ENGLISH...) in binary data, return offsets and text"""
    blocks = []
    pos = 0
    while True:
        idx = data.find(SEARCH_PATTERN, pos)
        if idx == -1:
            break
        
        # Find end (null byte)
        end = idx
        while end < len(data) and data[end] != 0:
            end += 1
        
        try:
            text = data[idx:end].decode('utf-8')
            if len(text) > 20:
                blocks.append({
                    'offset': idx,
                    'end': end,
                    'original_len': end - idx,
                    'text': text,
                })
        except UnicodeDecodeError:
            pass
        
        pos = end + 1
    
    return blocks


def identify_block(text):
    """Identify which table a CSV block belongs to"""
    lines = text.strip().split('\n')
    if len(lines) < 2:
        return None
    
    ids = []
    for line in lines[1:5]:
        parts = line.split(',', 1)
        if parts and parts[0].strip():
            ids.append(parts[0].strip().lower())
    
    id_str = ' '.join(ids)
    
    if 'ui_' in id_str or 'death_' in id_str:
        return 'uielements'
    elif 'll_' in id_str or 'vl_' in id_str:
        return 'popups'
    elif 'spell_' in id_str:
        return 'spelltexts'
    elif 'item_' in id_str:
        return 'itemtexts'
    elif 'journal_' in id_str:
        return 'journaltexts'
    elif 'quest_' in id_str:
        return 'questpoints'
    elif 'feat_' in id_str:
        return 'feats'
    elif 'bg_' in id_str:
        return 'backgrounds'
    return None


def main():
    print("=" * 60)
    print("Esoteric Ebb - Translation Injector")
    print("=" * 60)
    
    # Load all translations
    all_trans = {}
    trans_files = {
        'uielements': 'uielements.csv',
        'feats': 'feats.csv',
        'popups': 'popups.csv',
        'questpoints': 'questpoints.csv',
        'backgrounds': 'table_0.csv',
        'journaltexts': 'journaltexts.csv',
        'spelltexts': 'spelltexts.csv',
        'itemtexts': 'itemtexts.csv',
    }
    
    for table_name, filename in trans_files.items():
        fpath = os.path.join(TRANSLATED_DIR, filename)
        if os.path.exists(fpath):
            trans = load_translations(fpath)
            all_trans[table_name] = trans
            print(f"  Loaded {table_name}: {len(trans)} translations")
    
    total_trans = sum(len(t) for t in all_trans.values())
    print(f"\nTotal translations loaded: {total_trans}")
    
    # Backup original
    if not os.path.exists(BACKUP_PATH):
        print(f"\n📦 Creating backup: {BACKUP_PATH}")
        shutil.copy2(RESOURCES_PATH, BACKUP_PATH)
    else:
        print(f"\n📦 Backup already exists: {BACKUP_PATH}")
    
    # Read binary
    print(f"\n📖 Reading: {RESOURCES_PATH}")
    with open(RESOURCES_PATH, 'rb') as f:
        data = bytearray(f.read())
    
    print(f"   File size: {len(data):,} bytes")
    
    # Find CSV blocks
    blocks = find_csv_blocks(data)
    print(f"   Found {len(blocks)} CSV blocks")
    
    # Process each block
    injected_total = 0
    
    # Process in reverse order so offsets don't shift
    blocks.sort(key=lambda b: b['offset'], reverse=True)
    
    for block in blocks:
        table_name = identify_block(block['text'])
        if not table_name:
            print(f"\n⚠️ Unknown table at offset {block['offset']:#010x}, skipping")
            continue
        
        if table_name not in all_trans or not all_trans[table_name]:
            print(f"\n⏭️ {table_name}: no translations, skipping")
            continue
        
        trans = all_trans[table_name]
        print(f"\n🔧 {table_name} at offset {block['offset']:#010x}")
        print(f"   Original: {block['original_len']} bytes, {len(trans)} translations")
        
        # Rebuild CSV with Italian in GERMAN column
        new_csv = rebuild_csv_with_italian(block['text'], trans)
        new_len = len(new_csv)
        
        print(f"   New CSV: {new_len} bytes")
        
        if new_len > block['original_len']:
            # New CSV is larger - need to handle this
            # For null-terminated strings, we can expand if there's padding after
            # Check bytes after the null terminator
            end_pos = block['end']
            padding_available = 0
            while end_pos + padding_available < len(data) and data[end_pos + padding_available] == 0:
                padding_available += 1
            
            extra_needed = new_len - block['original_len']
            
            if extra_needed <= padding_available:
                print(f"   ✅ Expanding into {padding_available} bytes of padding (need {extra_needed})")
                # Replace original block + eat into padding
                data[block['offset']:block['offset'] + new_len] = new_csv
                injected_total += len(trans)
            else:
                print(f"   ❌ New CSV too large! Need {extra_needed} extra bytes but only {padding_available} padding available")
                print(f"   Trying truncated approach...")
                # Truncate translations to fit
                truncated_trans = {}
                for k, v in trans.items():
                    truncated_trans[k] = v
                
                while True:
                    test_csv = rebuild_csv_with_italian(block['text'], truncated_trans)
                    if len(test_csv) <= block['original_len'] + padding_available:
                        break
                    # Remove longest translation
                    if not truncated_trans:
                        break
                    longest_key = max(truncated_trans, key=lambda k: len(truncated_trans[k]))
                    del truncated_trans[longest_key]
                
                if truncated_trans:
                    final_csv = rebuild_csv_with_italian(block['text'], truncated_trans)
                    data[block['offset']:block['offset'] + len(final_csv)] = final_csv
                    # Pad remaining with nulls
                    remaining = (block['original_len'] + padding_available) - len(final_csv)
                    if remaining > 0:
                        for i in range(remaining):
                            if block['offset'] + len(final_csv) + i < len(data):
                                data[block['offset'] + len(final_csv) + i] = 0
                    injected_total += len(truncated_trans)
                    print(f"   ⚠️ Truncated: {len(truncated_trans)}/{len(trans)} translations fit")
                else:
                    print(f"   ❌ Cannot inject any translations for {table_name}")
        else:
            # New CSV fits or is smaller - easy case
            data[block['offset']:block['offset'] + new_len] = new_csv
            # Fill remaining space with nulls
            remaining = block['original_len'] - new_len
            for i in range(remaining):
                data[block['offset'] + new_len + i] = 0
            injected_total += len(trans)
            print(f"   ✅ Injected! ({remaining} bytes padding)")
    
    # Write modified file
    print(f"\n{'='*60}")
    print(f"💾 Writing modified resources.assets...")
    with open(RESOURCES_PATH, 'wb') as f:
        f.write(data)
    
    print(f"\n{'='*60}")
    print(f"✅ INJECTION COMPLETE")
    print(f"   Translations injected: {injected_total}")
    print(f"   Backup at: {BACKUP_PATH}")
    print(f"\n🎮 Per vedere l'italiano nel gioco:")
    print(f"   1. Avvia Esoteric Ebb")
    print(f"   2. Vai su Options → Languages")
    print(f"   3. Seleziona 'German'")
    print(f"   4. Il testo sarà in italiano!")


if __name__ == '__main__':
    main()
