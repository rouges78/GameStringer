import React from 'react';
import * as CountryFlags from 'country-flag-icons/react/3x2';

// Mappa migliorata e più robusta dalle lingue di Steam ai codici paese ISO 3166-1 alpha-2
const languageToCountryCode: { [key: string]: string } = {
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
const getFlagEmoji = (countryCode: string): string => {
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
        // Debug: mostra bandiere di test se non ci sono dati
        console.log('⚠️ Nessuna bandiera da mostrare, usando test');
        const testFlags = ['IT', 'GB', 'FR'];
        return (
            <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 mr-2">TEST:</span>
                {testFlags.map(code => (
                    <span key={code} className="text-lg" title={`Test: ${code}`}>
                        {getFlagEmoji(code)}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5">
            {flagCodes.map(code => {
                // Dinamicamente prende il componente bandiera
                const FlagComponent = (CountryFlags as any)[code];
                console.log(`🏴 Rendering bandiera ${code}: FlagComponent=${!!FlagComponent}`);
                
                // Per ora forziamo sempre il fallback emoji per debug
                return (
                    <span 
                        key={code} 
                        className="text-lg hover:scale-110 transition-transform cursor-default" 
                        title={`Language: ${code}`}
                        style={{ display: 'inline-block' }}
                    >
                        {getFlagEmoji(code)}
                    </span>
                );
            })}
        </div>
    );
};
