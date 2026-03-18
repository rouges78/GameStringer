"""
Final level injector: reverse-search approach.
Instead of scanning forward (which skips strings due to false positive length-prefixes),
search for English text patterns and trace back to their length prefix.
"""
import struct
import os
import re
import json
import hashlib
import time
import requests

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\final_cache.json"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"

RPG_GLOSSARY = """Keep ALL tags exactly: <b>, </b>, <i>, </i>, <color=#HEX>, </color>, <size=N>, </size>, <smallcaps>, </smallcaps>, \\n, \\r.
Keep proper nouns unchanged: Miska, Darrow, Snell, Meek, Urth, Norvik, Torna, Prax, Fillius, Halfweed, Solveig, Ebb.
Italian RPG terms: Forza=Strength, Destrezza=Dexterity, Costituzione=Constitution, Intelligenza=Intelligence, Saggezza=Wisdom, Carisma=Charisma, Punti Ferita=Hit Points."""

# Common English words to search for as anchors
ANCHOR_PATTERNS = [
    rb' the ', rb' and ', rb' your ', rb' you ', rb' with ', rb' for ',
    rb' that ', rb' this ', rb' from ', rb' have ', rb' are ', rb' was ',
    rb' will ', rb' can ', rb' not ', rb' but ', rb' all ', rb' its ',
    rb' The ', rb' And ', rb' Your ', rb' You ', rb' With ', rb' For ',
    rb'measures your', rb'Proficient', rb'shepherd', rb'testosterone',
    rb'STRENGTH', rb'DEXTERITY', rb'CONSTITUTION', rb'INTELLIGENCE',
    rb'WISDOM', rb'CHARISMA', rb'Hit Points', rb'Saving Throw',
    rb'Background Focus', rb'Pre-Built', rb'Randomize',
]


def load_cache():
    if os.path.exists(CACHE_FILE):
        return json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
    return {}


def save_cache(cache):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)


def find_length_prefixed_string(data, text_offset):
    """Given an offset inside a string, find the length-prefix start."""
    for back in range(1, 1000):
        off = text_offset - back
        if off < 0:
            return None
        lp = struct.unpack_from('<I', data, off)[0]
        if 8 <= lp <= 10000 and off + 4 + lp > text_offset and off + 4 + lp <= len(data):
            raw = data[off+4:off+4+lp]
            try:
                s = raw.decode('utf-8')
                # Verify it contains the text at the expected position
                if text_offset >= off + 4 and text_offset < off + 4 + lp:
                    return (off, lp, s)
            except UnicodeDecodeError:
                pass
    return None


def is_translatable(s):
    """Check if a string should be translated."""
    if len(s) < 16:
        return False
    clean = re.sub(r'<[^>]+>', '', s).replace('\\n', ' ').replace('\\r', ' ').replace('\n', ' ').replace('\r', ' ')
    if not re.search(r'[A-Za-z]{3,}\s+[a-zA-Z]{2,}', clean):
        return False
    if len(clean.strip()) <= 15:
        return False
    skip = ['#version', '#define', 'void ', 'float ', 'vec4', 'Assets/', 'Packages/',
            'guid:', 'UnityEngine', '.shader', '.prefab', '.mat', 'HLSLCC',
            'Scroll View', 'Fill Area', 'Sliding Area', 'Scrollbar', 'm_Script',
            'uniform ', 'sampler2D', 'precision ']
    if any(x in s for x in skip):
        return False
    return True


def translate(text, cache):
    """Translate using cache or Ollama."""
    if text in cache:
        return cache[text]

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
            if result.startswith(prefix):
                result = result[len(prefix):].strip()
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
        print(f"    OLLAMA ERROR: {e}")
    return None


def find_all_strings_reverse(data):
    """Find all English strings by searching for anchor patterns and tracing back."""
    found = {}  # offset -> (lp, text)

    for pattern in ANCHOR_PATTERNS:
        idx = 0
        while True:
            idx = data.find(pattern, idx)
            if idx < 0:
                break
            result = find_length_prefixed_string(data, idx)
            if result:
                off, lp, text = result
                if off not in found and is_translatable(text):
                    found[off] = (lp, text)
            idx += 1

    return found


def inject_string(result, off, orig_lp, italian):
    """Replace a length-prefixed string in the bytearray."""
    italian_bytes = italian.encode('utf-8')
    # Calculate available space (original length + padding to 4-byte boundary)
    padded = 4 + orig_lp
    while padded % 4 != 0:
        padded += 1
    available = padded - 4

    if len(italian_bytes) <= available:
        struct.pack_into('<I', result, off, len(italian_bytes))
        result[off+4:off+4+len(italian_bytes)] = italian_bytes
        for j in range(len(italian_bytes), available):
            result[off+4+j] = 0
        return True
    else:
        # Truncate
        truncated = italian_bytes[:available]
        while truncated:
            try:
                truncated.decode('utf-8')
                break
            except:
                truncated = truncated[:-1]
        if truncated:
            struct.pack_into('<I', result, off, len(truncated))
            result[off+4:off+4+len(truncated)] = truncated
            for j in range(len(truncated), available):
                result[off+4+j] = 0
            return True
    return False


def main():
    print("=" * 60)
    print("Level Final Injection (reverse-search)")
    print("=" * 60)

    cache = load_cache()
    print(f"Cache: {len(cache)} entries")

    # Pre-scan: find ALL unique translatable strings across all levels
    print("\n--- Pre-scanning all levels ---")
    all_strings = {}  # text -> set of files
    for lvl in range(25):
        fname = f"level{lvl}"
        backup = os.path.join(ASSETS_DIR, fname + ".backup")
        source = backup if os.path.exists(backup) else os.path.join(ASSETS_DIR, fname)
        if not os.path.exists(source):
            continue
        data = open(source, 'rb').read()
        found = find_all_strings_reverse(data)
        for off, (lp, text) in found.items():
            if text not in all_strings:
                all_strings[text] = set()
            all_strings[text].add(fname)
        print(f"  {fname}: {len(found)} strings")

    print(f"\nUnique translatable strings: {len(all_strings)}")

    # Check specific strings
    for text in all_strings:
        if 'testosterone' in text:
            print(f"  FOUND testosterone string ({len(text)} chars)")
            break
    else:
        print("  WARNING: testosterone string NOT found!")

    already = sum(1 for t in all_strings if t in cache)
    missing = [t for t in all_strings if t not in cache]
    print(f"Already cached: {already}")
    print(f"Need translation: {len(missing)}")

    # Translate missing
    if missing:
        print(f"\n--- Translating {len(missing)} strings ---")
        start = time.time()
        for idx, text in enumerate(missing):
            translate(text, cache)
            if (idx + 1) % 10 == 0:
                elapsed = time.time() - start
                rate = (idx + 1) / elapsed * 60
                eta = (len(missing) - idx - 1) / max(1, rate)
                print(f"  [{idx+1}/{len(missing)}] {rate:.0f}/min, ETA: {eta:.0f} min")
                save_cache(cache)
        save_cache(cache)

    # Inject
    print(f"\n--- Injecting ---")
    total_replaced = 0
    total_truncated = 0
    for lvl in range(25):
        fname = f"level{lvl}"
        fpath = os.path.join(ASSETS_DIR, fname)
        backup = fpath + ".backup"
        source = backup if os.path.exists(backup) else fpath
        if not os.path.exists(source):
            continue

        data = open(source, 'rb').read()
        result = bytearray(data)
        found = find_all_strings_reverse(data)

        replaced = 0
        truncated = 0
        for off, (lp, text) in found.items():
            if text in cache:
                italian = cache[text]
                it_bytes = italian.encode('utf-8')
                padded = 4 + lp
                while padded % 4 != 0:
                    padded += 1
                if len(it_bytes) > padded - 4:
                    truncated += 1
                if inject_string(result, off, lp, italian):
                    replaced += 1

        if replaced > 0:
            # Write to the actual file (not backup)
            if not os.path.exists(backup):
                import shutil
                shutil.copy2(fpath, backup)
            with open(fpath, 'wb') as f:
                f.write(bytes(result))

        total_replaced += replaced
        total_truncated += truncated
        trunc_msg = f" ({truncated} truncated)" if truncated else ""
        print(f"  {fname}: {replaced} replaced{trunc_msg}")

    save_cache(cache)
    print(f"\n=== DONE: {total_replaced} total ({total_truncated} truncated) ===")
    print(f"Cache: {len(cache)} entries")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
