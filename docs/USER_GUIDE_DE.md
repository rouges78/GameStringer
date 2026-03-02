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

*(NEU in v1.0.4)*

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

*(NEU in v1.0.4)*

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

### Funktionen

- **Table File Parser**: Liest und generiert .TBL-Dateien für Zeichenzuordnung
- **Font Injection**: Injiziert Schriften mit Umlauten und Sonderzeichen
- **Integrierter Hex-Editor**: Direkte ROM-Modifikation

### Wie man verwendet

1. **Gehen Sie zu Retro ROM Tools** im Menü
2. **Laden Sie die ROM** des Spiels
3. **Laden oder generieren Sie** die Table File (.TBL)
4. **Extrahieren Sie Text** aus der ROM
5. **Übersetzen Sie** mit AI oder manuell
6. **Injizieren Sie** die Übersetzungen in die ROM

---

## Öffentliche API v1

*(NEU in v1.0.4)*

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
```

### Antwort-Beispiel

```json
{
  "translation": "Hallo, Welt!",
  "source": "en",
  "target": "de",
  "provider": "gemini",
  "tokens": 12
}
```

### CI/CD-Nutzung

Die API ist ideal für die Integration von GameStringer in automatisierte Build-Pipelines.

---

## Voice Clone Studio

*(NEU in v1.0.5)*

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

### Wie man verwendet

1. **Gehen Sie zu Voice Clone** im Menü
2. **Geben Sie den Text** ein, der in Audio umgewandelt werden soll
3. **Wählen Sie den Anbieter** (ElevenLabs oder OpenAI)
4. **Wählen Sie das Stimmen-Preset**
5. **Generieren Sie Audio** und laden Sie die MP3/WAV-Datei herunter

---

## VR Text Overlay

*(NEU in v1.0.5)*

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

### Wie man verwendet

1. **Gehen Sie zu VR Overlay** im Menü
2. **Erkennen Sie das Headset** automatisch
3. **Konfigurieren Sie Position** und Textgröße
4. **Starten Sie Overlay** vor dem VR-Spiel
5. Untertitel erscheinen im 3D-Raum

---

## Quality Gates

*(NEU in v1.0.5)*

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

### Wie man verwendet

1. **Gehen Sie zu Quality Gates** im Menü
2. **Laden Sie Übersetzungen** (JSON, CSV, oder einfügen)
3. **Analysieren Sie** jeden String automatisch
4. **Filtern Sie** nach Vertrauensstufe
5. **Exportieren Sie Bericht** als JSON

---

## Player Feedback

*(NEU in v1.0.5)*

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

### Wie man verwendet

1. **Gehen Sie zu Player Feedback** im Menü
2. **Zeigen Sie empfangenes Feedback** an
3. **Filtern Sie** nach Kategorie, Status, Bewertung
4. **Aktualisieren Sie Feedback-Status**
5. **Exportieren Sie** als CSV zur Analyse

---

## Neue AI-Anbieter v1.0.6

*(NEU in v1.0.6)*

### Qwen 3 - Asiatische Sprachen

Optimierter Anbieter für Chinesisch, Japanisch und Koreanisch.

| Modell | Parameter | RAM erforderlich |
|--------|-----------|------------------|
| `qwen3:4b` | 4B | 4GB |
| `qwen3:8b` | 8B | 8GB |
| `qwen3:14b` | 14B | 16GB |
| `qwen3:32b` | 32B | 32GB |

**Installation**:
```bash
ollama pull qwen3:14b
```

**Optimierte Sprachen**: 中文 (Chinesisch), 日本語 (Japanisch), 한국어 (Koreanisch)

### NLLB-200 - 200 Sprachen

Meta AI-Anbieter mit Unterstützung für 200 Sprachen, einschließlich seltener.

**Unterstützte Spezialsprachen**:
- Thai, Vietnamesisch, Hindi, Arabisch
- Swahili, Indonesisch, Türkisch
- Ukrainisch, Bengali, Tamil

**Konfiguration**:
1. Gehen Sie zu **Einstellungen → API-Schlüssel**
2. Geben Sie **HuggingFace API Key** ein (kostenlos)
3. Wählen Sie **NLLB-200** als Anbieter

### Generic Ollama

Verwenden Sie jedes in Ollama installierte Modell für Übersetzungen.

**Empfohlene Modelle**:
- `llama3.2` - Gute Balance Qualität/Geschwindigkeit
- `mistral` - Hervorragend für europäische Sprachen
- `gemma2` - Schnell und leicht

---

## Community Hub v1.0.7

*(NEU in v1.0.7)*

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

*(NEU in v1.0.9)*

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

**Funktionen**:
- **Sound**: Zwei melodische Töne bei Update-Erkennung
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

### Wie man verwendet

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

```
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
```

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

#### Methode 1: Aus der GameStringer-App
1. Gehen Sie zum **Backup**-Bereich der App
2. Wählen Sie die wiederherzustellende Datei
3. Klicken Sie auf **Wiederherstellen**

#### Methode 2: Manuell
1. Finden Sie die Backup-Datei in `.gamestringer_backups/`
2. Kopieren Sie die Datei an den ursprünglichen Ort
3. Benennen Sie sie um und entfernen Sie den Zeitstempel

---

## Übersetzungs-Editor

Der Editor ermöglicht manuelle Übersetzungsbearbeitung.

### Hierarchische Struktur

```
📁 Spiele
├── 📁 Decarnation
│   ├── 📄 dialoge.csv (897 Strings)
│   └── 📄 items.csv (123 Strings)
└── 📁 Anderes Spiel
    └── 📄 texte.json (456 Strings)
```

### Funktionen

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

```
%APPDATA%/GameStringer/dictionaries/
├── 1672310_decarnation.json
├── 123456_anderes_spiel.json
└── ...
```

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

*GameStringer v1.4.1 - Anleitung aktualisiert 02.03.2026*
