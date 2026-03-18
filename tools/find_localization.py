"""Find localization CSV data embedded in Esoteric Ebb assets"""
import json, os

data = json.load(open(r'C:\dev\GameStringer\tools\esoteric_ebb_strings\all_strings.json', 'r', encoding='utf-8'))

# Search for localization-related strings
keywords = ['ID,ENGLISH', 'GERMAN', 'FRENCH', 'ITALIAN', 'SPANISH', 
            'localization', 'Localization', 'LocalizedString',
            'StringTable', 'string_table', 'i18n', 'locale',
            'LL_1', 'LL_2', 'Lower Lair']

for e in data:
    val = e['value']
    for kw in keywords:
        if kw in val:
            print(f"\n{'='*60}")
            print(f"KEY: {e['key']} | FILE: {e['file']} | OFFSET: {e['offset']}")
            print(f"CATEGORY: {e['category']} | MATCHED: {kw}")
            print(f"{'='*60}")
            # Print first 2000 chars
            print(val[:2000])
            if len(val) > 2000:
                print(f"\n... ({len(val)} total chars)")
            break
