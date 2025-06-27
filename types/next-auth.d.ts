import 'next-auth';
import 'next-auth/jwt';

// NOTA: Questo file non viene rilevato automaticamente da TypeScript.
// Devi aggiungerlo all'array "include" nel tuo tsconfig.json.
// es. "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "types/**/*.ts"]

declare module 'next-auth' {
  /**
   * Dati del profilo Steam che vogliamo conservare.
   */
  interface SteamProfile {
    steamid: string;
    personaname: string;
    avatar: string;
    id: string; // L'id del nostro provider
  }

  /**
   * Estende la sessione predefinita per includere i nostri dati personalizzati.
   */
  interface Session {
    user: {
      /** I dati del profilo Steam dell'utente. */
      steam?: SteamProfile;
      /** Elenco dei provider di account collegati. */
      connectedProviders?: string[];
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /** Estende il token JWT predefinito per includere i nostri dati personalizzati. */
  interface JWT {
    /** I dati del profilo Steam dell'utente. */
    steam?: SteamProfile;
  }
}
