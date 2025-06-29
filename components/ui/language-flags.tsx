import React from 'react';
import { FlagIcon } from 'react-flag-kit';

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
};

interface LanguageFlagsProps {
    supportedLanguages: string[]; // Accetta direttamente un array di stringhe
    maxFlags?: number;
}

export const LanguageFlags: React.FC<LanguageFlagsProps> = ({ supportedLanguages, maxFlags = 7 }) => {
    // Non è più necessario il parsing, usiamo direttamente l'array
    const flagCodes = supportedLanguages
        .map(lang => languageToCountryCode[lang.toLowerCase().trim()]) // Assicuriamoci che sia pulito
        .filter((code): code is string => !!code) // Rimuove eventuali lingue non mappate e assicura il tipo
        .slice(0, maxFlags); // Limita il numero di bandiere mostrate

    if (flagCodes.length === 0) {
        return null; // Non mostra nulla se non ci sono lingue mappate
    }

    return (
        <div className="flex items-center gap-1.5">
            {flagCodes.map(code => (
                <FlagIcon key={code} code={code} size={20} title={code} />
            ))}
        </div>
    );
};
