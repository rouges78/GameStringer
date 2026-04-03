"""
Homicipher Italian Translation Pipeline
1. Extract all EN strings from .ks scenario files
2. Translate them to Italian with Ollama
3. Inject [IT t="..."] tags after [EN t="..."] in all scenario files
4. Patch macroT.ks with IT macro definitions
5. Patch langp.ks with Italian language button (f.lang = 5)
"""
import json, re, os, sys, time, requests

EXTRACTED_DIR = r'D:\SteamLibrary\steamapps\common\Homicipher\resources\app_extracted'
SCENARIO_DIR = os.path.join(EXTRACTED_DIR, 'data', 'scenario')
TRANSLATIONS_FILE = os.path.join(EXTRACTED_DIR, 'translations_it.json')
OLLAMA_URL = 'http://localhost:11434/api/generate'
MODEL = 'qwen3.5:35b-a3b'

# ─── Step 1: Collect all EN strings ───
def collect_en_strings():
    """Walk all .ks files and collect unique [EN t="..."] strings."""
    strings = {}  # text -> set of file paths
    pattern = re.compile(r'\[EN t="([^"]*)"\]')
    
    for root, dirs, files in os.walk(SCENARIO_DIR):
        for fname in files:
            if not fname.endswith('.ks'):
                continue
            fpath = os.path.join(root, fname)
            with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            for match in pattern.finditer(content):
                text = match.group(1)
                if text.strip():
                    if text not in strings:
                        strings[text] = set()
                    rel = os.path.relpath(fpath, SCENARIO_DIR)
                    strings[text].add(rel)
    
    return strings

# ─── Step 2: Translate with Ollama ───
def translate_batch(strings_dict):
    """Translate all unique EN strings to Italian using Ollama."""
    # Load existing translations if any
    translations = {}
    if os.path.exists(TRANSLATIONS_FILE):
        with open(TRANSLATIONS_FILE, 'r', encoding='utf-8') as f:
            translations = json.load(f)
        print(f"  Loaded {len(translations)} existing translations")
    
    to_translate = [s for s in strings_dict if s not in translations]
    print(f"  To translate: {len(to_translate)} (already done: {len(translations)})")
    
    if not to_translate:
        return translations
    
    total = len(to_translate)
    start_time = time.time()
    errors = 0
    
    for i, text in enumerate(to_translate):
        # Skip empty/whitespace-only strings
        stripped = text.strip().replace('\u3000', '').strip()
        if not stripped or stripped in ('......', '...', '…', '……', '………', '…………'):
            translations[text] = text  # Keep as-is
            continue
        
        prompt = f"""Translate this video game dialogue from English to Italian. 
This is from a horror visual novel called "Homicipher". Keep the tone dark and atmospheric.
Preserve any leading/trailing whitespace characters exactly as they appear.
Preserve any special formatting like <br> tags.
Do NOT add quotes around the translation.
Reply with ONLY the Italian translation, nothing else.

English: {text}
Italian:"""
        
        try:
            resp = requests.post(OLLAMA_URL, json={
                'model': MODEL,
                'prompt': prompt,
                'stream': False,
                'options': {'temperature': 0.3, 'num_predict': 200}
            }, timeout=60)
            
            if resp.status_code == 200:
                result = resp.json().get('response', '').strip()
                # Clean up common issues
                result = result.strip('"').strip("'")
                if result.startswith('Italian:'):
                    result = result[8:].strip()
                
                # Preserve original whitespace pattern
                leading = ''
                trailing = ''
                if text.startswith('\u3000') or text.startswith(' '):
                    leading = '\u3000'
                if text.endswith('\u3000') or text.endswith(' '):
                    trailing = '\u3000'
                
                if leading and not result.startswith(('\u3000', ' ')):
                    result = leading + result
                if trailing and not result.endswith(('\u3000', ' ')):
                    result = result + trailing
                
                translations[text] = result
            else:
                print(f"  ERROR [{resp.status_code}] for: {text[:50]}")
                translations[text] = text  # Fallback to original
                errors += 1
                
        except Exception as e:
            print(f"  ERROR: {e} for: {text[:50]}")
            translations[text] = text
            errors += 1
        
        # Progress
        if (i + 1) % 20 == 0 or i == total - 1:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            eta = (total - i - 1) / rate if rate > 0 else 0
            print(f"  [{i+1}/{total}] {rate:.1f} str/s, ETA: {eta:.0f}s, errors: {errors}")
            
            # Save progress periodically
            with open(TRANSLATIONS_FILE, 'w', encoding='utf-8') as f:
                json.dump(translations, f, ensure_ascii=False, indent=2)
    
    # Final save
    with open(TRANSLATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)
    
    print(f"  Done! {len(translations)} translations, {errors} errors")
    return translations

# ─── Step 3: Inject [IT t="..."] into scenario files ───
def inject_italian(translations):
    """Add [IT t="..."] tag after each [EN t="..."] in all .ks files."""
    pattern = re.compile(r'(\[EN t="([^"]*)"\])')
    modified = 0
    total_injections = 0
    
    for root, dirs, files in os.walk(SCENARIO_DIR):
        for fname in files:
            if not fname.endswith('.ks'):
                continue
            fpath = os.path.join(root, fname)
            with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            
            # Skip if already has [IT tags
            if '[IT t="' in content:
                continue
            
            def replacer(match):
                full = match.group(1)
                en_text = match.group(2)
                it_text = translations.get(en_text, en_text)
                # Escape any quotes in Italian text
                it_text_escaped = it_text.replace('"', '\\"')
                return f'{full}\n\t\t\t\t[IT t="{it_text_escaped}"]'
            
            new_content = pattern.sub(replacer, content)
            
            if new_content != content:
                with open(fpath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                injections = new_content.count('[IT t="') 
                total_injections += injections
                modified += 1
    
    print(f"  Modified {modified} files, {total_injections} IT tags injected")

# ─── Step 4: Patch macroT.ks with IT macro ───
def patch_macroT():
    """Add [IT], [ITc], [ITl] macros to macroT.ks."""
    macroT_path = os.path.join(SCENARIO_DIR, 'macroT.ks')
    with open(macroT_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'macro name="IT"' in content:
        print("  macroT.ks already patched")
        return
    
    # Add IT macro after TC macro definition
    # Standard text macro
    it_macro = '''
\t\t;Italiano
\t\t\t\t[macro name="IT"]
\t\t\t\t\t[if exp="sf.lang == 5 && f.lg != true"]
\t\t\t\t\t[ptext layer="%ly|5" name="%n" x="%x|0" y="%y|455" width="1080" size="%si|40" face="SHSansJP" bold="%b|false" color="%c" text="%t"]
\t\t\t\t\t[accumulate_log text="%t"]
\t\t\t\t\t[endif]
\t\t\t\t[endmacro]
'''
    
    # Center text macro
    it_macro_c = '''
\t\t\t\t[macro name="ITc"]
\t\t\t\t\t[if exp="sf.lang == 5 && f.lg != true"]
\t\t\t\t\t[ptext layer="%ly|5" name="%n" x="%x|0" y="%y|300" width="1280" size="%si|42" face="SHSansJP" align="%a|center" bold="%b|false" color="%c" text="%t"]
\t\t\t\t\t[accumulate_log text="%t"]
\t\t\t\t\t[endif]
\t\t\t\t[endmacro]
'''
    
    # Line text macro (speech bubble)
    it_macro_l = '''
\t\t\t\t[macro name="ITl"]
\t\t\t\t\t[if exp="sf.lang == 5 "]
\t\t\t\t\t[image layer="4" x="120" y="%y" folder="image/main" storage="fukidasi.png" time="1" wait="true"]
\t\t\t\t\t[ptext layer="4" name="rain" x="130" y="%y" size="28" face="SHSansJP" time="1" color="0xffffff" text="%t"]
\t\t\t\t\t[accumulate_log text="%t"]
\t\t\t\t\t[endif]
\t\t\t\t[endmacro]
'''
    
    # Find the position after TC macros and insert IT macros
    # Insert after the last TCl macro
    tc_line_pos = content.rfind('[macro name="TCl"]')
    if tc_line_pos == -1:
        # Fallback: insert after TC center macro
        tc_line_pos = content.rfind('[macro name="TCc"]')
    
    if tc_line_pos != -1:
        # Find the [endmacro] after TCl
        endmacro_pos = content.find('[endmacro]', tc_line_pos)
        if endmacro_pos != -1:
            insert_pos = content.find('\n', endmacro_pos) + 1
            new_content = content[:insert_pos] + it_macro + it_macro_c + it_macro_l + content[insert_pos:]
            with open(macroT_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print("  macroT.ks patched with IT/ITc/ITl macros")
            return
    
    print("  WARNING: Could not find TC macro position in macroT.ks")

# ─── Step 5: Patch langp.ks with Italian button ───
def patch_langp():
    """Add Italian language button to langp.ks."""
    langp_path = os.path.join(SCENARIO_DIR, 'langp.ks')
    with open(langp_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'f.lang = 5' in content or '*IT' in content:
        print("  langp.ks already patched")
        return
    
    # 1. Add Italian button next to others (adjust x positions for 5 buttons)
    # Original: JP x=90, EN x=370, SC x=640, TC x=910
    # New layout: JP x=30, EN x=270, SC x=510, TC x=750, IT x=990
    content = content.replace(
        '[lanB1 fo="SHSansJP" x="90" t="日本語" g="*JP"]',
        '[lanB1 fo="SHSansJP" x="30" t="日本語" g="*JP"]'
    )
    content = content.replace(
        '[lanB1 fo="SHSansJP" x="370" t="English" g="*EN"]',
        '[lanB1 fo="SHSansJP" x="250" t="English" g="*EN"]'
    )
    content = content.replace(
        '[lanB1 fo="SHSansCN" x="640" t="簡体中文" g="*SC"]',
        '[lanB1 fo="SHSansCN" x="470" t="簡体中文" g="*SC"]'
    )
    content = content.replace(
        '[lanB1 fo="SHSansTW" x="910" t="繁體中文" g="*TC"]',
        '[lanB1 fo="SHSansTW" x="690" t="繁體中文" g="*TC"]\n\t\t[lanB1 fo="SHSansJP" x="910" t="Italiano" g="*IT"]'
    )
    
    # Also update lanB2 (selected state) positions
    content = content.replace(
        '[lanB2 fo="SHSansJP" x="90" t="日本語" g="*JP"]',
        '[lanB2 fo="SHSansJP" x="30" t="日本語" g="*JP"]'
    )
    content = content.replace(
        '[lanB2 fo="SHSansJP" x="370" t="English" g="*EN"]',
        '[lanB2 fo="SHSansJP" x="250" t="English" g="*EN"]'
    )
    content = content.replace(
        '[lanB2 fo="SHSansCN" x="640" t="簡体中文" g="*SC"]',
        '[lanB2 fo="SHSansCN" x="470" t="簡体中文" g="*SC"]'
    )
    content = content.replace(
        '[lanB2 fo="SHSansTW" x="910" t="繁體中文" g="*TC"]',
        '[lanB2 fo="SHSansTW" x="690" t="繁體中文" g="*TC"]'
    )
    
    # 2. Add Italian mode text  
    content = content.replace(
        '[elsif exp="f.lang == 4"]\n\t\t\t[lanT fo="SHSansTW" t="遊戲開始後不能更改語言"]\n\t\t\t\n\t\t[endif]',
        '[elsif exp="f.lang == 4"]\n\t\t\t[lanT fo="SHSansTW" t="遊戲開始後不能更改語言"]\n\t\t\t\n\t\t[elsif exp="f.lang == 5"]\n\t\t\t[lanT fo="SHSansJP" t="Non puoi cambiare la lingua dopo aver iniziato il gioco"]\n\t\t\t\n\t\t[endif]'
    )
    
    # 3. Add mode names for Italian
    content = content.replace(
        '[elsif exp="f.lang == 4"]\n\t\t\t[VAR e="f.modo1 = \'普通模式\'"][VAR e="f.modo2 = \'異界語言模式\'"][VAR e="f.mof = \'SHSansTW\'"]\n\n\t\t[endif]',
        '[elsif exp="f.lang == 4"]\n\t\t\t[VAR e="f.modo1 = \'普通模式\'"][VAR e="f.modo2 = \'異界語言模式\'"][VAR e="f.mof = \'SHSansTW\'"]\n\n\t\t[elsif exp="f.lang == 5"]\n\t\t\t[VAR e="f.modo1 = \'Modalità Normale\'"][VAR e="f.modo2 = \'Modalità Lingua Aliena\'"][VAR e="f.mof = \'SHSansJP\'"]\n\n\t\t[endif]'
    )
    
    # 4. Add otherworld mode description for Italian
    content = content.replace(
        '[elsif exp="f.lang == 4 && f.lg == true"]\n\t\t\t[lanT fo="SHSansTW" n="syu" y="460" si="26" t="主角台詞變成異界語言的模式。<br>無任何解讀提示，並且部分解說台詞被刪減。"]\n\t\t[endif]',
        '[elsif exp="f.lang == 4 && f.lg == true"]\n\t\t\t[lanT fo="SHSansTW" n="syu" y="460" si="26" t="主角台詞變成異界語言的模式。<br>無任何解讀提示，並且部分解說台詞被刪減。"]\n\t\t[elsif exp="f.lang == 5 && f.lg == true"]\n\t\t\t[lanT fo="SHSansJP" n="syu" y="460" si="26" t="Modalità in cui i dialoghi della protagonista sono in lingua aliena.<br>Nessun indizio di decodifica, e alcune battute esplicative sono omesse."]\n\t\t[endif]'
    )
    
    # 5. Add language variable handler for IT
    content = content.replace(
        '*TC\n\t;削除\n\t\t[clearstack]\n\t;言語変数\n\t\t[VAR e="f.lang = 4"]\n\t;ジャンプ\n\t\t[jump target="*P1"]',
        '*TC\n\t;削除\n\t\t[clearstack]\n\t;言語変数\n\t\t[VAR e="f.lang = 4"]\n\t;ジャンプ\n\t\t[jump target="*P1"]\n\t\t\n*IT\n\t;削除\n\t\t[clearstack]\n\t;言語変数\n\t\t[VAR e="f.lang = 5"]\n\t;ジャンプ\n\t\t[jump target="*P1"]'
    )
    
    # 6. Add Italian lanB2 selected state
    # Add after TC selected button
    content = content.replace(
        '[elsif exp="f.lang == 4"]\n\t\t\t[lanB2 fo="SHSansTW" x="690" t="繁體中文" g="*TC"]\n\t\t\t\n\t\t[endif]',
        '[elsif exp="f.lang == 4"]\n\t\t\t[lanB2 fo="SHSansTW" x="690" t="繁體中文" g="*TC"]\n\t\t\t\n\t\t[elsif exp="f.lang == 5"]\n\t\t\t[lanB2 fo="SHSansJP" x="910" t="Italiano" g="*IT"]\n\t\t\t\n\t\t[endif]'
    )
    
    with open(langp_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("  langp.ks patched with Italian language option")

# ─── Main ───
if __name__ == '__main__':
    print("═══ Homicipher Italian Translation Pipeline ═══")
    print()
    
    # Step 1
    print("Step 1: Collecting EN strings...")
    strings = collect_en_strings()
    print(f"  Found {len(strings)} unique EN strings")
    
    # Step 2
    print("\nStep 2: Translating to Italian with Ollama...")
    translations = translate_batch(strings)
    
    # Step 3
    print("\nStep 3: Injecting [IT] tags into scenario files...")
    inject_italian(translations)
    
    # Step 4
    print("\nStep 4: Patching macroT.ks with IT macros...")
    patch_macroT()
    
    # Step 5
    print("\nStep 5: Patching langp.ks with Italian button...")
    patch_langp()
    
    print("\n═══ Pipeline complete! ═══")
    print(f"Translations saved to: {TRANSLATIONS_FILE}")
    print(f"Modified files in: {EXTRACTED_DIR}")
    print("\nNext step: repack the ASAR and test the game.")
