<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>Aplicación de escritorio que traduce videojuegos a cualquier idioma usando IA.</strong><br>
  Elige un juego de tu biblioteca, selecciona un idioma, pulsa traducir — listo.
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
  <a href="#-qué-es-gamestringer">Qué es</a> ·
  <a href="#-descarga">Descarga</a> ·
  <a href="#-cómo-funciona">Cómo funciona</a> ·
  <a href="#-el-prediction-tool-pt">P.T.</a> ·
  <a href="#-motores-de-juego-soportados">Motores</a> ·
  <a href="#-funciones">Funciones</a> ·
  <a href="#-compilar-desde-el-código-fuente">Build</a>
</p>

<p align="center">
  <strong>🌍 Lee en tu idioma:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  🇪🇸 Español ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
  <a href="README_PT.md">🇧🇷 Português</a> ·
  <a href="README_JA.md">🇯🇵 日本語</a> ·
  <a href="README_ZH.md">🇨🇳 中文</a> ·
  <a href="README_KO.md">🇰🇷 한국어</a> ·
  <a href="README_RU.md">🇷🇺 Русский</a> ·
  <a href="README_PL.md">🇵🇱 Polski</a>
</p>

---

## Demo

<p align="center">
  <img src="docs/demo/demo-library.gif" alt="GameStringer Library Demo" width="720" />
</p>

<p align="center">
  <em>🎮 Biblioteca de Juegos — detección automática de Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 Traductor IA — 20+ proveedores, Quality Badges 0-100, Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 Patcher de un clic — BepInEx, XUnity, UnrealLocres, Bethesda BSA/BA2, CRI CPK, copia de seguridad automática</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime, salas personalizadas, presencia en línea</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — acciones rápidas, estado de Ollama en vivo, submenú de herramientas</em>
</p>

---

## 🎮 ¿Qué es GameStringer?

GameStringer es una **aplicación de escritorio** (Windows y Linux) que te permite traducir videojuegos que no están en tu idioma.

La mayoría de los juegos almacenan su texto en archivos — JSON, XML, CSV, `.locres`, `.rpy`, BSA/BA2, CPK, StringTables de Unity Localization y muchos otros formatos. GameStringer **escanea la carpeta del juego**, encuentra esos archivos, envía el texto a través de un **proveedor de traducción IA** de tu elección (OpenAI, Claude, Gemini, DeepSeek, Ollama, 20+ más) y **aplica el texto traducido** al juego. Un clic, sin conocimientos técnicos necesarios.

Para **juegos Unity** que bloquean el texto dentro de assets compilados, GameStringer **instala automáticamente BepInEx + XUnity.AutoTranslator** — sin configuración manual. Para **juegos de Bethesda** (Skyrim, Fallout, Starfield) analiza BSA/BA2/ESP de forma nativa. Para **juegos con CRI Middleware** (Persona, Yakuza) gestiona CPK/CRILAYLA/MSG/BMD. Para **Unreal Engine** edita `.locres` directamente.

**No es un sitio web de traducción automática.** Es una pipeline completa: **analizar con P.T. → detectar motor → extraer texto → traducir con IA → control de calidad → aplicar parche → jugar.**

---

## 📥 Descarga

Obtén la última versión desde **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Plataforma | Archivo | Notas |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | Instalador (recomendado) |
| **Windows** | `GameStringer-Portable.zip` | Sin instalación |
| **Linux** | `GameStringer.AppImage` | Universal (recomendado) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Requisitos:** Windows 10+ o Linux (Ubuntu 22.04+, Fedora 38+), 4 GB de RAM (8 GB+ para IA local), 500 MB de disco. Las versiones están **firmadas digitalmente** y **auto-actualizadas** mediante Tauri Updater.

---

## 🚀 Cómo funciona

1. **Instala** GameStringer y ejecútalo
2. **Tu biblioteca de juegos se carga automáticamente** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io (800+ juegos detectados en segundos)
3. **Elige un juego** → opcionalmente ejecuta **P.T. (Prediction Tool)** para ver dificultad, tiempo estimado, mejor cadena LLM
4. Haz clic en **"String it!"** — GameStringer escanea, extrae, traduce y aplica el parche automáticamente
5. **Juega en tu idioma** — siempre se crean copias de seguridad antes del parcheo

Eso es todo. Sin línea de comandos, sin edición manual de archivos, sin experiencia en modding.

---

## 🧠 El Prediction Tool (P.T.)

> **La función más potente de GameStringer.** No empieces una traducción a ciegas — analiza primero.

P.T. es un motor de análisis profundo que se ejecuta *antes* de cualquier traducción. Escanea la carpeta del juego, detecta el motor, estima el volumen de texto traducible y te dice:

- **Difficulty Score 0–100** — peso combinado de volumen de cadenas, complejidad del motor, DRM, codificación, desafíos lingüísticos
- **Tiempo estimado** en **18 modelos LLM** — Ollama (Gemma 4, Qwen 3, Llama), OpenAI GPT-4/4o, Claude 3.5, Gemini, DeepL, DeepSeek, Groq
- **5 cadenas LLM recomendadas**: Local (privacidad), Cloud (calidad), Hybrid (equilibrada), Budget, Premium — cada una con puntuación de coste y calidad
- **Detección de DRM**: Denuvo, VMProtect, Steam DRM, EAC, BattlEye — te avisa antes de intentarlo
- **Análisis de codificación**: Shift-JIS, UTF-8, UTF-16, Big5, EUC-KR detectados por archivo
- **Complejidad de traducción**: honoríficos, concordancia de género, RTL, ruby/furigana, manejo específico de CJK
- **Puntuación de confianza** y **plan de workflow** — los pasos exactos que se ejecutarán al hacer clic en "String it!"
- **Exportar informe** (JSON + Markdown) para compartir o archivar

### P.T.Rank — Clasificación rápida

Tras ejecutar P.T. en varios juegos, abre **P.T.Rank** para ver todos los títulos analizados ordenados por dificultad. Perfecto para planificar tu cola de traducción: empieza por los fáciles, deja los RPG de 800k cadenas para el final.

### Dry Run Scanner

¿No quieres analizar un juego a la vez? Ejecuta **Dry Run** desde la página de Biblioteca para escanear **toda tu biblioteca de Steam (800+ juegos) en lote**, con **cero modificaciones a los archivos**. Obtienes un informe JSON que categoriza cada juego como **Ready** (motor soportado + cadenas extraíbles), **Errors** (problemas del manifiesto / bloqueo DRM) o **Unsupported** (motor desconocido / sin texto). El progreso es en tiempo real y no se necesita copia de seguridad porque nada se toca.

### String it! Smart Gate

El botón **"String it!"** en la página de detalle del juego es inteligente: si el juego ya ha sido analizado por P.T. en las últimas 24h, lanza directamente el asistente de traducción. Si no, sugiere ejecutar primero P.T. (con elección de un clic "Run P.T. first" / "String it! anyway"). No más ejecuciones desperdiciadas en juegos que resultan estar bloqueados por DRM o ser asuntos de 5 minutos.

---

## 🎯 Motores de juego soportados

GameStringer soporta **20+ motores** con distintos niveles de profundidad:

| Motor | Soporte | Cómo funciona |
|--------|---------|--------------|
| **Unity** | ✅ Completo | Instala automáticamente BepInEx + XUnity.AutoTranslator + pipeline Unity Localization Package (StringTable, SharedTableData, Addressables, Smart Strings) |
| **Unreal Engine** | ✅ Completo | Extracción y parcheo `.locres` con UnrealLocres |
| **Unreal _P.pak** | ✅ Completo | Empaquetado de mod como `<GameStringer>_P.pak` cargado desde la carpeta Paks |
| **Godot** | ✅ Completo | Soporte nativo para archivos `.translation` |
| **RPG Maker** | ✅ Completo | MV/MZ JSON, VX/Ace vía Trans, XP vía RMXP |
| **Ren'Py** | ✅ Completo | Parseo nativo de scripts `.rpy` con detección de diálogos |
| **GameMaker** | ⚡ Parcial | Vía integración UndertaleModTool |
| **Telltale** | ✅ Completo | Soporte `.langdb` / `.dlog` |
| **Wolf RPG** | ✅ Completo | Integración WolfTrans |
| **Kirikiri** | ✅ Completo | Parseo `.ks` / `.scn` |
| **TyranoScript** | ✅ Completo | Extractor fast-path con parcheo JSON |
| **Electron** | ✅ Completo | Desempaquetado ASAR + detección de JSON i18n |
| **Bethesda (Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | Parser BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1), STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware (Persona/Yakuza/Tales of/Dragon Ball)** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTD con auto-detección de Shift-JIS/UTF-8/UTF-16 |
| **Visionaire Studio** | ✅ Completo | Aventuras Daedalic (Deponia, Edna, etc.) |
| **Danganronpa WAD** | ✅ Completo | Parser de archivo WAD + parcheo de diálogos STX |

> **Los juegos Unity** reciben un trato especial: si no se encuentran archivos traducibles, GameStringer detecta que es un juego Unity y ofrece **instalar automáticamente BepInEx + XUnity.AutoTranslator** con un clic. Solo tienes que lanzar el juego una vez tras la instalación, luego volver a escanear — todo el texto pasa a ser traducible.
>
> ⚠️ **Advertencia Anti-Cheat**: BepInEx (inyección de DLL) puede disparar sistemas anti-cheat (EAC, BattlEye, Vanguard). GameStringer incluye detección anti-cheat y te avisará. **Úsalo solo en juegos single-player / offline.** P.T. detecta el DRM antes de cualquier modificación.

---

## ✨ Funciones

### 🆕 Novedades en v1.8.0

- **Live Translation Overlay** — Traducción del juego en tiempo real con overlay OCR transparente
- **Hub Marketplace** — Mercado comunitario de paquetes de traducción con instalación en un clic
- **Translation Memory Network** — Compartición federada de traducciones de la comunidad
- **AI Dubbing Pipeline** — Doblaje de voz de juegos de principio a fin (STT → Traducir → TTS → Parche)
- **Plugin System** — Plugins extensibles por la comunidad para los patchers de motores de juego

### 🤖 Traducción IA

- **20+ proveedores**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (local), LM Studio, TranslateGemma, HY-MT, Qwen 3, NLLB-200, Cerebras, Together AI, Fireworks, OpenRouter, Cohere, Lingva, MyMemory
- **Context-aware**: entiende el género del juego, la voz del personaje, el tono, narrativa vs UI vs diálogo
- **Translation Memory y Glosario**: consistencia en todo el proyecto con extracción automática de glosario
- **Multi-LLM Compare**: ejecuta múltiples proveedores en paralelo, elige el mejor resultado por cadena
- **Auto-Select Engine** (NEW v1.7.0): preset `auto` que clasifica dinámicamente los proveedores por idioma de destino + género del juego (DeepL para europeos, Claude para CJK, boost basado en género)
- **Quality gates**: puntuación QA automática en cada cadena traducida (0-100) con ContentTypeBadge
- **Vision LLM Translator**: usa capturas in-game para contexto (Ollama, Gemini, GPT-4o)
- **Live Quality Preview**: ve las puntuaciones de calidad en tiempo real durante la traducción por lotes
- **Soporte RTL**: detección automática de dirección y manejo del atributo `dir`

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100** con factores ponderados (volumen, motor, DRM, codificación, complejidad)
- **Estimaciones de tiempo para 18 modelos LLM** incluyendo Gemma 4 (27B MoE A4B / E4B / E2B)
- **5 cadenas LLM** (Local / Cloud / Hybrid / Budget / Premium) con estimaciones de coste y calidad
- **Detección de DRM / Anti-Cheat** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard)
- **Análisis de codificación** por archivo (Shift-JIS, UTF-8/16, Big5, EUC-KR)
- **Análisis de complejidad de traducción** (honoríficos, género, CJK, ruby, RTL)
- **P.T.Rank / Quick Ranking** — ordena todos los juegos analizados por dificultad
- **Dry Run Scanner** — escaneo por lotes de toda la biblioteca de Steam (800+ juegos) sin modificación
- **Workflow Orchestrator** — motor de ejecución real con fast path universal para 6+ motores y progreso en tiempo real
- **Caché de predicción** (24h) — reapertura instantánea de juegos ya analizados
- **Exportar informe** (JSON + Markdown) para compartir y archivar

### 📚 Biblioteca de Juegos

- **Auto-detect**: Steam (con Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **800+ juegos** reconocidos desde bibliotecas instaladas en segundos
- **Tarjetas de juego** con carátulas, metadatos, badge de motor, badge VR, estado de instalación
- **Acciones rápidas al pasar el cursor**: String it!, Batch, Community, P.T. — todas a un clic
- **Game Update Tracker**: detecta cuándo Steam actualiza un juego traducido (vía `buildid`), verifica la integridad del parche (archivos BepInEx, presencia de `_P.pak`), avisa si se necesita reparchar
- Botón **"Stop monitoring"** para dejar de rastrear un juego específico

### 🔧 Herramientas de Traducción

- **One-Click Translate** ("String it!"): escanear → traducir → parchear en un solo flujo
- **Batch Translation**: traduce juegos o carpetas enteras a la vez
- **Traductor de Subtítulos**: SRT, VTT, ASS/SSA con preservación de tiempos
- **OCR Translator**: extrae texto de juegos retro (presets 8-bit, 16-bit, DOS) con backend Tauri Tesseract real
- **Voice Pipeline**: speech-to-text → traducir → text-to-speech con **Duration Matching** (NEW v1.7.0) — ajusta automáticamente la velocidad para coincidir con la duración del audio original
- **Lip Sync** (NEW v1.7.0): integración Rhubarb para generación de visemas, exportación para Unity/Unreal
- **Gridly CSV Export/Import** (NEW v1.7.0): formato multi-idioma compatible con Gridly/Lokalise/Crowdin
- **Overlay en tiempo real**: ve traducciones mientras juegas vía VR/screen overlay
- **Auto-Translate Review**: botón "Translate all untranslated" con barra de progreso
- **Lore Assistant**: chat RAG que conoce el lore y los diálogos del juego
- **Character Voice Profiles**: define personalidad, tono, patrones de habla por personaje
- **Translation Confidence Heatmap**: visión general visual de la calidad de todas las traducciones

### 🎮 Patchers de motores de juego

- **Unity**: auto-instalador BepInEx + XUnity.AutoTranslator, Unity Localization Package (StringTable, SharedTableData, catálogo Addressables, validador Smart Strings)
- **Unreal Engine**: extracción `.locres` + empaquetado mod `_P.pak`
- **Bethesda Engine Patcher** (NEW v1.6.0): Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- **CRI Middleware Patcher** (NEW v1.6.0): Persona 5 Royal, Yakuza, Tales of, Dragon Ball — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**, **RPG Maker**, **Godot**, **GameMaker**, **Kirikiri**, **Wolf RPG**, **Telltale**, **Visionaire**, **Danganronpa WAD** — todos con parsers nativos
- **Wizard Stepper**: UI multipaso compartida para todos los patchers
- **Universal PO Export** (gettext `.po`) para cada patcher con metadatos de proyecto/idioma/fuente/motor
- **Copia de seguridad automática**: antes de cada parche, con restauración de un clic

### 🔌 Avanzado

- **Auto-Hook Scanner**: escaneo de memoria de proceso (Windows WinAPI) para cadenas hardcoded
- **System Monitor**: uso de VRAM/RAM en tiempo real para planificar LLM local
- **Ollama Setup Wizard**: instalación paso a paso de IA local
- **Ollama Manager**: auto-discovery de modelos desde el registro de ollama.com + auto-refresh al enfocar/navegar
- **Debug Console**: consola integrada con log intercept
- **Video Extractor** (v1.7.0): extrae y convierte video FMV de juegos retro/modernos con upscaling IA
- **Plugin System**: documento de diseño para plugins de terceros (ver `PLUGIN_SYSTEM.md`)
- **Community Hub**: comparte y descarga translation memories + integración con GitHub Discussions
- **Public API v1**: endpoints REST para integración (`/api/v1/translate`, `/api/v1/batch`)

### 💬 Community Chat

- **Chat en tiempo real** con otros traductores vía Supabase Realtime
- **4 salas por defecto**: General, Translations, Feedback & Bugs, Announcements
- **Salas personalizadas**: crea salas para juegos o proyectos específicos
- **Auto-Bridge Auth**: tu perfil de GameStringer se sincroniza automáticamente con Supabase — sin login extra
- **Presencia en línea**: ve quién está en cada sala
- **Responder / editar / borrar** mensajes con ownership aplicado por RLS
- **Widget drawer expandible** en la esquina inferior derecha

### ♿ Accesibilidad (v1.6.0)

- **WCAG 2.1 AA sweep** — `aria-label` en botones de icono, encabezados semánticos `CardTitle`, `focus-visible` en todas las primitivas, enlace skip-to-content, landmark `main`, helpers `sr-only` en italiano
- **`prefers-reduced-motion`** respetado en todas las animaciones
- **`forced-colors`** (Windows High Contrast Mode) respetado
- **UI en 11 idiomas**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **Soporte de layout RTL** con detección automática de dirección

### 🎨 Design System (v1.6.0)

- **Variantes de Card** vía `cva`: default, muted, highlight, success, error, warning
- **Tamaños de Button** incluyendo `xs` y `icon-sm`
- **Utilidades de texto**: `text-micro` (9px), `text-2xs` (10px) — se acabaron los valores arbitrarios de Tailwind
- **Radix UI unificado**: migrados 37 archivos de `@radix-ui/react-*` a `radix-ui`, 27 paquetes eliminados
- **Bundle optimizado**: `optimizePackageImports` para radix-ui, framer-motion, recharts, cmdk

### 🖥️ App

- **Auto-updates firmados**: actualización de un clic desde la app vía Tauri Updater
- **Perfiles**: múltiples perfiles de usuario con claves de recuperación
- **Global Hotkeys**: `Ctrl+Shift+T` OCR, `Ctrl+Shift+Q` Quick Translate, `Ctrl+Alt+O` Overlay, `Alt+T` toggle XUnity
- **System Tray**: acciones rápidas, estado Ollama en vivo, submenú de herramientas
- **Cross-platform**: Windows y Linux con builds nativos
- **Fix tray Windows**: previene el bucle de flash de consola al spawn de procesos hijos

---

## 🔧 Proveedores de IA

| Proveedor | API Key | Free Tier | Mejor para |
|----------|---------|-----------|----------|
| **Ollama** | No (local) | ✅ Ilimitado | Privacidad, offline |
| **LM Studio** | No (local) | ✅ Ilimitado | Privacidad, modelos GGUF |
| **TranslateGemma** | No (Ollama) | ✅ Ilimitado — 55 idiomas, Google | **Inicio recomendado** |
| **HY-MT1.5** | No (Ollama) | ✅ Ilimitado — ~1GB RAM, Tencent | Máquinas con poca RAM |
| **Qwen 3** | No (Ollama) | ✅ Ilimitado — multilingüe | Idiomas CJK |
| **Gemma 4** | No (Ollama) | ✅ Ilimitado — 27B MoE A4B/E4B/E2B | Calidad local |
| **Gemini** | Sí | ✅ Free tier (15 RPM) | **Cloud recomendado** |
| **DeepSeek** | Sí | ✅ $0.14/1M input | Cloud económico |
| **Groq** | Sí | ✅ 14.400 req/día | Velocidad |
| **Mistral** | Sí | ✅ Free tier | Cloud UE |
| **OpenAI** | Sí | De pago | Calidad GPT-4o |
| **Claude** | Sí | De pago | Matices, contexto largo |
| **DeepL** | Sí | ✅ 500k caracteres/mes | Idiomas europeos |
| **MyMemory** | No | ✅ Ilimitado | Fallback |
| **Lingva** | No | ✅ Ilimitado | Mirror de Google MT |
| **Cerebras** | Sí | ✅ Free tier | Velocidad |
| **Together AI** | Sí | ✅ $25 de crédito gratis | Modelos abiertos |
| **Fireworks** | Sí | ✅ Free tier | Modelos abiertos |
| **OpenRouter** | Sí | ✅ Modelos gratis | Variedad de modelos |
| **NLLB-200** | Sí | ✅ 200 idiomas | Idiomas raros |
| **Cohere** | Sí | ✅ Prueba gratis | RAG |

**Recomendados para empezar**: **TranslateGemma** vía Ollama (gratis, local, 55 idiomas) o **Gemini** (free tier, cloud). Poca RAM: **HY-MT1.5** (~1GB). Mejor calidad: **Claude 3.5** o **GPT-4o**. Mejor CJK: **Qwen 3**.

---

## 📖 Documentación

### Guías de usuario (11 idiomas)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### Documentación del proyecto

- **[CHANGELOG.md](CHANGELOG.md)** — historial completo de versiones
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — política de versionado
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — roadmap actual
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — diseño de arquitectura de plugins
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ Compilar desde el código fuente

**Prerrequisitos**: Node.js 18+, Rust 1.70+, npm. En Linux también: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # desarrollo
npm run tauri:build  # build de producción
```

Backend Rust: `cd src-tauri && cargo check` para verificar que los comandos Tauri compilan en tu plataforma.

---

## 💖 Apoyo

Si GameStringer te ayudó a jugar a juegos en tu idioma:

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

## 📜 Licencia

**Source-Available License v1.1** — el código fuente es público y puedes compilarlo tú mismo, pero no es "Open Source" aprobado por la OSI.

- ✅ Gratuito para uso personal
- ✅ Libre para inspeccionar, compilar y modificar para ti mismo
- ❌ El uso comercial requiere permiso por escrito
- ❌ La redistribución de versiones modificadas requiere permiso por escrito

Consulta [LICENSE](LICENSE) para más detalles. ¿Preguntas? Abre una [Discussion](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — framework de modding para Unity (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — framework de traducción para Unity (bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — parser `.locres` de Unreal (akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — modding GameMaker (krzys-h)
- **[Tauri](https://tauri.app)** — framework para apps de escritorio
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — motor OCR
- **[Ollama](https://ollama.com)** — runtime LLM local
- **[Supabase](https://supabase.com)** — backend realtime para la Community Chat

---

<p align="center">
  Hecho con ❤️ para los gamers que quieren jugar en su propio idioma<br>
  <strong>GameStringer v1.8.0</strong> · © 2025-2026 GameStringer Team
  <strong>GameStringer v1.7.0</strong> · © 2025-2026 GameStringer Team
</p>
