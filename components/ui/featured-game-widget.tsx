'use client';

import { useState, useEffect } from 'react';
import { Gamepad2, Languages, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface FeaturedGameWidgetProps {
  collapsed?: boolean;
}

interface GameInfo {
  name: string;
  cover?: string;
  appid?: number;
  reason?: string;
}

interface NotableGame {
  name: string;
  appid: number;
  cover: string;
  missingLangs: string[]; // Lingue mancanti: 'it', 'fr', 'de', 'es', 'ja', 'zh'
}

// Giochi notevoli con le lingue che mancano
const NOTABLE_GAMES: NotableGame[] = [
  // Giochi che mancano di italiano
  { name: "Outer Wilds", appid: 753640, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/753640/header.jpg", missingLangs: ['it', 'es'] },
  { name: "Disco Elysium", appid: 632470, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/632470/header.jpg", missingLangs: ['it'] },
  { name: "Hollow Knight", appid: 367520, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/367520/header.jpg", missingLangs: ['it'] },
  { name: "Celeste", appid: 504230, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/504230/header.jpg", missingLangs: ['it', 'de'] },
  { name: "Slay the Spire", appid: 646570, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/646570/header.jpg", missingLangs: ['it'] },
  { name: "Return of the Obra Dinn", appid: 653530, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/653530/header.jpg", missingLangs: ['it', 'es', 'de'] },
  { name: "Inscryption", appid: 1092790, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1092790/header.jpg", missingLangs: ['it', 'es'] },
  { name: "Vampire Survivors", appid: 1794680, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1794680/header.jpg", missingLangs: ['fr', 'de'] },
  { name: "Hades", appid: 1145360, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1145360/header.jpg", missingLangs: ['it'] },
  { name: "Undertale", appid: 391540, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/391540/header.jpg", missingLangs: ['it'] },
  { name: "Cuphead", appid: 268910, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/268910/header.jpg", missingLangs: ['it'] },
  // Giochi giapponesi che mancano di inglese
  { name: "Touhou Luna Nights", appid: 851100, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/851100/header.jpg", missingLangs: ['en', 'it', 'fr', 'de', 'es'] },
  { name: "Gnosia", appid: 1192410, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1192410/header.jpg", missingLangs: ['it', 'fr', 'de', 'es'] },
  { name: "13 Sentinels: Aegis Rim", appid: 2147730, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2147730/header.jpg", missingLangs: ['it', 'de'] },
  { name: "AI: The Somnium Files", appid: 948740, cover: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/948740/header.jpg", missingLangs: ['it', 'de', 'es'] },
];

// Nomi lingue per il messaggio "Manca X"
const LANG_NAMES: Record<string, Record<string, string>> = {
  it: { it: 'italiano', en: 'Italian', es: 'italiano', fr: 'italien', de: 'Italienisch' },
  en: { it: 'inglese', en: 'English', es: 'inglés', fr: 'anglais', de: 'Englisch' },
  fr: { it: 'francese', en: 'French', es: 'francés', fr: 'français', de: 'Französisch' },
  de: { it: 'tedesco', en: 'German', es: 'alemán', fr: 'allemand', de: 'Deutsch' },
  es: { it: 'spagnolo', en: 'Spanish', es: 'español', fr: 'espagnol', de: 'Spanisch' },
  ja: { it: 'giapponese', en: 'Japanese', es: 'japonés', fr: 'japonais', de: 'Japanisch' },
  zh: { it: 'cinese', en: 'Chinese', es: 'chino', fr: 'chinois', de: 'Chinesisch' },
};

export function FeaturedGameWidget({ collapsed = false }: FeaturedGameWidgetProps) {
  const { t, language } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filteredGames, setFilteredGames] = useState<NotableGame[]>([]);
  const [game, setGame] = useState<GameInfo | null>(null);

  // Filtra giochi in base alla lingua dell'utente
  useEffect(() => {
    let targetLang = language;
    let filtered = NOTABLE_GAMES.filter(g => g.missingLangs.includes(targetLang));
    
    // Fallback a italiano se non ci sono giochi per la lingua selezionata
    if (filtered.length === 0 && targetLang !== 'it') {
      targetLang = 'it';
      filtered = NOTABLE_GAMES.filter(g => g.missingLangs.includes('it'));
    }
    
    setFilteredGames(filtered);
    setCurrentIndex(0);
  }, [language]);

  // Cambia gioco ogni 10 secondi
  useEffect(() => {
    if (filteredGames.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredGames.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [filteredGames]);

  // Aggiorna il gioco visualizzato quando cambia l'indice o la lingua
  useEffect(() => {
    if (filteredGames.length === 0) {
      setGame(null);
      return;
    }
    const targetLang = language;
    const notable = filteredGames[currentIndex];
    const langName = LANG_NAMES[targetLang]?.[language] || targetLang;
    
    setGame({
      name: notable.name,
      appid: notable.appid,
      cover: notable.cover,
      reason: `${t('widget.missing') || 'Manca'} ${langName}`
    });
  }, [currentIndex, filteredGames, language, t]);

  if (!game) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="px-2 py-3">
        <div 
          className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 flex items-center justify-center cursor-pointer hover:border-violet-400/50 transition-colors"
          title={game.name}
        >
          {game.cover ? (
            <img 
              src={game.cover} 
              alt={game.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <Gamepad2 className="h-5 w-5 text-violet-400" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-3">
      <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-2">
          <Languages className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] text-emerald-300/70 uppercase tracking-wider font-medium">
            {t('widget.recommendedToTranslate') || 'Da Tradurre'}
          </span>
        </div>
        
        <div className="flex gap-3">
          {/* Cover */}
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-violet-600/30 to-purple-600/20 border border-violet-500/30 flex items-center justify-center overflow-hidden shrink-0">
            {game.cover ? (
              <img 
                src={game.cover} 
                alt={game.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Gamepad2 className="h-6 w-6 text-violet-400" />
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-violet-200 truncate">
              {game.name}
            </h4>
            {game.reason && (
              <div className="flex items-center gap-1 mt-1">
                <Languages className="h-3 w-3 text-violet-400/50" />
                <span className="text-[10px] text-violet-400/70">
                  {game.reason}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Indicatori pallini + navigazione */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-violet-500/10">
          <button 
            onClick={() => setCurrentIndex((prev) => (prev - 1 + filteredGames.length) % filteredGames.length)}
            className="p-0.5 hover:bg-violet-500/20 rounded transition-colors"
          >
            <ChevronLeft className="h-3 w-3 text-violet-400/50" />
          </button>
          <div className="flex gap-1">
            {filteredGames.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === currentIndex 
                    ? 'bg-emerald-400' 
                    : 'bg-violet-500/30 hover:bg-violet-400/50'
                }`}
              />
            ))}
          </div>
          <button 
            onClick={() => setCurrentIndex((prev) => (prev + 1) % filteredGames.length)}
            className="p-0.5 hover:bg-violet-500/20 rounded transition-colors"
          >
            <ChevronRight className="h-3 w-3 text-violet-400/50" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default FeaturedGameWidget;
