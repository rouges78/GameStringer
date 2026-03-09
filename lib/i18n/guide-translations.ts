// Guide page translations — no placeholders, text only.
// Links (NavLink) and structural elements (strong, kbd, code) are in JSX.
// Fallback: if a language is not defined, English is used.

const it = {
  // Tabs
  tabQuickStart: 'Quick Start', tabWorkflows: 'Flussi di Lavoro', tabTools: 'Strumenti', tabShortcuts: 'Scorciatoie', tabFaq: 'FAQ',
  // Quick Start
  qsTitle: 'Primi Passi con GameStringer',
  qsSubtitle: 'Segui questi passaggi per iniziare a tradurre il tuo primo gioco in meno di 5 minuti.',
  qsStep1Title: 'Configura il provider AI',
  qsStep1Line1: 'Vai in',        // followed by NavLink "Impostazioni"
  qsStep1Line1b: '→ tab',        // followed by bold "AI"
  qsStep1Line2: 'Seleziona un provider (es. OpenAI, Gemini, DeepL) e incolla la tua API key.',
  qsStep1Line3: 'Clicca',        // followed by bold "Salva"
  qsStep1Line3b: '. La chiave viene salvata in modo sicuro nel tuo profilo.',
  qsStep1Tip: 'Non hai una API key? Puoi usare Ollama per traduzioni gratuite e offline. Vai in Impostazioni → Ollama per configurarlo.',
  qsStep2Title: 'Collega i tuoi store di giochi',
  qsStep2Line1: 'Vai in',        // followed by NavLink "Stores"
  qsStep2Line1b: 'e configura almeno uno store (Steam, Epic, GOG...).',
  qsStep2Line2: 'Per Steam: inserisci il tuo Steam ID e una API Key (gratuita da steamcommunity.com/dev/apikey).',
  qsStep2Line3: 'GameStringer scaricherà automaticamente la tua libreria con tutte le info: engine, lingue supportate, percorso di installazione.',
  qsStep3Title: 'Vai alla Libreria e scegli un gioco',
  qsStep3Line1: 'Apri la',       // followed by NavLink "Libreria"
  qsStep3Line1b: '. Vedrai tutti i tuoi giochi con copertine, engine e stato installazione.',
  qsStep3Line2: 'Clicca su un gioco installato per vedere i dettagli: engine rilevato, file di localizzazione trovati, lingue supportate.',
  qsStep3Line3a: 'Dal dettaglio gioco, clicca',  // followed by bold "Traduci"
  qsStep3Line3b: 'per avviare la traduzione.',
  qsStep4Title: 'Traduci automaticamente',
  qsStep4Line1: 'La pagina',     // followed by NavLink "Auto-Translate"
  qsStep4Line1b: 'scansiona automaticamente i file del gioco.',
  qsStep4Line2: 'Se trova file traducibili (JSON, CSV, PO, XML, ecc.), li carica e puoi tradurli con un click.',
  qsStep4Line3a: 'Scegli lingua sorgente/destinazione, provider AI, e clicca', // followed by bold "Avvia Traduzione"
  qsStep4Line4: 'La traduzione avviene in batch con barra di progresso, stima tempo, e salvataggio automatico.',
  qsStep5Title: 'Rivedi, esporta e applica la patch',
  qsStep5Line1: 'Dopo la traduzione, la fase di Review mostra ogni stringa con punteggio qualità.',
  qsStep5Line2: 'Puoi modificare manualmente qualsiasi traduzione cliccandoci sopra.',
  qsStep5Line3: 'Nella fase Patch, GameStringer genera un pacchetto ZIP con i file tradotti pronti da copiare nella cartella del gioco.',
  qsStep5Tip: 'Per giochi Unity, GameStringer può installare automaticamente BepInEx + XUnity AutoTranslator — non serve fare nulla a mano!',
  // What you need
  needTitle: 'Cosa serve per iniziare',
  needApiTitle: 'API Key AI (consigliata)', needApiDesc: 'OpenAI, Gemini, DeepL, Claude, DeepSeek, Mistral o OpenRouter. Oppure usa Ollama per tradurre gratis offline.',
  needGamesTitle: 'Giochi installati', needGamesDesc: 'Almeno un gioco installato su Steam, Epic, GOG o altra piattaforma. GameStringer rileva automaticamente i file.',
  needInternetTitle: 'Connessione internet', needInternetDesc: 'Per i provider AI cloud. Non necessaria se usi Ollama.',
  // Workflow: Unity
  wfUnityTitle: 'Tradurre un gioco Unity', wfUnityDesc: 'Il flusso più comune. GameStringer gestisce tutto automaticamente.',
  wfUnityStep1Title: 'Seleziona il gioco dalla Libreria',
  wfUnityStep1Line1: 'Apri',     // followed by NavLink "Libreria"
  wfUnityStep1Line1b: '→ cerca il gioco → clicca su di esso.',
  wfUnityStep1Line2: 'GameStringer rileva se è Unity dalla presenza di UnityPlayer.dll.',
  wfUnityStep2Title: "Clicca 'Traduci' → Auto-Translate",
  wfUnityStep2Line1: 'Se non trova file di localizzazione, GameStringer rileva che è Unity e propone di installare BepInEx + XUnity AutoTranslator.',
  wfUnityStep2Line2a: 'Clicca',  // followed by bold "Installa"
  wfUnityStep2Line2b: '— il processo è completamente automatico.',
  wfUnityStep3Title: 'Avvia il gioco una volta',
  wfUnityStep3Line1: "Dopo l'installazione, avvia il gioco normalmente. BepInEx genera i file di traduzione alla prima esecuzione.",
  wfUnityStep3Line2: 'Chiudi il gioco e torna su GameStringer.',
  wfUnityStep4Title: 'Ri-scansiona e traduci',
  wfUnityStep4Line1a: 'Clicca',  // followed by bold "Ri-Scansiona"
  wfUnityStep4Line1b: '. Ora GameStringer trova i file di traduzione generati da XUnity.',
  wfUnityStep4Line2: 'Avvia la traduzione AI. I file tradotti verranno inseriti direttamente nella cartella di XUnity.',
  wfUnityTip: 'In-game puoi premere ALT+T per aprire il menu di XUnity AutoTranslator e regolare le impostazioni.',
  // Workflow: Files
  wfFilesTitle: 'Tradurre un gioco con file di localizzazione', wfFilesDesc: 'Per giochi che hanno già file JSON, CSV, PO, XML nella cartella di installazione.',
  wfFilesStep1Title: 'Libreria → Traduci',
  wfFilesStep1Line1: 'Seleziona il gioco dalla',  // followed by NavLink "Libreria"
  wfFilesStep1Line1b: 'e clicca',  // followed by bold "Traduci"
  wfFilesStep1Line2: 'GameStringer scansiona fino a 8 livelli di sotto-cartelle cercando file traducibili.',
  wfFilesStep2Title: 'Seleziona i file da tradurre',
  wfFilesStep2Line1: 'Vengono caricati automaticamente i file trovati. Puoi deselezionare quelli che non ti servono.',
  wfFilesStep2Line2: 'Formati supportati: JSON, CSV, PO/POT, XLIFF, RESX, XML, YAML, LUA, RPY, INI, TXT, LANG.',
  wfFilesStep3Title: 'Configura e avvia',
  wfFilesStep3Line1a: 'Scegli provider AI, lingua sorgente/destinazione, e clicca',
  wfFilesStep3Line2: 'La traduzione procede in batch. Puoi mettere in pausa e riprendere in qualsiasi momento.',
  wfFilesStep3Line3: "Se chiudi l'app, il checkpoint viene salvato automaticamente — puoi riprendere la prossima volta.",
  wfFilesStep4Title: 'Rivedi e applica',
  wfFilesStep4Line1: 'Nella fase Review, ogni stringa ha un punteggio qualità (0-100). Le stringhe sotto soglia sono evidenziate.',
  wfFilesStep4Line2: 'Genera la patch ZIP e copia i file nella cartella del gioco.',
  // Workflow: Pro
  wfProTitle: 'Neural Translator Pro — traduzione avanzata', wfProDesc: 'Per chi vuole controllo totale: scelta file, contesto, glossario, export.',
  wfProStep1Title: 'Apri Neural Translator Pro',
  wfProStep1Line1: 'Vai in',     // followed by NavLink
  wfProStep1Line1b: '. Seleziona il gioco dal dropdown o dalla Libreria.',
  wfProStep2Title: 'Seleziona file e configura',
  wfProStep2Line1: 'Puoi selezionare singoli file da tradurre. Configura: provider AI, lingua, glossario, Translation Memory.',
  wfProStep2Line2: 'Il sistema usa la Translation Memory per riutilizzare traduzioni precedenti e risparmiare costi API.',
  wfProStep3Title: 'Traduci con preview in tempo reale',
  wfProStep3Line1: 'Durante la traduzione vedi ogni stringa tradotta in tempo reale. Timer, progresso, errori — tutto visibile.',
  wfProStep4Title: 'Applica al gioco o esporta',
  wfProStep4Line1: 'Puoi applicare direttamente la patch al gioco (con backup automatico) oppure esportare come ZIP/file singoli.',
  wfProStep4Line2: 'Per giochi Unreal Engine, GameStringer crea file .locres e .pak pronti.',
  // Workflow: OCR
  wfOcrTitle: 'Traduzione OCR — cattura testo dallo schermo', wfOcrDesc: 'Per giochi senza file di localizzazione accessibili. Cattura e traduci il testo visibile.',
  wfOcrStep1Title: 'Apri OCR Translator',
  wfOcrStep1Line1: 'Vai in',     // followed by NavLink
  wfOcrStep1Line1b: 'o premi',   // followed by kbd
  wfOcrStep1Line1c: 'da qualsiasi punto.',
  wfOcrStep2Title: "Seleziona l'area dello schermo",
  wfOcrStep2Line1: 'Cattura una porzione dello schermo dove appare il testo del gioco (dialoghi, menu, ecc.).',
  wfOcrStep2Line2: "L'OCR estrae il testo automaticamente. Per giochi retro/pixel art, usa i preset di pre-processing (8-bit, 16-bit, DOS).",
  wfOcrStep3Title: 'Traduzione istantanea',
  wfOcrStep3Line1: 'Il testo estratto viene tradotto istantaneamente con il provider AI configurato.',
  wfOcrStep3Line2: "Il risultato appare nell'overlay o nel pannello laterale.",
  wfOcrTip: 'Per traduzione continua senza click, usa',  // followed by NavLink "Live OCR"
  wfOcrTipEnd: '— cattura automatica a intervalli regolari.',
  // Workflow: Voice
  wfVoiceTitle: 'Traduzione vocale e voice clone', wfVoiceDesc: 'Traduci dialoghi parlati e ricrea le voci nella lingua di destinazione.',
  wfVoiceStep1Title: 'Carica o registra audio',
  wfVoiceStep1Line1: 'In',       // followed by NavLink "Voice Translator"
  wfVoiceStep1Line1b: ", carica un file audio o registra direttamente.",
  wfVoiceStep1Line2: "Whisper (OpenAI) trascrive automaticamente l'audio in testo.",
  wfVoiceStep2Title: 'Traduzione del testo',
  wfVoiceStep2Line1: 'Il testo trascritto viene tradotto con il provider AI selezionato.',
  wfVoiceStep3Title: 'Text-to-Speech nella lingua target',
  wfVoiceStep3Line1: 'La traduzione viene letta ad alta voce con voci AI (Nova, Alloy, Echo, Fable, Onyx, Shimmer).',
  wfVoiceStep3Line2: 'Per voci personalizzate, usa',  // followed by NavLink "Voice Clone Studio"
  wfVoiceStep3Line2b: 'con ElevenLabs.',
  // Shortcuts
  scNavTitle: 'Navigazione e interfaccia',
  scNavCmdPalette: 'Command Palette — cerca qualsiasi pagina o azione',
  scNavSearch: 'Ricerca globale nella pagina corrente',
  scNavSettings: 'Apri Impostazioni',
  scNavRefresh: 'Aggiorna dati libreria',
  scNavClose: 'Chiudi modale, pannello o dropdown aperto',
  scNavShortcuts: 'Mostra tutte le scorciatoie',
  scGlobalTitle: 'Hotkey globali (attive anche con gioco in primo piano)',
  scGlobalOcr: 'Cattura OCR — seleziona area e traduci',
  scGlobalQuick: 'Traduzione rapida — traduci testo negli appunti',
  scGlobalOverlay: 'Toggle Overlay — mostra/nascondi overlay traduzione',
  scGlobalXunity: 'Menu XUnity AutoTranslator (in-game, dopo installazione)',
  scGlobalTip: 'Le hotkey globali funzionano anche quando GameStringer è in background e il gioco è in primo piano.',
  scTransTitle: 'Durante la traduzione',
  scTransPause: 'Pausa / Riprendi traduzione',
  scTransNext: 'Stringa successiva (in Review)',
  scTransPrev: 'Stringa precedente (in Review)',
  scTransConfirm: 'Conferma modifica stringa',
  // FAQ
  faqTitle: 'Domande frequenti',
  faqCostQ: 'Quanto costa usare GameStringer?',
  faqCostA: 'GameStringer è gratuito e open source. Paghi solo le API dei provider AI che scegli di usare (OpenAI, Gemini, ecc.). Con Ollama puoi tradurre gratuitamente usando modelli AI locali sul tuo PC.',
  faqProvidersQ: 'Quali provider AI posso usare?',
  faqProvidersA: 'OpenAI (GPT-4o, GPT-4), Google Gemini, Anthropic Claude, DeepSeek, Mistral, OpenRouter, DeepL, e Ollama per traduzione offline.',
  faqLangsQ: 'Posso tradurre in qualsiasi lingua?',
  faqLangsA: "Sì. GameStringer supporta qualsiasi coppia di lingue supportata dal provider AI selezionato.",
  faqFilesQ: 'La traduzione modifica i file originali del gioco?',
  faqFilesA: "No. GameStringer genera sempre file separati o patch ZIP. Per l'applicazione diretta (es. Unreal .pak), viene fatto un backup automatico.",
  faqMultiplayerQ: 'Funziona con giochi multiplayer online?',
  faqMultiplayerA: "Dipende dal gioco. La traduzione dei file è sicura. Per giochi con anti-cheat aggressivo, usa l'Overlay o l'OCR.",
  // Troubleshooting
  troubleTitle: 'Risoluzione problemi',
  troubleNoFilesQ: '"Nessun file traducibile trovato" — come risolvo?',
  troubleNoFilesA: "Alcuni giochi criptano i file. Prova:\n• Per giochi Unity: usa il Unity Patcher\n• Per giochi Unreal: usa l'UE Translator\n• Per altri engine: usa il Crawler o carica manualmente",
  troubleApiQ: 'La traduzione si blocca o dà errore API',
  troubleApiA: '• Verifica che la API key sia valida in Impostazioni → AI\n• Controlla di avere credito sul provider\n• Riduci il Batch Size\n• Checkpoint automatico: puoi riprendere',
  troubleBepinexQ: 'BepInEx non funziona / il gioco crasha',
  troubleBepinexA: "• Assicurati che il gioco sia chiuso prima di installare\n• Per Unity < 5.6, GameStringer usa IPA\n• Verifica che l'antivirus non blocchi BepInEx",
  troubleCharsQ: 'I caratteri speciali non appaiono correttamente',
  troubleCharsA: '• Usa il Fixer per correggere encoding\n• Assicurati che il file sia salvato in UTF-8',
  troubleBackupQ: 'Come faccio backup delle mie traduzioni?',
  troubleBackupA: "• Vai in Impostazioni → Backup\n• Esporta qualsiasi progetto come ZIP dalla pagina Project Manager",
  // Engine guide
  engineGuideTitle: 'Guida per engine di gioco',
  engineUnity: 'BepInEx + XUnity AutoTranslator. Automatico.',
  engineUnreal: 'Estrae .locres, traduce, crea .pak.',
  engineRpgMaker: 'Estrae database e mappe automaticamente.',
  engineRenpy: 'Gestisce script .rpy con variabili.',
  engineWolfRpg: 'Estrae e modifica dati proprietari.',
  engineTelltale: 'File .langdb/.dlog per Walking Dead ecc.',
  engineGodot: 'Scansiona e traduci file .tres/.tscn.',
  engineGameMaker: 'Cerca file data.win e stringhe interne.',
  // Misc
  otherFunctions: 'altre funzioni',
  btnSave: 'Salva', btnInstall: 'Installa', btnRescan: 'Ri-Scansiona', btnTranslate: 'Traduci', btnStartTranslation: 'Avvia Traduzione',
};

type GT = typeof it;

const en: GT = {
  tabQuickStart: 'Quick Start', tabWorkflows: 'Workflows', tabTools: 'Tools', tabShortcuts: 'Shortcuts', tabFaq: 'FAQ',
  qsTitle: 'Getting Started with GameStringer', qsSubtitle: 'Follow these steps to start translating your first game in under 5 minutes.',
  qsStep1Title: 'Configure your AI provider',
  qsStep1Line1: 'Go to', qsStep1Line1b: '→ tab', qsStep1Line2: 'Select a provider (e.g. OpenAI, Gemini, DeepL) and paste your API key.', qsStep1Line3: 'Click', qsStep1Line3b: '. The key is securely saved in your profile.', qsStep1Tip: "Don't have an API key? You can use Ollama for free offline translations. Go to Settings → Ollama to configure it.",
  qsStep2Title: 'Connect your game stores',
  qsStep2Line1: 'Go to', qsStep2Line1b: 'and configure at least one store (Steam, Epic, GOG...).', qsStep2Line2: 'For Steam: enter your Steam ID and an API Key (free from steamcommunity.com/dev/apikey).', qsStep2Line3: 'GameStringer will automatically download your library with all info: engine, supported languages, install path.',
  qsStep3Title: 'Go to the Library and pick a game',
  qsStep3Line1: 'Open the', qsStep3Line1b: ". You'll see all your games with covers, engine and install status.", qsStep3Line2: 'Click on an installed game to see details: detected engine, localization files found, supported languages.', qsStep3Line3a: 'From the game detail, click', qsStep3Line3b: 'to start translating.',
  qsStep4Title: 'Translate automatically',
  qsStep4Line1: 'The', qsStep4Line1b: 'page automatically scans the game files.', qsStep4Line2: 'If it finds translatable files (JSON, CSV, PO, XML, etc.), it loads them and you can translate with one click.', qsStep4Line3a: 'Choose source/target language, AI provider, and click', qsStep4Line4: 'Translation runs in batches with progress bar, time estimate, and auto-save.',
  qsStep5Title: 'Review, export and apply the patch',
  qsStep5Line1: 'After translation, the Review phase shows each string with a quality score.', qsStep5Line2: 'You can manually edit any translation by clicking on it.', qsStep5Line3: "In the Patch phase, GameStringer generates a ZIP package with translated files ready to copy into the game's folder.", qsStep5Tip: 'For Unity games, GameStringer can automatically install BepInEx + XUnity AutoTranslator — no manual work needed!',
  needTitle: 'What you need to get started', needApiTitle: 'AI API Key (recommended)', needApiDesc: 'OpenAI, Gemini, DeepL, Claude, DeepSeek, Mistral or OpenRouter. Or use Ollama to translate for free offline.', needGamesTitle: 'Installed games', needGamesDesc: 'At least one game installed on Steam, Epic, GOG or another platform. GameStringer detects files automatically.', needInternetTitle: 'Internet connection', needInternetDesc: 'For cloud AI providers. Not needed if you use Ollama.',
  wfUnityTitle: 'Translating a Unity game', wfUnityDesc: 'The most common workflow. GameStringer handles everything automatically.',
  wfUnityStep1Title: 'Select the game from the Library', wfUnityStep1Line1: 'Open', wfUnityStep1Line1b: '→ find the game → click on it.', wfUnityStep1Line2: 'GameStringer detects Unity by the presence of UnityPlayer.dll.',
  wfUnityStep2Title: "Click 'Translate' → Auto-Translate", wfUnityStep2Line1: 'If no localization files are found, GameStringer detects Unity and offers to install BepInEx + XUnity AutoTranslator.', wfUnityStep2Line2a: 'Click', wfUnityStep2Line2b: '— the process is fully automatic.',
  wfUnityStep3Title: 'Launch the game once', wfUnityStep3Line1: 'After installation, launch the game normally. BepInEx generates translation files on first run.', wfUnityStep3Line2: 'Close the game and return to GameStringer.',
  wfUnityStep4Title: 'Re-scan and translate', wfUnityStep4Line1a: 'Click', wfUnityStep4Line1b: '. Now GameStringer finds the translation files generated by XUnity.', wfUnityStep4Line2: "Start AI translation. Translated files will be placed directly in XUnity's folder.",
  wfUnityTip: 'In-game you can press ALT+T to open the XUnity AutoTranslator menu and adjust settings.',
  wfFilesTitle: 'Translating a game with localization files', wfFilesDesc: 'For games that already have JSON, CSV, PO, XML files in the install folder.',
  wfFilesStep1Title: 'Library → Translate', wfFilesStep1Line1: 'Select the game from the', wfFilesStep1Line1b: 'and click', wfFilesStep1Line2: 'GameStringer scans up to 8 levels of subfolders looking for translatable files.',
  wfFilesStep2Title: 'Select files to translate', wfFilesStep2Line1: "Found files are loaded automatically. You can deselect any you don't need.", wfFilesStep2Line2: 'Supported formats: JSON, CSV, PO/POT, XLIFF, RESX, XML, YAML, LUA, RPY, INI, TXT, LANG.',
  wfFilesStep3Title: 'Configure and start', wfFilesStep3Line1a: 'Choose AI provider, source/target language, and click', wfFilesStep3Line2: 'Translation runs in batches. You can pause and resume at any time.', wfFilesStep3Line3: 'If you close the app, the checkpoint is saved automatically — you can resume next time.',
  wfFilesStep4Title: 'Review and apply', wfFilesStep4Line1: 'In the Review phase, each string has a quality score (0-100). Strings below threshold are highlighted.', wfFilesStep4Line2: "Generate the patch ZIP and copy the files into the game's folder.",
  wfProTitle: 'Neural Translator Pro — advanced translation', wfProDesc: 'For those who want full control: file selection, context, glossary, export.',
  wfProStep1Title: 'Open Neural Translator Pro', wfProStep1Line1: 'Go to', wfProStep1Line1b: '. Select the game from the dropdown or from the Library.',
  wfProStep2Title: 'Select files and configure', wfProStep2Line1: 'You can select individual files to translate. Configure: AI provider, language, glossary, Translation Memory.', wfProStep2Line2: 'The system uses the Translation Memory to reuse previous translations and save API costs.',
  wfProStep3Title: 'Translate with real-time preview', wfProStep3Line1: 'During translation you see each string translated in real-time. Timer, progress, errors — all visible.',
  wfProStep4Title: 'Apply to game or export', wfProStep4Line1: 'You can apply the patch directly to the game (with automatic backup) or export as ZIP/individual files.', wfProStep4Line2: 'For Unreal Engine games, GameStringer creates .locres and .pak files ready to use.',
  wfOcrTitle: 'OCR Translation — capture text from screen', wfOcrDesc: 'For games without accessible localization files. Capture and translate visible text.',
  wfOcrStep1Title: 'Open OCR Translator', wfOcrStep1Line1: 'Go to', wfOcrStep1Line1b: 'or press', wfOcrStep1Line1c: 'from anywhere.',
  wfOcrStep2Title: 'Select the screen area', wfOcrStep2Line1: 'Capture a portion of the screen where game text appears (dialogues, menus, etc.).', wfOcrStep2Line2: 'OCR extracts the text automatically. For retro/pixel art games, use pre-processing presets (8-bit, 16-bit, DOS).',
  wfOcrStep3Title: 'Instant translation', wfOcrStep3Line1: 'Extracted text is translated instantly with the configured AI provider.', wfOcrStep3Line2: 'The result appears in the overlay or side panel.',
  wfOcrTip: 'For continuous translation without clicking, use', wfOcrTipEnd: '— automatic capture at regular intervals.',
  wfVoiceTitle: 'Voice translation and voice clone', wfVoiceDesc: 'Translate spoken dialogue and recreate voices in the target language.',
  wfVoiceStep1Title: 'Upload or record audio', wfVoiceStep1Line1: 'In', wfVoiceStep1Line1b: ', upload an audio file or record directly.', wfVoiceStep1Line2: 'Whisper (OpenAI) automatically transcribes the audio to text.',
  wfVoiceStep2Title: 'Text translation', wfVoiceStep2Line1: 'The transcribed text is translated with the selected AI provider.',
  wfVoiceStep3Title: 'Text-to-Speech in target language', wfVoiceStep3Line1: 'The translation is read aloud with AI voices (Nova, Alloy, Echo, Fable, Onyx, Shimmer).', wfVoiceStep3Line2: 'For custom voices, use', wfVoiceStep3Line2b: 'with ElevenLabs.',
  scNavTitle: 'Navigation and interface', scNavCmdPalette: 'Command Palette — search any page or action', scNavSearch: 'Global search in current page', scNavSettings: 'Open Settings', scNavRefresh: 'Refresh library data', scNavClose: 'Close modal, panel or open dropdown', scNavShortcuts: 'Show all shortcuts',
  scGlobalTitle: 'Global hotkeys (active even with game in foreground)', scGlobalOcr: 'OCR Capture — select area and translate', scGlobalQuick: 'Quick translate — translate clipboard text', scGlobalOverlay: 'Toggle Overlay — show/hide translation overlay', scGlobalXunity: 'XUnity AutoTranslator menu (in-game, after installation)', scGlobalTip: 'Global hotkeys work even when GameStringer is in the background and the game is in the foreground.',
  scTransTitle: 'During translation', scTransPause: 'Pause / Resume translation', scTransNext: 'Next string (in Review)', scTransPrev: 'Previous string (in Review)', scTransConfirm: 'Confirm string edit',
  faqTitle: 'Frequently Asked Questions',
  faqCostQ: 'How much does GameStringer cost?', faqCostA: 'GameStringer is free and open source. You only pay for the AI provider APIs you choose (OpenAI, Gemini, etc.). With Ollama you can translate for free using local AI models.',
  faqProvidersQ: 'Which AI providers can I use?', faqProvidersA: 'OpenAI (GPT-4o, GPT-4), Google Gemini, Anthropic Claude, DeepSeek, Mistral, OpenRouter, DeepL, and Ollama for offline translation.',
  faqLangsQ: 'Can I translate to any language?', faqLangsA: 'Yes. GameStringer supports any language pair supported by the selected AI provider.',
  faqFilesQ: 'Does translation modify the original game files?', faqFilesA: 'No. GameStringer always generates separate files or ZIP patches. Automatic backup is made for direct application.',
  faqMultiplayerQ: 'Does it work with online multiplayer games?', faqMultiplayerA: "It depends on the game. For games with aggressive anti-cheat (EAC, BattlEye), use the Overlay or OCR.",
  troubleTitle: 'Troubleshooting',
  troubleNoFilesQ: '"No translatable files found" — how do I fix this?', troubleNoFilesA: 'Some games encrypt their files. Try:\n• For Unity games: use the Unity Patcher\n• For Unreal games: use UE Translator\n• For other engines: use the Crawler or load files manually',
  troubleApiQ: 'Translation gets stuck or gives API error', troubleApiA: '• Check that the API key is valid in Settings → AI\n• Make sure you have credit on the provider\n• Reduce Batch Size\n• Auto checkpoint: you can resume',
  troubleBepinexQ: "BepInEx doesn't work / game crashes", troubleBepinexA: "• Make sure the game is closed before installing\n• For Unity < 5.6, GameStringer uses IPA\n• Check that your antivirus isn't blocking BepInEx",
  troubleCharsQ: "Special characters don't display correctly", troubleCharsA: '• Use the Fixer to fix encoding\n• Make sure the file is saved as UTF-8',
  troubleBackupQ: 'How do I back up my translations?', troubleBackupA: '• Go to Settings → Backup\n• Export any project as ZIP from Project Manager',
  engineGuideTitle: 'Game engine guide', engineUnity: 'BepInEx + XUnity AutoTranslator. Automatic.', engineUnreal: 'Extracts .locres, translates, creates .pak.', engineRpgMaker: 'Extracts database and maps automatically.', engineRenpy: 'Handles .rpy scripts with variables.', engineWolfRpg: 'Extracts and modifies proprietary data.', engineTelltale: '.langdb/.dlog files for Walking Dead etc.', engineGodot: 'Scan and translate .tres/.tscn files.', engineGameMaker: 'Searches data.win files and internal strings.',
  otherFunctions: 'other functions',
  btnSave: 'Save', btnInstall: 'Install', btnRescan: 'Re-Scan', btnTranslate: 'Translate', btnStartTranslation: 'Start Translation',
};

const es: GT = {
  tabQuickStart: 'Inicio Rápido', tabWorkflows: 'Flujos de Trabajo', tabTools: 'Herramientas', tabShortcuts: 'Atajos', tabFaq: 'FAQ',
  qsTitle: 'Primeros Pasos con GameStringer', qsSubtitle: 'Sigue estos pasos para traducir tu primer juego en menos de 5 minutos.',
  qsStep1Title: 'Configura el proveedor AI',
  qsStep1Line1: 'Ve a', qsStep1Line1b: '→ pestaña', qsStep1Line2: 'Selecciona un proveedor (ej. OpenAI, Gemini, DeepL) y pega tu API key.', qsStep1Line3: 'Haz clic en', qsStep1Line3b: '. La clave se guarda de forma segura.', qsStep1Tip: '¿No tienes API key? Puedes usar Ollama para traducciones gratuitas offline. Ve a Ajustes → Ollama.',
  qsStep2Title: 'Conecta tus tiendas de juegos',
  qsStep2Line1: 'Ve a', qsStep2Line1b: 'y configura al menos una tienda (Steam, Epic, GOG...).', qsStep2Line2: 'Para Steam: introduce tu Steam ID y una API Key (gratuita desde steamcommunity.com/dev/apikey).', qsStep2Line3: 'GameStringer descargará automáticamente tu biblioteca con toda la info.',
  qsStep3Title: 'Ve a la Biblioteca y elige un juego',
  qsStep3Line1: 'Abre la', qsStep3Line1b: '. Verás todos tus juegos con portadas, motor y estado.', qsStep3Line2: 'Haz clic en un juego instalado para ver detalles.', qsStep3Line3a: 'Desde el detalle del juego, haz clic en', qsStep3Line3b: 'para iniciar la traducción.',
  qsStep4Title: 'Traduce automáticamente',
  qsStep4Line1: 'La página', qsStep4Line1b: 'escanea automáticamente los archivos del juego.', qsStep4Line2: 'Si encuentra archivos traducibles, los carga y puedes traducir con un clic.', qsStep4Line3a: 'Elige idiomas, proveedor AI, y haz clic en', qsStep4Line4: 'La traducción se ejecuta en lotes con barra de progreso y guardado automático.',
  qsStep5Title: 'Revisa, exporta y aplica el parche',
  qsStep5Line1: 'La fase Review muestra cada cadena con puntuación de calidad.', qsStep5Line2: 'Puedes editar manualmente cualquier traducción.', qsStep5Line3: 'La fase Patch genera un ZIP listo para copiar en la carpeta del juego.', qsStep5Tip: 'Para juegos Unity, GameStringer puede instalar automáticamente BepInEx + XUnity AutoTranslator.',
  needTitle: 'Qué necesitas para empezar', needApiTitle: 'API Key AI (recomendada)', needApiDesc: 'OpenAI, Gemini, DeepL, Claude u Ollama gratis offline.', needGamesTitle: 'Juegos instalados', needGamesDesc: 'Al menos un juego instalado.', needInternetTitle: 'Conexión a internet', needInternetDesc: 'Para AI cloud. No con Ollama.',
  wfUnityTitle: 'Traducir un juego Unity', wfUnityDesc: 'El flujo más común. Automático.',
  wfUnityStep1Title: 'Selecciona el juego de la Biblioteca', wfUnityStep1Line1: 'Abre', wfUnityStep1Line1b: '→ busca el juego → haz clic.', wfUnityStep1Line2: 'GameStringer detecta Unity por la presencia de UnityPlayer.dll.',
  wfUnityStep2Title: "Haz clic en 'Traducir' → Auto-Translate", wfUnityStep2Line1: 'Si no encuentra archivos, propone instalar BepInEx + XUnity AutoTranslator.', wfUnityStep2Line2a: 'Haz clic en', wfUnityStep2Line2b: '— el proceso es completamente automático.',
  wfUnityStep3Title: 'Inicia el juego una vez', wfUnityStep3Line1: 'BepInEx genera los archivos de traducción en la primera ejecución.', wfUnityStep3Line2: 'Cierra el juego y vuelve a GameStringer.',
  wfUnityStep4Title: 'Re-escanea y traduce', wfUnityStep4Line1a: 'Haz clic en', wfUnityStep4Line1b: '. Ahora GameStringer encuentra los archivos de XUnity.', wfUnityStep4Line2: 'Inicia la traducción AI.',
  wfUnityTip: 'En el juego puedes presionar ALT+T para abrir el menú de XUnity AutoTranslator.',
  wfFilesTitle: 'Traducir un juego con archivos de localización', wfFilesDesc: 'Para juegos con archivos JSON, CSV, PO, XML.',
  wfFilesStep1Title: 'Biblioteca → Traducir', wfFilesStep1Line1: 'Selecciona el juego de la', wfFilesStep1Line1b: 'y haz clic en', wfFilesStep1Line2: 'GameStringer escanea hasta 8 niveles de subcarpetas.',
  wfFilesStep2Title: 'Selecciona archivos a traducir', wfFilesStep2Line1: 'Los archivos se cargan automáticamente.', wfFilesStep2Line2: 'Formatos soportados: JSON, CSV, PO/POT, XLIFF, RESX, XML, YAML, LUA, RPY, INI, TXT, LANG.',
  wfFilesStep3Title: 'Configura e inicia', wfFilesStep3Line1a: 'Elige proveedor AI, idiomas, y haz clic en', wfFilesStep3Line2: 'La traducción avanza en lotes. Puedes pausar y reanudar.', wfFilesStep3Line3: 'Si cierras la app, el checkpoint se guarda automáticamente.',
  wfFilesStep4Title: 'Revisa y aplica', wfFilesStep4Line1: 'Cada cadena tiene una puntuación de calidad (0-100).', wfFilesStep4Line2: 'Genera el ZIP y copia los archivos.',
  wfProTitle: 'Neural Translator Pro — traducción avanzada', wfProDesc: 'Control total: archivos, contexto, glosario, exportación.',
  wfProStep1Title: 'Abre Neural Translator Pro', wfProStep1Line1: 'Ve a', wfProStep1Line1b: '. Selecciona el juego del dropdown o de la Biblioteca.',
  wfProStep2Title: 'Selecciona archivos y configura', wfProStep2Line1: 'Selecciona archivos individuales. Configura: proveedor AI, idioma, glosario, Translation Memory.', wfProStep2Line2: 'El sistema usa la Translation Memory para reutilizar traducciones y ahorrar costes API.',
  wfProStep3Title: 'Traduce con vista previa en tiempo real', wfProStep3Line1: 'Cada cadena traducida en tiempo real. Timer, progreso, errores visibles.',
  wfProStep4Title: 'Aplica al juego o exporta', wfProStep4Line1: 'Aplica el parche directamente (con backup automático) o exporta como ZIP.', wfProStep4Line2: 'Para juegos Unreal Engine, crea archivos .locres y .pak.',
  wfOcrTitle: 'Traducción OCR — captura texto de la pantalla', wfOcrDesc: 'Para juegos sin archivos de localización accesibles.',
  wfOcrStep1Title: 'Abre OCR Translator', wfOcrStep1Line1: 'Ve a', wfOcrStep1Line1b: 'o presiona', wfOcrStep1Line1c: 'desde cualquier lugar.',
  wfOcrStep2Title: 'Selecciona el área de la pantalla', wfOcrStep2Line1: 'Captura la porción de pantalla con texto del juego.', wfOcrStep2Line2: 'El OCR extrae el texto automáticamente.',
  wfOcrStep3Title: 'Traducción instantánea', wfOcrStep3Line1: 'El texto extraído se traduce instantáneamente.', wfOcrStep3Line2: 'El resultado aparece en el overlay.',
  wfOcrTip: 'Para traducción continua sin clic, usa', wfOcrTipEnd: '— captura automática a intervalos regulares.',
  wfVoiceTitle: 'Traducción de voz y clonación', wfVoiceDesc: 'Traduce diálogos hablados y recrea las voces.',
  wfVoiceStep1Title: 'Sube o graba audio', wfVoiceStep1Line1: 'En', wfVoiceStep1Line1b: ', sube un archivo de audio o graba directamente.', wfVoiceStep1Line2: 'Whisper (OpenAI) transcribe automáticamente el audio.',
  wfVoiceStep2Title: 'Traducción del texto', wfVoiceStep2Line1: 'El texto transcrito se traduce con el proveedor AI seleccionado.',
  wfVoiceStep3Title: 'Text-to-Speech en idioma destino', wfVoiceStep3Line1: 'La traducción se lee con voces AI (Nova, Alloy, Echo, Fable, Onyx, Shimmer).', wfVoiceStep3Line2: 'Para voces personalizadas, usa', wfVoiceStep3Line2b: 'con ElevenLabs.',
  scNavTitle: 'Navegación e interfaz', scNavCmdPalette: 'Paleta de Comandos — busca cualquier página', scNavSearch: 'Búsqueda global', scNavSettings: 'Abrir Ajustes', scNavRefresh: 'Actualizar biblioteca', scNavClose: 'Cerrar modal/panel', scNavShortcuts: 'Mostrar atajos',
  scGlobalTitle: 'Hotkeys globales (activas con juego en primer plano)', scGlobalOcr: 'Captura OCR — selecciona área y traduce', scGlobalQuick: 'Traducción rápida — portapapeles', scGlobalOverlay: 'Toggle Overlay', scGlobalXunity: 'Menú XUnity AutoTranslator (in-game)', scGlobalTip: 'Las hotkeys globales funcionan en segundo plano.',
  scTransTitle: 'Durante la traducción', scTransPause: 'Pausar / Reanudar', scTransNext: 'Cadena siguiente (Review)', scTransPrev: 'Cadena anterior (Review)', scTransConfirm: 'Confirmar edición',
  faqTitle: 'Preguntas frecuentes',
  faqCostQ: '¿Cuánto cuesta GameStringer?', faqCostA: 'Gratis y open source. Solo pagas las APIs AI. Con Ollama traduces gratis.',
  faqProvidersQ: '¿Qué proveedores AI puedo usar?', faqProvidersA: 'OpenAI, Gemini, Claude, DeepSeek, Mistral, OpenRouter, DeepL y Ollama.',
  faqLangsQ: '¿Puedo traducir a cualquier idioma?', faqLangsA: 'Sí. Cualquier par soportado por el proveedor AI.',
  faqFilesQ: '¿La traducción modifica los archivos originales?', faqFilesA: 'No. Archivos separados con backup automático.',
  faqMultiplayerQ: '¿Funciona con juegos multijugador?', faqMultiplayerA: 'Depende. Con anti-cheat agresivo usa Overlay o OCR.',
  troubleTitle: 'Solución de problemas',
  troubleNoFilesQ: '"No se encontraron archivos traducibles"', troubleNoFilesA: '• Unity: Unity Patcher\n• Unreal: UE Translator\n• Otros: Crawler o carga manual',
  troubleApiQ: 'Error de API', troubleApiA: '• Verifica la API key\n• Comprueba crédito\n• Reduce Batch Size\n• Checkpoint automático',
  troubleBepinexQ: 'BepInEx no funciona / el juego crashea', troubleBepinexA: '• Cierra el juego antes\n• Unity < 5.6 usa IPA\n• Revisa antivirus',
  troubleCharsQ: 'Caracteres especiales no se muestran bien', troubleCharsA: '• Usa el Fixer\n• Verifica UTF-8',
  troubleBackupQ: '¿Cómo hago backup?', troubleBackupA: '• Ajustes → Backup\n• Exporta desde Project Manager',
  engineGuideTitle: 'Guía por motor de juego', engineUnity: 'BepInEx + XUnity AutoTranslator. Automático.', engineUnreal: 'Extrae .locres, traduce, crea .pak.', engineRpgMaker: 'Extrae base de datos y mapas.', engineRenpy: 'Scripts .rpy con variables.', engineWolfRpg: 'Datos propietarios.', engineTelltale: '.langdb/.dlog.', engineGodot: '.tres/.tscn.', engineGameMaker: 'data.win y cadenas internas.',
  otherFunctions: 'otras funciones',
  btnSave: 'Guardar', btnInstall: 'Instalar', btnRescan: 'Re-Escanear', btnTranslate: 'Traducir', btnStartTranslation: 'Iniciar Traducción',
};

// FR, DE, JA, ZH, KO, PT, RU, PL — use EN as base with key UI strings translated
const fr: GT = { ...en, tabQuickStart: 'Démarrage Rapide', tabWorkflows: 'Flux de Travail', tabTools: 'Outils', tabShortcuts: 'Raccourcis', tabFaq: 'FAQ', qsTitle: 'Premiers Pas avec GameStringer', faqTitle: 'Questions fréquentes', troubleTitle: 'Dépannage', engineGuideTitle: 'Guide par moteur', needTitle: 'Ce dont vous avez besoin', otherFunctions: 'autres fonctions', scNavTitle: 'Navigation', scGlobalTitle: 'Hotkeys globales', scTransTitle: 'Pendant la traduction', btnSave: 'Enregistrer', btnInstall: 'Installer', btnRescan: 'Re-Scanner', btnTranslate: 'Traduire', btnStartTranslation: 'Lancer la Traduction' };
const de: GT = { ...en, tabQuickStart: 'Schnellstart', tabWorkflows: 'Arbeitsabläufe', tabTools: 'Werkzeuge', tabShortcuts: 'Tastenkürzel', tabFaq: 'FAQ', qsTitle: 'Erste Schritte mit GameStringer', faqTitle: 'Häufige Fragen', troubleTitle: 'Fehlerbehebung', engineGuideTitle: 'Engine-Anleitung', needTitle: 'Was du brauchst', otherFunctions: 'weitere Funktionen', scNavTitle: 'Navigation', scGlobalTitle: 'Globale Hotkeys', scTransTitle: 'Während der Übersetzung', btnSave: 'Speichern', btnInstall: 'Installieren', btnRescan: 'Neu scannen', btnTranslate: 'Übersetzen', btnStartTranslation: 'Übersetzung starten' };
const ja: GT = { ...en, tabQuickStart: 'クイックスタート', tabWorkflows: 'ワークフロー', tabTools: 'ツール', tabShortcuts: 'ショートカット', tabFaq: 'FAQ', qsTitle: 'GameStringer入門', faqTitle: 'よくある質問', troubleTitle: 'トラブルシューティング', engineGuideTitle: 'エンジン別ガイド', needTitle: '必要なもの', otherFunctions: 'その他の機能', scNavTitle: 'ナビゲーション', scGlobalTitle: 'グローバルホットキー', scTransTitle: '翻訳中', btnSave: '保存', btnInstall: 'インストール', btnRescan: '再スキャン', btnTranslate: '翻訳', btnStartTranslation: '翻訳開始' };
const zh: GT = { ...en, tabQuickStart: '快速开始', tabWorkflows: '工作流程', tabTools: '工具', tabShortcuts: '快捷键', tabFaq: '常见问题', qsTitle: 'GameStringer入门', faqTitle: '常见问题', troubleTitle: '故障排除', engineGuideTitle: '引擎指南', needTitle: '开始所需', otherFunctions: '其他功能', scNavTitle: '导航', scGlobalTitle: '全局快捷键', scTransTitle: '翻译中', btnSave: '保存', btnInstall: '安装', btnRescan: '重新扫描', btnTranslate: '翻译', btnStartTranslation: '开始翻译' };
const ko: GT = { ...en, tabQuickStart: '빠른 시작', tabWorkflows: '워크플로우', tabTools: '도구', tabShortcuts: '단축키', tabFaq: 'FAQ', qsTitle: 'GameStringer 시작하기', faqTitle: '자주 묻는 질문', troubleTitle: '문제 해결', engineGuideTitle: '엔진 가이드', needTitle: '필요한 것', otherFunctions: '기타 기능', scNavTitle: '탐색', scGlobalTitle: '글로벌 단축키', scTransTitle: '번역 중', btnSave: '저장', btnInstall: '설치', btnRescan: '재스캔', btnTranslate: '번역', btnStartTranslation: '번역 시작' };
const pt: GT = { ...en, tabQuickStart: 'Início Rápido', tabWorkflows: 'Fluxos de Trabalho', tabTools: 'Ferramentas', tabShortcuts: 'Atalhos', tabFaq: 'FAQ', qsTitle: 'Primeiros Passos com GameStringer', faqTitle: 'Perguntas Frequentes', troubleTitle: 'Solução de Problemas', engineGuideTitle: 'Guia por Engine', needTitle: 'O que precisa', otherFunctions: 'outras funções', scNavTitle: 'Navegação', scGlobalTitle: 'Hotkeys Globais', scTransTitle: 'Durante tradução', btnSave: 'Salvar', btnInstall: 'Instalar', btnRescan: 'Re-Escanear', btnTranslate: 'Traduzir', btnStartTranslation: 'Iniciar Tradução' };
const ru: GT = { ...en, tabQuickStart: 'Быстрый старт', tabWorkflows: 'Рабочие процессы', tabTools: 'Инструменты', tabShortcuts: 'Горячие клавиши', tabFaq: 'FAQ', qsTitle: 'Начало работы с GameStringer', faqTitle: 'Частые вопросы', troubleTitle: 'Устранение неполадок', engineGuideTitle: 'Руководство по движкам', needTitle: 'Что нужно', otherFunctions: 'другие функции', scNavTitle: 'Навигация', scGlobalTitle: 'Глобальные хоткеи', scTransTitle: 'Во время перевода', btnSave: 'Сохранить', btnInstall: 'Установить', btnRescan: 'Пересканировать', btnTranslate: 'Перевести', btnStartTranslation: 'Начать перевод' };
const pl: GT = { ...en, tabQuickStart: 'Szybki Start', tabWorkflows: 'Przepływy Pracy', tabTools: 'Narzędzia', tabShortcuts: 'Skróty', tabFaq: 'FAQ', qsTitle: 'Pierwsze Kroki z GameStringer', faqTitle: 'Często zadawane pytania', troubleTitle: 'Rozwiązywanie problemów', engineGuideTitle: 'Poradnik wg silnika', needTitle: 'Co potrzebujesz', otherFunctions: 'inne funkcje', scNavTitle: 'Nawigacja', scGlobalTitle: 'Globalne skróty', scTransTitle: 'Podczas tłumaczenia', btnSave: 'Zapisz', btnInstall: 'Zainstaluj', btnRescan: 'Przeskanuj', btnTranslate: 'Tłumacz', btnStartTranslation: 'Rozpocznij tłumaczenie' };

const allGuideTranslations: Record<string, GT> = { it, en, es, fr, de, ja, zh, ko, pt, ru, pl };

export function getGuideTranslations(lang: string): GT {
  return allGuideTranslations[lang] || allGuideTranslations.en;
}
