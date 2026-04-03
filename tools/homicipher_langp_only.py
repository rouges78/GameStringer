"""Read ONLY langp.ks from Homicipher ASAR."""
import json

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

    info = find_file(header, '/data/scenario/langp.ks')
    offset = data_offset + int(info['offset'])
    size = int(info['size'])
    f.seek(offset)
    content = f.read(size).decode('utf-8', errors='replace')
    
    # Write to temp file for easy reading
    with open(r'c:\dev\GameStringer\tools\langp_content.txt', 'w', encoding='utf-8') as out:
        out.write(content)
    print(f"Wrote {size} bytes to langp_content.txt")
