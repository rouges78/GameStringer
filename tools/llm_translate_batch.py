"""
Batch translate Esoteric Ebb quest/background strings using Ollama LLM.
Uses huihui_ai/hy-mt1.5-abliterated:7b (dedicated translation model)
"""
import json
import csv
import os
import time
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"
CSV_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables"
OUTPUT_DIR = os.path.join(CSV_DIR, "translated")
CACHE_FILE = os.path.join(OUTPUT_DIR, "translation_cache.json")

# RPG terminology glossary for consistent translations
GLOSSARY = """
GLOSSARY (use these translations consistently):
- Cleric = Chierico
- Coinlord = Signore delle Monete
- Tea Shop = Negozio di Tè  
- Short Rest = Riposo Breve
- Long Rest = Riposo Lungo
- hit points / HP = punti ferita / PF
- spell slot = slot incantesimo
- Death Saving Throw = Tiro Salvezza contro Morte
- exhaustion = sfinimento
- proficiency = competenza
- advantage = vantaggio
- disadvantage = svantaggio
- Freestrider = Cavalcatore Libero
- election = elezione
- Pillar of Jor = Pilastro di Jor
- Gate of Jor = Portale di Jor
- Strings of Jor = Corde di Jor
- Shards of Jor = Frammenti di Jor
- City Below = Città Sotterranea
- Lower Lair = Tana Inferiore
- Goblin Garden = Giardino dei Goblin
- Necklace of Fireballs = Collana di Palle di Fuoco
- The Undercommon = L'Undercommon
- Behold Check = Prova di Osservazione
- trifle check = prova di destrezza minore
Keep proper nouns (character/place names) unchanged: Tolstad, Norvik, Snell, Sageleaf, Darrow, Meriadoc, Visken, Kraaid, Viira, Moongore, Drummer, Ettir, etc.
"""


def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_cache(cache: dict):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def translate_text(english: str, cache: dict) -> str:
    """Translate a single text using Ollama"""
    if english in cache:
        return cache[english]
    
    if not english.strip() or english.strip() in ('...', ''):
        return english
    
    prompt = f"""Translate the following RPG game text from English to Italian. 
This is from a fantasy RPG video game. Maintain the tone, style, and any special formatting.
{GLOSSARY}

English text to translate:
{english}

Italian translation:"""

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 1024,
            }
        }, timeout=120)
        
        if resp.status_code == 200:
            result = resp.json().get('response', '').strip()
            # Clean up common LLM artifacts
            result = result.replace('```', '').strip()
            # Remove "Italian translation:" prefix if present
            for prefix in ['Italian translation:', 'Traduzione:', 'Translation:', 'Italian:']:
                if result.lower().startswith(prefix.lower()):
                    result = result[len(prefix):].strip()
            # Remove quotes if the LLM wrapped the translation
            if result.startswith('"') and result.endswith('"'):
                result = result[1:-1]
            
            cache[english] = result
            return result
        else:
            print(f"    ERROR: HTTP {resp.status_code}")
            return english
    except Exception as e:
        print(f"    ERROR: {e}")
        return english


def translate_csv_file(csv_path: str, output_path: str, cache: dict, already_translated: dict = None):
    """Translate all entries in a CSV file"""
    entries = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(dict(row))
    
    translated_count = 0
    skipped_count = 0
    
    for i, entry in enumerate(entries):
        eng = entry.get('ENGLISH', '').strip()
        entry_id = entry.get('ID', '')
        
        # Skip if already has Italian translation from manual work
        if already_translated and entry_id in already_translated:
            entry['ITALIAN'] = already_translated[entry_id]
            translated_count += 1
            continue
        
        if not eng or eng in ('...', 'SPELLNAME', 'SPELL DESC', 'ItemName', 
                               'Item descriptions here.', 'Popup text here.'):
            skipped_count += 1
            continue
        
        print(f"    [{i+1}/{len(entries)}] {eng[:60]}...", end='', flush=True)
        translation = translate_text(eng, cache)
        entry['ITALIAN'] = translation
        translated_count += 1
        print(f" ✓")
        
        # Save cache every 10 translations
        if translated_count % 10 == 0:
            save_cache(cache)
    
    # Save translated CSV
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['ID', 'ENGLISH', 'ITALIAN'])
        writer.writeheader()
        for e in entries:
            writer.writerow({
                'ID': e.get('ID', ''),
                'ENGLISH': e.get('ENGLISH', ''),
                'ITALIAN': e.get('ITALIAN', '')
            })
    
    return translated_count, skipped_count


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    cache = load_cache()
    
    print("=" * 60)
    print("Esoteric Ebb - LLM Batch Translation")
    print(f"Model: {MODEL}")
    print(f"Cache: {len(cache)} entries")
    print("=" * 60)
    
    # Test connection
    print("\nTesting Ollama connection...")
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": "Translate to Italian: Hello world",
            "stream": False,
            "options": {"num_predict": 50}
        }, timeout=30)
        if resp.status_code == 200:
            test = resp.json().get('response', '')
            print(f"  OK! Test: 'Hello world' -> '{test.strip()}'")
        else:
            print(f"  ERROR: {resp.status_code}")
            return
    except Exception as e:
        print(f"  Connection failed: {e}")
        return
    
    # Load already-translated feats (manual translations)
    feat_translations = {}
    feat_path = os.path.join(OUTPUT_DIR, "feats.csv")
    if os.path.exists(feat_path):
        with open(feat_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('ITALIAN'):
                    feat_translations[row['ID']] = row['ITALIAN']
    
    ui_translations = {}
    ui_path = os.path.join(OUTPUT_DIR, "uielements.csv")
    if os.path.exists(ui_path):
        with open(ui_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('ITALIAN'):
                    ui_translations[row['ID']] = row['ITALIAN']
    
    total_translated = 0
    total_skipped = 0
    start_time = time.time()
    
    # Translate each CSV
    files_to_translate = [
        ("uielements.csv", ui_translations),
        ("feats.csv", feat_translations),
        ("popups.csv", {}),
        ("questpoints.csv", {}),
        ("table_0.csv", {}),
        ("journaltexts.csv", {}),
        ("spelltexts.csv", {}),
        ("itemtexts.csv", {}),
    ]
    
    for csv_name, pre_translated in files_to_translate:
        csv_path = os.path.join(CSV_DIR, csv_name)
        if not os.path.exists(csv_path):
            continue
        
        output_path = os.path.join(OUTPUT_DIR, csv_name)
        print(f"\n{'='*50}")
        print(f"Translating: {csv_name}")
        print(f"{'='*50}")
        
        t, s = translate_csv_file(csv_path, output_path, cache, pre_translated)
        total_translated += t
        total_skipped += s
        
        # Save cache after each file
        save_cache(cache)
        print(f"  Done: {t} translated, {s} skipped")
    
    elapsed = time.time() - start_time
    
    print(f"\n{'='*60}")
    print(f"TRANSLATION COMPLETE")
    print(f"{'='*60}")
    print(f"Total translated: {total_translated}")
    print(f"Total skipped: {total_skipped}")
    print(f"Cache entries: {len(cache)}")
    print(f"Time: {elapsed:.1f}s ({elapsed/60:.1f}min)")
    print(f"Output: {OUTPUT_DIR}")
    
    # Save final cache
    save_cache(cache)


if __name__ == '__main__':
    main()
