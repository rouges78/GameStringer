<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>Aplikacja desktopowa, która tłumaczy gry wideo na dowolny język za pomocą SI.</strong><br>
  Wybierz grę ze swojej biblioteki, wybierz język, kliknij przetłumacz — gotowe.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.8.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Source--Available-green" alt="License" />
  <img src="https://img.shields.io/badge/Tauri_2-24C8DB?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js_15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Rust-orange?logo=rust&logoColor=white" alt="Rust" />
</p>

<p align="center">
  <a href="#-czym-jest-gamestringer">Czym jest</a> ·
  <a href="#-pobieranie">Pobieranie</a> ·
  <a href="#-jak-to-działa">Jak to działa</a> ·
  <a href="#-prediction-tool-pt">P.T.</a> ·
  <a href="#-wspierane-silniki-gier">Silniki</a> ·
  <a href="#-funkcje">Funkcje</a> ·
  <a href="#-budowanie-ze-źródeł">Build</a>
</p>

<p align="center">
  <strong>🌍 Czytaj w swoim języku:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
  <a href="README_PT.md">🇧🇷 Português</a> ·
  <a href="README_JA.md">🇯🇵 日本語</a> ·
  <a href="README_ZH.md">🇨🇳 中文</a> ·
  <a href="README_KO.md">🇰🇷 한국어</a> ·
  <a href="README_RU.md">🇷🇺 Русский</a> ·
  🇵🇱 Polski
</p>

---

## Demo

<p align="center">
  <img src="docs/demo/demo-library.gif" alt="GameStringer Library Demo" width="720" />
</p>

<p align="center">
  <em>🎮 Biblioteka gier — automatyczne wykrywanie Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 Tłumacz SI — 20+ dostawców, Quality Badges 0-100, Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 Patcher jednego kliknięcia — BepInEx, XUnity, UnrealLocres, Bethesda BSA/BA2, CRI CPK, automatyczna kopia zapasowa</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime, niestandardowe pokoje, obecność online</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — szybkie akcje, status Ollama na żywo, podmenu narzędzi</em>
</p>

---

## 🎮 Czym jest GameStringer?

GameStringer to **aplikacja desktopowa** (Windows i Linux), która pozwala tłumaczyć gry wideo niedostępne w Twoim języku.

Większość gier przechowuje swój tekst w plikach — JSON, XML, CSV, `.locres`, `.rpy`, BSA/BA2, CPK, StringTable z Unity Localization i wielu innych formatach. GameStringer **skanuje folder gry**, znajduje te pliki, wysyła tekst przez wybrany **dostawcę tłumaczenia SI** (OpenAI, Claude, Gemini, DeepSeek, Ollama, 20+ innych) i **wprowadza przetłumaczony tekst** z powrotem do gry. Jedno kliknięcie, bez wiedzy technicznej.

Dla **gier Unity**, które blokują tekst wewnątrz skompilowanych zasobów, GameStringer **automatycznie instaluje BepInEx + XUnity.AutoTranslator** — bez ręcznej konfiguracji. Dla **gier Bethesdy** (Skyrim, Fallout, Starfield) natywnie parsuje BSA/BA2/ESP. Dla **gier z CRI Middleware** (Persona, Yakuza) obsługuje CPK/CRILAYLA/MSG/BMD. Dla **Unreal Engine** edytuje `.locres` bezpośrednio.

**To nie jest strona tłumaczenia maszynowego.** To kompletny potok: **analiza z P.T. → wykrycie silnika → wyodrębnienie tekstu → tłumaczenie SI → kontrola jakości → patch z powrotem → graj.**

---

## 📥 Pobieranie

Pobierz najnowszą wersję z **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Platforma | Plik | Uwagi |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | Instalator (zalecany) |
| **Windows** | `GameStringer-Portable.zip` | Bez instalacji |
| **Linux** | `GameStringer.AppImage` | Uniwersalny (zalecany) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Wymagania:** Windows 10+ lub Linux (Ubuntu 22.04+, Fedora 38+), 4 GB RAM (8 GB+ dla lokalnego SI), 500 MB dysku. Wydania są **podpisane kryptograficznie** i **automatycznie aktualizowane** przez Tauri Updater.

---

## 🚀 Jak to działa

1. **Zainstaluj** GameStringer i uruchom go
2. **Twoja biblioteka gier ładuje się automatycznie** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io (800+ gier wykrywanych w sekundy)
3. **Wybierz grę** → opcjonalnie uruchom **P.T. (Prediction Tool)**, aby zobaczyć trudność, szacowany czas, najlepszy łańcuch LLM
4. Kliknij **„String it!"** — GameStringer automatycznie skanuje, wyodrębnia, tłumaczy i patchuje
5. **Graj w swoim języku** — kopie zapasowe są zawsze tworzone przed patchowaniem

To wszystko. Bez wiersza poleceń, bez ręcznej edycji plików, bez doświadczenia z moddingiem.

---

## 🧠 Prediction Tool (P.T.)

> **Najpotężniejsza funkcja w GameStringer.** Nie rozpoczynaj tłumaczenia na ślepo — najpierw przeanalizuj.

P.T. to silnik głębokiej analizy, który działa *przed* jakimkolwiek tłumaczeniem. Skanuje folder gry, wykrywa silnik, szacuje objętość tekstu do tłumaczenia i mówi Ci:

- **Difficulty Score 0–100** — łączna waga objętości ciągów, złożoności silnika, DRM, kodowania, wyzwań językowych
- **Szacowany czas** na **18 modelach LLM** — Ollama (Gemma 4, Qwen 3, Llama), OpenAI GPT-4/4o, Claude 3.5, Gemini, DeepL, DeepSeek, Groq
- **5 zalecanych łańcuchów LLM**: Local (prywatność), Cloud (jakość), Hybrid (zrównoważony), Budget, Premium — każdy z oceną kosztów i jakości
- **Wykrywanie DRM**: Denuvo, VMProtect, Steam DRM, EAC, BattlEye — ostrzega przed próbą
- **Analiza kodowania**: Shift-JIS, UTF-8, UTF-16, Big5, EUC-KR wykrywane dla każdego pliku
- **Złożoność tłumaczenia**: formy grzecznościowe, zgodność rodzaju, RTL, ruby/furigana, specyficzne traktowanie CJK
- **Ocena pewności** i **plan workflow** — dokładne kroki, które zostaną wykonane po kliknięciu „String it!"
- **Eksport raportu** (JSON + Markdown) do udostępniania lub archiwizacji

### P.T.Rank — Szybki ranking

Po uruchomieniu P.T. na wielu grach otwórz **P.T.Rank**, aby zobaczyć wszystkie przeanalizowane tytuły posortowane według trudności. Idealne do planowania kolejki tłumaczeń: zacznij od łatwych zwycięstw, RPG-i z 800 tys. ciągów zostaw na koniec.

### Dry Run Scanner

Nie chcesz analizować jednej gry na raz? Uruchom **Dry Run** ze strony Biblioteki, aby skanować **całą bibliotekę Steam (800+ gier) wsadowo**, z **zerową modyfikacją plików**. Otrzymasz raport JSON kategoryzujący każdą grę jako **Ready** (silnik wspierany + ciągi do wyodrębnienia), **Errors** (problemy z manifestem / blokada DRM) lub **Unsupported** (nieznany silnik / brak tekstu). Postęp jest w czasie rzeczywistym, a kopia zapasowa nie jest potrzebna, ponieważ niczego się nie dotyka.

### String it! Smart Gate

Przycisk **„String it!"** na stronie szczegółów gry jest inteligentny: jeśli gra została już przeanalizowana przez P.T. w ciągu ostatnich 24h, uruchamia bezpośrednio kreator tłumaczenia. W przeciwnym razie sugeruje uruchomienie P.T. najpierw (z wyborem jednego kliknięcia „Run P.T. first" / „String it! anyway"). Koniec z marnowanymi uruchomieniami na grach, które okazują się zablokowane przez DRM lub sprawami 5-minutowymi.

---

## 🎯 Wspierane silniki gier

GameStringer wspiera **20+ silników** z różnym poziomem głębokości:

| Silnik | Wsparcie | Jak to działa |
|--------|---------|--------------|
| **Unity** | ✅ Pełne | Automatycznie instaluje BepInEx + XUnity.AutoTranslator + potok Unity Localization Package (StringTable, SharedTableData, Addressables, Smart Strings) |
| **Unreal Engine** | ✅ Pełne | Wyodrębnianie i patchowanie `.locres` z UnrealLocres |
| **Unreal _P.pak** | ✅ Pełne | Pakowanie moda jako `<GameStringer>_P.pak` ładowanego przez folder Paks |
| **Godot** | ✅ Pełne | Natywne wsparcie plików `.translation` |
| **RPG Maker** | ✅ Pełne | MV/MZ JSON, VX/Ace przez Trans, XP przez RMXP |
| **Ren'Py** | ✅ Pełne | Natywne parsowanie skryptów `.rpy` z wykrywaniem dialogów |
| **GameMaker** | ⚡ Częściowe | Przez integrację UndertaleModTool |
| **Telltale** | ✅ Pełne | Wsparcie `.langdb` / `.dlog` |
| **Wolf RPG** | ✅ Pełne | Integracja WolfTrans |
| **Kirikiri** | ✅ Pełne | Parsowanie `.ks` / `.scn` |
| **TyranoScript** | ✅ Pełne | Ekstraktor fast-path z patchowaniem JSON |
| **Electron** | ✅ Pełne | Rozpakowywanie ASAR + wykrywanie JSON i18n |
| **Bethesda (Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | Parser BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1), STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware (Persona/Yakuza/Tales of/Dragon Ball)** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTD z auto-wykrywaniem Shift-JIS/UTF-8/UTF-16 |
| **Visionaire Studio** | ✅ Pełne | Przygodówki Daedalic (Deponia, Edna itp.) |
| **Danganronpa WAD** | ✅ Pełne | Parser archiwum WAD + patchowanie dialogów STX |

> **Gry Unity** otrzymują specjalne traktowanie: jeśli nie znaleziono żadnych plików do tłumaczenia, GameStringer wykrywa, że to gra Unity i oferuje **automatyczne zainstalowanie BepInEx + XUnity.AutoTranslator** jednym kliknięciem. Wystarczy uruchomić grę raz po instalacji, następnie ponownie skanować — cały tekst staje się możliwy do tłumaczenia.
>
> ⚠️ **Ostrzeżenie Anti-Cheat**: BepInEx (iniekcja DLL) może wyzwalać systemy anti-cheat (EAC, BattlEye, Vanguard). GameStringer zawiera wykrywanie anti-cheat i ostrzeże Cię. **Używaj tylko w grach single-player / offline.** P.T. wykrywa DRM przed jakąkolwiek modyfikacją.

---

## ✨ Funkcje

### 🆕 Nowości w v1.8.0

- **Live Translation Overlay** — Tłumaczenie gry w czasie rzeczywistym z przezroczystą nakładką OCR
- **Hub Marketplace** — Rynek społecznościowy paczek tłumaczeń z instalacją jednym kliknięciem
- **Translation Memory Network** — Federacyjne współdzielenie tłumaczeń społeczności
- **AI Dubbing Pipeline** — Kompleksowy dubbing głosowy gier (STT → Tłumaczenie → TTS → Patch)
- **Plugin System** — Rozszerzalne przez społeczność wtyczki do patcherów silników gier

### 🤖 Tłumaczenie SI

- **20+ dostawców**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (lokalny), LM Studio, TranslateGemma, HY-MT, Qwen 3, NLLB-200, Cerebras, Together AI, Fireworks, OpenRouter, Cohere, Lingva, MyMemory
- **Context-aware**: rozumie gatunek gry, głos postaci, ton, narrację vs UI vs dialog
- **Translation Memory i glosariusz**: spójność w całym projekcie z automatycznym wyodrębnianiem glosariusza
- **Multi-LLM Compare**: uruchamia wielu dostawców równolegle, wybierz najlepszy wynik dla każdego ciągu
- **Auto-Select Engine** (NEW v1.7.0): preset dynamicznie rankujący dostawców według języka docelowego + gatunku gry
- **Quality gates**: automatyczne ocenianie QA każdego przetłumaczonego ciągu (0-100) z ContentTypeBadge
- **Vision LLM Translator**: używa zrzutów ekranu z gry jako kontekstu (Ollama, Gemini, GPT-4o)
- **Live Quality Preview**: zobacz oceny jakości w czasie rzeczywistym podczas tłumaczenia wsadowego
- **Wsparcie RTL**: automatyczne wykrywanie kierunku i obsługa atrybutu `dir`

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100** z ważonymi czynnikami (objętość, silnik, DRM, kodowanie, złożoność)
- **Szacunki czasu dla 18 modeli LLM**, w tym Gemma 4 (27B MoE A4B / E4B / E2B)
- **5 łańcuchów LLM** (Local / Cloud / Hybrid / Budget / Premium) z szacunkami kosztów i jakości
- **Wykrywanie DRM / Anti-Cheat** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard)
- **Analiza kodowania** dla każdego pliku (Shift-JIS, UTF-8/16, Big5, EUC-KR)
- **Analiza złożoności tłumaczenia** (formy grzecznościowe, rodzaj, CJK, ruby, RTL)
- **P.T.Rank / Quick Ranking** — sortuje wszystkie przeanalizowane gry według trudności
- **Dry Run Scanner** — wsadowe skanowanie całej biblioteki Steam (800+ gier) bez modyfikacji
- **Workflow Orchestrator** — rzeczywisty silnik wykonania z uniwersalnym fast path dla 6+ silników i postępem w czasie rzeczywistym
- **Cache predykcji** (24h) — natychmiastowe ponowne otwieranie wcześniej przeanalizowanych gier
- **Eksport raportu** (JSON + Markdown) do udostępniania i archiwizacji

### 📚 Biblioteka gier

- **Auto-detect**: Steam (z Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **800+ gier** rozpoznawanych z zainstalowanych bibliotek w sekundy
- **Karty gier** z okładkami, metadanymi, odznaką silnika, odznaką VR, statusem instalacji
- **Szybkie akcje przy najechaniu**: String it!, Batch, Community, P.T. — wszystkie jednym kliknięciem
- **Game Update Tracker**: wykrywa, gdy Steam aktualizuje przetłumaczoną grę (przez `buildid`), weryfikuje integralność patcha (pliki BepInEx, obecność `_P.pak`), ostrzega, jeśli wymagane jest ponowne patchowanie
- Przycisk **„Stop monitoring"**, aby zaprzestać śledzenia konkretnej gry

### 🔧 Narzędzia tłumaczeniowe

- **One-Click Translate** („String it!"): skanowanie → tłumaczenie → patch w jednym przepływie
- **Batch Translation**: tłumacz całe gry lub foldery naraz
- **Tłumacz napisów**: SRT, VTT, ASS/SSA z zachowaniem taktowania
- **OCR Translator**: wyodrębnia tekst z gier retro (presety 8-bit, 16-bit, DOS) z prawdziwym backendem Tauri Tesseract
- **Voice Pipeline**: speech-to-text → tłumacz → text-to-speech z **Duration Matching** (NEW v1.7.0) — automatycznie dostosowuje prędkość do długości oryginalnego audio
- **Lip Sync** (NEW v1.7.0): integracja Rhubarb do generowania wizem, eksport dla Unity/Unreal
- **Gridly CSV Export/Import** (NEW v1.7.0): wielojęzyczny format kompatybilny z Gridly/Lokalise/Crowdin
- **Overlay w czasie rzeczywistym**: zobacz tłumaczenia podczas gry przez VR/screen overlay
- **Auto-Translate Review**: przycisk „Translate all untranslated" z paskiem postępu
- **Lore Assistant**: czat RAG, który zna lore i dialogi gry
- **Character Voice Profiles**: zdefiniuj osobowość, ton, wzorce mowy dla każdej postaci
- **Translation Confidence Heatmap**: wizualny przegląd jakości wszystkich tłumaczeń

### 🎮 Patchery silników gier

- **Unity**: auto-instalator BepInEx + XUnity.AutoTranslator, Unity Localization Package (StringTable, SharedTableData, katalog Addressables, walidator Smart Strings)
- **Unreal Engine**: wyodrębnianie `.locres` + pakowanie moda `_P.pak`
- **Bethesda Engine Patcher** (NEW v1.6.0): Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- **CRI Middleware Patcher** (NEW v1.6.0): Persona 5 Royal, Yakuza, Tales of, Dragon Ball — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**, **RPG Maker**, **Godot**, **GameMaker**, **Kirikiri**, **Wolf RPG**, **Telltale**, **Visionaire**, **Danganronpa WAD** — wszystkie z natywnymi parserami
- **Wizard Stepper**: wspólny wieloetapowy UI dla wszystkich patcherów
- **Universal PO Export** (gettext `.po`) dla każdego patchera z metadanymi projektu/języka/źródła/silnika
- **Automatyczna kopia zapasowa**: przed każdym patchem, z przywracaniem jednym kliknięciem

### 🔌 Zaawansowane

- **Auto-Hook Scanner**: skanowanie pamięci procesu (Windows WinAPI) dla ciągów hardcoded
- **System Monitor**: użycie VRAM/RAM w czasie rzeczywistym do planowania lokalnego LLM
- **Ollama Setup Wizard**: krok po kroku instalacja lokalnego SI
- **Ollama Manager**: auto-discovery modeli z rejestru ollama.com + auto-odświeżanie przy fokusie/nawigacji
- **Debug Console**: zintegrowana konsola z przechwytywaniem logów
- **Video Extractor** (v1.7.0): wyodrębnianie i konwertowanie wideo FMV z gier retro/nowoczesnych z upscalingiem SI
- **Plugin System**: dokument projektowy dla wtyczek innych firm (zobacz `PLUGIN_SYSTEM.md`)
- **Community Hub**: udostępniaj i pobieraj Translation Memories + integracja z GitHub Discussions
- **Public API v1**: punkty końcowe REST do integracji (`/api/v1/translate`, `/api/v1/batch`)

### 💬 Community Chat

- **Czat w czasie rzeczywistym** z innymi tłumaczami przez Supabase Realtime
- **4 domyślne pokoje**: General, Translations, Feedback & Bugs, Announcements
- **Niestandardowe pokoje**: twórz pokoje dla konkretnych gier lub projektów
- **Auto-Bridge Auth**: Twój profil GameStringer automatycznie synchronizuje się z Supabase — bez dodatkowego logowania
- **Obecność online**: zobacz, kto jest online w każdym pokoju
- **Odpowiedz / edytuj / usuń** wiadomości z własnością wymuszoną przez RLS
- **Rozszerzalny widget drawer** w prawym dolnym rogu

### ♿ Dostępność (v1.6.0)

- **WCAG 2.1 AA sweep** — `aria-label` na przyciskach ikon, semantyczne nagłówki `CardTitle`, `focus-visible` na wszystkich prymitywach, link skip-to-content, landmark `main`, włoskie helpery `sr-only`
- **`prefers-reduced-motion`** respektowane we wszystkich animacjach
- **`forced-colors`** (tryb wysokiego kontrastu Windows) respektowany
- **UI w 11 językach**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **Wsparcie układu RTL** z automatycznym wykrywaniem kierunku

### 🎨 Design System (v1.6.0)

- **Warianty Card** przez `cva`: default, muted, highlight, success, error, warning
- **Rozmiary Button**, w tym `xs` i `icon-sm`
- **Narzędzia tekstowe**: `text-micro` (9px), `text-2xs` (10px) — koniec z dowolnymi wartościami Tailwind
- **Ujednolicone Radix UI**: zmigrowano 37 plików z `@radix-ui/react-*` do `radix-ui`, usunięto 27 pakietów
- **Zoptymalizowany bundle**: `optimizePackageImports` dla radix-ui, framer-motion, recharts, cmdk

### 🖥️ Aplikacja

- **Podpisane auto-aktualizacje**: aktualizacja jednym kliknięciem z aplikacji przez Tauri Updater
- **Profile**: wiele profili użytkownika z kluczami odzyskiwania
- **Global Hotkeys**: `Ctrl+Shift+T` OCR, `Ctrl+Shift+Q` Quick Translate, `Ctrl+Alt+O` Overlay, `Alt+T` przełącznik XUnity
- **System Tray**: szybkie akcje, status Ollama na żywo, podmenu narzędzi
- **Cross-platform**: Windows i Linux z natywnymi buildami
- **Poprawka tray Windows**: zapobiega pętli błysków konsoli przy spawnie procesów potomnych

---

## 🔧 Dostawcy SI

| Dostawca | Klucz API | Free Tier | Najlepszy do |
|----------|---------|-----------|----------|
| **Ollama** | Nie (lokalny) | ✅ Bez limitu | Prywatność, offline |
| **LM Studio** | Nie (lokalny) | ✅ Bez limitu | Prywatność, modele GGUF |
| **TranslateGemma** | Nie (Ollama) | ✅ Bez limitu — 55 języków, Google | **Zalecany start** |
| **HY-MT1.5** | Nie (Ollama) | ✅ Bez limitu — ~1GB RAM, Tencent | Maszyny z małym RAM |
| **Qwen 3** | Nie (Ollama) | ✅ Bez limitu — wielojęzyczny | Języki CJK |
| **Gemma 4** | Nie (Ollama) | ✅ Bez limitu — 27B MoE A4B/E4B/E2B | Lokalna jakość |
| **Gemini** | Tak | ✅ Free tier (15 RPM) | **Zalecana chmura** |
| **DeepSeek** | Tak | ✅ $0.14/1M input | Tania chmura |
| **Groq** | Tak | ✅ 14 400 zapytań/dzień | Szybkość |
| **Mistral** | Tak | ✅ Free tier | Chmura UE |
| **OpenAI** | Tak | Płatne | Jakość GPT-4o |
| **Claude** | Tak | Płatne | Niuanse, długi kontekst |
| **DeepL** | Tak | ✅ 500k znaków/miesiąc | Języki europejskie |
| **MyMemory** | Nie | ✅ Bez limitu | Fallback |
| **Lingva** | Nie | ✅ Bez limitu | Lustro Google MT |
| **Cerebras** | Tak | ✅ Free tier | Szybkość |
| **Together AI** | Tak | ✅ $25 darmowego kredytu | Modele otwarte |
| **Fireworks** | Tak | ✅ Free tier | Modele otwarte |
| **OpenRouter** | Tak | ✅ Darmowe modele | Różnorodność modeli |
| **NLLB-200** | Tak | ✅ 200 języków | Rzadkie języki |
| **Cohere** | Tak | ✅ Darmowy trial | RAG |

**Zalecane na start**: **TranslateGemma** przez Ollama (darmowe, lokalne, 55 języków) lub **Gemini** (free tier, chmura). Mały RAM: **HY-MT1.5** (~1GB). Najlepsza jakość: **Claude 3.5** lub **GPT-4o**. Najlepsze CJK: **Qwen 3**.

---

## 📖 Dokumentacja

### Przewodniki użytkownika (11 języków)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### Dokumentacja projektu

- **[CHANGELOG.md](CHANGELOG.md)** — pełna historia wersji
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — polityka wersjonowania
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — aktualna roadmapa
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — projekt architektury wtyczek
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ Budowanie ze źródeł

**Wymagania wstępne**: Node.js 18+, Rust 1.70+, npm. W Linuksie także: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # rozwój
npm run tauri:build  # build produkcyjny
```

Backend Rust: `cd src-tauri && cargo check`, aby zweryfikować, że polecenia Tauri kompilują się na Twojej platformie.

---

## 💖 Wsparcie

Jeśli GameStringer pomógł Ci grać w gry w Twoim języku:

<p align="center">
  <a href="https://buymeacoffee.com/gamestringer">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" />
  </a>
  <a href="https://ko-fi.com/gamestringer">
    <img src="https://img.shields.io/badge/Ko--fi-FF5E5B?logo=ko-fi&logoColor=white" alt="Ko-fi" />
  </a>
  <a href="https://github.com/sponsors/rouges78">
    <img src="https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?logo=github-sponsors&logoColor=white" alt="GitHub Sponsors" />
  </a>
</p>

---

## 📜 Licencja

**Source-Available License v1.1** — kod źródłowy jest publiczny i możesz go zbudować samodzielnie, ale nie jest to „Open Source" zatwierdzony przez OSI.

- ✅ Darmowy do użytku osobistego
- ✅ Swobodnie do inspekcji, budowania i modyfikowania dla siebie
- ❌ Użytek komercyjny wymaga pisemnej zgody
- ❌ Redystrybucja zmodyfikowanych wersji wymaga pisemnej zgody

Zobacz [LICENSE](LICENSE) po szczegóły. Pytania? Otwórz [Discussion](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — framework moddingowy Unity (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — framework tłumaczeniowy Unity (bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — parser Unreal `.locres` (akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — modding GameMaker (krzys-h)
- **[Tauri](https://tauri.app)** — framework aplikacji desktopowych
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — silnik OCR
- **[Ollama](https://ollama.com)** — lokalny runtime LLM
- **[Supabase](https://supabase.com)** — backend realtime dla Community Chat

---

<p align="center">
  Stworzone z ❤️ dla graczy, którzy chcą grać w swoim własnym języku<br>
  <strong>GameStringer v1.8.0</strong> · © 2025-2026 GameStringer Team
  <strong>GameStringer v1.7.0</strong> · © 2025-2026 GameStringer Team
</p>
