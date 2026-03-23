"""Sample strings from VBIN payload to analyze filter quality"""
import struct, os, zlib

path = r'E:\SteamLibrary\steamapps\common\FoolishMortals\data.vis'
size = os.path.getsize(path)

# Find VBIN from end (same as Rust code)
CHUNK = 16 * 1024 * 1024
with open(path, 'rb') as f:
    f.seek(max(0, size - CHUNK))
    chunk = f.read()
    pos = chunk.rfind(b'VBIN')
    if pos < 0:
        print("VBIN not found!")
        exit(1)
    abs_pos = max(0, size - CHUNK) + pos
    unknown = struct.unpack_from('<I', chunk, pos + 4)[0]
    uncomp = struct.unpack_from('<I', chunk, pos + 8)[0]
    comp = struct.unpack_from('<I', chunk, pos + 12)[0]
    print(f"VBIN at {abs_pos}: uncomp={uncomp} comp={comp}")
    
    compressed = chunk[pos + 16 : pos + 16 + comp]
    payload = zlib.decompress(compressed)
    print(f"Decompressed: {len(payload)} bytes")

# Extract strings using same logic as Rust
def extract_strings(data):
    strings = []
    pos = 0
    while pos + 4 < len(data):
        length = struct.unpack_from('<I', data, pos)[0]
        if 2 <= length <= 10000 and pos + 4 + length <= len(data):
            raw = data[pos + 4 : pos + 4 + length]
            try:
                text = raw.decode('utf-8').rstrip('\x00')
                if is_translatable(text):
                    strings.append((pos, text))
                    pos = pos + 4 + length
                    continue
            except:
                pass
        pos += 1
    return strings

def is_translatable(s):
    """Mirror of Rust is_translatable_vis_string"""
    s = s.strip()
    if len(s) < 5: return False
    letters = sum(1 for c in s if c.isalpha())
    if letters < 4: return False
    ascii_r = sum(1 for c in s if ord(c) < 128) / len(s)
    if ascii_r < 0.8: return False
    if '/' in s or '\\' in s: return False
    lower = s.lower()
    exts = ['.png','.ogg','.wav','.mp3','.mp4','.webp','.jpg','.jpeg',
            '.lua','.xml','.json','.csv','.ini','.cfg','.ttf','.otf',
            '.vis','.veb','.ved','.dat','.bin','.exe','.dll','.fx',
            '.hlsl','.glsl','.vert','.frag','.tga','.bmp','.gif']
    for e in exts:
        if lower.endswith(e): return False
    if 'function ' in s or 'local ' in s or 'end\n' in s: return False
    if 'if ' in s and ' then' in s: return False
    if 'return ' in s or 'require(' in s: return False
    if ' = ' in s and ('true' in s or 'false' in s or 'nil' in s): return False
    if 'getObject(' in s or 'getName(' in s or 'setValue(' in s: return False
    if 'startAction(' in s or 'getLink(' in s or '.Value' in s: return False
    if '=' in s and ' ' not in s: return False
    if '=' in s and ';' in s: return False
    if s.startswith('<') and s.endswith('>'): return False
    if '</' in s or '/>' in s: return False
    if all(c.isalnum() or c == '_' for c in s) and '_' in s: return False
    if all(c.isupper() or c == '_' or c.isdigit() for c in s) and len(s) > 3: return False
    if ' ' not in s: return False
    words = [w for w in s.split() if sum(1 for c in w if c.isalpha()) >= 2]
    if len(words) < 2: return False
    skip_prefixes = ["eshader","ealign","eonly","etext","action_","scene_",
                     "char_","obj_","cond_","val_","anim_","sound_",
                     "plugins/","Graphics/","Sounds/","Music/","Fonts/",
                     "config.","plugin","TVis","TScript","Vis ","vis_",
                     "cursor_","button_","interface_","menu_","dialog_",
                     "sfx_","bgm_","vfx_","ui_","hud_"]
    for p in skip_prefixes:
        if s.startswith(p) or lower.startswith(p.lower()): return False
    skip_contains = ["ActiveAnimations","PolygonalLink","ScrollPosition",
                     "CharacterLink","ObjectLink","SceneLink","ActionLink",
                     "SoundLink","MusicLink","FontLink","CursorLink",
                     "ParticleLink","InterfaceLink","AnimationLink",
                     "ConditionLink","ValueLink","DialogLink",
                     "Brightness","Saturation","setPosition","getPosition",
                     "currentCharacter","activeScene","mainCharacter"]
    for kw in skip_contains:
        if kw in s: return False
    if s.startswith("Set ") and " position" in s and '.' not in s: return False
    if s.startswith("Show/") or s.startswith("Hide/"): return False
    if s.startswith("Change ") and ":" in s: return False
    cap_words = [w for w in words if w[0].isupper() and len(w) <= 20]
    if 2 <= len(words) <= 3 and len(cap_words) == len(words):
        last = s[-1] if s else 'a'
        if not (last in '.,!?:;"\'') or last == ')':
            return False
    has_lower = any(w[0].islower() for w in words)
    has_punct = any(c in '.,!?:;"\'' for c in s)
    if not has_lower and not has_punct and len(s) > 30: return False
    return True

print("Extracting strings...")
strings = extract_strings(payload)
print(f"Total translatable: {len(strings)}")

# Categorize
categories = {
    'dialogue': [],      # real dialogue (has punctuation, lowercase)
    'short_caps': [],    # "Word Word" style  
    'numbers_mix': [],   # contains lots of numbers
    'repetitive': [],    # very similar strings
    'other': [],
}

for offset, text in strings:
    has_punct = any(c in '.,!?:;"\'-' for c in text)
    words = text.split()
    all_cap_start = all(w[0].isupper() for w in words if w[0].isalpha())
    has_numbers = sum(1 for c in text if c.isdigit()) > len(text) * 0.2
    
    if has_numbers:
        categories['numbers_mix'].append(text)
    elif has_punct and len(text) > 20:
        categories['dialogue'].append(text)
    elif all_cap_start and len(words) <= 4:
        categories['short_caps'].append(text)
    else:
        categories['other'].append(text)

print(f"\n=== CATEGORY BREAKDOWN ===")
for cat, items in categories.items():
    print(f"{cat}: {len(items)}")

# Show samples
for cat, items in categories.items():
    print(f"\n--- {cat.upper()} (first 30) ---")
    for t in items[:30]:
        print(f"  [{len(t):4d}] {t[:120]}")

# Show length distribution
print(f"\n=== LENGTH DISTRIBUTION ===")
lengths = [len(t) for _, t in strings]
for bucket in [(5,10),(10,20),(20,50),(50,100),(100,500),(500,10000)]:
    count = sum(1 for l in lengths if bucket[0] <= l < bucket[1])
    print(f"  {bucket[0]:5d}-{bucket[1]:5d}: {count:6d} ({count*100/len(strings):.1f}%)")
