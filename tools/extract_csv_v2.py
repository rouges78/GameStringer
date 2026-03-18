"""
Extract SimpleLocalization CSV tables from Esoteric Ebb
Search for "ID,ENGLISH" as raw bytes in all asset files
"""
import os
import csv
import io
import json

GAME_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables"
SEARCH_PATTERN = b"ID,ENGLISH"

def find_csv_blocks(data: bytes, filename: str) -> list:
    """Find all CSV blocks starting with ID,ENGLISH in raw binary data"""
    blocks = []
    search_start = 0
    
    while True:
        pos = data.find(SEARCH_PATTERN, search_start)
        if pos == -1:
            break
        
        # Find the end of this CSV block
        # CSV ends when we hit a null byte or non-text data
        end = pos
        while end < len(data) and data[end] != 0:
            end += 1
        
        block_data = data[pos:end]
        try:
            text = block_data.decode('utf-8').strip()
            if len(text) > 20:  # Must be substantial
                blocks.append({
                    'offset': pos,
                    'end': end,
                    'length': end - pos,
                    'text': text,
                    'source': filename
                })
        except UnicodeDecodeError:
            pass
        
        search_start = end + 1
    
    return blocks


def identify_table(csv_text: str, index: int) -> str:
    """Identify table type from content"""
    lines = csv_text.strip().split('\n')
    if len(lines) < 2:
        return f"unknown_{index}"
    
    ids = []
    for line in lines[1:10]:
        parts = line.split(',', 1)
        if parts and parts[0].strip():
            ids.append(parts[0].strip().lower())
    
    id_str = ' '.join(ids)
    
    if 'ui_' in id_str or 'death_' in id_str:
        return "uielements"
    elif 'll_' in id_str or 'vl_' in id_str:
        return "popups"
    elif 'spell_' in id_str:
        return "spelltexts"
    elif 'item_' in id_str:
        return "itemtexts"
    elif 'journal_' in id_str:
        return "journaltexts"
    elif 'quest_' in id_str:
        return "questpoints"
    elif 'feat_' in id_str:
        return "feats"
    elif 'sheet_' in id_str or 'str_' in id_str:
        return "sheetinfo"
    
    return f"table_{index}"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("Esoteric Ebb - CSV Extractor v2 (raw byte search)")
    print("=" * 60)
    
    all_blocks = []
    
    # Scan all asset files
    for fname in sorted(os.listdir(GAME_DIR)):
        fpath = os.path.join(GAME_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        # Only scan actual asset files (not .resS which are resource streams)
        if fname.endswith('.resS'):
            continue
        if not (fname.endswith('.assets') or fname.startswith('level') or fname == 'globalgamemanagers' or fname == 'globalgamemanagers.assets'):
            continue
            
        with open(fpath, 'rb') as f:
            data = f.read()
        
        blocks = find_csv_blocks(data, fname)
        if blocks:
            print(f"\n{fname}: {len(blocks)} CSV block(s) found")
            for b in blocks:
                lines = b['text'].split('\n')
                non_empty = sum(1 for l in lines[1:] if l.strip() and l.split(',')[0].strip())
                print(f"  Offset: {b['offset']:#010x}, {b['length']} bytes, {len(lines)} lines, {non_empty} entries")
                # Preview
                for l in lines[:3]:
                    print(f"    {l[:120]}")
                if len(lines) > 3:
                    print(f"    ... ({len(lines)} total)")
            all_blocks.extend(blocks)
    
    print(f"\n{'='*60}")
    print(f"Total CSV blocks found: {len(all_blocks)}")
    print(f"{'='*60}\n")
    
    # Process each block
    all_entries = []
    for idx, block in enumerate(all_blocks):
        table_name = identify_table(block['text'], idx)
        
        # Parse CSV
        entries = []
        reader = csv.reader(io.StringIO(block['text']))
        header = None
        for row in reader:
            if not row:
                continue
            if header is None:
                header = row
                continue
            if not row[0].strip():
                continue
            entry = {
                'id': row[0].strip(),
                'english': row[1].strip() if len(row) > 1 else '',
                'german': row[2].strip() if len(row) > 2 else '',
                'table': table_name,
                'source': block['source'],
                'csv_offset': block['offset']
            }
            entries.append(entry)
        
        non_empty = sum(1 for e in entries if e['english'])
        print(f"Table: {table_name} ({block['source']})")
        print(f"  {len(entries)} entries, {non_empty} with English text")
        
        # Save individual CSV with ITALIAN column
        csv_path = os.path.join(OUTPUT_DIR, f"{table_name}.csv")
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['ID', 'ENGLISH', 'ITALIAN'])
            for e in entries:
                writer.writerow([e['id'], e['english'], ''])
        print(f"  Saved: {csv_path}")
        
        # Save raw
        raw_path = os.path.join(OUTPUT_DIR, f"{table_name}_raw.txt")
        with open(raw_path, 'w', encoding='utf-8') as f:
            f.write(block['text'])
        
        all_entries.extend(entries)
    
    # Save combined
    combined_path = os.path.join(OUTPUT_DIR, "all_tables.json")
    with open(combined_path, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)
    
    # Summary
    print(f"\n{'='*60}")
    print(f"FINAL SUMMARY")
    print(f"{'='*60}")
    print(f"Tables: {len(all_blocks)}")
    print(f"Total entries: {len(all_entries)}")
    print(f"With English text: {sum(1 for e in all_entries if e['english'])}")
    
    # Show all unique English texts for translation
    translatable = [e for e in all_entries if e['english'] and e['english'] not in ('...', 'SPELLNAME', 'SPELL DESC', 'ItemName', 'Item descriptions here.', 'Popup text here.')]
    print(f"Translatable entries: {len(translatable)}")
    print(f"\nFiles saved to: {OUTPUT_DIR}")


if __name__ == '__main__':
    main()
