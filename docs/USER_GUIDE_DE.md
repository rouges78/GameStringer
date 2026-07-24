# GameStringer - Vollständige Anleitung

## 🆕 Neu in v1.15.0

- ⚙️ **Ollama-Inferenzparameter**: neue Seite *Ollama Manager → Erweitert* mit 3 Presets (Treu/Ausgewogen/Kreativ) und einem Expertenmodus zum Feineinstellen von `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx` und `seed` lokaler Modelle.
- 🚀 **Projekte ↔ Patch Hub**: jedes importierte `.gspack` wird als abgeschlossenes Projekt registriert; von Projekte aus kannst du **Auf Spiel anwenden** (mit `.bak`-Backup) oder die vorausgefüllte Übersetzung im Patch Hub **veröffentlichen**.
- 💬 **Feedback-Widget** in *Einstellungen → Community*: melde Bugs oder Ideen mit automatisch angehängtem technischem Kontext (Version, Plattform, Bildschirm).
- ⚡ **Schnelleres Patch Hub**: lokaler Listen-Cache und Anti-Missbrauchs-Limits, damit du zwischen Tabs wechseln kannst, ohne jedes Mal vom Server neu zu laden.

## 🆕 Neu in v1.12.0

- 👁️ Übersetzung mit visuellem Kontext (VLM): Die KI sieht den Bildschirm und übersetzt im Kontext, löst mehrdeutige Wörter auf (z. B. "Chest" = Truhe oder Brust). Lokal (Ollama) oder OpenAI/Gemini
- 🪞 Selbstkorrigierender Durchlauf (Reflection): ein optionaler zweiter Durchlauf prüft und verfeinert die Übersetzung anhand von Glossar, Ton und Konsistenz — nur wo nötig
- 🧠 Semantischer Speicher (RAG): Translation Memory und Glossar werden per Bedeutung über lokale Embeddings zugeordnet, für einheitliche Terminologie im ganzen Spiel
- ⚡ Flüssigere Live-Übersetzung und native Screenshot-Verarbeitung (Zuschneiden/Skalieren vor dem KI-Aufruf)
- 🔌 Mehr Anbieter out of the box: DeepL, Groq, Cerebras, Cohere, Together, Fireworks, Hugging Face, Azure Translator, DashScope, LibreTranslate, Lingva, MyMemory
- 🧰 Neue Einstellungen für Reflection, semantisches RAG und visuellen Kontext (Qualität vs. Geschwindigkeit/Kosten)

## 🆕 Neu in v1.11.2

- **Mehr Stores**: Humble App, Game Jolt und Big Fish Games werden jetzt automatisch erkannt.
- **Übersetzungs-Lookup**: prüft via PCGamingWiki, ob ein Spiel deine Sprache bereits enthält, plus Suchlinks für italienische Fan-Patches.
- **Ins Patch Hub veröffentlichen**: ein fertiges Projekt in einem Schritt ans Community-Patch-Hub senden (Projekte → Veröffentlichen).
- **Neue Engines**: TyranoScript-Cloud-Pipeline und ein neu geschriebener `.pck`-Parser, der echte Godot-4.4+-Archive liest.
- **Unity**: lokale Ollama-Brücke für XUnity (CustomTranslate); Downloads (BepInEx/XUnity/TMP/UABEA) über die GitHub-API.

## Inhaltsverzeichnis

1. [Ersteinrichtung](#phase-1-ersteinrichtung)
2. [Store-Verbindung](#phase-2-store-verbindung)
3. [Spielebibliothek](#phase-3-spielebibliothek)
4. [Spiel übersetzen (Auto-Translate)](#phase-4-spiel-übersetzen)
5. [Patcher Engine](#phase-5-patcher-engine)
6. [Unity CSV Translator](#phase-6-unity-csv-translator)
7. [BepInEx + XUnity](#phase-7-bepinex--xunity)
8. [AI Pipeline Multi-Agent](#phase-8-ai-pipeline)
9. [AI-Übersetzer](#phase-9-ai-übersetzer)
10. [OCR-Übersetzer und Multi-Engine](#phase-10-ocr-übersetzer)
11. [Sprachübersetzer](#phase-11-sprachübersetzer)
12. [Batch- und Offline-Übersetzung](#phase-12-batch--offline)
13. [Danganronpa Patcher](#phase-13-danganronpa-patcher)
14. [Prediction Tool und QA Check](#phase-14-prediction-tool--qa-check)
15. [Glossar, TM und Adaptive MT](#phase-15-glossar-tm--adaptive-mt)
16. [Erweiterte Tools](#phase-16-erweiterte-tools)
17. [Sicherheit und Recovery Key](#phase-17-sicherheit)
18. [Fehlerbehebung](#phase-18-fehlerbehebung)
19. [Community-Chat (Echtzeit)](#phase-19-community-chat) *(NEU v1.5.0)*
20. [Projekte und Patch Hub](#projekte-und-patch-hub) *(AKTUALISIERT v1.15.0)*
21. [Ollama-Inferenzparameter](#ollama-inferenzparameter) *(NEU v1.15.0)*
22. [Feedback senden](#feedback-senden) *(NEU v1.15.0)*

---

## PHASE 1: ERSTEINRICHTUNG

### Erster Start

Starten Sie GameStringer. Beim ersten Start erscheint der Profilerstellungsbildschirm.

### Profil erstellen

- **Name**: Wählen Sie einen Namen (z.B. "Mario Gaming")
- **Avatar**: Wählen Sie eine Farbe/einen Verlauf
- **Passwort**: Mindestens 4 Zeichen
- Klicken Sie auf **"Profil erstellen"** — automatische Authentifizierung

### Benutzeroberfläche

- **Seitenleiste** (links): Navigation zwischen Bereichen
- **Dashboard** (Mitte): Spieleübersicht, Statistiken, AI Engine Widget
- **Strg+K**: Globale Schnellsuche für den Zugriff auf jede Seite

---

## PHASE 2: STORE-VERBINDUNG

### Unterstützte Stores

Steam, Epic Games, GOG, Ubisoft Connect, Origin/EA, Battle.net, Itch.io, Rockstar, Amazon Games.

### Steam-Konfiguration (Priorität)

1. API-Schlüssel von https://steamcommunity.com/dev/apikey
2. Steam ID64 von https://steamid.io/
3. In GS: **Einstellungen** → API-Schlüssel und Steam-ID eingeben
4. Das Steam-Profil muss **Öffentlich** sein

GS erkennt auch Spiele aus **Steam Family Sharing**.

---

## PHASE 3: SPIELEBIBLIOTHEK

- Seitenleiste → **"Bibliothek"** oder Dashboard → **"Bibliothek aktualisieren"**
- Das Laden dauert 1-2 Minuten für Hunderte von Spielen
- Klick auf ein Spiel: Details, erkannte Engine, Pfad, **"Spiel übersetzen"**-Button

---

## PHASE 4: SPIEL ÜBERSETZEN

Seitenleiste → **"Spiel übersetzen"** (Auto-Translate). Das Herzstück von GameStringer.

### Arbeitsablauf

1. **Spiel auswählen** aus der Bibliothek oder manueller Pfad
2. **Scan**: Erkennt Engine (Unity, Unreal, Godot, RPG Maker, Ren'Py, etc.) und übersetzbare Dateien
3. **Smart Auto-Select**: Empfiehlt die beste Methode für die erkannte Engine
4. **AI-Übersetzung**: Strings werden mit der konfigurierten AI-Engine übersetzt
5. **Überprüfung**: Prüfen, bearbeiten, genehmigen
6. **Patch anwenden**: Automatisches Backup + Anwendung

### Smart Auto-Select für Unity

| Typ | Empfohlene Methode | Alternative |
|-----|-------------------|-------------|
| Unity Mono (ohne BepInEx) | Unity CSV Translator | BepInEx + XUnity |
| Unity Mono (BepInEx vorhanden) | Unity CSV Translator | Erfasste Strings mit AI übersetzen |
| Unity IL2CPP | Unity CSV Translator | Keine (BepInEx inkompatibel) |

### Erkannte Engines

Unity (Mono/IL2CPP), Unreal Engine, Godot, RPG Maker, Ren'Py, Source Engine, CryEngine, RE Engine, Frostbite, id Tech, Creation Engine, Construct, AGS, Defold, Love2D.

---

## PHASE 5: PATCHER ENGINE

Seitenleiste → **Patcher** → **Patcher Engine**. 5 spezialisierte Patcher:

- **Unity**: BepInEx + XUnity AutoTranslator für Mono
- **Unreal Engine**: .locres-Dateiübersetzung (UE4/UE5)
- **Godot**: .pck-Dateien extrahieren/übersetzen/neu packen (Godot 3/4)
- **RPG Maker**: JSON-Übersetzung für MV/MZ (Dialoge, Gegenstände, Fähigkeiten)
- **Ren'Py**: .rpy-Dateiübersetzung (Visual Novels)

---

## PHASE 6: UNITY CSV TRANSLATOR

Die **beste Methode** für Unity-Spiele (Mono und IL2CPP).

### Funktionsweise

1. Scannt Unity-Assets (resources.assets, etc.)
2. Extrahiert CSV-Lokalisierungstabellen
3. Übersetzt mit AI (Ollama oder Cloud)
4. Injiziert Übersetzungen mit **Resize Injection** (keine Kürzung)

### Vorteile

- Funktioniert mit **allen** Unity-Spielen (Mono und IL2CPP)
- Keine Kürzung dank Resize
- Vollständige Abdeckung (alle Strings, nicht nur Bildschirmtexte)
- Keine externen Abhängigkeiten
- Automatisches Backup (.backup) und Wiederherstellung

---

## PHASE 7: BEPINEX + XUNITY

Für **Unity Mono**-Spiele — Live-Übersetzung während des Spielens.

1. GS erkennt das Unity-Spiel und findet die Exe
2. Klicken Sie auf **"BepInEx + XUnity installieren"**
3. Starten Sie das Spiel — XUnity erfasst Bildschirmtexte
4. Schließen und zurück zu GS — erfasste Strings mit AI übersetzen

**Einschränkung**: Funktioniert nicht mit IL2CPP (verursacht Absturz). Verwenden Sie Unity CSV Translator für IL2CPP.

---

## PHASE 8: AI PIPELINE

Suchen Sie **"AI Pipeline"** mit Strg+K. Mehrstufiges System für hohe Qualität.

### 6 Schritte

Harvest → Translate → QA Check → Auto-Fix → Review → Score

### 3 Modi

- **Quick**: Translate + QA (schnell)
- **Balanced**: + Auto-Fix (empfohlen)
- **Max Quality**: Alle 6 Schritte, Schwellenwert 75, maximal 3 Versuche

### Multi-Agent

Verschiedene Modelle pro Schritt zuweisen (z.B. qwen für Translate, gemma für Review). 4 Presets: Default, Speed, Max Quality, Diversified.

### Benchmark

Ausführungsverlauf mit Score, Dauer, ms/String. Preset-Vergleich.

---

## PHASE 9: AI-ÜBERSETZER

Seitenleiste → **Übersetzung** → **AI-Übersetzer**.

### Anbieter

- **Ollama** (lokal, kostenlos), **OpenAI/GPT-4**, **Claude**, **Gemini**, **DeepL**, **Lingva**

### Funktionen

- Einzel- oder Batch-Übersetzung
- Automatische Erkennung der Quellsprache
- Stil: natürlich, wörtlich, Gaming
- Placeholder-Erhaltung ({0}, %s, \n)
- Integration mit Glossar + Translation Memory + Adaptive MT

---

## PHASE 10: OCR-ÜBERSETZER

Seitenleiste → **Übersetzung** → **OCR-Übersetzer**.

Übersetzt Text vom Bildschirm in Echtzeit:

- Manueller Screenshot oder ausgewählter Bereich
- Kontinuierliches Live-OCR
- Globaler Hotkey: **Strg+Umschalt+T**

### OCR Multi-Engine

4 Engines: **OneOCR** (Win11), **PaddleOCR** (CJK), **RapidOCR** (ONNX), **Tesseract** (Fallback).

- Automatische Engine-Erkennung
- Automatische Fallback-Kette
- Paralleler Vergleichsmodus

---

## PHASE 11: SPRACHÜBERSETZER

Seitenleiste → **Übersetzung** → **Sprachübersetzer**.

- In-Game-Spracherkennung
- Audio → übersetzter Text
- Echtzeit-Untertitel-Overlay

---

## PHASE 12: BATCH- UND OFFLINE-ÜBERSETZUNG

### Batch

Seitenleiste → **Übersetzung** → **Batch**. Übersetzt ganze Ordner:

- Unterstützt .txt, .json, .csv, .po, .xml, .rpy, .ini
- Echtzeit-Fortschritt pro Datei
- AI-Pipeline-Option für maximale Qualität

### Offline (Ollama)

Seitenleiste → **Übersetzung** → **Offline-Übersetzer**.

- Vollständig lokale Übersetzung mit Ollama
- Keine Internetverbindung erforderlich
- Totale Privatsphäre — Daten verlassen Ihren PC nicht

---

## PHASE 13: DANGANRONPA PATCHER

Suchen Sie **"Danganronpa"** mit Strg+K.

### Funktionen

1. **Tab Patch anwenden**: Steam-Spiel auswählen, WAD-Dateien anzeigen, Patch anwenden
2. **Tab WAD Extractor**: 35.865 Strings extrahieren, suchen, filtern und übersetzen
3. **AI-Batch-Übersetzung**: Strings auswählen → mit AI übersetzen → JSON exportieren
4. **Verteilbares .zip exportieren**: Gepatchte WAD + Auto-Installer + Anleitung
5. Im Spiel: Einstellungen → Control Hints → "Keyboard and Mouse"

---

## PHASE 14: PREDICTION TOOL UND QA CHECK

### Prediction Tool

Mit Strg+K suchen. Analysiert ein Spiel vor der Übersetzung:

- Geschätzte String- und Wortanzahl
- Geschätzte Kosten pro Anbieter (DeepL, OpenAI, lokal)
- Geschätzte Zeit pro Methode
- Empfohlene Übersetzungsketten

### QA Check

Mit Strg+K suchen. Qualitätskontrolle nach der Übersetzung:

- Placeholder-Überprüfung
- Zahlen- und Werteprüfung
- String-Längenüberprüfung
- Format- und Zeichensetzungsprüfung
- Qualitätsbewertung pro String

---

## PHASE 15: GLOSSAR, TM UND ADAPTIVE MT

### Glossar

Mit Strg+K suchen. Benutzerdefinierte Terminologie pro Spiel:

- Begriffe hinzufügen (z.B. "quest" → "Aufgabe")
- Kategorien: Gameplay, UI, Charaktere, Lore
- Automatisch in die AI-Übersetzung integriert

### Smart Glossary

Generiert automatisch ein Glossar aus der Analyse der Spieldateien.

### Translation Memory

Dashboard → Widget "TM-Einträge". Übersetzungsspeicher:

- Speichert automatisch jedes übersetzte Paar
- Verwendet frühere Übersetzungen wieder
- Rust-Backend für Performance

### Adaptive MT

Lernt aus Ihren Korrekturen:

- Speichert: Original → AI → menschliche Korrektur
- Findet ähnliche Korrekturen mit Trigram/Wort-Ähnlichkeit
- Injiziert Few-Shot-Beispiele in den AI-Prompt
- Verbessert sich mit der Zeit

---

## PHASE 16: ERWEITERTE TOOLS

### Context Harvester

Scannt Spieldateien und extrahiert Kontext für die AI-Übersetzung.

### Übersetzungseditor

Erweiterter Editor für manuelle String-Überprüfung mit Filtern und Suche.

### Untertitel-Overlay

In-Game-Overlay für übersetzte Untertitel in Echtzeit.

### ROM Patcher

IPS/BPS-Patches für Retro-Übersetzungen anwenden und erstellen (SNES, GBA, etc.).

### Export-Formate

Übersetzungen exportieren nach: PO, XLIFF, CSV, JSON, TMX.

### Community Hub

Übersetzungen teilen, abstimmen, kommentieren, Community-Übersetzungen herunterladen.

---

## PHASE 17: SICHERHEIT

### Recovery Key

Bei der Profilerstellung wird ein **Recovery Key** generiert (12 mnemonische Wörter).

- Kopieren oder als .txt herunterladen
- **An einem sicheren Ort aufbewahren!**

### Passwort-Wiederherstellung

Anmeldebildschirm → **"Passwort vergessen?"** → 12 Wörter eingeben → neues Passwort.

---

## PHASE 18: FEHLERBEHEBUNG

### Spiel nicht gefunden

- Überprüfen Sie, ob es installiert ist und Steam/Epic geöffnet ist
- Bibliothek aktualisieren und GS neu starten

### Übersetzung nicht angewendet

- Spiel vollständig neu starten
- Schreibberechtigungen prüfen
- GS als Administrator ausführen

### AI antwortet nicht

- Internetverbindung prüfen (für Cloud-Anbieter)
- Für Ollama: Überprüfen, ob es läuft (grüner Punkt in der Seitenleiste)
- Andere Engine ausprobieren

### Spiel stürzt nach Patch ab

- Klicken Sie auf **"Backup wiederherstellen"** im verwendeten Tool
- Dateiintegrität auf Steam überprüfen (Rechtsklick → Eigenschaften → Lokale Dateien)

### Unity IL2CPP + BepInEx = Absturz

- GS blockiert jetzt automatisch BepInEx für IL2CPP
- Verwenden Sie stattdessen Unity CSV Translator

### Ollama langsam oder reagiert nicht

- Seitenleiste: grüner Punkt = online, rot = offline
- Ollama Manager → installierte Modelle prüfen
- Empfohlen: 7B-Modell für Geschwindigkeit, 13B+ für Qualität

---

## PHASE 19: COMMUNITY-CHAT

*(NEU v1.5.0)*

Echtzeit-Community-Chat im Community Hub, betrieben mit Supabase Realtime.

### Zugang

1. Gehen Sie zum **Community Hub** in der Seitenleiste
2. Klicken Sie auf den **Chat**-Tab oder das Chat-Symbol unten rechts
3. Wenn Sie in Ihrem GameStringer-Profil angemeldet sind, werden Sie **automatisch verbunden**!

### Standard-Räume

- **Allgemein**: freier Chat der GameStringer-Community
- **Übersetzungen**: Übersetzungen diskutieren, Hilfe bitten, Fortschritte teilen
- **Feedback & Bugs**: Fehler melden und Verbesserungen vorschlagen
- **Ankündigungen**: offizielle Neuigkeiten und Updates

### Funktionen

- **Echtzeit-Nachrichten**: Nachrichten erscheinen sofort über Supabase Realtime
- **Online-Präsenz**: sehen, wer gerade online ist
- **Antworten**: auf Nachrichten antworten
- **Bearbeiten/Löschen**: eigene Nachrichten bearbeiten oder löschen
- **Eigene Räume erstellen**: dedizierte Räume für Projekte oder Spiele
- **Auto-Login**: automatische Verbindung über GameStringer-Profil

## Neu in v1.9.0

### Bethesda Engine Patcher
- **Unterstützte Spiele**: Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield
- **Archivformate**: BSA v103/v104/v105 und BA2 (GNRL + DX10)
- **Plugins**: ESP/ESM-Parsing mit Extraktion übersetzbarer Datensätze
- **Lokalisierte Strings**: STRINGS, DLSTRINGS, ILSTRINGS

### CRI Middleware Patcher
- **Unterstützte Spiele**: Persona 5 Royal, Yakuza, Tales of, Dragon Ball und alle CRI-Titel
- **Archive**: CPK mit CRILAYLA-Dekompression
- **Nachrichtenformate**: MSG, BMD, FTD

### Unity Localization Package
- Pipeline für das offizielle Unity Localization Package (Unity 2021.3+)
- StringTable + SharedTableData, Addressables, Smart Strings
- Dedizierter Validator für Platzhalter und Pluralformen

### Universal PO Export
- gettext PO-Export mit vollständigen Metadaten aus jedem Patcher
- Kompatibel mit Poedit, Weblate, Crowdin

### Barrierefreiheit WCAG 2.1 AA
- aria-label, semantische Überschriften, focus-visible
- Skip-Link, prefers-reduced-motion, Windows High Contrast

### Design System und OCR
- Card-Varianten via cva, Button xs/icon-sm
- Echtes Tauri Tesseract OCR-Backend statt Stub
- Fix: Konsolen-Flash-Loop unter Windows beim Tray-Betrieb

---

## Patch Hub (Community-Übersetzungspakete)

Der Patch Hub ist ein Marktplatz im Stil des Steam Workshop zum Teilen und Herunterladen von Community-Übersetzungspaketen, der vom GameStringer-Community-Server bereitgestellt wird. Öffnen Sie ihn über den Eintrag **Patch Hub** in der Seitenleiste (orange/bernsteinfarbener Bereich).

### Pakete durchsuchen
Die Hauptansicht listet veröffentlichte Pakete mit Suche und Sortierung auf (am häufigsten heruntergeladen, am besten bewertet, kürzlich aktualisiert, Fertigstellungsgrad). Jede Karte zeigt das Spiel, die Quell- und Zielsprache (Quelle→Ziel), den Fertigstellungsgrad in %, die Bewertung und die Anzahl der Downloads. Klicken Sie auf ein Paket, um seine Detailseite mit Statistiken, Beschreibung, enthaltenen Dateien und Änderungsprotokoll zu öffnen.

### Ein Paket herunterladen
Klicken Sie auf der Detailseite eines Pakets auf **Download** (Herunterladen). GameStringer ruft alle Dateien des Pakets vom Community-Server ab und speichert sie lokal als `.gspack`-Bündel in Ihrer Paketbibliothek (`Documents/GameStringer/packs`). Von dort aus können Sie das Paket verwalten und es von der Detailseite eines Spiels aus importieren, um die Übersetzung anzuwenden.

### Ein Paket veröffentlichen
Klicken Sie auf **Publish patch** (Patch veröffentlichen), um das Veröffentlichungsformular zu öffnen. Geben Sie den Paketnamen, das Spiel, die Quell- und Zielsprache, eine optionale Beschreibung und Tags ein und fügen Sie Ihre Übersetzungsdatei(en) an. Wenn Sie im Community Hub angemeldet sind, wird das Paket auf den Community-Server hochgeladen und durchläuft eine Moderationswarteschlange, bevor es öffentlich sichtbar wird. Wenn Sie nicht angemeldet sind, wird das Paket als lokaler Entwurf gespeichert — melden Sie sich an und veröffentlichen Sie erneut, um es online zu teilen.

> Für die Online-Veröffentlichung ist ein Community-Hub-Konto erforderlich (getrennt von Ihrem lokalen Profil). Das Durchsuchen und Herunterladen funktioniert ohne Konto.

---

## Projekte und Patch Hub

*(AKTUALISIERT v1.15.0)*

Die Seite **Projekte** sammelt an einem Ort jedes Spiel, das du übersetzt oder bereits übersetzt hast — aus Quality Scoring, Wörterbüchern, Translation Memory und der Spielebibliothek. Von hier aus verwaltest du den gesamten Lebenszyklus einer Übersetzung: öffnen, anwenden, veröffentlichen.

### `.gspack` importieren → Projekt

Wenn du ein **`.gspack`-Bündel importierst** (aus dem Patch Hub heruntergeladen oder selbst erstellt), wendet GameStringer es nicht nur an: es **registriert ein abgeschlossenes Projekt** und **speichert die übersetzten Dateien** lokal. Das Spiel erscheint dann unter Projekte mit 100 %, bereit, später erneut angewendet oder veröffentlicht zu werden, ohne die Arbeit zu wiederholen.

### Auf Spiel anwenden

Für **abgeschlossene** Projekte kopiert der Button **"Auf Spiel anwenden"** (Ordnersymbol) die übersetzten Dateien direkt in die Installation:

1. Wähle den **Installationsordner** des Spiels
2. Bevor eine vorhandene Datei überschrieben wird, wird ein **`.bak`-Backup** neben dem Original erstellt
3. **Sicherheit**: Wenn das Backup einer Datei fehlschlägt, wird diese Datei **übersprungen** (nie ohne Sicherungskopie überschrieben)
4. Am Ende siehst du, wie viele Dateien geschrieben und wie viele übersprungen wurden

Um ein Original wiederherzustellen, benenne einfach die `.bak`-Datei um und entferne die Erweiterung.

### Veröffentlichen (vorausgefüllt)

Der Button **"Im Patch Hub veröffentlichen"** (Teilen-Symbol) sendet die Übersetzung an die Community. Er veröffentlicht **die echte übersetzte Datei** (nicht nur ein Metadaten-Manifest), mit Name, Spiel, Sprachen und Fertigstellungsgrad **bereits vorausgefüllt**. Das Paket durchläuft eine **Moderationswarteschlange**, bevor es öffentlich sichtbar wird.

> Zum Veröffentlichen musst du im **Community Hub** angemeldet sein (ein von deinem lokalen Profil getrenntes Konto).

### Entdecken / Meine Patches

Die Seite **Patch Hub** hat zwei Tabs:

- **Entdecken** — alle von der Community veröffentlichten Pakete, mit Suche und Sortierung (am häufigsten heruntergeladen, am besten bewertet, kürzlich aktualisiert, Fertigstellung)
- **Meine Patches** — nur die Pakete, die du mit dem aktuellen Profil veröffentlicht hast

### Performance

Die Patch-Hub-Listen verwenden einen **lokalen Cache** (etwa 60 Sekunden): Das Hin- und Herwechseln zwischen Tabs lädt nicht mehr jedes Mal vom Server neu. Der Cache wird nach einer Veröffentlichung oder einem Download automatisch aktualisiert. Veröffentlichen und Melden haben außerdem ein kleines **Mindestintervall** zwischen den Übermittlungen, um den gemeinsam genutzten Server nicht zu überlasten.

---

## Ollama-Inferenzparameter

*(NEU v1.15.0)*

Wenn du mit einem **lokalen Ollama-Modell** übersetzt, kannst du steuern, *wie* das Modell Text generiert. Öffne die Seite über **Ollama Manager → "Erweitert"** (Route `/ollama-manager/advanced`).

> Wenn du nichts änderst, bleiben die empfohlenen Standardwerte aktiv: Die Übersetzung verhält sich genau wie zuvor. Erweiterte Parameter werden **nur** dann an Ollama gesendet, wenn du sie festlegst.

### Presets

Drei fertige Profile, abgestimmt auf die Übersetzung von Videospielen:

| Preset | Temperature | `num_ctx` | Wann verwenden |
|--------|-------------|-----------|----------------|
| 🎯 **Treu** | 0.1 | 8192 | Maximale Texttreue, wenig Erfindung. **Empfohlen** für die Übersetzung. |
| ⚖️ **Ausgewogen** | 0.3 | 4096 | Ein Kompromiss zwischen Treue und Natürlichkeit. |
| ✨ **Kreativ** | 0.7 | 4096 | Mehr stilistische Freiheit: für Dialoge und ausdrucksstarken Ton. |

### Expertenmodus

Klappe **"Expertenmodus"** auf, um jeden Parameter mit Schiebereglern einzustellen:

| Parameter | Wirkung |
|-----------|---------|
| `temperature` | Zufälligkeit der Generierung. Niedrig = deterministischer und treuer; hoch = variabler und kreativer. |
| `top_p` | *Nucleus Sampling*: Berücksichtigt nur die wahrscheinlichsten Tokens bis zu dieser Wahrscheinlichkeitsmasse. Niedriger = fokussierter. |
| `top_k` | Beschränkt die Auswahl auf die k wahrscheinlichsten Tokens pro Schritt. Niedriger = weniger Abschweifungen. |
| `repeat_penalty` | Entmutigt das Wiederholen von Wörtern. Über 1.0 reduziert Schleifen; zu hoch kann den Text verzerren. |
| `num_ctx` | Kontextfenster (im Speicher gehaltene Tokens). **Breiter = keine Kürzung bei langen Texten**, aber mehr RAM/VRAM. |
| `seed` *(optional)* | Legt den Zufalls-Seed für **reproduzierbare** Ergebnisse fest (nützlich für Benchmarks). Aus = jeder Durchlauf kann variieren. |

Das Ändern eines Werts schaltet das Preset automatisch auf **"custom"**.

### Wann und warum verwenden

- **Treue vs. Kreativität**: Für die Übersetzung bevorzuge eine **niedrige Temperatur** (Preset Treu) — weniger Erfindung, mehr Treue. Erhöhe sie nur für Dialoge, bei denen du einen ausdrucksstärkeren Ton möchtest.
- **Lange Dateien**: Wenn du lange Texte übersetzt und Kürzung oder verlorenen Kontext bemerkst, erhöhe **`num_ctx`** (auf Kosten von mehr RAM/VRAM).
- **Reproduzierbarkeit**: Aktiviere den **`seed`**, wenn du zwei Modelle vergleichen oder dieselbe Übersetzung erneut ausführen und genau dieselbe Ausgabe erhalten möchtest.

### Verwendung

1. Öffne **Ollama Manager** in der Seitenleiste und klicke auf **"Erweitert"**
2. Wähle ein Preset (beginne mit **Treu** für die Übersetzung) oder öffne den **Expertenmodus**
3. Passe die Parameter an (z. B. erhöhe `num_ctx` für lange Dateien, aktiviere `seed` für wiederholbare Ergebnisse)
4. Klicke auf **"Speichern"** — die Parameter werden für nachfolgende Übersetzungen gespeichert

> **Geltungsbereich**: Diese Parameter gelten für Übersetzungen mit **lokalen Ollama-Modellen** (einschließlich der *Reflection*-Passe). Sie wirken sich nicht auf Web-Anbieter (Gemini, Groq usw.) aus.

---

## Feedback senden

*(NEU v1.15.0)*

Du kannst einen Bug melden, eine Idee vorschlagen oder uns deine Meinung sagen — direkt aus der App, ohne GameStringer zu verlassen.

### So sendest du es

1. Gehe zu **Einstellungen → Community** (Tab Community Hub)
2. Klicke im Feld **"Feedback senden"** auf **"Feedback senden"**
3. Wähle eine **Kategorie** — 🐞 Bug, 💡 Idee oder 💬 Sonstiges
4. Schreibe deine Nachricht und klicke auf **"Senden"**

### Automatisch angehängter Kontext

Damit wir das Problem verstehen, wird der Nachricht ein **minimaler technischer Kontext** angehängt:

- **Version** der App
- **Plattform** (Betriebssystem + Tauri/Web)
- **Bildschirm**, auf dem du warst (die aktuelle Route)
- **Spiel** (nur wenn du an einem bestimmten Titel gearbeitet hast)

> **Datenschutz**: keine personenbezogenen Daten. Nur Version, Plattform und aktueller Bildschirm.

### Wenn das Backend nicht verfügbar ist

Das Widget ist **fail-open**: Wenn der Server nicht konfiguriert ist oder du offline bist, geht die Nachricht nicht verloren. Du kannst den **Bericht** weiterhin in die Zwischenablage **kopieren** oder ihn per **E-Mail** mit einem Klick senden — der technische Kontext ist bereits im Text enthalten.

---

## Neu in v1.8.1

### Live-Übersetzungs-Overlay
- Gehen Sie zur Seite **/live-translate** oder drücken Sie **Strg+Alt+O**
- Wählen Sie Quell-/Zielsprache und AI-Anbieter
- Klicken Sie auf **Start** — das Overlay erscheint über dem Spiel
- Text wird alle 2 Sekunden per OCR erfasst
- Übersetzungen erscheinen als transparente Overlay-Boxen
- Diff-Erkennung überspringt unveränderten Text (spart API-Aufrufe)

### Hub-Marktplatz
- Gehen Sie zum **Community Hub**, um Übersetzungspakete zu durchsuchen
- **1-Klick-Installation**: Herunterladen → Validieren → Importieren
- Bewerten und rezensieren Sie Community-Pakete
- Veröffentlichen Sie Ihre eigenen Übersetzungen als **.gspack**-Dateien
- Benutzerprofile mit Reputation und Abzeichen

### Translation-Memory-Netzwerk
- Aktivieren Sie es unter **Einstellungen → TM-Netzwerk**
- Opt-in: Ihre hochwertigen Übersetzungen fließen in den globalen Pool ein
- Datenschutz zuerst: Quelltext gehasht, keine Benutzerdaten geteilt
- Der nächste Benutzer, der dasselbe Spiel übersetzt, erhält vorausgefüllte Vorschläge
- Automatisch in die Übersetzungspipeline integriert

### AI-Synchronisations-Pipeline
- Gehen Sie zur Seite **/dubbing**
- Wählen Sie den Spieleordner und konfigurieren Sie Sprachen/Stimme
- 7-Schritt-Pipeline: Scannen → Transkribieren → Übersetzen → Synthetisieren → Patchen → Lippensynchronisation → Untertitel
- Längenanpassung hält die übersetzte Audiodatei genauso lang wie das Original
- Charakter-Stimmprofile mit 16 Archetypen

### Plugin-System
- Die Community kann neue Spiel-Engine-Patcher in JavaScript erstellen
- Keine Rust-Kompilierung erforderlich
- Vorlagen-Generator erstellt vollständiges Plugin-Gerüst
- Plugins werden als **.gsplugin**-Pakete verteilt

---

## Neu in v1.9.0

### Community Hub UI-Verbesserungen
- **Redesigned Community Hub**: saubereres, konsistentes Design ohne übermäßige Farbverläufe und dekorative Blobs
- **Kompakte KPI-Cards**: kleinere, dezentere Statistik-Cards mit minimalen Farben
- **Minimalistische Category-Cards**: sauberes Design ohne schwere Farbverläufe und Schatten
- **Einheitliche Trending-Cards**: konsistente Gestaltung über alle Card-Typen

### Kompakte Freunde-Sidebar
- **Reduzierte Breite**: von 72 auf 56 (w-56) für mehr Bildschirmplatz
- **Kompakte Friend-Cards**: kleinere Avatare (7x7), engere Abstände
- **Kleinere Abschnitte**: Online/Offline-Header mit reduzierter Textgröße
- **Ultra-dünne Scrollbar**: 4px, standardmäßig unsichtbar, erscheint beim Hover

### Verbesserungen an der beständigen Chat
- **Diskreter Chat-Button**: elegant, kleiner Button unten rechts
- **Auf allen Seiten sichtbar**: Chat im gesamten App zugänglich
- **Saubereres Design**: übermäßige Animationen und Dekorationen entfernt

### Supabase-Social-Funktionen
- **Kompatibles Schema**: Supabase-Social-Schema an Frontend-Erwartungen angepasst (tools/supabase_social_compatible.sql)
- **RLS vorübergehend deaktiviert**: für einfacheres Debugging der Social-Funktionen
- **Chat-Participants-Fix**: Spaltennamen für UUID-Validierung korrigiert

### Bug-Fixes
- **Chat-Loop-Fix**: chatAttempted-Status hinzugefügt, um Endlosschleife in startDirectChat zu verhindern
- **Mock-Data-Entfernung**: ungültige UUID-Mock-Daten (user-123, etc.) entfernt, die 400-Fehler verursachten
- **Ollama-IPC-Fix**: Alle check_ollama_status-IPC-Aufrufe durch direktes HTTP zu localhost:11434 ersetzt
- **Stores-Link**: Stores-Link im Sidebar-Ressourcenabschnitt hinzugefügt
- **Epic-Connect**: von defektem OAuth zu Anmelde-Modal mit Anmeldedaten geändert
- **Verbindungstest**: testConnection verwendet nun echte Tauri-Befehle statt simulierter API
- **Disconnect-Fix**: Löschung von Epic/Steam-Anmeldedaten im Tauri-Backend hinzugefügt
- **Presence-Fix**: Session-Guard in updatePresence hinzugefügt, um 400 Bad Request zu vermeiden

---

## Was ist neu in v1.9.0

### 🟢 Einheitliche Online-Präsenz

Einheitliches Präsenzsystem, das Supabase Realtime und Datenbank kombiniert:

- **Sofortige Updates**: Online-Nutzer erscheinen in Echtzeit (Supabase Realtime Presence)
- **Globaler Heartbeat**: Präsenzstatus wird automatisch alle 30 Sekunden aktualisiert
- **Auto-away**: Wenn das Fenster 2+ Minuten nicht fokussiert ist, wird der Status "Abwesend"
- **Auto-online**: Wenn das Fenster wieder fokussiert wird, kehrt der Status zu "Online" zurück
- **DB-Fallback**: Wenn Realtime nicht verfügbar ist, verwendet das System die Datenbank als Fallback
- **Aktualisiertes Widget**: Das "Online-Nutzer"-Widget zeigt Benutzernamen, Avatare und Realtime-Indikator

### 🔔 System-Tray-Benachrichtigungen

Native OS-Benachrichtigungen für wichtige Ereignisse:

- **💬 Chat-Nachrichten**: OS-Benachrichtigung bei einer Nachricht im Community-Chat
- **✅ Übersetzungen abgeschlossen**: Benachrichtigung bei erfolgreicher Übersetzung
- **❌ Übersetzungs-/Systemfehler**: Benachrichtigung bei kritischen Fehlern (immer sichtbar)
- **🔄 App-Updates**: Benachrichtigung bei verfügbarem GameStringer-Update
- **🎮 Spiel-Updates**: Benachrichtigung, wenn ein aktualisiertes Spiel den Patch ungültig gemacht haben könnte
- **🟢 Freunde online**: Benachrichtigung, wenn ein Freund online kommt
- **📰 Neuigkeiten**: Benachrichtigungen für Community-News

**Konfiguration**: Einstellungen → Benachrichtigungen → System-Tray-Benachrichtigungen
- Toggle für jeden Benachrichtigungstyp
- **Ruhezeiten**: Benachrichtigungen in bestimmten Stunden unterdrücken (z.B. 23:00-07:00)
- **Test-Button**: Testbenachrichtigung senden zur Überprüfung
- **Tray-Tooltip**: Das Tray-Icon zeigt die Anzahl ungelesener Benachrichtigungen

### 🛡️ Error Boundaries + Crash-Recovery

Schutz vor Komponentenabstürzen:

- **WidgetErrorBoundary**: Wenn ein Widget abstürzt, wird eine kompakte Meldung angezeigt und automatisch nach 5 Sekunden versucht, es wiederherzustellen (max. 3 Versuche)
- **AppErrorBoundary**: Bei einem App-Absturz wird ein Fehlerbildschirm mit "App neu laden"-Option angezeigt
- **Auto-Recovery**: Widgets stellen sich automatisch ohne Benutzereingriff wieder her

### 🌐 Netzwerkresilienz / Offline-Modus

Korrekte Behandlung von Verbindungsabbrüchen:

- **Netzwerk-Monitor**: Erkennt Online-/Offline-Status + Supabase-Gesundheitsprüfung alle 30 Sekunden
- **Verbindungsstatusleiste**: Rote Leiste oben wenn offline, amber wenn Supabase down, grün wenn Verbindung wiederhergestellt
- **Retry mit Backoff**: Fehlgeschlagene Netzwerkoperationen werden automatisch mit exponentiellem Backoff (1s, 2s, 4s) erneut versucht
- **Offline-Warteschlange**: Im Offline-Modus werden Operationen (Chat-Nachrichten, Präsenz-Updates) in die Warteschlange gestellt und bei Verbindungsrückkehr ausgeführt
- **"Offline-Modus"**: Änderungen werden automatisch synchronisiert, wenn die Verbindung zurückkehrt

### 🎙️ Charakter-Sprachprofile (Voice Cloning)

System zur Bewahrung der Charakter-"Stimme" bei der Übersetzung:

- **Auto-Extraktion**: Analysiert Spieldialoge, um Charaktere und ihren Sprachstil zu identifizieren
- **16 verfügbare Töne**: Formell, Casual, Aggressiv, Sanft, Mysteriös, Komödiantisch, Dramatisch, Stoisch, Sarkastisch, Weise, Kindlich, Edel, Pirat, Militärisch, Akademisch, Straßen-Slang
- **5 Formalitätsstufen**: Sehr formell → Sehr informell
- **5 Altersgruppen**: Kind, Teenager, Junger Erwachsener, Erwachsener, Älterer
- **Sprachmuster**: Automatische Erkennung von Mustern (veraltete Wörter, Ausrufe, häufige Fragen)
- **Catchphrases**: Automatische Identifizierung wiederkehrender Charakterausdrücke
- **Prompt-Injektion**: Sprachprofile werden automatisch in den Übersetzungs-Prompt injiziert
- **Standardprofil**: Ein Profil als Fallback für nicht identifizierte Charaktere festlegen

**Verwendung**:
1. Auf der Auto-Translate-Seite erscheint nach dem Laden der Dateien das Panel "Charakter-Sprachprofile"
2. Klicken Sie auf **"Auto-Extrahieren"** zur Analyse der Dialoge
3. Oder erstellen Sie Profile manuell mit **"Neues Profil"**
4. Profile werden automatisch bei der Übersetzung angewendet

### 🧠 Fine-Tuning-Infrastruktur

System zum Generieren von Trainings-Datasets und Verwalten von spiel-spezifischen Modellen:

- **Dataset aus Korrekturen**: JSONL-Datasets aus menschlichen Korrekturen generieren (Adaptive MT)
- **4 Exportformate**: OpenAI JSONL, Ollama JSONL, Alpaca JSON, ChatML TXT
- **Nur Genehmigte**: Option, nur genehmigte Korrekturen im Dataset zu verwenden
- **Modellverwaltung**: Spiel-spezifische Fine-Tuned-Modelle registrieren und verwalten
- **Ollama-Integration**: Ollama-Verfügbarkeit für lokales Training prüfen
- **Dataset-Statistiken**: Beispielanzahl, durchschnittliche Länge, Qualitätsbewertung

**Verwendung**:
1. Gehen Sie zu **Einstellungen → AI → Fine-Tuning-Infrastruktur**
2. Wählen Sie das Sprachpaar und klicken Sie auf **"Generieren"**
3. Klicken Sie auf **"Export"** zum Herunterladen im gewünschten Format
4. Verwenden Sie das Dataset für Fine-Tuning mit Ollama oder Cloud-Anbietern

### ⚡ Code Splitting / Lazy Loading

Optimierung der Startzeit:

- 8 schwere Komponenten (Chat, Hintergrund-Jobs, Befehlspalette usw.) werden nur bei Bedarf geladen
- Die App startet schneller und verbraucht weniger Speicher

---

GameStringer v1.15.0 - Anleitung aktualisiert am 24.07.2026
