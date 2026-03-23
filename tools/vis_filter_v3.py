"""Quick test of v3 filter with all new rules"""
import struct, zlib, os

path = r'E:\SteamLibrary\steamapps\common\FoolishMortals\data.vis'
size = os.path.getsize(path)
CHUNK = 16 * 1024 * 1024
with open(path, 'rb') as f:
    f.seek(max(0, size - CHUNK))
    chunk = f.read()
    pos = chunk.rfind(b'VBIN')
    compressed = chunk[pos + 16 : pos + 16 + struct.unpack_from('<I', chunk, pos + 12)[0]]
    payload = zlib.decompress(compressed)

def filt(s):
    s = s.strip()
    if len(s) < 5: return False
    letters = sum(1 for c in s if c.isalpha())
    if letters < 4: return False
    if sum(1 for c in s if ord(c)<128)/len(s) < 0.8: return False
    if '/' in s or '\\' in s: return False
    lower = s.lower()
    for e in ['.png','.ogg','.wav','.mp3','.mp4','.webp','.jpg','.jpeg','.lua','.xml','.json','.csv','.ini','.cfg','.ttf','.otf','.vis','.veb','.ved','.dat','.bin','.exe','.dll','.fx','.hlsl','.glsl','.vert','.frag','.tga','.bmp','.gif']:
        if lower.endswith(e): return False
    # Engine action logs
    engine_pfx = ['pause for ','play sound','play animation','play ','fade \'','fade "','fade ','stop sound','stop character','stop centering','stop ','set ','change ','show ','hide ','start ','call ','wait ','if ','else ','end if','end of','cursor ','at ','left click','right click','mouse ','key ','add item','remove item','character ','quit ','open ','close ','enable ','disable ','move ','scroll ','zoom ','rotate ','shake ','load ','save ','hint menu','switch to ','execute ','begin of','jump to ','align ','center ','send ','walk ','pick up','use item','give item','combine ','run ','trigger ','activate ','deactivate ','create ','delete ','update ','reset ','flip ','tween ','scale ','turn ','look ','say ','speak ','delay ','sleep ','resume ']
    if 'executed' in lower: return False
    for p in engine_pfx:
        if lower.startswith(p): return False
    trimmed = lower.lstrip(''.join(c for c in lower if not c.isalnum())[:1]) if lower and not lower[0].isalnum() else lower
    if trimmed != lower:
        for p in engine_pfx:
            if trimmed.startswith(p): return False
    if s.startswith('-') or s.startswith('!') or s.startswith(';'): return False
    if s and s[0].isdigit(): return False
    if s.count("'") >= 2: return False
    if '["' in s or '"]' in s: return False
    if 'replaceItem(' in s or 'replaceitem(' in lower: return False
    if 'activate voice' in lower or 'activate text' in lower: return False
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
    if all(c.isalnum() or c=='_' for c in s) and '_' in s: return False
    if all(c.isupper() or c=='_' or c.isdigit() or c==' ' for c in s) and len(s)>3: return False
    if ' ' not in s: return False
    words = [w for w in s.split() if sum(1 for c in w if c.isalpha())>=2]
    if len(words) < 2: return False
    for p in ["eshader","ealign","eonly","etext","action_","scene_","char_","obj_","cond_","val_","anim_","sound_","plugins/","Graphics/","Sounds/","Music/","Fonts/","config.","plugin","TVis","TScript","Vis ","vis_","cursor_","button_","interface_","menu_","dialog_","sfx_","bgm_","vfx_","ui_","hud_"]:
        if s.startswith(p) or lower.startswith(p.lower()): return False
    for kw in ["ActiveAnimations","PolygonalLink","ScrollPosition","CharacterLink","ObjectLink","SceneLink","ActionLink","SoundLink","MusicLink","FontLink","CursorLink","ParticleLink","InterfaceLink","AnimationLink","ConditionLink","ValueLink","DialogLink","Brightness","Saturation","setPosition","getPosition","currentCharacter","activeScene","mainCharacter","milliseconds"," to object ","object area","(immediate)"," position"]:
        if kw in s: return False
    has_lower = any(w[0].islower() for w in words if w and w[0].isalpha())
    has_punct = any(c in '.,!?:;"\u2026' for c in s)
    if not has_lower and not has_punct: return False
    # Short strings (< 40 chars) without sentence-ending punctuation are likely object/anim names
    has_end_punct = s[-1] in '.,!?;:"\u2026' if s else False
    if len(s) < 40 and not has_end_punct and len(words) <= 4:
        # Exception: strings with colon (dialogue format "character: text")
        if ':' not in s:
            return False
    return True

strings = []
p = 0
while p + 4 < len(payload):
    length = struct.unpack_from('<I', payload, p)[0]
    if 2 <= length <= 10000 and p + 4 + length <= len(payload):
        raw = payload[p+4:p+4+length]
        try:
            text = raw.decode('utf-8').rstrip('\x00')
            if filt(text):
                strings.append(text)
                p = p + 4 + length
                continue
        except: pass
    p += 1

print(f"Total: {len(strings)}")
print(f"\nFirst 40:")
for i,t in enumerate(strings[:40]):
    print(f"  [{i:4d}] {t[:150]}")
print(f"\nRandom middle (5000-5040):")
for i,t in enumerate(strings[5000:5040]):
    print(f"  [{5000+i:4d}] {t[:150]}")
print(f"\nLast 20:")
for i,t in enumerate(strings[-20:]):
    print(f"  [{len(strings)-20+i:4d}] {t[:150]}")
