<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>AI를 사용해 비디오 게임을 어떤 언어로든 번역하는 데스크톱 앱.</strong><br>
  라이브러리에서 게임을 선택하고, 언어를 고르고, 번역을 클릭하세요 — 완료.
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
  <a href="#-gamestringer란">GameStringer란</a> ·
  <a href="#-다운로드">다운로드</a> ·
  <a href="#-작동-방식">작동 방식</a> ·
  <a href="#-prediction-tool-pt">P.T.</a> ·
  <a href="#-지원되는-게임-엔진">엔진</a> ·
  <a href="#-기능">기능</a> ·
  <a href="#-소스에서-빌드">빌드</a>
</p>

<p align="center">
  <strong>🌍 원하는 언어로 읽기:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
  <a href="README_PT.md">🇧🇷 Português</a> ·
  <a href="README_JA.md">🇯🇵 日本語</a> ·
  <a href="README_ZH.md">🇨🇳 中文</a> ·
  🇰🇷 한국어 ·
  <a href="README_RU.md">🇷🇺 Русский</a> ·
  <a href="README_PL.md">🇵🇱 Polski</a>
</p>

---

## 데모

<p align="center">
  <img src="docs/demo/demo-library.gif" alt="GameStringer Library Demo" width="720" />
</p>

<p align="center">
  <em>🎮 게임 라이브러리 — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io 자동 감지</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 AI 번역기 — 20개 이상의 제공자, Quality Badges 0-100, Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 원클릭 패처 — BepInEx, XUnity, UnrealLocres, Bethesda BSA/BA2, CRI CPK, 자동 백업</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime, 사용자 지정 룸, 온라인 프레젠스</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — 빠른 작업, 실시간 Ollama 상태, 도구 하위 메뉴</em>
</p>

---

## 🎮 GameStringer란?

GameStringer는 원하는 언어가 없는 비디오 게임을 번역할 수 있는 **데스크톱 애플리케이션**(Windows 및 Linux)입니다.

대부분의 게임은 텍스트를 파일에 저장합니다 — JSON, XML, CSV, `.locres`, `.rpy`, BSA/BA2, CPK, Unity Localization StringTable 및 기타 많은 형식. GameStringer는 **게임 폴더를 스캔**하고, 해당 파일을 찾아, 선택한 **AI 번역 제공자**(OpenAI, Claude, Gemini, DeepSeek, Ollama 및 20개 이상)를 통해 텍스트를 보내고, **번역된 텍스트를 게임에 패치**합니다. 원클릭, 기술 지식 불필요.

컴파일된 에셋 안에 텍스트가 잠긴 **Unity 게임**의 경우, GameStringer는 **BepInEx + XUnity.AutoTranslator를 자동으로 설치**합니다 — 수동 설정 없음. **Bethesda 게임**(Skyrim, Fallout, Starfield)의 경우 BSA/BA2/ESP를 네이티브로 파싱합니다. **CRI Middleware 게임**(Persona, Yakuza)의 경우 CPK/CRILAYLA/MSG/BMD를 처리합니다. **Unreal Engine**의 경우 `.locres`를 직접 편집합니다.

**기계 번역 웹사이트가 아닙니다.** 완전한 파이프라인입니다: **P.T.로 분석 → 엔진 감지 → 텍스트 추출 → AI로 번역 → 품질 검사 → 다시 패치 → 플레이.**

---

## 📥 다운로드

**[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**에서 최신 릴리스를 받으세요:

| 플랫폼 | 파일 | 비고 |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | 설치 프로그램 (권장) |
| **Windows** | `GameStringer-Portable.zip` | 설치 불필요 |
| **Linux** | `GameStringer.AppImage` | 범용 (권장) |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**요구 사항:** Windows 10+ 또는 Linux(Ubuntu 22.04+, Fedora 38+), 4GB RAM(로컬 AI의 경우 8GB+), 500MB 디스크 공간. 릴리스는 **코드 서명**되어 있으며 Tauri Updater를 통해 **자동 업데이트**됩니다.

---

## 🚀 작동 방식

1. GameStringer를 **설치**하고 실행
2. **게임 라이브러리가 자동으로 로드됨** — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.io (몇 초 만에 800개 이상의 게임 감지)
3. **게임 선택** → 선택적으로 **P.T.(Prediction Tool)**를 실행하여 난이도, 예상 시간, 최상의 LLM 체인 확인
4. **"String it!"** 클릭 — GameStringer가 자동으로 스캔, 추출, 번역, 패치
5. **원하는 언어로 플레이** — 패치 전에 항상 백업이 생성됨

그게 전부입니다. 명령줄, 수동 파일 편집, modding 경험이 필요하지 않습니다.

---

## 🧠 Prediction Tool (P.T.)

> **GameStringer의 가장 강력한 기능.** 번역을 맹목적으로 시작하지 마세요 — 먼저 분석하세요.

P.T.는 모든 번역 *전에* 실행되는 심층 분석 엔진입니다. 게임 폴더를 스캔하고, 엔진을 감지하고, 번역 가능한 텍스트의 양을 추정하며 다음을 알려줍니다:

- **Difficulty Score 0–100** — 문자열 양, 엔진 복잡도, DRM, 인코딩, 언어적 도전의 결합 가중치
- **18개의 LLM 모델**에 걸친 **예상 시간** — Ollama (Gemma 4, Qwen 3, Llama), OpenAI GPT-4/4o, Claude 3.5, Gemini, DeepL, DeepSeek, Groq
- **5가지 권장 LLM 체인**: Local (개인정보 보호), Cloud (품질), Hybrid (균형), Budget, Premium — 각각 비용 및 품질 점수 포함
- **DRM 감지**: Denuvo, VMProtect, Steam DRM, EAC, BattlEye — 시도하기 전에 경고
- **인코딩 분석**: 파일별로 Shift-JIS, UTF-8, UTF-16, Big5, EUC-KR 감지
- **번역 복잡도**: 경어법, 성별 일치, RTL, 루비/후리가나, CJK 특화 처리
- **신뢰도 점수** 및 **workflow 계획** — "String it!" 클릭 시 실행될 정확한 단계
- **보고서 내보내기** (JSON + Markdown) 공유 또는 보관용

### P.T.Rank — 빠른 순위

여러 게임에서 P.T.를 실행한 후 **P.T.Rank**를 열어 난이도별로 정렬된 모든 분석된 타이틀을 볼 수 있습니다. 번역 큐를 계획하는 데 완벽함: 쉬운 승리부터 시작하고, 80만 문자열 RPG는 마지막으로 남겨두세요.

### Dry Run Scanner

한 번에 하나의 게임을 분석하고 싶지 않으신가요? 라이브러리 페이지에서 **Dry Run**을 실행하여 **전체 Steam 라이브러리 (800개 이상의 게임)를 일괄 스캔**하세요. **파일 수정은 전혀 없습니다**. 각 게임을 **Ready**(엔진 지원 + 문자열 추출 가능), **Errors**(manifest 문제 / DRM 차단) 또는 **Unsupported**(알 수 없는 엔진 / 텍스트 없음)로 분류하는 JSON 보고서를 받게 됩니다. 진행 상황은 실시간이며 아무것도 건드리지 않기 때문에 백업이 필요 없습니다.

### String it! Smart Gate

게임 세부 페이지의 **"String it!"** 버튼은 스마트합니다: 게임이 지난 24시간 이내에 P.T.에서 이미 분석된 경우 번역 마법사를 직접 실행합니다. 그렇지 않으면 P.T.를 먼저 실행하도록 제안합니다(원클릭 "Run P.T. first" / "String it! anyway" 선택). DRM 잠금이 되어 있거나 5분이면 끝나는 게임에 대한 낭비되는 실행은 이제 없습니다.

---

## 🎯 지원되는 게임 엔진

GameStringer는 다양한 깊이 수준으로 **20개 이상의 엔진**을 지원합니다:

| 엔진 | 지원 | 작동 방식 |
|--------|---------|--------------|
| **Unity** | ✅ 완전 | BepInEx + XUnity.AutoTranslator + Unity Localization Package 파이프라인 자동 설치 (StringTable, SharedTableData, Addressables, Smart Strings) |
| **Unreal Engine** | ✅ 완전 | UnrealLocres로 `.locres` 추출 및 패치 |
| **Unreal _P.pak** | ✅ 완전 | Paks 폴더를 통해 로드되는 `<GameStringer>_P.pak`로 mod 패키징 |
| **Godot** | ✅ 완전 | 네이티브 `.translation` 파일 지원 |
| **RPG Maker** | ✅ 완전 | MV/MZ JSON, Trans를 통한 VX/Ace, RMXP를 통한 XP |
| **Ren'Py** | ✅ 완전 | 대화 감지가 있는 네이티브 `.rpy` 스크립트 파싱 |
| **GameMaker** | ⚡ 부분 | UndertaleModTool 통합을 통해 |
| **Telltale** | ✅ 완전 | `.langdb` / `.dlog` 지원 |
| **Wolf RPG** | ✅ 완전 | WolfTrans 통합 |
| **Kirikiri** | ✅ 완전 | `.ks` / `.scn` 파싱 |
| **TyranoScript** | ✅ 완전 | JSON 패치가 있는 fast-path 추출기 |
| **Electron** | ✅ 완전 | ASAR 언패킹 + i18n JSON 감지 |
| **Bethesda (Skyrim/Fallout/Oblivion/Starfield)** | ✅ **NEW v1.6.0** | BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1) 파서, STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware (Persona/Yakuza/Tales of/Dragon Ball)** | ✅ **NEW v1.6.0** | Shift-JIS/UTF-8/UTF-16 자동 감지가 있는 CPK + CRILAYLA + MSG/BMD/FTD |
| **Visionaire Studio** | ✅ 완전 | Daedalic 어드벤처 (Deponia, Edna 등) |
| **Danganronpa WAD** | ✅ 완전 | WAD 아카이브 파서 + STX 대화 패치 |

> **Unity 게임**은 특별한 취급을 받습니다: 번역 가능한 파일을 찾을 수 없는 경우 GameStringer는 Unity 게임임을 감지하고 원클릭으로 **BepInEx + XUnity.AutoTranslator를 자동으로 설치**할 것을 제안합니다. 설치 후 게임을 한 번 실행한 다음 다시 스캔하기만 하면 모든 텍스트가 번역 가능해집니다.
>
> ⚠️ **안티 치트 경고**: BepInEx(DLL 주입)는 안티 치트 시스템(EAC, BattlEye, Vanguard)을 트리거할 수 있습니다. GameStringer에는 안티 치트 감지가 포함되어 있으며 경고합니다. **싱글 플레이어 / 오프라인 게임에서만 사용하세요.** P.T.는 수정 전에 DRM을 감지합니다.

---

## ✨ 기능

### 🆕 v1.8.0 신규 기능

- **Live Translation Overlay** — 투명 OCR 오버레이를 통한 실시간 게임 번역
- **Hub Marketplace** — 원클릭 설치가 가능한 커뮤니티 번역 팩 마켓플레이스
- **Translation Memory Network** — 연합 커뮤니티 번역 공유
- **AI Dubbing Pipeline** — 엔드투엔드 게임 음성 더빙 (STT → 번역 → TTS → 패치)
- **Plugin System** — 커뮤니티 확장 가능한 게임 엔진 패처 플러그인

### 🤖 AI 번역

- **20개 이상의 제공자**: OpenAI, Claude, Gemini, DeepSeek, Mistral, Groq, DeepL, Ollama (로컬), LM Studio, TranslateGemma, HY-MT, Qwen 3, NLLB-200, Cerebras, Together AI, Fireworks, OpenRouter, Cohere, Lingva, MyMemory
- **Context-aware**: 게임 장르, 캐릭터 음성, 톤, 내러티브 vs UI vs 대화 이해
- **Translation Memory 및 용어집**: 자동 용어집 추출을 통한 프로젝트 전체의 일관성
- **Multi-LLM Compare**: 여러 제공자를 병렬로 실행하고, 문자열당 최상의 결과 선택
- **Auto-Select Engine** (NEW v1.7.0): 대상 언어 + 게임 장르에 따라 제공자를 동적으로 순위 매기는 프리셋
- **Quality gates**: 각 번역된 문자열에 대한 자동 QA 점수 (0-100)와 ContentTypeBadge
- **Vision LLM Translator**: 컨텍스트에 게임 내 스크린샷 사용 (Ollama, Gemini, GPT-4o)
- **Live Quality Preview**: 일괄 번역 중 실시간으로 품질 점수 확인
- **RTL 지원**: 자동 방향 감지 및 `dir` 속성 처리

### 🧠 P.T. — Prediction Tool (v1.6.0)

- 가중 요소(양, 엔진, DRM, 인코딩, 복잡도)가 있는 **Difficulty Score 0-100**
- Gemma 4 (27B MoE A4B / E4B / E2B)를 포함한 **18개 LLM 모델에 대한 시간 추정**
- 비용 및 품질 추정이 있는 **5개 LLM 체인**(Local / Cloud / Hybrid / Budget / Premium)
- **DRM / 안티 치트 감지** (Denuvo, VMProtect, Steam DRM, EAC, BattlEye, Vanguard)
- 파일별 **인코딩 분석** (Shift-JIS, UTF-8/16, Big5, EUC-KR)
- **번역 복잡도 분석** (경어법, 성별, CJK, 루비, RTL)
- **P.T.Rank / Quick Ranking** — 분석된 모든 게임을 난이도별로 정렬
- **Dry Run Scanner** — 수정 없이 전체 Steam 라이브러리 (800개 이상의 게임) 일괄 스캔
- **Workflow Orchestrator** — 6개 이상의 엔진에 대한 범용 fast path와 실시간 진행률이 있는 실제 실행 엔진
- **예측 캐시** (24시간) — 이전에 분석된 게임의 즉각적인 재오픈
- 공유 및 보관을 위한 **보고서 내보내기** (JSON + Markdown)

### 📚 게임 라이브러리

- **자동 감지**: Steam (Family Sharing 포함), Epic, GOG Galaxy, Origin/EA, Ubisoft Connect, Amazon Games, itch.io
- 몇 초 만에 설치된 라이브러리에서 **800개 이상의 게임** 인식
- 커버 아트, 메타데이터, 엔진 배지, VR 배지, 설치 상태가 있는 **게임 카드**
- **호버 빠른 작업**: String it!, Batch, Community, P.T. — 모두 원클릭
- **Game Update Tracker**: Steam이 번역된 게임을 업데이트할 때 감지(`buildid` 통해), 패치 무결성 확인(BepInEx 파일, `_P.pak` 존재), 재패치가 필요한 경우 경고
- 특정 게임 추적을 중지하는 **"Stop monitoring"** 버튼

### 🔧 번역 도구

- **One-Click Translate** ("String it!"): 단일 흐름으로 스캔 → 번역 → 패치
- **Batch Translation**: 전체 게임 또는 폴더를 한 번에 번역
- **자막 번역기**: 타이밍 보존이 있는 SRT, VTT, ASS/SSA
- **OCR Translator**: 실제 Tauri Tesseract 백엔드로 레트로 게임(8-bit, 16-bit, DOS 프리셋)에서 텍스트 추출
- **Voice Pipeline**: speech-to-text → 번역 → text-to-speech, **Duration Matching** (NEW v1.7.0) 포함 — 원본 오디오 길이에 맞게 속도 자동 조정
- **Lip Sync** (NEW v1.7.0): 비짐 생성을 위한 Rhubarb 통합, Unity/Unreal 내보내기
- **Gridly CSV Export/Import** (NEW v1.7.0): Gridly/Lokalise/Crowdin 호환 다국어 형식
- **실시간 오버레이**: VR/스크린 오버레이를 통해 플레이하면서 번역 확인
- **Auto-Translate Review**: 진행률 표시줄이 있는 "Translate all untranslated" 버튼
- **Lore Assistant**: 게임의 배경과 대화를 아는 RAG 채팅
- **Character Voice Profiles**: 캐릭터별 성격, 톤, 말투 정의
- **Translation Confidence Heatmap**: 모든 번역의 품질에 대한 시각적 개요

### 🎮 게임 엔진 패처

- **Unity**: BepInEx + XUnity.AutoTranslator 자동 설치 프로그램, Unity Localization Package (StringTable, SharedTableData, Addressables 카탈로그, Smart Strings 검증기)
- **Unreal Engine**: `.locres` 추출 + `_P.pak` mod 패키징
- **Bethesda Engine Patcher** (NEW v1.6.0): Skyrim LE/SE/AE, Fallout 3/NV/4, Oblivion, Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM (FULL/DESC/NAM1)
- **CRI Middleware Patcher** (NEW v1.6.0): Persona 5 Royal, Yakuza, Tales of, Dragon Ball — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**, **RPG Maker**, **Godot**, **GameMaker**, **Kirikiri**, **Wolf RPG**, **Telltale**, **Visionaire**, **Danganronpa WAD** — 모두 네이티브 파서 포함
- **Wizard Stepper**: 모든 패처용 공유 다단계 UI
- 프로젝트/언어/소스/엔진 메타데이터가 있는 모든 패처용 **Universal PO Export** (gettext `.po`)
- **자동 백업**: 각 패치 전에 원클릭 복원 포함

### 🔌 고급

- **Auto-Hook Scanner**: 하드코딩된 문자열을 위한 프로세스 메모리 스캐닝 (Windows WinAPI)
- **System Monitor**: 로컬 LLM 계획을 위한 실시간 VRAM/RAM 사용
- **Ollama Setup Wizard**: 로컬 AI 단계별 설치
- **Ollama Manager**: ollama.com 레지스트리에서 모델 자동 검색 + 포커스/탐색 시 자동 새로 고침
- **Debug Console**: 로그 인터셉트가 있는 통합 콘솔
- **Video Extractor** (v1.7.0): AI 업스케일링으로 레트로/현대 게임에서 FMV 비디오 추출 및 변환
- **Plugin System**: 타사 플러그인을 위한 설계 문서 (`PLUGIN_SYSTEM.md` 참조)
- **Community Hub**: Translation Memories 공유 및 다운로드 + GitHub Discussions 통합
- **Public API v1**: 통합을 위한 REST 엔드포인트 (`/api/v1/translate`, `/api/v1/batch`)

### 💬 Community Chat

- Supabase Realtime을 통해 다른 번역자들과 **실시간 채팅**
- **4개의 기본 룸**: General, Translations, Feedback & Bugs, Announcements
- **사용자 지정 룸**: 특정 게임이나 프로젝트를 위한 룸 생성
- **Auto-Bridge Auth**: GameStringer 프로필이 Supabase와 자동 동기화 — 추가 로그인 필요 없음
- **온라인 프레젠스**: 각 룸에서 누가 온라인인지 확인
- RLS로 강제된 소유권과 함께 메시지 **답장 / 편집 / 삭제**
- 오른쪽 하단 모서리의 **확장 가능한 드로어 위젯**

### ♿ 접근성 (v1.6.0)

- **WCAG 2.1 AA sweep** — 아이콘 버튼의 `aria-label`, 의미론적 `CardTitle` 제목, 모든 프리미티브의 `focus-visible`, skip-to-content 링크, `main` 랜드마크, 이탈리아어 `sr-only` 헬퍼
- 모든 애니메이션에서 **`prefers-reduced-motion`** 존중
- **`forced-colors`** (Windows 고대비 모드) 존중
- **11개 언어 UI**: IT, EN, ES, FR, DE, JA, ZH, KO, PT, RU, PL
- 자동 방향 감지가 있는 **RTL 레이아웃 지원**

### 🎨 Design System (v1.6.0)

- `cva`를 통한 **Card 변형**: default, muted, highlight, success, error, warning
- `xs` 및 `icon-sm`을 포함한 **Button 크기**
- **텍스트 유틸리티**: `text-micro` (9px), `text-2xs` (10px) — 더 이상 임의의 Tailwind 없음
- **Radix UI 통합**: `@radix-ui/react-*`에서 `radix-ui`로 37개 파일 마이그레이션, 27개 패키지 제거
- **최적화된 번들**: radix-ui, framer-motion, recharts, cmdk를 위한 `optimizePackageImports`

### 🖥️ 앱

- **서명된 자동 업데이트**: Tauri Updater를 통해 앱에서 원클릭 업데이트
- **프로필**: 복구 키가 있는 여러 사용자 프로필
- **Global Hotkeys**: `Ctrl+Shift+T` OCR, `Ctrl+Shift+Q` Quick Translate, `Ctrl+Alt+O` Overlay, `Alt+T` XUnity 토글
- **System Tray**: 빠른 작업, 실시간 Ollama 상태, 도구 하위 메뉴
- **크로스 플랫폼**: 네이티브 빌드가 있는 Windows 및 Linux
- **Windows 트레이 수정**: 자식 프로세스 생성 시 콘솔 플래시 루프 방지

---

## 🔧 AI 제공자

| 제공자 | API 키 | Free Tier | 최적 용도 |
|----------|---------|-----------|----------|
| **Ollama** | 아니오 (로컬) | ✅ 무제한 | 개인정보 보호, 오프라인 |
| **LM Studio** | 아니오 (로컬) | ✅ 무제한 | 개인정보 보호, GGUF 모델 |
| **TranslateGemma** | 아니오 (Ollama) | ✅ 무제한 — 55개 언어, Google | **권장 시작** |
| **HY-MT1.5** | 아니오 (Ollama) | ✅ 무제한 — 약 1GB RAM, Tencent | 낮은 RAM 머신 |
| **Qwen 3** | 아니오 (Ollama) | ✅ 무제한 — 다국어 | CJK 언어 |
| **Gemma 4** | 아니오 (Ollama) | ✅ 무제한 — 27B MoE A4B/E4B/E2B | 로컬 품질 |
| **Gemini** | 예 | ✅ 무료 티어 (15 RPM) | **권장 클라우드** |
| **DeepSeek** | 예 | ✅ $0.14/1M input | 저렴한 클라우드 |
| **Groq** | 예 | ✅ 일일 14,400 요청 | 속도 |
| **Mistral** | 예 | ✅ 무료 티어 | EU 클라우드 |
| **OpenAI** | 예 | 유료 | GPT-4o 품질 |
| **Claude** | 예 | 유료 | 뉘앙스, 긴 컨텍스트 |
| **DeepL** | 예 | ✅ 월 500k 문자 | 유럽 언어 |
| **MyMemory** | 아니오 | ✅ 무제한 | 폴백 |
| **Lingva** | 아니오 | ✅ 무제한 | Google MT 미러 |
| **Cerebras** | 예 | ✅ 무료 티어 | 속도 |
| **Together AI** | 예 | ✅ $25 무료 크레딧 | 오픈 모델 |
| **Fireworks** | 예 | ✅ 무료 티어 | 오픈 모델 |
| **OpenRouter** | 예 | ✅ 무료 모델 | 모델 다양성 |
| **NLLB-200** | 예 | ✅ 200개 언어 | 희귀 언어 |
| **Cohere** | 예 | ✅ 무료 체험 | RAG |

**시작 권장**: Ollama를 통한 **TranslateGemma** (무료, 로컬, 55개 언어) 또는 **Gemini** (무료 티어, 클라우드). 낮은 RAM: **HY-MT1.5** (약 1GB). 최고 품질: **Claude 3.5** 또는 **GPT-4o**. 최고의 CJK: **Qwen 3**.

---

## 📖 문서

### 사용자 가이드 (11개 언어)

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### 프로젝트 문서

- **[CHANGELOG.md](CHANGELOG.md)** — 전체 버전 기록
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — 버전 관리 정책
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — 현재 로드맵
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — 플러그인 아키텍처 설계
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ 소스에서 빌드

**전제 조건**: Node.js 18+, Rust 1.70+, npm. Linux에서는 추가로: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # 개발
npm run tauri:build  # 프로덕션 빌드
```

Rust 백엔드: `cd src-tauri && cargo check`로 Tauri 명령이 플랫폼에서 컴파일되는지 확인합니다.

---

## 💖 지원

GameStringer가 원하는 언어로 게임을 플레이하는 데 도움이 되었다면:

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

## 📜 라이선스

**Source-Available License v1.1** — 소스 코드는 공개되어 있으며 직접 빌드할 수 있지만, OSI 승인 "오픈 소스"는 아닙니다.

- ✅ 개인 사용 무료
- ✅ 자신을 위해 자유롭게 검사, 빌드, 수정
- ❌ 상업적 사용에는 서면 허가 필요
- ❌ 수정된 버전의 재배포에는 서면 허가 필요

자세한 내용은 [LICENSE](LICENSE)를 참조하세요. 질문이 있으신가요? [Discussion](https://github.com/rouges78/GameStringer/discussions)을 여세요.

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — Unity modding 프레임워크 (BepInEx Team)
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — Unity 번역 프레임워크 (bbepis)
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — Unreal `.locres` 파서 (akintos)
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — GameMaker modding (krzys-h)
- **[Tauri](https://tauri.app)** — 데스크톱 앱 프레임워크
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — OCR 엔진
- **[Ollama](https://ollama.com)** — 로컬 LLM 런타임
- **[Supabase](https://supabase.com)** — Community Chat용 실시간 백엔드

---

<p align="center">
  자신의 언어로 게임을 플레이하고 싶은 게이머를 위해 ❤️로 제작됨<br>
  <strong>GameStringer v1.8.0</strong> · © 2025-2026 GameStringer Team
  <strong>GameStringer v1.7.0</strong> · © 2025-2026 GameStringer Team
</p>
