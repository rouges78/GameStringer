declare module 'steamgriddb' {
  interface SearchResult {
    id: number;
    name: string;
    types: string[];
    verified: boolean;
  }

  interface Grid {
    id: number;
    score: number;
    style: string;
    url: string;
    thumb: string;
    author: {
      name: string;
      steam64: string;
      avatar: string;
    };
  }

  export default class SteamGridDB {
    constructor(apiKey: string);
    searchGame(name: string): Promise<SearchResult[]>;
    getGrids(options: { type?: 'game'; id: number; styles?: string[]; dimensions?: string[]; mimes?: string[]; nsfw?: string; humor?: string; }): Promise<Grid[]>;
  }
}
