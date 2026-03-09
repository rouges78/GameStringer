import os, sys

docs_dir = os.path.join(os.path.dirname(__file__), '..', 'docs')

# Blocco 1: Feature AI avanzate
# Blocco 2: OCR/Batch/Adaptive MT
# Blocco 3: Offline/Manga/Texture/Auto-Glossary
checks = {
    'GUIDA_UTENTE.md': {
        'index': [
            'Confronto Multi-LLM', 'Punteggio Qualità Live', 'Profili Voce Personaggio', 'Pipeline Traduzione Vocale',
            'OCR Multi-Engine', 'Retro-Game OCR', 'Adaptive MT', 'Batch Folder Translator',
            'Traduttore Offline', 'Manga/Comic Translator', 'Texture Translator', 'Auto-Glossario',
        ],
        'body': [
            '## Confronto Multi-LLM', '## Punteggio Qualità Live', '## Profili Voce Personaggio', '## Pipeline Traduzione Vocale',
            '## OCR Multi-Engine', '## Retro-Game OCR', '## Adaptive MT', '## Batch Folder Translator',
            '## Traduttore Offline', '## Manga/Comic Translator', '## Texture Translator', '## Auto-Glossario',
        ],
    },
    'USER_GUIDE_EN.md': {
        'index': [
            'Multi-LLM Comparison', 'Live Quality Scoring', 'Character Voice Profiles', 'Voice Translation Pipeline',
            'OCR Multi-Engine', 'Retro-Game OCR', 'Adaptive MT', 'Batch Folder Translator',
            'Offline Translator', 'Manga/Comic Translator', 'Texture Translator', 'Auto-Glossary',
        ],
        'body': [
            '## Multi-LLM Comparison', '## Live Quality Scoring', '## Character Voice Profiles', '## Voice Translation Pipeline',
            '## OCR Multi-Engine', '## Retro-Game OCR', '## Adaptive MT', '## Batch Folder Translator',
            '## Offline Translator', '## Manga/Comic Translator', '## Texture Translator', '## Auto-Glossary',
        ],
    },
    'USER_GUIDE_ES.md': {
        'index': [
            'Comparación Multi-LLM', 'Puntuación de Calidad en Vivo', 'Perfiles de Voz de Personaje', 'Pipeline de Traducción por Voz',
            'OCR Multi-Motor', 'OCR Retro-Juegos', 'MT Adaptativa', 'Traductor Batch de Carpetas',
            'Traductor Offline', 'Traductor Manga/Cómic', 'Traductor de Texturas', 'Auto-Glosario',
        ],
        'body': [
            '## Comparación Multi-LLM', '## Puntuación de Calidad en Vivo', '## Perfiles de Voz de Personaje', '## Pipeline de Traducción por Voz',
            '## OCR Multi-Motor', '## OCR Retro-Juegos', '## MT Adaptativa', '## Traductor Batch de Carpetas',
            '## Traductor Offline', '## Traductor Manga/Cómic', '## Traductor de Texturas', '## Auto-Glosario',
        ],
    },
    'USER_GUIDE_FR.md': {
        'index': [
            'Comparaison Multi-LLM', 'Score de Qualité en Direct', 'Profils de Voix de Personnage', 'Pipeline de Traduction Vocale',
            'OCR Multi-Moteur', 'OCR Jeux Rétro', 'MT Adaptative', 'Traducteur Batch de Dossiers',
            'Traducteur Hors-ligne', 'Traducteur Manga/BD', 'Traducteur de Textures', 'Auto-Glossaire',
        ],
        'body': [
            '## Comparaison Multi-LLM', '## Score de Qualité en Direct', '## Profils de Voix de Personnage', '## Pipeline de Traduction Vocale',
            '## OCR Multi-Moteur', '## OCR Jeux Rétro', '## MT Adaptative', '## Traducteur Batch de Dossiers',
            '## Traducteur Hors-ligne', '## Traducteur Manga/BD', '## Traducteur de Textures', '## Auto-Glossaire',
        ],
    },
    'USER_GUIDE_DE.md': {
        'index': [
            'Multi-LLM-Vergleich', 'Live-Qualitätsbewertung', 'Charakter-Stimmprofile', 'Sprach-Übersetzungs-Pipeline',
            'OCR Multi-Engine', 'Retro-Spiele OCR', 'Adaptive MT', 'Batch-Ordner-Übersetzer',
            'Offline-Übersetzer', 'Manga/Comic-Übersetzer', 'Textur-Übersetzer', 'Auto-Glossar',
        ],
        'body': [
            '## Multi-LLM-Vergleich', '## Live-Qualitätsbewertung', '## Charakter-Stimmprofile', '## Sprach-Übersetzungs-Pipeline',
            '## OCR Multi-Engine', '## Retro-Spiele OCR', '## Adaptive MT', '## Batch-Ordner-Übersetzer',
            '## Offline-Übersetzer', '## Manga/Comic-Übersetzer', '## Textur-Übersetzer', '## Auto-Glossar',
        ],
    },
    'USER_GUIDE_PT.md': {
        'index': [
            'Comparação Multi-LLM', 'Pontuação de Qualidade ao Vivo', 'Perfis de Voz de Personagem', 'Pipeline de Tradução por Voz',
            'OCR Multi-Motor', 'OCR Jogos Retro', 'MT Adaptativa', 'Tradutor Batch de Pastas',
            'Tradutor Offline', 'Tradutor Manga/Quadrinhos', 'Tradutor de Texturas', 'Auto-Glossário',
        ],
        'body': [
            '## Comparação Multi-LLM', '## Pontuação de Qualidade ao Vivo', '## Perfis de Voz de Personagem', '## Pipeline de Tradução por Voz',
            '## OCR Multi-Motor', '## OCR Jogos Retro', '## MT Adaptativa', '## Tradutor Batch de Pastas',
            '## Tradutor Offline', '## Tradutor Manga/Quadrinhos', '## Tradutor de Texturas', '## Auto-Glossário',
        ],
    },
    'USER_GUIDE_JA.md': {
        'index': [
            'マルチLLM比較', 'ライブ品質スコアリング', 'キャラクターボイスプロファイル', '音声翻訳パイプライン',
            'OCRマルチエンジン', 'レトロゲームOCR', 'アダプティブMT', 'バッチフォルダー翻訳',
            'オフライン翻訳', 'マンガ/コミック翻訳', 'テクスチャ翻訳', '自動用語集',
        ],
        'body': [
            '## マルチLLM比較', '## ライブ品質スコアリング', '## キャラクターボイスプロファイル', '## 音声翻訳パイプライン',
            '## OCRマルチエンジン', '## レトロゲームOCR', '## アダプティブMT', '## バッチフォルダー翻訳',
            '## オフライン翻訳', '## マンガ/コミック翻訳', '## テクスチャ翻訳', '## 自動用語集',
        ],
    },
    'USER_GUIDE_KO.md': {
        'index': [
            '멀티 LLM 비교', '실시간 품질 점수', '캐릭터 보이스 프로필', '음성 번역 파이프라인',
            'OCR 멀티 엔진', '레트로 게임 OCR', '적응형 MT', '배치 폴더 번역기',
            '오프라인 번역기', '만화/코믹 번역기', '텍스처 번역기', '자동 용어집',
        ],
        'body': [
            '## 멀티 LLM 비교', '## 실시간 품질 점수', '## 캐릭터 보이스 프로필', '## 음성 번역 파이프라인',
            '## OCR 멀티 엔진', '## 레트로 게임 OCR', '## 적응형 MT', '## 배치 폴더 번역기',
            '## 오프라인 번역기', '## 만화/코믹 번역기', '## 텍스처 번역기', '## 자동 용어집',
        ],
    },
    'USER_GUIDE_ZH.md': {
        'index': [
            '多LLM对比', '实时质量评分', '角色语音配置文件', '语音翻译流水线',
            'OCR多引擎', '复古游戏OCR', '自适应MT', '批量文件夹翻译器',
            '离线翻译器', '漫画翻译器', '纹理翻译器', '自动术语表',
        ],
        'body': [
            '## 多LLM对比', '## 实时质量评分', '## 角色语音配置文件', '## 语音翻译流水线',
            '## OCR多引擎', '## 复古游戏OCR', '## 自适应MT', '## 批量文件夹翻译器',
            '## 离线翻译器', '## 漫画翻译器', '## 纹理翻译器', '## 自动术语表',
        ],
    },
    'USER_GUIDE_RU.md': {
        'index': [
            'Сравнение нескольких LLM', 'Оценка качества в реальном времени', 'Голосовые профили персонажей', 'Конвейер голосового перевода',
            'OCR Мульти-движок', 'Ретро-игры OCR', 'Адаптивный MT', 'Пакетный переводчик папок',
            'Офлайн-переводчик', 'Переводчик манги/комиксов', 'Переводчик текстур', 'Авто-глоссарий',
        ],
        'body': [
            '## Сравнение нескольких LLM', '## Оценка качества в реальном времени', '## Голосовые профили персонажей', '## Конвейер голосового перевода',
            '## OCR Мульти-движок', '## Ретро-игры OCR', '## Адаптивный MT', '## Пакетный переводчик папок',
            '## Офлайн-переводчик', '## Переводчик манги/комиксов', '## Переводчик текстур', '## Авто-глоссарий',
        ],
    },
    'USER_GUIDE_PL.md': {
        'index': [
            'Porównanie Multi-LLM', 'Ocena Jakości na Żywo', 'Profile Głosowe Postaci', 'Pipeline Tłumaczenia Głosowego',
            'OCR Multi-Silnik', 'OCR Gier Retro', 'Adaptacyjne MT', 'Batch Tłumacz Folderów',
            'Tłumacz Offline', 'Tłumacz Manga/Komiks', 'Tłumacz Tekstur', 'Auto-Słownik',
        ],
        'body': [
            '## Porównanie Multi-LLM', '## Ocena Jakości na Żywo', '## Profile Głosowe Postaci', '## Pipeline Tłumaczenia Głosowego',
            '## OCR Multi-Silnik', '## OCR Gier Retro', '## Adaptacyjne MT', '## Batch Tłumacz Folderów',
            '## Tłumacz Offline', '## Tłumacz Manga/Komiks', '## Tłumacz Tekstur', '## Auto-Słownik',
        ],
    },
}

all_ok = True
for fname, spec in checks.items():
    fpath = os.path.join(docs_dir, fname)
    if not os.path.exists(fpath):
        print(f"MISSING FILE: {fname}")
        all_ok = False
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    missing_idx = [s for s in spec['index'] if s not in content]
    missing_body = [s for s in spec['body'] if s not in content]
    if missing_idx or missing_body:
        all_ok = False
        print(f"FAIL: {fname}")
        for m in missing_idx:
            print(f"  INDEX MISSING: {m}")
        for m in missing_body:
            print(f"  BODY MISSING: {m}")
    else:
        print(f"OK: {fname} (12 index + 12 body)")

if all_ok:
    print("\nALL 11 GUIDES VERIFIED OK (3 blocks x 4 features = 12 sections each)")
else:
    print("\nSOME GUIDES HAVE ISSUES")
    sys.exit(1)
