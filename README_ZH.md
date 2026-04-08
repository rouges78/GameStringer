<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>使用 AI 将电子游戏翻译成任何语言的桌面应用。</strong><br>
  从您的库中选择一款游戏,选择一种语言,点击翻译 — 完成。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.7.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Source--Available-green" alt="License" />
  <img src="https://img.shields.io/badge/Tauri_2-24C8DB?logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Next.js_15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Rust-orange?logo=rust&logoColor=white" alt="Rust" />
</p>

<p align="center">
  <a href="#-什么是-gamestringer">什么是 GameStringer</a> ·
  <a href="#-下载">下载</a> ·
  <a href="#-工作原理">工作原理</a> ·
  <a href="#-prediction-tool-pt">P.T.</a> ·
  <a href="#-支持的游戏引擎">引擎</a> ·
  <a href="#-功能">功能</a> ·
  <a href="#-从源码构建">构建</a>
</p>

<p align="center">
  <strong>🌍 用您的语言阅读:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
  <a href="README_PT.md">🇧🇷 Português</a> ·
  <a href="README_JA.md">🇯🇵 日本語</a> ·
  🇨🇳 中文 ·
  <a href="README_KO.md">🇰🇷 한국어</a> ·
  <a href="README_RU.md">🇷🇺 Русский</a> ·
  <a href="README_PL.md">🇵🇱 Polski</a>
</p>

---

## 演示

<p align="center">
  <img src="docs/demo/demo-library.gif" alt="GameStringer Library Demo" width="720" />
</p>

<p align="center">
  <em>🎮 游戏库 — 自动检测 Steam、Epic、GOG、Origin、Ubisoft、Amazon、itch.io</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 AI 翻译器 — 20+ 提供商、Quality Badges 0-100、Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 一键补丁器 — BepInEx、XUnity、UnrealLocres、Bethesda BSA/BA2、CRI CPK、自动备份</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime、自定义房间、在线状态</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — 快捷操作、实时 Ollama 状态、工具子菜单</em>
</p>

---

## 🎮 什么是 GameStringer?

GameStringer 是一款**桌面应用程序**(Windows 和 Linux),可让您翻译没有您所用语言的电子游戏。

大多数游戏将文本存储在文件中 — JSON、XML、CSV、`.locres`、`.rpy`、BSA/BA2、CPK、Unity Localization StringTable 以及许多其他格式。GameStringer **扫描您的游戏文件夹**,找到这些文件,将文本通过您选择的 **AI 翻译提供商**发送(OpenAI、Claude、Gemini、DeepSeek、Ollama 以及 20+ 其他),并将**翻译后的文本打补丁**回游戏。一键操作,无需技术知识。

对于在编译资源中锁定文本的 **Unity 游戏**,GameStringer **自动安装 BepInEx + XUnity.AutoTranslator** — 无需手动设置。对于 **Bethesda 游戏**(上古卷轴、辐射、星空),它原生解析 BSA/BA2/ESP。对于 **CRI Middleware 游戏**(女神异闻录、如龙),它处理 CPK/CRILAYLA/MSG/BMD。对于 **Unreal Engine**,它直接编辑 `.locres`。

**这不是一个机器翻译网站。** 这是一个完整的流水线:**使用 P.T. 分析 → 检测引擎 → 提取文本 → 使用 AI 翻译 → 质量检查 → 打补丁回去 → 畅玩。**

---

## 📥 下载

从 **[GitHub Releases](https://github.com/rouges78/GameStringer/releases)** 获取最新版本:

| 平台 | 文件 | 说明 |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | 安装程序(推荐) |
| **Windows** | `GameStringer-Portable.zip` | 免安装 |
| **Linux** | `GameStringer.AppImage` | 通用(推荐) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**要求:** Windows 10+ 或 Linux(Ubuntu 22.04+, Fedora 38+),4 GB 内存(本地 AI 需 8 GB+),500 MB 磁盘空间。版本经过**代码签名**并通过 Tauri Updater **自动更新**。

---

## 🚀 工作原理

1. **安装** GameStringer 并启动
2. **您的游戏库自动加载** — Steam、Epic、GOG、Origin、Ubisoft、Amazon、itch.io(秒级检测 800+ 游戏)
3. **选择一款游戏** → 可选择运行 **P.T.(Prediction Tool)** 查看难度、预计时间、最佳 LLM 链
4. 点击 **"String it!"** — GameStringer 自动扫描、提取、翻译和打补丁
5. **用您的语言畅玩** — 打补丁前始终创建备份

就是这样。无需命令行,无需手动编辑文件,无需 modding 经验。

---

## 🧠 Prediction Tool (P.T.)

> **GameStringer 中最强大的功能。** 不要盲目开始翻译 — 先分析。

P.T. 是一个在任何翻译*之前*运行的深度分析引擎。它扫描您的游戏文件夹,检测引擎,估算可翻译文本的量,并告诉您:

- **Difficulty Score 0–100** — 字符串量、引擎复杂度、DRM、编码、语言挑战的综合权重
- **预计时间**覆盖 **18 个 LLM 模型** — Ollama(Gemma 4、Qwen 3、Llama)、OpenAI GPT-4/4o、Claude 3.5、Gemini、DeepL、DeepSeek、Groq
- **5 个推荐的 LLM 链**:Local(隐私)、Cloud(质量)、Hybrid(平衡)、Budget、Premium — 每个都有成本和质量评分
- **DRM 检测**:Denuvo、VMProtect、Steam DRM、EAC、BattlEye — 在尝试前警告
- **编码分析**:逐文件检测 Shift-JIS、UTF-8、UTF-16、Big5、EUC-KR
- **翻译复杂度**:敬语、性别一致、RTL、注音/振假名、CJK 特定处理
- **置信度评分**和**工作流计划** — 点击 "String it!" 时将运行的确切步骤
- **导出报告**(JSON + Markdown)用于共享或存档

### P.T.Rank — 快速排行

在多款游戏上运行 P.T. 后,打开 **P.T.Rank** 可查看按难度排序的所有已分析标题。非常适合规划您的翻译队列:从轻松的开始,把 80 万字符串的 RPG 留到最后。

### Dry Run Scanner

不想一次分析一款游戏?从库页面运行 **Dry Run** 可批量扫描**整个 Steam 库(800+ 游戏)**,**零文件修改**。您将获得一个 JSON 报告,将每款游戏分类为 **Ready**(引擎支持 + 可提取字符串)、**Errors**(manifest 问题 / DRM 阻塞)或 **Unsupported**(未知引擎 / 无文本)。进度为实时的,且无需备份,因为未触及任何内容。

### String it! Smart Gate

游戏详情页上的 **"String it!"** 按钮很智能:如果游戏在过去 24 小时内已经由 P.T. 分析,它会直接启动翻译向导。否则它会建议先运行 P.T.(一键选择 "Run P.T. first" / "String it! anyway")。不再在 DRM 锁定或 5 分钟就能解决的游戏上浪费运行。

---

## 🎯 支持的游戏引擎

GameStringer 支持具有不同深度级别的 **20+ 引擎**:

| 引擎 | 支持 | 工作原理 |
|--------|---------|--------------|
| **Unity** | ✅ 完整 | 自动安装 BepInEx + XUnity.AutoTranslator + Unity Localization Package 流水线(StringTable、SharedTableData、Addressables、Smart Strings) |
| **Unreal Engine** | ✅ 完整 | 使用 UnrealLocres 提取和修补 `.locres` |
| **Unreal _P.pak** | ✅ 完整 | 将 Mod 打包为 `<GameStringer>_P.pak`,通过 Paks 文件夹加载 |
| **Godot** | ✅ 完整 | 原生 `.translation` 文件支持 |
| **RPG Maker** | ✅ 完整 | MV/MZ JSON,通过 Trans 的 VX/Ace,通过 RMXP 的 XP |
| **Ren'Py** | ✅ 完整 | 带对话检测的原生 `.rpy` 脚本解析 |
| **GameMaker** | ⚡ 部分 | 通过 UndertaleModTool 集成 |
| **Telltale** | ✅ 完整 | `.langdb` / `.dlog` 支持 |
| **Wolf RPG** | ✅ 完整 | WolfTrans 集成 |
| **Kirikiri** | ✅ 完整 | `.ks` / `.scn` 解析 |
| **TyranoScript** | ✅ 完整 | 带 JSON 修补的 fast-path 提取器 |
| **Electron** | ✅ 完整 | ASAR 解包 + i18n JSON 检测 |
| **Bethesda(Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM(FULL/DESC/NAM1)解析器,STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware(女神异闻录/如龙/传说系列/龙珠)** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTD,自动检测 Shift-JIS/UTF-8/UTF-16 |
| **Visionaire Studio** | ✅ 完整 | Daedalic 冒险游戏(Deponia、Edna 等) |
| **Danganronpa WAD** | ✅ 完整 | WAD 存档解析器 + STX 对话修补 |

> **Unity 游戏**受到特殊处理:如果没有找到可翻译文件,GameStringer 会检测到这是一款 Unity 游戏,并提供一键**自动安装 BepInEx + XUnity.AutoTranslator**。安装后只需启动游戏一次,然后重新扫描 — 所有文本都可翻译。
>
> ⚠️ **反作弊警告**:BepInEx(DLL 注入)可能触发反作弊系统(EAC、BattlEye、Vanguard)。GameStringer 包含反作弊检测并会警告您。**仅用于单人 / 离线游戏。** P.T. 在任何修改之前检测 DRM。

---

## ✨ 功能

### 🤖 AI 翻译

- **20+ 提供商**:OpenAI、Claude、Gemini、DeepSeek、Mistral、Groq、DeepL、Ollama(本地)、LM Studio、TranslateGemma、HY-MT、Qwen 3、NLLB-200、Cerebras、Together AI、Fireworks、OpenRouter、Cohere、Lingva、MyMemory
- **Context-aware**:理解游戏类型、角色声音、语调、叙事 vs UI vs 对话
- **Translation Memory 和术语表**:整个项目的一致性,自动术语表提取
- **Multi-LLM Compare**:并行运行多个提供商,为每个字符串选择最佳结果
- **Auto-Select Engine**(NEW v1.7.0):根据目标语言 + 游戏类型动态排列提供商的预设
- **Quality gates**:对每个翻译字符串的自动 QA 评分(0-100),带 ContentTypeBadge
- **Vision LLM Translator**:使用游戏内截图作为上下文(Ollama、Gemini、GPT-4o)
- **Live Quality Preview**:在批量翻译期间实时查看质量评分
- **RTL 支持**:自动方向检测和 `dir` 属性处理

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100**,带加权因素(量、引擎、DRM、编码、复杂度)
- **18 个 LLM 模型的时间估计**,包括 Gemma 4(27B MoE A4B / E4B / E2B)
- **5 个 LLM 链**(Local / Cloud / Hybrid / Budget / Premium),带成本和质量估计
- **DRM / 反作弊检测**(Denuvo、VMProtect、Steam DRM、EAC、BattlEye、Vanguard)
- 逐文件**编码分析**(Shift-JIS、UTF-8/16、Big5、EUC-KR)
- **翻译复杂度分析**(敬语、性别、CJK、注音、RTL)
- **P.T.Rank / Quick Ranking** — 按难度对所有已分析游戏排序
- **Dry Run Scanner** — 整个 Steam 库(800+ 游戏)的批量扫描,无修改
- **Workflow Orchestrator** — 实际执行引擎,具有 6+ 引擎的通用 fast path 和实时进度
- **预测缓存**(24 小时) — 立即重新打开之前分析过的游戏
- **导出报告**(JSON + Markdown)用于共享和存档

### 📚 游戏库

- **自动检测**:Steam(带 Family Sharing)、Epic、GOG Galaxy、Origin/EA、Ubisoft Connect、Amazon Games、itch.io
- 秒级从已安装库识别 **800+ 游戏**
- 带封面艺术、元数据、引擎徽章、VR 徽章、安装状态的**游戏卡片**
- **悬停快捷操作**:String it!、Batch、Community、P.T. — 全部一键
- **Game Update Tracker**:检测 Steam 何时更新了已翻译的游戏(通过 `buildid`),验证补丁完整性(BepInEx 文件、`_P.pak` 存在),如果需要重新打补丁则警告
- **"Stop monitoring"** 按钮以取消跟踪特定游戏

### 🔧 翻译工具

- **One-Click Translate**("String it!"):扫描 → 翻译 → 打补丁,单一流程
- **Batch Translation**:一次翻译整个游戏或文件夹
- **字幕翻译器**:SRT、VTT、ASS/SSA,保留时间
- **OCR Translator**:使用真实 Tauri Tesseract 后端从复古游戏(8-bit、16-bit、DOS 预设)提取文本
- **Voice Pipeline**:speech-to-text → 翻译 → text-to-speech,带 **Duration Matching**(NEW v1.7.0)— 自动调整速度以匹配原始音频时长
- **Lip Sync**(NEW v1.7.0):Rhubarb 集成用于唇形生成,支持 Unity/Unreal 导出
- **Gridly CSV Export/Import**(NEW v1.7.0):兼容 Gridly/Lokalise/Crowdin 的多语言格式
- **实时叠加**:通过 VR/屏幕叠加在玩游戏时查看翻译
- **Auto-Translate Review**:带进度条的 "Translate all untranslated" 按钮
- **Lore Assistant**:了解游戏背景和对话的 RAG 聊天
- **Character Voice Profiles**:为每个角色定义个性、语调、说话模式
- **Translation Confidence Heatmap**:所有翻译质量的可视化概览

### 🎮 游戏引擎补丁器

- **Unity**:BepInEx + XUnity.AutoTranslator 自动安装程序,Unity Localization Package(StringTable、SharedTableData、Addressables 目录、Smart Strings 验证器)
- **Unreal Engine**:`.locres` 提取 + `_P.pak` Mod 打包
- **Bethesda Engine Patcher**(NEW v1.6.0):Skyrim LE/SE/AE、Fallout 3/NV/4、Oblivion、Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM(FULL/DESC/NAM1)
- **CRI Middleware Patcher**(NEW v1.6.0):女神异闻录 5 Royal、如龙、传说系列、龙珠 — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**、**RPG Maker**、**Godot**、**GameMaker**、**Kirikiri**、**Wolf RPG**、**Telltale**、**Visionaire**、**Danganronpa WAD** — 全部带原生解析器
- **Wizard Stepper**:所有补丁器的共享多步 UI
- 每个补丁器的 **Universal PO Export**(gettext `.po`),带项目/语言/源/引擎元数据
- **自动备份**:在每次打补丁之前,带一键恢复

### 🔌 高级

- **Auto-Hook Scanner**:硬编码字符串的进程内存扫描(Windows WinAPI)
- **System Monitor**:本地 LLM 规划的实时 VRAM/RAM 使用
- **Ollama Setup Wizard**:本地 AI 的分步安装
- **Ollama Manager**:从 ollama.com 注册表自动发现模型 + 焦点/导航时自动刷新
- **Debug Console**:带日志拦截的集成控制台
- **Video Extractor**(v1.7.0):从复古/现代游戏中提取和转换 FMV 视频,支持 AI 升级
- **Plugin System**:第三方插件的设计文档(请参阅 `PLUGIN_SYSTEM.md`)
- **Community Hub**:共享和下载 Translation Memories + GitHub Discussions 集成
- **Public API v1**:用于集成的 REST 端点(`/api/v1/translate`、`/api/v1/batch`)

### 💬 Community Chat

- 通过 Supabase Realtime 与其他翻译者进行**实时聊天**
- **4 个默认房间**:General、Translations、Feedback & Bugs、Announcements
- **自定义房间**:为特定游戏或项目创建房间
- **Auto-Bridge Auth**:您的 GameStringer 配置文件自动同步到 Supabase — 无需额外登录
- **在线状态**:查看每个房间中谁在线
- 带 RLS 强制所有权的**回复 / 编辑 / 删除**消息
- 右下角的**可展开抽屉小部件**

### ♿ 无障碍 (v1.6.0)

- **WCAG 2.1 AA sweep** — 图标按钮上的 `aria-label`、语义 `CardTitle` 标题、所有原语上的 `focus-visible`、skip-to-content 链接、`main` 地标、意大利语 `sr-only` 助手
- 所有动画中尊重 **`prefers-reduced-motion`**
- 尊重 **`forced-colors`**(Windows 高对比度模式)
- **11 种语言 UI**:IT、EN、ES、FR、DE、JA、ZH、KO、PT、RU、PL
- 带自动方向检测的 **RTL 布局支持**

### 🎨 Design System (v1.6.0)

- 通过 `cva` 的 **Card 变体**:default、muted、highlight、success、error、warning
- 包括 `xs` 和 `icon-sm` 的 **Button 尺寸**
- **文本工具**:`text-micro`(9px)、`text-2xs`(10px) — 不再有任意的 Tailwind
- **Radix UI 统一**:将 37 个文件从 `@radix-ui/react-*` 迁移到 `radix-ui`,删除了 27 个包
- **优化包**:radix-ui、framer-motion、recharts、cmdk 的 `optimizePackageImports`

### 🖥️ 应用

- **签名自动更新**:通过 Tauri Updater 从应用中一键更新
- **配置文件**:带恢复密钥的多个用户配置文件
- **Global Hotkeys**:`Ctrl+Shift+T` OCR、`Ctrl+Shift+Q` Quick Translate、`Ctrl+Alt+O` Overlay、`Alt+T` XUnity 切换
- **System Tray**:快捷操作、实时 Ollama 状态、工具子菜单
- **跨平台**:带原生构建的 Windows 和 Linux
- **Windows tray 修复**:防止子进程生成时的控制台闪烁循环

---

## 🔧 AI 提供商

| 提供商 | API Key | Free Tier | 最适合 |
|----------|---------|-----------|----------|
| **Ollama** | 否(本地) | ✅ 无限 | 隐私、离线 |
| **LM Studio** | 否(本地) | ✅ 无限 | 隐私、GGUF 模型 |
| **TranslateGemma** | 否(Ollama) | ✅ 无限 — 55 种语言,Google | **推荐起点** |
| **HY-MT1.5** | 否(Ollama) | ✅ 无限 — 约 1GB RAM,腾讯 | 低 RAM 机器 |
| **Qwen 3** | 否(Ollama) | ✅ 无限 — 多语言 | CJK 语言 |
| **Gemma 4** | 否(Ollama) | ✅ 无限 — 27B MoE A4B/E4B/E2B | 本地质量 |
| **Gemini** | 是 | ✅ 免费层(15 RPM) | **推荐云端** |
| **DeepSeek** | 是 | ✅ $0.14/1M input | 经济云端 |
| **Groq** | 是 | ✅ 14,400 请求/天 | 速度 |
| **Mistral** | 是 | ✅ 免费层 | 欧盟云端 |
| **OpenAI** | 是 | 付费 | GPT-4o 质量 |
| **Claude** | 是 | 付费 | 细微差别、长上下文 |
| **DeepL** | 是 | ✅ 500k 字符/月 | 欧洲语言 |
| **MyMemory** | 否 | ✅ 无限 | 回退 |
| **Lingva** | 否 | ✅ 无限 | Google MT 镜像 |
| **Cerebras** | 是 | ✅ 免费层 | 速度 |
| **Together AI** | 是 | ✅ $25 免费额度 | 开放模型 |
| **Fireworks** | 是 | ✅ 免费层 | 开放模型 |
| **OpenRouter** | 是 | ✅ 免费模型 | 模型多样性 |
| **NLLB-200** | 是 | ✅ 200 种语言 | 稀有语言 |
| **Cohere** | 是 | ✅ 免费试用 | RAG |

**推荐起点**:通过 Ollama 的 **TranslateGemma**(免费、本地、55 种语言)或 **Gemini**(免费层、云端)。低 RAM:**HY-MT1.5**(约 1GB)。最佳质量:**Claude 3.5** 或 **GPT-4o**。最佳 CJK:**Qwen 3**。

---

## 📖 文档

### 用户指南(11 种语言)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### 项目文档

- **[CHANGELOG.md](CHANGELOG.md)** — 完整版本历史
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — 版本控制政策
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — 当前路线图
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — 插件架构设计
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ 从源码构建

**先决条件**:Node.js 18+、Rust 1.70+、npm。在 Linux 上还需要:`libwebkit2gtk-4.1-dev`、`libayatana-appindicator3-dev`、`librsvg2-dev`。

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # 开发
npm run tauri:build  # 生产构建
```

Rust 后端:`cd src-tauri && cargo check` 以验证 Tauri 命令在您的平台上编译。

---

## 💖 支持

如果 GameStringer 帮助您用自己的语言玩游戏:

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

## 📜 许可证

**Source-Available License v1.1** — 源代码是公开的,您可以自己构建它,但它不是 OSI 批准的"开源"。

- ✅ 个人使用免费
- ✅ 可自由检查、构建和修改供自己使用
- ❌ 商业使用需要书面许可
- ❌ 修改版本的再分发需要书面许可

详情请参阅 [LICENSE](LICENSE)。有问题?请打开一个 [Discussion](https://github.com/rouges78/GameStringer/discussions)。

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — Unity modding 框架(BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — Unity 翻译框架(bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — Unreal `.locres` 解析器(akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — GameMaker modding(krzys-h)
- **[Tauri](https://tauri.app)** — 桌面应用框架
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — OCR 引擎
- **[Ollama](https://ollama.com)** — 本地 LLM 运行时
- **[Supabase](https://supabase.com)** — Community Chat 的实时后端

---

<p align="center">
  用 ❤️ 为想用自己语言玩游戏的玩家制作<br>
  <strong>GameStringer v1.7.0</strong> · © 2025-2026 GameStringer Team
</p>
