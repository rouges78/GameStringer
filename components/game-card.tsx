'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import GameImage from '@/components/game-image';
import { Cog, Clock, Gamepad2, Timer } from 'lucide-react';

interface DisplayGame {
  id: string;
  title: string;
  imageUrl: string;
  fallbackImageUrl: string | null;
  isInstalled: boolean;
  isVrSupported?: boolean;
  engine?: string;
  playtime?: number;
  lastPlayed?: number;
  isShared?: boolean;
  howLongToBeat?: {
    main: number;
    mainExtra: number;
    completionist: number;
  };
  genres?: { id: string; description: string }[];
  categories?: { id: number; description: string }[];
  shortDescription?: string;
  isFree?: boolean;
  developers?: string[];
  publishers?: string[];
  releaseDate?: {
    coming_soon: boolean;
    date: string;
  };
  supportedLanguages?: string;
}

const GameCard = ({ game, index }: { game: DisplayGame; index: number }) => {
  // Funzione per ottenere il codice paese dalla lingua
  const getCountryCode = (language: string): string | null => {
    const languageToCountry: { [key: string]: string } = {
      'italiano': 'it', 'italian': 'it',
      'inglese': 'gb', 'english': 'gb',
      'francese': 'fr', 'french': 'fr', 'français': 'fr',
      'tedesco': 'de', 'german': 'de', 'deutsch': 'de',
      'spagnolo': 'es', 'spanish': 'es', 'español': 'es',
      'portoghese': 'pt', 'portuguese': 'pt', 'português': 'pt',
      'portoghese brasiliano': 'br', 'portuguese - brazil': 'br', 'português - brasil': 'br',
      'russo': 'ru', 'russian': 'ru', 'русский': 'ru',
      'giapponese': 'jp', 'japanese': 'jp', '日本語': 'jp',
      'coreano': 'kr', 'korean': 'kr', '한국어': 'kr',
      'cinese semplificato': 'cn', 'simplified chinese': 'cn', '简体中文': 'cn',
      'cinese tradizionale': 'tw', 'traditional chinese': 'tw', '繁體中文': 'tw',
      'cinese': 'cn', 'chinese': 'cn',
      'polacco': 'pl', 'polish': 'pl', 'polski': 'pl',
      'olandese': 'nl', 'dutch': 'nl', 'nederlands': 'nl',
      'svedese': 'se', 'swedish': 'se', 'svenska': 'se',
      'norvegese': 'no', 'norwegian': 'no', 'norsk': 'no',
      'danese': 'dk', 'danish': 'dk', 'dansk': 'dk',
      'finlandese': 'fi', 'finnish': 'fi', 'suomi': 'fi',
      'ceco': 'cz', 'czech': 'cz', 'čeština': 'cz',
      'ungherese': 'hu', 'hungarian': 'hu', 'magyar': 'hu',
      'turco': 'tr', 'turkish': 'tr', 'türkçe': 'tr',
      'greco': 'gr', 'greek': 'gr', 'ελληνικά': 'gr',
      'rumeno': 'ro', 'romanian': 'ro', 'română': 'ro',
      'ucraino': 'ua', 'ukrainian': 'ua', 'українська': 'ua',
      'arabo': 'sa', 'arabic': 'sa', 'العربية': 'sa',
      'thai': 'th', 'tailandese': 'th', 'ไทย': 'th',
      'vietnamita': 'vn', 'vietnamese': 'vn', 'tiếng việt': 'vn',
      'indonesiano': 'id', 'indonesian': 'id', 'bahasa indonesia': 'id',
      'hindi': 'in', 'हिन्दी': 'in',
      'ebraico': 'il', 'hebrew': 'il', 'עברית': 'il',
      'bulgaro': 'bg', 'bulgarian': 'bg', 'български': 'bg',
      'croato': 'hr', 'croatian': 'hr', 'hrvatski': 'hr',
      'slovacco': 'sk', 'slovak': 'sk', 'slovenčina': 'sk',
      'sloveno': 'si', 'slovenian': 'si', 'slovenščina': 'si',
      'serbo': 'rs', 'serbian': 'rs', 'српски': 'rs',
      'estone': 'ee', 'estonian': 'ee', 'eesti': 'ee',
      'lettone': 'lv', 'latvian': 'lv', 'latviešu': 'lv',
      'lituano': 'lt', 'lithuanian': 'lt', 'lietuvių': 'lt',
      'islandese': 'is', 'icelandic': 'is', 'íslenska': 'is',
      'afrikaans': 'za',
      'albanese': 'al', 'albanian': 'al', 'shqip': 'al',
      'macedone': 'mk', 'macedonian': 'mk', 'македонски': 'mk',
      'maltese': 'mt', 'malti': 'mt',
      'gallese': 'gb-wls', 'welsh': 'gb-wls', 'cymraeg': 'gb-wls',
      'irlandese': 'ie', 'irish': 'ie', 'gaeilge': 'ie',
      'basco': 'es', 'basque': 'es', 'euskera': 'es',
      'catalano': 'es-ct', 'catalan': 'es-ct', 'català': 'es-ct',
      'galiziano': 'es', 'galician': 'es', 'galego': 'es',
      'azero': 'az', 'azerbaijani': 'az', 'azərbaycan': 'az',
      'bielorusso': 'by', 'belarusian': 'by', 'беларуская': 'by',
      'georgiano': 'ge', 'georgian': 'ge', 'ქართული': 'ge',
      'armeno': 'am', 'armenian': 'am', 'հայերեն': 'am',
      'kazako': 'kz', 'kazakh': 'kz', 'қазақ': 'kz',
      'uzbeko': 'uz', 'uzbek': 'uz', 'oʻzbek': 'uz',
      'mongolo': 'mn', 'mongolian': 'mn', 'монгол': 'mn',
      'nepalese': 'np', 'nepali': 'np', 'नेपाली': 'np',
      'singalese': 'lk', 'sinhala': 'lk', 'සිංහල': 'lk',
      'tamil': 'lk', 'தமிழ்': 'lk',
      'bengalese': 'bd', 'bengali': 'bd', 'বাংলা': 'bd',
      'punjabi': 'pk', 'ਪੰਜਾਬੀ': 'pk',
      'gujarati': 'in', 'ગુજરાતી': 'in',
      'marathi': 'in', 'मराठी': 'in',
      'telugu': 'in', 'తెలుగు': 'in',
      'kannada': 'in', 'ಕನ್ನಡ': 'in',
      'malayalam': 'in', 'മലയാളം': 'in',
      'oriya': 'in', 'ଓଡ଼ିଆ': 'in',
      'assamese': 'in', 'অসমীয়া': 'in',
      'malese': 'my', 'malay': 'my', 'bahasa melayu': 'my',
      'filippino': 'ph', 'filipino': 'ph', 'tagalog': 'ph',
      'lao': 'la', 'ລາວ': 'la',
      'khmer': 'kh', 'ភាសាខ្មែរ': 'kh',
      'birmano': 'mm', 'burmese': 'mm', 'မြန်မာ': 'mm',
      'tibetano': 'cn', 'tibetan': 'cn', 'བོད་སྐད': 'cn',
      'uiguro': 'cn', 'uyghur': 'cn', 'ئۇيغۇر': 'cn',
      'pashto': 'af', 'پښتو': 'af',
      'dari': 'af', 'دری': 'af',
      'persiano': 'ir', 'persian': 'ir', 'farsi': 'ir', 'فارسی': 'ir',
      'urdu': 'pk', 'اردو': 'pk',
      'swahili': 'ke', 'kiswahili': 'ke',
      'amarico': 'et', 'amharic': 'et', 'አማርኛ': 'et',
      'yoruba': 'ng', 'yorùbá': 'ng',
      'hausa': 'ng',
      'zulu': 'za', 'isizulu': 'za',
      'xhosa': 'za', 'isixhosa': 'za',
      'sotho': 'za', 'sesotho': 'za',
      'tswana': 'bw', 'setswana': 'bw'
    };
    
    const lang = language.toLowerCase();
    for (const [key, code] of Object.entries(languageToCountry)) {
      if (lang.includes(key)) {
        return code;
      }
    }
    return null;
  };

  // Funzione per estrarre le lingue supportate e creare bandierine
  const getLanguageFlags = (languages?: string) => {
    if (!languages) return [];
    
    const flags: string[] = [];
    const cleanedLanguages = languages.replace(/<[^>]*>?/gm, '').toLowerCase();
    
    // Split per virgole e analizza ogni lingua
    const langParts = cleanedLanguages.split(',');
    for (const part of langParts) {
      const countryCode = getCountryCode(part.trim());
      if (countryCode && !flags.includes(countryCode)) {
        flags.push(countryCode);
      }
    }
    
    return flags.slice(0, 5); // Mostra massimo 5 bandierine
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-lg shadow-lg transition-transform duration-300 ease-in-out hover:-translate-y-1 hover:shadow-xl flex flex-col bg-card"
    >
      <Link href={`/games/${game.id}`} className="block w-full aspect-[3/4] relative">
        {/* Badges sopra la cover */}
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          {game.isVrSupported && (
            <Badge className="bg-blue-600/90 text-white border-0 animate-pulse">
              VR
            </Badge>
          )}
          {game.isShared && (
            <Badge className="bg-orange-500/90 text-white border-0">
              🔗 Shared
            </Badge>
          )}
          {game.isInstalled && (
            <Badge className="bg-green-500/90 text-white border-0">
              Installed
            </Badge>
          )}
        </div>
        
        {/* Title Overlay con VR Badge */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-lg line-clamp-2 flex-1">
              {game.title}
            </h3>
            {game.isVrSupported && (
              <Badge className="bg-blue-600 text-white border-0 animate-pulse flex-shrink-0">
                VR
              </Badge>
            )}
          </div>
        </div>
        
        <GameImage 
          src={game.imageUrl} 
          alt={game.title} 
          fallbackSrc={game.fallbackImageUrl}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Gradiente e titolo sopra la cover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </Link>
      
      {/* Info sotto la cover: lingue, engine e HLTB */}
      <div className="p-3 space-y-2">
        {/* Riga 1: Lingue e Engine */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {getLanguageFlags(game.supportedLanguages).length > 0 ? (
              getLanguageFlags(game.supportedLanguages).map((countryCode, i) => (
                <img 
                  key={i} 
                  src={`https://flagcdn.com/32x24/${countryCode}.png`}
                  alt={countryCode}
                  className="w-6 h-4 rounded-sm shadow-md border border-gray-200/20"
                  title="Lingua supportata"
                  loading="lazy"
                />
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground">-</span>
            )}
          </div>
          
          {game.engine && game.engine !== 'Unknown' && (
            <Badge 
              variant="secondary" 
              className="text-[10px] bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 shadow-sm px-1.5 py-0"
              title={`Motore: ${game.engine}`}
            >
              <Cog className="h-2.5 w-2.5 mr-0.5" />
              {game.engine}
            </Badge>
          )}
        </div>
        
        {/* Riga 2: HowLongToBeat */}
        {game.howLongToBeat && game.howLongToBeat.main > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-slate-800/50 rounded px-2 py-1">
            <Timer className="h-3 w-3 text-amber-400" />
            <span title="Storia principale">🎮 {game.howLongToBeat.main}h</span>
            {game.howLongToBeat.mainExtra > 0 && (
              <span title="Storia + Extra">➕ {game.howLongToBeat.mainExtra}h</span>
            )}
            {game.howLongToBeat.completionist > 0 && (
              <span title="Completista 100%">💯 {game.howLongToBeat.completionist}h</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default GameCard;



