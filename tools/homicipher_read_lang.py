"""Read language-related files from Homicipher ASAR."""
import json, sys

asar_path = r'D:\SteamLibrary\steamapps\common\Homicipher\resources\app.asar'

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

    def find_file(node, target_path, path=''):
        if 'files' in node:
            for name, child in node['files'].items():
                result = find_file(child, target_path, f'{path}/{name}')
                if result: return result
        elif path == target_path:
            return node
        return None

    targets = [
        '/data/scenario/langp.ks',
        '/data/scenario/first.ks',
        '/data/scenario/macro.ks',
        '/data/scenario/init.ks',
        '/data/scenario/title.ks',
    ]

    for target in targets:
        info = find_file(header, target)
        if info:
            offset = data_offset + int(info['offset'])
            size = int(info['size'])
            f.seek(offset)
            content = f.read(size).decode('utf-8', errors='replace')
            print(f"\n{'='*70}")
            print(f"FILE: {target} ({size} bytes)")
            print(f"{'='*70}")
            # Print full content but cap at 200 lines
            lines = content.split('\n')
            for i, line in enumerate(lines[:200]):
                print(line.rstrip())
            if len(lines) > 200:
                print(f"  ... ({len(lines) - 200} more lines)")
