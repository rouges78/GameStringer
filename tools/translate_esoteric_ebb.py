"""
Esoteric Ebb - Italian Translation Generator
Translates all CSV localization tables to Italian.
Uses a comprehensive translation dictionary for all game strings.
"""
import csv
import io
import json
import os

OUTPUT_DIR = r"C:\dev\GameStringer\tools\esoteric_ebb_strings\csv_tables"

# =============================================================================
# UI ELEMENTS
# =============================================================================
UI_TRANSLATIONS = {
    "New Game": "Nuova Partita",
    "Load": "Carica",
    "Options": "Opzioni",
    "Credits": "Riconoscimenti",
    "Exit": "Esci",
    "The Cleric is dead.": "Il Chierico è morto.",
    "Alas, this String will be discarded.": "Ahimè, questa Corda verrà recisa.",
    "But you can see another, can you not?": "Ma puoi vederne un'altra, non è vero?",
    "The Cleric has ceased to be.": "Il Chierico ha cessato di esistere.",
    "That happens when you run out of 'health'.": "Succede quando esaurisci la 'salute'.",
    "Try to stay intact next time, eh?": "Cerca di restare intero la prossima volta, eh?",
    "The Cleric has passed away.": "Il Chierico è trapassato.",
    "This is very sad.": "Questo è molto triste.",
    "Next, might I suggest avoiding danger?": "La prossima volta, posso suggerire di evitare i pericoli?",
    "The Cleric is no more.": "Il Chierico non è più.",
    "But this feels... off.": "Ma qualcosa... non torna.",
    "Wouldn't you agree?": "Non sei d'accordo?",
}

# =============================================================================
# POPUPS (Location names)
# =============================================================================
POPUP_TRANSLATIONS = {
    "Lower Lair": "Tana Inferiore",
    "Popup text here.": "Testo popup qui.",
    "Visken's Lair": "Tana di Visken",
}

# =============================================================================
# FEATS - RPG abilities translated maintaining game flavor
# =============================================================================
FEAT_TRANSLATIONS = {
    "FEAT_LONE_STR": "Chierico Solitario - All'inizio del tuo Riposo Breve, cura un ammontare aggiuntivo pari ai livelli di sfinimento che possiedi.",
    "FEAT_MEMORIZER_INT": "Maestro Memorizzatore - Durante il tuo Riposo Breve, recuperi due slot incantesimo casuali invece di uno.",
    "FEAT_COMPANY_CHA": "Compagnia Amichevole - Durante i Riposi Brevi, tira sempre i Dadi Vita con vantaggio. Anche Snell ottiene una competenza aggiuntiva nei tiri di iniziativa.",
    "FEAT_PARANOIA_DEX": "Paranoia Contagiosa - Vantaggio sui tiri di iniziativa.",
    "FEAT_SURVIVAL_CON": "Sopravvivenza del più Forte - Vantaggio sui Tiri Salvezza contro Morte.",
    "FEAT_EYE_CHA": "Leggere la Stanza - Vantaggio sulle prove di osservazione.",
    "FEAT_LUCK_CHA": "Fortuna dello Stolto - Ogni volta che ottieni un 1 naturale, ritira il d20 e subisci 1d4 danni. Se il nuovo risultato è anche un 1 naturale, ripeti il processo. Questi danni non possono portarti sotto 1 PF.",
    "FEAT_MUSH_DEX": "Riflessi da Esploratore - Ogni volta che ottieni 10 o meno, aggiungi una competenza extra al tiro.",
    "FEAT_PROF_STR": "Chierico Professionista - Non puoi fallire criticamente. (Quando ottieni un 1 naturale, non viene trattato come un fallimento automatico.)",
    "FEAT_BALANCE_INT": "Campana Curva ma Equilibrata - Ogni volta che viene tirato un d20, le Corde di Jor fanno tendere il risultato verso 10. Le probabilità di tiri critici sono ridotte.",
    "FEAT_BELLY_CON": "Ventre Oscuro dell'Anima - Resistenza a tutti i danni quando sei sotto il 50% dei PF.",
    "FEAT_HJARTA_WIS": "Hjârtat Mitt - Ogni livello di sfinimento conferisce +1 a ogni tiro di d20 invece di -1.",
    "FEAT_MAN_STR": "Un Brav'Uomo - Ogni volta che sopravvivi a un tiro salvezza contro morte, ti rialzi con 1d20 PF.",
    "FEAT_FRAGILE_DEX": "Immortalità Fragile - Non tirare Tiri Salvezza contro Morte. Ogni volta che sei sopra 1 PF e subisci danni che ti porterebbero a 0, vai a 1. Se subisci qualsiasi danno a 1 PF, muori.",
    "FEAT_DREAM_INT": "Sogno Imperiale - Mentre parli con qualcuno con meno intelligenza di te, ottieni una competenza extra su tutti i tiri di d20.",
    "FEAT_LIE_CHA": "Bella Bugia - Mentre sei a salute piena e 0 sfinimento, ottieni vantaggio su tutti i tiri di Carisma con d20.",
    "FEAT_NAT_STR": "Nazionalista - Competenza extra nei tiri quando parli con umani.",
    "FEAT_FRE_DEX": "Cavalcatore Libero - Ottieni uno sconto aggiuntivo del 10% su tutti gli acquisti.",
    "FEAT_AZG_WIS": "Azgalista - Ogni volta che subisci danni, avanzi di un passo in un contatore segreto a tre passi. Al passo uno, viene tirato un d20 'tesi'. Al passo due, se i danni subiti sono superiori al dado 'tesi', viene tirato un d4 'antitesi'. Al passo tre, i danni subiti vengono ridotti di 1, o del dado 'antitesi' se è stato tirato durante il passo due. Questa è la 'sintesi', in qualche modo. La prossima volta che subisci danni, torni al passo uno.",
    "FEAT_ARC_INT": "Arcanista - Quando esaurisci il tuo ultimo slot incantesimo di qualsiasi livello, tiri un 1d100. Se il risultato è inferiore alla tua intelligenza naturale, recuperi quello slot incantesimo.",
    "FEAT_AGR_CON": "Agrario - Ogni volta che raccogli cibo, tiri 1d20. Se ottieni 16 o più, ricevi un oggetto cibo aggiuntivo.",
    "FEAT_APO_CHA": "Apolitico - Aumenta la competenza nei tiri di 1. Questo ammontare aumenta a 10 in qualsiasi giorno di elezioni.",
    "FEAT_MONEY_DEX": "Il Denaro Parla - Ottieni il 50% di denaro in più alla raccolta.",
    "FEAT_SPIRIT_WIS": "Spirito Azgaliano - Recupera 1 Punto Ferita ogni ora che passa.",
    "FEAT_FEMI_WIS": "Bella Signora - Competenza extra nei tiri quando parli con personaggi femminili.",
    "FEAT_MASC_STR": "Futuro Patriarca - Competenza extra nei tiri quando parli con personaggi maschili.",
    "FEAT_PRINT_INT": "Propaganda Mediatica - Altera i modificatori di caratteristica sugli scritti equipaggiati. I modificatori positivi ottengono +1 e quelli negativi -1.",
    "FEAT_UNITY_WIS": "Unità Umani-Nani - Mentre sei a salute piena, ogni volta che subisci danni, quei dadi vengono tirati con svantaggio.",
    "FEAT_ENDURE_CON": "Resistenza Azgaliana - Per ogni 3 ore trascorse in stato di sfinimento, perdi 1 livello di sfinimento.",
    "FEAT_DEFEND_STR": "Difendi la Città - Altera i modificatori di caratteristica sugli elmi equipaggiati. I modificatori positivi ottengono +1 e quelli negativi -1.",
    "FEAT_TRUE_DEX": "Vero Norvikiano - Tira l'iniziativa con Forza, se è superiore alla tua Destrezza.",
    "FEAT_MIGHT_CON": "Apparato del Leviatano - I nemici tirano sempre l'iniziativa con svantaggio.",
    "FEAT_FORCE_STR": "Forza Inarrestabile - Altera i modificatori di caratteristica sulle armi equipaggiate. I modificatori positivi ottengono +1 e quelli negativi -1.",
    "FEAT_HAND_DEX": "Mano Invisibile - Vantaggio su tutte le prove di destrezza minore.",
    "FEAT_OBJECT_CHA": "Oggetto Inamovibile - Il tuo modificatore di Destrezza si aggiunge anche allo sconto contrattazione nei negozi, sommandosi al Carisma.",
    "FEAT_VOICE_STR": "Voce di Dio - Ogni volta che tiri un d20, un altro d20 nascosto viene tirato. Se quel dado è uguale al tuo, ottieni un successo critico. Se entrambi sono venti naturali, recuperi tutti i punti ferita, tutti gli slot incantesimo spesi, perdi tutti i livelli di sfinimento e diventi genuinamente felice per 1d4 secondi.",
    "FEAT_STRING_INT": "Maestro delle Corde - Per ogni livello di slot incantesimo che possiedi, ottieni uno slot incantesimo massimo aggiuntivo.",
    "FEAT_PATRON_CHA": "Patrono Comunicante - Se subisci danni che ti porterebbero a 0, una forza misteriosa ti protegge. Se ciò accade, non subisci danni e perdi uno slot incantesimo di 1° livello. Se non hai slot di 1° livello, questo non si attiva.",
    "FEAT_LICH_INT": "Quasi Lichdom - Ispirato dal tuo pallido preferito, non guadagni più salute dalle cure. Diventi anche invulnerabile a tutte le forme di danno. Ogni volta che subisci danni di qualsiasi tipo, guadagni sempre un livello di sfinimento. Ogni volta che curi più di 6 PF da una singola fonte, perdi un livello di sfinimento.",
    "FEAT_NEURO_WIS": "Nevrosi Esoterica - Quando non hai FRAMMENTI DI JOR, puoi spendere punti ferita per sbloccare opzioni di dialogo. Il costo inizia a 1 PF e raddoppia ogni volta che lo usi. Il costo si azzera con un riposo lungo.",
    "FEAT_BLOOD_CON": "Magia del Sangue - Quando esaurisci gli slot incantesimo, puoi lanciare incantesimi con i punti ferita. Il costo inizia al livello dello slot in PF e viene moltiplicato per il numero di volte che hai attivato questo effetto. Il costo si azzera con un riposo lungo.",
    "FEAT_CLERIC_STR": "Il Chierico - I tuoi incantesimi di cura sono aumentati di una competenza extra. Le tue cure possono anche essere aumentate dal modificatore di Forza invece che da quello di Saggezza, se è superiore.",
    "FEAT_ROGUE_DEX": "Ladro Farabutto - La CD delle prove di destrezza minore è ridotta di una competenza extra.",
    "FEAT_WIZARD_INT": "Mago Imperatore - Il numero di incantesimi che puoi preparare è aumentato di una competenza extra. I Tiri Salvezza effettuati dai bersagli vengono anche tirati con svantaggio.",
    "FEAT_BARB_CON": "Barbaro Askanii - Ogni volta che sei al 25% o meno dei PF, aggiungi una competenza extra a tutti i tiri.",
    "FEAT_BARD_CHA": "Bardo Cercatore di Sapere - Le tue Prove di Osservazione vengono tirate con una competenza extra. Inoltre, le CD sui tiri di seduzione sono ridotte dalla tua competenza.",
    "FEAT_DRUID_WIS": "Druido Amichevole del Luogo - Competenza extra nei tiri quando ti trovi in habitat naturali. Questo include aree esterne, aree ricoperte di vegetazione e caverne.",
    "FEAT_LEYLINE_CHA": "Aggancio alla Linea Ley - Altera i modificatori di caratteristica sui CIONDOLI. I modificatori positivi ottengono +1 e quelli negativi -1.",
    "FEAT_MILL_CON": "Guardiano Millenario - Gli effetti delle Pozioni sono raddoppiati. Per gli aumenti di Caratteristica, questo influenza solo la prima pozione di quel tipo che hai ingerito.",
    "FEAT_TINGLE_WIS": "Formicolio Positivo - Gli incantesimi di cura vengono tirati con il doppio dei dadi normali.",
    "FEAT_SCRIBBLE_INT": "Scarabocchia i Margini - Il tuo livello da chierico è raddoppiato quando calcoli il numero di incantesimi che puoi preparare.",
    "FEAT_DEM_DEX": "Araldo Democratico - Recuperi 1d4 punti ferita ogni volta che chiedi a qualcuno cosa voterà alle elezioni.",
}

def translate_quest_text(english: str) -> str:
    """Translate quest texts - these are the most important narrative strings"""
    # Common RPG/game terms mapping
    terms = {
        "tea shop": "negozio di tè",
        "Tea Shop": "Negozio di Tè",
        "Coinlord": "Signore delle Monete",
        "Coinlord's": "del Signore delle Monete",
        "Short Rest": "Riposo Breve",
        "Long Rest": "Riposo Lungo",
        "hit points": "punti ferita",
        "Hit Points": "Punti Ferita",
        "spell slot": "slot incantesimo",
        "spell slots": "slot incantesimo",
        "Spell Slot": "Slot Incantesimo",
        "Death Saving Throw": "Tiro Salvezza contro Morte",
        "Death Saving Throws": "Tiri Salvezza contro Morte",
        "exhaustion": "sfinimento",
        "proficiency": "competenza",
        "advantage": "vantaggio",
        "disadvantage": "svantaggio",
        "saving throw": "tiro salvezza",
        "Saving Throw": "Tiro Salvezza",
        "natural 1": "1 naturale",
        "natural 20": "20 naturale",
        "HP": "PF",
        "Cleric": "Chierico",
        "cleric": "chierico",
        "Tolstad": "Tolstad",
        "Norvik": "Norvik",
        "Lady Sageleaf": "Lady Sageleaf",
        "Snell": "Snell",
        "Freestrider": "Cavalcatore Libero",
        "election": "elezione",
        "Election": "Elezione",
        "election day": "giorno delle elezioni",
        "the Pillar": "il Pilastro",
        "Pillar of Jor": "Pilastro di Jor",
        "Jor": "Jor",
        "City Below": "Città Sotterranea",
        "Lower Lair": "Tana Inferiore",
        "Goblin Garden": "Giardino dei Goblin",
        "Necklace of Fireballs": "Collana di Palle di Fuoco",
        "Shards of Jor": "Frammenti di Jor",
        "SHARDS OF JOR": "FRAMMENTI DI JOR",
        "Gate of Jor": "Portale di Jor",
        "Strings of Jor": "Corde di Jor",
        "The Undercommon": "L'Undercommon",
        "Behold Check": "Prova di Osservazione",
        "behold check": "prova di osservazione",
        "Behold Checks": "Prove di Osservazione",
        "trifle check": "prova di destrezza minore",
        "trifle checks": "prove di destrezza minore",
        "Trifle Check": "Prova di Destrezza Minore",
    }
    
    result = english
    for en, it in terms.items():
        result = result.replace(en, it)
    
    return result


def load_and_translate_csv(filepath: str, translation_map: dict = None, id_map: dict = None) -> list:
    """Load a CSV and apply translations"""
    entries = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry = dict(row)
            eng = entry.get('ENGLISH', '').strip()
            entry_id = entry.get('ID', '').strip()
            
            if id_map and entry_id in id_map:
                entry['ITALIAN'] = id_map[entry_id]
            elif translation_map and eng in translation_map:
                entry['ITALIAN'] = translation_map[eng]
            elif eng:
                # Apply quest/general translation
                entry['ITALIAN'] = translate_quest_text(eng)
            
            entries.append(entry)
    return entries


def save_csv(entries: list, filepath: str):
    """Save translated CSV"""
    if not entries:
        return
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['ID', 'ENGLISH', 'ITALIAN'])
        writer.writeheader()
        for e in entries:
            writer.writerow({
                'ID': e.get('ID', ''),
                'ENGLISH': e.get('ENGLISH', ''),
                'ITALIAN': e.get('ITALIAN', '')
            })


def main():
    print("=" * 60)
    print("Esoteric Ebb - Italian Translation")
    print("=" * 60)
    
    translated_dir = os.path.join(OUTPUT_DIR, "translated")
    os.makedirs(translated_dir, exist_ok=True)
    
    total_translated = 0
    total_entries = 0
    
    # 1. UI Elements
    print("\n[1/5] Translating UI Elements...")
    ui_entries = load_and_translate_csv(
        os.path.join(OUTPUT_DIR, "uielements.csv"),
        translation_map=UI_TRANSLATIONS
    )
    save_csv(ui_entries, os.path.join(translated_dir, "uielements.csv"))
    t = sum(1 for e in ui_entries if e.get('ITALIAN'))
    total_translated += t
    total_entries += len(ui_entries)
    print(f"  {t}/{len(ui_entries)} translated")
    
    # 2. Popups
    print("\n[2/5] Translating Popups...")
    popup_entries = load_and_translate_csv(
        os.path.join(OUTPUT_DIR, "popups.csv"),
        translation_map=POPUP_TRANSLATIONS
    )
    save_csv(popup_entries, os.path.join(translated_dir, "popups.csv"))
    t = sum(1 for e in popup_entries if e.get('ITALIAN'))
    total_translated += t
    total_entries += len(popup_entries)
    print(f"  {t}/{len(popup_entries)} translated")
    
    # 3. Feats
    print("\n[3/5] Translating Feats...")
    feat_entries = load_and_translate_csv(
        os.path.join(OUTPUT_DIR, "feats.csv"),
        id_map=FEAT_TRANSLATIONS
    )
    save_csv(feat_entries, os.path.join(translated_dir, "feats.csv"))
    t = sum(1 for e in feat_entries if e.get('ITALIAN'))
    total_translated += t
    total_entries += len(feat_entries)
    print(f"  {t}/{len(feat_entries)} translated")
    
    # 4. Quest Points (largest table - use term replacement)
    print("\n[4/5] Translating Quest Points...")
    quest_entries = load_and_translate_csv(
        os.path.join(OUTPUT_DIR, "questpoints.csv")
    )
    save_csv(quest_entries, os.path.join(translated_dir, "questpoints.csv"))
    t = sum(1 for e in quest_entries if e.get('ITALIAN'))
    total_translated += t
    total_entries += len(quest_entries)
    print(f"  {t}/{len(quest_entries)} translated (term replacement)")
    
    # 5. Backgrounds/table_0
    print("\n[5/5] Translating Backgrounds...")
    bg_entries = load_and_translate_csv(
        os.path.join(OUTPUT_DIR, "table_0.csv")
    )
    save_csv(bg_entries, os.path.join(translated_dir, "table_0.csv"))
    t = sum(1 for e in bg_entries if e.get('ITALIAN'))
    total_translated += t
    total_entries += len(bg_entries)
    print(f"  {t}/{len(bg_entries)} translated (term replacement)")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"TRANSLATION COMPLETE")
    print(f"{'='*60}")
    print(f"Total entries: {total_entries}")
    print(f"Translated: {total_translated}")
    print(f"Output: {translated_dir}")
    
    # Also create a combined file for injection
    all_entries = []
    for fname in os.listdir(translated_dir):
        if fname.endswith('.csv'):
            fpath = os.path.join(translated_dir, fname)
            with open(fpath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('ITALIAN'):
                        all_entries.append(row)
    
    combined_path = os.path.join(translated_dir, "all_translations.json")
    with open(combined_path, 'w', encoding='utf-8') as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)
    print(f"\nCombined JSON: {combined_path} ({len(all_entries)} entries)")


if __name__ == '__main__':
    main()
