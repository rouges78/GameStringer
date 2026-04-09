/**
 * Language code mappings used across the translation system.
 * Includes language names, NLLB codes, provider affinity rankings,
 * genre boosts, provider labels, and API key URLs.
 */

/** Mappa codici lingua -> nomi completi per HY-MT */
export const LANG_NAMES: Record<string, string> = {
  en: 'English', it: 'Italian', de: 'German', fr: 'French', es: 'Spanish',
  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  'zh-Hans': 'Simplified Chinese', 'zh-Hant': 'Traditional Chinese',
  pl: 'Polish', nl: 'Dutch', sv: 'Swedish', da: 'Danish', fi: 'Finnish',
  no: 'Norwegian', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', tr: 'Turkish',
  ar: 'Arabic', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', uk: 'Ukrainian',
  el: 'Greek', bg: 'Bulgarian', hr: 'Croatian', sk: 'Slovak', sl: 'Slovenian',
  'pt-BR': 'Brazilian Portuguese', 'es-419': 'Latin American Spanish',
};

/** NLLB-200 language code mapping (Meta, 200 languages) */
export const NLLB_LANG_MAP: Record<string, string> = {
  en: 'eng_Latn', it: 'ita_Latn', de: 'deu_Latn', fr: 'fra_Latn', es: 'spa_Latn',
  pt: 'por_Latn', ru: 'rus_Cyrl', zh: 'zho_Hans', ja: 'jpn_Jpan', ko: 'kor_Hang',
  th: 'tha_Thai', vi: 'vie_Latn', id: 'ind_Latn', ar: 'arb_Arab', hi: 'hin_Deva',
  tr: 'tur_Latn', uk: 'ukr_Cyrl', pl: 'pol_Latn', nl: 'nld_Latn', sv: 'swe_Latn',
  da: 'dan_Latn', fi: 'fin_Latn', no: 'nob_Latn', cs: 'ces_Latn', el: 'ell_Grek',
  hu: 'hun_Latn', ro: 'ron_Latn', bg: 'bul_Cyrl', hr: 'hrv_Latn', sk: 'slk_Latn',
  sl: 'slv_Latn', lt: 'lit_Latn', lv: 'lvs_Latn', et: 'est_Latn', ms: 'zsm_Latn',
  bn: 'ben_Beng', ta: 'tam_Taml', te: 'tel_Telu', sw: 'swh_Latn', am: 'amh_Ethi',
  ka: 'kat_Geor', hy: 'hye_Armn', he: 'heb_Hebr', fa: 'pes_Arab', ur: 'urd_Arab',
  my: 'mya_Mymr', km: 'khm_Khmr', lo: 'lao_Laoo', ne: 'npi_Deva', si: 'sin_Sinh',
  ga: 'gle_Latn', cy: 'cym_Latn', eu: 'eus_Latn', gl: 'glg_Latn', ca: 'cat_Latn',
  af: 'afr_Latn', sq: 'als_Latn', mk: 'mkd_Cyrl', bs: 'bos_Latn', is: 'isl_Latn',
  mt: 'mlt_Latn', lb: 'ltz_Latn', tl: 'tgl_Latn', mn: 'khk_Cyrl', uz: 'uzn_Latn',
  kk: 'kaz_Cyrl', az: 'azj_Latn', ky: 'kir_Cyrl', tg: 'tgk_Cyrl',
};

/** Language name to code mapping for chat translation */
export const LANG_TO_CODE: Record<string, string> = {
  Italian: 'it', English: 'en', Spanish: 'es', German: 'de',
  French: 'fr', Portuguese: 'pt', Japanese: 'ja', Chinese: 'zh',
  Korean: 'ko', Russian: 'ru', Polish: 'pl', Dutch: 'nl',
  Swedish: 'sv', Norwegian: 'no', Danish: 'da', Finnish: 'fi',
  Czech: 'cs', Hungarian: 'hu', Romanian: 'ro', Turkish: 'tr',
  Arabic: 'ar', Hindi: 'hi', Thai: 'th', Vietnamese: 'vi',
  Ukrainian: 'uk', Greek: 'el', Hebrew: 'he', Indonesian: 'id',
};

/** Mappe di affinita lingua -> provider (ordine = priorita) */
export const LANG_PROVIDER_AFFINITY: Record<string, string[]> = {
  // Lingue europee occidentali -- DeepL domina
  IT: ['deepl', 'anthropic', 'modelwiz', 'openai', 'mistral', 'gemini', 'deepseek', 'qwen'],
  DE: ['deepl', 'anthropic', 'modelwiz', 'openai', 'mistral', 'gemini', 'deepseek'],
  FR: ['deepl', 'anthropic', 'modelwiz', 'mistral', 'openai', 'gemini', 'deepseek'],
  ES: ['deepl', 'anthropic', 'modelwiz', 'openai', 'gemini', 'deepseek', 'mistral'],
  PT: ['deepl', 'anthropic', 'modelwiz', 'openai', 'gemini', 'deepseek'],
  NL: ['deepl', 'anthropic', 'openai', 'modelwiz', 'gemini'],
  // Lingue europee orientali
  PL: ['deepl', 'anthropic', 'openai', 'modelwiz', 'gemini', 'deepseek'],
  RU: ['deepl', 'anthropic', 'openai', 'modelwiz', 'gemini', 'deepseek'],
  CS: ['deepl', 'anthropic', 'openai', 'gemini'],
  HU: ['deepl', 'anthropic', 'openai', 'gemini'],
  RO: ['deepl', 'anthropic', 'openai', 'gemini'],
  BG: ['deepl', 'anthropic', 'openai', 'gemini'],
  UK: ['deepl', 'anthropic', 'openai', 'gemini'],
  // Nordiche
  SV: ['deepl', 'anthropic', 'openai', 'gemini'],
  DA: ['deepl', 'anthropic', 'openai', 'gemini'],
  NO: ['deepl', 'anthropic', 'openai', 'gemini'],
  FI: ['deepl', 'anthropic', 'openai', 'gemini'],
  // CJK -- Claude e LLM nativi eccellono
  ZH: ['anthropic', 'qwen', 'deepseek', 'openai', 'modelwiz', 'gemini', 'deepl'],
  JA: ['anthropic', 'openai', 'modelwiz', 'gemini', 'deepl', 'deepseek', 'qwen'],
  KO: ['anthropic', 'openai', 'modelwiz', 'gemini', 'deepl', 'deepseek'],
  // Altre asiatiche
  TH: ['openai', 'anthropic', 'gemini', 'modelwiz', 'deepseek'],
  VI: ['openai', 'anthropic', 'gemini', 'modelwiz', 'deepseek'],
  ID: ['openai', 'anthropic', 'gemini', 'deepseek'],
  // Medio Oriente
  AR: ['anthropic', 'openai', 'gemini', 'modelwiz', 'deepseek'],
  TR: ['deepl', 'anthropic', 'openai', 'gemini', 'deepseek'],
  HE: ['openai', 'anthropic', 'gemini'],
  // Indiche
  HI: ['openai', 'anthropic', 'gemini', 'deepseek'],
  // Greco
  EL: ['deepl', 'anthropic', 'openai', 'gemini'],
};

/** Boost provider per genere gioco (i testi creativi funzionano meglio su LLM grandi) */
export const GENRE_PROVIDER_BOOST: Record<string, string[]> = {
  rpg:       ['anthropic', 'openai'],     // Dialoghi complessi, lore profondo
  adventure: ['anthropic', 'openai'],     // Narrativa, puzzle testuali
  visual_novel: ['anthropic', 'deepl'],   // Testi lunghi, sfumature emotive
  horror:    ['anthropic', 'openai'],     // Tono atmosferico, tensione
  strategy:  ['deepl', 'openai'],         // Terminologia tecnica, UI
  action:    ['deepl', 'gemini'],         // Testi brevi, UI, tutorial
  simulation:['deepl', 'openai'],         // Terminologia tecnica
  puzzle:    ['deepl', 'gemini'],         // Testi brevi, istruzioni
  shooter:   ['deepl', 'gemini'],         // UI, comandi rapidi
  sports:    ['deepl', 'gemini'],         // Terminologia sportiva
};

/** Normalizza codice lingua a 2 lettere maiuscole */
export function normalizeLangCode(lang: string): string {
  const l = lang.toUpperCase().replace(/[-_].*/, '');
  // Alias comuni
  const aliases: Record<string, string> = {
    'ITALIAN': 'IT', 'GERMAN': 'DE', 'FRENCH': 'FR', 'SPANISH': 'ES',
    'PORTUGUESE': 'PT', 'RUSSIAN': 'RU', 'JAPANESE': 'JA', 'CHINESE': 'ZH',
    'KOREAN': 'KO', 'POLISH': 'PL', 'DUTCH': 'NL', 'TURKISH': 'TR',
    'ARABIC': 'AR', 'THAI': 'TH', 'VIETNAMESE': 'VI', 'HINDI': 'HI',
    'CZECH': 'CS', 'HUNGARIAN': 'HU', 'ROMANIAN': 'RO', 'BULGARIAN': 'BG',
    'UKRAINIAN': 'UK', 'SWEDISH': 'SV', 'DANISH': 'DA', 'NORWEGIAN': 'NO',
    'FINNISH': 'FI', 'GREEK': 'EL', 'HEBREW': 'HE', 'INDONESIAN': 'ID',
    'EN': 'EN', 'ENGLISH': 'EN',
  };
  return aliases[l] || l;
}

/** Provider -> nome leggibile */
export const PROVIDER_LABELS: Record<string, string> = {
  translategemma: 'TranslateGemma (locale)',
  hymt: 'HY-MT1.5 Tencent (locale, #1 WMT25)',
  gemini: 'Google Gemini',
  groq: 'Groq (Llama 3.3 70B)',
  'groq-gptoss': 'Groq (GPT-OSS 120B)',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  mistral: 'Mistral AI',
  cohere: 'Cohere',
  together: 'Together AI',
  fireworks: 'Fireworks AI',
  openrouter: 'OpenRouter',
  cerebras: 'Cerebras',
  deepl: 'DeepL',
  qwen: 'Qwen3 (Alibaba)',
  mymemory: 'MyMemory',
  lingva: 'Lingva Translate',
  ollama: 'Ollama (qualsiasi modello)',
  lmstudio: 'LM Studio (locale, OpenAI-compatible)',
  modelwiz: 'Alocai ModelWiz (MT gaming)',
  nllb: 'NLLB-200 Meta (200 lingue, gratis)',
};

/** Provider che richiedono Ollama */
export const OLLAMA_PROVIDERS = ['translategemma', 'hymt', 'ollama'];

/** Provider -> URL per ottenere API key */
export const API_KEY_URLS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/app/apikey',
  groq: 'https://console.groq.com/keys',
  'groq-gptoss': 'https://console.groq.com/keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  mistral: 'https://console.mistral.ai/api-keys',
  cohere: 'https://dashboard.cohere.com/api-keys',
  together: 'https://api.together.xyz/settings/api-keys',
  fireworks: 'https://fireworks.ai/account/api-keys',
  openrouter: 'https://openrouter.ai/keys',
  cerebras: 'https://cloud.cerebras.ai/platform',
  deepl: 'https://www.deepl.com/pro-api',
  qwen: 'https://dashscope.console.aliyun.com/apiKey',
  modelwiz: 'https://www.alocai.com/download-modelwiz',
};
