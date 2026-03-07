param([string]$lang)

$docsPath = "c:\dev\GameStringer\docs"

$sections = @{
    "JA" = @{
        file = "USER_GUIDE_JA.md"
        indexAnchor = "23. [トラブルシューティング](#トラブルシューティング)"
        indexNew = "24. [用語集](#用語集)`n25. [コンテキストハーベスター](#コンテキストハーベスター)`n26. [翻訳メモリ](#翻訳メモリ)`n27. [OCR翻訳ツール](#ocr翻訳ツール)`n28. [AIレビュー](#aiレビュー)`n29. [AIパイプライン](#aiパイプライン)`n30. [感情翻訳ツール](#感情翻訳ツール)`n31. [文化的適応](#文化的適応)"
        bodyAnchor = "---`n`n## v1.4.0 の新機能"
        bodySections = @"
---

## 用語集

用語集は各ゲームのカスタム用語辞典を管理し、翻訳の一貫性を保証します。

### 機能

- **用語ティア**：
  - 🔴 **Locked** — 常に同じ翻訳（固有名詞、魔法、場所）
  - 🟡 **Synced** — 一貫した翻訳、コンテキストに応じて適応可
  - 🟢 **Flexible** — 自由な翻訳
- **カテゴリ**：キャラクター、場所、アイテム、スキル、クエスト、UI、システム、ロア、クリーチャー、勢力
- **自動抽出**：AIによる用語漏れの提案
- **一貫性チェック**：全ファイルで統一的に翻訳されているか検証
- **インポート/エクスポート**：ゲーム間で共有するためのCSV・JSON

### 使い方

1. **高度なツール → 用語集**へ移動
2. リストからゲームを選択
3. 手動で用語を追加、または**「用語を抽出」**でAI提案を取得
4. 各用語のティアを設定
5. 翻訳時に自動で用語集が適用されます

---

## コンテキストハーベスター

AI翻訳前にテキスト文字列を分類し、コンテキスト情報で補充して翻訳品質を向上させます。

### 機能

- **自動分類**：画面タイプを識別（メニュー、ダイアログ、ナレーション、チュートリアル、システム）
- **話者認識**：話し中の人物とトーン（フォーマル、カジュアル、急迫的）を活用
- **コンテキストメタデータ**：各文字列にゲームジャンル、コンテンツタイプ、トーンを付与
- **ハーベスト保存**：抽出されたコンテキストを保存し、将来のセッションで再利用
- **バッチ処理**：ファイル全体を一度の操作で分析

### 使い方

1. **高度なツール → コンテキストハーベスター**へ移動
2. 文字列を貼り付けまたはファイルを読み込む
3. **「分析」**をクリックして各文字列を分類
4. AI翻訳の入力として使用するJSON結果をダウンロード

---

## 翻訳メモリ

完了した翻訳すべての永続データベースで、新しいセッションで自動再利用されます。

### 機能

- **自動再利用**：既翻訳済み文字列は新たなAI呼び出しなしで提案
- **検索**：原文、翻訳、ゲーム名で検索
- **ゲームフィルター**：特定タイトルの翻訳のみ表示
- **統計**：総ユニット、ゲーム別分布、最終更新日
- **エクスポート**：他のCATツール向けJSON、CSV、TMX
- **インポート**：TMXまたはCSVから既存の翻訳をインポート

### 使い方

1. **高度なツール → 翻訳メモリ**へ移動
2. 検索バーで以前の翻訳を検索
3. 必要に応じて単一ユニットを編集または削除
4. AI翻訳時にメモリが自動参照されます

---

## OCR翻訳ツール

ゲームウィンドウやスクリーンショットからリアルタイムでテキストをキャプチャし、即座に翻訳します。

### 機能

- **リアルタイムキャプチャ**：設定可能な間隔で画面を分析
- **ソース言語**：日本語、英語、簡体字、韓国語
- **ウィンドウ選択**：ゲームウィンドウを直接指定
- **領域選択**：分析する画面の特定領域を定義
- **信頼度**：各検出テキストの信頼度を表示
- **グローバルホットキー**：キーボードショートカットでキャプチャを切り替え
- **翻訳キャッシュ**：同じ文字列の以前の翻訳を再利用

### 使い方

1. サイドバーから**OCR翻訳ツール**へ移動
2. ゲームのソース言語を選択
3. **「ウィンドウを選択」**をクリックしてゲームウィンドウを選択
4. *(任意)* **「領域を選択」**で特定領域を設定
5. **「開始」**を押して自動キャプチャと翻訳を開始

---

## AIレビュー

エラー検出と修正提案による翻訳の自動品質レビュー。

### 機能

- **単一モード**：原文/翻訳のペアをレビュー
- **バッチモード**：`原文|翻訳`形式で行単位の大量レビュー
- **問題カテゴリ**：正確性、流暢さ、用語、トーン、構造
- **深刻度レベル**：クリティカル、警告、情報
- **自動修正**：細かい問題の自動修正
- **統計**：バッチごとの全体スコア 0–100

### 使い方

1. **高度なツール → AIレビュー**へ移動
2. **単一**または**バッチ**を選択
3. 原文と翻訳を貼り付ける
4. **「レビュー」**をクリックしてレポートを受け取る
5. **「自動修正」**で提案された修正を適用

---

## AIパイプライン

ワンクリックで最高品質の翻訳を得るための自動化された6ステップのワークフロー。

### パイプラインのステップ

1. **Harvest** — コンテキストを抽出・分類
2. **Translate** — 設定されたAIプロバイダーで翻訳
3. **QA Check** — 自動品質検証
4. **Auto-Fix** — 問題を修正
5. **Review** — 最終AIレビュー
6. **Score** — 最終スコア 0–100 を計算

### 利用可能なプリセット

- **Quick** — 基本ステップ（Translate + QA Check）
- **Max Quality** — 6ステップすべてを順番に

### 使い方

1. **高度なツール → AI パイプライン**へ移動
2. 翻訳する文字列を貼り付ける
3. プリセットを選択するか手動でステップを設定
4. **「パイプラインを実行」**をクリック
5. 各文字列のスコア付き最終レポートをダウンロード

---

## 感情翻訳ツール

元のダイアログに含まれる感情を分析・保持する翻訳ツール。

### 機能

- **感情分析**：主要な感情を検出（怒り、悲しみ、恐れ、喜び、中立、驚き、嫌悪）
- **強度**：感情的強度レベルを計測（0–100）
- **トーン保持**：AIが同じ感情的インパクトを翻訳に保つよう誘導
- **EmotionBadge**：感情と強度を示す各文字列のビジュアルラベル
- **バッチ統計**：ファイル全体の感情分布

### 使い方

1. **高度なツール → 感情翻訳ツール**へ移動
2. 翻訳するテキストを貼り付ける
3. 対象言語を選択
4. **「分析して翻訳」**をクリック
5. 結果は各文字列の感情付きで翻訳を表示

---

## 文化的適応

翻訳されたテキストを分析し、文化的に問題のある要素を特定して対象文化向けの修正を提案します。

### 機能

- **対応文化**：IT、EN、DE、FR、ES、JA、KO、ZH、PT、RU
- **分析カテゴリ**：慣用表現、文化的参照、単位/通貨、象徴的な色、丁寧語表現、ユーモア
- **具体的な提案**：各要素に対して対象文化に適した代替案を提案
- **適応スコア**：修正が必要なテキストの割合

### 使い方

1. **高度なツール → 文化的適応**へ移動
2. 翻訳されたテキストを貼り付ける
3. ソースと対象の文化を選択
4. **「分析」**をクリック
5. 最終公開前に提案を適用

---

## v1.4.0 の新機能
"@
    }
    "KO" = @{
        file = "USER_GUIDE_KO.md"
        indexAnchor = "24. [문제 해결](#문제-해결)"
        indexNew = "25. [용어집](#용어집)`n26. [컨텍스트 하베스터](#컨텍스트-하베스터)`n27. [번역 메모리](#번역-메모리)`n28. [OCR 번역기](#ocr-번역기)`n29. [AI 검토](#ai-검토)`n30. [AI 파이프라인](#ai-파이프라인)`n31. [감정 번역기](#감정-번역기)`n32. [문화적 적응](#문화적-적응)"
        bodyAnchor = "---`n`n## What's New in v1.4.0"
        bodySections = @"
---

## 용어집

용어집은 각 게임에 대한 맞춤형 용어 사전을 관리하여 번역의 일관성을 보장합니다.

### 기능

- **용어 등급**:
  - 🔴 **Locked** — 항상 동일하게 번역 (고유 명사, 마법, 장소)
  - 🟡 **Synced** — 일관된 번역, 문맥에 따라 적응 가능
  - 🟢 **Flexible** — 자유로운 번역
- **카테고리**: 캐릭터, 장소, 아이템, 스킬, 퀘스트, UI, 시스템, 로어, 크리처, 세력
- **자동 추출**: AI가 추가할 용어를 제안
- **일관성 검사**: 모든 파일에서 균일하게 번역되는지 확인
- **가져오기/내보내기**: 게임 간 공유를 위한 CSV 및 JSON

### 사용 방법

1. **고급 도구 → 용어집**으로 이동
2. 목록에서 게임 선택
3. 수동으로 용어 추가 또는 **"용어 추출"**로 AI 제안 받기
4. 각 용어의 등급 설정
5. 번역 시 자동으로 용어집 적용

---

## 컨텍스트 하베스터

AI 번역 전에 텍스트 문자열을 분류하고 컨텍스트로 보강하여 번역 품질을 향상시킵니다.

### 기능

- **자동 분류**: 화면 유형 식별 (메뉴, 대화, 내레이션, 튜토리얼, 시스템)
- **화자 인식**: 누가 말하는지와 어조 유형 (격식체, 구어체, 공격적) 추론
- **컨텍스트 메타데이터**: 각 문자열에 게임 장르, 콘텐츠 유형, 어조 부여
- **하베스트 저장**: 추출된 컨텍스트를 저장하여 이후 세션에서 재사용
- **일괄 처리**: 한 번의 작업으로 전체 파일 분석

### 사용 방법

1. **고급 도구 → 컨텍스트 하베스터**로 이동
2. 문자열을 붙여넣거나 파일 불러오기
3. **"분석"**을 클릭하여 각 문자열 분류
4. AI 번역의 입력으로 사용할 JSON 결과 다운로드

---

## 번역 메모리

완료된 모든 번역의 영구 데이터베이스로, 새 세션에서 자동으로 재사용됩니다.

### 기능

- **자동 재사용**: 이미 번역된 문자열은 새 AI 호출 없이 제안
- **검색**: 원문, 번역 또는 게임 이름으로 검색
- **게임 필터**: 특정 타이틀의 번역만 표시
- **통계**: 총 단위, 게임별 분포, 마지막 수정 날짜
- **내보내기**: 다른 CAT 도구용 JSON, CSV, TMX
- **가져오기**: TMX 또는 CSV에서 기존 번역 가져오기

### 사용 방법

1. **고급 도구 → 번역 메모리**로 이동
2. 검색창으로 이전 번역 검색
3. 필요에 따라 개별 단위 편집 또는 삭제
4. AI 번역 시 메모리가 자동으로 참조됨

---

## OCR 번역기

게임 창이나 스크린샷에서 실시간으로 텍스트를 캡처하여 즉시 번역합니다.

### 기능

- **실시간 캡처**: 설정 가능한 간격으로 화면 분석
- **소스 언어**: 일본어, 영어, 중국어 간체, 한국어
- **창 선택**: 게임 창을 직접 지정
- **영역 선택**: 분석할 화면의 특정 영역 정의
- **신뢰도**: 각 감지된 텍스트의 신뢰도 표시
- **전역 단축키**: 키보드 단축키로 캡처 전환
- **번역 캐시**: 동일한 문자열에 대한 이전 번역 재사용

### 사용 방법

1. 사이드바에서 **OCR 번역기**로 이동
2. 게임의 소스 언어 선택
3. **"창 선택"**을 클릭하여 게임 창 선택
4. *(선택 사항)* **"영역 선택"**으로 특정 영역 설정
5. **"시작"**을 눌러 자동 캡처 및 번역 시작

---

## AI 검토

오류 감지 및 수정 제안을 통한 번역 자동 품질 검토.

### 기능

- **단일 모드**: 원문/번역 쌍 검토
- **일괄 모드**: `원문|번역` 형식으로 줄별 대량 검토
- **문제 카테고리**: 정확성, 유창성, 용어, 어조, 구조
- **심각도 수준**: 심각, 경고, 정보
- **자동 수정**: 사소한 문제 자동 수정
- **통계**: 일괄 처리별 전체 점수 0–100

### 사용 방법

1. **고급 도구 → AI 검토**로 이동
2. **단일** 또는 **일괄** 중 선택
3. 원문과 번역 붙여넣기
4. **"검토"**를 클릭하여 보고서 수신
5. **"자동 수정"**으로 제안된 수정 사항 적용

---

## AI 파이프라인

클릭 한 번으로 최고 품질의 번역을 얻기 위한 자동화된 6단계 워크플로우.

### 파이프라인 단계

1. **Harvest** — 컨텍스트 추출 및 분류
2. **Translate** — 구성된 AI 제공자로 번역
3. **QA Check** — 자동 품질 검증
4. **Auto-Fix** — 발견된 문제 수정
5. **Review** — 최종 AI 검토
6. **Score** — 최종 점수 0–100 계산

### 사용 가능한 프리셋

- **Quick** — 필수 단계 (Translate + QA Check)
- **Max Quality** — 순서대로 모든 6단계

### 사용 방법

1. **고급 도구 → AI 파이프라인**으로 이동
2. 번역할 문자열 붙여넣기
3. 프리셋 선택 또는 수동으로 단계 구성
4. **"파이프라인 실행"** 클릭
5. 문자열별 점수가 포함된 최종 보고서 다운로드

---

## 감정 번역기

원본 대화에 있는 감정을 분석하고 보존하는 번역 도구.

### 기능

- **감정 분석**: 지배적인 감정 감지 (분노, 슬픔, 두려움, 기쁨, 중립, 놀라움, 혐오)
- **강도**: 감정적 강도 수준 측정 (0–100)
- **어조 보존**: AI가 번역에서 동일한 감정적 영향을 유지하도록 유도
- **EmotionBadge**: 감정과 강도가 표시된 각 문자열의 시각적 레이블
- **일괄 통계**: 전체 파일의 감정 분포

### 사용 방법

1. **고급 도구 → 감정 번역기**로 이동
2. 번역할 텍스트 붙여넣기
3. 대상 언어 선택
4. **"분석 및 번역"** 클릭
5. 결과는 각 문자열에 감정이 식별된 번역을 표시

---

## 문화적 적응

번역된 텍스트를 분석하여 문화적으로 문제 있는 요소를 식별하고 대상 문화에 맞는 조정을 제안합니다.

### 기능

- **지원 문화권**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **분석 카테고리**: 관용 표현, 문화적 참조, 단위/통화, 상징적 색상, 경어 표현, 유머
- **구체적인 제안**: 각 요소에 대해 대상 문화에 적합한 대안 제안
- **적응 점수**: 수정이 필요한 텍스트의 비율

### 사용 방법

1. **고급 도구 → 문화적 적응**으로 이동
2. 번역된 텍스트 붙여넣기
3. 소스 및 대상 문화 선택
4. **"분석"** 클릭
5. 최종 출판 전에 제안 사항 적용

---

## What's New in v1.4.0
"@
    }
    "PL" = @{
        file = "USER_GUIDE_PL.md"
        indexAnchor = "24. [Rozwiązywanie problemów](#rozwiązywanie-problemów)"
        indexNew = "25. [Słownik terminologiczny](#słownik-terminologiczny)`n26. [Context Harvester](#context-harvester)`n27. [Pamięć tłumaczeniowa](#pamięć-tłumaczeniowa)`n28. [Tłumacz OCR](#tłumacz-ocr)`n29. [Przegląd AI](#przegląd-ai)`n30. [Pipeline AI](#pipeline-ai)`n31. [Tłumacz emocji](#tłumacz-emocji)`n32. [Adaptacja kulturowa](#adaptacja-kulturowa)"
        bodyAnchor = "---`n`n## What's New in v1.4.0"
        bodySections = @"
---

## Słownik terminologiczny

Słownik terminologiczny zarządza niestandardowymi słownikami terminologii dla każdej gry, zapewniając spójność tłumaczeń.

### Funkcje

- **Poziomy terminów**:
  - 🔴 **Locked** — termin zawsze tłumaczony identycznie (nazwy własne, zaklęcia, miejsca)
  - 🟡 **Synced** — spójne tłumaczenie, adaptowalne do kontekstu
  - 🟢 **Flexible** — swobodne tłumaczenie
- **Kategorie**: postać, miejsce, przedmiot, umiejętność, quest, UI, system, lore, stworzenie, frakcja
- **Auto-ekstrakcja**: analiza AI w celu zaproponowania terminów
- **Sprawdzanie spójności**: weryfikuje jednolite tłumaczenie we wszystkich plikach
- **Import/Eksport**: CSV i JSON do udostępniania słowników między grami

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Słownik terminologiczny**
2. Wybierz grę z listy
3. Dodaj terminy ręcznie lub użyj **„Wyodrębnij terminy"** dla propozycji AI
4. Ustaw poziom dla każdego terminu
5. Słownik jest stosowany automatycznie podczas tłumaczeń

---

## Context Harvester

Analizuje ciągi tekstowe, klasyfikuje je i wzbogaca kontekstem przed tłumaczeniem AI, poprawiając jakość.

### Funkcje

- **Automatyczna klasyfikacja**: identyfikuje typ ekranu (menu, dialog, narracja, tutorial, system)
- **Rozpoznawanie mówiącego**: wnioskuje kto mówi i typ tonu (formalny, potoczny, agresywny)
- **Metadane kontekstowe**: każdy ciąg otrzymuje gatunek gry, typ treści i ton
- **Zapisywanie harvests**: wyodrębnione konteksty zapisywane i ponownie używane
- **Przetwarzanie wsadowe**: analizuje całe pliki w jednej operacji

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Context Harvester**
2. Wklej ciągi lub załaduj plik
3. Kliknij **„Analizuj"** aby sklasyfikować każdy ciąg
4. Pobierz wynik JSON jako dane wejściowe dla tłumaczeń AI

---

## Pamięć tłumaczeniowa

Trwała baza danych wszystkich ukończonych tłumaczeń z automatycznym ponownym użyciem.

### Funkcje

- **Automatyczne ponowne użycie**: już przetłumaczone ciągi są sugerowane bez nowego wywołania AI
- **Wyszukiwanie**: po tekście oryginalnym, tłumaczeniu lub nazwie gry
- **Filtr gry**: wyświetla tylko tłumaczenia określonego tytułu
- **Statystyki**: łączne jednostki, rozkład według gry, data ostatniej modyfikacji
- **Eksport**: JSON, CSV, TMX dla innych narzędzi CAT
- **Import**: importuje istniejące tłumaczenia z TMX lub CSV

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Pamięć tłumaczeniowa**
2. Wyszukaj poprzednie tłumaczenia paskiem wyszukiwania
3. Edytuj lub usuń pojedyncze jednostki w razie potrzeby
4. Pamięć jest automatycznie konsultowana podczas tłumaczeń AI

---

## Tłumacz OCR

Przechwytuje tekst z dowolnego okna gry lub zrzutu ekranu w czasie rzeczywistym i tłumaczy go natychmiast.

### Funkcje

- **Przechwytywanie w czasie rzeczywistym**: analizuje ekran w konfigurowalnych odstępach
- **Języki źródłowe**: japoński, angielski, chiński uproszczony, koreański
- **Wybór okna**: wskazuje bezpośrednio na okno gry
- **Wybór regionu**: definiuje określony obszar ekranu do analizy
- **Pewność**: pokazuje poziom niezawodności dla każdego wykrytego tekstu
- **Globalny skrót**: włącza/wyłącza przechwytywanie skrótem klawiaturowym
- **Pamięć podręczna tłumaczeń**: ponownie używa poprzednich tłumaczeń dla identycznych ciągów

### Jak używać

1. Przejdź do **Tłumacz OCR** z paska bocznego
2. Wybierz język źródłowy gry
3. Kliknij **„Wybierz okno"** i wybierz okno gry
4. *(Opcjonalnie)* Ustaw określony region przez **„Wybierz region"**
5. Naciśnij **„Start"** aby rozpocząć automatyczne przechwytywanie i tłumaczenie

---

## Przegląd AI

Automatyczny przegląd jakości tłumaczeń z wykrywaniem błędów i sugestiami korekt.

### Funkcje

- **Tryb pojedynczy**: przegląd jednej pary oryginał/tłumaczenie
- **Tryb wsadowy**: masowy przegląd w formacie `oryginał|tłumaczenie` na wiersz
- **Kategorie problemów**: dokładność, płynność, terminologia, ton, struktura
- **Poziomy ważności**: krytyczny, ostrzeżenie, informacja
- **Auto-fix**: automatyczna korekta drobnych problemów
- **Statystyki**: globalny wynik 0–100 dla każdej partii

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Przegląd AI**
2. Wybierz **Pojedynczy** lub **Wsadowy**
3. Wklej oryginalny tekst i tłumaczenie
4. Kliknij **„Przejrzyj"** aby otrzymać raport
5. Użyj **„Auto-fix"** aby zastosować sugerowane korekty

---

## Pipeline AI

Zautomatyzowany 6-etapowy przepływ pracy dla tłumaczeń najwyższej jakości jednym kliknięciem.

### Etapy Pipeline

1. **Harvest** — wyodrębnia i klasyfikuje kontekst
2. **Translate** — tłumaczy ze skonfigurowanym dostawcą AI
3. **QA Check** — automatyczna weryfikacja jakości
4. **Auto-Fix** — koryguje znalezione problemy
5. **Review** — końcowy przegląd AI
6. **Score** — oblicza końcowy wynik 0–100

### Dostępne ustawienia wstępne

- **Quick** — niezbędne etapy (Translate + QA Check)
- **Max Quality** — wszystkie 6 etapów po kolei

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Pipeline AI**
2. Wklej ciągi do przetłumaczenia
3. Wybierz ustawienie wstępne lub skonfiguruj etapy ręcznie
4. Kliknij **„Uruchom Pipeline"**
5. Pobierz końcowy raport z wynikami dla każdego ciągu

---

## Tłumacz emocji

Tłumaczenie analizujące i zachowujące emocje obecne w oryginalnym dialogu.

### Funkcje

- **Analiza emocji**: wykrywa dominującą emocję (gniew, smutek, strach, radość, neutralna, zaskoczenie, wstręt)
- **Intensywność**: mierzy poziom intensywności emocjonalnej (0–100)
- **Zachowanie tonu**: prowadzi AI do utrzymania tego samego emocjonalnego wpływu
- **EmotionBadge**: wizualna etykieta dla każdego ciągu z emocją i intensywnością
- **Statystyki wsadowe**: rozkład emocji w całym pliku

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Tłumacz emocji**
2. Wklej tekst do przetłumaczenia
3. Wybierz język docelowy
4. Kliknij **„Analizuj i tłumacz"**
5. Wynik pokazuje tłumaczenie z zidentyfikowanymi emocjami dla każdego ciągu

---

## Adaptacja kulturowa

Analizuje przetłumaczony tekst w celu identyfikacji kulturowo problematycznych elementów i proponuje adaptacje.

### Funkcje

- **Obsługiwane kultury**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Analizowane kategorie**: wyrażenia idiomatyczne, odniesienia kulturowe, miary/waluty, symboliczne kolory, formuły grzecznościowe, humor
- **Konkretne sugestie**: dla każdego elementu proponuje alternatywę dopasowaną do kultury docelowej
- **Wynik adaptacji**: odsetek tekstu wymagający przeglądu

### Jak używać

1. Przejdź do **Zaawansowane narzędzia → Adaptacja kulturowa**
2. Wklej przetłumaczony tekst
3. Wybierz kulturę źródłową i docelową
4. Kliknij **„Analizuj"**
5. Zastosuj sugestie przed ostateczną publikacją

---

## What's New in v1.4.0
"@
    }
    "PT" = @{
        file = "USER_GUIDE_PT.md"
        indexAnchor = "24. [Solução de Problemas](#solução-de-problemas)"
        indexNew = "25. [Glossário](#glossário)`n26. [Context Harvester](#context-harvester)`n27. [Memória de Tradução](#memória-de-tradução)`n28. [Tradutor OCR](#tradutor-ocr)`n29. [Revisão AI](#revisão-ai)`n30. [Pipeline AI](#pipeline-ai)`n31. [Tradutor de Emoções](#tradutor-de-emoções)`n32. [Adaptação Cultural](#adaptação-cultural)"
        bodyAnchor = "---`n`n## What's New in v1.4.0"
        bodySections = @"
---

## Glossário

O Glossário gerencia dicionários de terminologia personalizados para cada jogo, garantindo consistência nas traduções.

### Funcionalidades

- **Níveis de termos**:
  - 🔴 **Locked** — termo sempre traduzido de forma idêntica (nomes próprios, feitiços, locais)
  - 🟡 **Synced** — tradução consistente, adaptável ao contexto
  - 🟢 **Flexible** — tradução livre
- **Categorias**: personagem, local, item, habilidade, quest, UI, sistema, lore, criatura, facção
- **Extração automática**: análise IA para sugerir termos
- **Verificação de consistência**: verifica tradução uniforme em todos os arquivos
- **Importar/Exportar**: CSV e JSON para compartilhar glossários entre jogos

### Como usar

1. Vá para **Ferramentas Avançadas → Glossário**
2. Selecione o jogo da lista
3. Adicione termos manualmente ou use **"Extrair termos"** para sugestões IA
4. Defina o nível para cada termo
5. O glossário é aplicado automaticamente durante as traduções

---

## Context Harvester

Analisa strings de texto para classificá-las e enriquecê-las com contexto antes da tradução IA, melhorando a qualidade.

### Funcionalidades

- **Classificação automática**: identifica tipo de tela (menu, diálogo, narrativa, tutorial, sistema)
- **Reconhecimento de falante**: infere quem fala e o tipo de tom (formal, coloquial, agressivo)
- **Metadados de contexto**: cada string recebe gênero de jogo, tipo de conteúdo e tom
- **Salvamento de harvest**: contextos extraídos salvos e reutilizados em sessões futuras
- **Processamento em lote**: analisa arquivos inteiros em uma operação

### Como usar

1. Vá para **Ferramentas Avançadas → Context Harvester**
2. Cole as strings ou carregue um arquivo
3. Clique em **"Analisar"** para classificar cada string
4. Baixe o resultado JSON como entrada para traduções IA

---

## Memória de Tradução

Banco de dados persistente de todas as traduções concluídas, com reutilização automática em novas sessões.

### Funcionalidades

- **Reutilização automática**: strings já traduzidas são sugeridas sem nova chamada IA
- **Pesquisa**: por texto original, tradução ou nome do jogo
- **Filtro por jogo**: exibe apenas traduções de um título específico
- **Estatísticas**: unidades totais, distribuição por jogo, data da última modificação
- **Exportar**: JSON, CSV, TMX para outras ferramentas CAT
- **Importar**: importa traduções existentes de TMX ou CSV

### Como usar

1. Vá para **Ferramentas Avançadas → Memória de Tradução**
2. Pesquise traduções anteriores com a barra de pesquisa
3. Edite ou exclua unidades individuais conforme necessário
4. A memória é consultada automaticamente durante traduções IA

---

## Tradutor OCR

Captura texto de qualquer janela de jogo ou captura de tela em tempo real e o traduz instantaneamente.

### Funcionalidades

- **Captura em tempo real**: analisa a tela em intervalos configuráveis
- **Idiomas de origem**: japonês, inglês, chinês simplificado, coreano
- **Seleção de janela**: aponta diretamente para a janela do jogo
- **Seleção de região**: define uma área específica da tela para análise
- **Confiança**: mostra nível de confiabilidade para cada texto detectado
- **Atalho global**: ativa/desativa captura com atalho de teclado
- **Cache de traduções**: reutiliza traduções anteriores para strings idênticas

### Como usar

1. Vá para **Tradutor OCR** na barra lateral
2. Selecione o idioma de origem do jogo
3. Clique em **"Selecionar janela"** e escolha a janela do jogo
4. *(Opcional)* Defina uma região específica com **"Selecionar região"**
5. Pressione **"Iniciar"** para começar a captura e tradução automáticas

---

## Revisão AI

Revisão automática de qualidade das traduções com detecção de erros e sugestões de correção.

### Funcionalidades

- **Modo individual**: revisão de um par original/tradução
- **Modo em lote**: revisão em massa no formato `original|tradução` por linha
- **Categorias de problemas**: precisão, fluência, terminologia, tom, estrutura
- **Níveis de gravidade**: crítico, aviso, informação
- **Auto-fix**: correção automática de problemas menores
- **Estatísticas**: pontuação global 0–100 por lote

### Como usar

1. Vá para **Ferramentas Avançadas → Revisão AI**
2. Escolha entre **Individual** ou **Lote**
3. Cole o texto original e a tradução
4. Clique em **"Revisar"** para receber o relatório
5. Use **"Auto-fix"** para aplicar as correções sugeridas

---

## Pipeline AI

Fluxo de trabalho automatizado de 6 etapas para obter traduções de máxima qualidade com um clique.

### Etapas do Pipeline

1. **Harvest** — extrai e classifica contexto
2. **Translate** — traduz com o provedor IA configurado
3. **QA Check** — verificação automática de qualidade
4. **Auto-Fix** — corrige problemas encontrados
5. **Review** — revisão IA final
6. **Score** — calcula pontuação final 0–100

### Predefinições disponíveis

- **Quick** — etapas essenciais (Translate + QA Check)
- **Max Quality** — todas as 6 etapas em sequência

### Como usar

1. Vá para **Ferramentas Avançadas → Pipeline AI**
2. Cole as strings a traduzir
3. Escolha uma predefinição ou configure as etapas manualmente
4. Clique em **"Executar Pipeline"**
5. Baixe o relatório final com pontuações por string

---

## Tradutor de Emoções

Tradução que analisa e preserva as emoções presentes no diálogo original.

### Funcionalidades

- **Análise emocional**: detecta a emoção predominante (raiva, tristeza, medo, alegria, neutro, surpresa, repulsa)
- **Intensidade**: mede o nível de intensidade emocional (0–100)
- **Preservação do tom**: guia a IA para manter o mesmo impacto emocional
- **EmotionBadge**: rótulo visual por string com emoção e intensidade
- **Estatísticas em lote**: distribuição de emoções em um arquivo inteiro

### Como usar

1. Vá para **Ferramentas Avançadas → Tradutor de Emoções**
2. Cole o texto a traduzir
3. Selecione o idioma de destino
4. Clique em **"Analisar e Traduzir"**
5. O resultado mostra a tradução com as emoções identificadas

---

## Adaptação Cultural

Analisa o texto traduzido para identificar elementos culturalmente problemáticos e propõe adaptações.

### Funcionalidades

- **Culturas suportadas**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Categorias analisadas**: expressões idiomáticas, referências culturais, medidas/moedas, cores simbólicas, fórmulas de cortesia, humor
- **Sugestões específicas**: para cada elemento, propõe uma alternativa adequada à cultura alvo
- **Pontuação de adaptação**: percentagem de texto que requer revisão

### Como usar

1. Vá para **Ferramentas Avançadas → Adaptação Cultural**
2. Cole o texto traduzido
3. Selecione cultura de origem e destino
4. Clique em **"Analisar"**
5. Aplique as sugestões antes da publicação final

---

## What's New in v1.4.0
"@
    }
    "RU" = @{
        file = "USER_GUIDE_RU.md"
        indexAnchor = "24. [Устранение неполадок](#устранение-неполадок)"
        indexNew = "25. [Глоссарий](#глоссарий)`n26. [Context Harvester](#context-harvester)`n27. [Память переводов](#память-переводов)`n28. [OCR-переводчик](#ocr-переводчик)`n29. [AI-проверка](#ai-проверка)`n30. [AI-пайплайн](#ai-пайплайн)`n31. [Переводчик эмоций](#переводчик-эмоций)`n32. [Культурная адаптация](#культурная-адаптация)"
        bodyAnchor = "---`n`n## What's New in v1.4.0"
        bodySections = @"
---

## Глоссарий

Глоссарий управляет пользовательскими словарями терминологии для каждой игры, обеспечивая согласованность переводов.

### Функции

- **Уровни терминов**:
  - 🔴 **Locked** — термин всегда переводится идентично (имена собственные, заклинания, места)
  - 🟡 **Synced** — согласованный перевод, адаптируемый к контексту
  - 🟢 **Flexible** — свободный перевод
- **Категории**: персонаж, место, предмет, навык, квест, UI, система, лор, существо, фракция
- **Автоизвлечение**: анализ AI для предложения терминов
- **Проверка согласованности**: проверяет единообразный перевод во всех файлах
- **Импорт/Экспорт**: CSV и JSON для обмена глоссариями между играми

### Как использовать

1. Перейдите в **Расширенные инструменты → Глоссарий**
2. Выберите игру из списка
3. Добавьте термины вручную или используйте **«Извлечь термины»** для предложений AI
4. Установите уровень для каждого термина
5. Глоссарий применяется автоматически при переводах

---

## Context Harvester

Анализирует текстовые строки, классифицирует их и обогащает контекстом перед переводом AI, улучшая качество.

### Функции

- **Автоматическая классификация**: определяет тип экрана (меню, диалог, нарратив, обучение, система)
- **Распознавание говорящего**: определяет кто говорит и тип тона (формальный, разговорный, агрессивный)
- **Контекстные метаданные**: каждая строка получает жанр игры, тип контента и тон
- **Сохранение harvest**: извлечённые контексты сохраняются и используются повторно
- **Пакетная обработка**: анализирует целые файлы за одну операцию

### Как использовать

1. Перейдите в **Расширенные инструменты → Context Harvester**
2. Вставьте строки или загрузите файл
3. Нажмите **«Анализировать»** для классификации каждой строки
4. Скачайте результат JSON для использования как входных данных для переводов AI

---

## Память переводов

Постоянная база данных всех выполненных переводов с автоматическим повторным использованием.

### Функции

- **Автоматическое повторное использование**: уже переведённые строки предлагаются без нового вызова AI
- **Поиск**: по оригинальному тексту, переводу или названию игры
- **Фильтр по игре**: отображает только переводы конкретного названия
- **Статистика**: общие единицы, распределение по игре, дата последнего изменения
- **Экспорт**: JSON, CSV, TMX для других CAT-инструментов
- **Импорт**: импортирует существующие переводы из TMX или CSV

### Как использовать

1. Перейдите в **Расширенные инструменты → Память переводов**
2. Найдите предыдущие переводы с помощью панели поиска
3. Редактируйте или удаляйте отдельные единицы по необходимости
4. Память автоматически консультируется при переводах AI

---

## OCR-переводчик

Захватывает текст из любого игрового окна или снимка экрана в реальном времени и мгновенно переводит его.

### Функции

- **Захват в реальном времени**: анализирует экран с настраиваемыми интервалами
- **Исходные языки**: японский, английский, упрощённый китайский, корейский
- **Выбор окна**: указывает непосредственно на игровое окно
- **Выбор региона**: определяет конкретную область экрана для анализа
- **Достоверность**: показывает уровень надёжности для каждого обнаруженного текста
- **Глобальная горячая клавиша**: включает/выключает захват сочетанием клавиш
- **Кэш переводов**: повторно использует предыдущие переводы для идентичных строк

### Как использовать

1. Перейдите в **OCR-переводчик** из боковой панели
2. Выберите исходный язык игры
3. Нажмите **«Выбрать окно»** и выберите игровое окно
4. *(Необязательно)* Установите конкретный регион через **«Выбрать регион»**
5. Нажмите **«Пуск»** для начала автоматического захвата и перевода

---

## AI-проверка

Автоматическая проверка качества переводов с обнаружением ошибок и предложениями исправлений.

### Функции

- **Единичный режим**: проверка одной пары оригинал/перевод
- **Пакетный режим**: массовая проверка в формате `оригинал|перевод` на строку
- **Категории проблем**: точность, беглость, терминология, тон, структура
- **Уровни серьёзности**: критический, предупреждение, информация
- **Авто-исправление**: автоматическое исправление незначительных проблем
- **Статистика**: глобальная оценка 0–100 для каждого пакета

### Как использовать

1. Перейдите в **Расширенные инструменты → AI-проверка**
2. Выберите **Единичный** или **Пакетный**
3. Вставьте оригинальный текст и перевод
4. Нажмите **«Проверить»** для получения отчёта
5. Используйте **«Авто-исправление»** для применения предложенных исправлений

---

## AI-пайплайн

Автоматизированный 6-шаговый рабочий процесс для получения переводов максимального качества одним кликом.

### Шаги пайплайна

1. **Harvest** — извлекает и классифицирует контекст
2. **Translate** — переводит с настроенным провайдером AI
3. **QA Check** — автоматическая проверка качества
4. **Auto-Fix** — исправляет найденные проблемы
5. **Review** — финальная проверка AI
6. **Score** — вычисляет итоговую оценку 0–100

### Доступные пресеты

- **Quick** — основные шаги (Translate + QA Check)
- **Max Quality** — все 6 шагов по порядку

### Как использовать

1. Перейдите в **Расширенные инструменты → AI-пайплайн**
2. Вставьте строки для перевода
3. Выберите пресет или настройте шаги вручную
4. Нажмите **«Запустить пайплайн»**
5. Скачайте итоговый отчёт с оценками для каждой строки

---

## Переводчик эмоций

Перевод, анализирующий и сохраняющий эмоции в оригинальном диалоге.

### Функции

- **Анализ эмоций**: определяет преобладающую эмоцию (гнев, грусть, страх, радость, нейтральная, удивление, отвращение)
- **Интенсивность**: измеряет уровень эмоциональной интенсивности (0–100)
- **Сохранение тона**: направляет AI на сохранение того же эмоционального воздействия
- **EmotionBadge**: визуальная метка для каждой строки с эмоцией и интенсивностью
- **Пакетная статистика**: распределение эмоций по всему файлу

### Как использовать

1. Перейдите в **Расширенные инструменты → Переводчик эмоций**
2. Вставьте текст для перевода
3. Выберите целевой язык
4. Нажмите **«Анализировать и перевести»**
5. Результат показывает перевод с идентифицированными эмоциями для каждой строки

---

## Культурная адаптация

Анализирует переведённый текст для выявления культурно проблематичных элементов и предлагает адаптации.

### Функции

- **Поддерживаемые культуры**: IT, EN, DE, FR, ES, JA, KO, ZH, PT, RU
- **Анализируемые категории**: идиоматические выражения, культурные отсылки, меры/валюты, символические цвета, формулы вежливости, юмор
- **Конкретные предложения**: для каждого элемента предлагает альтернативу, подходящую целевой культуре
- **Оценка адаптации**: процент текста, требующего пересмотра

### Как использовать

1. Перейдите в **Расширенные инструменты → Культурная адаптация**
2. Вставьте переведённый текст
3. Выберите исходную и целевую культуру
4. Нажмите **«Анализировать»**
5. Примените предложения перед финальной публикацией

---

## What's New in v1.4.0
"@
    }
    "ZH" = @{
        file = "USER_GUIDE_ZH.md"
        indexAnchor = "23. [故障排除](#故障排除)"
        indexNew = "24. [术语表](#术语表)`n25. [上下文提取器](#上下文提取器)`n26. [翻译记忆库](#翻译记忆库)`n27. [OCR翻译器](#ocr翻译器)`n28. [AI审查](#ai审查)`n29. [AI流水线](#ai流水线)`n30. [情感翻译器](#情感翻译器)`n31. [文化适应](#文化适应)"
        bodyAnchor = "---`n`n## v1.4.0新功能"
        bodySections = @"
---

## 术语表

术语表管理每款游戏的自定义术语词典，确保翻译一致性。

### 功能

- **术语等级**：
  - 🔴 **Locked** — 术语始终相同翻译（专有名词、法术、地点）
  - 🟡 **Synced** — 一致翻译，可适应上下文
  - 🟢 **Flexible** — 自由翻译
- **类别**：角色、地点、物品、技能、任务、UI、系统、传说、生物、阵营
- **自动提取**：AI分析文本以建议术语
- **一致性检查**：验证所有文件中的统一翻译
- **导入/导出**：CSV和JSON，用于在游戏间共享术语表

### 使用方法

1. 前往**高级工具 → 术语表**
2. 从列表中选择游戏
3. 手动添加术语或使用**"提取术语"**获取AI建议
4. 为每个术语设置等级
5. 翻译时自动应用术语表

---

## 上下文提取器

在AI翻译前分析文本字符串，对其进行分类并丰富上下文信息，提升翻译质量。

### 功能

- **自动分类**：识别屏幕类型（菜单、对话、叙述、教程、系统）
- **说话者识别**：推断谁在说话及语气类型（正式、随意、激进）
- **上下文元数据**：每个字符串获得游戏类型、内容类型和语气
- **保存提取结果**：提取的上下文被保存并在未来会话中重用
- **批量处理**：一次操作分析整个文件

### 使用方法

1. 前往**高级工具 → 上下文提取器**
2. 粘贴字符串或加载文件
3. 点击**"分析"**对每个字符串进行分类
4. 下载JSON结果作为AI翻译的输入

---

## 翻译记忆库

所有已完成翻译的持久数据库，在新会话中自动重用。

### 功能

- **自动重用**：已翻译字符串无需新的AI调用即可建议
- **搜索**：按原文、翻译或游戏名称搜索
- **游戏过滤**：仅显示特定标题的翻译
- **统计**：总单元数、按游戏分布、最后修改日期
- **导出**：JSON、CSV、TMX，用于其他CAT工具
- **导入**：从TMX或CSV导入现有翻译

### 使用方法

1. 前往**高级工具 → 翻译记忆库**
2. 用搜索栏搜索以前的翻译
3. 根据需要编辑或删除单个单元
4. AI翻译时自动参考记忆库

---

## OCR翻译器

实时从任何游戏窗口或截图中捕获文本并即时翻译。

### 功能

- **实时捕获**：以可配置的间隔分析屏幕
- **源语言**：日语、英语、简体中文、韩语
- **窗口选择**：直接指向游戏窗口
- **区域选择**：定义要分析的特定屏幕区域
- **置信度**：显示每个检测到文本的可靠性级别
- **全局快捷键**：用键盘快捷键切换捕获
- **翻译缓存**：对相同字符串重用以前的翻译

### 使用方法

1. 从侧边栏前往**OCR翻译器**
2. 选择游戏的源语言
3. 点击**"选择窗口"**并选择游戏窗口
4. *（可选）* 用**"选择区域"**设置特定区域
5. 按**"开始"**启动自动捕获和翻译

---

## AI审查

通过错误检测和修正建议对翻译进行自动质量审查。

### 功能

- **单一模式**：审查一对原文/翻译
- **批量模式**：以每行`原文|翻译`格式进行大规模审查
- **问题类别**：准确性、流畅性、术语、语气、结构
- **严重程度级别**：严重、警告、信息
- **自动修复**：自动修正轻微问题
- **统计**：每批的全局评分 0–100

### 使用方法

1. 前往**高级工具 → AI审查**
2. 选择**单一**或**批量**
3. 粘贴原文和翻译
4. 点击**"审查"**接收报告
5. 使用**"自动修复"**应用建议的修正

---

## AI流水线

一键获得最高质量翻译的自动化6步工作流程。

### 流水线步骤

1. **Harvest** — 提取并分类上下文
2. **Translate** — 使用配置的AI提供商翻译
3. **QA Check** — 自动质量验证
4. **Auto-Fix** — 修正发现的问题
5. **Review** — 最终AI审查
6. **Score** — 计算最终评分 0–100

### 可用预设

- **Quick** — 基本步骤（Translate + QA Check）
- **Max Quality** — 按顺序执行全部6步

### 使用方法

1. 前往**高级工具 → AI流水线**
2. 粘贴要翻译的字符串
3. 选择预设或手动配置步骤
4. 点击**"运行流水线"**
5. 下载包含每个字符串评分的最终报告

---

## 情感翻译器

分析并保留原始对话中情感的翻译工具。

### 功能

- **情感分析**：检测主导情感（愤怒、悲伤、恐惧、喜悦、中性、惊讶、厌恶）
- **强度**：测量情感强度级别（0–100）
- **语气保留**：引导AI在翻译中保持相同的情感影响
- **EmotionBadge**：每个字符串的情感和强度可视化标签
- **批量统计**：整个文件的情感分布

### 使用方法

1. 前往**高级工具 → 情感翻译器**
2. 粘贴要翻译的文本
3. 选择目标语言
4. 点击**"分析并翻译"**
5. 结果显示每个字符串的带情感识别的翻译

---

## 文化适应

分析翻译后的文本以识别文化问题元素，并为目标文化提出适应性调整建议。

### 功能

- **支持的文化**：IT、EN、DE、FR、ES、JA、KO、ZH、PT、RU
- **分析类别**：惯用表达、文化参考、度量/货币、象征色彩、礼貌用语、幽默
- **具体建议**：为每个元素提出适合目标文化的替代方案
- **适应评分**：需要修订的文本百分比

### 使用方法

1. 前往**高级工具 → 文化适应**
2. 粘贴翻译后的文本
3. 选择源文化和目标文化
4. 点击**"分析"**
5. 在最终发布前应用建议

---

## v1.4.0新功能
"@
    }
}

function Process-File($langCode) {
    $data = $sections[$langCode]
    $filePath = Join-Path $docsPath $data.file
    $content = Get-Content $filePath -Raw -Encoding UTF8

    # Update index
    $content = $content -replace [regex]::Escape($data.indexAnchor), "$($data.indexAnchor)`n$($data.indexNew)"

    # Insert body sections
    $bodyAnchorExpanded = $data.bodyAnchor -replace '`n', "`n"
    $content = $content -replace [regex]::Escape($bodyAnchorExpanded), $data.bodySections

    Set-Content $filePath $content -Encoding UTF8 -NoNewline
    Write-Host "Done: $($data.file)"
}

if ($lang -eq "all") {
    foreach ($l in $sections.Keys) { Process-File $l }
} else {
    Process-File $lang
}
