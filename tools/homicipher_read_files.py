"""Read specific files from Homicipher ASAR to understand language selection."""
import json, re, sys

asar_path = r'D:\SteamLibrary\steamapps\common\Homicipher\resources\app.asar'

def read_asar():
    with open(asar_path, 'rb') as f:
        f.seek(16)
        chunk = f.read(500000)
        text = chunk.decode('utf-8', errors='replace')
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
        return f, header, data_offset

def find_file(node, target_path, path=''):
    if 'files' in node:
        for name, child in node['files'].items():
            result = find_file(child, target_path, f'{path}/{name}')
            if result: return result
    elif path == target_path:
        return node
    return None

def collect_files(node, prefix, path=''):
    results = []
    if 'files' in node:
        for name, child in node['files'].items():
            results.extend(collect_files(child, prefix, f'{path}/{name}'))
    elif path.startswith(prefix):
        results.append((path, node))
    return results

with open(asar_path, 'rb') as f:
    f.seek(16)
    chunk = f.read(500000)
    text = chunk.decode('utf-8', errors='replace')
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

    # Find language-related files
    targets = [
        '/data/scenario/main/title_screen.ks',
        '/data/scenario/main/first.ks',
        '/data/scenario/main/system.ks',
        '/data/scenario/main/config.ks',
    ]
    
    # List all files in main/
    main_files = collect_files(header, '/data/scenario/main')
    print("Files in scenario/main/:")
    for p, _ in main_files:
        print(f"  {p}")
    
    # List files in data/config/
    config_files = collect_files(header, '/data/config')
    print(f"\nFiles in config/:")
    for p, _ in config_files:
        print(f"  {p}")
    
    # List .ks files in data/scenario/ root (not in subdirs)
    all_scenario = collect_files(header, '/data/scenario')
    root_scenario = [p for p, _ in all_scenario if p.count('/') == 3]
    print(f"\nRoot scenario files:")
    for p in root_scenario:
        print(f"  {p}")

    # Read first.ks to see language init
    for target in ['/data/scenario/main/first.ks', '/data/scenario/main/title_screen.ks']:
        info = find_file(header, target)
        if info:
            offset = data_offset + int(info['offset'])
            size = int(info['size'])
            f.seek(offset)
            content = f.read(size).decode('utf-8', errors='replace')
            print(f"\n{'='*60}")
            print(f"FILE: {target} ({size} bytes)")
            print(f"{'='*60}")
            # Show lines with language-related content
            for line in content.split('\n'):
                s = line.strip()
                if any(kw in s.lower() for kw in ['lang', 'lg', 'language', 'en', 'jp', 'sc', 'tc', 'gt']):
                    print(f"  {s}")
