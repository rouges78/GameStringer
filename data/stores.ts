export interface Store {
  id: string;
  name: string;
  icon?: any; // O un tipo più specifico se usi una libreria di icone
  testCommand: string; // Nome del comando Tauri per testare la connessione
}

export const stores: Store[] = [
  { id: 'steam', name: 'Steam', testCommand: 'test_steam_connection' },
  { id: 'epic_games', name: 'Epic Games', testCommand: 'test_epic_connection' },
  { id: 'gog', name: 'GOG', testCommand: 'test_gog_connection' },
  { id: 'origin', name: 'Origin / EA App', testCommand: 'test_origin_connection' },
  { id: 'ubisoft_connect', name: 'Ubisoft Connect', testCommand: 'test_ubisoft_connection' },
  { id: 'battle_net', name: 'Battle.net', testCommand: 'test_battlenet_connection' },
  { id: 'itch_io', name: 'itch.io', testCommand: 'test_itchio_connection' },
];
