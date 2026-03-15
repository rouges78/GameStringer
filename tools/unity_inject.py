"""
Unified Unity Asset Injection CLI for GameStringer.
Injects translated text into Unity SerializedFile v22 assets using resize injection.
Supports: Ink JSON blobs (sharedassets) + LP-prefixed strings (level files).

Usage:
  python unity_inject.py --game-dir "path/to/_Data" --csv-dir "path/to/csvs" [--ink-csv "path/to/ink.csv"] [--mode all|ink|levels]
"""
import struct, os, csv, shutil, sys, json, argparse, time


# ─── Unity v22 SerializedFile parsing ─────────────────────────────────

def read_be64(data, off):
    lo = struct.unpack('>I', data[off:off+4])[0]
    hi = struct.unpack('>I', data[off+4:off+8])[0]
    return lo | (hi << 32)

def write_be64(data, off, val):
    struct.pack_into('>I', data, off, val & 0xFFFFFFFF)
    struct.pack_into('>I', data, off+4, (val >> 32) & 0xFFFFFFFF)

def align4(x):  return (x + 3) & ~3
def align16(x): return (x + 15) & ~15

def parse_v22_file(data):
    """Parse Unity SerializedFile v22 header + object table."""
    version = struct.unpack('>I', data[8:12])[0]
    if version != 22:
        return None
    header = {
        'meta_size': read_be64(data, 20),
        'file_size': read_be64(data, 28),
        'data_offset': read_be64(data, 36),
    }
    pos = 48
    end = data.index(b'\x00', pos)
    pos = end + 1 + 4  # skip version string + platform
    has_types = data[pos]; pos += 1
    if has_types != 0:
        return None  # type tree parsing not supported
    type_count = struct.unpack_from('<i', data, pos)[0]; pos += 4
    type_classes = []
    for _ in range(type_count):
        cid = struct.unpack_from('<i', data, pos)[0]; pos += 4
        pos += 1; pos += 2
        if cid == 114 or cid < 0: pos += 16
        pos += 16
        type_classes.append(cid)
    obj_count = struct.unpack_from('<i', data, pos)[0]; pos += 4
    if pos % 4 != 0: pos += 4 - (pos % 4)
    objects = []
    for i in range(obj_count):
        objects.append({
            'idx': i, 'table_pos': pos,
            'path_id': struct.unpack_from('<q', data, pos)[0],
            'byte_off': struct.unpack_from('<q', data, pos+8)[0],
            'byte_size': struct.unpack_from('<I', data, pos+16)[0],
            'type_idx': struct.unpack_from('<i', data, pos+20)[0],
        })
        pos += 24
    return {'header': header, 'type_classes': type_classes, 'objects': objects}


# ─── Translations loading ─────────────────────────────────────────────

def load_csv_translations(csv_dir):
    """Load keyed translations from CSV files. Returns list of (key, eng, ita)."""
    entries = []
    for fname in os.listdir(csv_dir):
        if not fname.endswith('.csv'): continue
        with open(os.path.join(csv_dir, fname), 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = row.get('ID', '').strip()
                eng = row.get('ENGLISH', '').strip()
                ita = row.get('ITALIAN', '').strip()
                if key and eng and ita and eng != ita:
                    entries.append((key, eng, ita))
    return entries

def load_ink_translations(ink_csv):
    """Load Ink translations from CSV. Returns dict eng->ita."""
    trans = {}
    with open(ink_csv, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 2 and row[0].strip() and row[1].strip():
                en, it = row[0].strip(), row[1].strip()
                if len(en) >= 4 and en != it:
                    trans[en] = it
    return trans


# ─── Ink JSON blob replacement ────────────────────────────────────────

def sanitize_for_json(text):
    return text.replace('\\', '/').replace('"', "'")

def find_caret_strings(blob, start, end):
    results = []
    pos = start
    while pos < end - 2:
        idx = blob.find(b'"^', pos, end)
        if idx < 0: break
        ts = idx + 2; p = ts
        while p < end:
            if blob[p] == ord('\\'): p += 2; continue
            if blob[p] == ord('"'): break
            p += 1
        if p < end and p > ts:
            results.append((ts, p))
        pos = p + 1 if p < end else end
    return results

def replace_blob_text(blob_bytes, trans):
    caret_strings = find_caret_strings(blob_bytes, 0, len(blob_bytes))
    if not caret_strings: return blob_bytes, 0
    replacements = []
    for ts, te in caret_strings:
        text = blob_bytes[ts:te]
        try: eng_text = text.decode('utf-8')
        except: continue
        eng_u = eng_text
        try: eng_u = eng_text.replace('\\"', '"').replace('\\\\', '\\').replace('\\n', '\n').replace('\\t', '\t')
        except: pass
        ita = trans.get(eng_u.strip()) or trans.get(eng_u) or trans.get(eng_text.strip()) or trans.get(eng_text)
        if not ita: continue
        ita_safe = sanitize_for_json(ita)
        ita_esc = ita_safe.replace('\n', '\\n').replace('\t', '\\t')
        replacements.append((ts, te, ita_esc.encode('utf-8')))
    if not replacements: return blob_bytes, 0
    parts = []; prev = 0
    for s, e, nb in replacements:
        parts.append(blob_bytes[prev:s]); parts.append(nb); prev = e
    parts.append(blob_bytes[prev:])
    return b''.join(parts), len(replacements)


# ─── Ink resize injection ─────────────────────────────────────────────

def inject_ink_resize(game_dir, ink_trans, progress_cb=None):
    """Inject Ink translations with resize into sharedassets files."""
    total_replaced = 0
    files_done = 0
    
    asset_files = sorted([f for f in os.listdir(game_dir)
                          if f.startswith('sharedassets') and f.endswith('.assets') and not f.endswith('.backup')])
    
    for fname in asset_files:
        fpath = os.path.join(game_dir, fname)
        backup = fpath + ".backup"
        source = backup if os.path.exists(backup) else fpath
        data = bytearray(open(source, 'rb').read())
        
        parsed = parse_v22_file(data)
        if not parsed:
            continue
        
        header = parsed['header']
        data_off = header['data_offset']
        objects = parsed['objects']
        
        # Find Ink objects
        ink_objects = []
        for obj in objects:
            abs_off = data_off + obj['byte_off']
            if obj['byte_size'] > 100 and abs_off + min(200, obj['byte_size']) <= len(data):
                if b'inkVersion' in data[abs_off:abs_off+min(200, obj['byte_size'])]:
                    ink_objects.append(obj)
        
        if not ink_objects:
            continue
        
        all_objects = sorted(objects, key=lambda o: o['byte_off'])
        ink_set = {o['idx'] for o in ink_objects}
        ink_replacements = {}
        file_replaced = 0
        
        for obj in ink_objects:
            abs_off = data_off + obj['byte_off']
            name_lp = struct.unpack_from('<I', data, abs_off)[0]
            name_bytes = bytes(data[abs_off+4:abs_off+4+name_lp])
            name_pad = (4 - name_lp % 4) % 4
            json_lp_off = abs_off + 4 + name_lp + name_pad
            json_lp = struct.unpack_from('<I', data, json_lp_off)[0]
            json_start = json_lp_off + 4
            json_bytes = bytes(data[json_start:json_start+json_lp])
            new_json, count = replace_blob_text(json_bytes, ink_trans)
            if count > 0:
                file_replaced += count
                new_json_lp = len(new_json)
                new_json_pad = (4 - new_json_lp % 4) % 4
                ink_replacements[obj['idx']] = {
                    'name_lp': name_lp, 'name_bytes': name_bytes, 'name_pad': name_pad,
                    'new_json': new_json, 'new_json_lp': new_json_lp, 'new_json_pad': new_json_pad,
                    'new_obj_size': 4 + name_lp + name_pad + 4 + new_json_lp + new_json_pad,
                }
        
        if file_replaced == 0:
            continue
        
        # Rebuild data section
        new_parts = [bytes(data[:data_off])]
        cur_pos = 0
        obj_offsets = {}; obj_sizes = {}
        
        for obj in all_objects:
            a = align16(cur_pos)
            if a > cur_pos: new_parts.append(b'\x00' * (a - cur_pos)); cur_pos = a
            obj_offsets[obj['idx']] = cur_pos
            if obj['idx'] in ink_replacements:
                rep = ink_replacements[obj['idx']]
                ob = bytearray()
                ob.extend(struct.pack('<I', rep['name_lp'])); ob.extend(rep['name_bytes']); ob.extend(b'\x00' * rep['name_pad'])
                ob.extend(struct.pack('<I', rep['new_json_lp'])); ob.extend(rep['new_json']); ob.extend(b'\x00' * rep['new_json_pad'])
                new_parts.append(bytes(ob)); obj_sizes[obj['idx']] = rep['new_obj_size']; cur_pos += rep['new_obj_size']
            else:
                ao = data_off + obj['byte_off']
                od = bytes(data[ao:ao+obj['byte_size']])
                new_parts.append(od); obj_sizes[obj['idx']] = obj['byte_size']; cur_pos += obj['byte_size']
        
        new_data = bytearray(b''.join(new_parts))
        for obj in objects:
            tp = obj['table_pos']
            if obj['idx'] in obj_offsets: struct.pack_into('<q', new_data, tp+8, obj_offsets[obj['idx']])
            if obj['idx'] in obj_sizes: struct.pack_into('<I', new_data, tp+16, obj_sizes[obj['idx']])
        write_be64(new_data, 28, len(new_data))
        
        if not os.path.exists(backup): shutil.copy2(fpath, backup)
        open(fpath, 'wb').write(bytes(new_data))
        
        total_replaced += file_replaced
        files_done += 1
        if progress_cb:
            progress_cb('ink', fname, file_replaced, len(new_data) - len(data))
    
    return total_replaced, files_done


# ─── Level resize injection ───────────────────────────────────────────

def build_key_pattern(key):
    kb = key.encode('utf-8')
    kp = (4 - len(kb) % 4) % 4
    return struct.pack('<I', len(kb)) + kb + b'\x00' * kp + b'\x02\x00\x00\x00'

def resize_object_keyed(obj_data, entries):
    replacements = []
    for key, eng, ita in entries:
        kp = build_key_pattern(key)
        pos = 0
        while True:
            idx = obj_data.find(kp, pos)
            if idx < 0: break
            vlp_off = idx + len(kp)
            if vlp_off + 4 > len(obj_data): pos = idx+1; continue
            vlp = struct.unpack_from('<I', obj_data, vlp_off)[0]
            vs = vlp_off + 4; ve = vs + vlp
            if ve > len(obj_data): pos = idx+1; continue
            try: cur = obj_data[vs:ve].decode('utf-8')
            except: pos = idx+1; continue
            if cur.strip() != eng.strip(): pos = idx+1; continue
            old_pad = (4 - vlp % 4) % 4
            ib = ita.encode('utf-8'); new_pad = (4 - len(ib) % 4) % 4
            replacements.append({'off': vlp_off, 'old_total': 4+vlp+old_pad, 'new_lp': len(ib), 'new_bytes': ib, 'new_pad': new_pad})
            pos = ve + old_pad
    if not replacements: return obj_data, 0
    replacements.sort(key=lambda r: r['off'])
    parts = []; prev = 0
    for r in replacements:
        parts.append(obj_data[prev:r['off']])
        parts.append(struct.pack('<I', r['new_lp'])); parts.append(r['new_bytes']); parts.append(b'\x00' * r['new_pad'])
        prev = r['off'] + r['old_total']
    parts.append(obj_data[prev:])
    return b''.join(parts), len(replacements)

def resize_object_lp_direct(obj_data, entries):
    replacements = []
    for key, eng, ita in entries:
        eb = eng.encode('utf-8'); el = len(eb)
        search = struct.pack('<I', el) + eb
        pos = 0
        while True:
            idx = obj_data.find(search, pos)
            if idx < 0: break
            pre = obj_data[max(0,idx-50):idx]
            if b'Assembly' in pre or b'CSharp' in pre or b'MonoBehaviour' in pre:
                pos = idx+4+el; continue
            old_pad = (4 - el % 4) % 4
            ib = ita.encode('utf-8'); new_pad = (4 - len(ib) % 4) % 4
            replacements.append({'off': idx, 'old_total': 4+el+old_pad, 'new_lp': len(ib), 'new_bytes': ib, 'new_pad': new_pad})
            pos = idx+4+el+old_pad
    if not replacements: return obj_data, 0
    replacements.sort(key=lambda r: r['off'])
    filtered = [replacements[0]]
    for r in replacements[1:]:
        if r['off'] >= filtered[-1]['off'] + filtered[-1]['old_total']: filtered.append(r)
    replacements = filtered
    parts = []; prev = 0
    for r in replacements:
        parts.append(obj_data[prev:r['off']])
        parts.append(struct.pack('<I', r['new_lp'])); parts.append(r['new_bytes']); parts.append(b'\x00' * r['new_pad'])
        prev = r['off'] + r['old_total']
    parts.append(obj_data[prev:])
    return b''.join(parts), len(replacements)

def inject_levels_resize(game_dir, csv_entries, progress_cb=None):
    """Inject CSV translations with resize into level files."""
    total_replaced = 0; files_done = 0
    search_pats = {eng.encode('utf-8')[:20] for _, eng, _ in csv_entries}
    
    level_files = sorted([f for f in os.listdir(game_dir)
                          if f.startswith('level') and '.' not in f])
    
    for fname in level_files:
        fpath = os.path.join(game_dir, fname)
        if not os.path.isfile(fpath): continue
        backup = fpath + ".backup"
        source = backup if os.path.exists(backup) else fpath
        data = bytearray(open(source, 'rb').read())
        
        parsed = parse_v22_file(data)
        if not parsed: continue
        
        h = parsed['header']; do = h['data_offset']; objects = parsed['objects']
        all_objects = sorted(objects, key=lambda o: o['byte_off'])
        use_lp = (fname == 'level0')
        resized = {}; file_replaced = 0
        
        for obj in all_objects:
            ao = do + obj['byte_off']
            od = bytes(data[ao:ao+obj['byte_size']])
            if not any(p in od for p in search_pats): continue
            nd, cnt = resize_object_lp_direct(od, csv_entries) if use_lp else resize_object_keyed(od, csv_entries)
            if cnt > 0: resized[obj['idx']] = nd; file_replaced += cnt
        
        if file_replaced == 0: continue
        
        new_parts = [bytes(data[:do])]; cur = 0
        obj_off = {}; obj_sz = {}
        for obj in all_objects:
            a = align16(cur)
            if a > cur: new_parts.append(b'\x00' * (a-cur)); cur = a
            obj_off[obj['idx']] = cur
            ob = resized.get(obj['idx'], bytes(data[do+obj['byte_off']:do+obj['byte_off']+obj['byte_size']]))
            new_parts.append(ob); obj_sz[obj['idx']] = len(ob); cur += len(ob)
        
        nf = bytearray(b''.join(new_parts))
        for obj in objects:
            tp = obj['table_pos']
            if obj['idx'] in obj_off: struct.pack_into('<q', nf, tp+8, obj_off[obj['idx']])
            if obj['idx'] in obj_sz: struct.pack_into('<I', nf, tp+16, obj_sz[obj['idx']])
        write_be64(nf, 28, len(nf))
        
        if not os.path.exists(backup): shutil.copy2(fpath, backup)
        open(fpath, 'wb').write(bytes(nf))
        
        total_replaced += file_replaced; files_done += 1
        if progress_cb:
            progress_cb('level', fname, file_replaced, len(nf) - len(data))
    
    return total_replaced, files_done


# ─── Main CLI ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Unity Asset Injection for GameStringer')
    parser.add_argument('--game-dir', required=True, help='Path to game _Data directory')
    parser.add_argument('--csv-dir', help='Path to translated CSV directory')
    parser.add_argument('--ink-csv', help='Path to Ink translations CSV')
    parser.add_argument('--mode', default='all', choices=['all', 'ink', 'levels'], help='Injection mode')
    args = parser.parse_args()
    
    results = {'ink_replaced': 0, 'ink_files': 0, 'level_replaced': 0, 'level_files': 0, 'errors': []}
    
    def progress(kind, fname, count, diff):
        msg = json.dumps({'type': 'progress', 'kind': kind, 'file': fname, 'replaced': count, 'diff': diff})
        print(msg, flush=True)
    
    try:
        if args.mode in ('all', 'ink') and args.ink_csv:
            if os.path.exists(args.ink_csv):
                ink_trans = load_ink_translations(args.ink_csv)
                r, f = inject_ink_resize(args.game_dir, ink_trans, progress)
                results['ink_replaced'] = r; results['ink_files'] = f
            else:
                results['errors'].append(f'Ink CSV not found: {args.ink_csv}')
        
        if args.mode in ('all', 'levels') and args.csv_dir:
            if os.path.isdir(args.csv_dir):
                entries = load_csv_translations(args.csv_dir)
                r, f = inject_levels_resize(args.game_dir, entries, progress)
                results['level_replaced'] = r; results['level_files'] = f
            else:
                results['errors'].append(f'CSV dir not found: {args.csv_dir}')
        
        results['success'] = True
    except Exception as e:
        results['success'] = False
        results['errors'].append(str(e))
    
    print(json.dumps({'type': 'result', **results}), flush=True)

if __name__ == '__main__':
    main()
