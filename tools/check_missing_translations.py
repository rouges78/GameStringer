"""Check which English strings from screenshots are missing in the translation CSV."""
import csv

CSV = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\ink_strings\translated\ink_translations.csv"

trans = {}
with open(CSV, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)
    for row in reader:
        if len(row) >= 2:
            trans[row[0].strip()] = row[1].strip()

missing = [
    "Your name was asked. It is RAGN.",
    "Wait!",
    "It was, 'Dick-Ass Rogue'.",
    "You're thinking, aren't you?",
    "...What are you, a fucking poet?",
    "Your class.",
]

for m in missing:
    found = trans.get(m)
    if not found:
        found = trans.get(m.rstrip('.'))
    if not found:
        found = trans.get(m + ' ')
    if found:
        print(f"  FOUND: [{m}] -> [{found}]")
    else:
        # Fuzzy: check if beginning matches any key
        partial = None
        for k in trans:
            if len(k) > 10 and (m[:15] in k or k[:15] in m):
                partial = (k, trans[k])
                break
        if partial:
            print(f"  PARTIAL: [{m}]")
            print(f"    ~ [{partial[0]}] -> [{partial[1]}]")
        else:
            print(f"  MISSING: [{m}]")
