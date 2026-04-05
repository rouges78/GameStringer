# GameStringer - Kompletny przewodnik

## Spis treści

1. [Konfiguracja początkowa](#faza-1-konfiguracja-początkowa)
2. [Połączenie sklepów](#faza-2-połączenie-sklepów)
3. [Biblioteka gier](#faza-3-biblioteka-gier)
4. [Tłumaczenie gry (Auto-Translate)](#faza-4-tłumaczenie-gry)
5. [Patcher Engine](#faza-5-patcher-engine)
6. [Unity CSV Translator](#faza-6-unity-csv-translator)
7. [BepInEx + XUnity](#faza-7-bepinex--xunity)
8. [AI Pipeline Multi-Agent](#faza-8-ai-pipeline)
9. [Tłumacz AI](#faza-9-tłumacz-ai)
10. [Tłumacz OCR i Multi-Engine](#faza-10-tłumacz-ocr)
11. [Tłumacz głosowy](#faza-11-tłumacz-głosowy)
12. [Tłumaczenie wsadowe i offline](#faza-12-tłumaczenie-wsadowe-i-offline)
13. [Danganronpa Patcher](#faza-13-danganronpa-patcher)
14. [Prediction Tool i QA Check](#faza-14-prediction-tool-i-qa-check)
15. [Słownik, TM i Adaptive MT](#faza-15-słownik-tm-i-adaptive-mt)
16. [Zaawansowane narzędzia](#faza-16-zaawansowane-narzędzia)
17. [Bezpieczeństwo i Recovery Key](#faza-17-bezpieczeństwo)
18. [Rozwiązywanie problemów](#faza-18-rozwiązywanie-problemów)
19. [Czat Społeczności (Czas Rzeczywisty)](#faza-19-czat-społeczności) *(NOWOŚĆ v1.5.0)*

---

## FAZA 1: KONFIGURACJA POCZĄTKOWA

### Pierwsze uruchomienie

Uruchom GameStringer. Przy pierwszym uruchomieniu pojawi się ekran tworzenia profilu.

### Tworzenie profilu

- **Nazwa**: wybierz nazwę (np. "Mario Gaming")
- **Awatar**: wybierz kolor/gradient
- **Hasło**: minimum 4 znaki
- Kliknij **"Utwórz profil"** — automatyczna autentykacja

### Interfejs

- **Panel boczny** (lewo): nawigacja między sekcjami
- **Dashboard** (środek): przegląd gier, statystyki, widget AI Engine
- **Ctrl+K**: globalne szybkie wyszukiwanie do dostępu do dowolnej strony

---

## FAZA 2: POŁĄCZENIE SKLEPÓW

### Obsługiwane sklepy

Steam, Epic Games, GOG, Ubisoft Connect, Origin/EA, Battle.net, Itch.io, Rockstar, Amazon Games.

### Konfiguracja Steam (priorytet)

1. Uzyskaj klucz API na https://steamcommunity.com/dev/apikey
2. Znajdź swoje Steam ID64 na https://steamid.io/
3. W GS: **Ustawienia** → wpisz klucz API i Steam ID
4. Profil Steam musi być **Publiczny**

GS wykrywa również gry z **Steam Family Sharing**.

---

## FAZA 3: BIBLIOTEKA GIER

- Panel boczny → **"Biblioteka"** lub Dashboard → **"Aktualizuj bibliotekę"**
- Ładowanie zajmuje 1-2 minuty dla setek gier
- Kliknięcie gry: szczegóły, wykryty silnik, ścieżka, przycisk **"Przetłumacz grę"**

---

## FAZA 4: TŁUMACZENIE GRY

Panel boczny → **"Przetłumacz grę"** (Auto-Translate). Serce GameStringer.

### Przepływ pracy

1. **Wybierz grę** z biblioteki lub ścieżka ręczna
2. **Skanowanie**: wykrywa silnik (Unity, Unreal, Godot, RPG Maker, Ren'Py itp.) i pliki do tłumaczenia
3. **Smart Auto-Select**: rekomenduje najlepszą metodę dla wykrytego silnika
4. **Tłumaczenie AI**: ciągi znaków tłumaczone skonfigurowanym silnikiem AI
5. **Przegląd**: sprawdź, edytuj, zatwierdź
6. **Zastosuj łatkę**: automatyczny backup + zastosowanie

### Smart Auto-Select dla Unity

| Typ | Zalecana metoda | Alternatywa |
|-----|----------------|-------------|
| Unity Mono (bez BepInEx) | Unity CSV Translator | BepInEx + XUnity |
| Unity Mono (BepInEx obecny) | Unity CSV Translator | Tłumaczenie AI przechwyconych ciągów |
| Unity IL2CPP | Unity CSV Translator | Brak (BepInEx niekompatybilny) |

### Wykrywane silniki

Unity (Mono/IL2CPP), Unreal Engine, Godot, RPG Maker, Ren'Py, Source Engine, CryEngine, RE Engine, Frostbite, id Tech, Creation Engine, Construct, AGS, Defold, Love2D.

---

## FAZA 5: PATCHER ENGINE

Panel boczny → **Patcher** → **Patcher Engine**. 5 wyspecjalizowanych patcherów:

- **Unity**: BepInEx + XUnity AutoTranslator dla Mono
- **Unreal Engine**: tłumaczenie plików .locres (UE4/UE5)
- **Godot**: ekstrakcja/tłumaczenie/przepakowanie plików .pck (Godot 3/4)
- **RPG Maker**: tłumaczenie JSON dla MV/MZ (dialogi, przedmioty, umiejętności)
- **Ren'Py**: tłumaczenie plików .rpy (visual novels)

---

## FAZA 6: UNITY CSV TRANSLATOR

**Najlepsza metoda** dla gier Unity (Mono i IL2CPP).

### Jak to działa

1. Skanuje assety Unity (resources.assets itp.)
2. Wyodrębnia tabele CSV lokalizacji
3. Tłumaczy za pomocą AI (Ollama lub chmura)
4. Wstrzykuje tłumaczenia za pomocą **Resize Injection** (zero obcinania)

### Zalety

- Działa ze **wszystkimi** grami Unity (Mono i IL2CPP)
- Zero obcinania dzięki zmianie rozmiaru
- Pełne pokrycie (wszystkie ciągi, nie tylko ekranowe)
- Brak zewnętrznych zależności
- Automatyczny backup (.backup) i przywracanie

---

## FAZA 7: BEPINEX + XUNITY

Dla gier **Unity Mono** — tłumaczenie na żywo podczas rozgrywki.

1. GS wykrywa grę Unity i znajduje exe
2. Kliknij **"Zainstaluj BepInEx + XUnity"**
3. Uruchom grę — XUnity przechwytuje ciągi z ekranu
4. Zamknij i wróć do GS — przetłumacz przechwycone ciągi za pomocą AI

**Ograniczenie**: nie działa z IL2CPP (powoduje crash). Dla IL2CPP użyj Unity CSV Translator.

---

## FAZA 8: AI PIPELINE

Wyszukaj **"AI Pipeline"** za pomocą Ctrl+K. Wieloetapowy system dla wysokiej jakości.

### 6 kroków

Zbieranie → Tłumaczenie → Kontrola QA → Autonaprawa → Recenzja → Ocena

### 3 tryby

- **Quick**: Tłumaczenie + QA (szybki)
- **Balanced**: + Autonaprawa (zalecany)
- **Max Quality**: wszystkie 6 kroków, próg 75, maksymalnie 3 próby

### Multi-Agent

Przypisz różne modele do kroków (np. qwen do tłumaczenia, gemma do recenzji). 4 presety: Default, Speed, Max Quality, Diversified.

### Benchmark

Historia wykonań z oceną, czasem trwania, ms/ciąg. Porównanie presetów.

---

## FAZA 9: TŁUMACZ AI

Panel boczny → **Tłumaczenie** → **Tłumacz AI**.

### Dostawcy

- **Ollama** (lokalny, darmowy), **OpenAI/GPT-4**, **Claude**, **Gemini**, **DeepL**, **Lingva**

### Funkcje

- Tłumaczenie pojedyncze lub wsadowe
- Automatyczne wykrywanie języka źródłowego
- Styl: naturalny, dosłowny, gamingowy
- Zachowanie placeholderów ({0}, %s, \n)
- Integracja ze Słownikiem + Translation Memory + Adaptive MT

---

## FAZA 10: TŁUMACZ OCR

Panel boczny → **Tłumaczenie** → **Tłumacz OCR**.

Tłumaczy tekst z ekranu w czasie rzeczywistym:

- Ręczny zrzut ekranu lub wybrany obszar
- Ciągły Live OCR
- Globalny skrót: **Ctrl+Shift+T**

### OCR Multi-Engine

4 silniki: **OneOCR** (Win11), **PaddleOCR** (CJK), **RapidOCR** (ONNX), **Tesseract** (zapasowy).

- Automatyczne sondowanie aktywnych silników
- Automatyczny łańcuch zapasowy
- Tryb porównania równoległego

---

## FAZA 11: TŁUMACZ GŁOSOWY

Panel boczny → **Tłumaczenie** → **Tłumacz głosowy**.

- Rozpoznawanie mowy w grze
- Audio → przetłumaczony tekst
- Nakładka napisów w czasie rzeczywistym

---

## FAZA 12: TŁUMACZENIE WSADOWE I OFFLINE

### Wsadowe

Panel boczny → **Tłumaczenie** → **Batch**. Tłumaczy całe foldery:

- Obsługuje .txt, .json, .csv, .po, .xml, .rpy, .ini
- Postęp w czasie rzeczywistym dla każdego pliku
- Opcja AI Pipeline dla maksymalnej jakości

### Offline (Ollama)

Panel boczny → **Tłumaczenie** → **Tłumacz offline**.

- W pełni lokalne tłumaczenie z Ollama
- Nie wymaga połączenia z internetem
- Pełna prywatność — dane nie opuszczają twojego PC

---

## FAZA 13: DANGANRONPA PATCHER

Wyszukaj **"Danganronpa"** za pomocą Ctrl+K.

### Funkcje

1. **Zakładka Zastosuj łatkę**: wybierz grę Steam, przeglądaj pliki WAD, zastosuj łatkę
2. **Zakładka WAD Extractor**: wyodrębnianie, wyszukiwanie, filtrowanie i tłumaczenie 35 865 ciągów
3. **Tłumaczenie wsadowe AI**: wybierz ciągi → przetłumacz z AI → eksportuj JSON
4. **Eksport .zip do dystrybucji**: załatany WAD + autoinstalator + instrukcje
5. W grze: Ustawienia → Control Hints → "Keyboard and Mouse"

---

## FAZA 14: PREDICTION TOOL I QA CHECK

### Prediction Tool

Wyszukaj za pomocą Ctrl+K. Analizuje grę przed tłumaczeniem:

- Szacunkowa liczba ciągów i słów
- Szacunkowy koszt według dostawcy (DeepL, OpenAI, lokalny)
- Szacunkowy czas według metody
- Zalecane łańcuchy tłumaczeniowe

### QA Check

Wyszukaj za pomocą Ctrl+K. Kontrola jakości po tłumaczeniu:

- Weryfikacja placeholderów
- Sprawdzanie liczb i wartości
- Weryfikacja długości ciągów
- Sprawdzanie formatu i interpunkcji
- Ocena jakości dla każdego ciągu

---

## FAZA 15: SŁOWNIK, TM I ADAPTIVE MT

### Słownik

Wyszukaj za pomocą Ctrl+K. Niestandardowa terminologia dla gry:

- Dodaj terminy (np. "quest" → "zadanie")
- Kategorie: rozgrywka, UI, postacie, lore
- Automatycznie zintegrowany w tłumaczeniu AI

### Smart Glossary

Automatycznie generuje słownik z analizy plików gry.

### Translation Memory

Dashboard → widget "Wpisy TM". Pamięć tłumaczeń:

- Automatycznie zapisuje każdą przetłumaczoną parę
- Ponownie wykorzystuje wcześniejsze tłumaczenia
- Backend Rust dla wydajności

### Adaptive MT

Uczy się z twoich poprawek:

- Zapisuje: oryginał → AI → poprawka człowieka
- Znajduje podobne poprawki za pomocą podobieństwa trigramów/słów
- Wstrzykuje przykłady few-shot do promptu AI
- Poprawia się z czasem

---

## FAZA 16: ZAAWANSOWANE NARZĘDZIA

### Context Harvester

Skanuje pliki gry i wyodrębnia kontekst dla tłumaczenia AI.

### Edytor tłumaczeń

Zaawansowany edytor do ręcznego przeglądu ciągów z filtrami i wyszukiwaniem.

### Nakładka napisów

Nakładka w grze dla przetłumaczonych napisów w czasie rzeczywistym.

### ROM Patcher

Stosowanie i tworzenie łatek IPS/BPS dla retro tłumaczeń (SNES, GBA itp.).

### Formaty eksportu

Eksportuj tłumaczenia do: PO, XLIFF, CSV, JSON, TMX.

### Community Hub

Udostępniaj tłumaczenia, głosuj, komentuj, pobieraj tłumaczenia społeczności.

---

## FAZA 17: BEZPIECZEŃSTWO

### Recovery Key

Przy tworzeniu profilu generowany jest **Recovery Key** (12 słów mnemonicznych).

- Skopiuj lub pobierz jako .txt
- **Przechowuj w bezpiecznym miejscu!**

### Odzyskiwanie hasła

Ekran logowania → **"Zapomniałeś hasła?"** → wpisz 12 słów → nowe hasło.

---

## FAZA 18: ROZWIĄZYWANIE PROBLEMÓW

### Gra nie znaleziona

- Sprawdź, czy jest zainstalowana i Steam/Epic jest otwarty
- Zaktualizuj bibliotekę i uruchom ponownie GS

### Tłumaczenie nie zastosowane

- Uruchom ponownie grę całkowicie
- Sprawdź uprawnienia do zapisu plików
- Uruchom GS jako administrator

### AI nie odpowiada

- Sprawdź połączenie internetowe (dla dostawców chmurowych)
- Dla Ollama: sprawdź, czy jest uruchomiony (zielona kropka w panelu bocznym)
- Wypróbuj inny silnik

### Gra crashuje po łatce

- Kliknij **"Przywróć backup"** w użytym narzędziu
- Zweryfikuj integralność plików na Steam (PPM → Właściwości → Pliki lokalne)

### Unity IL2CPP + BepInEx = Crash

- GS teraz automatycznie blokuje BepInEx dla IL2CPP
- Zamiast tego użyj Unity CSV Translator

### Ollama wolny lub nie odpowiada

- Panel boczny: zielona kropka = online, czerwona = offline
- Ollama Manager → sprawdź zainstalowane modele
- Zalecane: model 7B dla szybkości, 13B+ dla jakości

---

## FAZA 19: CZAT SPOŁECZNOŚCI

*(NOWOŚĆ v1.5.0)*

Czat w czasie rzeczywistym zintegrowany z Community Hub, oparty na Supabase Realtime.

### Dostęp

1. Przejdź do **Community Hub** z paska bocznego
2. Kliknij zakładkę **Czat** lub ikonę czatu w prawym dolnym rogu
3. Jeśli jesteś zalogowany na swój profil GameStringer, łączysz się **automatycznie**

### Domyślne pokoje

- **Ogólny**: wolny czat społeczności GameStringer
- **Tłumaczenia**: dyskusje o tłumaczeniach, prośby o pomoc, dzielenie się postępami
- **Opinie i błędy**: zgłaszanie błędów i sugestie ulepszeń
- **Ogłoszenia**: oficjalne wiadomości i aktualizacje

### Funkcje

- **Wiadomości w czasie rzeczywistym** przez Supabase Realtime
- **Obecność online**: sprawdź kto jest online
- **Odpowiadanie na wiadomości**: kliknij aby odpowiedzieć
- **Edycja/Usuwanie**: edytuj lub usuwaj swoje wiadomości
- **Tworzenie własnych pokojów**: dedykowane pokoje dla projektów lub gier
- **Auto-login**: automatyczne połączenie przez profil GameStringer

## Nowości v1.6.0

### Patcher Bethesda Engine
- **Obsługiwane gry**: Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield
- **Formaty archiwów**: BSA v103/v104/v105 oraz BA2 (GNRL + DX10)
- **Wtyczki**: parsowanie ESP/ESM z ekstrakcją rekordów do tłumaczenia
- **Zlokalizowane ciągi**: STRINGS, DLSTRINGS, ILSTRINGS

### Patcher CRI Middleware
- **Obsługiwane gry**: Persona 5 Royal, Yakuza, Tales of, Dragon Ball i wszystkie tytuły CRI
- **Archiwa**: CPK z dekompresją CRILAYLA
- **Formaty wiadomości**: MSG, BMD, FTD

### Unity Localization Package
- Pełny potok dla oficjalnego pakietu Unity Localization (Unity 2021.3+)
- StringTable + SharedTableData, Addressables, Smart Strings
- Dedykowany walidator placeholderów i form mnogich

### Uniwersalny eksport PO
- Eksport gettext PO z pełnymi metadanymi z każdego patchera
- Kompatybilny z Poedit, Weblate, Crowdin

### Dostępność WCAG 2.1 AA
- aria-label, semantyczne nagłówki, focus-visible
- Link pomijający, prefers-reduced-motion, Windows High Contrast

### System projektowy i OCR
- Warianty Card przez cva, Button xs/icon-sm
- Prawdziwy backend Tauri Tesseract zamiast zaślepki OCR
- Poprawka: pętla migania konsoli Windows w trybie tray

---

GameStringer v1.6.0 - Przewodnik zaktualizowany 04.04.2026