"""
Binary injection v2: text-based matching instead of hash-based.
1. Load existing translations from CSV (text -> translation)
2. Extract strings from current backup
3. Match by text content
4. Translate remaining strings with Ollama
5. Inject into level files
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
CSV_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_translations.csv"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_cache.json"
NEW_CACHE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\level_strings\translated\level_cache_v2.json"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"

RPG_GLOSSARY = """Keep ALL tags exactly: <b>, </b>, <i>, </i>, <color=#HEX>, </color>, <size=N>, </size>, <smallcaps>, </smallcaps>, \\n, \\r.
Keep names: Miska, Darrow, Snell, Meek, Urth, Norvik, Torna, Prax, Fillius, Halfweed, Solveig, Ebb.
Italian RPG: Forza=Strength, Destrezza=Dexterity, Costituzione=Constitution, Intelligenza=Intelligence, Saggezza=Wisdom, Carisma=Charisma, Punti Ferita=Hit Points, Tiro Salvezza=Saving Throw."""


def load_existing_translations():
    """Build text -> translation dict from all available sources."""
    text_dict = {}

    # From CSV
    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                if len(row) >= 2 and row[0].strip() and row[1].strip():
                    en = row[0]
                    it = row[1]
                    # Skip corrupted entries (contain null bytes or non-printable chars)
                    if '\x00' in en or '\x00' in it:
                        continue
                    if len(en) > 5 and len(it) > 2:
                        text_dict[en] = it

    # From old cache: rebuild text mapping by matching hashes
    if os.path.exists(CACHE_FILE):
        cache = json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
        # The cache has hash -> italian, but we need text -> italian
        # We can reverse-match from CSV
        for en, it in list(text_dict.items()):
            h = hashlib.md5(en.encode('utf-8')).hexdigest()
            if h in cache and cache[h] != it:
                # Cache might have better translation
                pass

    print(f"Existing translations: {len(text_dict)}")
    return text_dict


def extract_strings(data):
    """Find all length-prefixed translatable strings."""
    strings = []
    i = 0
    while i + 4 < len(data):
        lp = struct.unpack_from('<I', data, i)[0]
        if 8 <= lp <= 5000 and i + 4 + lp <= len(data):
            raw = data[i+4:i+4+lp]
            try:
                s = raw.decode('utf-8')
                clean = re.sub(r'<[^>]+>', '', s).replace('\\n', ' ').replace('\\r', ' ').replace('\n', ' ').replace('\r', ' ')
                if re.search(r'[A-Za-z]{3,}\s+[a-zA-Z]{2,}', clean) and len(clean.strip()) > 15:
                    skip = ['#version', '#define', 'void ', 'float ', 'vec4', 'Assets/', 'Packages/',
                            'guid:', 'UnityEngine', '.shader', '.prefab', '.mat', 'HLSLCC',
                            'Scroll View', 'Fill Area', 'Sliding Area', 'Scrollbar']
                    if not any(x in s for x in skip):
                        padded = 4 + lp
                        while padded % 4 != 0:
                            padded += 1
                        strings.append({
                            'offset': i,
                            'len_prefix': lp,
                            'text': s,
                            'padded_size': padded,
                        })
            except UnicodeDecodeError:
                pass
            total = 4 + lp
            while total % 4 != 0:
                total += 1
            i += total
            continue
        i += 1
    return strings


def translate_ollama(text):
    """Translate with Ollama."""
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
        if len(lines) > 1 and len(lines[0]) > len(text) * 0.3:
            if any(l.strip().startswith(('Note:', 'Nota:', 'Keep', 'I kept', 'Ho mantenuto')) for l in lines[1:]):
                result = lines[0].strip()
        if result and len(result) > 2:
            return result
    except Exception as e:
        print(f"  OLLAMA ERROR: {e}")
    return None


def inject(data, strings, trans_dict):
    """Replace strings in binary data."""
    result = bytearray(data)
    replaced = 0

    for s in strings:
        text = s['text']
        if text not in trans_dict:
            continue

        italian = trans_dict[text]
        italian_bytes = italian.encode('utf-8')
        available = s['padded_size'] - 4

        if len(italian_bytes) <= available:
            off = s['offset']
            struct.pack_into('<I', result, off, len(italian_bytes))
            result[off+4:off+4+len(italian_bytes)] = italian_bytes
            for j in range(len(italian_bytes), available):
                result[off+4+j] = 0
            replaced += 1
        else:
            # Truncate
            truncated = italian_bytes[:available]
            while truncated:
                try:
                    truncated.decode('utf-8')
                    break
                except:
                    truncated = truncated[:-1]
            off = s['offset']
            struct.pack_into('<I', result, off, len(truncated))
            result[off+4:off+4+len(truncated)] = truncated
            for j in range(len(truncated), available):
                result[off+4+j] = 0
            replaced += 1

    return bytes(result), replaced


def main():
    print("=" * 60)
    print("Level Binary Injection v2 (text-based)")
    print("=" * 60)

    trans_dict = load_existing_translations()

    # First pass: extract strings from level0 backup and find what needs translation
    print("\n--- Pass 1: Identify missing translations ---")
    all_unique_texts = set()
    for lvl in range(25):
        fname = f"level{lvl}"
        backup = os.path.join(ASSETS_DIR, fname + ".backup")
        source = backup if os.path.exists(backup) else os.path.join(ASSETS_DIR, fname)
        if not os.path.exists(source):
            continue
        data = open(source, 'rb').read()
        strings = extract_strings(data)
        for s in strings:
            all_unique_texts.add(s['text'])

    already = sum(1 for t in all_unique_texts if t in trans_dict)
    missing = [t for t in all_unique_texts if t not in trans_dict]
    print(f"Unique texts across all levels: {len(all_unique_texts)}")
    print(f"Already translated: {already}")
    print(f"Need translation: {len(missing)}")

    # Translate missing
    if missing:
        print(f"\n--- Pass 2: Translating {len(missing)} new strings ---")
        start = time.time()
        done = 0
        for text in missing:
            result = translate_ollama(text)
            if result:
                trans_dict[text] = result
                done += 1
                if done % 10 == 0:
                    elapsed = time.time() - start
                    rate = done / elapsed * 60
                    eta = (len(missing) - done) / max(1, rate)
                    print(f"  [{done}/{len(missing)}] {rate:.0f}/min, ETA: {eta:.0f} min")
        print(f"  Translated: {done}/{len(missing)}")

    # Save updated translations
    new_csv = os.path.join(os.path.dirname(CSV_FILE), "level_translations_v2.csv")
    with open(new_csv, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['ENGLISH', 'ITALIAN'])
        for en, it in sorted(trans_dict.items(), key=lambda x: -len(x[0])):
            w.writerow([en, it])
    print(f"Saved: {new_csv}")

    # Pass 3: Inject
    print(f"\n--- Pass 3: Binary injection ---")
    total_replaced = 0
    for lvl in range(25):
        fname = f"level{lvl}"
        fpath = os.path.join(ASSETS_DIR, fname)
        backup = fpath + ".backup"

        if os.path.exists(backup):
            source = backup
        else:
            source = fpath
            import shutil
            shutil.copy2(fpath, backup)

        data = open(source, 'rb').read()
        strings = extract_strings(data)
        translatable = [s for s in strings if s['text'] in trans_dict]

        if not translatable:
            print(f"  {fname}: nothing to inject")
            continue

        new_data, replaced = inject(data, strings, trans_dict)
        if replaced > 0:
            with open(fpath, 'wb') as f:
                f.write(new_data)
            total_replaced += replaced
            print(f"  {fname}: {replaced}/{len(translatable)} replaced")
        else:
            print(f"  {fname}: 0 replaced")

    print(f"\n=== DONE: {total_replaced} total replacements ===")
    print("Avvia il gioco!")


if __name__ == '__main__':
    main()
