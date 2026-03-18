"""
Extract and translate game text strings from level0 (character creation etc).
These strings are duplicated across all level files.
"""
import struct
import os
import re
import json
import csv
import hashlib
import time
import requests

ASSETS_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated"
CACHE_FILE = os.path.join(OUTPUT_DIR, "level_cache.json")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "level_translations.csv")
os.makedirs(OUTPUT_DIR, exist_ok=True)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"

RPG_GLOSSARY = """Keep ALL tags exactly: <b>, </b>, <i>, </i>, <color=#HEX>, </color>, <size=N>, </size>, <smallcaps>, </smallcaps>, <line-indent=X>, \\n, \\r.
Keep names: Miska, Darrow, Snell, Meek, Urth, Norvik, Torna, Prax, Fillius, Halfweed, Solveig, Samuelsdottir, Ebb.
Italian RPG: Forza=Strength, Destrezza=Dexterity, Costituzione=Constitution, Intelligenza=Intelligence, Saggezza=Wisdom, Carisma=Charisma, Punti Ferita=Hit Points, Tiro Salvezza=Saving Throw, Zelota=Zealot, Chierico=Cleric, Ladro=Rogue, Guerriero=Fighter."""


def load_cache():
    if os.path.exists(CACHE_FILE):
        return json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
    return {}


def save_cache(cache):
    json.dump(cache, open(CACHE_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def extract_translatable_strings(data):
    """Extract length-prefixed strings with actual English text."""
    results = []
    i = 0
    while i + 4 < len(data):
        lp = struct.unpack_from('<I', data, i)[0]
        if 8 <= lp <= 5000 and i + 4 + lp <= len(data):
            raw = data[i+4:i+4+lp]
            try:
                s = raw.decode('utf-8')
                clean = re.sub(r'<[^>]+>', '', s).replace('\\n',' ').replace('\\r',' ').replace('\n',' ').replace('\r',' ')
                # Must have English sentence pattern
                if (re.search(r'[A-Za-z]{3,}\s+[a-zA-z]{2,}', clean) and len(clean.strip()) > 15):
                    # Skip code/paths/metadata
                    skip = ['#version','#define','void ','float ','vec4','Assets/','Packages/',
                            'guid:','UnityEngine','.shader','.prefab','.mat','HLSLCC',
                            'Scroll View','Fill Area','Sliding Area','Scrollbar','m_']
                    if not any(x in s for x in skip):
                        results.append(s)
            except: pass
            i += 4 + lp
            while i % 4 != 0: i += 1
            continue
        i += 1
    return list(dict.fromkeys(results))  # deduplicate preserving order


def translate(text, cache):
    key = hashlib.md5(text.encode()).hexdigest()
    if key in cache:
        return cache[key]

    prompt = f"""Translate this RPG game text from English to Italian.
{RPG_GLOSSARY}
ONLY output the Italian translation, nothing else.

English: {text}
Italian:"""

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 1500}
        }, timeout=120)
        result = resp.json().get("response", "").strip()
        # Clean common LLM artifacts
        for prefix in ["Italian:", "Italiano:", "Translation:"]:
            if result.startswith(prefix):
                result = result[len(prefix):].strip()
        # If multi-line and first line looks like the translation, take it
        lines = result.split("\n")
        if len(lines) > 1 and len(lines[0]) > len(text) * 0.3:
            # Check if subsequent lines are explanations
            if any(l.strip().startswith(('Note:', 'Nota:', 'Keep', 'I kept', 'Ho mantenuto')) for l in lines[1:]):
                result = lines[0].strip()
        if result and len(result) > 2:
            cache[key] = result
            return result
    except Exception as e:
        print(f"  ERROR: {e}")
    return None


def main():
    print("=" * 60)
    print("Level String Translator")
    print("=" * 60)

    cache = load_cache()
    print(f"Cache: {len(cache)} entries")

    # Extract from level0 backup (original English)
    source = os.path.join(ASSETS_DIR, "level0.backup")
    if not os.path.exists(source):
        source = os.path.join(ASSETS_DIR, "level0")

    data = open(source, 'rb').read()
    strings = extract_translatable_strings(data)
    print(f"Translatable strings in level0: {len(strings)}")

    # Check how many already cached
    cached = sum(1 for s in strings if hashlib.md5(s.encode()).hexdigest() in cache)
    remaining = len(strings) - cached
    print(f"Already cached: {cached}")
    print(f"Remaining: {remaining}")

    start = time.time()
    done = 0
    for i, s in enumerate(strings):
        key = hashlib.md5(s.encode()).hexdigest()
        if key in cache:
            continue
        result = translate(s, cache)
        done += 1
        if done % 10 == 0:
            elapsed = time.time() - start
            rate = done / elapsed * 60
            eta = (remaining - done) / max(1, rate)
            print(f"  [{cached+done}/{len(strings)}] {rate:.0f}/min, ETA: {eta:.0f} min")
            save_cache(cache)

    save_cache(cache)

    # Export CSV
    with open(OUTPUT_CSV, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['ENGLISH', 'ITALIAN'])
        for s in strings:
            key = hashlib.md5(s.encode()).hexdigest()
            it = cache.get(key, '')
            w.writerow([s, it])

    total_translated = sum(1 for s in strings if hashlib.md5(s.encode()).hexdigest() in cache)
    elapsed = time.time() - start
    print(f"\nDONE in {elapsed/60:.1f} min")
    print(f"Translated: {total_translated}/{len(strings)}")
    print(f"CSV: {OUTPUT_CSV}")
    print(f"Cache: {CACHE_FILE}")


if __name__ == '__main__':
    main()
