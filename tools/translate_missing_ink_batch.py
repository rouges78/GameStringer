"""
Batch translate missing Ink strings using Ollama.
Sends multiple strings per call for ~10x speedup.
Saves progress continuously to allow resume.
"""
import csv, json, re, time, os, requests

MISSING_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\missing_ink_strings.csv"
INK_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
CACHE_FILE = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_cache.json"
OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"
BATCH_SIZE = 10

GLOSSARY = """GLOSSARIO (NON tradurre questi nomi):
- Esoteric Ebb, Ebb, Urth, Norvik, Miska, Darrow, Meek, Jor, Ragn
- Zealot, Cleric, Exile, The Bastion, The Underbelly
- Kha-Ymor, VK, Djinn
Traduci in italiano naturale. Mantieni tag HTML (<b>, <i>, <color>). Rispondi SOLO con le traduzioni numerate."""


def load_cache():
    if os.path.exists(CACHE_FILE):
        return json.load(open(CACHE_FILE, 'r', encoding='utf-8'))
    return {}


def save_cache(cache):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=0)


def translate_batch(strings):
    """Translate a batch of strings with one Ollama call."""
    numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(strings))
    prompt = f"""{GLOSSARY}

Traduci queste {len(strings)} frasi dall'inglese all'italiano:

{numbered}

Rispondi con SOLO le traduzioni numerate (1. traduzione, 2. traduzione, ecc.):"""

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 4096}
        }, timeout=120)
        result = resp.json().get("response", "").strip()

        # Parse numbered responses
        translations = {}
        for line in result.split('\n'):
            line = line.strip()
            m = re.match(r'^(\d+)\.\s*(.+)$', line)
            if m:
                num = int(m.group(1))
                text = m.group(2).strip()
                if 1 <= num <= len(strings) and text:
                    translations[num - 1] = text

        return translations
    except Exception as e:
        print(f"  Error: {e}")
        return {}


def main():
    # Load missing strings
    missing = []
    with open(MISSING_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if row and row[0]:
                s = row[0]
                # Only translate actual sentences
                if len(s.strip()) >= 8 and re.search(r'[a-zA-Z]{3,}\s+[a-zA-Z]{2,}', s):
                    if not s.strip().startswith('#') and not s.strip().startswith('->'):
                        missing.append(s)

    print(f"Translatable missing strings: {len(missing)}")

    # Load cache
    cache = load_cache()
    print(f"Cache: {len(cache)} entries")

    # Filter out already cached
    to_translate = [s for s in missing if s not in cache]
    print(f"Need translation: {len(to_translate)}")

    if not to_translate:
        print("Nothing to translate!")
        return

    # Estimate time
    batches = (len(to_translate) + BATCH_SIZE - 1) // BATCH_SIZE
    est_min = batches * 5 / 60  # ~5 sec per batch
    print(f"Batches: {batches}, estimated: ~{est_min:.0f} min")

    translated = 0
    start_time = time.time()
    save_interval = 50  # save cache every 50 batches

    for batch_idx in range(0, len(to_translate), BATCH_SIZE):
        batch = to_translate[batch_idx:batch_idx + BATCH_SIZE]
        results = translate_batch(batch)

        for i, text in results.items():
            if i < len(batch):
                cache[batch[i]] = text
                translated += 1

        batch_num = batch_idx // BATCH_SIZE + 1
        if batch_num % 20 == 0 or batch_num <= 3:
            elapsed = time.time() - start_time
            rate = translated / elapsed * 60 if elapsed > 0 else 0
            remaining = (len(to_translate) - batch_idx - BATCH_SIZE) / max(rate, 1) if rate > 0 else 0
            print(f"  [{batch_num}/{batches}] translated={translated}, {rate:.0f}/min, ETA: {remaining:.0f} min")

        if batch_num % save_interval == 0:
            save_cache(cache)

    # Final save
    save_cache(cache)

    # Merge with existing translations CSV
    existing = {}
    with open(INK_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 2 and row[0]:
                existing[row[0]] = row[1]

    # Add new translations
    added = 0
    for en, it in cache.items():
        if en not in existing and it:
            existing[en] = it
            added += 1

    # Save updated CSV
    with open(INK_CSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['ENGLISH', 'ITALIAN'])
        for en, it in sorted(existing.items()):
            writer.writerow([en, it])

    elapsed = time.time() - start_time
    print(f"\nDone! Translated: {translated}, Added to CSV: {added}")
    print(f"Total CSV entries: {len(existing)}")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"Cache saved: {len(cache)} entries")


if __name__ == '__main__':
    main()
