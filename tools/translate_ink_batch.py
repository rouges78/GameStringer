"""
Translate Ink strings from Esoteric Ebb using Ollama LLM.
Uses batching for short strings and caching to avoid re-translating.
"""
import json
import os
import time
import requests
import csv
import re
import hashlib

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"

INK_JSON = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\all_ink_strings.json"
UNIQUE_TXT = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\unique_texts.txt"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated"
CACHE_FILE = os.path.join(OUTPUT_DIR, "translation_cache.json")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "ink_translations.csv")

os.makedirs(OUTPUT_DIR, exist_ok=True)

RPG_GLOSSARY = """
GLOSSARY (use these Italian terms):
- Freestrider = Cavalcalibero
- Beast/Beasts = Bestia/Bestie
- Urth = Urth (keep)
- Ebb = Riflusso
- Miska = Miska (keep)
- Darrow = Darrow (keep)
- Snell = Snell (keep)
- Meek = Meek (keep)
- Dex/Dexterity = Destrezza
- Str/Strength = Forza
- Wis/Wisdom = Saggezza
- Int/Intelligence = Intelligenza
- Con/Constitution = Costituzione
- Cha/Charisma = Carisma
- Feat = Talento
- Spell = Incantesimo
- Hit Points/HP = Punti Ferita/PF
- Armor Class/AC = Classe Armatura/CA
- Saving Throw = Tiro Salvezza
- Skill Check = Prova di Abilità
- XP = PE (Punti Esperienza)
- NPC = PNG
- Quest = Missione
- Dungeon = Dungeon (keep)
- Zealot = Zelota
- Cleric = Chierico
- Rogue = Ladro
- Mage = Mago
- Warrior/Fighter = Guerriero
- Ranger = Ranger (keep)
- Paladin = Paladino
- Sea = Mare
- River = Fiume
- Godly Voice = Voce Divina
- Divine Mission = Missione Divina
"""


def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)


def translate_single(text, cache):
    """Translate a single string."""
    key = hashlib.md5(text.encode()).hexdigest()
    if key in cache:
        return cache[key]

    # Strip HTML tags for the prompt but preserve them
    has_tags = bool(re.search(r'<[^>]+>', text))
    
    prompt = f"""Translate this RPG game text from English to Italian.
Keep HTML tags like <i>, <b>, <shake> exactly as they are.
Keep proper nouns unchanged (Miska, Darrow, Snell, Meek, Urth, etc).
Keep game mechanics terms in their standard Italian RPG equivalents.
{RPG_GLOSSARY}
ONLY output the Italian translation, nothing else.

English: {text}
Italian:"""

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 500}
        }, timeout=60)
        result = resp.json().get("response", "").strip()
        # Clean up common issues
        result = result.replace("Italian:", "").strip()
        result = result.split("\n")[0].strip()  # Take only first line
        if result and len(result) > 1:
            cache[key] = result
            return result
    except Exception as e:
        print(f"  ERROR: {e}")
    return None


def translate_batch(texts, cache):
    """Translate a batch of short strings in one request."""
    # Check cache first
    uncached = []
    results = {}
    for t in texts:
        key = hashlib.md5(t.encode()).hexdigest()
        if key in cache:
            results[t] = cache[key]
        else:
            uncached.append(t)
    
    if not uncached:
        return results
    
    # Build batch prompt
    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(uncached))
    prompt = f"""Translate these RPG game dialogue lines from English to Italian.
Keep HTML tags exactly as they are. Keep proper nouns unchanged.
{RPG_GLOSSARY}
Output ONLY the numbered Italian translations, one per line.

{numbered}

Italian translations:"""

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 2000}
        }, timeout=120)
        raw = resp.json().get("response", "").strip()
        
        # Parse numbered responses
        lines = [l.strip() for l in raw.split("\n") if l.strip()]
        for line in lines:
            m = re.match(r'^(\d+)\.\s*(.+)', line)
            if m:
                idx = int(m.group(1)) - 1
                trans = m.group(2).strip()
                if 0 <= idx < len(uncached) and trans:
                    key = hashlib.md5(uncached[idx].encode()).hexdigest()
                    cache[key] = trans
                    results[uncached[idx]] = trans
        
        # Any uncached that weren't parsed, translate individually
        for t in uncached:
            if t not in results:
                r = translate_single(t, cache)
                if r:
                    results[t] = r
                    
    except Exception as e:
        print(f"  BATCH ERROR: {e}")
        # Fallback: translate individually
        for t in uncached:
            r = translate_single(t, cache)
            if r:
                results[t] = r
    
    return results


def main():
    print("=" * 60)
    print("Esoteric Ebb - Ink String Translator")
    print("=" * 60)
    
    # Load unique texts
    with open(UNIQUE_TXT, 'r', encoding='utf-8') as f:
        texts = [l.strip() for l in f if l.strip()]
    print(f"Strings to translate: {len(texts)}")
    
    cache = load_cache()
    cached_count = sum(1 for t in texts if hashlib.md5(t.encode()).hexdigest() in cache)
    print(f"Already cached: {cached_count}")
    print(f"Remaining: {len(texts) - cached_count}")
    
    # Translate in batches
    BATCH_SIZE = 10
    translated = 0
    failed = 0
    start_time = time.time()
    save_interval = 50  # Save cache every N translations
    
    # Sort by length (short first for batching)
    texts_sorted = sorted(texts, key=len)
    
    i = 0
    while i < len(texts_sorted):
        text = texts_sorted[i]
        key = hashlib.md5(text.encode()).hexdigest()
        
        if key in cache:
            translated += 1
            i += 1
            continue
        
        # Batch short strings together
        if len(text) <= 50:
            batch = []
            while i < len(texts_sorted) and len(texts_sorted[i]) <= 50 and len(batch) < BATCH_SIZE:
                bkey = hashlib.md5(texts_sorted[i].encode()).hexdigest()
                if bkey not in cache:
                    batch.append(texts_sorted[i])
                i += 1
            
            if batch:
                results = translate_batch(batch, cache)
                translated += len(results)
                failed += len(batch) - len(results)
                
                elapsed = time.time() - start_time
                total_done = sum(1 for t in texts if hashlib.md5(t.encode()).hexdigest() in cache)
                rate = total_done / max(1, elapsed) * 60
                remaining = len(texts) - total_done
                eta = remaining / max(1, rate)
                
                if translated % 20 == 0 or translated < 5:
                    print(f"  [{total_done}/{len(texts)}] {rate:.0f}/min, ETA: {eta:.0f} min | batch of {len(batch)}")
        else:
            # Translate long strings individually
            result = translate_single(text, cache)
            if result:
                translated += 1
            else:
                failed += 1
            i += 1
            
            if translated % 20 == 0:
                elapsed = time.time() - start_time
                total_done = sum(1 for t in texts if hashlib.md5(t.encode()).hexdigest() in cache)
                rate = total_done / max(1, elapsed) * 60
                remaining = len(texts) - total_done
                eta = remaining / max(1, rate)
                print(f"  [{total_done}/{len(texts)}] {rate:.0f}/min, ETA: {eta:.0f} min")
        
        # Save periodically
        if translated % save_interval == 0:
            save_cache(cache)
    
    # Final save
    save_cache(cache)
    
    # Export CSV
    total_done = 0
    with open(OUTPUT_CSV, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['ENGLISH', 'ITALIAN'])
        for t in texts:
            key = hashlib.md5(t.encode()).hexdigest()
            it = cache.get(key, '')
            w.writerow([t, it])
            if it:
                total_done += 1
    
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"DONE in {elapsed/60:.1f} min")
    print(f"  Translated: {total_done}/{len(texts)}")
    print(f"  Failed: {len(texts) - total_done}")
    print(f"  Cache: {CACHE_FILE}")
    print(f"  CSV: {OUTPUT_CSV}")


if __name__ == '__main__':
    main()
