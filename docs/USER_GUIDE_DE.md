# 📖 GameStringer - Vollständige Benutzeranleitung

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Erster Start und Profile](#erster-start-und-profile)
3. [Bibliothek und Spieldetails](#bibliothek-und-spieldetails)
4. [Neural Translator Pro](#neural-translator-pro)
5. [Translation Wizard](#translation-wizard)
6. [Translation Bridge](#translation-bridge)
7. [Subtitle Translator Pro](#subtitle-translator-pro)
8. [Retro ROM Tools](#retro-rom-tools)
9. [Öffentliche API v1](#öffentliche-api-v1)
10. [Voice Clone Studio](#voice-clone-studio) *(NEU v1.0.5)*
11. [VR Text Overlay](#vr-text-overlay) *(NEU v1.0.5)*
12. [Quality Gates](#quality-gates) *(NEU v1.0.5)*
13. [Player Feedback](#player-feedback) *(NEU v1.0.5)*
14. [Neue AI-Anbieter v1.0.6](#neue-ai-anbieter-v106) *(NEU v1.0.6)*
15. [Community Hub v1.0.7](#community-hub-v107) *(NEU v1.0.7)*
16. [UI-Verbesserungen v1.0.9](#ui-verbesserungen-v109) *(NEU v1.0.9)*
17. [Patch-Export](#patch-export)
18. [Auf Spiel anwenden](#auf-spiel-anwenden)
19. [Backup-Verwaltung](#backup-verwaltung)
20. [Übersetzungs-Editor](#übersetzungs-editor)
21. [Aktivitätsverlauf](#aktivitätsverlauf)
22. [Wörterbücher](#wörterbücher)
23. [Fehlerbehebung](#fehlerbehebung)
24. [Glossar](#glossar)
25. [Context Harvester](#context-harvester)
26. [Übersetzungsspeicher](#übersetzungsspeicher)
27. [OCR-Übersetzer](#ocr-übersetzer)
28. [KI-Überprüfung](#ki-überprüfung)
29. [KI-Pipeline](#ki-pipeline)
30. [Emotions-Übersetzer](#emotions-übersetzer)
31. [Kulturelle Anpassung](#kulturelle-anpassung)
32. [Konfidenz-Heatmap](#konfidenz-heatmap)
33. [Blog-Verwaltung](#blog-verwaltung)
34. [Ren'Py Patcher](#renpy-patcher)
35. [RPG Maker Patcher](#rpg-maker-patcher)
36. [Wolf RPG Patcher](#wolf-rpg-patcher)
37. [Danganronpa Patcher](#danganronpa-patcher)
38. [Multi-LLM-Vergleich](#multi-llm-vergleich) *(NEU)*
39. [Live-Qualitätsbewertung](#live-qualitätsbewertung) *(NEU)*
40. [Charakter-Stimmprofile](#charakter-stimmprofile) *(NEU)*
41. [Sprach-Übersetzungs-Pipeline](#sprach-übersetzungs-pipeline) *(NEU)*
42. [OCR Multi-Engine](#ocr-multi-engine) *(NEU)*
43. [Retro-Spiele OCR](#retro-spiele-ocr) *(NEU)*
44. [Adaptive MT](#adaptive-mt) *(NEU)*
45. [Batch-Ordner-Übersetzer](#batch-ordner-übersetzer) *(NEU)*
46. [Offline-Übersetzer](#offline-übersetzer) *(NEU)*
47. [Manga/Comic-Übersetzer](#mangacomic-übersetzer) *(NEU)*
48. [Textur-Übersetzer](#textur-übersetzer) *(NEU)*
49. [Auto-Glossar](#auto-glossar) *(NEU)*

---

## Übersicht

GameStringer ist ein fortschrittliches System für automatische und manuelle Videospielübersetzungen. Es unterstützt:

- **Spiel-Engines**: Unity, Unreal Engine, RPG Maker, Ren'Py, Godot, Telltale, Wolf RPG, Kirikiri und andere
- **Dateiformate**: CSV, JSON, XML, PO/POT, YAML, TXT, SRT, VTT, ASS/SSA und andere
- **AI-Anbieter**: Claude, Gemini, GPT, DeepSeek, Mistral, Groq, Ollama, **Qwen 3**, **NLLB-200** (18+ Anbieter)
- **Sprachen**: 200+ unterstützte Sprachen (mit NLLB-200)
- **Mehrsprachige UI**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL (11 Sprachen)
- **Spiele-Stores**: Steam, Epic Games, GOG, Origin, Battle.net, Ubisoft, itch.io, Amazon Games
- **NEU v1.0.5**: Voice Clone Studio, VR Text Overlay, Quality Gates, Player Feedback
- **NEU v1.0.6**: Qwen 3 (asiatische Sprachen), NLLB-200 (200 Sprachen), Fehlerbehebungen
- **NEU v1.0.7**: Community Hub, GitHub Discussions, Lizenz v1.1
- **NEU v1.0.8**: Update-Download-Fix
- **NEU v1.0.9**: Animierte Header, Update-Benachrichtigungen, UI-Polish

---

## Erster Start und Profile

### Profil erstellen

Beim ersten Start erfordert GameStringer die Erstellung eines Benutzerprofils:

1. **Klicken Sie auf "Profil erstellen"** auf dem Startbildschirm
2. **Geben Sie einen Namen** für das Profil ein (z.B. "MeinName")
3. **Legen Sie ein Passwort fest** (mindestens 6 Zeichen)
4. **Klicken Sie auf "Erstellen"** zum Bestätigen

### Anmeldung

Um auf ein bestehendes Profil zuzugreifen:

1. **Wählen Sie das Profil** aus der Liste
2. **Geben Sie das Passwort ein**
3. **(Optional)** Aktivieren Sie "Passwort merken" für automatische Anmeldung
4. **Klicken Sie auf "Anmelden"**

### Profilverwaltung

- **Profil wechseln**: Klicken Sie auf das Profilsymbol oben rechts → "Profil wechseln"
- **Abmelden**: Klicken Sie auf das Profilsymbol → "Abmelden"
- **Profileinstellungen**: Gehen Sie zu Einstellungen → Profil

---

## Bibliothek und Spieldetails

### Bibliothek

Die Bibliothek zeigt alle Ihre synchronisierten Spiele von Steam, Epic Games, GOG und anderen Stores.

- **Aktualisieren**: Spielliste neu laden
- **Geteilt**: Family-Sharing-Spiele anzeigen/ausblenden
- **Filter**: Nach Plattform, Installationsstatus, Engine filtern

### Spieldetailseite

Klicken Sie auf ein Spiel, um die Detailseite mit **3:1**-Layout zu öffnen:

#### Hauptspalte (75%)

- **Screenshot-Galerie**: Raster mit bis zu 12 klickbaren Screenshots (Lightbox)
- **Schnellinfo**: Engine, Dateianzahl, Installationspfad, DLC
- **Tabs Dateien/Übersetzungen/Patch**:
  - **Dateien**: Übersetzbare Dateien mit "Neural Translator"-Button
  - **Übersetzungen**: Aktive Übersetzungen für dieses Spiel
  - **Patch**: Patches für Unity, Unreal, RPG Maker installieren/entfernen

#### Rechte Seitenleiste (25%)

- **Spielinfo**: Entwickler, Publisher, Erscheinungsdatum, Genres, unterstützte Sprachen
- **Aktionen**: Spiel übersetzen, Dateien scannen
- **HowLongToBeat**: Geschätzte Zeit zum Durchspielen

#### Übersetzungsempfehlung

Am Ende der Seite analysiert das System das Spiel und schlägt die **beste Übersetzungsmethode** vor:

| Methode | Wann verwenden |
|---------|----------------|
| **Live Unity** | Unity-Spiele mit BepInEx + XUnity |
| **File Translation** | Lokalisierungsdateien gefunden (JSON, CSV, etc.) |
| **OCR Overlay** | Keine Dateien gefunden, visuelle Echtzeit-Übersetzung |

---

## Neural Translator Pro

### Wie man eine Datei übersetzt

1. **Wählen Sie ein Spiel** aus der Steam-Bibliothek oder laden Sie manuell
2. **Laden Sie die Datei** zum Übersetzen (Drag & Drop oder durchsuchen)
3. **Konfigurieren Sie die Optionen**:
   - **Quellsprache**: die Originalsprache (z.B. Englisch)
   - **Zielsprache**: die Übersetzungssprache (z.B. Deutsch)
   - **AI-Anbieter**: Claude (empfohlen), Gemini oder GPT
   - **API-Schlüssel**: Geben Sie Ihren API-Schlüssel des gewählten Anbieters ein
4. **Starten Sie die Übersetzung** mit Klick auf "Übersetzung starten"
5. **Verfolgen Sie den Fortschritt** in der Fortschrittsanzeige

### Erweiterte Optionen

| Option | Beschreibung |
|--------|--------------|
| **Quality Checks** | Automatische Qualitätsprüfung (Zahlen, Formatierung, etc.) |
| **Translation Memory** | Frühere Übersetzungen wiederverwenden |
| **Batch Size** | Anzahl parallel übersetzter Strings (Standard: 10) |

### Geschätzte Kosten

Das System zeigt eine Kostenschätzung vor dem Start:

- **Claude**: ~$0.003 pro 1K Token
- **Gemini**: ~$0.0005 pro 1K Token (günstiger)
- **GPT-4**: ~$0.01 pro 1K Token

---

## Translation Wizard

Der Translation Wizard ist ein geführtes Verfahren zur automatischen Übersetzung von Spieldateien.

### Wie man den Wizard verwendet

1. **Gehen Sie zu Translator** → klicken Sie auf "Translation Wizard"
2. **Wählen Sie das Spiel** aus der Bibliothek oder geben Sie den Pfad manuell ein
3. **Scannen Sie Dateien**: Der Wizard findet automatisch übersetzbare Dateien
4. **Wählen Sie Dateien** zum Übersetzen (Sie können mehrere auswählen)
5. **Konfigurieren Sie die Optionen**:
   - Quell- und Zielsprache
   - AI-Anbieter
   - Qualitätsoptionen
6. **Starten Sie die Batch-Übersetzung**
7. **Verfolgen Sie den Fortschritt** in der Fortschrittsanzeige

### Automatisch erkannte Formate

| Erweiterung | Typ |
|-------------|-----|
| `.json` | JSON-Lokalisierung |
| `.csv` | Texttabellen |
| `.xml` | XML-Konfigurationen |
| `.po/.pot` | Gettext (Linux-Standard) |
| `.txt` | Klartext |
| `.yaml` | YAML-Config |

---

## Translation Bridge

Translation Bridge ermöglicht die Übersetzung von Unity-Spielen **in Echtzeit** während des Spielens.

### Voraussetzungen

- Unity-Spiel (Mono oder IL2CPP)
- BepInEx installiert
- XUnity.AutoTranslator-Plugin

### Wie man konfiguriert

1. **Gehen Sie zu Translation Bridge** im Menü
2. **Wählen Sie das Unity-Spiel** aus der Liste
3. **Installieren Sie BepInEx** (automatisch wenn nicht vorhanden)
4. **Konfigurieren Sie XUnity.AutoTranslator**:
   - Zielsprache
   - Übersetzungs-Endpoint
5. **Starten Sie das Spiel** - Übersetzungen erscheinen automatisch

### Betriebsmodi

- **Lokaler Cache**: Übersetzungen für Wiederverwendung gespeichert
- **Live-Übersetzung**: Neue Strings werden live übersetzt
- **Fallback**: Wenn offline, nur Cache verwenden

---

## Subtitle Translator Pro

> NEU in v1.0.4

Subtitle Translator Pro ermöglicht die Übersetzung von Untertiteln in verschiedenen Formaten.

### Unterstützte Formate

| Format | Erweiterung | Beschreibung |
|--------|-------------|--------------|
| **SubRip** | .srt | Häufigstes Format |
| **WebVTT** | .vtt | Web-Standard |
| **ASS/SSA** | .ass/.ssa | Erweiterte Untertitel mit Stilen |

### Wie man verwendet

1. **Gehen Sie zu Subtitle Translator** im Menü
2. **Laden Sie die Untertiteldatei** (Drag & Drop oder durchsuchen)
3. **Wählen Sie Quell- und Zielsprache**
4. **Echtzeit-Vorschau** der Übersetzungen
5. **Exportieren** im gewünschten Format

### Funktionen

- **QA-Validierung**: Automatische Timing- und Formatierungsprüfung
- **Synchronisierte Vorschau**: Übersetzungen mit Original-Timing sehen
- **Multi-Format-Export**: Zwischen SRT, VTT, ASS konvertieren

---

## Retro ROM Tools

> NEU in v1.0.4

Tools zum Übersetzen von Retro-Spielen auf ROMs.

### Unterstützte Konsolen

| Konsole | Abkürzung |
|---------|-----------|
| Nintendo Entertainment System | NES |
| Super Nintendo | SNES |
| Game Boy | GB |
| Game Boy Color | GBC |
| Game Boy Advance | GBA |
| Sega Genesis/Mega Drive | Genesis |
| PlayStation 1 | PSX |
| Nintendo 64 | N64 |

### Funktionen (2)

- **Table File Parser**: Liest und generiert .TBL-Dateien für Zeichenzuordnung
- **Font Injection**: Injiziert Schriften mit Umlauten und Sonderzeichen
- **Integrierter Hex-Editor**: Direkte ROM-Modifikation

### Verwendung Voice Clone

1. **Gehen Sie zu Retro ROM Tools** im Menü
2. **Laden Sie die ROM** des Spiels
3. **Laden oder generieren Sie** die Table File (.TBL)
4. **Extrahieren Sie Text** aus der ROM
5. **Übersetzen Sie** mit AI oder manuell
6. **Injizieren Sie** die Übersetzungen in die ROM

---

## Öffentliche API v1

> NEU in v1.0.4

GameStringer bietet eine REST-API für externe Integrationen.

### Verfügbare Endpoints

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| `POST` | `/api/v1/translate` | Einzelne String-Übersetzung |
| `POST` | `/api/v1/batch` | Batch-Übersetzung (max 100 Strings) |
| `GET` | `/api/v1/languages` | Liste der 20 unterstützten Sprachen |
| `GET` | `/api/v1/health` | Service-Gesundheitsprüfung |

### Anfrage-Beispiel

```json
POST /api/v1/translate
{
  "text": "Hello, world!",
  "source": "en",
  "target": "de",
  "provider": "gemini"
}
```text

### Antwort-Beispiel

```json
{
  "translation": "Hallo, Welt!",
  "source": "en",
  "target": "de",
  "provider": "gemini",
  "tokens": 12
}
```text

### CI/CD-Nutzung

Die API ist ideal für die Integration von GameStringer in automatisierte Build-Pipelines.

---

## Voice Clone Studio

> NEU in v1.0.5

Klonen Sie Stimmen mit AI für automatische Spielesynchronisation.

### Unterstützte Anbieter

| Anbieter | Typ | Qualität |
|----------|-----|----------|
| **ElevenLabs** | Cloud | ⭐⭐⭐⭐⭐ Ausgezeichnet |
| **OpenAI TTS** | Cloud | ⭐⭐⭐⭐ Sehr gut |

### Stimmen-Presets

- 🎭 **Erzähler**: Ruhige und autoritative Stimme
- ⚔️ **Held**: Mutige und entschlossene Stimme
- 😈 **Bösewicht**: Bedrohliche und tiefe Stimme
- 👶 **Kind**: Junge und fröhliche Stimme
- 🤖 **Roboter**: Synthetische und metallische Stimme
- 👻 **Flüstern**: Leise und mysteriöse Stimme

### Verwendung VR Overlay

1. **Gehen Sie zu Voice Clone** im Menü
2. **Geben Sie den Text** ein, der in Audio umgewandelt werden soll
3. **Wählen Sie den Anbieter** (ElevenLabs oder OpenAI)
4. **Wählen Sie das Stimmen-Preset**
5. **Generieren Sie Audio** und laden Sie die MP3/WAV-Datei herunter

---

## VR Text Overlay

> NEU in v1.0.5

3D-Raum-Untertitel für VR-Spiele.

### Unterstützte Headsets

| Headset | Support |
|---------|---------|
| **Oculus Quest/Rift** | ✅ Vollständig |
| **SteamVR** (Valve Index, HTC Vive) | ✅ Vollständig |
| **Windows Mixed Reality** | ✅ Vollständig |

### Positions-Presets

- **Center** - Vor dem Spieler
- **Bottom** - Unten (klassischer Untertitel)
- **Top** - Oben (Benachrichtigungen)
- **Follow Head** - Folgt dem Blick

### Verwendung Quality Gates

1. **Gehen Sie zu VR Overlay** im Menü
2. **Erkennen Sie das Headset** automatisch
3. **Konfigurieren Sie Position** und Textgröße
4. **Starten Sie Overlay** vor dem VR-Spiel
5. Untertitel erscheinen im 3D-Raum

---

## Quality Gates

> NEU in v1.0.5

Automatisches Qualitätskontrollsystem für Übersetzungen.

### Automatische Prüfungen

| Prüfung | Beschreibung |
|---------|--------------|
| **Placeholder** | Verifiziert {0}, {1}, %s, etc. |
| **Zahlen** | Zahlen korrekt erhalten |
| **HTML-Tags** | `<color>`, `<b>`, etc. intakt |
| **Länge** | Übersetzung nicht zu lang/kurz |
| **Zeichensetzung** | Konsistenz mit Original |

### Vertrauensstufen

| Stufe | Punktzahl | Farbe |
|-------|-----------|-------|
| 🔴 Kritisch | < 40% | Rot |
| 🟠 Niedrig | 40-59% | Orange |
| 🟡 Mittel | 60-74% | Gelb |
| 🟢 Hoch | 75-89% | Grün |
| 💚 Perfekt | 90-100% | Dunkelgrün |

### Verwendung Player Feedback

1. **Gehen Sie zu Quality Gates** im Menü
2. **Laden Sie Übersetzungen** (JSON, CSV, oder einfügen)
3. **Analysieren Sie** jeden String automatisch
4. **Filtern Sie** nach Vertrauensstufe
5. **Exportieren Sie Bericht** als JSON

---

## Player Feedback

> NEU in v1.0.5

Sammeln und verwalten Sie Spieler-Feedback zu Übersetzungen.

### Feedback-Kategorien

- 📝 **Falsche Übersetzung** - Falsche Bedeutung
- 🔤 **Grammatikfehler** - Grammatik/Rechtschreibung
- 🎭 **Unangemessener Ton** - Falsches Sprachregister
- ❓ **Unklar** - Verwirrende Übersetzung
- ✨ **Vorschlag** - Verbesserungsvorschlag

### Bewertungssystem

⭐⭐⭐⭐⭐ 1-5 Sterne Bewertung für jede Übersetzung

### Feedback-Status

| Status | Beschreibung |
|--------|--------------|
| 🆕 Neu | Gerade erhalten |
| 👀 In Prüfung | Wird analysiert |
| ✅ Gelöst | Korrigiert |
| ❌ Abgelehnt | Nicht anwendbar |

### Verwendung Unity Patcher

1. **Gehen Sie zu Player Feedback** im Menü
2. **Zeigen Sie empfangenes Feedback** an
3. **Filtern Sie** nach Kategorie, Status, Bewertung
4. **Aktualisieren Sie Feedback-Status**
5. **Exportieren Sie** als CSV zur Analyse

---

## Neue AI-Anbieter v1.0.6

> NEU in v1.0.6

### Qwen 3 - Asiatische Sprachen

Optimierter Anbieter für Chinesisch, Japanisch und Koreanisch.

| Modell | Parameter | RAM erforderlich |
|--------|-----------|------------------|
| `qwen3:4b` | 4B | 4GB |
| `qwen3:8b` | 8B | 8GB |
| `qwen3:14b` | 14B | 16GB |
| `qwen3:32b` | 32B | 32GB |

``bash
ollama pull qwen3:14b

```text

**Optimierte Sprachen**: 中文 (Chinesisch), 日本語 (Japanisch), 한국어 (Koreanisch)

### NLLB-200 - 200 Sprachen

Meta AI-Anbieter mit Unterstützung für 200 Sprachen, einschließlich seltener.



Thai, Vietnamesisch, Hindi, Arabisch
- Swahili, Indonesisch, Türkisch
- Ukrainisch, Bengali, Tamil

**Konfiguration**:


1. Gehen Sie zu **Einstellungen → API-Schlüssel**
2. Geben Sie **HuggingFace API Key** ein (kostenlos)
3. Wählen Sie **NLLB-200** als Anbieter

### Generic Ollama

Verwenden Sie jedes in Ollama installierte Modell für Übersetzungen.



`llama3.2` - Gute Balance Qualität/Geschwindigkeit
- `mistral` - Hervorragend für europäische Sprachen
- `gemma2` - Schnell und leicht

---

## Community Hub v1.0.7

> NEU in v1.0.7

Zentraler Hub für die GameStringer-Community.

### GitHub Discussions

Direkter Zugang zu Community-Diskussionen:


- **Ankündigungen**: Offizielle Neuigkeiten und Updates
- **Q&A**: Fragen und Antworten der Community
- **Ideen**: Vorschläge für neue Funktionen
- **Showcase**: Community-Projekte und Übersetzungen

### Wie man zugreift

1. **Gehen Sie zu Community Hub** in der Seitenleiste
2. **Navigieren Sie** durch die Diskussionskategorien
3. **Beteiligen Sie sich** direkt auf GitHub

### Lizenz v1.1

- **YouTuber/Streamer**: OK mit Quellenangabe
- **Nicht-kommerzielle Forks**: Erlaubt
- **Kommerzielle Nutzung**: Erfordert Genehmigung

---

## UI-Verbesserungen v1.0.9

> NEU in v1.0.9

Ästhetische und funktionale Interface-Updates.

### Animierte Header

Alle Übersetzungsseiten haben jetzt Header mit:


- **"Atem"-Effekt**: Farbverlauf, der sich sanft ausdehnt/zusammenzieht (12s)
- **Tiefe Schatten**: shadow-xl mit Blauton
- **Einheitlicher Farbverlauf**: Sky → Blue → Cyan

### Update-Benachrichtigungen

Die **Glocke** in der Navigationsleiste verwaltet jetzt Updates:

| Status | Verhalten |
|--------|-----------|
| 🔔 Grau | Keine Benachrichtigungen |
| 🔔 Gelb | Ungelesene Benachrichtigungen |
| 🔔 Grün + Puls | Update verfügbar! |



**Sound**: Zwei melodische Töne bei Update-Erkennung
- **Grünes Badge**: Animiertes Download-Symbol
- **Klick**: Öffnet Popup mit Änderungsliste
- **Download-Button**: Öffnet Download-Seite

### Seitenmenü

- **Hover Untermenü**: Dunkelgrüne Farbe (emerald-600)
- **Visuelle Konsistenz**: Einheitlicher Stil

### Anmeldebildschirm

- **Version unter Logo**: Zeigt v1.0.9 unter dem Logo
- **Footer**: Witziger Spruch statt Copyright

---

## Patch-Export

Der Unity Patcher installiert automatisch BepInEx und XUnity.AutoTranslator auf Unity-Spielen.

### Verwendung Retro ROM

1. **Gehen Sie zu Unity Patcher** in der Seitenleiste
2. **Wählen Sie ein Unity-Spiel** aus der Liste (grünes "Unity"-Badge)
3. **Wählen Sie die Zielsprache** (z.B. Deutsch)
4. **Wählen Sie den Modus**:
   - **Nur Erfassung**: Text für manuelle Übersetzung erfassen
   - **Google Translate**: Automatische In-Game-Übersetzung
   - **DeepL**: Hochwertigere automatische Übersetzung
5. **Klicken Sie auf "Patch installieren"**
6. **Starten Sie das Spiel** - drücken Sie `ALT+T` für XUnity-Menü

### Übersetzungs-Badge

Nach der Installation sehen Sie ein Badge mit dem Status:

| Badge | Bedeutung |
|-------|-----------|
| 🥈 Silber | XUnity mit aktivem Auto-Translate (Google/DeepL) |
| 🥉 Bronze | Nur Texterfassung (manuelle Übersetzung) |

### Aktivitätsverfolgung

Jeder installierte Patch wird in **Letzte Aktivität** im Dashboard aufgezeichnet mit:

- Spielname
- Gewählter Übersetzungsmodus
- Zielsprache

---

## Aktivitätsverlauf

Der Aktivitätsverlauf zeichnet alle durchgeführten Operationen auf.

### Zugang

Gehen Sie zu **Aktivitätsverlauf** in der Seitenleiste.

### Aufgezeichnete Aktivitätstypen

| Symbol | Typ | Beschreibung |
|--------|-----|--------------|
| 🌐 | Translation | Abgeschlossene Übersetzungen |
| 🔧 | Patch | Erstellte/angewendete Patches |
| ♻️ | SteamSync | Steam-Synchronisierungen |
| ➕ | GameAdded | Hinzugefügte Spiele |
| 🎮 | GameLaunched | Gestartete Spiele |
| 👤 | ProfileCreated | Erstellte Profile |
| ⚙️ | SettingsChanged | Geänderte Einstellungen |

### Verfügbare Filter

- **Nach Typ**: Nach Aktivitätskategorie filtern
- **Nach Datum**: Zeitraum auswählen
- **Nach Spiel**: Nur Aktivitäten eines bestimmten Spiels anzeigen

---

## Patch-Export

Nach Abschluss einer Übersetzung können Sie ein verteilungsfertiges Paket exportieren.

### Button "Patch exportieren"

Erstellt eine ZIP-Datei auf Ihrem **Desktop** mit:

```text

📦 Spielname_de_patch.zip
├── 📁 translated/          # Übersetzte Dateien, einsatzbereit
│   └── übersetzte_datei.csv
├── 📁 backup/               # Backups der Originaldateien
│   └── original_datei.csv
├── 📁 xunity/               # XUnity.AutoTranslator Format
│   └── AutoTranslator/
│       └── Translation/
│           └── de/
│               └── _Translations.txt
├── 📄 README.txt            # Installationsanleitung
└── 📄 metadata.json         # Übersetzungsinformationen

```text

### XUnity.AutoTranslator Format

Das XUnity-Format ist kompatibel mit:

- **Unity-Spielen** mit BepInEx + XUnity.AutoTranslator
- Format: `originaltext=übersetzter_text`

---

## Auf Spiel anwenden

### Button "Auf Spiel anwenden"

Installiert die Übersetzung **direkt im Spiel** automatisch:


1. **Erkennt die Engine** des Spiels (Unity, Unreal, etc.)
2. **Prüft Kompatibilität** mit verfügbaren Patchern
3. **Installiert den Patcher** falls nötig (z.B. BepInEx für Unity)
4. **Kopiert übersetzte Dateien** in den richtigen Ordner
5. **Konfiguriert das Spiel** zum Laden der Übersetzungen

### Unterstützte Engines

| Engine | Patcher | Status |
|--------|---------|--------|
| Unity (Mono) | BepInEx + XUnity.AutoTranslator | ✅ Automatisch |
| Unity (IL2CPP) | BepInEx IL2CPP | ⚠️ Teilweise |
| Unreal Engine | - | 🔧 Manuell |
| RPG Maker | - | ✅ Direkter Ersatz |
| Ren'Py | - | ✅ Direkter Ersatz |

### Was passiert mit Originaldateien?

**Originaldateien werden IMMER erhalten!**

1. Vor dem Überschreiben wird automatisch ein Backup erstellt
2. Backups werden in `.gamestringer_backups/` im Spielordner gespeichert
3. Backup-Name enthält Zeitstempel: `20241228_001500_dateiname.csv`

---

## Backup-Verwaltung

### Wo Sie Backups finden

Backups werden an zwei Orten gespeichert:


1. **Im Spielordner**: `[spielordner]/.gamestringer_backups/`
2. **Im exportierten ZIP-Paket**: Ordner `backup/`

### Wie man ein Backup wiederherstellt



Gehen Sie zum **Backup**-Bereich der App
2. Wählen Sie die wiederherzustellende Datei
3. Klicken Sie auf **Wiederherstellen**



Finden Sie die Backup-Datei in `.gamestringer_backups/`
2. Kopieren Sie die Datei an den ursprünglichen Ort
3. Benennen Sie sie um und entfernen Sie den Zeitstempel

---

## Übersetzungs-Editor

Der Editor ermöglicht manuelle Übersetzungsbearbeitung.

### Hierarchische Struktur

```text

📁 Spiele
├── 📁 Decarnation
│   ├── 📄 dialoge.csv (897 Strings)
│   └── 📄 items.csv (123 Strings)
└── 📁 Anderes Spiel
    └── 📄 texte.json (456 Strings)

```text

### Funktionen (3)

- **Suche**: Strings nach Text finden
- **Filter**: Nur unvollständige Übersetzungen, mit Fehlern, etc. anzeigen
- **AI-Vorschläge**: Neue Übersetzungen für einzelne Strings anfordern
- **Automatisches Speichern**: Änderungen werden im Wörterbuch gespeichert

---

## Wörterbücher

Wörterbücher speichern Übersetzungen für jedes Spiel.

### Wie sie funktionieren

1. Jedes Spiel hat sein eigenes separates Wörterbuch
2. Übersetzungen werden automatisch gespeichert
3. Wiederverwendet zur Beschleunigung zukünftiger Übersetzungen
4. Exportierbar in verschiedenen Formaten (JSON, CSV, TMX)

### Wörterbuch-Speicherort

```text

%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_anderes_spiel.json
└── ...

```text

---

## Fehlerbehebung

### Übersetzung ist langsam

- **Ursache**: Zu viele Strings oder langsamer Anbieter
- **Lösung**: Batch-Größe erhöhen oder Gemini verwenden (schneller)

### API-Schlüssel-Fehler

- **Ursache**: Ungültiger oder abgelaufener API-Schlüssel
- **Lösung**: Schlüssel auf der Anbieter-Website überprüfen

### Patcher installiert sich nicht

- **Ursache**: Antivirus blockiert BepInEx
- **Lösung**: Ausnahme für Spielordner hinzufügen

### Datei nicht erkannt

- **Ursache**: Nicht unterstütztes Dateiformat
- **Lösung**: In CSV oder JSON konvertieren

### Übersetzung mit Formatierungsfehlern

- **Ursache**: AI hat Variablen oder Tags geändert
- **Lösung**: "Quality Checks" aktivieren zur automatischen Erkennung

---

## Tastenkürzel

| Kürzel | Aktion |
|--------|--------|
| `Strg + S` | Aktuelle Übersetzung speichern |
| `Strg + Z` | Änderung rückgängig machen |
| `Strg + F` | In Datei suchen |
| `Esc` | Dialog/Panel schließen |

---

## Support

- **GitHub**: [github.com/rouges78/GameStringer](https://github.com/rouges78/GameStringer)
- **Issues**: Fehler melden oder Funktionen anfragen
- **Wiki**: Detaillierte technische Dokumentation

---

## Glossar

Das Glossar verwaltet benutzerdefinierte Terminologiewörterbücher für jedes Spiel und gewährleistet konsistente Übersetzungen.

### Funktionen

- **Term-Tiers**:
  - 🔴 **Locked** — Begriff immer identisch übersetzt (Eigennamen, Zauber, Orte)
  - 🟡 **Synced** — konsistente, kontextanpassbare Übersetzung
  - 🟢 **Flexible** — freie Übersetzung
- **Kategorien**: Charakter, Ort, Gegenstand, Fähigkeit, Quest, UI, System, Lore, Kreatur, Fraktion
- **Auto-Extraktion**: KI-Analyse des Textes zur Term-Vorschlagsermittlung
- **Konsistenzprüfung**: Sichert einheitliche Übersetzung in allen Dateien
- **Import/Export**: CSV und JSON zum Teilen von Glossaren zwischen Spielen

### Verwendung

1. Gehe zu **Erweiterte Tools → Glossar**
2. Wähle das Spiel aus der Liste
3. Füge Begriffe manuell hinzu oder nutze **"Begriffe extrahieren"** für KI-Vorschläge
4. Lege den Tier für jeden Begriff fest
5. Das Glossar wird automatisch bei Übersetzungen angewendet

---

## Context Harvester

Analysiert Textstrings, klassifiziert sie und reichert sie mit Kontext an, bevor sie an die KI-Übersetzung übergeben werden.

### Funktionen

- **Automatische Klassifizierung**: erkennt Bildschirmtyp (Menü, Dialog, Erzählung, Tutorial, System)
- **Sprecher-Erkennung**: schließt auf Sprecher und Tonart (formell, umgangssprachlich, aggressiv)
- **Kontext-Metadaten**: jeder String erhält Spielgenre, Inhaltstyp und Tonart
- **Harvest-Speicherung**: extrahierte Kontexte werden gespeichert und wiederverwendet
- **Batch-Verarbeitung**: analysiert ganze Dateien in einem Durchgang

### Verwendung

1. Gehe zu **Erweiterte Tools → Context Harvester**
2. Füge Strings ein oder lade eine Datei
3. Klicke **"Analysieren"** zur Klassifizierung
4. Lade das JSON-Ergebnis als Eingabe für KI-Übersetzungen herunter

---

## Übersetzungsspeicher

Persistente Datenbank aller abgeschlossenen Übersetzungen mit automatischer Wiederverwendung.

### Funktionen

- **Automatische Wiederverwendung**: bereits übersetzte Strings werden ohne neuen KI-Aufruf vorgeschlagen
- **Suche**: nach Originaltext, Übersetzung oder Spielname
- **Spiel-Filter**: zeigt nur Übersetzungen eines bestimmten Titels
- **Statistiken**: Gesamteinheiten, Verteilung nach Spiel, letztes Änderungsdatum
- **Export**: JSON, CSV, TMX für andere CAT-Tools
- **Import**: importiert vorhandene Übersetzungen aus TMX oder CSV

### Verwendung

1. Gehe zu **Erweiterte Tools → Übersetzungsspeicher**
2. Suche frühere Übersetzungen mit der Suchleiste
3. Bearbeite oder lösche einzelne Einheiten bei Bedarf
4. Der Speicher wird automatisch bei KI-Übersetzungen konsultiert

---

## OCR-Übersetzer

Erfasst Text aus beliebigen Spielfenstern oder Screenshots in Echtzeit und übersetzt ihn sofort.

### Funktionen

- **Echtzeit-Erfassung**: analysiert den Bildschirm in konfigurierbaren Intervallen
- **Quellsprachen**: Japanisch, Englisch, Vereinfachtes Chinesisch, Koreanisch
- **Fensterauswahl**: direkt auf das Spielfenster zeigen
- **Regionsauswahl**: bestimmten Bildschirmbereich zur Analyse definieren
- **Konfidenz**: zeigt Zuverlässigkeit für jeden erkannten Text
- **Globaler Hotkey**: Erfassung per Tastaturkürzel umschalten
- **Übersetzungs-Cache**: wiederverwendet frühere Übersetzungen für identische Strings

### Verwendung

1. Gehe zu **OCR-Übersetzer** in der Seitenleiste
2. Wähle die Quellsprache des Spiels
3. Klicke **"Fenster auswählen"** und wähle das Spielfenster
4. *(Optional)* Setze eine spezifische Region mit **"Region auswählen"**
5. Drücke **"Starten"** für die automatische Erfassung und Übersetzung

---

## KI-Überprüfung

Automatische Qualitätskontrolle von Übersetzungen mit Fehlererkennung und Korrekturvorschlägen.

### Funktionen

- **Einzelmodus**: Prüfung eines Original-/Übersetzungspaares
- **Batch-Modus**: Massenprüfung im Format `Original|Übersetzung` pro Zeile
- **Problemkategorien**: Genauigkeit, Flüssigkeit, Terminologie, Ton, Struktur
- **Schweregrade**: kritisch, Warnung, Info
- **Auto-Fix**: automatische Korrektur kleiner Probleme
- **Statistiken**: Gesamtscore 0–100 für jeden Batch

### Verwendung

1. Gehe zu **Erweiterte Tools → KI-Überprüfung**
2. Wähle **Einzel** oder **Batch**
3. Füge Originaltext und Übersetzung ein
4. Klicke **"Prüfen"** für den Report
5. Nutze **"Auto-Fix"** für vorgeschlagene Korrekturen

---

## KI-Pipeline

Automatisierter 6-Schritt-Workflow für maximale Übersetzungsqualität mit einem Klick.

### Pipeline-Schritte

1. **Harvest** — extrahiert und klassifiziert Kontext
2. **Translate** — übersetzt mit dem konfigurierten KI-Anbieter
3. **QA Check** — automatische Qualitätskontrolle
4. **Auto-Fix** — korrigiert gefundene Probleme
5. **Review** — abschließende KI-Überprüfung
6. **Score** — berechnet Endpunktzahl 0–100

### Verfügbare Voreinstellungen

- **Quick** — wesentliche Schritte (Translate + QA Check)
- **Max Quality** — alle 6 Schritte in Sequenz

### Verwendung

1. Gehe zu **Erweiterte Tools → KI-Pipeline**
2. Füge die zu übersetzenden Strings ein
3. Wähle Voreinstellung oder konfiguriere Schritte manuell
4. Klicke **"Pipeline starten"**
5. Lade den Abschlussbericht mit Punktzahlen herunter

---

## Emotions-Übersetzer

Übersetzung mit Analyse und Beibehaltung der Emotionen im Originaldialog.

### Funktionen

- **Emotionsanalyse**: erkennt vorherrschende Emotion (Wut, Trauer, Angst, Freude, neutral, Überraschung, Ekel)
- **Intensität**: misst emotionale Intensität (0–100)
- **Ton-Beibehaltung**: leitet KI zur Wahrung der emotionalen Wirkung
- **EmotionBadge**: visuelles Label für jeden String mit Emotion und Intensität
- **Batch-Statistiken**: Emotionsverteilung über eine ganze Datei

### Verwendung

1. Gehe zu **Erweiterte Tools → Emotions-Übersetzer**
2. Füge den zu übersetzenden Text ein
3. Wähle die Zielsprache
4. Klicke **"Analysieren & Übersetzen"**
5. Das Ergebnis zeigt die Übersetzung mit identifizierten Emotionen

---

## Kulturelle Anpassung

Analysiert übersetzten Text auf kulturell problematische Elemente und schlägt Anpassungen vor.

### Funktionen

- **Unterstützte Kulturen**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Analysierte Kategorien**: idiomatische Ausdrücke, Kulturreferenzen, Maße/Währungen, symbolische Farben, Höflichkeitsformen, Humor
- **Spezifische Vorschläge**: für jedes Element eine kulturangepasste Alternative
- **Anpassungsscore**: Prozentsatz des Text, der Überarbeitung benötigt

### Verwendung

1. Gehe zu **Erweiterte Tools → Kulturelle Anpassung**
2. Füge den übersetzten Text ein
3. Wähle Quell- und Zielkultur
4. Klicke **"Analysieren"**
5. Wende Vorschläge vor der Veröffentlichung an

---

## Konfidenz-Heatmap

Visualisiert die Qualität jeder Übersetzung durch eine farbcodierte Karte und identifiziert sofort problematische Strings.

### Funktionen

- **8 analysierte Metriken**: fehlende Platzhalter, leere Strings, nicht übersetzte Strings, Satzzeichen, Großschreibung, HTML-Tags, Länge, Zahlen
- **Farbcode**:
  - 🟢 **Ausgezeichnet** (90–100%) — korrekte Übersetzung
  - 🔵 **Gut** (75–89%) — kleine Stilprobleme
  - 🟡 **Akzeptabel** (60–74%) — kleinere Probleme
  - 🟠 **Überprüfen** (40–59%) — erhebliche Fehler
  - 🔴 **Schlecht** (<40%) — kritische Fehler
- **3 Eingabemodi**: integrierte Demo, Text einfügen (`Original|Übersetzung` pro Zeile), Datei hochladen (JSON/CSV/TXT)
- **Bericht exportieren**: JSON mit Bewertungen und Problemen für jeden String herunterladen

### Verwendung

1. Gehe zu **Erweiterte Tools → Konfidenz-Heatmap**
2. Wähle Modus: **Demo** für ein Beispiel, **Einfügen** für manuelle Eingabe, **Datei** zum Hochladen
3. Klicke **"Analysieren"**
4. Überprüfe den Farbbericht: rote/orange Strings brauchen vorrangige Überarbeitung
5. Nutze **"Bericht exportieren"** zum Speichern als JSON

---

## Blog-Verwaltung

Verwaltet einen Neuigkeiten- und Update-Blog für das Übersetzungsprojekt, sichtbar im Dashboard.

### Funktionen

- **Beiträge erstellen**: Titel, Datum, Kurzbeschreibung, Kategorie-Tag
- **Verfügbare Tags**: Feature, UI, Fix, Security, AI, Update, News
- **Anheften**: wichtige Beiträge oben in der Liste fixieren
- **Inline-Bearbeitung**: jeden Beitrag ohne Seitenwechsel bearbeiten
- **Beitrag löschen**: Entfernung mit Bestätigung
- **Anzeige**: chronologische Liste mit stilisiertem Datum, farbigem Tag-Badge und Beschreibungsvorschau

### Verwendung

1. Gehe zu **Blog-Verwaltung** aus dem Hauptmenü
2. Klicke **"Neuer Beitrag"**
3. Fülle Datum (z.B. "24 Jan"), Titel (mit empfohlenen Emojis), Beschreibung und Tag aus
4. Klicke **"Speichern"**
5. Nutze das 📌-Symbol zum Anheften eines Beitrags

---

## Ren'Py Patcher

Dedizierter Patcher für Visual Novels mit dem Ren'Py-Engine. Extrahiert Dialoge, Menüs und Erzählung aus `.rpy`-Dateien und generiert native Übersetzungsdateien.

### Funktionen

- **Auto-Erkennung**: identifiziert Titel, Version und Skriptdateien des Spiels
- **String-Typen**: Dialoge, Menü, Erzählung
- **Charaktererkennung**: zeigt welcher Charakter jede Zeile spricht
- **Inline-Editor**: auf einen String klicken zum Bearbeiten
- **Suche und Filter**: nach Text oder Charakter suchen, nach Typ filtern
- **`.rpy`-Dateien generieren**: erstellt die `tl/<Sprache>/`-Struktur für Ren'Py
- **JSON speichern/laden**: Fortschritt speichern und später fortsetzen
- **Statistiken**: Fertigstellungsprozentsatz, Anzahl nach Typ

### Verwendung

1. Gehe zu **Ren'Py Patcher** in der Seitenleiste
2. Klicke **"Durchsuchen"** und wähle den Ren'Py-Spielordner
3. Klicke **"Strings extrahieren"**
4. Übersetzungen im Editor bearbeiten (auf einen String klicken)
5. Zielsprachname eingeben (z.B. `german`) und **"Generiere .rpy"** klicken
6. Dateien werden im `tl/`-Ordner des Spiels gespeichert

---

## RPG Maker Patcher

Dedizierter Patcher für RPG Maker-Spiele (MV, MZ, XP, VX, VX Ace). Liest `.json`- und `.rxdata`/`.rvdata`-Dateien des Projekts.

### Funktionen

- **Versionserkennung**: identifiziert automatisch MV/MZ/XP/VX/Ace
- **Unterstützte Dateien**: Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States, Maps, CommonEvents, System
- **Statistiken pro Datei**: Übersetzungsfortschritt aufgeschlüsselt nach Datei
- **Translator++-Integration**: Direktlink zum Translator++-Download
- **Patch exportieren**: speichert Übersetzungen als JSON
- **Editor**: Volltextsuche, Inline-Bearbeitung

### Verwendung

1. Gehe zu **RPG Maker Patcher** in der Seitenleiste
2. RPG Maker-Projektordner auswählen
3. Klicke **"Strings extrahieren"**
4. Strings im Editor übersetzen
5. **"Patch speichern"** klicken

---

## Wolf RPG Patcher

Dedizierter Patcher für Wolf RPG Editor-Spiele. Verarbeitet binäre `.wolf`-Dateien und Spielkarten.

### Funktionen

- **Unterstützte Dateien**: Data/*.wolf (Datenbank), Map/*.mps (Karten)
- **String-Typen**: Datenbank, Karte, Skript, Ereignis
- **Verschlüsselungserkennung**: warnt bei verschlüsselten Dateien
- **WolfTrans-Integration**: empfiehlt WolfTrans für verschlüsselte Dateien
- **Fortschrittsbalken**: Fertigstellungsprozentsatz für das gesamte Projekt
- **Speichern/Laden**: JSON zum Fortsetzen der Arbeit

### Verwendung

1. Gehe zu **Wolf RPG Patcher** in der Seitenleiste
2. Wolf RPG-Spielordner auswählen
3. Klicke **"Strings extrahieren"**
4. Bei verschlüsselten Spielen WolfTrans-Anweisungen folgen
5. Strings übersetzen und **"Speichern"** klicken

---

## Danganronpa Patcher

Dedizierter Patcher für die Danganronpa-Spielserie. Verarbeitet `.pak`-Archive und `.po`-Lokalisierungsdateien.

### Funktionen

- **Spielerkennung**: identifiziert automatisch DR1, DR2, V3
- **PAK-Archive**: extrahiert und listet Dateien in `.pak`-Archiven
- **PO-Dateien**: native Unterstützung für `.po`/`.pot`-Dateien mit übersetzt/unübersetzt/fuzzy-Status
- **Integrierte KI-Übersetzung**: Schaltfläche zum automatischen Übersetzen mit der konfigurierten KI
- **PO-Statistiken**: Anzahl übersetzt, unübersetzt, fuzzy und Prozentsatz
- **DRAT-Integration**: Link zum DRAT-Tool für erweiterte Archivoperationen
- **Patch exportieren**: exportiert die geänderte `.po`-Datei

### Verwendung

1. Gehe zu **Danganronpa Patcher** in der Seitenleiste
2. Danganronpa-Spielordner auswählen
3. `.pak`-Archiv extrahieren oder direkt eine `.po`-Datei laden
4. Strings im Editor bearbeiten oder **"Mit KI übersetzen"** nutzen
5. Fertige `.po`-Datei exportieren und ins Spiel reimportieren

---

## Multi-LLM-Vergleich

Der Multi-LLM-Vergleich sendet denselben Text an mehrere KI-Anbieter parallel und wählt automatisch die beste Übersetzung aus.

### Unterstützte Anbieter

- **OpenAI** (GPT-4o)
- **Gemini** (Google)
- **Claude** (Anthropic)
- **DeepSeek**
- **Mistral**
- **DeepL**
- **Libre Translate**

### Funktionen

- **Paralleler Vergleich**: gleichzeitige Übersetzung mit 2–7 Anbietern
- **Automatische Auswahl**: das System wählt die Übersetzung mit der höchsten Bewertung
- **Konsensübersetzung**: wenn mehrere Modelle übereinstimmen, wird eine kombinierte Version erstellt
- **Qualitätsbewertung**: jede Übersetzung erhält eine Bewertung für Flüssigkeit, Genauigkeit, Konsistenz und Stil
- **Charakterprofile**: wenden Sie ein Stimmprofil an, um Ton und Vokabular anzupassen

### Verwendung

1. Gehe zu **Translator → Compare** in der Seitenleiste
2. Quelltext eingeben und Zielsprache auswählen
3. Mindestens 2 Anbieter aus der oberen Leiste auswählen
4. Klicke auf **„Vergleichen"**, um die parallelen Übersetzungen zu starten
5. Ergebnisse mit Bewertung prüfen und bevorzugte Übersetzung wählen, oder die automatisch ausgewählte verwenden

---

## Live-Qualitätsbewertung

Das Live-Qualitätsbewertungssystem bewertet automatisch jede Übersetzung anhand mehrerer Dimensionen und vergibt eine numerische Bewertung und eine Kategorie.

### Bewertete Dimensionen

| Dimension | Beschreibung |
|---|---|
| **Flüssigkeit** | Natürlichkeit und Lesbarkeit in der Zielsprache |
| **Genauigkeit** | Treue zur ursprünglichen Bedeutung |
| **Konsistenz** | Terminologische Übereinstimmung mit dem Rest des Projekts |
| **Stil** | Angemessenheit von Ton und Register für den Spielkontext |

### Bewertungskategorien

- **Ausgezeichnet** (90–100): Übersetzung bereit zur Veröffentlichung
- **Gut** (75–89): kleine optionale Verbesserungen
- **Akzeptabel** (60–74): Überprüfung empfohlen
- **Überarbeitungsbedürftig** (40–59): Korrekturen erforderlich
- **Mangelhaft** (0–39): Neuübersetzung erforderlich

### Automatische Kontrollen

- Erhaltung von Zahlen und Platzhaltern (`{0}`, `%s` usw.)
- Längenkonsistenz im Vergleich zum Original
- Erkennung nicht übersetzter Wörter
- Überprüfung von Zeichensetzung und Format

---

## Charakter-Stimmprofile

Charakter-Stimmprofile ermöglichen die Anpassung von Übersetzungen basierend auf der Persönlichkeit jedes Spielcharakters.

### Verfügbare Archetypen

Hero, Villain, Mentor, Sidekick, Love Interest, Comic Relief, Mysterious Stranger, Noble, Pirate, Warrior, Wizard, Merchant, Child, Robot, Monster, Narrator — oder **Custom**.

### Konfigurierbare Parameter

- **Persönlichkeit**: Archetyp, Charaktereigenschaften, Stimmung, Alter, Geschlecht
- **Sprechstil**: Formalität (sehr formell → sehr informell), Vokabular (archaisch, anspruchsvoll, standard, einfach, Slang, technisch), Satzlänge, Zeichensetzung
- **Muster**: Schlagworte, Füllwörter, End-Suffixe, zu vermeidende Wörter, bevorzugte Ersetzungen
- **TTS-Stimme** *(optional)*: Anbieter (OpenAI, ElevenLabs, Azure), Stimme, Tonhöhe, Geschwindigkeit, Emotion
- **Dialog-Beispiele**: Original/Übersetzung-Paare als Leitfaden für die KI

### Verwendung

1. Öffne den **Character Profile Manager** im Übersetzungspanel
2. Einen vordefinierten Archetyp wählen oder ein benutzerdefiniertes Profil erstellen
3. Persönlichkeit, Stil, Muster und Vokabular konfigurieren
4. Dialog-Beispiele hinzufügen, um die Konsistenz zu verbessern
5. Profil speichern — es wird automatisch in zukünftigen Übersetzungen für diesen Charakter angewendet

---

## Sprach-Übersetzungs-Pipeline

Die Sprach-Übersetzungs-Pipeline verwandelt gesprochenes Audio in übersetzten und synthetisierten Text in einer anderen Sprache, in einem einzigen End-to-End-Ablauf.

### Pipeline-Stufen

1. **Aufnahme / Upload**: Audio vom Mikrofon aufnehmen oder eine Audiodatei hochladen
2. **Transkription (Whisper)**: Sprache-zu-Text-Umwandlung über OpenAI Whisper
3. **KI-Übersetzung**: Übersetzung des transkribierten Textes in die Zielsprache
4. **Sprachsynthese (TTS)**: Erzeugung des übersetzten Audios mit synthetischen Stimmen

### Verfügbare Stimmen

| Stimme | Eigenschaft |
|---|---|
| **Nova** | Weiblich, natürlich |
| **Alloy** | Neutral, vielseitig |
| **Echo** | Männlich, warm |
| **Fable** | Erzählerisch, ausdrucksvoll |
| **Onyx** | Männlich, tief |
| **Shimmer** | Weiblich, brillant |

### Verwendung

1. Gehe zu **Voice Translator** in der Seitenleiste
2. Audio mit dem Mikrofon aufnehmen oder eine `.wav`/`.mp3`-Datei hochladen
3. Das System transkribiert das Audio automatisch mit Whisper
4. Zielsprache auswählen und Übersetzung starten
5. Eine TTS-Stimme wählen und das übersetzte Audio erzeugen
6. Ergebnis abspielen oder herunterladen

> **Hinweis**: Erfordert einen konfigurierten OpenAI-API-Schlüssel für Whisper und TTS.

---

## OCR Multi-Engine

OCR Multi-Engine unterstützt 4 OCR-Engines mit automatischer Erkennung und intelligentem Fallback für die Texterkennung aus Spiel-Screenshots.

### Unterstützte Engines

| Engine | Beschreibung | Stärken |
|---|---|---|
| **OneOCR** | Windows 11 AI nativ (Port 17231) | Stilisierte Schriften, überlagerten Text, niedrige Auflösung |
| **PaddleOCR** | Baidu Open-Source (Port 8866) | Hervorragend für CJK, vertikaler Text, hohe Genauigkeit |
| **RapidOCR** | Leichter ONNX-Wrapper (Port 9003) | Schnell, leicht, einfach zu installieren |
| **Tesseract.js** | Browser-integriert | Immer verfügbar, 100+ Sprachen, kein Setup |

### Funktionen

- **Automatische Erkennung**: Probing verfügbarer Engines beim Start
- **Fallback-Kette**: OneOCR → PaddleOCR → RapidOCR → Tesseract (CJK: PaddleOCR zuerst)
- **Vergleichsmodus**: alle Engines parallel ausführen und das beste Ergebnis verwenden
- **Bild-Preprocessing**: Graustufen, Kontrast, Schwellenwert, Hochskalierung für kleinen Text
- **Bevorzugte Engine**: Präferenz für zukünftige Sitzungen speichern

### Verwendung

1. Gehe zu **OCR Multi-Engine** in der Seitenleiste
2. Klicke auf **„Engines erkennen"** um zu prüfen, welche online sind
3. Bevorzugte Engine durch Klick auf die entsprechende Karte auswählen
4. Screenshot hochladen oder Bild einfügen
5. Das System erkennt den Text mit der gewählten Engine (oder automatischem Fallback)

---

## Retro-Spiele OCR

Retro-Spiele OCR ist ein spezialisiertes Modul für die Texterkennung aus Screenshots von Retro-Spielen mit pixeligen Schriften.

### Verfügbare Presets

| Preset | Ära | Optimierung |
|---|---|---|
| **8-bit** | NES, Game Boy, MSX | 4x Hochskalierung, hoher Schwellenwert, Dithering-Entfernung |
| **16-bit** | SNES, Mega Drive, PC Engine | 3x Hochskalierung, mittlerer Kontrast, Schärfung |
| **DOS/PC** | DOS, EGA/VGA | 2x Hochskalierung, mittlerer Schwellenwert, Monospace-Schrift |
| **PC-98** | NEC PC-98 (Japanisch) | 3x Hochskalierung, hoher Schwellenwert, CJK-optimiert |
| **Early Windows** | Windows 3.1/95/98 | 2x Hochskalierung, leichter Kontrast |

### Konfigurierbare Parameter

- **Hochskalierung**: Vergrößerungsfaktor (Nearest-Neighbor zur Pixelerhaltung)
- **Kontrast**: Kontrastverstärkung vor der Erkennung
- **Binärschwellenwert**: Schwarz/Weiß-Konvertierung mit konfigurierbarem Schwellenwert
- **Dithering-Entfernung**: filtert Dithering-Muster typischer Retro-Spiele
- **Schärfung / Entrauschen**: Schärfung und Rauschreduzierung

### Verwendung

1. Öffne das **Retro-Game OCR** Panel im OCR-Bereich
2. Wähle ein Spiel-Preset oder konfiguriere die Parameter manuell
3. Lade den Retro-Spiel-Screenshot hoch
4. Das System verarbeitet das Bild vor und wendet optimierte Erkennung an
5. Überprüfe und bearbeite den erkannten Text

---

## Adaptive MT

Adaptive MT (Adaptive maschinelle Übersetzung) ist ein System, das aus menschlichen Korrekturen lernt, um die Übersetzungsqualität progressiv zu verbessern.

### Wie es funktioniert

1. **Korrekturen speichern**: wenn Sie eine KI-Übersetzung korrigieren, wird das Paar (Original → Korrektur) gespeichert
2. **Fuzzy-Ähnlichkeit**: Trigramme (Dice-Koeffizient) + Wortähnlichkeit (Jaccard) um relevante Korrekturen zu finden
3. **Few-shot Learning**: die ähnlichsten Korrekturen zum aktuellen Text werden als Beispiele in den Prompt injiziert
4. **Feedback-Loop**: je mehr Korrekturen Sie speichern, desto besser werden zukünftige Übersetzungen

### Funktionen

- **Auto-Erkennung von Tags**: tone_change, terminology, major_rewrite, length_change, punctuation, style
- **Kontextueller Boost**: Priorität für Korrekturen desselben Spiels (1.3x), desselben Inhaltstyps (1.2x), neuere Korrekturen
- **Genehmigung**: Korrekturen als verifiziert markieren für höhere Zuverlässigkeit
- **Import/Export**: Korrektursets zwischen Projekten exportieren und importieren
- **Statistiken**: Korrekturanzahl nach Sprache, Spiel, Typ, Tag und durchschnittlicher Nutzung

### Konfiguration

| Parameter | Standard | Beschreibung |
|---|---|---|
| **Max Beispiele** | 5 | Maximale Few-shot-Beispiele pro Prompt |
| **Ähnlichkeitsschwelle** | 0.2 | Minimum-Ähnlichkeit um ein Beispiel einzubeziehen |
| **Gleiches Spiel** | Ja | Korrekturen desselben Spiels bevorzugen |
| **Nur genehmigte** | Nein | Nur als genehmigt markierte Korrekturen verwenden |

---

## Batch-Ordner-Übersetzer

Der Batch-Ordner-Übersetzer übersetzt ganze Dateiordner in einer einzigen Operation unter Beibehaltung der Originalstruktur.

### Funktionen

- **Rekursives Scannen**: scannt automatisch Unterordner
- **Multi-Format**: unterstützt CSV, JSON, XML, PO, YAML, TXT, SRT, VTT und mehr
- **Intelligente Auswahl**: filtern nach Dateityp, Größe oder Muster
- **Flexible Ausgabe**: anpassbarer Ausgabeordner mit erhaltener Struktur
- **Parallele Übersetzung**: bis zu 3 gleichzeitige Batches für maximale Geschwindigkeit
- **Translation Memory**: nutzt und füttert den Übersetzungsspeicher automatisch
- **Inhaltsklassifizierung**: klassifiziert Strings nach Typ (Dialog, UI, System) vor der Übersetzung
- **Qualitätskontrolle**: automatisches QA mit konfigurierbarem Mindestpunktzahl
- **Pause/Fortsetzen**: Übersetzung jederzeit pausieren und fortsetzen

### Parameter

| Parameter | Standard | Beschreibung |
|---|---|---|
| **Batch-Größe** | 40 | Strings pro API-Aufruf |
| **Parallel** | 3 | Gleichzeitige Batches |
| **Verzögerung** | 50ms | Pause zwischen Batches |
| **Min. Punktzahl** | 70 | Mindest-Qualitätsschwelle |
| **Max Versuche** | 3 | Wiederholungen bei Fehler |

### Verwendung

1. Gehe zu **Batch Translator** in der Seitenleiste
2. Quellordner mit den zu übersetzenden Dateien auswählen
3. Quellsprache, Zielsprache und KI-Anbieter wählen
4. Optionen konfigurieren (TM, QA, Klassifizierung, Pipeline)
5. Klicke auf **„Starten"** um die Batch-Übersetzung zu beginnen
6. Fortschritt in Echtzeit überwachen — pausieren oder abbrechen möglich

---

## Offline-Übersetzer

Der Offline-Übersetzer ermöglicht das Übersetzen von Texten ohne Internetverbindung, unter Verwendung lokaler AI-Modelle über Ollama. Es werden keine Daten online gesendet.

### Voraussetzungen

- **Ollama** installiert und gestartet (`ollama serve`)
- Mindestens ein Übersetzungsmodell heruntergeladen

### Empfohlene Modelle

| Modell | Größe | Beschreibung |
|---|---|---|
| **huihui_ai/hy-mt1.5-abliterated:7b** | ~4,5 GB | Tencent HY-MT 1.5 — #1 WMT25, schlägt Google Translate in 30/31 Sprachen |
| **huihui_ai/hy-mt1.5-abliterated:1.8b** | ~1,2 GB | Leichte und ultraschnelle Version |
| **translategemma:12b** | ~8,0 GB | Google TranslateGemma — 55 Sprachen, hohe Qualität |
| **translategemma:2b** | ~1,5 GB | Google TranslateGemma — 55 Sprachen, schnell und leicht |
| **qwen3:4b** | ~2,5 GB | Alibaba Qwen 3 — Allzweck, gut für Übersetzungen |

### Funktionen

- **Einzelmodus**: übersetze einen Text nach dem anderen
- **Batch-Modus**: übersetze mehrere Texte (einer pro Zeile) in einer einzigen Operation
- **14 unterstützte Sprachen**: IT, EN, FR, DE, ES, PT, RU, JA, KO, ZH, PL, NL, TR, CS
- **Sprachentausch**: tausche Quell- und Zielsprache mit einem Klick
- **Modellauswahl**: wähle aus den auf Ollama installierten Modellen
- **Ergebnisverlauf**: alle Ergebnisse mit Übersetzungszeit angezeigt
- **Ergebnisse kopieren**: einzelne Übersetzung oder alle zusammen kopieren
- **Integriertes Setup**: starte Ollama und lade Modelle direkt von der Oberfläche herunter

### Verwendung

1. Gehe zu **Offline-Übersetzer** in der Seitenleiste
2. Wenn Ollama nicht läuft, klicke auf **„Ollama starten"** im Setup-Panel
3. Lade ein empfohlenes Modell herunter (z.B. `hy-mt1.5-abliterated:7b`)
4. Wähle Quell- und Zielsprache
5. Gib den Text ein und klicke auf **„Übersetzen"** (oder Strg+Enter)
6. Für Batch: aktiviere den Batch-Modus und gib mehrere Zeilen ein

---

## Manga/Comic-Übersetzer

Der Manga/Comic-Übersetzer ist ein spezialisiertes Werkzeug zur Übersetzung von Comics und Manga, mit automatischer Sprechblasen-Erkennung, OCR, Übersetzung und Inpainting.

### Funktionen

- **Sprechblasen-Erkennung**: identifiziert automatisch Textblasen in Seiten
- **Integriertes OCR**: erkennt Text innerhalb der Blasen (horizontal und vertikal)
- **Automatische Übersetzung**: übersetzt den erkannten Text in die Zielsprache
- **Inpainting**: entfernt den Originaltext und ersetzt ihn durch die Übersetzung
- **Schriftarten**: Manga Style, Comic Sans, Handwritten, Bold
- **Multi-Seite**: verwalte mehrere Seiten gleichzeitig
- **Batch-Übersetzung**: verarbeite alle Seiten nacheinander
- **Export**: exportiere einzelne Seite oder alle übersetzten Seiten

### Unterstützte Sprachen

JA (Japanisch), ZH (Chinesisch), KO (Koreanisch), EN (Englisch), IT (Italienisch), ES (Spanisch), FR (Französisch), DE (Deutsch)

### Verwendung

1. Gehe zu **Manga Translator** in der Seitenleiste
2. Lade Manga/Comic-Seiten hoch (Drag & Drop oder Dateiauswahl)
3. Wähle Quell- und Zielsprache
4. Klicke auf **„Erkennen & Übersetzen"** um die aktuelle Seite zu analysieren
5. Überprüfe die erkannten Blasen und Übersetzungen
6. Klicke auf **„Inpainting"** um die Übersetzungen auf das Bild anzuwenden
7. Exportiere die übersetzte Seite

---

## Textur-Übersetzer

Der Textur-Übersetzer übersetzt Text in Videospiel-Texturen (Menüs, HUD, Buttons, UI) und bewahrt dabei den grafischen Stil und die Formatierung.

### Unterstützte Formate

| Format | Beschreibung |
|---|---|
| **DDS** | DirectDraw Surface (am häufigsten in Spielen) |
| **PNG** | Portable Network Graphics |
| **TGA** | Targa |
| **BMP** | Bitmap |
| **JPG** | JPEG |
| **WebP** | WebP |

### Funktionen

- **Region-Erkennung**: scannt die Textur um Bereiche mit Text zu finden
- **Textur-OCR**: erkennt Text in den erkannten Regionen
- **Automatische Übersetzung**: übersetzt Text unter Beibehaltung des visuellen Kontexts
- **Stil-Beibehaltung**: behält Hintergrundfarben, Textfarbe, Schrift und Größe bei
- **Auto-Match Schrift**: wählt automatisch die ähnlichste Schrift aus
- **Vorschau**: zeigt Textur-Vorschau vor und nach der Übersetzung
- **Batch-Verarbeitung**: verarbeitet alle Texturen nacheinander
- **Export**: exportiere einzelne Textur oder alle geänderten Texturen

### Verwendung

1. Gehe zu **Texture Translator** in der Seitenleiste
2. Lade Texturen hoch (Drag & Drop, Dateiauswahl oder ganzer Ordner)
3. Wähle Quell- und Zielsprache
4. Klicke auf **„Textur scannen"** um Textregionen zu erkennen
5. Überprüfe und bearbeite die vorgeschlagenen Übersetzungen
6. Klicke auf **„Übersetzungen anwenden"** um die übersetzte Textur zu generieren
7. Exportiere die geänderten Texturen

---

## Auto-Glossar

Das Auto-Glossar extrahiert automatisch Spielbegriffe aus Texten mittels LLM, speichert sie in einem Glossar pro Spiel und injiziert sie in die Übersetzungs-Prompts, um terminologische Konsistenz zu gewährleisten.

### 3-Stufen-System

| Stufe | Symbol | Verhalten |
|---|---|---|
| **Locked** | 🔒 | Feste Übersetzung, wird nie von der AI geändert |
| **Synced** | 🔄 | Bevorzugte Übersetzung, AI kann Alternativen vorschlagen |
| **Flexible** | 🔓 | Vorgeschlagene Übersetzung, AI wählt die beste |

### Begriffskategorien

👤 Charakter, 📍 Ort, 🎒 Gegenstand, ⚔️ Fähigkeit, 📜 Quest, 🖥️ UI, ⚙️ System, 📚 Lore, 🐉 Kreatur, 🏰 Fraktion, 📌 Sonstiges

### Funktionen

- **Automatische Extraktion**: analysiert Spieltexte mit LLM und extrahiert Schlüsselbegriffe
- **Standardbegriffe**: fügt automatisch gängige Gaming-Begriffe hinzu (HP, XP, NPC, usw.)
- **Suche und Filter**: suche nach Text, filtere nach Stufe oder Kategorie
- **Prompt-Injektion**: Begriffe werden automatisch in die Übersetzungs-Prompts injiziert
- **Do Not Translate**: markiere Begriffe die nicht übersetzt werden sollen
- **Case-sensitive**: Option für Begriffe mit Groß-/Kleinschreibung (Eigennamen)
- **Import/Export**: exportiere und importiere Glossare im CSV- oder JSON-Format
- **Konsistenzprüfung**: prüft ob Begriffe einheitlich in den Übersetzungen verwendet werden
- **Statistiken**: Anzahl Begriffe nach Stufe, Kategorie und Quelle (auto/manuell)

### Konfiguration

| Parameter | Standard | Beschreibung |
|---|---|---|
| **Aktiviert** | Ja | Auto-Glossar aktivieren/deaktivieren |
| **Beim ersten Batch extrahieren** | Ja | Extrahiert Begriffe aus dem ersten übersetzten Batch |
| **Max Begriffe pro Extraktion** | 20 | Maximale Begriffe pro Durchlauf |
| **Min-Konfidenz** | 50 | Minimale Konfidenzschwelle (0–100) |
| **In Prompts injizieren** | Ja | Injiziert Begriffe in Übersetzungs-Prompts |
| **Max Begriffe im Prompt** | 30 | Maximale Begriffe pro Prompt (begrenzt Context Window) |

### Verwendung

1. Gehe zu **Glossar** in der Seitenleiste
2. Erstelle ein neues Glossar mit Spiel, Quell- und Zielsprache
3. Füge Begriffe manuell hinzu oder klicke auf **„Begriffe extrahieren"** für AI-Extraktion
4. Konfiguriere Stufe (Locked/Synced/Flexible) und Kategorie für jeden Begriff
5. Begriffe werden automatisch in die Übersetzungs-Prompts injiziert
6. Verwende **„Konsistenz prüfen"** um die einheitliche Begriffsverwendung zu überprüfen

---

## Neuheiten v1.4.0

### Einheitliches Radix UI

Die UI-Bibliothek wurde von einzelnen `@radix-ui/react-*` Paketen auf das einheitliche `radix-ui` Paket migriert:


- **37 Komponenten migriert** mit vereinfachten Imports
- **27 Pakete entfernt** aus den Abhängigkeiten, leichteres Bundle
- Keine visuellen Änderungen — gleiche UI, weniger Abhängigkeiten

### Quality Badges im Translator Pro

Jede übersetzte Zeile zeigt nun visuelle Qualitätsindikatoren:


- **QualityScoreBadge**: Bewertung 0-100 mit Farben (🟢 ≥80, 🟡 ≥60, 🔴 <60)
- **ContentTypeBadge**: klassifiziert den Inhaltstyp (UI, Dialog, Erzählung, System, Tutorial, etc.)
- **Live-Vorschau**: während der Batch-Übersetzung erscheinen die letzten 3 Zeilen mit Echtzeit-Bewertung
- **Detailtabelle**: auf der Ergebnisseite bis zu 200 Zeilen mit Original, Übersetzung, Typ und Qualität

### RTL-Unterstützung

- Automatische Textrichtungserkennung für RTL-Sprachen (Arabisch, Hebräisch)
- `dir`-Attribut wird dynamisch auf das HTML-Dokument angewendet

### Generisches Ollama

- Neuer Provider `translateWithOllamaGeneric` für beliebige Ollama-Modelle
- PROVIDER_MAP mit automatischem Modell-Mapping
- Chain Presets mit automatischem Fallback zwischen Providern

### Bundle-Optimierung

- `optimizePackageImports` aktualisiert mit `radix-ui`, `framer-motion`, `recharts`, `cmdk`, `react-hook-form`
- Null TypeScript-Fehler in Quelldateien

---

## Neuigkeiten v1.4.1

### Vollständige GOG Galaxy Unterstützung

- **GOG Galaxy 2.0 Bibliothek**: liest besessene Spiele aus lokaler SQLite-Datenbank
- **Cover und Beschreibungen via GOG API**: automatisches Abrufen von Bildern und Details
- **Zusammenführung mit installierten Spielen**: kombiniert Registry-Daten mit Galaxy
- **Store- und Download-Links**: Store-Seite mit direkten GOG Galaxy Links

### Verbessertes Dashboard

- **Verbundene Stores oben**: Stores sind jetzt neben dem zuletzt geöffneten Spiel
- **Store-Badges mit echten Zahlen**: zeigt tatsächliche Spielanzahl pro Store
- **Letztes Spiel Platzhalter**: elegante Anzeige wenn kein Spiel geöffnet

### Verbessertes Spieldetail

- **Info-Tab**: Systemanforderungen, Metacritic-Score, Store-Links, DLC-Liste
- **GOG-Cover**: automatisches Fallback für GOG-Spielcover
- **GOG-Beschreibungen**: vollständige Beschreibung via GOG API

### AI-Provider Korrekturen

- **Kostenlose Provider nie permanent gesperrt**: MyMemory, Lingva verwenden Cooldown (30s)
- **Steam Wishlist**: neuer IWishlistService-Endpoint mit Legacy-Fallback

### Leistung

- **sessionStorage-Cache**: sofortige Navigation zurück von Detail zur Bibliothek
- **Batch-Cover-Speicherung**: mit Debounce (2s) um Race Conditions zu vermeiden
- **SteamGridDB Fetch Deduplizierung**: vermeidet doppelte Anfragen im StrictMode

### Plattformübergreifender Build

- **Node.js Build-Skript**: `build-tauri-cross.js` ersetzt das PowerShell-Skript
- **Linux-Unterstützung**: GitHub Actions Workflow kompiliert jetzt auch für Linux (.deb, .AppImage)
- **Windows**: Installer (.msi, .exe NSIS) und portable Version (.zip)

### Dokumentation

- **11 Benutzerhandbücher**: Markdown-Lint-Korrekturen
- **Korrigierte Indexnummerierung**: geordneter Index ohne Lücken

---

## Neuigkeiten v1.4.2

### Vision LLM Translator

- **Kontextbewusste Übersetzung**: verwendet In-Game-Screenshots für visuellen Kontext
- **3 unterstützte Anbieter**: Ollama (lokal), Gemini 2.0 Flash, OpenAI GPT-4o
- **Upload oder Erfassung**: Bild hochladen oder Bildschirm erfassen für KI-Kontext
- **Eigene Seite**: `/vision-translator` mit integrierter Sidebar

### Erweiterte KI-Tools

- **Lore Assistant**: RAG-Chat zum Erkunden von Game-Lore und Dialogen
- **Auto-Hook Scanner**: Prozessspeicher-Scan mit WinAPI
- **System Monitor**: Echtzeit-VRAM/RAM-Überwachung (Rust-Backend)
- **Ollama Setup Wizard**: Schritt-für-Schritt lokale KI-Installation
- **Debug Console**: Integrierte Debug-Konsole mit Log-Abfang
- **Plugin System**: Design-Dokument `PLUGIN_SYSTEM.md`

### Community Hub

- **GitHub Discussions**: 12 Diskussionen erstellt in den Kategorien Announcements, General, Ideas, Q&A, Show and tell, Polls
- **Öffentliche REST API**: Community Hub lädt Diskussionen jetzt ohne GitHub-Token
- **Sidebar umbenannt**: "Workshop" → "Steam Workshop" für mehr Klarheit

### Übersetzungs-Provider Fix

- **Ollama Cooldown**: Netzwerkfehler verwenden jetzt 30s Cooldown statt permanenter Blockierung
- **Lingva 404**: Automatische Kürzung von Texten >500 Zeichen zur Vermeidung zu langer URLs
- **Auto-Translate Review**: Neuer Button "Alle unübersetzten übersetzen" mit Fortschrittsbalken und Stop
- **Tutorial querySelector**: Fix SyntaxError mit `:contains()`-Selektoren (kein Standard-CSS)
- **Update Bell**: Fix falsche Version im Popup (hartcodierter Fallback entfernt)

### CI/CD und Sicherheit

- **Tauri Signing Key**: Konfiguriert für automatische signierte `latest.json`-Generierung
- **GitHub Secrets**: `TAURI_SIGNING_PRIVATE_KEY` und `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` konfiguriert
- **Workflow release.yml**: Aktualisiert mit Signaturvariablen für beide Jobs (Windows + Linux)

### Unity: Automatische BepInEx + XUnity AutoTranslator Installation

- **Automatische Unity-Erkennung**: wenn der Scanner keine übersetzbaren Dateien in einem Unity-Spiel findet, wird eine dedizierte Karte statt eines generischen Fehlers angezeigt
- **Ein-Klick-Installation**: Schaltfläche "BepInEx + XUnity AutoTranslator installieren" erkennt automatisch die Spiel-EXE, installiert das Framework und das Übersetzungs-Plugin mit Echtzeit-Logs
- **Geführter Ablauf**: nach der Installation wird empfohlen, das Spiel einmal zu starten und neu zu scannen — alle Texte werden übersetzbar
- **Credits**: BepInEx Team und bbepis (XUnity AutoTranslator)

---

*GameStringer v1.4.2 - Anleitung aktualisiert 03.03.2026*
