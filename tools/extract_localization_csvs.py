"""
Extract all SimpleLocalization CSV tables from Esoteric Ebb's resources.assets
The game uses CSV format: ID,ENGLISH,GERMAN embedded as length-prefixed strings
"""
import struct
import os
import csv
import io

RESOURCES_PATH = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables"

# Known localization table names from globalgamemanagers
TABLE_NAMES = [
    "uielements", "popups", "spelltexts", "itemtexts", 
    "journaltexts", "questpoints", "feats", "sheetinfo",
    "menu", "settings", "tests"
]

def extract_all_csvs(data: bytes) -> list:
    """Find all CSV-like strings with ID,ENGLISH header in the binary data"""
    csvs_found = []
    
    # Search for "ID,ENGLISH" pattern in length-prefixed strings
    search = b"ID,ENGLISH"
    
    i = 0
    while i + 4 < len(data):
        str_len = struct.unpack_from('<I', data, i)[0]
        
        if 10 <= str_len <= 500000 and i + 4 + str_len <= len(data):
            str_data = data[i + 4:i + 4 + str_len]
            
            if str_data.startswith(search):
                try:
                    text = str_data.decode('utf-8')
                    csvs_found.append({
                        'offset': i,
                        'length': str_len,
                        'text': text,
                        'lines': text.count('\n') + 1
                    })
                    print(f"  Found CSV at offset {i:#010x}, {str_len} bytes, {text.count(chr(10))+1} lines")
                    # Show first 3 lines as preview
                    lines = text.split('\n')
                    for line in lines[:3]:
                        print(f"    {line[:100]}")
                    if len(lines) > 3:
                        print(f"    ... ({len(lines)} lines total)")
                except UnicodeDecodeError:
                    pass
                
                i += 4 + str_len
                padding = (4 - (str_len % 4)) % 4
                i += padding
                continue
            
            i += 4 + str_len
            padding = (4 - (str_len % 4)) % 4
            i += padding
        else:
            i += 1
    
    return csvs_found


def identify_table(csv_text: str) -> str:
    """Try to identify which localization table this is based on content"""
    lines = csv_text.strip().split('\n')
    if len(lines) < 2:
        return "unknown"
    
    # Check IDs in the CSV
    first_ids = []
    for line in lines[1:5]:
        parts = line.split(',', 1)
        if parts:
            first_ids.append(parts[0])
    
    id_str = ' '.join(first_ids).lower()
    
    if any(x in id_str for x in ['ui_', 'death_', 'newgame', 'load', 'option']):
        return "uielements"
    elif any(x in id_str for x in ['ll_', 'vl_', 'popup']):
        return "popups"
    elif any(x in id_str for x in ['spell_', 'spellname', 'spell desc']):
        return "spelltexts"
    elif any(x in id_str for x in ['item_', 'itemname']):
        return "itemtexts"
    elif any(x in id_str for x in ['journal_']):
        return "journaltexts"
    elif any(x in id_str for x in ['quest_', 'questpoint']):
        return "questpoints"
    elif any(x in id_str for x in ['feat_']):
        return "feats"
    elif any(x in id_str for x in ['sheet_', 'str_', 'dex_', 'int_']):
        return "sheetinfo"
    
    return f"table_{len(first_ids)}"


def parse_csv_entries(csv_text: str) -> list:
    """Parse CSV text into entries, handling quoted fields"""
    entries = []
    reader = csv.reader(io.StringIO(csv_text))
    
    header = None
    for row in reader:
        if not row:
            continue
        if header is None:
            header = row
            continue
        if not row[0].strip():  # skip empty ID rows
            continue
        
        entry = {'id': row[0].strip()}
        if len(row) > 1:
            entry['english'] = row[1].strip()
        if len(row) > 2:
            entry['german'] = row[2].strip()
        
        entries.append(entry)
    
    return entries


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("Esoteric Ebb - CSV Localization Extractor")
    print("=" * 60)
    print(f"Reading: {RESOURCES_PATH}")
    print(f"Output:  {OUTPUT_DIR}\n")
    
    with open(RESOURCES_PATH, 'rb') as f:
        data = f.read()
    
    print(f"File size: {len(data):,} bytes\n")
    
    # Also search in level0 which had some strings
    level0_path = RESOURCES_PATH.replace('resources.assets', 'level0')
    level0_data = None
    if os.path.exists(level0_path):
        with open(level0_path, 'rb') as f:
            level0_data = f.read()
        print(f"Also scanning level0: {len(level0_data):,} bytes\n")
    
    print("Searching for CSV tables in resources.assets...")
    csvs = extract_all_csvs(data)
    
    if level0_data:
        print("\nSearching for CSV tables in level0...")
        level0_csvs = extract_all_csvs(level0_data)
        for c in level0_csvs:
            c['source'] = 'level0'
        csvs.extend(level0_csvs)
    
    # Also scan all level files and sharedassets for CSV tables
    game_dir = os.path.dirname(RESOURCES_PATH)
    for fname in sorted(os.listdir(game_dir)):
        fpath = os.path.join(game_dir, fname)
        if not os.path.isfile(fpath):
            continue
        if fname in ('resources.assets', 'level0'):
            continue  # already scanned
        if fname.startswith('level') or fname.startswith('sharedassets'):
            print(f"\nSearching in {fname}...")
            with open(fpath, 'rb') as f:
                fdata = f.read()
            found = extract_all_csvs(fdata)
            for c in found:
                c['source'] = fname
            csvs.extend(found)
    
    print(f"\n{'='*60}")
    print(f"Found {len(csvs)} CSV localization tables total\n")
    
    # Process and save each CSV
    all_entries = []
    for idx, csv_data in enumerate(csvs):
        table_name = identify_table(csv_data['text'])
        source = csv_data.get('source', 'resources.assets')
        entries = parse_csv_entries(csv_data['text'])
        
        # Count non-empty English entries
        non_empty = sum(1 for e in entries if e.get('english', '').strip())
        
        print(f"Table #{idx+1}: {table_name} ({source})")
        print(f"  Entries: {len(entries)} total, {non_empty} with English text")
        print(f"  Offset: {csv_data['offset']:#010x}, Size: {csv_data['length']} bytes")
        
        # Save individual CSV
        csv_path = os.path.join(OUTPUT_DIR, f"{table_name}.csv")
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['ID', 'ENGLISH', 'ITALIAN'])
            for e in entries:
                writer.writerow([e['id'], e.get('english', ''), ''])
        print(f"  Saved: {csv_path}")
        
        # Save raw text too
        raw_path = os.path.join(OUTPUT_DIR, f"{table_name}_raw.txt")
        with open(raw_path, 'w', encoding='utf-8') as f:
            f.write(csv_data['text'])
        
        for e in entries:
            e['table'] = table_name
            e['source'] = source
            e['csv_offset'] = csv_data['offset']
        all_entries.extend(entries)
    
    # Save combined JSON for translation
    import json
    combined_path = os.path.join(OUTPUT_DIR, "all_tables_combined.json")
    with open(combined_path, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)
    
    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total tables: {len(csvs)}")
    print(f"Total entries: {len(all_entries)}")
    non_empty_total = sum(1 for e in all_entries if e.get('english', '').strip())
    print(f"Entries with English text: {non_empty_total}")
    print(f"\nAll files saved to: {OUTPUT_DIR}")


if __name__ == '__main__':
    main()
