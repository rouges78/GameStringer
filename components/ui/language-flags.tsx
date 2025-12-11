import React from 'react';
import * as CountryFlags from 'country-flag-icons/react/3x2';

// Mappa migliorata e più robusta dalle lingue di Steam ai codici paese ISO 3166-1 alpha-2
export const languageToCountryCode: { [key: string]: string } = {
    'english': 'GB',
    'french': 'FR',
    'italian': 'IT',
    'german': 'DE',
    'spanish - spain': 'ES',
    'spanish': 'ES', // Chiave generica
    'spanish - latin america': 'MX',
    'japanese': 'JP',
    'korean': 'KR',
    'polish': 'PL',
    'portuguese - brazil': 'BR',
    'portuguese': 'PT', // Chiave generica
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
    'arabic': 'SA', // Arabia Saudita come rappresentante del mondo arabo
    'thai': 'TH',
    'vietnamese': 'VN',
    'bulgarian': 'BG',
    'greek': 'GR',
    'hebrew': 'IL',
    'latvian': 'LV',
    'lithuanian': 'LT',
    'estonian': 'EE',
};

// 🏁 Fallback emoji bandiere per paesi non supportati
export const getFlagEmoji = (countryCode: string): string => {
    const flagEmojis: { [key: string]: string } = {
        'GB': '🇬🇧', 'FR': '🇫🇷', 'IT': '🇮🇹', 'DE': '🇩🇪', 'ES': '🇪🇸',
        'MX': '🇲🇽', 'JP': '🇯🇵', 'KR': '🇰🇷', 'PL': '🇵🇱', 'BR': '🇧🇷',
        'PT': '🇵🇹', 'RU': '🇷🇺', 'CN': '🇨🇳', 'TW': '🇹🇼', 'TR': '🇹🇷',
        'UA': '🇺🇦', 'NL': '🇳🇱', 'SE': '🇸🇪', 'CZ': '🇨🇿', 'HU': '🇭🇺',
        'RO': '🇷🇴', 'DK': '🇩🇰', 'NO': '🇳🇴', 'FI': '🇫🇮',
        'SA': '🇸🇦', 'TH': '🇹🇭', 'VN': '🇻🇳', 'BG': '🇧🇬',
        'GR': '🇬🇷', 'IL': '🇮🇱', 'LV': '🇱🇻', 'LT': '🇱🇹', 'EE': '🇪🇪',
    };
    return flagEmojis[countryCode] || `🏴‍☠️`; // Pirata come fallback divertente
};

interface LanguageFlagsProps {
    supportedLanguages: string[] | string; // Accetta sia array che stringa
    maxFlags?: number;
}

export const LanguageFlags: React.FC<LanguageFlagsProps> = ({ supportedLanguages, maxFlags = 7 }) => {
    // Debug: log lingue ricevute
    console.log('🏁 LanguageFlags ricevute:', supportedLanguages);
    
    // Gestisce sia array che stringa di lingue
    const languagesArray = Array.isArray(supportedLanguages) 
        ? supportedLanguages 
        : (typeof supportedLanguages === 'string' ? supportedLanguages.split(',') : []);
    
    const flagCodes = languagesArray
        .map(lang => {
            const cleanLang = lang.toLowerCase().trim();
            const code = languageToCountryCode[cleanLang];
            console.log(`🔄 Lingua "${lang}" → Pulita "${cleanLang}" → Codice "${code}"`);
            return code;
        })
        .filter((code): code is string => !!code) // Rimuove eventuali lingue non mappate e assicura il tipo
        .slice(0, maxFlags); // Limita il numero di bandiere mostrate

    console.log('🎯 Codici bandiere finali:', flagCodes);

    if (flagCodes.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-1.5">
            {flagCodes.map((code, index) => {
                // Dinamicamente prende il componente bandiera
                const FlagComponent = (CountryFlags as any)[code];
                
                if (FlagComponent) {
                    return (
                        <div 
                            key={`${code}-${index}`}
                            className="w-5 h-3.5 shadow-sm rounded-[1px] overflow-hidden hover:scale-110 transition-transform cursor-default relative group"
                            title={`Language: ${code}`}
                        >
                            <FlagComponent className="w-full h-full object-cover" />
                        </div>
                    );
                }

                // Fallback emoji
                return (
                    <span 
                        key={`${code}-${index}`} 
                        className="text-lg hover:scale-110 transition-transform cursor-default leading-none" 
                        title={`Language: ${code}`}
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
    return languageToCountryCode[language.toLowerCase().trim()];
};
