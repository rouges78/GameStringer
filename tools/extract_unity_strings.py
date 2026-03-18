"""
Esoteric Ebb - Unity Asset String Extractor
Estrae stringhe di testo dai file .assets di Unity (length-prefixed + null-terminated)
Stessa logica di GameStringer backend Rust (extract_strings_from_raw)
"""

import struct
import json
import os
import sys
import re
from pathlib import Path

GAME_DIR = r"D:\SteamLibrary\steamapps\common\Esoteric Ebb\Esoteric Ebb_Data"
OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings"

# Pattern da escludere (metadata Unity, path interni, nomi classi)
EXCLUDE_PATTERNS = [
    "Assets/", "CAB-", ".asset", ".bundle", "UnityFS",
    "m_Script", "m_Name", "m_GameObject", "PPtr<",
    "guid:", "fileID:", "type:", "Assembly-CSharp",
    "MonoBehaviour", "Transform", "RectTransform",
    "UnityEngine.", "System.", "TMPro.", "FMOD",
    "Shader ", "shader ", "_MainTex", "_Color",
    "Library/", "Packages/", "ProjectSettings/",
    ".cs", ".dll", ".shader", ".mat", ".prefab",
    ".png", ".jpg", ".tga", ".wav", ".ogg", ".mp3",
    ".anim", ".controller", ".meta", ".unity",
    "0123456789", "abcdefghij",
    "NullReferenceException", "IndexOutOfRange",
    "SerializeField", "CompilerGenerated",
    "il2cpp", "cpp2il", "metadata",
]

# Regex per identificare stringhe che sono chiaramente codice/metadata
CODE_PATTERNS = re.compile(
    r'^[A-Z][a-z]+[A-Z]|'  # camelCase
    r'^\w+\.\w+\.\w+|'      # namespace.class.method
    r'^[a-f0-9]{32}$|'      # hash/guid
    r'^\d+\.\d+\.\d+|'      # version numbers  
    r'^[A-Z_]{5,}$|'        # CONSTANT_NAMES
    r'^\w+_\w+_\w+$'        # snake_case_internal
)


def is_valid_game_string(s: str) -> bool:
    """Verifica se una stringa è testo di gioco traducibile"""
    s = s.strip()
    if len(s) < 2:
        return False
    
    # Deve avere lettere
    if not any(c.isalpha() for c in s):
        return False
    
    # No caratteri di controllo (tranne newline/tab)
    if any(ord(c) < 32 and c not in '\n\r\t' for c in s):
        return False
    
    # Escludi pattern Unity/codice
    for pat in EXCLUDE_PATTERNS:
        if pat in s:
            return False
    
    # Escludi se sembra codice
    if CODE_PATTERNS.match(s):
        return False
    
    # Deve avere abbastanza caratteri stampabili
    printable = sum(1 for c in s if c.isalnum() or c.isspace() or c in ".,!?'-:;\"()[]{}…/&")
    if printable < len(s) * 2 // 3:
        return False
    
    return True


def extract_length_prefixed_strings(data: bytes, filename: str) -> list:
    """Estrae stringhe length-prefixed (4 byte LE + UTF-8 data)"""
    entries = []
    seen = set()
    i = 0
    
    while i + 4 < len(data):
        str_len = struct.unpack_from('<I', data, i)[0]
        
        if 2 <= str_len <= 5000 and i + 4 + str_len <= len(data):
            str_data = data[i + 4:i + 4 + str_len]
            try:
                s = str_data.decode('utf-8')
                if is_valid_game_string(s) and s not in seen:
                    seen.add(s)
                    entries.append({
                        "key": f"lp_{i:08x}",
                        "value": s,
                        "file": filename,
                        "offset": i,
                        "type": "length_prefixed"
                    })
            except UnicodeDecodeError:
                pass
            
            i += 4 + str_len
            # Allineamento a 4 byte
            padding = (4 - (str_len % 4)) % 4
            i += padding
        else:
            i += 1
    
    return entries


def extract_null_terminated_strings(data: bytes, filename: str) -> list:
    """Estrae stringhe null-terminated"""
    entries = []
    seen = set()
    start = 0
    
    for i in range(len(data)):
        if data[i] == 0:
            if i > start and 5 <= i - start <= 5000:
                str_data = data[start:i]
                try:
                    s = str_data.decode('utf-8')
                    if is_valid_game_string(s) and s not in seen:
                        seen.add(s)
                        entries.append({
                            "key": f"nt_{start:08x}",
                            "value": s,
                            "file": filename,
                            "offset": start,
                            "type": "null_terminated"
                        })
                except UnicodeDecodeError:
                    pass
            start = i + 1
    
    return entries


def categorize_string(s: str) -> str:
    """Categorizza una stringa per tipo di contenuto"""
    s_lower = s.lower()
    
    # UI elements
    ui_keywords = ['start', 'quit', 'resume', 'options', 'settings', 'play', 
                   'continue', 'new game', 'load', 'save', 'back', 'exit',
                   'apply', 'cancel', 'ok', 'yes', 'no', 'confirm',
                   'volume', 'brightness', 'resolution', 'fullscreen',
                   'graphics', 'audio', 'controls', 'language',
                   'credits', 'achievements', 'inventory', 'map',
                   'tutorial', 'help', 'pause']
    if any(kw == s_lower or kw in s_lower for kw in ui_keywords):
        return "ui"
    
    # Dialogue (sentences, questions)
    if len(s) > 30 and (' ' in s) and any(c in s for c in '.!?'):
        return "dialogue"
    
    # Short phrases
    if ' ' in s and len(s) > 10:
        return "phrase"
    
    # Item/object names (title case, short)
    if len(s) < 40 and s[0].isupper():
        return "name"
    
    return "other"


def extract_from_file(filepath: str) -> list:
    """Estrae tutte le stringhe da un file asset Unity"""
    filename = os.path.basename(filepath)
    print(f"  Scanning: {filename} ({os.path.getsize(filepath):,} bytes)")
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    # Estrai con entrambi i metodi
    lp_strings = extract_length_prefixed_strings(data, filename)
    nt_strings = extract_null_terminated_strings(data, filename)
    
    # Unisci evitando duplicati
    seen_values = {e['value'] for e in lp_strings}
    combined = lp_strings[:]
    for e in nt_strings:
        if e['value'] not in seen_values:
            combined.append(e)
            seen_values.add(e['value'])
    
    print(f"    → {len(combined)} stringhe trovate (LP: {len(lp_strings)}, NT: {len(nt_strings) - (len(combined) - len(lp_strings))} nuove)")
    return combined


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("Esoteric Ebb - String Extractor")
    print("=" * 60)
    print(f"Game dir: {GAME_DIR}")
    print(f"Output:   {OUTPUT_DIR}")
    print()
    
    # Trova tutti i file .assets e level*
    asset_files = []
    for f in os.listdir(GAME_DIR):
        fpath = os.path.join(GAME_DIR, f)
        if not os.path.isfile(fpath):
            continue
        if f.endswith('.assets') or f.startswith('level') or f == 'globalgamemanagers':
            asset_files.append(fpath)
    
    asset_files.sort()
    print(f"Trovati {len(asset_files)} file asset da scansionare\n")
    
    all_strings = []
    for fpath in asset_files:
        strings = extract_from_file(fpath)
        all_strings.extend(strings)
    
    # Rimuovi duplicati globali (stessa value da file diversi)
    seen = set()
    unique_strings = []
    for e in all_strings:
        if e['value'] not in seen:
            seen.add(e['value'])
            e['category'] = categorize_string(e['value'])
            unique_strings.append(e)
    
    # Ordina: dialoghi prima, poi frasi, poi UI, poi nomi
    category_order = {'dialogue': 0, 'phrase': 1, 'ui': 2, 'name': 3, 'other': 4}
    unique_strings.sort(key=lambda e: (category_order.get(e['category'], 5), -len(e['value'])))
    
    # Statistiche
    print(f"\n{'=' * 60}")
    print(f"TOTALE: {len(unique_strings)} stringhe uniche")
    categories = {}
    for e in unique_strings:
        cat = e['category']
        categories[cat] = categories.get(cat, 0) + 1
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")
    
    # Salva JSON completo
    json_path = os.path.join(OUTPUT_DIR, "all_strings.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(unique_strings, f, ensure_ascii=False, indent=2)
    print(f"\nSalvato: {json_path}")
    
    # Salva JSON per traduzione (solo value + campo translation vuoto)
    translation_entries = []
    for e in unique_strings:
        translation_entries.append({
            "key": e['key'],
            "original": e['value'],
            "translation": "",
            "category": e['category'],
            "file": e['file'],
            "offset": e['offset']
        })
    
    trans_path = os.path.join(OUTPUT_DIR, "for_translation.json")
    with open(trans_path, 'w', encoding='utf-8') as f:
        json.dump(translation_entries, f, ensure_ascii=False, indent=2)
    print(f"Salvato: {trans_path}")
    
    # Salva anche un file di testo leggibile con le stringhe raggruppate
    txt_path = os.path.join(OUTPUT_DIR, "strings_readable.txt")
    with open(txt_path, 'w', encoding='utf-8') as f:
        current_cat = None
        for e in unique_strings:
            if e['category'] != current_cat:
                current_cat = e['category']
                f.write(f"\n{'=' * 50}\n")
                f.write(f"  {current_cat.upper()} ({categories[current_cat]} entries)\n")
                f.write(f"{'=' * 50}\n\n")
            f.write(f"[{e['key']}] {e['value']}\n")
    print(f"Salvato: {txt_path}")
    
    # Mostra le prime 30 stringhe come anteprima
    print(f"\n{'=' * 60}")
    print("ANTEPRIMA (prime 30 stringhe):")
    print(f"{'=' * 60}")
    for e in unique_strings[:30]:
        val = e['value'][:80] + ('...' if len(e['value']) > 80 else '')
        print(f"  [{e['category']:10s}] {val}")


if __name__ == '__main__':
    main()
