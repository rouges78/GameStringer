'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { invoke } from '@/lib/tauri-api';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { LanguageFlags } from '@/components/ui/language-flags';

// Definiamo l'interfaccia per un singolo gioco, assicurandoci che corrisponda al backend
interface Game {
  id: string;
  app_id: string;
  title: string;
  platform: string;
  header_image: string | null;
  supported_languages?: string[]; // Lingue supportate dal gioco
  is_vr?: boolean; // Se il gioco supporta VR
  engine?: string | null; // Engine utilizzato dal gioco
  is_installed?: boolean; // Se il gioco è installato localmente
}

export default function LibraryPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [showVROnly, setShowVROnly] = useState(false);
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const result = await invoke('get_games');
        console.log(' Giochi caricati:', result);
        console.log(' Debug primi 3 giochi:', (result as Game[]).slice(0, 3));
        console.log(' Giochi con VR:', (result as Game[]).filter(g => g.is_vr));
        console.log(' Giochi con engine:', (result as Game[]).filter(g => g.engine));
        console.log(' Giochi installati:', (result as Game[]).filter(g => g.is_installed));
        console.log(' Totale giochi per piattaforma:', (result as Game[]).reduce((acc, g) => { acc[g.platform] = (acc[g.platform] || 0) + 1; return acc; }, {} as Record<string, number>));
        setGames(result as Game[]);
      } catch (error) {
        console.error(' Errore nel caricamento dei giochi:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setError(`Failed to load games: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
  }, []);

  // Estrai le piattaforme uniche dai giochi caricati
  const platforms = ['All', ...new Set(games.map(game => game.platform))];

  // Filtriamo e ordiniamo i giochi in base alla ricerca, piattaforma, VR e installazione
  const filteredGames = games
    .filter((game) => {
      const matchesPlatform = selectedPlatform === 'All' || game.platform === selectedPlatform;
      const matchesSearch = (game.title ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVR = !showVROnly || game.is_vr;
      const matchesInstalled = !showInstalledOnly || game.is_installed;
      return matchesPlatform && matchesSearch && matchesVR && matchesInstalled;
    })
    .sort((a, b) => a.title.localeCompare(b.title)); // Ordinamento alfabetico

  const renderContent = () => {
    if (isLoading) {
      // Scheletro UI per il caricamento
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="bg-gray-800 rounded-lg aspect-[3/4] animate-pulse" />
          ))}
        </div>
      );
    }

    if (error) {
      return <div className="text-red-500 text-center mt-10">Error: {error}</div>;
    }

    if (filteredGames.length === 0) {
      // Messaggio per quando non ci sono risultati
      return (
        <div className="text-center py-10">
          <p className="text-gray-400 mb-2">
            {searchTerm
              ? `Nessun gioco trovato per "${searchTerm}".`
              : "La tua libreria è vuota."}
          </p>
          {!searchTerm && (
            <p className="text-sm text-gray-500">
              Usa il pulsante 'Scansiona Giochi' per aggiungere giochi alla tua libreria.
            </p>
          )}
        </div>
      );
    }

    // Griglia dei giochi filtrati
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {filteredGames.map((game) => (
          <Card key={game.id} className="group overflow-hidden rounded-lg bg-gray-900 border border-transparent hover:border-purple-500 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-purple-500/20">
            <CardContent className="p-0 relative aspect-[3/4]">
              {game.header_image ? (
                <Image
                  src={game.header_image}
                  alt={`Copertina di ${game.title}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-600 bg-gray-800">
                  {game.title ? game.title.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              
              {/* Bandiere delle lingue supportate */}
              {game.supported_languages && game.supported_languages.length > 0 && (
                <div className="absolute top-2 right-2 bg-black bg-opacity-70 rounded-md p-1.5 backdrop-blur-sm">
                  <LanguageFlags supportedLanguages={game.supported_languages} maxFlags={5} />
                </div>
              )}
              
              {/* Badge VR, Engine e Installato */}
              <div className="absolute bottom-2 left-2 flex flex-col gap-1">
                {game.is_installed && (
                  <div className="bg-green-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full font-semibold backdrop-blur-sm">
                    ✓ Installato
                  </div>
                )}
                {game.is_vr && (
                  <div className="bg-purple-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full font-semibold backdrop-blur-sm">
                    🥽 VR
                  </div>
                )}
                {game.engine && (
                  <div className="bg-blue-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full font-semibold backdrop-blur-sm">
                    {game.engine}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="p-3 bg-black bg-opacity-60 backdrop-blur-sm absolute bottom-0 w-full transition-opacity duration-300 opacity-0 group-hover:opacity-100">
              <p className="text-sm font-semibold truncate text-white" title={game.title ?? 'Gioco senza nome'}>
                {game.title ?? 'Gioco senza nome'}
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Sezione di ricerca e titolo */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Libreria Giochi</h1>
        <p className="text-gray-400">
          {games.length > 0
            ? `${filteredGames.length} di ${games.length} giochi trovati.`
            : 'Nessun gioco nella libreria.'}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {platforms.map(platform => (
          <button
            key={platform}
            onClick={() => setSelectedPlatform(platform)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${
              selectedPlatform === platform
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}>
            {platform}
          </button>
        ))}
        
        {/* Toggle per filtro VR */}
        <button
          onClick={() => setShowVROnly(!showVROnly)}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${
            showVROnly
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}>
          🥽 Solo VR
        </button>
        
        {/* Toggle per filtro Installato */}
        <button
          onClick={() => setShowInstalledOnly(!showInstalledOnly)}
          className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 ${
            showInstalledOnly
              ? 'bg-green-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}>
          ✓ Solo Installati
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Cerca per nome..."
          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Contenuto principale (griglia, caricamento, errori) */}
      {renderContent()}
    </div>
  );
}
