<p align="center">
  <img src="public/logo.png" alt="GameStringer Logo" width="180" />
</p>

<h1 align="center">GameStringer</h1>

<p align="center">
  <strong>AIを使ってビデオゲームをあらゆる言語に翻訳するデスクトップアプリ。</strong><br>
  ライブラリからゲームを選択し、言語を選び、翻訳をクリックするだけ — 完了。
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
  <a href="#-gamestringerとは">GameStringerとは</a> ·
  <a href="#-ダウンロード">ダウンロード</a> ·
  <a href="#-動作の仕組み">動作の仕組み</a> ·
  <a href="#-prediction-tool-pt">P.T.</a> ·
  <a href="#-対応ゲームエンジン">エンジン</a> ·
  <a href="#-機能">機能</a> ·
  <a href="#-ソースからのビルド">ビルド</a>
</p>

<p align="center">
  <strong>🌍 あなたの言語で読む:</strong><br>
  <a href="README.md">🇬🇧 English</a> ·
  <a href="README_IT.md">🇮🇹 Italiano</a> ·
  <a href="README_ES.md">🇪🇸 Español</a> ·
  <a href="README_FR.md">🇫🇷 Français</a> ·
  <a href="README_DE.md">🇩🇪 Deutsch</a> ·
  <a href="README_PT.md">🇧🇷 Português</a> ·
  🇯🇵 日本語 ·
  <a href="README_ZH.md">🇨🇳 中文</a> ·
  <a href="README_KO.md">🇰🇷 한국어</a> ·
  <a href="README_RU.md">🇷🇺 Русский</a> ·
  <a href="README_PL.md">🇵🇱 Polski</a>
</p>

---

## デモ

<p align="center">
  <img src="docs/demo/demo-library.gif" alt="GameStringer Library Demo" width="720" />
</p>

<p align="center">
  <em>🎮 ゲームライブラリ — Steam, Epic, GOG, Origin, Ubisoft, Amazon, itch.ioの自動検出</em>
</p>

<p align="center">
  <img src="docs/demo/demo-translator.gif" alt="GameStringer AI Translator Demo" width="720" />
</p>

<p align="center">
  <em>🤖 AI翻訳 — 20以上のプロバイダー、Quality Badges 0-100、Translation Memory</em>
</p>

<p align="center">
  <img src="docs/demo/demo-patcher.gif" alt="GameStringer Game Patcher Demo" width="720" />
</p>

<p align="center">
  <em>🔧 ワンクリックパッチャー — BepInEx、XUnity、UnrealLocres、Bethesda BSA/BA2、CRI CPK、自動バックアップ</em>
</p>

<p align="center">
  <img src="docs/demo/demo-chat.gif" alt="GameStringer Community Chat Demo" width="720" />
</p>

<p align="center">
  <em>💬 Community Chat — Supabase Realtime、カスタムルーム、オンラインプレゼンス</em>
</p>

<p align="center">
  <img src="docs/demo/demo-tray.gif" alt="GameStringer Tray Icon Demo" width="480" />
</p>

<p align="center">
  <em>🖥️ System Tray — クイックアクション、Ollamaステータスのライブ表示、ツールサブメニュー</em>
</p>

---

## 🎮 GameStringerとは？

GameStringerは、あなたの言語に対応していないビデオゲームを翻訳できる**デスクトップアプリケーション**（WindowsとLinux）です。

ほとんどのゲームはテキストをファイルに保存しています — JSON、XML、CSV、`.locres`、`.rpy`、BSA/BA2、CPK、Unity LocalizationのStringTable、その他多くのフォーマット。GameStringerは**ゲームフォルダをスキャン**し、それらのファイルを見つけ、お好みの**AI翻訳プロバイダー**（OpenAI、Claude、Gemini、DeepSeek、Ollama、他20以上）を通してテキストを送信し、翻訳されたテキストをゲームに**パッチして戻します**。ワンクリック、技術知識不要です。

**Unityゲーム**でコンパイル済みアセットにテキストがロックされている場合、GameStringerは**BepInEx + XUnity.AutoTranslatorを自動的にインストール**します — 手動セットアップは不要です。**Bethesdaのゲーム**（Skyrim、Fallout、Starfield）では、BSA/BA2/ESPをネイティブにパースします。**CRI Middlewareのゲーム**（ペルソナ、龍が如く）では、CPK/CRILAYLA/MSG/BMDを処理します。**Unreal Engine**では、`.locres`を直接編集します。

**機械翻訳ウェブサイトではありません。** 完全なパイプラインです：**P.T.で分析 → エンジン検出 → テキスト抽出 → AIで翻訳 → 品質チェック → パッチを戻す → プレイ。**

---

## 📥 ダウンロード

最新リリースは**[GitHub Releases](https://github.com/rouges78/GameStringer/releases)**から入手してください：

| プラットフォーム | ファイル | 備考 |
|----------|------|-------|
| **Windows** | `GameStringer-Setup.exe` | インストーラー（推奨） |
| **Windows** | `GameStringer-Portable.zip` | インストール不要 |
| **Linux** | `GameStringer.AppImage` | ユニバーサル（推奨） |
| **Linux** | `GameStringer.deb` | Debian / Ubuntu |

**要件：** Windows 10+またはLinux（Ubuntu 22.04+、Fedora 38+）、4 GB RAM（ローカルAIには8 GB+）、500 MBのディスク容量。リリースは**コード署名**され、Tauri Updater経由で**自動更新**されます。

---

## 🚀 動作の仕組み

1. GameStringerを**インストール**して起動
2. **ゲームライブラリが自動的に読み込まれます** — Steam、Epic、GOG、Origin、Ubisoft、Amazon、itch.io（数秒で800以上のゲームを検出）
3. **ゲームを選択** → オプションで**P.T.（Prediction Tool）**を実行して、難易度、推定時間、最適なLLMチェーンを確認
4. **「String it!」**をクリック — GameStringerが自動的にスキャン、抽出、翻訳、パッチ適用
5. **あなたの言語でプレイ** — パッチ適用前に必ずバックアップが作成されます

それだけです。コマンドラインも、手動でのファイル編集も、Modding経験も不要です。

---

## 🧠 Prediction Tool (P.T.)

> **GameStringerで最も強力な機能。** 翻訳を闇雲に始めないでください — まず分析を。

P.T.は、あらゆる翻訳の*前に*実行される深層分析エンジンです。ゲームフォルダをスキャンし、エンジンを検出し、翻訳可能なテキストの量を見積もり、次の情報を提供します：

- **Difficulty Score 0–100** — 文字列の量、エンジンの複雑さ、DRM、エンコーディング、言語的課題の総合重み
- **推定時間** を**18のLLMモデル**で算出 — Ollama（Gemma 4、Qwen 3、Llama）、OpenAI GPT-4/4o、Claude 3.5、Gemini、DeepL、DeepSeek、Groq
- **5つの推奨LLMチェーン**：Local（プライバシー）、Cloud（品質）、Hybrid（バランス）、Budget、Premium — それぞれコストと品質のスコア付き
- **DRM検出**：Denuvo、VMProtect、Steam DRM、EAC、BattlEye — 試す前に警告
- **エンコーディング分析**：Shift-JIS、UTF-8、UTF-16、Big5、EUC-KRをファイルごとに検出
- **翻訳の複雑さ**：敬語、性別の一致、RTL、ルビ/振り仮名、CJK固有の処理
- **信頼度スコア**と**ワークフロー計画** — 「String it!」クリック時に実行される正確なステップ
- **レポートエクスポート**（JSON + Markdown）共有やアーカイブ用

### P.T.Rank — クイックランキング

複数のゲームでP.T.を実行した後、**P.T.Rank**を開くと、分析されたすべてのタイトルを難易度順に表示できます。翻訳キューの計画に最適：簡単な勝利から始めて、80万文字列のRPGは最後まで取っておきましょう。

### Dry Run Scanner

一度に1つのゲームを分析したくない？ ライブラリページから**Dry Run**を実行すると、**Steamライブラリ全体（800以上のゲーム）を一括スキャン**でき、**ファイルの変更は一切ありません**。各ゲームを**Ready**（対応エンジン + 抽出可能な文字列）、**Errors**（マニフェストの問題 / DRMブロッカー）、**Unsupported**（不明なエンジン / テキストなし）に分類するJSONレポートを取得できます。進捗はリアルタイムで、何も触れないためバックアップは不要です。

### String it! Smart Gate

ゲーム詳細ページの**「String it!」**ボタンはスマートです：過去24時間以内にP.T.で分析されていれば、翻訳ウィザードを直接起動します。そうでない場合は、まずP.T.を実行することを提案します（ワンクリックで「Run P.T. first」/「String it! anyway」を選択）。DRMでロックされていたり5分で終わるゲームに対する無駄な実行はもうありません。

---

## 🎯 対応ゲームエンジン

GameStringerは、さまざまな深度レベルで**20以上のエンジン**をサポートしています：

| エンジン | サポート | 動作の仕組み |
|--------|---------|--------------|
| **Unity** | ✅ 完全 | BepInEx + XUnity.AutoTranslator + Unity Localization Packageパイプライン（StringTable、SharedTableData、Addressables、Smart Strings）を自動インストール |
| **Unreal Engine** | ✅ 完全 | UnrealLocresによる`.locres`の抽出とパッチ |
| **Unreal _P.pak** | ✅ 完全 | `<GameStringer>_P.pak`としてModパッケージ化、Paksフォルダ経由でロード |
| **Godot** | ✅ 完全 | ネイティブ`.translation`ファイルサポート |
| **RPG Maker** | ✅ 完全 | MV/MZ JSON、VX/Ace（Trans経由）、XP（RMXP経由） |
| **Ren'Py** | ✅ 完全 | ダイアログ検出機能付きのネイティブ`.rpy`スクリプトパース |
| **GameMaker** | ⚡ 部分的 | UndertaleModTool統合経由 |
| **Telltale** | ✅ 完全 | `.langdb` / `.dlog`サポート |
| **Wolf RPG** | ✅ 完全 | WolfTrans統合 |
| **Kirikiri** | ✅ 完全 | `.ks` / `.scn`パース |
| **TyranoScript** | ✅ 完全 | JSONパッチ付きfast-path抽出器 |
| **Electron** | ✅ 完全 | ASARアンパック + i18n JSON検出 |
| **Bethesda（Skyrim/Fallout/Oblivion/Starfield）** | ✅ **NEW v1.6.0** | BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM（FULL/DESC/NAM1）パーサー、STRINGS/DLSTRINGS/ILSTRINGS |
| **CRI Middleware（ペルソナ/龍が如く/テイルズ/ドラゴンボール）** | ✅ **NEW v1.6.0** | CPK + CRILAYLA + MSG/BMD/FTDとShift-JIS/UTF-8/UTF-16の自動検出 |
| **Visionaire Studio** | ✅ 完全 | Daedalicアドベンチャー（Deponia、Ednaなど） |
| **Danganronpa WAD** | ✅ 完全 | WADアーカイブパーサー + STXダイアログパッチ |

> **Unityゲーム**は特別な扱いを受けます：翻訳可能なファイルが見つからない場合、GameStringerはそれがUnityゲームであることを検出し、ワンクリックで**BepInEx + XUnity.AutoTranslatorを自動インストール**することを提案します。インストール後に一度ゲームを起動し、再スキャンするだけで、すべてのテキストが翻訳可能になります。
>
> ⚠️ **アンチチート警告**：BepInEx（DLLインジェクション）はアンチチートシステム（EAC、BattlEye、Vanguard）をトリガーする可能性があります。GameStringerにはアンチチート検出が含まれており、警告します。**シングルプレイヤー / オフラインゲームでのみ使用してください。** P.T.は変更前にDRMを検出します。

---

## ✨ 機能

### 🤖 AI翻訳

- **20以上のプロバイダー**：OpenAI、Claude、Gemini、DeepSeek、Mistral、Groq、DeepL、Ollama（ローカル）、LM Studio、TranslateGemma、HY-MT、Qwen 3、NLLB-200、Cerebras、Together AI、Fireworks、OpenRouter、Cohere、Lingva、MyMemory
- **Context-aware**：ゲームのジャンル、キャラクターの声、トーン、ナラティブ vs UI vs ダイアログを理解
- **Translation Memoryと用語集**：プロジェクト全体での一貫性、用語集の自動抽出
- **Multi-LLM Compare**：複数のプロバイダーを並列実行し、文字列ごとに最高の結果を選択
- **Auto-Select Engine**（NEW v1.7.0）：対象言語 + ゲームジャンルに基づいてプロバイダーを動的にランク付けするプリセット
- **Quality gates**：翻訳された各文字列に対する自動QAスコアリング（0-100）とContentTypeBadge
- **Vision LLM Translator**：コンテキストにゲーム内スクリーンショットを使用（Ollama、Gemini、GPT-4o）
- **Live Quality Preview**：バッチ翻訳中にリアルタイムで品質スコアを表示
- **RTLサポート**：方向の自動検出と`dir`属性の処理

### 🧠 P.T. — Prediction Tool (v1.6.0)

- **Difficulty Score 0-100**、重み付けされた要因（量、エンジン、DRM、エンコーディング、複雑さ）
- **18のLLMモデルに対する時間推定**（Gemma 4 27B MoE A4B / E4B / E2Bを含む）
- **5つのLLMチェーン**（Local / Cloud / Hybrid / Budget / Premium）、コストと品質の推定付き
- **DRM / アンチチート検出**（Denuvo、VMProtect、Steam DRM、EAC、BattlEye、Vanguard）
- **エンコーディング分析**ファイルごと（Shift-JIS、UTF-8/16、Big5、EUC-KR）
- **翻訳の複雑さ分析**（敬語、性別、CJK、ルビ、RTL）
- **P.T.Rank / Quick Ranking** — 分析されたすべてのゲームを難易度順にソート
- **Dry Run Scanner** — Steamライブラリ全体（800以上のゲーム）を変更なしで一括スキャン
- **Workflow Orchestrator** — 6以上のエンジンに対するユニバーサルfast pathを備えた実際の実行エンジンとリアルタイム進捗
- **予測キャッシュ**（24時間）— 以前に分析したゲームの即座な再オープン
- **レポートエクスポート**（JSON + Markdown）共有とアーカイブ用

### 📚 ゲームライブラリ

- **自動検出**：Steam（Family Sharing付き）、Epic、GOG Galaxy、Origin/EA、Ubisoft Connect、Amazon Games、itch.io
- インストール済みライブラリから数秒で**800以上のゲーム**を認識
- カバーアート、メタデータ、エンジンバッジ、VRバッジ、インストール状況付きの**ゲームカード**
- **ホバークイックアクション**：String it!、Batch、Community、P.T. — すべてワンクリック
- **Game Update Tracker**：Steamが翻訳済みゲームを更新したことを検出（`buildid`経由）、パッチの整合性を確認（BepInExファイル、`_P.pak`の存在）、再パッチが必要な場合は警告
- 特定のゲームの追跡を解除する**「Stop monitoring」**ボタン

### 🔧 翻訳ツール

- **One-Click Translate**（「String it!」）：スキャン → 翻訳 → パッチを単一のフローで
- **Batch Translation**：ゲーム全体やフォルダを一度に翻訳
- **字幕翻訳**：SRT、VTT、ASS/SSAとタイミングの保持
- **OCR Translator**：レトロゲーム（8-bit、16-bit、DOSのプリセット）から実際のTauri Tesseractバックエンドでテキストを抽出
- **Voice Pipeline**：speech-to-text → 翻訳 → text-to-speech、**Duration Matching**（NEW v1.7.0）付き — 元の音声の長さに合わせて速度を自動調整
- **Lip Sync**（NEW v1.7.0）：ビスム生成のためのRhubarb統合、Unity/Unreal向けエクスポート
- **Gridly CSV Export/Import**（NEW v1.7.0）：Gridly/Lokalise/Crowdin対応の多言語フォーマット
- **リアルタイムオーバーレイ**：VR/スクリーンオーバーレイ経由でプレイ中に翻訳を確認
- **Auto-Translate Review**：プログレスバー付きの「Translate all untranslated」ボタン
- **Lore Assistant**：ゲームのloreとダイアログを知るRAGチャット
- **Character Voice Profiles**：キャラクターごとに性格、トーン、話し方を定義
- **Translation Confidence Heatmap**：すべての翻訳の品質の視覚的な概要

### 🎮 ゲームエンジンパッチャー

- **Unity**：BepInEx + XUnity.AutoTranslator自動インストーラー、Unity Localization Package（StringTable、SharedTableData、Addressablesカタログ、Smart Stringsバリデーター）
- **Unreal Engine**：`.locres`抽出 + `_P.pak` Modパッケージ化
- **Bethesda Engine Patcher**（NEW v1.6.0）：Skyrim LE/SE/AE、Fallout 3/NV/4、Oblivion、Starfield — BSA v103-105 + BA2 GNRL/DX10 + ESP/ESM（FULL/DESC/NAM1）
- **CRI Middleware Patcher**（NEW v1.6.0）：ペルソナ5 Royal、龍が如く、テイルズ、ドラゴンボール — CPK + CRILAYLA + MSG/BMD/FTD
- **Ren'Py**、**RPG Maker**、**Godot**、**GameMaker**、**Kirikiri**、**Wolf RPG**、**Telltale**、**Visionaire**、**Danganronpa WAD** — すべてネイティブパーサー付き
- **Wizard Stepper**：すべてのパッチャー用の共有マルチステップUI
- すべてのパッチャー用の**Universal PO Export**（gettext `.po`）、プロジェクト/言語/ソース/エンジンメタデータ付き
- **自動バックアップ**：各パッチの前、ワンクリック復元付き

### 🔌 高度な機能

- **Auto-Hook Scanner**：ハードコードされた文字列のプロセスメモリスキャン（Windows WinAPI）
- **System Monitor**：ローカルLLMの計画用のリアルタイムVRAM/RAM使用状況
- **Ollama Setup Wizard**：ローカルAIのステップバイステップインストール
- **Ollama Manager**：ollama.comレジストリからのモデルの自動発見 + フォーカス/ナビゲーション時の自動更新
- **Debug Console**：ログインターセプト付きの統合コンソール
- **Video Extractor**（v1.7.0）：AIアップスケーリング付きでレトロ/モダンゲームからFMVビデオを抽出・変換
- **Plugin System**：サードパーティプラグインの設計ドキュメント（`PLUGIN_SYSTEM.md`を参照）
- **Community Hub**：Translation Memoriesの共有とダウンロード + GitHub Discussions統合
- **Public API v1**：統合用のRESTエンドポイント（`/api/v1/translate`、`/api/v1/batch`）

### 💬 Community Chat

- Supabase Realtime経由で他の翻訳者との**リアルタイムチャット**
- **4つのデフォルトルーム**：General、Translations、Feedback & Bugs、Announcements
- **カスタムルーム**：特定のゲームやプロジェクト用のルームを作成
- **Auto-Bridge Auth**：GameStringerプロファイルがSupabaseに自動同期 — 追加ログイン不要
- **オンラインプレゼンス**：各ルームで誰がオンラインかを確認
- RLSによって所有権が強制されたメッセージの**返信 / 編集 / 削除**
- 右下隅の**拡張可能なドロワーウィジェット**

### ♿ アクセシビリティ (v1.6.0)

- **WCAG 2.1 AA sweep** — アイコンボタンの`aria-label`、セマンティックな`CardTitle`見出し、すべてのプリミティブの`focus-visible`、skip-to-contentリンク、`main`ランドマーク、イタリア語の`sr-only`ヘルパー
- アニメーション全体で**`prefers-reduced-motion`**を尊重
- **`forced-colors`**（Windows High Contrastモード）を尊重
- **11言語UI**：IT、EN、ES、FR、DE、JA、ZH、KO、PT、RU、PL
- 方向の自動検出を伴う**RTLレイアウトサポート**

### 🎨 Design System (v1.6.0)

- `cva`経由の**Cardバリアント**：default、muted、highlight、success、error、warning
- `xs`と`icon-sm`を含む**Buttonサイズ**
- **Text utilities**：`text-micro`（9px）、`text-2xs`（10px） — 任意のTailwind値はもう不要
- **Radix UI統合**：37ファイルを`@radix-ui/react-*`から`radix-ui`に移行、27パッケージを削除
- **最適化されたバンドル**：radix-ui、framer-motion、recharts、cmdkの`optimizePackageImports`

### 🖥️ アプリ

- **署名付き自動更新**：Tauri Updater経由でアプリからワンクリックで更新
- **プロファイル**：リカバリーキー付きの複数のユーザープロファイル
- **Global Hotkeys**：`Ctrl+Shift+T` OCR、`Ctrl+Shift+Q` Quick Translate、`Ctrl+Alt+O` Overlay、`Alt+T` XUnityトグル
- **System Tray**：クイックアクション、Ollamaステータスのライブ表示、ツールサブメニュー
- **クロスプラットフォーム**：ネイティブビルドでのWindowsとLinux
- **Windowsトレイ修正**：子プロセスのスポーン時のコンソールフラッシュループを防止

---

## 🔧 AIプロバイダー

| プロバイダー | APIキー | Free Tier | 最適な用途 |
|----------|---------|-----------|----------|
| **Ollama** | 不要（ローカル） | ✅ 無制限 | プライバシー、オフライン |
| **LM Studio** | 不要（ローカル） | ✅ 無制限 | プライバシー、GGUFモデル |
| **TranslateGemma** | 不要（Ollama） | ✅ 無制限 — 55言語、Google | **推奨スタート** |
| **HY-MT1.5** | 不要（Ollama） | ✅ 無制限 — 約1GB RAM、Tencent | 低RAMマシン |
| **Qwen 3** | 不要（Ollama） | ✅ 無制限 — 多言語 | CJK言語 |
| **Gemma 4** | 不要（Ollama） | ✅ 無制限 — 27B MoE A4B/E4B/E2B | ローカル品質 |
| **Gemini** | 必要 | ✅ 無料枠（15 RPM） | **推奨クラウド** |
| **DeepSeek** | 必要 | ✅ $0.14/1M input | 低コストクラウド |
| **Groq** | 必要 | ✅ 14,400リクエスト/日 | 速度 |
| **Mistral** | 必要 | ✅ 無料枠 | EUクラウド |
| **OpenAI** | 必要 | 有料 | GPT-4o品質 |
| **Claude** | 必要 | 有料 | ニュアンス、長いコンテキスト |
| **DeepL** | 必要 | ✅ 500k文字/月 | ヨーロッパ言語 |
| **MyMemory** | 不要 | ✅ 無制限 | フォールバック |
| **Lingva** | 不要 | ✅ 無制限 | Google MTミラー |
| **Cerebras** | 必要 | ✅ 無料枠 | 速度 |
| **Together AI** | 必要 | ✅ $25無料クレジット | オープンモデル |
| **Fireworks** | 必要 | ✅ 無料枠 | オープンモデル |
| **OpenRouter** | 必要 | ✅ 無料モデル | モデルの多様性 |
| **NLLB-200** | 必要 | ✅ 200言語 | 希少言語 |
| **Cohere** | 必要 | ✅ 無料トライアル | RAG |

**スタートに推奨**：Ollama経由の**TranslateGemma**（無料、ローカル、55言語）または**Gemini**（無料枠、クラウド）。低RAM：**HY-MT1.5**（約1GB）。最高品質：**Claude 3.5**または**GPT-4o**。最高のCJK：**Qwen 3**。

---

## 📖 ドキュメント

### ユーザーガイド（11言語）

| | | |
|---|---|---|
| 🇮🇹 [Italiano](docs/GUIDA_UTENTE.md) | 🇬🇧 [English](docs/USER_GUIDE_EN.md) | 🇪🇸 [Español](docs/USER_GUIDE_ES.md) |
| 🇫🇷 [Français](docs/USER_GUIDE_FR.md) | 🇩🇪 [Deutsch](docs/USER_GUIDE_DE.md) | 🇯🇵 [日本語](docs/USER_GUIDE_JA.md) |
| 🇨🇳 [中文](docs/USER_GUIDE_ZH.md) | 🇰🇷 [한국어](docs/USER_GUIDE_KO.md) | 🇧🇷 [Português](docs/USER_GUIDE_PT.md) |
| 🇷🇺 [Русский](docs/USER_GUIDE_RU.md) | 🇵🇱 [Polski](docs/USER_GUIDE_PL.md) | |

### プロジェクトドキュメント

- **[CHANGELOG.md](CHANGELOG.md)** — 完全なバージョン履歴
- **[docs/VERSIONING.md](docs/VERSIONING.md)** — バージョニングポリシー
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** — 現在のロードマップ
- **[PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md)** — プラグインアーキテクチャ設計
- **[LICENSE](LICENSE)** — Source-Available License v1.1

---

## 🛠️ ソースからのビルド

**前提条件**：Node.js 18+、Rust 1.70+、npm。Linuxの場合は追加で：`libwebkit2gtk-4.1-dev`、`libayatana-appindicator3-dev`、`librsvg2-dev`。

```bash
git clone https://github.com/rouges78/GameStringer.git
cd GameStringer
npm install
npm run dev          # 開発
npm run tauri:build  # プロダクションビルド
```

Rustバックエンド：`cd src-tauri && cargo check`でプラットフォーム上でTauriコマンドがコンパイルされることを確認してください。

---

## 💖 サポート

GameStringerがあなたの言語でゲームをプレイするのに役立った場合：

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

## 📜 ライセンス

**Source-Available License v1.1** — ソースコードは公開されており、自分でビルドできますが、OSI承認の「Open Source」ではありません。

- ✅ 個人利用無料
- ✅ 自分自身のために検査、ビルド、変更可能
- ❌ 商用利用には書面による許可が必要
- ❌ 変更版の再配布には書面による許可が必要

詳細は[LICENSE](LICENSE)を参照してください。質問は[Discussion](https://github.com/rouges78/GameStringer/discussions)を開いてください。

---

## 🙏 Credits

- **[BepInEx](https://github.com/BepInEx/BepInEx)** — Unity moddingフレームワーク（BepInEx Team）
- **[XUnity.AutoTranslator](https://github.com/bbepis/XUnity.AutoTranslator)** — Unity翻訳フレームワーク（bbepis）
- **[UnrealLocres](https://github.com/akintos/UnrealLocres)** — Unreal `.locres`パーサー（akintos）
- **[UndertaleModTool](https://github.com/krzys-h/UndertaleModTool)** — GameMaker modding（krzys-h）
- **[Tauri](https://tauri.app)** — デスクトップアプリフレームワーク
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** — OCRエンジン
- **[Ollama](https://ollama.com)** — ローカルLLMランタイム
- **[Supabase](https://supabase.com)** — Community Chat用のリアルタイムバックエンド

---

<p align="center">
  自分の言語でプレイしたいゲーマーのために❤️で作られました<br>
  <strong>GameStringer v1.7.0</strong> · © 2025-2026 GameStringer Team
</p>
