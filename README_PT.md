<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>Aplicativo de desktop que traduz videogames para qualquer idioma usando IA.</strong><br>
  Escolha um jogo da sua biblioteca, selecione um idioma, clique em traduzir — pronto.
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
  <a href="#-o-que-é-o-gamestringer">O que é</a> ·
  <a href="#-download">Download</a> ·
  <a href="#-como-funciona">Como funciona</a> ·
  <a href="#-o-prediction-tool-pt">P.T.</a> ·
  <a href="#-motores-de-jogo-suportados">Motores</a> ·
  <a href="#-recursos">Recursos</a> ·
  <a href="#-compilar-a-partir-do-código-fonte">Build</a>
</p>

<p align="center">
  <strong>🌍 Leia no seu idioma:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
  🇧🇷 Português ·
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
  <em>🎮 Biblioteca de Jogos — detecção automática de Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 Tradutor IA — 20+ provedores, Quality Badges 0-100, Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 Patcher de um clique — BepInEx, XUnity, UnrealLocres, Bethesda BSA/BA2, CRI CPK, backup automático</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime, salas personalizadas, presença online</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — ações rápidas, status do Ollama ao vivo, submenu de ferramentas</em>
</p>

---

## 🎮 O que é o GameStringer?

GameStringer é um **aplicativo de desktop** (Windows e Linux) que permite traduzir videogames que não têm o seu idioma.

A maioria dos jogos armazena seu texto em arquivos — JSON, XML, CSV, `.locres`, `.rpy`, BSA/BA2, CPK, StringTables do Unity Localization e muitos outros formatos. O GameStringer **escaneia a pasta do jogo**, encontra esses arquivos, envia o texto por um **provedor de tradução de IA** de sua escolha (OpenAI, Claude, Gemini, DeepSeek, Ollama, 20+ outros) e **aplica o texto traduzido** de volta no jogo. Um clique, sem necessidade de conhecimento técnico.

Para **jogos Unity** que prendem o texto em assets compilados, o GameStringer **instala automaticamente o BepInEx + XUnity.AutoTranslator** — sem configuração manual. Para **jogos da Bethesda** (Skyrim, Fallout, Starfield), ele faz parsing nativo de BSA/BA2/ESP. Para **jogos com CRI Middleware** (Persona, Yakuza), lida com CPK/CRILAYLA/MSG/BMD. Para **Unreal Engine**, edita `.locres` diretamente.

**Não é um site de tradução automática.** É um pipeline completo: **analisar com P.T. → detectar motor → extrair texto → traduzir com IA → checar qualidade → aplicar patch → jogar.**

---

## 📥 Download

Obtenha a última versão em **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**:

| Plataforma | Arquivo | Observações |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | Instalador (recomendado) |
| **Windows** | `GameStringer-Portable.zip` | Sem instalação |
| **Linux** | `GameStringer.AppImage` | Universal (recomendado) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**Requisitos:** Windows 10+ ou Linux (Ubuntu 22.04+, Fedora 38+), 4 GB de RAM (8 GB+ para IA local), 500 MB de disco. As releases são **assinadas digitalmente** e **atualizadas automaticamente** via Tauri Updater.

---

## 🚀 Como funciona

1. **Instale** o GameStringer e inicie
2. **Sua biblioteca de jogos carrega automaticamente** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io (800+ jogos detectados em segundos)
3. **Escolha um jogo** → opcionalmente execute o **P.T. (Prediction Tool)** para ver dificuldade, tempo estimado, melhor cadeia LLM
4. Clique em **"String it!"** — o GameStringer escaneia, extrai, traduz e aplica o patch automaticamente
5. **Jogue no seu idioma** — backups são sempre criados antes de aplicar o patch

É só isso. Sem linha de comando, sem edição manual de arquivos, sem experiência em modding.

---

## 🧠 O Prediction Tool (P.T.)

> **O recurso mais poderoso do GameStringer.** Não comece uma tradução às cegas — analise primeiro.

P.T. é um motor de análise profunda que roda *antes* de qualquer tradução. Ele escaneia a pasta do jogo, detecta o motor, estima o volume de texto traduzível e diz:

- **Difficulty Score 0–100** — peso combinado de volume de strings, complexidade do motor, DRM, codificação, desafios linguísticos
- **Tempo estimado** em **18 modelos LLM** — Ollama (Gemma 4, Qwen 3, Llama), OpenAI GPT-4/4o, Claude 3.5, Gemini, DeepL, DeepSeek, Groq
- **5 cadeias LLM recomendadas**: Local (privacidade), Cloud (qualidade), Hybrid (equilibrada), Budget, Premium — cada uma com pontuação de custo e qualidade
- **Detecção de DRM**: Denuvo, VMProtect, Steam DRM, EAC, BattlEye — avisa antes de tentar
- **Análise de codificação**: Shift-JIS, UTF-8, UTF-16, Big5, EUC-KR detectados por arquivo
- **Complexidade de tradução**: honoríficos, concordância de gênero, RTL, ruby/furigana, tratamento específico de CJK
- **Pontuação de confiança** e **plano de workflow** — os passos exatos que serão executados ao clicar em "String it!"
- **Exportar relatório** (JSON + Markdown) para compartilhar ou arquivar

### P.T.Rank — Ranking Rápido

Após executar o P.T. em vários jogos, abra o **P.T.Rank** para ver todos os títulos analisados ordenados por dificuldade. Perfeito para planejar sua fila de tradução: comece pelos fáceis, deixe os RPGs de 800k strings para o final.

### Dry Run Scanner

Não quer analisar um jogo de cada vez? Execute **Dry Run** na página da Biblioteca para escanear **sua biblioteca Steam inteira (800+ jogos) em lote**, com **zero modificação de arquivos**. Você recebe um relatório JSON que categoriza cada jogo como **Ready** (motor suportado + strings extraíveis), **Errors** (problemas de manifest / bloqueio de DRM) ou **Unsupported** (motor desconhecido / sem texto). O progresso é em tempo real e nenhum backup é necessário porque nada é tocado.

### String it! Smart Gate

O botão **"String it!"** na página de detalhes do jogo é inteligente: se o jogo já foi analisado pelo P.T. nas últimas 24h, ele inicia o wizard de tradução diretamente. Caso contrário, sugere executar o P.T. primeiro (com escolha de um clique "Run P.T. first" / "String it! anyway"). Chega de execuções desperdiçadas em jogos que acabam sendo bloqueados por DRM ou questão de 5 minutos.

---

## 🎯 Motores de jogo suportados

O GameStringer suporta **20+ motores** com diferentes níveis de profundidade:

| Motor | Suporte | Como funciona |
|--------|---------|--------------|
| **Unity** | ✅ Completo | Instala automaticamente BepInEx + XUnity.AutoTranslator + pipeline Unity Localization Package (StringTable, SharedTableData, Addressables, Smart Strings) |
| **Unreal Engine** | ✅ Completo | Extração e patch de `.locres` com UnrealLocres |
| **Unreal _P.pak** | ✅ Completo | Empacotamento de mod como `<GameStringer>_P.pak` carregado via pasta Paks |
| **Godot** | ✅ Completo | Suporte nativo a arquivos `.translation` |
| **RPG Maker** | ✅ Completo | MV/MZ JSON, VX/Ace via Trans, XP via RMXP |
| **Ren'Py** | ✅ Completo | Parsing nativo de scripts `.rpy` com detecção de diálogos |
| **GameMaker** | ⚡ Parcial | Via integração UndertaleModTool |
| **Telltale** | ✅ Completo | Suporte `.langdb` / `.dlog` |
| **Wolf RPG** | ✅ Completo | Integração WolfTrans |
| **Kirikiri** | ✅ Completo | Parsing `.ks` / `.scn` |
| **TyranoScript** | ✅ Completo | Extrator fast-path com patch JSON |
| **Electron** | ✅ Completo | Desempacotamento ASAR + detecção de JSON i18n |
| **Bethesda (Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | Parser BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1), STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware (Persona/Yakuza/Tales of/Dragon Ball)** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTD com autodetecção de Shift-JIS/UTF-8/UTF-16 |
| **Visionaire Studio** | ✅ Completo | Aventuras Daedalic (Deponia, Edna, etc.) |
| **Danganronpa WAD** | ✅ Completo | Parser de arquivo WAD + patch de diálogos STX |

> **Jogos Unity** recebem tratamento especial: se nenhum arquivo traduzível for encontrado, o GameStringer detecta que é um jogo Unity e oferece **instalar automaticamente BepInEx + XUnity.AutoTranslator** com um clique. Basta iniciar o jogo uma vez após a instalação, depois escanear novamente — todo o texto se torna traduzível.
>
> ⚠️ **Aviso Anti-Cheat**: BepInEx (injeção de DLL) pode acionar sistemas anti-cheat (EAC, BattlEye, Vanguard). O GameStringer inclui detecção anti-cheat e irá avisá-lo. **Use apenas em jogos single-player / offline.** O P.T. detecta DRM antes de qualquer modificação.

---

## ✨ Recursos

### 🆕 Novidades na v1.8.0

- **Live Translation Overlay** — Tradução do jogo em tempo real com overlay OCR transparente
- **Hub Marketplace** — Marketplace comunitário de pacotes de tradução com instalação em um clique
- **Translation Memory Network** — Compartilhamento federado de traduções da comunidade
- **AI Dubbing Pipeline** — Dublagem de voz completa para jogos (STT → Traduzir → TTS → Patch)
- **Plugin System** — Plugins extensíveis pela comunidade para os patchers de motores de jogo

### 🤖 Tradução por IA

- **20+ provedores**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (local), LM Studio, TranslateGemma, HY-MT, Qwen 3, NLLB-200, Cerebras, Together AI, Fireworks, OpenRouter, Cohere, Lingva, MyMemory
- **Context-aware**: entende o gênero do jogo, a voz do personagem, o tom, narrativa vs UI vs diálogo
- **Translation Memory e Glossário**: consistência em todo o projeto com extração automática de glossário
- **Multi-LLM Compare**: executa múltiplos provedores em paralelo, escolha o melhor resultado por string
- **Auto-Select Engine** (NEW v1.7.0): preset `auto` que classifica dinamicamente os provedores por idioma de destino + gênero do jogo (DeepL para europeus, Claude para CJK, boost baseado no gênero)
- **Quality gates**: pontuação QA automática em cada string traduzida (0-100) com ContentTypeBadge
- **Vision LLM Translator**: usa capturas de tela in-game para contexto (Ollama, Gemini, GPT-4o)
- **Live Quality Preview**: veja pontuações de qualidade em tempo real durante a tradução em lote
- **Suporte RTL**: detecção automática de direção e manipulação do atributo `dir`

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100** com fatores ponderados (volume, motor, DRM, codificação, complexidade)
- **Estimativas de tempo para 18 modelos LLM** incluindo Gemma 4 (27B MoE A4B / E4B / E2B)
- **5 cadeias LLM** (Local / Cloud / Hybrid / Budget / Premium) com estimativas de custo e qualidade
- **Detecção DRM / Anti-Cheat** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard)
- **Análise de codificação** por arquivo (Shift-JIS, UTF-8/16, Big5, EUC-KR)
- **Análise de complexidade de tradução** (honoríficos, gênero, CJK, ruby, RTL)
- **P.T.Rank / Quick Ranking** — ordena todos os jogos analisados por dificuldade
- **Dry Run Scanner** — scan em lote da biblioteca Steam inteira (800+ jogos) sem modificação
- **Workflow Orchestrator** — motor de execução real com fast path universal para 6+ motores e progresso em tempo real
- **Cache de predição** (24h) — reabertura instantânea de jogos já analisados
- **Exportar relatório** (JSON + Markdown) para compartilhar e arquivar

### 📚 Biblioteca de Jogos

- **Auto-detect**: Steam (com Family Sharing), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- **800+ jogos** reconhecidos das bibliotecas instaladas em segundos
- **Cards de jogos** com capas, metadados, badge do motor, badge VR, status de instalação
- **Ações rápidas ao passar o mouse**: String it!, Batch, Community, P.T. — todas com um clique
- **Game Update Tracker**: detecta quando a Steam atualiza um jogo traduzido (via `buildid`), verifica a integridade do patch (arquivos BepInEx, presença de `_P.pak`), avisa se é necessário reaplicar o patch
- Botão **"Stop monitoring"** para parar de monitorar um jogo específico

### 🔧 Ferramentas de Tradução

- **One-Click Translate** ("String it!"): escanear → traduzir → aplicar patch em um único fluxo
- **Batch Translation**: traduza jogos ou pastas inteiras de uma vez
- **Tradutor de Legendas**: SRT, VTT, ASS/SSA com preservação do timing
- **OCR Translator**: extrai texto de jogos retrô (presets 8-bit, 16-bit, DOS) com backend real Tauri Tesseract
- **Voice Pipeline**: speech-to-text → traduzir → text-to-speech com **Duration Matching** (NEW v1.7.0) — ajusta automaticamente a velocidade para corresponder à duração do áudio original
- **Lip Sync** (NEW v1.7.0): integração Rhubarb para geração de visemas, exportação para Unity/Unreal
- **Gridly CSV Export/Import** (NEW v1.7.0): formato multi-idioma compatível com Gridly/Lokalise/Crowdin
- **Overlay em tempo real**: veja as traduções enquanto joga via VR/screen overlay
- **Auto-Translate Review**: botão "Translate all untranslated" com barra de progresso
- **Lore Assistant**: chat RAG que conhece o lore e os diálogos do jogo
- **Character Voice Profiles**: defina personalidade, tom, padrões de fala por personagem
- **Translation Confidence Heatmap**: visão geral visual da qualidade de todas as traduções

### 🎮 Patchers de Motores de Jogo

- **Unity**: auto-instalador BepInEx + XUnity.AutoTranslator, Unity Localization Package (StringTable, SharedTableData, catálogo Addressables, validador Smart Strings)
- **Unreal Engine**: extração `.locres` + empacotamento de mod `_P.pak`
- **Bethesda Engine Patcher** (NEW v1.6.0): Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- **CRI Middleware Patcher** (NEW v1.6.0): Persona 5 Royal, Yakuza, Tales of, Dragon Ball — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**, **RPG Maker**, **Godot**, **GameMaker**, **Kirikiri**, **Wolf RPG**, **Telltale**, **Visionaire**, **Danganronpa WAD** — todos com parsers nativos
- **Wizard Stepper**: UI multi-step compartilhada para todos os patchers
- **Universal PO Export** (gettext `.po`) para cada patcher com metadados de projeto/idioma/fonte/motor
- **Backup automático**: antes de cada patch, com restauração em um clique

### 🔌 Avançado

- **Auto-Hook Scanner**: escaneamento de memória de processo (Windows WinAPI) para strings hardcoded
- **System Monitor**: uso VRAM/RAM em tempo real para planejamento de LLM local
- **Ollama Setup Wizard**: instalação passo a passo de IA local
- **Ollama Manager**: auto-discovery de modelos do registro ollama.com + auto-refresh em foco/navegação
- **Debug Console**: console integrado com log intercept
- **Video Extractor** (v1.7.0): extraia e converta vídeo FMV de jogos retrô/modernos com upscaling por IA
- **Plugin System**: doc de design para plugins de terceiros (veja `PLUGIN_SYSTEM.md`)
- **Community Hub**: compartilhe e baixe translation memories + integração com GitHub Discussions
- **Public API v1**: endpoints REST para integração (`/api/v1/translate`, `/api/v1/batch`)

### 💬 Community Chat

- **Chat em tempo real** com outros tradutores via Supabase Realtime
- **4 salas padrão**: General, Translations, Feedback & Bugs, Announcements
- **Salas personalizadas**: crie salas para jogos ou projetos específicos
- **Auto-Bridge Auth**: seu perfil do GameStringer sincroniza automaticamente com o Supabase — sem login extra
- **Presença online**: veja quem está online em cada sala
- **Responder / editar / excluir** mensagens com ownership aplicada via RLS
- **Widget drawer expansível** no canto inferior direito

### ♿ Acessibilidade (v1.6.0)

- **WCAG 2.1 AA sweep** — `aria-label` em botões de ícone, headings semânticos `CardTitle`, `focus-visible` em todas as primitivas, link skip-to-content, landmark `main`, helpers `sr-only` em italiano
- **`prefers-reduced-motion`** respeitado em todas as animações
- **`forced-colors`** (Modo de Alto Contraste do Windows) respeitado
- **UI em 11 idiomas**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- **Suporte a layout RTL** com detecção automática de direção

### 🎨 Design System (v1.6.0)

- **Variantes de Card** via `cva`: default, muted, highlight, success, error, warning
- **Tamanhos de Button** incluindo `xs` e `icon-sm`
- **Utilitários de texto**: `text-micro` (9px), `text-2xs` (10px) — acabou o Tailwind arbitrário
- **Radix UI unificado**: migrados 37 arquivos de `@radix-ui/react-*` para `radix-ui`, 27 pacotes removidos
- **Bundle otimizado**: `optimizePackageImports` para radix-ui, framer-motion, recharts, cmdk

### 🖥️ App

- **Auto-atualizações assinadas**: atualização em um clique dentro do app via Tauri Updater
- **Perfis**: múltiplos perfis de usuário com chaves de recuperação
- **Global Hotkeys**: `Ctrl+Shift+T` OCR, `Ctrl+Shift+Q` Quick Translate, `Ctrl+Alt+O` Overlay, `Alt+T` toggle XUnity
- **System Tray**: ações rápidas, status do Ollama ao vivo, submenu de ferramentas
- **Cross-platform**: Windows e Linux com builds nativos
- **Correção de tray Windows**: previne loop de flash de console no spawn de processos filhos

---

## 🔧 Provedores de IA

| Provedor | API Key | Free Tier | Melhor para |
|----------|---------|-----------|----------|
| **Ollama** | Não (local) | ✅ Ilimitado | Privacidade, offline |
| **LM Studio** | Não (local) | ✅ Ilimitado | Privacidade, modelos GGUF |
| **TranslateGemma** | Não (Ollama) | ✅ Ilimitado — 55 idiomas, Google | **Início recomendado** |
| **HY-MT1.5** | Não (Ollama) | ✅ Ilimitado — ~1GB RAM, Tencent | Máquinas com pouca RAM |
| **Qwen 3** | Não (Ollama) | ✅ Ilimitado — multilíngue | Idiomas CJK |
| **Gemma 4** | Não (Ollama) | ✅ Ilimitado — 27B MoE A4B/E4B/E2B | Qualidade local |
| **Gemini** | Sim | ✅ Free tier (15 RPM) | **Cloud recomendada** |
| **DeepSeek** | Sim | ✅ $0.14/1M input | Cloud barata |
| **Groq** | Sim | ✅ 14.400 req/dia | Velocidade |
| **Mistral** | Sim | ✅ Free tier | Cloud da UE |
| **OpenAI** | Sim | Pago | Qualidade GPT-4o |
| **Claude** | Sim | Pago | Nuance, contexto longo |
| **DeepL** | Sim | ✅ 500k caracteres/mês | Idiomas europeus |
| **MyMemory** | Não | ✅ Ilimitado | Fallback |
| **Lingva** | Não | ✅ Ilimitado | Mirror do Google MT |
| **Cerebras** | Sim | ✅ Free tier | Velocidade |
| **Together AI** | Sim | ✅ $25 de crédito grátis | Modelos abertos |
| **Fireworks** | Sim | ✅ Free tier | Modelos abertos |
| **OpenRouter** | Sim | ✅ Modelos grátis | Variedade de modelos |
| **NLLB-200** | Sim | ✅ 200 idiomas | Idiomas raros |
| **Cohere** | Sim | ✅ Teste grátis | RAG |

**Recomendados para começar**: **TranslateGemma** via Ollama (grátis, local, 55 idiomas) ou **Gemini** (free tier, cloud). Pouca RAM: **HY-MT1.5** (~1GB). Melhor qualidade: **Claude 3.5** ou **GPT-4o**. Melhor CJK: **Qwen 3**.

---

## 📖 Documentação

### Guias do Usuário (11 idiomas)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### Documentação do Projeto

- **[CHANGELOG.md](CHANGELOG.md)** — histórico completo de versões
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — política de versionamento
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — roadmap atual
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — design da arquitetura de plugins
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ Compilar a partir do código-fonte

**Pré-requisitos**: Node.js 18+, Rust 1.70+, npm. No Linux também: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # desenvolvimento
npm run tauri:build  # build de produção
```

Backend Rust: `cd src-tauri && cargo check` para verificar que os comandos Tauri compilam na sua plataforma.

---

## 💖 Apoio

Se o GameStringer te ajudou a jogar no seu idioma:

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

## 📜 Licença

**Source-Available License v1.1** — o código-fonte é público e você pode compilá-lo por conta própria, mas não é "Open Source" aprovado pela OSI.

- ✅ Grátis para uso pessoal
- ✅ Livre para inspecionar, compilar e modificar para si mesmo
- ❌ Uso comercial requer permissão por escrito
- ❌ Redistribuição de versões modificadas requer permissão por escrito

Veja [LICENSE](LICENSE) para detalhes. Dúvidas? Abra uma [Discussion](https://github.com/rouges78/GameStringer/discussions).

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — framework de modding Unity (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — framework de tradução Unity (bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — parser `.locres` do Unreal (akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — modding GameMaker (krzys-h)
- **[Tauri](https://tauri.app)** — framework de app desktop
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — motor OCR
- **[Ollama](https://ollama.com)** — runtime LLM local
- **[Supabase](https://supabase.com)** — backend em tempo real para o Community Chat

---

<p align="center">
  Feito com ❤️ para gamers que querem jogar no seu próprio idioma<br>
  <strong>GameStringer v1.8.0</strong> · © 2025-2026 GameStringer Team
  <strong>GameStringer v1.7.0</strong> · © 2025-2026 GameStringer Team
</p>
