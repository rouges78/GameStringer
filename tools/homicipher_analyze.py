"""Analyze Homicipher TyranoScript ASAR to count translatable strings."""
import json, re, sys

asar_path = r'D:\SteamLibrary\steamapps\common\Homicipher\resources\app.asar'

with open(asar_path, 'rb') as f:
    f.seek(16)
    chunk = f.read(500000)
    text = chunk.decode('utf-8', errors='replace')
    depth = 0
    json_end = 0
    for i, c in enumerate(text):
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        if depth == 0 and i > 0:
            json_end = i + 1
            break
    header = json.loads(text[:json_end])
    data_offset = 16 + json_end

    def collect_files(node, prefix, path=''):
        results = []
        if 'files' in node:
            for name, child in node['files'].items():
                results.extend(collect_files(child, prefix, f'{path}/{name}'))
        elif path.startswith(prefix):
            results.append((path, node))
        return results

    scenarios = collect_files(header, '/data/scenario')
    total_en = 0
    total_jp = 0
    total_won = 0
    unique_en = set()
    files_with_en = 0

    for spath, info in scenarios:
        offset = data_offset + int(info['offset'])
        size = int(info['size'])
        f.seek(offset)
        content = f.read(size).decode('utf-8', errors='replace')
        en_matches = re.findall(r'\[EN t="([^"]*)"\]', content)
        jp_matches = re.findall(r'\[JP t="([^"]*)"\]', content)
        won_matches = re.findall(r'\[WON ', content)
        total_en += len(en_matches)
        total_jp += len(jp_matches)
        total_won += len(won_matches)
        if en_matches:
            files_with_en += 1
        for m in en_matches:
            unique_en.add(m)

    print(f'File scenario: {len(scenarios)}')
    print(f'File con stringhe EN: {files_with_en}')
    print(f'Stringhe [EN]: {total_en} (uniche: {len(unique_en)})')
    print(f'Stringhe [JP]: {total_jp}')
    print(f'Tag [WON]: {total_won}')
    print()
    print('Esempi stringhe EN uniche (prime 25):')
    for s in sorted(unique_en)[:25]:
        print(f'  {s}')
    
    # Check if there's already an [IT tag
    has_it = False
    for spath, info in scenarios[:5]:
        offset = data_offset + int(info['offset'])
        size = int(info['size'])
        f.seek(offset)
        content = f.read(size).decode('utf-8', errors='replace')
        if '[IT ' in content:
            has_it = True
            break
    print(f'\nTag [IT] gia presente: {has_it}')
    
    # Check config for language settings
    config_files = collect_files(header, '/data/config')
    print(f'\nFile config trovati: {len(config_files)}')
    for cp, ci in config_files:
        print(f'  {cp}')
