"""Quick test of new filter logic to estimate string count"""
import struct, zlib

path = r'E:\SteamLibrary\steamapps\common\FoolishMortals\data.vis'
import os
size = os.path.getsize(path)

CHUNK = 16 * 1024 * 1024
with open(path, 'rb') as f:
    f.seek(max(0, size - CHUNK))
    chunk = f.read()
    pos = chunk.rfind(b'VBIN')
    compressed = chunk[pos + 16 : pos + 16 + struct.unpack_from('<I', chunk, pos + 12)[0]]
    payload = zlib.decompress(compressed)

def is_translatable_v3(s):
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
    # Engine action logs
    if 'executed' in lower: return False
    if lower.startswith('pause for '): return False
    if lower.startswith('play sound'): return False
    if lower.startswith("fade '") or lower.startswith('fade "'): return False
    if lower.startswith('stop sound'): return False
    if lower.startswith('set '): return False
    if lower.startswith('change '): return False
    if lower.startswith('show ') or lower.startswith('hide '): return False
    if lower.startswith('start '): return False
    if lower.startswith('call '): return False
    if lower.startswith('wait '): return False
    if lower.startswith('if '): return False
    if lower.startswith('cursor '): return False
    if lower.startswith('at '): return False
    if lower.startswith('left click') or lower.startswith('right click'): return False
    if lower.startswith('mouse '): return False
    if lower.startswith('key '): return False
    # Section names
    if s.startswith('-') and all(c.isupper() or c == ' ' or c == '&' for c in s[1:]): return False
    # Lua
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
    if ' >> ' in s: return False
    if "'" in s and ' ' not in s: return False
    if all(c.isalnum() or c == '_' for c in s) and '_' in s: return False
    if all(c.isupper() or c == '_' or c.isdigit() or c == ' ' for c in s) and len(s) > 3: return False
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
    skip_kw = ["ActiveAnimations","PolygonalLink","ScrollPosition",
               "CharacterLink","ObjectLink","SceneLink","ActionLink",
               "SoundLink","MusicLink","FontLink","CursorLink",
               "ParticleLink","InterfaceLink","AnimationLink",
               "ConditionLink","ValueLink","DialogLink",
               "Brightness","Saturation","setPosition","getPosition",
               "currentCharacter","activeScene","mainCharacter",
               "milliseconds"," to object ","object area",
               "(immediate)"," position"]
    for kw in skip_kw:
        if kw in s: return False
    has_lower = any(w[0].islower() for w in words if w[0].isalpha())
    has_punct = any(c in '.,!?:;"\u2026' for c in s)
    if not has_lower and not has_punct: return False
    return True

print("Extracting with new filter v3...")
strings = []
p = 0
while p + 4 < len(payload):
    length = struct.unpack_from('<I', payload, p)[0]
    if 2 <= length <= 10000 and p + 4 + length <= len(payload):
        raw = payload[p + 4 : p + 4 + length]
        try:
            text = raw.decode('utf-8').rstrip('\x00')
            if is_translatable_v3(text):
                strings.append(text)
                p = p + 4 + length
                continue
        except:
            pass
    p += 1

print(f"Total: {len(strings)}")
print(f"\nFirst 50 strings:")
for i, t in enumerate(strings[:50]):
    print(f"  [{i:4d}] {t[:150]}")
print(f"\nLast 30 strings:")
for i, t in enumerate(strings[-30:]):
    print(f"  [{len(strings)-30+i:4d}] {t[:150]}")
