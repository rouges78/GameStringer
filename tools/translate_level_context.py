"""
Esoteric Ebb — Context-Aware Level String Translator

Miglioria rispetto a translate_level_strings.py:
- Surrounding strings: 2 stringhe prima + 2 dopo dallo stesso file binario
- Game context nel prompt (genere, tono, ambientazione)
- Content type detection (UI text vs narrative vs character creation)
- Traduce solo le righe NON ancora in cache (incrementale)
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

# ── Game Context ──────────────────────────────────────────────────────
GAME_CONTEXT = """GAME: Esoteric Ebb
GENRE: Dark fantasy RPG with political intrigue
TONE: Serious, philosophical, occasionally sardonic/witty
SETTING: A crumbling world of divine tyrants, feudal lords, and Freestriders
ERA: Medieval fantasy with hints of early modern political thought"""

RPG_GLOSSARY = """
GLOSSARY & RULES:
- Keep ALL tags exactly: <b>, </b>, <i>, </i>, <color=#HEX>, </color>, <size=N>, </size>, <smallcaps>, </smallcaps>, <line-indent=X>, \\n, \\r
- Keep names: Miska, Darrow, Snell, Meek, Urth, Norvik, Torna, Prax, Fillius, Halfweed, Solveig, Samuelsdottir, Ebb
- Freestrider = Cavalcalibero
- Beast/Beasts = Bestia/Bestie
- Ebb = Riflusso
- Forza=Strength, Destrezza=Dexterity, Costituzione=Constitution
- Intelligenza=Intelligence, Saggezza=Wisdom, Carisma=Charisma
- Punti Ferita=Hit Points, Tiro Salvezza=Saving Throw
- Zelota=Zealot, Chierico=Cleric, Ladro=Rogue, Guerriero=Fighter
- Talento=Feat, Incantesimo=Spell, Classe Armatura=Armor Class
- Cavalcalibero=Freestrider, Signore delle Monete=Coinlord
"""

CONTEXT_WINDOW = 2


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
                if (re.search(r'[A-Za-z]{3,}\s+[a-zA-z]{2,}', clean) and len(clean.strip()) > 15):
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
    return list(dict.fromkeys(results))


def detect_content_type(text):
    """Detect if text is UI, narrative, character creation, etc."""
    text_lower = text.lower()
    if any(tag in text for tag in ['<b>', '<i>', '<color=', '<size=']):
        if any(kw in text_lower for kw in ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']):
            return "character creation / stat description"
        return "formatted game text (rich text)"
    if len(text) < 40 and not text.endswith('.'):
        return "UI label or button text"
    if any(kw in text_lower for kw in ['click', 'select', 'choose', 'press', 'drag']):
        return "tutorial / instruction text"
    if any(kw in text_lower for kw in ['once upon', 'long ago', 'legend', 'tale', 'story']):
        return "lore / narrative text"
    return "general game text"


def build_context_prompt(text, prev_strings, next_strings, content_type):
    """Build a context-aware translation prompt for level strings."""
    parts = [
        "Translate this RPG game text from English to Italian.",
        "",
        GAME_CONTEXT,
        f"\nCONTENT TYPE: {content_type}",
    ]

    if prev_strings or next_strings:
        parts.append("\nSURROUNDING TEXT (for context only, do NOT translate):")
        for ps in prev_strings:
            short = ps[:100] + "..." if len(ps) > 100 else ps
            parts.append(f"  [BEFORE] {short}")
        short_text = text[:100] + "..." if len(text) > 100 else text
        parts.append(f"  >>> {short_text} <<<  (TRANSLATE THIS)")
        for ns in next_strings:
            short = ns[:100] + "..." if len(ns) > 100 else ns
            parts.append(f"  [AFTER] {short}")

    parts.append(f"\n{RPG_GLOSSARY}")
    parts.append("ONLY output the Italian translation, nothing else.")
    parts.append(f"\nEnglish: {text}")
    parts.append("Italian:")

    return "\n".join(parts)


def translate_with_context(text, prev_strings, next_strings, cache):
    """Translate a single level string with surrounding context."""
    key = hashlib.md5(text.encode()).hexdigest()
    if key in cache:
        return cache[key]

    content_type = detect_content_type(text)
    prompt = build_context_prompt(text, prev_strings, next_strings, content_type)

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL,
            "prompt": prompt,
            "stream": False,
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
            cache[key] = result
            return result
    except Exception as e:
        print(f"  ERROR: {e}")
    return None


def main():
    print("=" * 60)
    print("Esoteric Ebb — Context-Aware Level String Translator")
    print("=" * 60)

    cache = load_cache()
    print(f"Cache: {len(cache)} entries")

    source = os.path.join(ASSETS_DIR, "level0.backup")
    if not os.path.exists(source):
        source = os.path.join(ASSETS_DIR, "level0")

    if not os.path.exists(source):
        print(f"ERROR: {source} not found!")
        return

    data = open(source, 'rb').read()
    strings = extract_translatable_strings(data)
    print(f"Translatable strings in level0: {len(strings)}")

    cached = sum(1 for s in strings if hashlib.md5(s.encode()).hexdigest() in cache)
    remaining = len(strings) - cached
    print(f"Already cached: {cached}")
    print(f"Remaining: {remaining}")
    print(f"Context window: {CONTEXT_WINDOW} strings before/after")
    print(f"Model: {MODEL}")

    if remaining == 0:
        print("✅ All strings already translated!")

    start = time.time()
    done = 0
    for i, s in enumerate(strings):
        key = hashlib.md5(s.encode()).hexdigest()
        if key in cache:
            continue

        prev = strings[max(0, i - CONTEXT_WINDOW):i]
        nxt = strings[i + 1:i + 1 + CONTEXT_WINDOW]

        result = translate_with_context(s, prev, nxt, cache)
        done += 1

        if done % 10 == 0:
            elapsed = time.time() - start
            rate = done / elapsed * 60
            eta = (remaining - done) / max(1, rate)
            ct = detect_content_type(s)
            print(f"  [{cached+done}/{len(strings)}] {rate:.0f}/min, ETA: {eta:.0f}m | {ct}")
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
    print(f"\n{'=' * 60}")
    print(f"DONE in {elapsed/60:.1f} min")
    print(f"Translated: {total_translated}/{len(strings)}")
    print(f"New this run: {done}")
    print(f"CSV: {OUTPUT_CSV}")
    print(f"Cache: {CACHE_FILE}")
    print(f"\n🧠 Context features used:")
    print(f"  ✅ Surrounding strings ({CONTEXT_WINDOW} before/after)")
    print(f"  ✅ Content type detection (UI/narrative/stat/tutorial)")
    print(f"  ✅ Game context (genre, tone, setting)")
    print(f"  ✅ RPG Glossary + tag preservation rules")


if __name__ == '__main__':
    main()
