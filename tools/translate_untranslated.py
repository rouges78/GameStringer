"""
Translate untranslated Esoteric Ebb strings using Ollama (hy-mt1.5 translation model).
Reads untranslated.csv, translates one-by-one, outputs to untranslated_done.csv.
Also merges results into the main ink_translations.csv.
"""
import csv, json, os, time, requests

INPUT = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\untranslated.csv"
OUTPUT = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\untranslated_done.csv"
MAIN_CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"
PROGRESS = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translate_progress.json"

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "huihui_ai/hy-mt1.5-abliterated:7b"

def translate_text(text):
    """Translate a single string EN->IT using Ollama hy-mt1.5."""
    prompt = f"<|im_start|>user\nTranslate the following text from English to Italian.\nEnglish: {text}\nItalian:<|im_end|>\n<|im_start|>assistant\n"
    
    resp = requests.post(OLLAMA_URL, json={
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 512}
    }, timeout=60)
    
    if resp.status_code == 200:
        result = resp.json().get("response", "").strip()
        # Clean up: remove quotes, extra whitespace
        result = result.strip('"').strip("'").strip()
        # Remove "Italian:" prefix if model echoes it
        if result.lower().startswith("italian:"):
            result = result[8:].strip()
        return result
    return ""


# Load untranslated strings
rows = []
with open(INPUT, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)  # skip header
    for row in reader:
        if row[0].strip():
            rows.append(row[0])

print(f"Frasi da tradurre: {len(rows)}")

# Load progress if exists
done = {}
if os.path.exists(PROGRESS):
    with open(PROGRESS, 'r', encoding='utf-8') as f:
        done = json.load(f)
    print(f"Progresso precedente: {len(done)} gia tradotte")

remaining = [r for r in rows if r not in done]
print(f"Rimanenti: {len(remaining)}")

errors = 0
start_time = time.time()

for i, text in enumerate(remaining):
    if (i + 1) % 50 == 1 or i == 0:
        elapsed = time.time() - start_time
        rate = i / elapsed if elapsed > 0 else 0
        eta = (len(remaining) - i) / rate / 60 if rate > 0 else 0
        print(f"\n[{i+1}/{len(remaining)}] ({rate:.1f}/s, ETA: {eta:.0f}min)", flush=True)
    
    try:
        result = translate_text(text)
        if result:
            done[text] = result
            if (i + 1) % 10 == 0:
                print(".", end="", flush=True)
        else:
            errors += 1
            if (i + 1) % 10 == 0:
                print("x", end="", flush=True)
    except Exception as e:
        errors += 1
        if (i + 1) % 10 == 0:
            print("E", end="", flush=True)
    
    # Save progress every 100 strings
    if (i + 1) % 100 == 0:
        with open(PROGRESS, 'w', encoding='utf-8') as f:
            json.dump(done, f, ensure_ascii=False)

print(f"\nTraduzione completata: {len(done)}/{len(rows)} ({errors} errori)")

# Save progress
with open(PROGRESS, 'w', encoding='utf-8') as f:
    json.dump(done, f, ensure_ascii=False, indent=2)

# Write untranslated_done.csv
with open(OUTPUT, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['english', 'italian'])
    for eng in rows:
        ita = done.get(eng, '')
        writer.writerow([eng, ita])

print(f"Scritto: {OUTPUT}")

# Merge into main CSV
existing = {}
with open(MAIN_CSV, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    for row in reader:
        if len(row) >= 2:
            existing[row[0]] = row[1]

added = 0
for eng, ita in done.items():
    if eng not in existing and ita:
        existing[eng] = ita
        added += 1

with open(MAIN_CSV, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    for eng, ita in sorted(existing.items()):
        writer.writerow([eng, ita])

print(f"Aggiunte {added} nuove traduzioni a {MAIN_CSV}")
print(f"Totale traduzioni nel CSV: {len(existing)}")
