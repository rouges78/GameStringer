"""
Unity Serialized File TextAsset Injector
Parses the Unity serialized file format, finds TextAsset objects containing
CSV localization data, replaces their content with translated versions,
and rebuilds the file with correct offsets and sizes.

Supports Unity serialized file format version >= 22 (Unity 2020+).
"""
import struct
import os
import csv
import io
import shutil

RESOURCES_PATH = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data\resources.assets"
BACKUP_PATH = RESOURCES_PATH + ".backup"
TRANSLATED_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables\translated"


class UnitySerializedFile:
    """Parser/writer for Unity serialized files (format version >= 17)"""
    
    def __init__(self, data: bytearray):
        self.data = data
        self.metadata_size = 0
        self.file_size = 0
        self.version = 0
        self.data_offset = 0
        self.endian = '>'  # big endian by default
        self.unity_version = ''
        self.target_platform = 0
        self.type_tree_enabled = False
        self.types = []
        self.objects = []
        self.raw_header_end = 0
        
    def read(self):
        """Parse the serialized file header and object table"""
        pos = 0
        
        # Header (big-endian)
        self.metadata_size = struct.unpack_from('>I', self.data, pos)[0]; pos += 4
        file_size_32 = struct.unpack_from('>I', self.data, pos)[0]; pos += 4
        self.version = struct.unpack_from('>I', self.data, pos)[0]; pos += 4
        data_offset_32 = struct.unpack_from('>I', self.data, pos)[0]; pos += 4
        
        print(f"  Format version: {self.version}")
        print(f"  Metadata size (header): {self.metadata_size}")
        print(f"  File size (header): {file_size_32}")
        print(f"  Data offset (header): {data_offset_32}")
        
        if self.version >= 9:
            endian_byte = self.data[pos]; pos += 1
            pos += 3  # reserved
            self.endian = '>' if endian_byte else '<'
            
            if self.version >= 22:
                self.metadata_size = struct.unpack_from('>I', self.data, pos)[0]; pos += 4
                self.file_size = struct.unpack_from('>Q', self.data, pos)[0]; pos += 8
                self.data_offset = struct.unpack_from('>Q', self.data, pos)[0]; pos += 8
                _unknown = struct.unpack_from('>Q', self.data, pos)[0]; pos += 8
            else:
                self.file_size = file_size_32
                self.data_offset = data_offset_32
        else:
            self.file_size = file_size_32
            self.data_offset = data_offset_32
        
        print(f"  Endianness: {'big' if self.endian == '>' else 'little'}")
        print(f"  Actual file_size: {self.file_size}")
        print(f"  Actual data_offset: {self.data_offset}")
        
        # Unity version string (null-terminated)
        unity_ver_start = pos
        while pos < len(self.data) and self.data[pos] != 0:
            pos += 1
        self.unity_version = self.data[unity_ver_start:pos].decode('ascii', errors='replace')
        pos += 1  # null terminator
        print(f"  Unity version: {self.unity_version}")
        
        # Target platform
        self.target_platform = struct.unpack_from('<I', self.data, pos)[0]; pos += 4
        
        # Type tree enabled
        self.type_tree_enabled = self.data[pos] != 0; pos += 1
        print(f"  Type tree: {self.type_tree_enabled}")
        
        # Type count
        type_count = struct.unpack_from('<I', self.data, pos)[0]; pos += 4
        print(f"  Type count: {type_count}")
        
        # Skip type entries (we don't need to modify them)
        for i in range(type_count):
            class_id = struct.unpack_from('<i', self.data, pos)[0]; pos += 4
            is_stripped = self.data[pos]; pos += 1
            script_type_index = struct.unpack_from('<h', self.data, pos)[0]; pos += 2
            
            if class_id == 114:  # MonoBehaviour
                script_hash = self.data[pos:pos+16]; pos += 16
            
            type_hash = self.data[pos:pos+16]; pos += 16
            
            if self.type_tree_enabled:
                # Skip type tree data
                node_count = struct.unpack_from('<I', self.data, pos)[0]; pos += 4
                string_size = struct.unpack_from('<I', self.data, pos)[0]; pos += 4
                pos += node_count * 32  # each node is 32 bytes
                pos += string_size
            
            self.types.append({
                'class_id': class_id,
                'is_stripped': is_stripped,
                'script_type_index': script_type_index,
            })
        
        # Object count
        object_count = struct.unpack_from('<I', self.data, pos)[0]; pos += 4
        print(f"  Object count: {object_count}")
        
        self.objects_table_offset = pos
        
        # Parse object entries
        for i in range(object_count):
            # Align to 4 bytes
            if pos % 4 != 0:
                pos += 4 - (pos % 4)
            
            if self.version >= 22:
                path_id = struct.unpack_from('<q', self.data, pos)[0]; pos += 8
            else:
                path_id = struct.unpack_from('<i', self.data, pos)[0]; pos += 4
            
            byte_start = struct.unpack_from('<I', self.data, pos)[0]; pos += 4
            byte_size = struct.unpack_from('<I', self.data, pos)[0]; pos += 4
            type_id = struct.unpack_from('<I', self.data, pos)[0]; pos += 4
            
            self.objects.append({
                'index': i,
                'path_id': path_id,
                'byte_start': byte_start,  # relative to data_offset
                'byte_size': byte_size,
                'type_id': type_id,
                'table_entry_offset': pos - (20 if self.version >= 22 else 16),
            })
        
        self.raw_header_end = pos
        print(f"  Header ends at: {pos}")
        print(f"  Data starts at: {self.data_offset}")
        
        return self
    
    def find_text_assets(self):
        """Find objects that contain CSV localization data"""
        text_assets = []
        
        for obj in self.objects:
            abs_offset = self.data_offset + obj['byte_start']
            if abs_offset + 8 >= len(self.data):
                continue
            
            # TextAsset format: 
            #   4 bytes: name length (LE)
            #   N bytes: name string
            #   padding to 4
            #   4 bytes: data length (LE)
            #   N bytes: data (the CSV text)
            
            name_len = struct.unpack_from('<I', self.data, abs_offset)[0]
            if name_len > 200 or name_len == 0:
                continue
            
            name_end = abs_offset + 4 + name_len
            if name_end >= len(self.data):
                continue
            
            try:
                name = self.data[abs_offset + 4:name_end].decode('utf-8')
            except:
                continue
            
            # Align to 4 after name
            name_padded = name_len + (4 - name_len % 4) % 4
            data_len_offset = abs_offset + 4 + name_padded
            
            if data_len_offset + 4 >= len(self.data):
                continue
            
            data_len = struct.unpack_from('<I', self.data, data_len_offset)[0]
            data_start = data_len_offset + 4
            
            if data_start + data_len > len(self.data) or data_len > 500000:
                continue
            
            try:
                text_data = self.data[data_start:data_start + data_len].decode('utf-8')
            except:
                continue
            
            if text_data.startswith('ID,ENGLISH'):
                text_assets.append({
                    'obj': obj,
                    'name': name,
                    'abs_offset': abs_offset,
                    'data_len_offset': data_len_offset,
                    'data_start': data_start,
                    'data_len': data_len,
                    'text': text_data,
                })
                print(f"  Found TextAsset: '{name}' at obj#{obj['index']}, "
                      f"data_len={data_len}, lines={text_data.count(chr(10))+1}")
        
        return text_assets
    
    def replace_text_asset_data(self, ta, new_text):
        """Replace a TextAsset's data with new content, adjusting sizes and offsets"""
        new_bytes = new_text.encode('utf-8')
        old_len = ta['data_len']
        new_len = len(new_bytes)
        
        # Calculate old padded size and new padded size
        old_padded = old_len + (4 - old_len % 4) % 4
        new_padded = new_len + (4 - new_len % 4) % 4
        size_diff = new_padded - old_padded
        
        print(f"    Old: {old_len} bytes (padded: {old_padded})")
        print(f"    New: {new_len} bytes (padded: {new_padded})")
        print(f"    Diff: {size_diff:+d} bytes")
        
        data_start = ta['data_start']
        data_end = data_start + old_padded
        
        # Build new data section: new content + null padding to alignment
        new_section = new_bytes + b'\x00' * (new_padded - new_len)
        
        # Replace in the bytearray
        self.data[data_start:data_end] = new_section
        
        # Update the data length field
        struct.pack_into('<I', self.data, ta['data_len_offset'], new_len)
        
        # Update this object's byte_size in the object table
        obj = ta['obj']
        old_obj_size = obj['byte_size']
        new_obj_size = old_obj_size + size_diff
        
        # Write new byte_size
        obj_entry_offset = obj['table_entry_offset']
        if self.version >= 22:
            struct.pack_into('<I', self.data, obj_entry_offset + 12, new_obj_size)
        else:
            struct.pack_into('<I', self.data, obj_entry_offset + 8, new_obj_size)
        
        obj['byte_size'] = new_obj_size
        
        # Adjust byte_start of all subsequent objects
        if size_diff != 0:
            for other_obj in self.objects:
                if other_obj['byte_start'] > obj['byte_start']:
                    other_obj['byte_start'] += size_diff
                    other_entry = other_obj['table_entry_offset']
                    if self.version >= 22:
                        struct.pack_into('<I', self.data, other_entry + 8, other_obj['byte_start'])
                    else:
                        struct.pack_into('<I', self.data, other_entry + 4, other_obj['byte_start'])
            
            # Update file size in header
            self.file_size += size_diff
            if self.version >= 22:
                struct.pack_into('>Q', self.data, 24, self.file_size)
            else:
                struct.pack_into('>I', self.data, 4, self.file_size)
            
            # Update metadata_size if needed (probably not for data section changes)
        
        return size_diff


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


def rebuild_csv_replace_english(original_text, translations):
    """Replace ENGLISH column with Italian translations"""
    lines = original_text.split('\n')
    new_lines = [lines[0]]  # Keep header

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

    return '\n'.join(new_lines)


def identify_table(text):
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


def main():
    print("=" * 60)
    print("Unity TextAsset Injector - Full Resize Support")
    print("=" * 60)
    
    # Load translations
    trans_map = {}
    for name, fname in [('uielements','uielements.csv'), ('feats','feats.csv'),
                         ('questpoints','questpoints.csv'), ('backgrounds','table_0.csv')]:
        fpath = os.path.join(TRANSLATED_DIR, fname)
        if os.path.exists(fpath):
            t = load_translations(fpath)
            if t:
                trans_map[name] = t
                print(f"  {name}: {len(t)} translations")
    
    total = sum(len(t) for t in trans_map.values())
    print(f"\nTotal: {total} translations")
    
    # Backup
    if not os.path.exists(BACKUP_PATH):
        shutil.copy2(RESOURCES_PATH, BACKUP_PATH)
        print(f"\n📦 Backup created")
    
    # Read from backup (clean)
    print(f"\n📖 Reading {BACKUP_PATH}...")
    with open(BACKUP_PATH, 'rb') as f:
        data = bytearray(f.read())
    print(f"   Size: {len(data):,} bytes")
    
    # Parse
    print(f"\n🔍 Parsing serialized file...")
    sf = UnitySerializedFile(data)
    sf.read()
    
    # Find TextAssets
    print(f"\n🔍 Finding TextAsset objects...")
    text_assets = sf.find_text_assets()
    print(f"   Found {len(text_assets)} CSV TextAssets")
    
    if not text_assets:
        print("❌ No TextAssets found!")
        return
    
    # Inject translations (process from last to first to keep offsets valid)
    text_assets.sort(key=lambda ta: ta['data_start'], reverse=True)
    
    injected = 0
    for ta in text_assets:
        table_name = identify_table(ta['text'])
        if not table_name or table_name not in trans_map:
            print(f"\n⏭️ '{ta['name']}' ({table_name}): skipping")
            continue
        
        trans = trans_map[table_name]
        print(f"\n🔧 '{ta['name']}' ({table_name}, {len(trans)} translations)")
        
        new_csv = rebuild_csv_replace_english(ta['text'], trans)
        size_diff = sf.replace_text_asset_data(ta, new_csv)
        injected += len(trans)
        print(f"    ✅ Injected {len(trans)} translations (size {size_diff:+d})")
    
    # Write
    print(f"\n💾 Writing {RESOURCES_PATH}...")
    with open(RESOURCES_PATH, 'wb') as f:
        f.write(sf.data)
    print(f"   New size: {len(sf.data):,} bytes")
    
    print(f"\n{'='*60}")
    print(f"✅ DONE: {injected} translations injected")
    print(f"   Backup: {BACKUP_PATH}")
    print(f"\n🎮 Avvia il gioco - il testo è ora in italiano!")


if __name__ == '__main__':
    main()
