"""
Direct single-pass binary injection for level files.
1. Scan backup for ALL length-prefixed English strings
2. For each one, check if translated; if not, translate on-the-fly
3. Replace in-memory and write out
"""
import struct
import os
import re
import json
import hashlib
import time
import requests

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\direct_cache.json"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"

SKIP_WORDS = ['#version', '#define', 'void ', 'float ', 'vec4', 'Assets/', 'Packages/',
              'guid:', 'UnityEngine', '.shader', '.prefab', '.mat', 'HLSLCC',
              'Scroll View', 'Fill Area', 'Sliding Area', 'Scrollbar', 'm_Script']

RPG_GLOSSARY = """Keep ALL tags exactly: <b>, </b>, <i>, </i>, <color=#HEX>, </color>, <size=N>, </size>, <smallcaps>, </smallcaps>, \\n, \\r.
Keep proper nouns unchanged: Miska, Darrow, Snell, Meek, Urth, Norvik, Torna, Prax, Fillius, Halfweed, Solveig, Ebb.
Italian RPG terms: Forza=Strength, Destrezza=Dexterity, Costituzione=Constitution, Intelligenza=Intelligence, Saggezza=Wisdom, Carisma=Charisma, Punti Ferita=Hit Points."""


def load_cache():
    if os.path.exists(CACHE_FILE):
        return json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
    return {}


def save_cache(cache):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)


def is_translatable(s):
    """Check if a string should be translated."""
    clean = re.sub(r'<[^>]+>', '', s).replace('\\n', ' ').replace('\\r', ' ').replace('\n', ' ').replace('\r', ' ')
    if not re.search(r'[A-Za-z]{3,}\s+[a-zA-Z]{2,}', clean):
        return False
    if len(clean.strip()) <= 15:
        return False
    if any(x in s for x in SKIP_WORDS):
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
        # Remove LLM explanations
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


def process_level(fname, cache, dry_run=False):
    """Process a single level file: extract, translate, inject."""
    fpath = os.path.join(ASSETS_DIR, fname)
    backup = fpath + ".backup"

    if os.path.exists(backup):
        source = backup
    else:
        import shutil
        shutil.copy2(fpath, backup)
        source = backup

    data = open(source, 'rb').read()
    result = bytearray(data)

    replaced = 0
    translated_new = 0
    skipped_long = 0
    i = 0

    while i + 4 < len(data):
        lp = struct.unpack_from('<I', data, i)[0]
        if 8 <= lp <= 5000 and i + 4 + lp <= len(data):
            raw = data[i+4:i+4+lp]
            try:
                s = raw.decode('utf-8')
                if is_translatable(s):
                    italian = translate(s, cache)
                    if italian:
                        italian_bytes = italian.encode('utf-8')
                        # Calculate available space
                        padded = 4 + lp
                        while padded % 4 != 0:
                            padded += 1
                        available = padded - 4

                        if len(italian_bytes) <= available:
                            struct.pack_into('<I', result, i, len(italian_bytes))
                            result[i+4:i+4+len(italian_bytes)] = italian_bytes
                            for j in range(len(italian_bytes), available):
                                result[i+4+j] = 0
                            replaced += 1
                        else:
                            # Truncate to fit
                            truncated = italian_bytes[:available]
                            while truncated:
                                try:
                                    truncated.decode('utf-8')
                                    break
                                except:
                                    truncated = truncated[:-1]
                            if truncated:
                                struct.pack_into('<I', result, i, len(truncated))
                                result[i+4:i+4+len(truncated)] = truncated
                                for j in range(len(truncated), available):
                                    result[i+4+j] = 0
                                replaced += 1
                                skipped_long += 1
            except UnicodeDecodeError:
                pass

            total = 4 + lp
            while total % 4 != 0:
                total += 1
            i += total
            continue
        i += 1

    if not dry_run and replaced > 0:
        with open(fpath, 'wb') as f:
            f.write(bytes(result))

    return replaced, skipped_long


def main():
    print("=" * 60)
    print("Level Direct Injection")
    print("=" * 60)

    cache = load_cache()
    print(f"Cache: {len(cache)} entries")

    # First, build cache from all unique strings across all levels
    # to avoid re-translating duplicates
    print("\n--- Pre-scanning all levels for unique strings ---")
    all_strings = set()
    for lvl in range(25):
        fname = f"level{lvl}"
        fpath = os.path.join(ASSETS_DIR, fname)
        backup = fpath + ".backup"
        source = backup if os.path.exists(backup) else fpath
        if not os.path.exists(source):
            continue
        data = open(source, 'rb').read()
        i = 0
        while i + 4 < len(data):
            lp = struct.unpack_from('<I', data, i)[0]
            if 8 <= lp <= 5000 and i + 4 + lp <= len(data):
                raw = data[i+4:i+4+lp]
                try:
                    s = raw.decode('utf-8')
                    if is_translatable(s):
                        all_strings.add(s)
                except:
                    pass
                total = 4 + lp
                while total % 4 != 0:
                    total += 1
                i += total
                continue
            i += 1

    already = sum(1 for s in all_strings if s in cache)
    missing = [s for s in all_strings if s not in cache]
    print(f"Unique translatable: {len(all_strings)}")
    print(f"Already cached: {already}")
    print(f"Need translation: {len(missing)}")

    # Translate missing strings
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
        print(f"  Done: {len(missing)} translated")

    # Verify specific strings
    test_strings = [s for s in all_strings if 'testosterone' in s]
    for s in test_strings:
        in_cache = s in cache
        print(f"\n  VERIFY testosterone: in_cache={in_cache}")
        if in_cache:
            print(f"  Translation: {cache[s][:100]}")

    # Inject into all levels
    print(f"\n--- Injecting into levels ---")
    total = 0
    for lvl in range(25):
        fname = f"level{lvl}"
        fpath = os.path.join(ASSETS_DIR, fname)
        if not os.path.exists(fpath):
            continue
        replaced, truncated = process_level(fname, cache)
        total += replaced
        trunc_msg = f" ({truncated} truncated)" if truncated else ""
        print(f"  {fname}: {replaced} replaced{trunc_msg}")
        if lvl % 5 == 0:
            save_cache(cache)

    save_cache(cache)
    print(f"\n=== DONE: {total} total replacements ===")
    print(f"Cache: {len(cache)} entries")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
