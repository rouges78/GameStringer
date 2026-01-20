import React from 'react';
import * as CountryFlags from 'country-flag-icons/react/3x2';

// Mappa migliorata e più robusta dalle lingue di Steam ai codici paese ISO 3166-1 alpha-2
export const languageToCountryCode: { [key: string]: string } = {
    // Minuscolo (formato Steam originale)
    'english': 'GB',
    'french': 'FR',
    'italian': 'IT',
    'german': 'DE',
    'spanish - spain': 'ES',
    'spanish': 'ES',
    'spanish - latin america': 'MX',
    'japanese': 'JP',
    'korean': 'KR',
    'polish': 'PL',
    'portuguese - brazil': 'BR',
    'portuguese': 'PT',
    'portuguese - portugal': 'PT',
    'russian': 'RU',
    'simplified chinese': 'CN',
    'traditional chinese': 'TW',
    'turkish': 'TR',
    'ukrainian': 'UA',
    'dutch': 'NL',
    'swedish': 'SE',
    'czech': 'CZ',
    'hungarian': 'HU',
    'romanian': 'RO',
    'danish': 'DK',
    'norwegian': 'NO',
    'finnish': 'FI',
    'chinese': 'CN',
    'arabic': 'SA',
    'thai': 'TH',
    'vietnamese': 'VN',
    'bulgarian': 'BG',
    'greek': 'GR',
    'hebrew': 'IL',
    'latvian': 'LV',
    'lithuanian': 'LT',
    'estonian': 'EE',
    // Maiuscolo (formato normalizzato)
    'English': 'GB',
    'French': 'FR',
    'Italian': 'IT',
    'German': 'DE',
    'Spanish': 'ES',
    'Japanese': 'JP',
    'Korean': 'KR',
    'Polish': 'PL',
    'Portuguese': 'PT',
    'Russian': 'RU',
    'Chinese': 'CN',
    'Turkish': 'TR',
    'Ukrainian': 'UA',
    'Dutch': 'NL',
    'Swedish': 'SE',
    'Czech': 'CZ',
    'Hungarian': 'HU',
    'Romanian': 'RO',
    'Danish': 'DK',
    'Norwegian': 'NO',
    'Finnish': 'FI',
    'Arabic': 'SA',
    'Thai': 'TH',
    'Vietnamese': 'VN',
    'Bulgarian': 'BG',
    'Greek': 'GR',
    'Hebrew': 'IL',
    'Latvian': 'LV',
    'Lithuanian': 'LT',
    'Estonian': 'EE',
    // Codici ISO brevi
    'en': 'GB',
    'fr': 'FR',
    'it': 'IT',
    'de': 'DE',
    'es': 'ES',
    'ja': 'JP',
    'ko': 'KR',
    'pl': 'PL',
    'pt': 'PT',
    'ru': 'RU',
    'zh': 'CN',
    'tr': 'TR',
    'uk': 'UA',
    'nl': 'NL',
    'sv': 'SE',
    'cs': 'CZ',
    'hu': 'HU',
    'ro': 'RO',
    'da': 'DK',
    'no': 'NO',
    'fi': 'FI',
    'ar': 'SA',
    'th': 'TH',
    'vi': 'VN',
    'bg': 'BG',
    'el': 'GR',
    'he': 'IL',
    // All
    'all': 'ALL',
    'All': 'ALL',
};

// 🏁 Fallback emoji bandiere per paesi non supportati
export const getFlagEmoji = (countryCode: string): string => {
    const flagEmojis: { [key: string]: string } = {
        'ALL': '🌐',
        'GB': '🇬🇧', 'FR': '🇫🇷', 'IT': '🇮🇹', 'DE': '🇩🇪', 'ES': '🇪🇸',
        'MX': '🇲🇽', 'JP': '🇯🇵', 'KR': '🇰🇷', 'PL': '🇵🇱', 'BR': '🇧🇷',
        'PT': '🇵🇹', 'RU': '🇷🇺', 'CN': '🇨🇳', 'TW': '🇹🇼', 'TR': '🇹🇷',
        'UA': '🇺🇦', 'NL': '🇳🇱', 'SE': '🇸🇪', 'CZ': '🇨🇿', 'HU': '🇭🇺',
        'RO': '🇷🇴', 'DK': '🇩🇰', 'NO': '🇳🇴', 'FI': '🇫🇮',
        'SA': '🇸🇦', 'TH': '🇹🇭', 'VN': '🇻🇳', 'BG': '🇧🇬',
        'GR': '🇬🇷', 'IL': '🇮🇱', 'LV': '🇱🇻', 'LT': '🇱🇹', 'EE': '🇪🇪',
    };
    return flagEmojis[countryCode] || `🏴‍☠️`;
};

interface LanguageFlagsProps {
    supportedLanguages: string[] | string; // Accetta sia array che stringa
    maxFlags?: number;
}

export const LanguageFlags: React.FC<LanguageFlagsProps> = ({ supportedLanguages, maxFlags = 7 }) => {
    // Gestisce sia array che stringa di lingue
    const languagesArray = Array.isArray(supportedLanguages) 
        ? supportedLanguages 
        : (typeof supportedLanguages === 'string' ? supportedLanguages.split(',') : []);
    
    const flagCodes = languagesArray
        .map(lang => {
            const cleanLang = lang.toLowerCase().trim();
            return languageToCountryCode[cleanLang];
        })
        .filter((code): code is string => !!code) // Rimuove eventuali lingue non mappate e assicura il tipo
        .slice(0, maxFlags); // Limita il numero di bandiere mostrate

    if (flagCodes.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-0.5">
            {flagCodes.map((code, index) => {
                // Dinamicamente prende il componente bandiera
                const FlagComponent = (CountryFlags as any)[code];
                
                if (FlagComponent) {
                    return (
                        <div 
                            key={`${code}-${index}`}
                            className="w-3.5 h-2.5 shadow-sm rounded-[1px] overflow-hidden"
                            title={code}
                        >
                            <FlagComponent className="w-full h-full object-cover" />
                        </div>
                    );
                }

                // Fallback emoji
                return (
                    <span 
                        key={`${code}-${index}`} 
                        className="text-[10px] leading-none" 
                        title={code}
                    >
                        {getFlagEmoji(code)}
                    </span>
                );
            })}
        </div>
    );
};

// Export helper per ottenere codice paese da lingua (utile per filtri esterni)
export const getCountryCode = (language: string): string | undefined => {
    const trimmed = language.trim();
    // First prova esatto, poi minuscolo
    return languageToCountryCode[trimmed] || languageToCountryCode[trimmed.toLowerCase()];
};



