"""
Esoteric Ebb — Context-Aware CSV Table Translator

Miglioria rispetto a llm_translate_batch.py:
- Surrounding rows: 2 righe prima + 2 dopo dalla stessa tabella
- Table type detection: adatta il tono al tipo di contenuto (quest, items, feats, UI)
- Game context nel prompt
- Traduce solo le righe NON ancora in cache (incrementale)
"""
import json
import csv
import os
import time
import requests
import hashlib

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"
CSV_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables"
OUTPUT_DIR = os.path.join(CSV_DIR, "translated")
CACHE_FILE = os.path.join(OUTPUT_DIR, "translation_cache.json")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Game Context ──────────────────────────────────────────────────────
GAME_CONTEXT = """GAME: Esoteric Ebb
GENRE: Dark fantasy RPG with political intrigue
TONE: Serious, philosophical, occasionally sardonic/witty
SETTING: A crumbling world of divine tyrants, feudal lords, and Freestriders
ERA: Medieval fantasy with hints of early modern political thought"""

GLOSSARY = """
GLOSSARY (use these translations consistently):
- Cleric = Chierico
- Coinlord = Signore delle Monete
- Tea Shop = Negozio del Tè
- Short Rest = Riposo Breve
- Long Rest = Riposo Lungo
- hit points / HP = punti ferita / PF
- spell slot = slot incantesimo
- Death Saving Throw = Tiro Salvezza contro Morte
- exhaustion = sfinimento
- proficiency = competenza
- advantage = vantaggio
- disadvantage = svantaggio
- Freestrider = Cavalcalibero
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
- Feat = Talento
- Spell = Incantesimo
- Armor Class/AC = Classe Armatura/CA
- Saving Throw = Tiro Salvezza
- Skill Check = Prova di Abilità
- Zealot = Zelota
- Rogue = Ladro
- Mage = Mago
- Warrior/Fighter = Guerriero
- Paladin = Paladino
- Beast/Beasts = Bestia/Bestie
- Ebb = Riflusso
Keep proper nouns unchanged: Tolstad, Norvik, Snell, Sageleaf, Darrow, Meriadoc, Visken, Kraaid, Viira, Moongore, Drummer, Ettir, Miska, Meek, Prax, Fillius, Urth, Torna, etc.
"""

# ── Table type descriptions for better context ────────────────────────
TABLE_TYPES = {
    "questpoints": "Quest/mission text — narrative descriptions of objectives and story beats",
    "feats": "Character feat/ability descriptions — game mechanic text, precise and concise",
    "itemtexts": "Item names and descriptions — inventory objects, weapons, artifacts",
    "journaltexts": "Journal/codex entries — lore and background story, narrative prose",
    "popups": "UI popup messages — short notifications, warnings, confirmations",
    "uielements": "UI labels and buttons — very short, concise interface text",
    "table_0": "General game text — mixed content, dialogue and descriptions",
    "spelltexts": "Spell names and descriptions — magic ability text, precise RPG terminology",
}

CONTEXT_WINDOW = 2  # righe prima + dopo


def load_cache() -> dict:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_cache(cache: dict):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def build_context_prompt(english: str, prev_rows: list, next_rows: list, 
                         table_type: str, table_desc: str) -> str:
    """Build a context-aware translation prompt for CSV entries."""
    parts = [
        "Translate the following RPG game text from English to Italian.",
        "Maintain the tone, style, and any special formatting.",
        "",
        GAME_CONTEXT,
        f"\nCONTENT TYPE: {table_type} — {table_desc}",
    ]

    # Surrounding context
    if prev_rows or next_rows:
        parts.append("\nSURROUNDING ENTRIES (for context only, do NOT translate these):")
        for pr in prev_rows:
            parts.append(f"  [BEFORE] {pr[:120]}")
        parts.append(f"  >>> {english[:120]} <<<  (TRANSLATE THIS)")
        for nr in next_rows:
            parts.append(f"  [AFTER] {nr[:120]}")

    parts.append(f"\n{GLOSSARY}")
    parts.append("ONLY output the Italian translation, nothing else.")
    parts.append(f"\nEnglish text to translate:\n{english}")
    parts.append("\nItalian translation:")
    
    return "\n".join(parts)


def translate_with_context(english: str, prev_rows: list, next_rows: list,
                           table_type: str, table_desc: str, cache: dict) -> str:
    """Translate a single CSV entry with surrounding context."""
    key = hashlib.md5(english.encode()).hexdigest()
    if key in cache:
        return cache[key]

    if not english.strip() or english.strip() in ('...', ''):
        return english

    prompt = build_context_prompt(english, prev_rows, next_rows, table_type, table_desc)

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 1024}
        }, timeout=120)

        if resp.status_code == 200:
            result = resp.json().get('response', '').strip()
            result = result.replace('```', '').strip()
            for prefix in ['Italian translation:', 'Traduzione:', 'Translation:', 'Italian:']:
                if result.lower().startswith(prefix.lower()):
                    result = result[len(prefix):].strip()
            if result.startswith('"') and result.endswith('"'):
                result = result[1:-1]
            if result and len(result) > 1:
                cache[key] = result
                return result
        else:
            print(f"    ERROR: HTTP {resp.status_code}")
    except Exception as e:
        print(f"    ERROR: {e}")
    return english


def translate_csv_file(csv_path: str, output_path: str, cache: dict,
                       table_type: str, already_translated: dict = None):
    """Translate all entries in a CSV file with context."""
    table_desc = TABLE_TYPES.get(table_type, "General game text")
    
    entries = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(dict(row))

    # Collect all English texts for context window
    all_eng = [e.get('ENGLISH', '').strip() for e in entries]

    translated_count = 0
    skipped_count = 0
    skip_values = ('...', 'SPELLNAME', 'SPELL DESC', 'ItemName',
                   'Item descriptions here.', 'Popup text here.')

    for i, entry in enumerate(entries):
        eng = entry.get('ENGLISH', '').strip()
        entry_id = entry.get('ID', '')

        # Use manual translations if available
        if already_translated and entry_id in already_translated:
            entry['ITALIAN'] = already_translated[entry_id]
            translated_count += 1
            continue

        if not eng or eng in skip_values:
            skipped_count += 1
            continue

        # Context window
        prev = [all_eng[j] for j in range(max(0, i - CONTEXT_WINDOW), i) 
                if all_eng[j].strip() and all_eng[j] not in skip_values]
        nxt = [all_eng[j] for j in range(i + 1, min(len(all_eng), i + 1 + CONTEXT_WINDOW))
               if all_eng[j].strip() and all_eng[j] not in skip_values]

        print(f"    [{i+1}/{len(entries)}] {eng[:60]}...", end='', flush=True)
        translation = translate_with_context(eng, prev, nxt, table_type, table_desc, cache)
        entry['ITALIAN'] = translation
        translated_count += 1
        print(f" ✓")

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
    cache = load_cache()

    print("=" * 60)
    print("Esoteric Ebb — Context-Aware CSV Translator")
    print(f"Model: {MODEL}")
    print(f"Cache: {len(cache)} entries")
    print(f"Context window: {CONTEXT_WINDOW} rows before/after")
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

    # Load manual translations
    feat_translations = {}
    feat_path = os.path.join(OUTPUT_DIR, "feats.csv")
    if os.path.exists(feat_path):
        with open(feat_path, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                if row.get('ITALIAN'):
                    feat_translations[row['ID']] = row['ITALIAN']

    ui_translations = {}
    ui_path = os.path.join(OUTPUT_DIR, "uielements.csv")
    if os.path.exists(ui_path):
        with open(ui_path, 'r', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                if row.get('ITALIAN'):
                    ui_translations[row['ID']] = row['ITALIAN']

    total_translated = 0
    total_skipped = 0
    start_time = time.time()

    files_to_translate = [
        ("uielements.csv", "uielements", ui_translations),
        ("feats.csv", "feats", feat_translations),
        ("popups.csv", "popups", {}),
        ("questpoints.csv", "questpoints", {}),
        ("table_0.csv", "table_0", {}),
        ("journaltexts.csv", "journaltexts", {}),
        ("spelltexts.csv", "spelltexts", {}),
        ("itemtexts.csv", "itemtexts", {}),
    ]

    for csv_name, table_type, pre_translated in files_to_translate:
        csv_path = os.path.join(CSV_DIR, csv_name)
        if not os.path.exists(csv_path):
            continue

        output_path = os.path.join(OUTPUT_DIR, csv_name)
        print(f"\n{'=' * 50}")
        print(f"Translating: {csv_name} ({TABLE_TYPES.get(table_type, '?')})")
        print(f"{'=' * 50}")

        t, s = translate_csv_file(csv_path, output_path, cache, table_type, pre_translated)
        total_translated += t
        total_skipped += s

        save_cache(cache)
        print(f"  Done: {t} translated, {s} skipped")

    elapsed = time.time() - start_time

    print(f"\n{'=' * 60}")
    print(f"TRANSLATION COMPLETE")
    print(f"{'=' * 60}")
    print(f"Total translated: {total_translated}")
    print(f"Total skipped: {total_skipped}")
    print(f"Cache entries: {len(cache)}")
    print(f"Time: {elapsed:.1f}s ({elapsed / 60:.1f}min)")
    print(f"\n🧠 Context features used:")
    print(f"  ✅ Surrounding rows ({CONTEXT_WINDOW} before/after)")
    print(f"  ✅ Table type detection ({len(TABLE_TYPES)} types)")
    print(f"  ✅ Game context (genre, tone, setting)")
    print(f"  ✅ RPG Glossary")

    save_cache(cache)


if __name__ == '__main__':
    main()
