<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>Настольное приложение, которое переводит видеоигры на любой язык с помощью ИИ.</strong><br>
  Выберите игру из вашей библиотеки, выберите язык, нажмите «перевести» — готово.
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
  <a href="#-что-такое-gamestringer">Что это</a> ·
  <a href="#-загрузка">Загрузка</a> ·
  <a href="#-как-это-работает">Как это работает</a> ·
  <a href="#-prediction-tool-pt">P.T.</a> ·
  <a href="#-поддерживаемые-игровые-движки">Движки</a> ·
  <a href="#-возможности">Возможности</a> ·
  <a href="#-сборка-из-исходников">Сборка</a>
</p>

<p align="center">
  <strong>🌍 Читать на вашем языке:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
  <a href="README_PT.md">🇧🇷 Português</a> ·
  <a href="README_JA.md">🇯🇵 日本語</a> ·
  <a href="README_ZH.md">🇨🇳 中文</a> ·
  <a href="README_KO.md">🇰🇷 한국어</a> ·
  🇷🇺 Русский ·
  <a href="README_PL.md">🇵🇱 Polski</a>
</p>

---

## Демо

<p align="center">
  <img src="docs/demo/demo-library.gif" alt="GameStringer Library Demo" width="720" />
</p>

<p align="center">
  <em>🎮 Библиотека игр — автоматическое обнаружение Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 Переводчик ИИ — 20+ провайдеров, Quality Badges 0-100, Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 Патчер в один клик — BepInEx, XUnity, UnrealLocres, Bethesda BSA/BA2, CRI CPK, автоматическое резервное копирование</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime, пользовательские комнаты, онлайн-присутствие</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — быстрые действия, статус Ollama в реальном времени, подменю инструментов</em>
</p>

---

## 🎮 Что такое GameStringer?

GameStringer — это **настольное приложение** (Windows и Linux), которое позволяет переводить видеоигры, не имеющие вашего языка.

Большинство игр хранят свой текст в файлах — JSON, XML, CSV, `.locres`, `.rpy`, BSA/BA2, CPK, StringTables из Unity Localization и многих других форматах. GameStringer **сканирует папку игры**, находит эти файлы, отправляет текст через **провайдера ИИ-перевода** на ваш выбор (OpenAI, Claude, Gemini, DeepSeek, Ollama и 20+ других) и **применяет патч с переведённым текстом** к игре. Один клик, никаких технических знаний не требуется.

Для **игр на Unity**, которые прячут текст внутри скомпилированных ассетов, GameStringer **автоматически устанавливает BepInEx + XUnity.AutoTranslator** — без ручной настройки. Для **игр Bethesda** (Skyrim, Fallout, Starfield) он нативно парсит BSA/BA2/ESP. Для **игр на CRI Middleware** (Persona, Yakuza) он обрабатывает CPK/CRILAYLA/MSG/BMD. Для **Unreal Engine** он редактирует `.locres` напрямую.

**Это не сайт машинного перевода.** Это полный конвейер: **анализ с P.T. → определение движка → извлечение текста → перевод с ИИ → проверка качества → патч обратно → играйте.**

---

## 📥 Загрузка

Получите последнюю версию из **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Платформа | Файл | Примечания |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | Установщик (рекомендуется) |
| **Windows** | `GameStringer-Portable.zip` | Без установки |
| **Linux** | `GameStringer.AppImage` | Универсальный (рекомендуется) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Требования:** Windows 10+ или Linux (Ubuntu 22.04+, Fedora 38+), 4 ГБ ОЗУ (8 ГБ+ для локального ИИ), 500 МБ дискового пространства. Релизы **подписаны цифровой подписью** и **автоматически обновляются** через Tauri Updater.

---

## 🚀 Как это работает

1. **Установите** GameStringer и запустите его
2. **Ваша игровая библиотека загружается автоматически** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io (800+ игр обнаруживаются за секунды)
3. **Выберите игру** → при желании запустите **P.T. (Prediction Tool)**, чтобы увидеть сложность, расчётное время, лучшую LLM-цепочку
4. Нажмите **«String it!»** — GameStringer автоматически сканирует, извлекает, переводит и применяет патч
5. **Играйте на вашем языке** — резервные копии всегда создаются перед применением патча

Вот и всё. Никакой командной строки, никакого ручного редактирования файлов, никакого опыта моддинга.

---

## 🧠 Prediction Tool (P.T.)

> **Самая мощная функция в GameStringer.** Не начинайте перевод вслепую — сначала проанализируйте.

P.T. — это движок глубокого анализа, который запускается *перед* любым переводом. Он сканирует папку игры, определяет движок, оценивает объём переводимого текста и сообщает вам:

- **Difficulty Score 0–100** — комбинированный вес объёма строк, сложности движка, DRM, кодировки, языковых сложностей
- **Расчётное время** на **18 моделях LLM** — Ollama (Gemma 4, Qwen 3, Llama), OpenAI GPT-4/4o, Claude 3.5, Gemini, DeepL, DeepSeek, Groq
- **5 рекомендуемых LLM-цепочек**: Local (конфиденциальность), Cloud (качество), Hybrid (сбалансированная), Budget, Premium — каждая с оценкой стоимости и качества
- **Обнаружение DRM**: Denuvo, VMProtect, Steam DRM, EAC, BattlEye — предупреждает до попытки
- **Анализ кодировки**: Shift-JIS, UTF-8, UTF-16, Big5, EUC-KR определяются для каждого файла
- **Сложность перевода**: формы вежливости, согласование по роду, RTL, ruby/furigana, обработка специфики CJK
- **Оценка уверенности** и **план workflow** — точные шаги, которые будут выполнены при нажатии «String it!»
- **Экспорт отчёта** (JSON + Markdown) для обмена или архивирования

### P.T.Rank — Быстрый рейтинг

После запуска P.T. на нескольких играх откройте **P.T.Rank**, чтобы увидеть все проанализированные тайтлы, отсортированные по сложности. Идеально для планирования очереди перевода: начните с лёгких побед, оставьте RPG на 800 000 строк напоследок.

### Dry Run Scanner

Не хотите анализировать игры по одной? Запустите **Dry Run** со страницы Библиотеки, чтобы сканировать **всю библиотеку Steam (800+ игр) пакетно**, с **нулевыми изменениями файлов**. Вы получите JSON-отчёт, категоризирующий каждую игру как **Ready** (движок поддерживается + строки извлекаемы), **Errors** (проблемы манифеста / блокировщик DRM) или **Unsupported** (неизвестный движок / нет текста). Прогресс в реальном времени, и резервная копия не нужна, потому что ничто не трогается.

### String it! Smart Gate

Кнопка **«String it!»** на странице деталей игры умная: если игра уже была проанализирована P.T. в последние 24 часа, она напрямую запускает мастер перевода. Иначе она предлагает сначала запустить P.T. (с выбором в один клик «Run P.T. first» / «String it! anyway»). Больше никаких потраченных впустую запусков на играх, которые оказываются заблокированы DRM или делами на 5 минут.

---

## 🎯 Поддерживаемые игровые движки

GameStringer поддерживает **20+ движков** с различными уровнями глубины:

| Движок | Поддержка | Как это работает |
|--------|---------|--------------|
| **Unity** | ✅ Полная | Автоматически устанавливает BepInEx + XUnity.AutoTranslator + конвейер Unity Localization Package (StringTable, SharedTableData, Addressables, Smart Strings) |
| **Unreal Engine** | ✅ Полная | Извлечение и патчинг `.locres` с UnrealLocres |
| **Unreal _P.pak** | ✅ Полная | Упаковка мода как `<GameStringer>_P.pak`, загружаемого через папку Paks |
| **Godot** | ✅ Полная | Нативная поддержка файлов `.translation` |
| **RPG Maker** | ✅ Полная | MV/MZ JSON, VX/Ace через Trans, XP через RMXP |
| **Ren'Py** | ✅ Полная | Нативный парсинг скриптов `.rpy` с обнаружением диалогов |
| **GameMaker** | ⚡ Частичная | Через интеграцию UndertaleModTool |
| **Telltale** | ✅ Полная | Поддержка `.langdb` / `.dlog` |
| **Wolf RPG** | ✅ Полная | Интеграция WolfTrans |
| **Kirikiri** | ✅ Полная | Парсинг `.ks` / `.scn` |
| **TyranoScript** | ✅ Полная | Fast-path экстрактор с JSON-патчингом |
| **Electron** | ✅ Полная | Распаковка ASAR + обнаружение JSON i18n |
| **Bethesda (Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | Парсер BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1), STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware (Persona/Yakuza/Tales of/Dragon Ball)** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTD с автоопределением Shift-JIS/UTF-8/UTF-16 |
| **Visionaire Studio** | ✅ Полная | Приключения Daedalic (Deponia, Edna и др.) |
| **Danganronpa WAD** | ✅ Полная | Парсер архива WAD + патчинг диалогов STX |

> **Игры Unity** получают особое обращение: если переводимых файлов не найдено, GameStringer определяет, что это игра Unity, и предлагает **автоматически установить BepInEx + XUnity.AutoTranslator** в один клик. Просто запустите игру один раз после установки, затем пересканируйте — весь текст становится переводимым.
>
> ⚠️ **Предупреждение об анти-чите**: BepInEx (инъекция DLL) может срабатывать на анти-чит системах (EAC, BattlEye, Vanguard). GameStringer включает обнаружение анти-чита и предупредит вас. **Используйте только на однопользовательских / оффлайн играх.** P.T. обнаруживает DRM перед любой модификацией.

---

## ✨ Возможности

### 🆕 Новое в v1.8.0

- **Live Translation Overlay** — Перевод игры в реальном времени с прозрачным OCR-оверлеем
- **Hub Marketplace** — Маркетплейс сообщества для пакетов переводов с установкой в один клик
- **Translation Memory Network** — Федеративный обмен переводами сообщества
- **AI Dubbing Pipeline** — Полный конвейер озвучки игр (STT → Перевод → TTS → Патч)
- **Plugin System** — Расширяемые сообществом плагины для патчеров игровых движков

### 🤖 ИИ-перевод

- **20+ провайдеров**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (локально), LM Studio, TranslateGemma, HY-MT, Qwen 3, NLLB-200, Cerebras, Together AI, Fireworks, OpenRouter, Cohere, Lingva, MyMemory
- **Context-aware**: понимает жанр игры, голос персонажа, тон, повествование vs UI vs диалог
- **Translation Memory и глоссарий**: согласованность во всём проекте с автоматическим извлечением глоссария
- **Multi-LLM Compare**: запуск нескольких провайдеров параллельно, выбор лучшего результата для каждой строки
- **Auto-Select Engine** (NEW v1.7.0): пресет, который динамически ранжирует провайдеров по целевому языку + жанру игры
- **Quality gates**: автоматическая QA-оценка для каждой переведённой строки (0-100) с ContentTypeBadge
- **Vision LLM Translator**: использует внутриигровые скриншоты для контекста (Ollama, Gemini, GPT-4o)
- **Live Quality Preview**: видите оценки качества в реальном времени во время пакетного перевода
- **Поддержка RTL**: автоматическое определение направления и обработка атрибута `dir`

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100** с взвешенными факторами (объём, движок, DRM, кодировка, сложность)
- **Оценки времени для 18 моделей LLM**, включая Gemma 4 (27B MoE A4B / E4B / E2B)
- **5 LLM-цепочек** (Local / Cloud / Hybrid / Budget / Premium) с оценками стоимости и качества
- **Обнаружение DRM / анти-чита** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard)
- **Анализ кодировки** для каждого файла (Shift-JIS, UTF-8/16, Big5, EUC-KR)
- **Анализ сложности перевода** (формы вежливости, род, CJK, ruby, RTL)
- **P.T.Rank / Quick Ranking** — сортирует все проанализированные игры по сложности
- **Dry Run Scanner** — пакетное сканирование всей библиотеки Steam (800+ игр) без изменений
- **Workflow Orchestrator** — реальный движок выполнения с универсальным fast path для 6+ движков и прогрессом в реальном времени
- **Кэш предсказаний** (24 часа) — мгновенное повторное открытие ранее проанализированных игр
- **Экспорт отчёта** (JSON + Markdown) для обмена и архивирования

### 📚 Игровая библиотека

- **Автоопределение**: Steam (с Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **800+ игр** распознаются из установленных библиотек за секунды
- **Карточки игр** с обложками, метаданными, бейджем движка, VR-бейджем, статусом установки
- **Быстрые действия при наведении**: String it!, Batch, Community, P.T. — все в один клик
- **Game Update Tracker**: обнаруживает, когда Steam обновляет переведённую игру (через `buildid`), проверяет целостность патча (файлы BepInEx, наличие `_P.pak`), предупреждает, если требуется повторное патчирование
- Кнопка **«Stop monitoring»**, чтобы перестать отслеживать конкретную игру

### 🔧 Инструменты перевода

- **One-Click Translate** («String it!»): сканирование → перевод → патч в едином потоке
- **Batch Translation**: переводите целые игры или папки сразу
- **Переводчик субтитров**: SRT, VTT, ASS/SSA с сохранением тайминга
- **OCR Translator**: извлекает текст из ретро-игр (пресеты 8-бит, 16-бит, DOS) с реальным бэкендом Tauri Tesseract
- **Voice Pipeline**: speech-to-text → перевод → text-to-speech с **Duration Matching** (NEW v1.7.0) — автоматически подстраивает скорость под длительность оригинального аудио
- **Lip Sync** (NEW v1.7.0): интеграция Rhubarb для генерации визем, экспорт для Unity/Unreal
- **Gridly CSV Export/Import** (NEW v1.7.0): мультиязычный формат, совместимый с Gridly/Lokalise/Crowdin
- **Оверлей в реальном времени**: видите переводы во время игры через VR/экранный оверлей
- **Auto-Translate Review**: кнопка «Translate all untranslated» с индикатором прогресса
- **Lore Assistant**: RAG-чат, который знает лор и диалоги игры
- **Character Voice Profiles**: определяйте личность, тон, речевые шаблоны для каждого персонажа
- **Translation Confidence Heatmap**: визуальный обзор качества всех переводов

### 🎮 Патчеры игровых движков

- **Unity**: автоустановщик BepInEx + XUnity.AutoTranslator, Unity Localization Package (StringTable, SharedTableData, каталог Addressables, валидатор Smart Strings)
- **Unreal Engine**: извлечение `.locres` + упаковка мода `_P.pak`
- **Bethesda Engine Patcher** (NEW v1.6.0): Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- **CRI Middleware Patcher** (NEW v1.6.0): Persona 5 Royal, Yakuza, Tales of, Dragon Ball — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**, **RPG Maker**, **Godot**, **GameMaker**, **Kirikiri**, **Wolf RPG**, **Telltale**, **Visionaire**, **Danganronpa WAD** — все с нативными парсерами
- **Wizard Stepper**: общий многошаговый UI для всех патчеров
- **Universal PO Export** (gettext `.po`) для каждого патчера с метаданными проекта/языка/источника/движка
- **Автоматическое резервное копирование**: перед каждым патчем, с восстановлением в один клик

### 🔌 Продвинутое

- **Auto-Hook Scanner**: сканирование памяти процесса (Windows WinAPI) для жёстко закодированных строк
- **System Monitor**: использование VRAM/RAM в реальном времени для планирования локальной LLM
- **Ollama Setup Wizard**: пошаговая установка локального ИИ
- **Ollama Manager**: автообнаружение моделей из реестра ollama.com + автообновление при фокусе/навигации
- **Debug Console**: интегрированная консоль с перехватом логов
- **Video Extractor** (v1.7.0): извлечение и конвертация FMV-видео из ретро/современных игр с ИИ-апскейлингом
- **Plugin System**: проектный документ для сторонних плагинов (см. `PLUGIN_SYSTEM.md`)
- **Community Hub**: делитесь и скачивайте Translation Memories + интеграция с GitHub Discussions
- **Public API v1**: REST-эндпоинты для интеграции (`/api/v1/translate`, `/api/v1/batch`)

### 💬 Community Chat

- **Чат в реальном времени** с другими переводчиками через Supabase Realtime
- **4 комнаты по умолчанию**: General, Translations, Feedback & Bugs, Announcements
- **Пользовательские комнаты**: создавайте комнаты для конкретных игр или проектов
- **Auto-Bridge Auth**: ваш профиль GameStringer автоматически синхронизируется с Supabase — без дополнительного входа
- **Онлайн-присутствие**: видите, кто в сети в каждой комнате
- **Ответ / редактирование / удаление** сообщений с ownership, обеспеченным RLS
- **Расширяемый виджет drawer** в правом нижнем углу

### ♿ Доступность (v1.6.0)

- **WCAG 2.1 AA sweep** — `aria-label` на иконочных кнопках, семантические заголовки `CardTitle`, `focus-visible` на всех примитивах, ссылка skip-to-content, landmark `main`, итальянские хелперы `sr-only`
- **`prefers-reduced-motion`** соблюдается во всех анимациях
- **`forced-colors`** (режим высокой контрастности Windows) соблюдается
- **UI на 11 языках**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **Поддержка RTL-макета** с автоматическим определением направления

### 🎨 Design System (v1.6.0)

- **Варианты Card** через `cva`: default, muted, highlight, success, error, warning
- **Размеры Button**, включая `xs` и `icon-sm`
- **Текстовые утилиты**: `text-micro` (9px), `text-2xs` (10px) — больше никаких произвольных значений Tailwind
- **Radix UI унифицирован**: 37 файлов мигрированы с `@radix-ui/react-*` на `radix-ui`, удалены 27 пакетов
- **Оптимизированный бандл**: `optimizePackageImports` для radix-ui, framer-motion, recharts, cmdk

### 🖥️ Приложение

- **Подписанные автообновления**: обновление в один клик из приложения через Tauri Updater
- **Профили**: несколько профилей пользователя с ключами восстановления
- **Global Hotkeys**: `Ctrl+Shift+T` OCR, `Ctrl+Shift+Q` Quick Translate, `Ctrl+Alt+O` Overlay, `Alt+T` переключение XUnity
- **System Tray**: быстрые действия, статус Ollama в реальном времени, подменю инструментов
- **Кроссплатформенность**: Windows и Linux с нативными сборками
- **Исправление трея Windows**: предотвращает цикл вспышек консоли при запуске дочерних процессов

---

## 🔧 Провайдеры ИИ

| Провайдер | API-ключ | Free Tier | Лучше всего для |
|----------|---------|-----------|----------|
| **Ollama** | Нет (локально) | ✅ Без ограничений | Конфиденциальность, оффлайн |
| **LM Studio** | Нет (локально) | ✅ Без ограничений | Конфиденциальность, GGUF-модели |
| **TranslateGemma** | Нет (Ollama) | ✅ Без ограничений — 55 языков, Google | **Рекомендуемый старт** |
| **HY-MT1.5** | Нет (Ollama) | ✅ Без ограничений — ~1 ГБ ОЗУ, Tencent | Машины с малым ОЗУ |
| **Qwen 3** | Нет (Ollama) | ✅ Без ограничений — многоязычный | Языки CJK |
| **Gemma 4** | Нет (Ollama) | ✅ Без ограничений — 27B MoE A4B/E4B/E2B | Локальное качество |
| **Gemini** | Да | ✅ Free tier (15 RPM) | **Рекомендуемый облачный** |
| **DeepSeek** | Да | ✅ $0.14/1M input | Бюджетное облако |
| **Groq** | Да | ✅ 14 400 запросов/день | Скорость |
| **Mistral** | Да | ✅ Free tier | Облако ЕС |
| **OpenAI** | Да | Платный | Качество GPT-4o |
| **Claude** | Да | Платный | Нюансы, длинный контекст |
| **DeepL** | Да | ✅ 500k символов/месяц | Европейские языки |
| **MyMemory** | Нет | ✅ Без ограничений | Fallback |
| **Lingva** | Нет | ✅ Без ограничений | Зеркало Google MT |
| **Cerebras** | Да | ✅ Free tier | Скорость |
| **Together AI** | Да | ✅ $25 бесплатного кредита | Открытые модели |
| **Fireworks** | Да | ✅ Free tier | Открытые модели |
| **OpenRouter** | Да | ✅ Бесплатные модели | Разнообразие моделей |
| **NLLB-200** | Да | ✅ 200 языков | Редкие языки |
| **Cohere** | Да | ✅ Бесплатный пробный | RAG |

**Рекомендуется для начала**: **TranslateGemma** через Ollama (бесплатно, локально, 55 языков) или **Gemini** (free tier, облако). Мало ОЗУ: **HY-MT1.5** (~1 ГБ). Лучшее качество: **Claude 3.5** или **GPT-4o**. Лучший CJK: **Qwen 3**.

---

## 📖 Документация

### Руководства пользователя (11 языков)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### Документация проекта

- **[CHANGELOG.md](CHANGELOG.md)** — полная история версий
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — политика версионирования
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — текущая дорожная карта
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — проектирование архитектуры плагинов
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ Сборка из исходников

**Предварительные требования**: Node.js 18+, Rust 1.70+, npm. В Linux также: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # разработка
npm run tauri:build  # production-сборка
```

Rust-бэкенд: `cd src-tauri && cargo check`, чтобы проверить, что команды Tauri компилируются на вашей платформе.

---

## 💖 Поддержка

Если GameStringer помог вам играть в игры на вашем языке:

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

## 📜 Лицензия

**Source-Available License v1.1** — исходный код открыт, и вы можете собрать его самостоятельно, но это не «Open Source», одобренный OSI.

- ✅ Бесплатно для личного использования
- ✅ Свободно для проверки, сборки и модификации для себя
- ❌ Коммерческое использование требует письменного разрешения
- ❌ Распространение модифицированных версий требует письменного разрешения

См. [LICENSE](LICENSE) для деталей. Вопросы? Откройте [Discussion](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — фреймворк моддинга Unity (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — фреймворк перевода Unity (bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — парсер Unreal `.locres` (akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — моддинг GameMaker (krzys-h)
- **[Tauri](https://tauri.app)** — фреймворк для настольных приложений
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — OCR-движок
- **[Ollama](https://ollama.com)** — локальный LLM-runtime
- **[Supabase](https://supabase.com)** — realtime-бэкенд для Community Chat

---

<p align="center">
  Сделано с ❤️ для геймеров, которые хотят играть на своём родном языке<br>
  <strong>GameStringer v1.8.0</strong> · © 2025-2026 GameStringer Team
  <strong>GameStringer v1.7.0</strong> · © 2025-2026 GameStringer Team
</p>
