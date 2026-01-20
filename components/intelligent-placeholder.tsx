'use client';

import React from 'react';
import { Gamepad2, Zap, Globe, Disc, Monitor, Smartphone, Store, Cpu, Wrench } from 'lucide-react';

interface IntelligentPlaceholderProps {
  gameName: string;
  store?: string;
  genre?: string;
  engine?: string;
  className?: string;
}

// Colori per diversi store
const storeColors = {
  steam: 'from-blue-600 to-blue-800',
  epic: 'from-gray-800 to-black',
  gog: 'from-purple-600 to-purple-800',
  origin: 'from-orange-500 to-orange-700',
  ubisoft: 'from-blue-500 to-blue-700',
  battlenet: 'from-blue-400 to-blue-600',
  itchio: 'from-red-500 to-red-700',
  xbox: 'from-green-500 to-green-700',
  default: 'from-gray-600 to-gray-800'
};

// Icone per diversi store
const storeIcons = {
  steam: Store,
  epic: Zap,
  gog: Globe,
  origin: Disc,
  ubisoft: Monitor,
  battlenet: Smartphone,
  xbox: Gamepad2,
  default: Gamepad2
};

// Colori per diversi generi
const genreColors = {
  action: 'from-red-500 to-red-700',
  adventure: 'from-green-500 to-green-700',
  rpg: 'from-purple-500 to-purple-700',
  strategy: 'from-blue-500 to-blue-700',
  simulation: 'from-yellow-500 to-yellow-700',
  sports: 'from-orange-500 to-orange-700',
  racing: 'from-pink-500 to-pink-700',
  puzzle: 'from-indigo-500 to-indigo-700',
  horror: 'from-gray-800 to-black',
  indie: 'from-teal-500 to-teal-700',
  default: 'from-gray-600 to-gray-800'
};

// Colori per diversi engine
const engineColors = {
  unity: 'from-gray-700 to-gray-900',
  unreal: 'from-blue-700 to-blue-900',
  godot: 'from-blue-500 to-blue-700',
  construct: 'from-orange-600 to-orange-800',
  gamemaker: 'from-green-600 to-green-800',
  cryengine: 'from-red-600 to-red-800',
  source: 'from-yellow-600 to-yellow-800',
  default: 'from-gray-600 to-gray-800'
};

const IntelligentPlaceholder: React.FC<IntelligentPlaceholderProps> = ({
  gameName,
  store = 'default',
  genre = 'default',
  engine = 'default',
  className = ''
}) => {
  // Determina il colore di sfondo basato su priorità: store > genre > engine
  const getBackgroundColor = () => {
    if (store && store !== 'default' && storeColors[store.toLowerCase() as keyof typeof storeColors]) {
      return storeColors[store.toLowerCase() as keyof typeof storeColors];
    }
    if (genre && genre !== 'default' && genreColors[genre.toLowerCase() as keyof typeof genreColors]) {
      return genreColors[genre.toLowerCase() as keyof typeof genreColors];
    }
    if (engine && engine !== 'default' && engineColors[engine.toLowerCase() as keyof typeof engineColors]) {
      return engineColors[engine.toLowerCase() as keyof typeof engineColors];
    }
    return storeColors.default;
  };

  // Determina l'icona basata sullo store
  const getStoreIcon = () => {
    const IconComponent = storeIcons[store?.toLowerCase() as keyof typeof storeIcons] || storeIcons.default;
    return IconComponent;
  };

  // Genera iniziali dal nome del gioco
  const getGameInitials = (name: string) => {
    return name
      .split(' ')
      .filter(word => word.length > 0)
      .slice(0, 3)
      .map(word => word[0].toUpperCase())
      .join('');
  };

  // Genera un pattern di sfondo basato sul nome del gioco
  const getPatternOpacity = () => {
    const hash = gameName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 30 + 10) / 100; // Opacità tra 0.1 e 0.4
  };

  const StoreIcon = getStoreIcon();
  const initials = getGameInitials(gameName);
  const backgroundGradient = getBackgroundColor();
  const patternOpacity = getPatternOpacity();

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Sfondo gradiente */}
      <div className={`absolute inset-0 bg-gradient-to-br ${backgroundGradient}`} />
      
      {/* Pattern di sfondo */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,${patternOpacity}) 0%, transparent 50%), 
                           radial-gradient(circle at 80% 80%, rgba(255,255,255,${patternOpacity * 0.7}) 0%, transparent 50%),
                           radial-gradient(circle at 40% 60%, rgba(255,255,255,${patternOpacity * 0.5}) 0%, transparent 50%)`
        }}
      />
      
      {/* Contenuto principale */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-white">
        {/* Icona store */}
        <div className="mb-3">
          <StoreIcon className="w-8 h-8 opacity-80" />
        </div>
        
        {/* Iniziali del gioco */}
        <div className="text-2xl font-bold mb-2 text-center leading-tight">
          {initials}
        </div>
        
        {/* Nome del gioco troncato */}
        <div className="text-xs text-center opacity-80 max-w-full">
          <div className="truncate px-2">
            {gameName.length > 20 ? `${gameName.substring(0, 20)}...` : gameName}
          </div>
        </div>
        
        {/* Badge store/genre/engine */}
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          {store && store !== 'default' && (
            <div className="bg-black/30 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
              {store.toUpperCase()}
            </div>
          )}
          {genre && genre !== 'default' && (
            <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-xs">
              {genre}
            </div>
          )}
          {engine && engine !== 'default' && (
            <div className="bg-white/10 backdrop-blur-sm px-2 py-1 rounded text-xs">
              {engine}
            </div>
          )}
        </div>
      </div>
      
      {/* Effetto hover */}
      <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors duration-300" />
    </div>
  );
};

export default IntelligentPlaceholder;
