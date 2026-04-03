"""Extract Homicipher app.asar (custom 16-byte header NW.js format)."""
import json, os, sys

asar_path = r'D:\SteamLibrary\steamapps\common\Homicipher\resources\app.asar'
out_dir = r'D:\SteamLibrary\steamapps\common\Homicipher\resources\app_extracted'

with open(asar_path, 'rb') as f:
    # Skip 16-byte custom header
    f.seek(16)
    chunk = f.read(500000)
    text = chunk.decode('utf-8', errors='replace')
    
    # Parse JSON header
    depth = 0
    json_end = 0
    for i, c in enumerate(text):
        if c == '{': depth += 1
        elif c == '}': depth -= 1
        if depth == 0 and i > 0:
            json_end = i + 1
            break
    
    header = json.loads(text[:json_end])
    data_offset = 16 + json_end
    print(f"JSON header: {json_end} bytes, data offset: {data_offset}")

    # Collect all files
    def collect_all(node, path=''):
        results = []
        if 'files' in node:
            for name, child in node['files'].items():
                results.extend(collect_all(child, f'{path}/{name}'))
        else:
            results.append((path, node))
        return results

    all_files = collect_all(header)
    print(f"Total files to extract: {len(all_files)}")

    # Extract only scenario + config + key files (not media)
    extract_prefixes = ['/data/scenario/', '/data/tyrano/', '/data/others/css/', '/data/others/config/']
    to_extract = []
    for path, info in all_files:
        # Extract scenario files (.ks), and key config files
        if any(path.startswith(p) for p in extract_prefixes):
            to_extract.append((path, info))
        elif path.endswith('.ks') or path.endswith('.css') or path.endswith('.html'):
            to_extract.append((path, info))
    
    print(f"Files to extract (scenario + config): {len(to_extract)}")
    
    extracted = 0
    errors = 0
    for path, info in to_extract:
        try:
            file_offset = data_offset + int(info['offset'])
            file_size = int(info['size'])
            
            out_path = os.path.join(out_dir, path.lstrip('/'))
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            
            f.seek(file_offset)
            data = f.read(file_size)
            
            with open(out_path, 'wb') as out_f:
                out_f.write(data)
            
            extracted += 1
        except Exception as e:
            errors += 1
            print(f"  ERROR: {path}: {e}")
    
    print(f"\nExtracted: {extracted} files, Errors: {errors}")
    print(f"Output: {out_dir}")
