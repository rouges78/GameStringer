# GameStringer - Vollständige Anleitung

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

## Neu in v1.6.0

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

GameStringer v1.6.0 - Anleitung aktualisiert am 04.04.2026
