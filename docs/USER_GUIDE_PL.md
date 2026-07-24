# GameStringer - Kompletny przewodnik

## 🆕 Nowości w v1.15.0

- ⚙️ **Parametry inferencji Ollama**: nowa strona *Ollama Manager → Zaawansowane* z 3 presetami (Wierny/Zrównoważony/Kreatywny) oraz trybem eksperta do regulacji `temperature`, `top_p`, `top_k`, `repeat_penalty`, `num_ctx` i `seed` modeli lokalnych.
- 🚀 **Projekty ↔ Patch Hub**: każdy zaimportowany `.gspack` jest rejestrowany jako ukończony projekt; z Projektów możesz **Zastosować do gry** (z kopią zapasową `.bak`) lub **Opublikować** wstępnie wypełnione tłumaczenie w Patch Hub.
- 💬 **Widget opinii** w *Ustawienia → Społeczność*: zgłaszaj błędy lub pomysły z automatycznie dołączonym kontekstem technicznym (wersja, platforma, ekran).
- ⚡ **Szybszy Patch Hub**: lokalna pamięć podręczna listy i limity antynadużyciowe, dzięki którym przełączasz się między kartami bez ponownego ładowania z serwera za każdym razem.

## 🆕 Nowości w v1.12.0

- 👁️ Tłumaczenie z kontekstem wizualnym (VLM): AI widzi ekran i tłumaczy z kontekstem, rozwiązując wieloznaczne słowa (np. "Chest" = skrzynia lub klatka piersiowa). Lokalnie (Ollama) lub OpenAI/Gemini
- 🪞 Przebieg samokorygujący (Reflection): opcjonalny drugi przebieg sprawdza i dopracowuje tłumaczenie względem glosariusza, tonu i spójności — tylko tam, gdzie trzeba
- 🧠 Pamięć semantyczna (RAG): pamięć tłumaczeń i glosariusz dopasowywane znaczeniowo dzięki lokalnym embeddingom, dla spójnej terminologii w całej grze
- ⚡ Płynniejsze tłumaczenie na żywo i natywne przetwarzanie zrzutów ekranu (przycinanie/skalowanie przed wywołaniem AI)
- 🔌 Więcej dostawców od ręki: DeepL, Groq, Cerebras, Cohere, Together, Fireworks, Hugging Face, Azure Translator, DashScope, LibreTranslate, Lingva, MyMemory
- 🧰 Nowe ustawienia do regulacji reflection, semantycznego RAG i kontekstu wizualnego (jakość vs. szybkość/koszt)

## 🆕 Nowości w v1.11.2

- **Więcej sklepów**: Humble App, Game Jolt i Big Fish Games są teraz wykrywane automatycznie.
- **Wyszukiwanie tłumaczeń**: sprawdza przez PCGamingWiki, czy gra ma już Twój język, oraz linki do wyszukiwania włoskich fanowskich łatek.
- **Publikacja w Patch Hub**: wyślij ukończony projekt do społecznościowego Patch Hub w jednym kroku (Projekty → Opublikuj).
- **Nowe silniki**: pipeline chmurowy dla TyranoScript oraz przepisany parser `.pck`, który czyta prawdziwe archiwa Godot 4.4+.
- **Unity**: lokalny most Ollama dla XUnity (CustomTranslate); pobierania (BepInEx/XUnity/TMP/UABEA) przez API GitHub.

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
20. [Projekty i Patch Hub](#projekty-i-patch-hub) *(ZAKTUALIZOWANO v1.15.0)*
21. [Parametry Inferencji Ollama](#parametry-inferencji-ollama) *(NOWOŚĆ v1.15.0)*
22. [Wyślij Opinię](#wyślij-opinię) *(NOWOŚĆ v1.15.0)*

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

## Nowości v1.9.0

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

## Patch Hub (Społecznościowe paczki tłumaczeń)

Patch Hub to rynek w stylu Steam Workshop służący do udostępniania i pobierania społecznościowych paczek tłumaczeń, obsługiwany przez serwer społeczności GameStringer. Otwórz go z pozycji **Patch Hub** na pasku bocznym (pomarańczowa/bursztynowa sekcja).

### Przeglądanie paczek
Widok główny wyświetla opublikowane paczki z wyszukiwaniem i sortowaniem (najczęściej pobierane, najwyżej oceniane, ostatnio zaktualizowane, ukończenie). Każda karta pokazuje grę, języki źródłowy→docelowy, procent ukończenia, ocenę oraz liczbę pobrań. Kliknij paczkę, aby otworzyć jej stronę szczegółów ze statystykami, opisem, dołączonymi plikami i dziennikiem zmian.

### Pobieranie paczki
Na stronie szczegółów paczki kliknij **Download** (Pobierz). GameStringer pobiera wszystkie pliki paczki z serwera społeczności i zapisuje je lokalnie jako pakiet `.gspack` w Twojej bibliotece paczek (`Documents/GameStringer/packs`). Stamtąd możesz zarządzać paczką i zaimportować ją ze strony szczegółów gry, aby zastosować tłumaczenie.

### Publikowanie paczki
Kliknij **Publish patch** (Opublikuj łatkę), aby otworzyć formularz publikacji. Wypełnij nazwę paczki, grę, język źródłowy i docelowy, opcjonalny opis i tagi oraz dołącz swój plik (pliki) tłumaczenia. Gdy jesteś zalogowany do Community Hub, paczka zostaje przesłana na serwer społeczności i trafia do kolejki moderacji, zanim stanie się publicznie widoczna. Jeśli nie jesteś zalogowany, paczka jest zapisywana jako lokalna wersja robocza — zaloguj się i opublikuj ponownie, aby udostępnić ją online.

> Publikowanie online wymaga konta Community Hub (oddzielnego od Twojego profilu lokalnego). Przeglądanie i pobieranie działają bez konta.

---

## Projekty i Patch Hub

*(ZAKTUALIZOWANO v1.15.0)*

Strona **Projekty** gromadzi w jednym miejscu każdą grę, którą tłumaczysz lub już przetłumaczyłeś — na podstawie Quality Scoring, słowników, Translation Memory i biblioteki gier. Stąd zarządzasz całym cyklem życia tłumaczenia: otwieranie, stosowanie, publikowanie.

### Import `.gspack` → projekt

Gdy **importujesz pakiet `.gspack`** (pobrany z Patch Hub lub utworzony przez Ciebie), GameStringer nie tylko go stosuje: **rejestruje ukończony projekt** i **zapisuje przetłumaczone pliki** lokalnie. Gra pojawia się wtedy w Projektach na 100 %, gotowa do ponownego zastosowania lub opublikowania później bez powtarzania żadnej pracy.

### Zastosuj do gry

Dla **ukończonych** projektów przycisk **"Zastosuj do gry"** (ikona folderu) kopiuje przetłumaczone pliki bezpośrednio do instalacji:

1. Wybierz **folder instalacyjny** gry
2. Przed nadpisaniem istniejącego pliku obok oryginału tworzona jest **kopia zapasowa `.bak`**
3. **Bezpieczeństwo**: jeśli utworzenie kopii zapasowej pliku się nie powiedzie, ten plik jest **pomijany** (nigdy nie nadpisywany bez kopii bezpieczeństwa)
4. Po zakończeniu zobaczysz, ile plików zapisano, a ile pominięto

Aby przywrócić oryginał, po prostu zmień nazwę pliku `.bak`, usuwając rozszerzenie.

### Publikuj (wstępnie wypełnione)

Przycisk **"Opublikuj w Patch Hub"** (ikona udostępniania) wysyła tłumaczenie do społeczności. Publikuje **prawdziwy przetłumaczony plik** (nie tylko manifest metadanych), z nazwą, grą, językami i procentem ukończenia **już wstępnie wypełnionymi**. Paczka trafia do **kolejki moderacji**, zanim stanie się publicznie widoczna.

> Publikowanie wymaga zalogowania do **Community Hub** (konta oddzielnego od Twojego profilu lokalnego).

### Eksploruj / Moje łatki

Strona **Patch Hub** ma dwie karty:

- **Eksploruj** — wszystkie paczki opublikowane przez społeczność, z wyszukiwaniem i sortowaniem (najczęściej pobierane, najwyżej oceniane, ostatnio zaktualizowane, ukończenie)
- **Moje łatki** — tylko paczki opublikowane przez Ciebie za pomocą bieżącego profilu

### Wydajność

Listy Patch Hub używają **lokalnej pamięci podręcznej** (około 60 sekund): przełączanie się między kartami nie ładuje już za każdym razem z serwera. Pamięć podręczna odświeża się automatycznie po publikacji lub pobraniu. Publikowanie i zgłaszanie mają także niewielki **minimalny odstęp** między wysyłkami, aby nie przeciążać współdzielonego serwera.

---

## Parametry Inferencji Ollama

*(NOWOŚĆ v1.15.0)*

Gdy tłumaczysz za pomocą **lokalnego modelu Ollama**, możesz kontrolować, *jak* model generuje tekst. Otwórz stronę z **Ollama Manager → "Zaawansowane"** (ścieżka `/ollama-manager/advanced`).

> Jeśli nic nie zmienisz, pozostają aktywne zalecane wartości domyślne: tłumaczenie zachowuje się dokładnie jak wcześniej. Parametry zaawansowane są wysyłane do Ollama **tylko** wtedy, gdy je ustawisz.

### Presety

Trzy gotowe profile, dostrojone do tłumaczenia gier wideo:

| Preset | Temperature | `num_ctx` | Kiedy używać |
|--------|-------------|-----------|--------------|
| 🎯 **Wierny** | 0.1 | 8192 | Maksymalna wierność tekstowi, mało inwencji. **Zalecany** do tłumaczenia. |
| ⚖️ **Zrównoważony** | 0.3 | 4096 | Kompromis między wiernością a naturalnością. |
| ✨ **Kreatywny** | 0.7 | 4096 | Więcej swobody stylistycznej: do dialogów i wyrazistego tonu. |

### Tryb eksperta

Rozwiń **"Tryb eksperta"**, aby dostroić każdy parametr suwakami:

| Parametr | Efekt |
|----------|-------|
| `temperature` | Losowość generowania. Niska = bardziej deterministyczna i wierna; wysoka = bardziej zróżnicowana i kreatywna. |
| `top_p` | *Nucleus sampling*: bierze pod uwagę tylko najbardziej prawdopodobne tokeny aż do tej masy prawdopodobieństwa. Niższa = bardziej skupiona. |
| `top_k` | Ogranicza wybór do k najbardziej prawdopodobnych tokenów na każdym kroku. Niższa = mniej dygresji. |
| `repeat_penalty` | Zniechęca do powtarzania słów. Powyżej 1.0 redukuje pętle; zbyt wysoka może zniekształcić tekst. |
| `num_ctx` | Okno kontekstu (tokeny trzymane w pamięci). **Szersze = brak obcinania długich tekstów**, ale więcej RAM/VRAM. |
| `seed` *(opcjonalny)* | Ustala ziarno losowe dla **powtarzalnych** wyników (przydatne do benchmarków). Wyłączone = każde uruchomienie może się różnić. |

Edycja dowolnej wartości automatycznie przełącza preset na **"custom"**.

### Kiedy i dlaczego ich używać

- **Wierność vs. kreatywność**: do tłumaczenia preferuj **niską temperaturę** (preset Wierny) — mniej inwencji, więcej wierności. Podnoś ją tylko dla dialogów, w których chcesz bardziej wyrazistego tonu.
- **Długie pliki**: jeśli tłumaczysz długie teksty i zauważasz obcinanie lub utratę kontekstu, zwiększ **`num_ctx`** (kosztem większego RAM/VRAM).
- **Powtarzalność**: włącz **`seed`**, gdy chcesz porównać dwa modele lub ponownie uruchomić to samo tłumaczenie i uzyskać dokładnie ten sam wynik.

### Jak ich używać

1. Otwórz **Ollama Manager** z paska bocznego i kliknij **"Zaawansowane"**
2. Wybierz preset (zacznij od **Wierny** do tłumaczenia) lub otwórz **Tryb eksperta**
3. Dostosuj parametry (np. zwiększ `num_ctx` dla długich plików, włącz `seed` dla powtarzalnych wyników)
4. Kliknij **"Zapisz"** — parametry są przechowywane dla kolejnych tłumaczeń

> **Zakres**: te parametry dotyczą tłumaczeń wykonywanych z **lokalnymi modelami Ollama** (w tym przebiegu *reflection*). Nie wpływają na dostawców webowych (Gemini, Groq itp.).

---

## Wyślij Opinię

*(NOWOŚĆ v1.15.0)*

Możesz zgłosić błąd, zaproponować pomysł lub powiedzieć nam, co myślisz, bezpośrednio z aplikacji, bez opuszczania GameStringer.

### Jak wysłać

1. Przejdź do **Ustawienia → Społeczność** (karta Community Hub)
2. W polu **"Wyślij opinię"** kliknij **"Wyślij opinię"**
3. Wybierz **kategorię** — 🐞 Błąd, 💡 Pomysł lub 💬 Inne
4. Napisz wiadomość i kliknij **"Wyślij"**

### Kontekst dołączany automatycznie

Aby pomóc nam zrozumieć problem, do wiadomości dołączany jest **minimalny kontekst techniczny**:

- **Wersja** aplikacji
- **Platforma** (system operacyjny + Tauri/Web)
- **Ekran**, na którym byłeś (bieżąca ścieżka)
- **Gra** (tylko jeśli pracowałeś nad konkretnym tytułem)

> **Prywatność**: żadnych danych osobowych. Tylko wersja, platforma i bieżący ekran.

### Jeśli backend jest niedostępny

Widget jest **fail-open**: jeśli serwer nie jest skonfigurowany lub jesteś offline, wiadomość nie ginie. Nadal możesz **skopiować raport** do schowka lub wysłać go **e-mailem** jednym kliknięciem — kontekst techniczny jest już zawarty w tekście.

---

## Nowości v1.8.1

### Nakładka tłumaczenia na żywo
- Przejdź do strony **/live-translate** lub naciśnij **Ctrl+Alt+O**
- Wybierz język źródłowy/docelowy i dostawcę AI
- Kliknij **Start** — nakładka pojawi się na grze
- Tekst jest przechwytywany przez OCR co 2 sekundy
- Tłumaczenia wyświetlają się jako przezroczyste pola nakładki
- Wykrywanie różnic pomija niezmieniony tekst (oszczędza wywołania API)

### Rynek Hub
- Przejdź do **Community Hub**, aby przeglądać paczki tłumaczeń
- **Instalacja jednym kliknięciem**: pobierz → zwaliduj → importuj
- Oceniaj i recenzuj paczki społeczności
- Publikuj własne tłumaczenia jako pliki **.gspack**
- Profile użytkowników z reputacją i odznakami

### Sieć pamięci tłumaczeń
- Włącz w **Ustawienia → Sieć TM**
- Opt-in: twoje wysokiej jakości tłumaczenia trafiają do globalnej puli
- Prywatność na pierwszym miejscu: tekst źródłowy zahaszowany, brak udostępniania danych użytkownika
- Następny użytkownik tłumaczący tę samą grę otrzymuje wstępnie wypełnione sugestie
- Automatyczna integracja z potokiem tłumaczenia

### Pipeline dubbingu AI
- Przejdź do strony **/dubbing**
- Wybierz folder gry i skonfiguruj języki/głos
- 7-etapowy pipeline: skanowanie → transkrypcja → tłumaczenie → synteza → łatanie → synchronizacja ust → napisy
- Dopasowanie czasu trwania utrzymuje przetłumaczone audio w tej samej długości co oryginał
- Profile głosowe postaci z 16 archetypami

### System wtyczek
- Społeczność może tworzyć nowe patchery silników gier w JavaScript
- Nie wymaga kompilacji Rust
- Generator szablonów tworzy kompletny szkielet wtyczki
- Wtyczki dystrybuowane jako pakiety **.gsplugin**

---

## Nowości v1.9.0

### Ulepszenia UI Community Hub
- **Przeprojektowany Community Hub**: czystszy i bardziej spójny projekt bez nadmiernych gradientów i dekoracyjnych blobów
- **Kompaktowe KPI Cards**: mniejsze i bardziej stonowane karty statystyczne z minimalnymi kolorami
- **Minimalistyczne Category Cards**: czysty projekt bez ciężkich gradientów i cieni
- **Ujednolicone Trending Cards**: spójny styl we wszystkich typach kart

### Kompaktowy pasek boczny przyjaciół
- **Zmniejszona szerokość**: z 72 na 56 (w-56) dla więcej miejsca na ekranie
- **Kompaktowe Friend Cards**: mniejsze avatary (7x7), ciaśniejsze rozmieszczenie
- **Mniejsze sekcje**: nagłówki Online/Offline ze zmniejszonym tekstem
- **Ultra-cienki pasek przewijania**: 4px, niewidoczny domyślnie, pojawia się przy najechaniu

### Ulepszenia stałego czatu
- **Dyskretny przycisk czatu**: elegancki, mały przycisk w prawym dolnym rogu
- **Widoczny na wszystkich stronach**: czat dostępny w całej aplikacji
- **Czystszy projekt**: usunięto nadmierne animacje i dekoracje

### Funkcje społecznościowe Supabase
- **Zgodny schemat**: schemat społeczności Supabase zgodny z oczekiwaniami frontendu (tools/supabase_social_compatible.sql)
- **RLS tymczasowo wyłączony**: dla łatwiejszego debugowania funkcji społecznościowych
- **Naprawa chat participants**: nazwy kolumn poprawione do walidacji UUID

### Poprawki błędów
- **Naprawa pętli czatu**: dodano stan chatAttempted dla zapobiegania nieskończonej pętli w startDirectChat
- **Usunięcie Mock Data**: usunięto nieprawidłowe dane mock UUID (user-123 itp.), powodujące błędy 400
- **Naprawa Ollama IPC**: wszystkie wywołania check_ollama_status IPC zastąpiono bezpośrednim HTTP do localhost:11434
- **Link Stores**: dodano link Stores w sekcji Zasoby paska bocznego
- **Epic Connect**: zmieniony z zepsutego OAuth na modal poświadczeń
- **Test połączenia**: testConnection teraz używa rzeczywistych poleceń Tauri zamiast symulowanego API
- **Naprawa rozłączenia**: dodano usuwanie poświadczeń Epic/Steam w backendzie Tauri
- **Naprawa Presence**: dodano guard sesji w updatePresence dla uniknięcia 400 Bad Request

---

## Nowości w v1.9.0

### 🟢 Ujednolicona Obecność Online

Ujednolicony system obecności łączący Supabase Realtime i bazę danych:

- **Natychmiastowe aktualizacje**: Użytkownicy online pojawiają się w czasie rzeczywistym (Supabase Realtime Presence)
- **Globalny heartbeat**: Status obecności aktualizowany automatycznie co 30 sekund
- **Auto-away**: Jeśli okno nie ma focusu przez 2+ minuty, status zmienia się na "Nieobecny"
- **Auto-online**: Gdy okno odzyskuje focus, status wraca do "Online"
- **Fallback DB**: Jeśli Realtime jest niedostępny, system używa bazy danych jako fallback
- **Zaktualizowany widget**: Widget "Użytkownicy Online" wyświetla nazwy, awatary i wskaźnik Realtime

### 🔔 Powiadomienia System Tray

Natywne powiadomienia OS dla ważnych zdarzeń:

- **💬 Wiadomości Chat**: Powiadomienie OS po otrzymaniu wiadomości w chacie społeczności
- **✅ Tłumaczenia Zakończone**: Powiadomienie gdy tłumaczenie kończy się sukcesem
- **❌ Błędy Tłumaczenia/Systemu**: Powiadomienie o błędach krytycznych (zawsze widoczne)
- **🔄 Aktualizacje Aplikacji**: Powiadomienie gdy dostępna jest aktualizacja GameStringer
- **🎮 Aktualizacje Gier**: Powiadomienie gdy zaktualizowana gra mogła unieważnić patch
- **🟢 Znajomi Online**: Powiadomienie gdy znajomy się loguje
- **📰 Wiadomości**: Powiadomienia o newsach i aktualizacjach społeczności

**Konfiguracja**: Ustawienia → Powiadomienia → Powiadomienia System Tray
- Toggle dla każdego typu powiadomienia
- **Ciche Godziny**: Tłumienie powiadomień w określonych godzinach (np. 23:00-07:00)
- **Przycisk Test**: Wyślij powiadomienie testowe aby zweryfikować działanie
- **Tooltip Tray**: Ikona w trayu wyświetla liczbę nieprzeczytanych powiadomień

### 🛡️ Error Boundaries + Odzyskiwanie po Crashu

Ochrona przed crashami komponentów:

- **WidgetErrorBoundary**: Jeśli widget crashuje, wyświetla kompaktową wiadomość i automatycznie próbuje odzyskać po 5 sekundach (max 3 próby)
- **AppErrorBoundary**: Jeśli cała app crashuje, wyświetla ekran błędu z opcją "Przeładuj App"
- **Auto-recovery**: Widgety przywracane automatycznie bez interwencji użytkownika

### 🌐 Resilience Sieci / Tryb Offline

Elegancka obsługa rozłączeń:

- **Monitor Sieci**: Wykrywa status online/offline + health check Supabase co 30 sekund
- **Pasek Statusu Połączenia**: Czerwony pasek na górze jeśli offline, amber jeśli Supabase down, zielony gdy połączenie odzyskane
- **Retry z Backoff**: Nieudane operacje sieciowe automatycznie ponawiane z wykładniczym backoff (1s, 2s, 4s)
- **Kolejka Offline**: Jeśli jesteś offline, operacje (wiadomości chat, aktualizacje obecności) są kolejkowane i wykonywane po powrocie połączenia
- **"Tryb offline"**: Zmiany będą automatycznie synchronizowane po powrocie połączenia

### 🎙️ Profile Głosowe Postaci (Voice Cloning)

System zachowania "głosu" postaci podczas tłumaczenia:

- **Automatyczna Ekstrakcja**: Analizuje dialogi gry aby zidentyfikować postacie i ich styl językowy
- **16 Dostępnych Tonów**: Formalny, Swobodny, Agresywny, Łagodny, Tajemniczy, Komiczny, Dramatyczny, Stoicki, Sarkastyczny, Mądry, Dziecięcy, Szlachetny, Piracki, Wojskowy, Akademicki, Uliczny
- **5 Poziomów Formalności**: Bardzo formalny → Bardzo nieformalny
- **5 Grup Wiekowych**: Dziecko, Nastolatek, Młody dorosły, Dorosły, Starszy
- **Wzorce Mowy**: Automatyczne rozpoznawanie wzorców (archaiczne słowa, wykrzyknienia, częste pytania)
- **Catchphrases**: Automatyczna identyfikacja powtarzających się wyrażeń postaci
- **Iniekcja w Prompt**: Profile głosowe automatycznie wstrzykiwane w prompt tłumaczenia
- **Profil Domyślny**: Ustaw profil jako fallback dla niezidentyfikowanych postaci

**Jak używać**:
1. Na stronie Auto-Translate, po załadowaniu plików, pojawia się panel "Profile Głosowe Postaci"
2. Kliknij **"Ekstrahuj Automatycznie"** aby przeanalizować dialogi
3. Lub twórz profile ręcznie z **"Nowy Profil"**
4. Profile są automatycznie stosowane podczas tłumaczenia

### 🧠 Infrastruktura Fine-Tuningu

System generowania datasetów treningowych i zarządzania modelami per-gra:

- **Dataset z Korekt**: Generuj dataset JSONL z korekt ludzkich (Adaptive MT)
- **4 Formaty Eksportu**: OpenAI JSONL, Ollama JSONL, Alpaca JSON, ChatML TXT
- **Tylko Zatwierdzone**: Opcja używania tylko zatwierdzonych korekt w datasecie
- **Zarządzanie Modelami**: Rejestruj i zarządzaj modelami fine-tuned per-gra
- **Integracja Ollama**: Sprawdź dostępność Ollama dla lokalnego treningu
- **Statystyki Datasetu**: Liczba przykładów, średnia długość, wynik jakości

**Jak używać**:
1. Przejdź do **Ustawienia → AI → Infrastruktura Fine-Tuningu**
2. Wybierz parę języków i kliknij **"Generuj"**
3. Kliknij **"Eksportuj"** aby pobrać w wybranym formacie
4. Użyj datasetu do fine-tuningu z Ollama lub dostawcami cloud

### ⚡ Code Splitting / Lazy Loading

Optymalizacja czasu startu:

- 8 ciężkich komponentów (Chat, Zadania w tle, Paleta komend itp.) ładowanych tylko gdy potrzebne
- Aplikacja uruchamia się szybciej i używa mniej pamięci

---

GameStringer v1.15.0 - Przewodnik zaktualizowany 24.07.2026