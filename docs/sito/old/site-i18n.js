// GameStringer Website Internationalization
const siteTranslations = {
  en: {
    lang: 'en',
    title: 'GameStringer - Translate Any Video Game with AI | Complete Localization Suite',
    description: 'GameStringer is the ultimate open source suite for AI-powered video game translation. Supports Unity, Unreal, Godot, RPG Maker and 10+ engines. 15+ AI providers including free Ollama, GPT-4, Claude, Gemini.',
    nav: { features: 'Features', engines: 'Engines', ai: 'AI Providers', usecases: 'Use Cases', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — Interactive Tutorial, AI Auto-Glossary, One-Click Unreal with TM & Revision',
      title: 'GameStringer',
      subtitle: 'Localize video games with AI. Open source. Free.',
      desc: 'Supports <strong>11+ engines</strong> (Unity, Unreal, Godot, RPG Maker, Ren\'Py, Danganronpa...) and <strong>20+ AI providers</strong> (TranslateGemma, Ollama, GPT-4, Claude, Gemini, DeepSeek...). Extract, translate and inject text automatically. <strong>AI Auto-glossary</strong>, persistent Translation Memory.',
      download: '⬇️ Free Download for Windows',
      source: '📂 View Source Code',
      meta: ['100% Free & Open Source', 'No account required', 'Local AI with Ollama', 'Windows 10/11 64-bit']
    },
    stats: {
      engines: { value: '11+', label: 'Game Engines', detail: 'Unity, Unreal, Godot, RPG Maker, Danganronpa...' },
      ai: { value: '20+', label: 'AI Providers', detail: '10 free, 8 local, HY-MT optimized' },
      stores: { value: '7', label: 'Integrated Stores', detail: 'Steam, Epic, GOG, Origin...' },
      games: { value: '∞', label: 'Translatable Games', detail: 'Indie, retro, AAA' }
    },
    features: {
      badge: '✨ Complete Features',
      title: 'Everything You Need to Translate Video Games',
      desc: 'A complete ecosystem of AI tools designed specifically for video game localization.'
    },
    engines_section: {
      badge: '🎮 Compatibility',
      title: '11+ Supported Game Engines',
      desc: 'Native support for major engines. GameStringer automatically detects the engine and configures the optimal method.'
    },
    ai_section: {
      badge: '🤖 AI Providers',
      title: '20+ AI Providers for Every Need',
      desc: 'Free options, local for total privacy, or cloud for maximum quality. Each provider is optimized for gaming translations.'
    },
    tools_section: {
      badge: '🛠️ Professional Tools',
      title: '10+ Professional Tools Included',
      desc: 'Every tool needed to translate any type of game, from visual novel to AAA.'
    },
    usecases_section: {
      badge: '🎯 Use Cases',
      title: 'Who Uses GameStringer?',
      desc: 'GameStringer is designed for different types of users with specific needs.'
    },
    howto: {
      badge: '⚡ How It Works',
      title: '3 Simple Steps',
      steps: [
        { title: 'Select the Game', desc: 'Choose from Steam, Epic, GOG library or add manually. GameStringer automatically detects engine and translatable files.', detail: 'Auto-detect: Unity, Unreal, Godot, RPG Maker...' },
        { title: 'Configure Translation', desc: 'Choose AI provider, target language, glossary and context. The AI automatically adapts tone to the game genre.', detail: 'Context-aware: JRPG, Horror, Visual Novel...' },
        { title: 'Translate and Play', desc: 'Press a button and translations are automatically injected. Backup included, one-click restore.', detail: 'Auto-patch: BepInEx, XUnity, UnrealLocres...' }
      ]
    },
    faq_section: {
      badge: '❓ FAQ',
      title: 'Frequently Asked Questions'
    },
    cta: {
      title: 'Ready to Translate?',
      desc: 'Download GameStringer for free and start playing your favorite games in your language. No account, no subscription, no limits.',
      download: '⬇️ Download for Windows (Free)',
      star: '⭐ Star on GitHub',
      features: ['100% Free Forever', 'Open Source', 'No Account', 'Local AI Available', 'Free Updates']
    },
    support: {
      title: '❤️ Support the Project',
      desc: 'GameStringer is developed in free time. Your support helps keep the project active and add new features!',
      kofi: '☕ Buy me a Coffee on Ko-fi',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: 'The ultimate open source suite for translating video games with artificial intelligence. Supports any engine, any AI, any language.',
      resources: 'Resources',
      community: 'Community',
      support: 'Support',
      download: 'Download',
      docs: 'Documentation',
      guide: 'Complete Guide',
      changelog: 'Changelog',
      discussions: 'Discussions',
      bugs: 'Bug Report',
      contribute: 'Contribute',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Made with',
      inCountry: 'in Italy 🇮🇹'
    }
  },
  it: {
    lang: 'it',
    title: 'GameStringer - Traduci Qualsiasi Videogioco con l\'AI | Suite Completa di Localizzazione',
    description: 'GameStringer è la suite open source definitiva per tradurre videogiochi con AI. Supporta Unity, Unreal, Godot, RPG Maker e 10+ engine. 15+ provider AI inclusi Ollama gratuito, GPT-4, Claude, Gemini.',
    nav: { features: 'Features', engines: 'Engines', ai: 'AI Providers', usecases: 'Use Cases', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — Tutorial Interattivo, Auto-Glossario AI, One-Click Unreal con TM & Revisione',
      title: 'GameStringer',
      subtitle: 'Localizza videogiochi con l\'AI. Open source. Gratuito.',
      desc: 'Supporta <strong>11+ engine</strong> (Unity, Unreal, Godot, RPG Maker, Ren\'Py, Danganronpa...) e <strong>20+ provider AI</strong> (TranslateGemma, Ollama, GPT-4, Claude, Gemini, DeepSeek...). Estrai, traduci e inietta testi automaticamente. <strong>Auto-glossario AI</strong>, Translation Memory persistente.',
      download: '⬇️ Download Gratuito per Windows',
      source: '📂 Vedi Codice Sorgente',
      meta: ['100% Gratuito & Open Source', 'Nessun account richiesto', 'AI locale con Ollama', 'Windows 10/11 64-bit']
    },
    stats: {
      engines: { value: '11+', label: 'Game Engine', detail: 'Unity, Unreal, Godot, RPG Maker, Danganronpa...' },
      ai: { value: '20+', label: 'Provider AI', detail: '10 gratuiti, 8 locali, HY-MT ottimizzato' },
      stores: { value: '7', label: 'Store Integrati', detail: 'Steam, Epic, GOG, Origin...' },
      games: { value: '∞', label: 'Games Traducibili', detail: 'Indie, retro, AAA' }
    },
    features: {
      badge: '✨ Features Complete',
      title: 'Tutto il Necessario per Tradurre Videogiochi',
      desc: 'Un ecosistema completo di strumenti AI progettati specificamente per la localizzazione di videogiochi.'
    },
    engines_section: {
      badge: '🎮 Compatibilità',
      title: '11+ Engine di Gioco Supportati',
      desc: 'Supporto nativo per i principali engine. GameStringer rileva automaticamente l\'engine e configura il metodo ottimale.'
    },
    ai_section: {
      badge: '🤖 AI Providers',
      title: '20+ Provider AI per Ogni Esigenza',
      desc: 'Opzioni gratuite, locali per privacy totale, o cloud per massima qualità. Ogni provider è ottimizzato per traduzioni gaming.'
    },
    tools_section: {
      badge: '🛠️ Professional Tools',
      title: '10+ Strumenti Professionali Inclusi',
      desc: 'Ogni strumento necessario per tradurre qualsiasi tipo di gioco, dalla visual novel al AAA.'
    },
    usecases_section: {
      badge: '🎯 Use Cases',
      title: 'Chi Usa GameStringer?',
      desc: 'GameStringer è progettato per diversi tipi di utenti con esigenze specifiche.'
    },
    howto: {
      badge: '⚡ Come Funziona',
      title: '3 Semplici Passi',
      steps: [
        { title: 'Seleziona il Game', desc: 'Scegli dalla libreria Steam, Epic, GOG o aggiungi manualmente. GameStringer rileva automaticamente engine e file traducibili.', detail: 'Auto-detect: Unity, Unreal, Godot, RPG Maker...' },
        { title: 'Configura la Traduzione', desc: 'Scegli provider AI, lingua target, glossario e contesto. L\'AI adatta automaticamente il tono al genere del gioco.', detail: 'Context-aware: JRPG, Horror, Visual Novel...' },
        { title: 'Traduci e Gioca', desc: 'Premi un bottone e le traduzioni vengono iniettate automaticamente. Backup incluso, ripristino con un click.', detail: 'Auto-patch: BepInEx, XUnity, UnrealLocres...' }
      ]
    },
    faq_section: {
      badge: '❓ FAQ',
      title: 'Domande Frequenti'
    },
    cta: {
      title: 'Pronto a Tradurre?',
      desc: 'Scarica GameStringer gratuitamente e inizia a giocare i tuoi giochi preferiti nella tua lingua. Nessun account, nessun abbonamento, nessun limite.',
      download: '⬇️ Download per Windows (Gratuito)',
      star: '⭐ Star su GitHub',
      features: ['100% Gratuito Forever', 'Open Source', 'Nessun Account', 'AI Locale Disponibile', 'Aggiornamenti Gratuiti']
    },
    support: {
      title: '❤️ Supporta il Progetto',
      desc: 'GameStringer è sviluppato nel tempo libero. Il tuo supporto aiuta a mantenere il progetto attivo e ad aggiungere nuove features!',
      kofi: '☕ Offrimi un Caffè su Ko-fi',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: 'La suite open source definitiva per tradurre videogiochi con intelligenza artificiale. Supporta qualsiasi engine, qualsiasi AI, qualsiasi lingua.',
      resources: 'Risorse',
      community: 'Community',
      support: 'Supporta',
      download: 'Download',
      docs: 'Documentazione',
      guide: 'Guida Completa',
      changelog: 'Changelog',
      discussions: 'Discussions',
      bugs: 'Bug Report',
      contribute: 'Contribuisci',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Made with',
      inCountry: 'in Italy 🇮🇹'
    }
  },
  es: {
    lang: 'es',
    title: 'GameStringer - Traduce Cualquier Videojuego con IA | Suite Completa de Localización',
    description: 'GameStringer es la suite open source definitiva para traducir videojuegos con IA. Soporta Unity, Unreal, Godot, RPG Maker y 10+ motores. 15+ proveedores de IA incluido Ollama gratuito, GPT-4, Claude, Gemini.',
    nav: { features: 'Características', engines: 'Motores', ai: 'Proveedores IA', usecases: 'Casos de Uso', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — Tutorial Interactivo, Auto-Glosario IA, One-Click Unreal con TM & Revisión',
      title: 'GameStringer',
      subtitle: 'Localiza videojuegos con IA. Open source. Gratis.',
      desc: 'Soporta <strong>11+ motores</strong> (Unity, Unreal, Godot, RPG Maker, Ren\'Py, Danganronpa...) y <strong>20+ proveedores IA</strong> (TranslateGemma, Ollama, GPT-4, Claude, Gemini, DeepSeek...). Extrae, traduce e inyecta textos automáticamente. <strong>Auto-glosario IA</strong>, Translation Memory persistente.',
      download: '⬇️ Descarga Gratuita para Windows',
      source: '📂 Ver Código Fuente',
      meta: ['100% Gratis & Open Source', 'Sin cuenta requerida', 'IA local con Ollama', 'Windows 10/11 64-bit']
    },
    stats: {
      engines: { value: '11+', label: 'Motores de Juego', detail: 'Unity, Unreal, Godot, RPG Maker, Danganronpa...' },
      ai: { value: '20+', label: 'Proveedores IA', detail: '10 gratis, 8 locales, HY-MT optimizado' },
      stores: { value: '7', label: 'Tiendas Integradas', detail: 'Steam, Epic, GOG, Origin...' },
      games: { value: '∞', label: 'Juegos Traducibles', detail: 'Indie, retro, AAA' }
    },
    features: {
      badge: '✨ Características Completas',
      title: 'Todo lo Necesario para Traducir Videojuegos',
      desc: 'Un ecosistema completo de herramientas IA diseñadas específicamente para localización de videojuegos.'
    },
    cta: {
      title: '¿Listo para Traducir?',
      desc: 'Descarga GameStringer gratis y empieza a jugar tus juegos favoritos en tu idioma. Sin cuenta, sin suscripción, sin límites.',
      download: '⬇️ Descargar para Windows (Gratis)',
      star: '⭐ Star en GitHub',
      features: ['100% Gratis Siempre', 'Open Source', 'Sin Cuenta', 'IA Local Disponible', 'Actualizaciones Gratis']
    },
    support: {
      title: '❤️ Apoya el Proyecto',
      desc: 'GameStringer se desarrolla en tiempo libre. ¡Tu apoyo ayuda a mantener el proyecto activo y añadir nuevas funciones!',
      kofi: '☕ Invítame un Café en Ko-fi',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: 'La suite open source definitiva para traducir videojuegos con inteligencia artificial. Soporta cualquier motor, cualquier IA, cualquier idioma.',
      resources: 'Recursos',
      community: 'Comunidad',
      support: 'Apoyar',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Hecho con',
      inCountry: 'en Italia 🇮🇹'
    }
  },
  de: {
    lang: 'de',
    title: 'GameStringer - Übersetze Jedes Videospiel mit KI | Komplette Lokalisierungs-Suite',
    description: 'GameStringer ist die ultimative Open-Source-Suite für KI-gestützte Videospielübersetzung. Unterstützt Unity, Unreal, Godot, RPG Maker und 10+ Engines. 15+ KI-Anbieter inklusive kostenlosem Ollama, GPT-4, Claude, Gemini.',
    nav: { features: 'Funktionen', engines: 'Engines', ai: 'KI-Anbieter', usecases: 'Anwendungsfälle', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — Interaktives Tutorial, KI Auto-Glossar, One-Click Unreal mit TM & Revision',
      title: 'GameStringer',
      subtitle: 'Lokalisiere Videospiele mit KI. Open Source. Kostenlos.',
      desc: 'Unterstützt <strong>11+ Engines</strong> (Unity, Unreal, Godot, RPG Maker, Ren\'Py, Danganronpa...) und <strong>20+ KI-Anbieter</strong> (TranslateGemma, Ollama, GPT-4, Claude, Gemini, DeepSeek...). Extrahiere, übersetze und injiziere Texte automatisch. <strong>KI Auto-Glossar</strong>, persistenter Translation Memory.',
      download: '⬇️ Kostenloser Download für Windows',
      source: '📂 Quellcode Ansehen',
      meta: ['100% Kostenlos & Open Source', 'Kein Konto erforderlich', 'Lokale KI mit Ollama', 'Windows 10/11 64-bit']
    },
    stats: {
      engines: { value: '11+', label: 'Spiel-Engines', detail: 'Unity, Unreal, Godot, RPG Maker, Danganronpa...' },
      ai: { value: '20+', label: 'KI-Anbieter', detail: '10 kostenlos, 8 lokal, HY-MT optimiert' },
      stores: { value: '7', label: 'Integrierte Stores', detail: 'Steam, Epic, GOG, Origin...' },
      games: { value: '∞', label: 'Übersetzbare Spiele', detail: 'Indie, Retro, AAA' }
    },
    cta: {
      title: 'Bereit zum Übersetzen?',
      desc: 'Lade GameStringer kostenlos herunter und spiele deine Lieblingsspiele in deiner Sprache. Kein Konto, kein Abo, keine Limits.',
      download: '⬇️ Download für Windows (Kostenlos)',
      star: '⭐ Star auf GitHub',
      features: ['100% Kostenlos Forever', 'Open Source', 'Kein Konto', 'Lokale KI Verfügbar', 'Kostenlose Updates']
    },
    support: {
      title: '❤️ Unterstütze das Projekt',
      desc: 'GameStringer wird in der Freizeit entwickelt. Deine Unterstützung hilft, das Projekt aktiv zu halten und neue Funktionen hinzuzufügen!',
      kofi: '☕ Kauf mir einen Kaffee auf Ko-fi',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: 'Die ultimative Open-Source-Suite zum Übersetzen von Videospielen mit künstlicher Intelligenz. Unterstützt jede Engine, jede KI, jede Sprache.',
      resources: 'Ressourcen',
      community: 'Community',
      support: 'Unterstützen',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Made with',
      inCountry: 'in Italien 🇮🇹'
    }
  },
  fr: {
    lang: 'fr',
    title: 'GameStringer - Traduisez N\'importe Quel Jeu Vidéo avec l\'IA | Suite Complète de Localisation',
    description: 'GameStringer est la suite open source ultime pour traduire des jeux vidéo avec l\'IA. Supporte Unity, Unreal, Godot, RPG Maker et 10+ moteurs. 15+ fournisseurs IA incluant Ollama gratuit, GPT-4, Claude, Gemini.',
    nav: { features: 'Fonctionnalités', engines: 'Moteurs', ai: 'Fournisseurs IA', usecases: 'Cas d\'Usage', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — Tutoriel Interactif, Auto-Glossaire IA, One-Click Unreal avec TM & Révision',
      title: 'GameStringer',
      subtitle: 'Localisez des jeux vidéo avec l\'IA. Open source. Gratuit.',
      desc: 'Supporte <strong>11+ moteurs</strong> (Unity, Unreal, Godot, RPG Maker, Ren\'Py, Danganronpa...) et <strong>20+ fournisseurs IA</strong> (TranslateGemma, Ollama, GPT-4, Claude, Gemini, DeepSeek...). Extrayez, traduisez et injectez des textes automatiquement. <strong>Auto-glossaire IA</strong>, Translation Memory persistante.',
      download: '⬇️ Téléchargement Gratuit pour Windows',
      source: '📂 Voir le Code Source',
      meta: ['100% Gratuit & Open Source', 'Aucun compte requis', 'IA locale avec Ollama', 'Windows 10/11 64-bit']
    },
    stats: {
      engines: { value: '11+', label: 'Moteurs de Jeu', detail: 'Unity, Unreal, Godot, RPG Maker, Danganronpa...' },
      ai: { value: '20+', label: 'Fournisseurs IA', detail: '10 gratuits, 8 locaux, HY-MT optimisé' },
      stores: { value: '7', label: 'Boutiques Intégrées', detail: 'Steam, Epic, GOG, Origin...' },
      games: { value: '∞', label: 'Jeux Traduisibles', detail: 'Indie, rétro, AAA' }
    },
    cta: {
      title: 'Prêt à Traduire ?',
      desc: 'Téléchargez GameStringer gratuitement et commencez à jouer à vos jeux préférés dans votre langue. Pas de compte, pas d\'abonnement, pas de limites.',
      download: '⬇️ Télécharger pour Windows (Gratuit)',
      star: '⭐ Star sur GitHub',
      features: ['100% Gratuit Pour Toujours', 'Open Source', 'Pas de Compte', 'IA Locale Disponible', 'Mises à Jour Gratuites']
    },
    support: {
      title: '❤️ Soutenez le Projet',
      desc: 'GameStringer est développé pendant le temps libre. Votre soutien aide à maintenir le projet actif et à ajouter de nouvelles fonctionnalités !',
      kofi: '☕ Offrez-moi un Café sur Ko-fi',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: 'La suite open source ultime pour traduire des jeux vidéo avec l\'intelligence artificielle. Supporte n\'importe quel moteur, n\'importe quelle IA, n\'importe quelle langue.',
      resources: 'Ressources',
      community: 'Communauté',
      support: 'Soutenir',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Fait avec',
      inCountry: 'en Italie 🇮🇹'
    }
  },
  ja: {
    lang: 'ja',
    title: 'GameStringer - AIでゲームを翻訳 | 完全ローカライゼーションスイート',
    description: 'GameStringerはAIによるビデオゲーム翻訳のための究極のオープンソーススイートです。Unity、Unreal、Godot、RPG Makerなど10以上のエンジンをサポート。無料のOllama、GPT-4、Claude、Geminiなど15以上のAIプロバイダー。',
    nav: { features: '機能', engines: 'エンジン', ai: 'AIプロバイダー', usecases: '使用例', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — インタラクティブチュートリアル、AI自動用語集、ワンクリックUnreal TM&リビジョン',
      title: 'GameStringer',
      subtitle: 'AIでゲームをローカライズ。オープンソース。無料。',
      desc: '<strong>11以上のエンジン</strong>（Unity、Unreal、Godot、RPG Maker、Ren\'Py、ダンガンロンパ...）と<strong>20以上のAIプロバイダー</strong>（TranslateGemma、Ollama、GPT-4、Claude、Gemini、DeepSeek...）をサポート。テキストの抽出、翻訳、注入を自動で。<strong>AI自動用語集</strong>、永続Translation Memory。',
      download: '⬇️ Windows版無料ダウンロード',
      source: '📂 ソースコードを見る',
      meta: ['100%無料＆オープンソース', 'アカウント不要', 'Ollamaでローカルで', 'Windows 10/11 64-bit']
    },
    stats: {
      engines: { value: '11+', label: 'ゲームエンジン', detail: 'Unity、Unreal、Godot、RPG Maker、ダンガンロンパ...' },
      ai: { value: '20+', label: 'AIプロバイダー', detail: '10無料、8ローカル、HY-MT最適化' },
      stores: { value: '7', label: '統合ストア', detail: 'Steam、Epic、GOG、Origin...' },
      games: { value: '∞', label: '翻訳可能なゲーム', detail: 'インディー、レトロ、AAA' }
    },
    cta: {
      title: '翻訳の準備はできましたか？',
      desc: 'GameStringerを無料でダウンロードして、お気に入りのゲームをあなたの言語でプレイしましょう。アカウント不要、サブスクリプション不要、制限なし。',
      download: '⬇️ Windows版ダウンロード（無料）',
      star: '⭐ GitHubでスター',
      features: ['永久無料', 'オープンソース', 'アカウント不要', 'ローカルAI対応', '無料アップデート']
    },
    support: {
      title: '❤️ プロジェクトを支援',
      desc: 'GameStringerは趣味の時間で開発されています。あなたの支援がプロジェクトの維持と新機能の追加に役立ちます！',
      kofi: '☕ Ko-fiでコーヒーを奢る',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: '人工知能でビデオゲームを翻訳するための究極のオープンソーススイート。あらゆるエンジン、あらゆるAI、あらゆる言語をサポート。',
      resources: 'リソース',
      community: 'コミュニティ',
      support: '支援',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Made with',
      inCountry: 'イタリアで 🇮🇹'
    }
  },
  zh: {
    lang: 'zh',
    title: 'GameStringer - AI翻译任何游戏 | 完整本地化套件',
    description: 'GameStringer是用于AI驱动视频游戏翻译的终极开源套件。支持Unity、Unreal、Godot、RPG Maker等10多种引擎。15多种AI提供商，包括免费的Ollama、GPT-4、Claude、Gemini。',
    nav: { features: '功能', engines: '引擎', ai: 'AI提供商', usecases: '使用场景', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — 交互式教程、AI自动术语表、一键点击Unreal TM&修订',
      title: 'GameStringer',
      subtitle: '用AI本地化游戏。开源。免费。',
      desc: '支持<strong>11多种引擎</strong>（Unity、Unreal、Godot、RPG Maker、Ren\'Py、弹丸论破...）和<strong>20多种AI提供商</strong>（TranslateGemma、Ollama、GPT-4、Claude、Gemini、DeepSeek...）。自动提取、翻译和注入文本。<strong>AI自动术语表</strong>，持久Translation Memory。',
      download: '⬇️ Windows免费下载',
      source: '📂 查看源代码',
      meta: ['100%免费且开源', '无需账户', '使用Ollama本地AI', 'Windows 10/11 64位']
    },
    stats: {
      engines: { value: '11+', label: '游戏引擎', detail: 'Unity、Unreal、Godot、RPG Maker、弹丸论破...' },
      ai: { value: '20+', label: 'AI提供商', detail: '10个免费，8个本地，HY-MT优化' },
      stores: { value: '7', label: '集成商店', detail: 'Steam、Epic、GOG、Origin...' },
      games: { value: '∞', label: '可翻译游戏', detail: '独立、复古、AAA' }
    },
    cta: {
      title: '准备好翻译了吗？',
      desc: '免费下载GameStringer，开始用您的语言玩您最喜欢的游戏。无需账户，无需订阅，没有限制。',
      download: '⬇️ 下载Windows版（免费）',
      star: '⭐ GitHub上加星',
      features: ['永久免费', '开源', '无需账户', '本地AI可用', '免费更新']
    },
    support: {
      title: '❤️ 支持项目',
      desc: 'GameStringer在业余时间开发。您的支持有助于保持项目活跃并添加新功能！',
      kofi: '☕ 在Ko-fi上请我喝咖啡',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: '使用人工智能翻译视频游戏的终极开源套件。支持任何引擎、任何AI、任何语言。',
      resources: '资源',
      community: '社区',
      support: '支持',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Made with',
      inCountry: '在意大利 🇮🇹'
    }
  },
  ko: {
    lang: 'ko',
    title: 'GameStringer - AI로 모든 게임 번역 | 완전한 현지화 제품군',
    description: 'GameStringer는 AI 기반 비디오 게임 번역을 위한 최고의 오픈 소스 제품군입니다. Unity, Unreal, Godot, RPG Maker 등 10개 이상의 엔진을 지원합니다. 무료 Ollama, GPT-4, Claude, Gemini를 포함한 15개 이상의 AI 제공자.',
    nav: { features: '기능', engines: '엔진', ai: 'AI 제공자', usecases: '사용 사례', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — 인터랙티브 튜토리얼, AI 자동 용어집, 원클릭 Unreal TM&리비전',
      title: 'GameStringer',
      subtitle: 'AI로 게임 현지화. 오픈 소스. 무료.',
      desc: '<strong>11개 이상의 엔진</strong>(Unity, Unreal, Godot, RPG Maker, Ren\'Py, 단간론파...)과 <strong>20개 이상의 AI 제공자</strong>(TranslateGemma, Ollama, GPT-4, Claude, Gemini, DeepSeek...)를 지원합니다. 텍스트를 자동으로 추출, 번역 및 주입합니다. <strong>AI 자동 용어집</strong>, 영구 Translation Memory.',
      download: '⬇️ Windows용 무료 다운로드',
      source: '📂 소스 코드 보기',
      meta: ['100% 무료 & 오픈 소스', '계정 필요 없음', 'Ollama로 로컬 AI', 'Windows 10/11 64비트']
    },
    stats: {
      engines: { value: '11+', label: '게임 엔진', detail: 'Unity, Unreal, Godot, RPG Maker, 단간론파...' },
      ai: { value: '20+', label: 'AI 제공자', detail: '10개 무료, 8개 로컬, HY-MT 최적화' },
      stores: { value: '7', label: '통합 스토어', detail: 'Steam, Epic, GOG, Origin...' },
      games: { value: '∞', label: '번역 가능한 게임', detail: '인디, 레트로, AAA' }
    },
    cta: {
      title: '번역할 준비가 되셨나요?',
      desc: 'GameStringer를 무료로 다운로드하고 좋아하는 게임을 여러분의 언어로 플레이하세요. 계정 없이, 구독 없이, 제한 없이.',
      download: '⬇️ Windows용 다운로드 (무료)',
      star: '⭐ GitHub에서 스타',
      features: ['영원히 무료', '오픈 소스', '계정 필요 없음', '로컬 AI 사용 가능', '무료 업데이트']
    },
    support: {
      title: '❤️ 프로젝트 지원',
      desc: 'GameStringer는 여가 시간에 개발됩니다. 여러분의 지원이 프로젝트를 활성화하고 새로운 기능을 추가하는 데 도움이 됩니다!',
      kofi: '☕ Ko-fi에서 커피 사주기',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: '인공지능으로 비디오 게임을 번역하기 위한 최고의 오픈 소스 제품군. 모든 엔진, 모든 AI, 모든 언어를 지원합니다.',
      resources: '리소스',
      community: '커뮤니티',
      support: '지원',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Made with',
      inCountry: '이탈리아에서 🇮🇹'
    }
  },
  pt: {
    lang: 'pt',
    title: 'GameStringer - Traduza Qualquer Jogo com IA | Suite Completa de Localização',
    description: 'GameStringer é a suite open source definitiva para tradução de videogames com IA. Suporta Unity, Unreal, Godot, RPG Maker e 10+ engines. 15+ provedores de IA incluindo Ollama gratuito, GPT-4, Claude, Gemini.',
    nav: { features: 'Recursos', engines: 'Engines', ai: 'Provedores IA', usecases: 'Casos de Uso', faq: 'FAQ' },
    hero: {
      badge: 'v1.4.0 — Tutorial Interativo, Auto-Glossário IA, One-Click Unreal com TM & Revisão',
      title: 'GameStringer',
      subtitle: 'Localize jogos com IA. Open source. Grátis.',
      desc: 'Suporta <strong>11+ engines</strong> (Unity, Unreal, Godot, RPG Maker, Ren\'Py, Danganronpa...) e <strong>20+ provedores IA</strong> (TranslateGemma, Ollama, GPT-4, Claude, Gemini, DeepSeek...). Extraia, traduza e injete textos automaticamente. <strong>Auto-glossário IA</strong>, Translation Memory persistente.',
      download: '⬇️ Download Gratuito para Windows',
      source: '📂 Ver Código Fonte',
      meta: ['100% Gratuito & Open Source', 'Sem conta necessária', 'IA local com Ollama', 'Windows 10/11 64-bit']
    },
    stats: {
      engines: { value: '11+', label: 'Game Engines', detail: 'Unity, Unreal, Godot, RPG Maker, Danganronpa...' },
      ai: { value: '20+', label: 'Provedores IA', detail: '10 gratuitos, 8 locais, HY-MT otimizado' },
      stores: { value: '7', label: 'Lojas Integradas', detail: 'Steam, Epic, GOG, Origin...' },
      games: { value: '∞', label: 'Jogos Traduzíveis', detail: 'Indie, retro, AAA' }
    },
    cta: {
      title: 'Pronto para Traduzir?',
      desc: 'Baixe o GameStringer gratuitamente e comece a jogar seus jogos favoritos no seu idioma. Sem conta, sem assinatura, sem limites.',
      download: '⬇️ Download para Windows (Gratuito)',
      star: '⭐ Star no GitHub',
      features: ['100% Gratuito Para Sempre', 'Open Source', 'Sem Conta', 'IA Local Disponível', 'Atualizações Gratuitas']
    },
    support: {
      title: '❤️ Apoie o Projeto',
      desc: 'GameStringer é desenvolvido no tempo livre. Seu apoio ajuda a manter o projeto ativo e adicionar novos recursos!',
      kofi: '☕ Me pague um Café no Ko-fi',
      sponsors: '💜 GitHub Sponsors'
    },
    footer: {
      desc: 'A suite open source definitiva para traduzir videogames com inteligência artificial. Suporta qualquer engine, qualquer IA, qualquer idioma.',
      resources: 'Recursos',
      community: 'Comunidade',
      support: 'Apoiar',
      copyright: '© 2025-2026 GameStringer by',
      madeWith: 'Feito com',
      inCountry: 'na Itália 🇮🇹'
    }
  }
};

// Language flags and names
const languages = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'zh', flag: '🇨🇳', name: '中文' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'pt', flag: '🇧🇷', name: 'Português' }
];

// Get current language from URL or localStorage
function getCurrentLang() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  if (urlLang && siteTranslations[urlLang]) return urlLang;
  
  const savedLang = localStorage.getItem('gamestringer-site-lang');
  if (savedLang && siteTranslations[savedLang]) return savedLang;
  
  const browserLang = navigator.language.split('-')[0];
  if (siteTranslations[browserLang]) return browserLang;
  
  return 'en';
}

// Set language
function setLanguage(lang) {
  if (!siteTranslations[lang]) return;
  
  localStorage.setItem('gamestringer-site-lang', lang);
  document.documentElement.lang = lang;
  
  const t = siteTranslations[lang];
  
  // Update page title and meta
  document.title = t.title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.content = t.description;
  
  // Update elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = getNestedValue(t, key);
    if (value) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = value;
      } else {
        el.innerHTML = value;
      }
    }
  });
  
  // Update language selector
  const langBtn = document.getElementById('lang-current');
  if (langBtn) {
    const currentLang = languages.find(l => l.code === lang);
    langBtn.innerHTML = `${currentLang.flag} ${currentLang.code.toUpperCase()}`;
  }
  
  // Update URL without reload
  const url = new URL(window.location);
  url.searchParams.set('lang', lang);
  window.history.replaceState({}, '', url);
}

// Helper to get nested object value
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o && o[k], obj);
}

// Create language selector HTML
function createLanguageSelector() {
  const currentLang = languages.find(l => l.code === getCurrentLang());
  
  return `
    <div class="lang-selector">
      <button id="lang-current" class="lang-btn" onclick="toggleLangMenu()">
        ${currentLang.flag} ${currentLang.code.toUpperCase()}
      </button>
      <div id="lang-menu" class="lang-menu">
        ${languages.map(l => `
          <button class="lang-option ${l.code === currentLang.code ? 'active' : ''}" onclick="setLanguage('${l.code}')">
            ${l.flag} ${l.name}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function toggleLangMenu() {
  const menu = document.getElementById('lang-menu');
  menu.classList.toggle('open');
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.lang-selector')) {
    const menu = document.getElementById('lang-menu');
    if (menu) menu.classList.remove('open');
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setLanguage(getCurrentLang());
});
