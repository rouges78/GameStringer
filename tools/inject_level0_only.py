"""
Quick injection for level0 only (character creation screen).
Uses reverse-search to find ALL strings.
"""
import struct, os, re, json, time, requests

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\final_cache.json"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"

RPG_GLOSSARY = """Keep ALL tags exactly: <b>, </b>, <i>, </i>, <color=#HEX>, </color>, <size=N>, </size>, <smallcaps>, </smallcaps>, \\n, \\r.
Keep proper nouns: Miska, Darrow, Snell, Meek, Urth, Norvik, Torna, Prax, Fillius, Halfweed, Solveig, Ebb.
Italian RPG: Forza=Strength, Destrezza=Dexterity, Costituzione=Constitution, Intelligenza=Intelligence, Saggezza=Wisdom, Carisma=Charisma, Punti Ferita=Hit Points."""

ANCHORS = [
    rb' the ', rb' and ', rb' your ', rb' you ', rb' with ', rb' for ',
    rb' that ', rb' this ', rb' from ', rb' have ', rb' are ', rb' was ',
    rb' The ', rb' Your ', rb' You ',
    rb'measures your', rb'Proficient', rb'shepherd', rb'testosterone',
    rb'STRENGTH', rb'DEXTERITY', rb'CONSTITUTION', rb'INTELLIGENCE',
    rb'WISDOM', rb'CHARISMA', rb'Hit Points', rb'Saving Throw',
    rb'Background Focus', rb'Pre-Built', rb'Randomize',
    rb'Become a', rb'DIVINE', rb'ZEALOT', rb'shepherd knows',
    rb'Punching Bag', rb'literally die', rb'innocent',
]

SKIP = ['#version', '#define', 'void ', 'float ', 'vec4', 'Assets/', 'Packages/',
        'guid:', 'UnityEngine', '.shader', '.prefab', '.mat', 'HLSLCC',
        'Scroll View', 'Fill Area', 'Sliding Area', 'Scrollbar', 'm_Script',
        'uniform ', 'sampler2D', 'precision ', 'layout(']


def load_cache():
    if os.path.exists(CACHE_FILE):
        return json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
    return {}

def save_cache(cache):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)


def find_lp_string(data, text_offset):
    for back in range(1, 1000):
        off = text_offset - back
        if off < 0: return None
        lp = struct.unpack_from('<I', data, off)[0]
        if 8 <= lp <= 10000 and off + 4 + lp > text_offset and off + 4 + lp <= len(data):
            try:
                s = data[off+4:off+4+lp].decode('utf-8')
                if text_offset >= off + 4 and text_offset < off + 4 + lp:
                    return (off, lp, s)
            except: pass
    return None


def is_translatable(s):
    if len(s) < 16: return False
    clean = re.sub(r'<[^>]+>', '', s).replace('\\n',' ').replace('\\r',' ').replace('\n',' ').replace('\r',' ')
    if not re.search(r'[A-Za-z]{3,}\s+[a-zA-Z]{2,}', clean): return False
    if len(clean.strip()) <= 15: return False
    if any(x in s for x in SKIP): return False
    return True


def translate(text, cache):
    if text in cache: return cache[text]
    prompt = f"""Translate this RPG game text from English to Italian.
{RPG_GLOSSARY}
ONLY output the Italian translation, nothing else.

English: {text}
Italian:"""
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL, "prompt": prompt, "stream": False,
            "options": {"temperature": 0.3, "num_predict": 1500}
        }, timeout=120)
        result = resp.json().get("response", "").strip()
        for prefix in ["Italian:", "Italiano:", "Translation:"]:
            if result.startswith(prefix): result = result[len(prefix):].strip()
        lines = result.split("\n")
        if len(lines) > 1:
            for i, l in enumerate(lines[1:], 1):
                if l.strip().startswith(('Note:', 'Nota:', 'Keep', 'I kept', 'Ho mantenuto', '(', 'Here')):
                    result = "\n".join(lines[:i]).strip()
                    break
        if result and len(result) > 2:
            cache[text] = result
            return result
    except Exception as e:
        print(f"  OLLAMA ERROR: {e}")
    return None


def main():
    print("=== Level0 Quick Injection ===")
    cache = load_cache()
    print(f"Cache: {len(cache)} entries")

    # Read level0
    fpath = os.path.join(ASSETS_DIR, "level0")
    backup = fpath + ".backup"
    source = backup if os.path.exists(backup) else fpath
    data = open(source, 'rb').read()

    # Find all strings via reverse-search
    found = {}
    for pattern in ANCHORS:
        idx = 0
        while True:
            idx = data.find(pattern, idx)
            if idx < 0: break
            result = find_lp_string(data, idx)
            if result:
                off, lp, text = result
                if off not in found and is_translatable(text):
                    found[off] = (lp, text)
            idx += 1

    print(f"Found {len(found)} translatable strings in level0")

    # Check which need translation
    need = [(off, lp, text) for off, (lp, text) in found.items() if text not in cache]
    print(f"Need translation: {len(need)}")

    # Translate
    if need:
        start = time.time()
        for i, (off, lp, text) in enumerate(need):
            translate(text, cache)
            if (i+1) % 10 == 0:
                elapsed = time.time() - start
                rate = (i+1) / elapsed * 60
                eta = (len(need) - i - 1) / max(1, rate)
                print(f"  [{i+1}/{len(need)}] {rate:.0f}/min, ETA: {eta:.0f} min")
                save_cache(cache)
        save_cache(cache)

    # Inject
    result_data = bytearray(data)
    replaced = 0
    truncated = 0
    for off, (lp, text) in found.items():
        if text not in cache: continue
        italian = cache[text]
        it_bytes = italian.encode('utf-8')
        padded = 4 + lp
        while padded % 4 != 0: padded += 1
        available = padded - 4

        if len(it_bytes) <= available:
            struct.pack_into('<I', result_data, off, len(it_bytes))
            result_data[off+4:off+4+len(it_bytes)] = it_bytes
            for j in range(len(it_bytes), available):
                result_data[off+4+j] = 0
            replaced += 1
        else:
            trunc = it_bytes[:available]
            while trunc:
                try: trunc.decode('utf-8'); break
                except: trunc = trunc[:-1]
            if trunc:
                struct.pack_into('<I', result_data, off, len(trunc))
                result_data[off+4:off+4+len(trunc)] = trunc
                for j in range(len(trunc), available):
                    result_data[off+4+j] = 0
                replaced += 1
                truncated += 1

    # Write
    if not os.path.exists(backup):
        import shutil
        shutil.copy2(fpath, backup)
    with open(fpath, 'wb') as f:
        f.write(bytes(result_data))

    print(f"\nLevel0: {replaced} replaced ({truncated} truncated)")

    # Verify
    verify_data = open(fpath, 'rb').read()
    for needle, label in [(b'testosterone-fueled', 'STRENGTH'), (b'DIVINE MISSION', 'ZEALOT'), (b'shepherd knows', 'Torna')]:
        idx = verify_data.find(needle)
        if idx >= 0:
            print(f"  STILL ENGLISH: {label}")
        else:
            print(f"  TRANSLATED: {label}")

    save_cache(cache)
    print(f"\nCache: {len(cache)} entries")
    print("Avvia il gioco per verificare!")


if __name__ == '__main__':
    main()
